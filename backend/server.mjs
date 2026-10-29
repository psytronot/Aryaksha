import express from 'express';
import path from 'node:path';
import * as satellite from 'satellite.js';
import { createRateLimiter, securityHeaders } from './security.mjs';

const app = express();
const port = Number(process.env.PORT || 3000);
const EARTH_RADIUS = 6378.137;

app.disable('x-powered-by');
// Render terminates TLS and forwards requests through one trusted proxy hop.
app.set('trust proxy', 1);
app.use(securityHeaders);
app.use(express.json({ limit: '64kb', strict: false }));
const apiRateLimit = createRateLimiter({ windowMs: 60_000, maxRequests: 60 });
app.get('/api/_healthcheck', (_req, res) => res.json({ message: 'Success', service: 'aryaksha-api' }));
app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok', service: 'aryaksha-api' }));

app.post('/api/mission-analysis/orbit', apiRateLimit, async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Request body must be a JSON object.' });
  }

  const requiredFields = ['altitudeKm', 'inclinationDeg', 'eccentricity'];
  const allowedFields = new Set([...requiredFields, 'elapsedSeconds']);
  const bodyFields = Object.keys(body);
  if (requiredFields.some(field => !Object.prototype.hasOwnProperty.call(body, field)) || bodyFields.some(field => !allowedFields.has(field))) {
    return res.status(400).json({ error: 'Request must contain altitudeKm, inclinationDeg, eccentricity, and optional elapsedSeconds only.' });
  }

  const { altitudeKm, inclinationDeg, eccentricity } = body;
  const elapsedSeconds = body.elapsedSeconds === undefined ? 0 : body.elapsedSeconds;
  if (![altitudeKm, inclinationDeg, eccentricity, elapsedSeconds].every(value => typeof value === 'number' && Number.isFinite(value))) {
    return res.status(400).json({ error: 'Orbit parameters and elapsedSeconds must be finite JSON numbers.' });
  }
  if (elapsedSeconds < 0 || elapsedSeconds > 604800) return res.status(400).json({ error: 'Elapsed time must be between 0 and 604,800 seconds (7 days).' });
  if (altitudeKm < 120 || altitudeKm > 100000) return res.status(400).json({ error: 'Altitude must be between 120 and 100,000 km for this preliminary model.' });
  if (inclinationDeg < 0 || inclinationDeg > 180) return res.status(400).json({ error: 'Inclination must be between 0 and 180 degrees.' });
  if (eccentricity < 0 || eccentricity >= 1) return res.status(400).json({ error: 'Eccentricity must be at least zero and less than one.' });
  const a = EARTH_RADIUS + altitudeKm;
  const rp = a * (1 - eccentricity);
  const ra = a * (1 + eccentricity);
  if (rp <= EARTH_RADIUS) return res.status(400).json({ error: 'The selected orbit intersects Earth at periapsis.' });

  const serviceUrl = process.env.OREKIT_SERVICE_URL?.trim().replace(/\/$/, '');
  if (!serviceUrl) {
    return res.status(503).json({ error: 'Orekit service is not configured. Mission analysis is unavailable until OREKIT_SERVICE_URL is set.' });
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);
    let upstream;
    try {
      upstream = await fetch(`${serviceUrl}/api/v1/orbit/analysis`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ altitudeKm, inclinationDeg, eccentricity, elapsedSeconds }),
        signal: controller.signal
      });
    } finally { clearTimeout(timer); }
    if (!upstream.ok) return res.status(502).json({ error: `Orekit service returned HTTP ${upstream.status}.` });
    const payload = await upstream.json();
    if (payload.valid !== true || payload.engine !== 'Orekit' || payload.comparison?.engineAdapter !== 'orekit-http' || !payload.orbit || !payload.state) {
      return res.status(502).json({ error: 'Orekit service returned an invalid analysis response.' });
    }
    return res.json({ ...payload, comparison: { engineAdapter: 'orekit-http', status: 'connected', note: 'Results returned by the independently hosted Orekit service.' } });
  } catch (err) {
    return res.status(502).json({ error: err?.name === 'AbortError' ? 'Orekit service timed out after 90 seconds.' : 'Orekit service is configured but unavailable. Check its deployment and logs.' });
  }
});

app.get('/api/live/iss', apiRateLimit, async (_req, res) => {
  try {
    const upstream = await fetch('https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE', { headers: { accept: 'text/plain' } });
    if (!upstream.ok) return res.status(502).json({ error: `CelesTrak returned HTTP ${upstream.status}.` });
    const lines = (await upstream.text()).split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    const line1 = lines.find(x => x.startsWith('1 '));
    const line2 = lines.find(x => x.startsWith('2 '));
    const name = lines.find(x => !x.startsWith('1 ') && !x.startsWith('2 ')) || 'ISS (LIVE)';
    if (!line1 || !line2) return res.status(502).json({ error: 'CelesTrak returned an unexpected ISS TLE payload.' });
    return res.json({ name, line1, line2, fetchedAt: Date.now(), cached: false, source: 'CelesTrak GP' });
  } catch {
    return res.status(502).json({ error: 'Live ISS feed is unavailable.' });
  }
});

app.post('/api/simulation/propagate', apiRateLimit, (req, res) => {
  const seconds = Number(req.body?.seconds ?? 0);
  if (!Number.isFinite(seconds) || seconds < 0) return res.status(400).json({ error: 'Simulation time must be finite and non-negative.' });
  const input = req.body ?? {};
  try {
    if (input.mode === 'tle') {
      const line1 = String(input.tle?.line1 ?? '').trim();
      const line2 = String(input.tle?.line2 ?? '').trim();
      if (!line1 || !line2) return res.status(400).json({ error: 'Both TLE lines are required.' });
      const satrec = satellite.twoline2satrec(line1, line2);
      if (satrec.error) return res.status(400).json({ error: `TLE rejected by SGP4 parser (code ${satrec.error}).` });
      const epoch = new Date((Number(satrec.jdsatepoch) - 2440587.5) * 86400000);
      const date = new Date(epoch.getTime() + seconds * 1000);
      const state = satellite.propagate(satrec, date);
      if (!state?.position || !state?.velocity) return res.status(422).json({ error: 'SGP4 propagation failed.' });
      const geo = satellite.eciToGeodetic(state.position, satellite.gstime(date));
      return res.json({ valid: true, source: 'backend', propagator: 'SGP4', epoch: epoch.toISOString(),
        name: input.tle?.name || 'TLE Satellite',
        r: [state.position.x, state.position.y, state.position.z],
        v: [state.velocity.x, state.velocity.y, state.velocity.z],
        lla: { lat: satellite.degreesLat(geo.latitude), lon: satellite.degreesLong(geo.longitude), alt: geo.height } });
    }
    return res.status(400).json({ error: 'Standalone propagation currently supports TLE/SGP4 mode only; use the in-app analytical propagator for classical elements.' });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Simulation core failed.' });
  }
});

app.use((err, _req, res, next) => {
  if (res.headersSent) return next(err);
  if (err?.type === 'entity.parse.failed' || err?.type === 'entity.verify.failed') {
    return res.status(400).json({ error: 'Request body must be valid JSON.' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body exceeds the 64 KiB limit.' });
  }
  return next(err);
});

app.use(express.static(path.resolve('dist')));
app.get('*', (_req, res) => res.sendFile(path.resolve('dist/index.html')));

app.listen(port, '0.0.0.0', () => console.log(`Aryaksha API listening on :${port}`));
