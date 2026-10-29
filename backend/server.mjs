import express from 'express';
import * as satellite from 'satellite.js';

const app = express();
const port = Number(process.env.PORT || 3000);
const MU = 398600.4418;
const EARTH_RADIUS = 6378.137;

app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));
app.get('/api/_healthcheck', (_req, res) => res.json({ message: 'Success', service: 'aryaksha-api' }));
app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok', service: 'aryaksha-api' }));

app.post('/api/mission-analysis/orbit', async (req, res) => {
  const altitudeKm = Number(req.body?.altitudeKm);
  const inclinationDeg = Number(req.body?.inclinationDeg);
  const eccentricity = Number(req.body?.eccentricity);
  if (![altitudeKm, inclinationDeg, eccentricity].every(Number.isFinite)) {
    return res.status(400).json({ error: 'Altitude, inclination and eccentricity must be finite numbers.' });
  }
  if (altitudeKm < 120 || altitudeKm > 100000) return res.status(400).json({ error: 'Altitude must be between 120 and 100,000 km for this preliminary model.' });
  if (inclinationDeg < 0 || inclinationDeg > 180) return res.status(400).json({ error: 'Inclination must be between 0 and 180 degrees.' });
  if (eccentricity < 0 || eccentricity >= 1) return res.status(400).json({ error: 'Eccentricity must be at least zero and less than one.' });
  const a = EARTH_RADIUS + altitudeKm;
  const rp = a * (1 - eccentricity);
  const ra = a * (1 + eccentricity);
  if (rp <= EARTH_RADIUS) return res.status(400).json({ error: 'The selected orbit intersects Earth at periapsis.' });

  const serviceUrl = process.env.OREKIT_SERVICE_URL?.trim().replace(/\/$/, '');
  if (serviceUrl) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      let upstream;
      try {
        upstream = await fetch(`${serviceUrl}/api/v1/orbit/analysis`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ altitudeKm, inclinationDeg, eccentricity }),
          signal: controller.signal
        });
      } finally { clearTimeout(timer); }
      if (!upstream.ok) return res.status(502).json({ error: `Orekit service returned HTTP ${upstream.status}.` });
      const payload = await upstream.json();
      if (payload.valid !== true || typeof payload.engine !== 'string' || !payload.orbit) {
        return res.status(502).json({ error: 'Orekit service returned an invalid analysis response.' });
      }
      return res.json({ ...payload, comparison: { engineAdapter: 'orekit-http', status: 'connected', note: 'Results returned by the independently hosted Orekit service.' } });
    } catch (err) {
      return res.status(502).json({ error: err?.name === 'AbortError' ? 'Orekit service timed out after 15 seconds.' : 'Orekit service is configured but unavailable. Check its deployment and logs.' });
    }
  }

  const periodSeconds = 2 * Math.PI * Math.sqrt(a ** 3 / MU);
  return res.json({
    valid: true,
    engine: 'Aryaksha Kepler baseline',
    engineVersion: '1.0',
    fidelity: 'Analytical two-body orbital elements',
    assumptions: [
      'Earth gravitational parameter MU = 398600.4418 km³/s²',
      'Earth equatorial radius = 6378.137 km',
      'No J2, drag, solar radiation pressure or third-body effects'
    ],
    orbit: {
      altitudeKm, semiMajorAxisKm: a, eccentricity, inclinationDeg, periodSeconds,
      periodMinutes: periodSeconds / 60,
      periapsisAltitudeKm: rp - EARTH_RADIUS,
      apoapsisAltitudeKm: ra - EARTH_RADIUS,
      circularVelocityKmS: Math.sqrt(MU / a),
      specificOrbitalEnergyKm2S2: -MU / (2 * a)
    },
    comparison: {
      engineAdapter: 'kepler-baseline', status: 'baseline',
      note: 'Computed in the Aryaksha backend with a closed-form two-body model. No external mission-analysis engine is invoked.'
    }
  });
});

app.get('/api/live/iss', async (_req, res) => {
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

app.post('/api/simulation/propagate', (req, res) => {
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

app.listen(port, '0.0.0.0', () => console.log(`Aryaksha API listening on :${port}`));
