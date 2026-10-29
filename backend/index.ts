import { router, json, error } from '@appdeploy/sdk';
import * as satellite from 'satellite.js';

const MU = 398600.4418;
const EARTH_RADIUS = 6378.137;
const EARTH_E2 = 0.00669437999014;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
let liveIssCache: { name: string; line1: string; line2: string; fetchedAt: number } | null = null;

type Elements = { a: number; e: number; i: number; raan: number; argp: number; nu: number };
type Body = { mode?: 'elements' | 'tle'; seconds?: number; elements?: Elements; tle?: { name?: string; line1?: string; line2?: string } };

function mat(m: number[][], v: number[]) {
  return m.map(row => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
}

function stateFromElements(el: Elements, seconds: number) {
  const i = rad(el.i), O = rad(el.raan), w = rad(el.argp);
  const n = Math.sqrt(MU / el.a ** 3);
  const E0 = 2 * Math.atan2(Math.sqrt(1 - el.e) * Math.sin(rad(el.nu) / 2), Math.sqrt(1 + el.e) * Math.cos(rad(el.nu) / 2));
  const M0 = E0 - el.e * Math.sin(E0);
  let M = M0 + n * seconds;
  M = ((M + Math.PI) % (2 * Math.PI)) - Math.PI;
  let E = el.e < 0.8 ? M : Math.PI;
  for (let k = 0; k < 30; k += 1) {
    const d = (E - el.e * Math.sin(E) - M) / (1 - el.e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  const nu = 2 * Math.atan2(Math.sqrt(1 + el.e) * Math.sin(E / 2), Math.sqrt(1 - el.e) * Math.cos(E / 2));
  const p = el.a * (1 - el.e * el.e);
  const rr = p / (1 + el.e * Math.cos(nu));
  const rp = [rr * Math.cos(nu), rr * Math.sin(nu), 0];
  const vp = [-Math.sqrt(MU / p) * Math.sin(nu), Math.sqrt(MU / p) * (el.e + Math.cos(nu)), 0];
  const cO = Math.cos(O), sO = Math.sin(O), ci = Math.cos(i), si = Math.sin(i), cw = Math.cos(w), sw = Math.sin(w);
  const R = [[cO * cw - sO * sw * ci, -cO * sw - sO * cw * ci, sO * si], [sO * cw + cO * sw * ci, -sO * sw + cO * cw * ci, -cO * si], [sw * si, cw * si, ci]];
  return { r: mat(R, rp), v: mat(R, vp) };
}

function eciToLla(r: number[], date: Date) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const T = (jd - 2451545) / 36525;
  const theta = rad((280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * T * T - (T * T * T) / 38710000) % 360);
  const c = Math.cos(theta), s = Math.sin(theta);
  const x = c * r[0] + s * r[1], y = -s * r[0] + c * r[1], z = r[2];
  const lon = Math.atan2(y, x), p = Math.hypot(x, y);
  let lat = Math.atan2(z, p * (1 - EARTH_E2));
  for (let k = 0; k < 12; k += 1) {
    const sl = Math.sin(lat);
    const N = EARTH_RADIUS / Math.sqrt(1 - EARTH_E2 * sl * sl);
    lat = Math.atan2(z + EARTH_E2 * N * sl, p);
  }
  const sl = Math.sin(lat), N = EARTH_RADIUS / Math.sqrt(1 - EARTH_E2 * sl * sl);
  return { lat: deg(lat), lon: deg(lon), alt: p / Math.cos(lat) - N };
}

function finiteState(state: { r: number[]; v: number[]; lla: { lat: number; lon: number; alt: number } }) {
  return [...state.r, ...state.v, state.lla.lat, state.lla.lon, state.lla.alt].every(Number.isFinite);
}

export const handler = router({
  'GET /api/_healthcheck': [async () => json({ message: 'Success', service: 'orbital-lab-core' })],
  'GET /api/live/iss': [async () => {
    const now = Date.now();
    if (liveIssCache && now - liveIssCache.fetchedAt < 2 * 60 * 60 * 1000) return json({ ...liveIssCache, cached: true, source: 'CelesTrak GP' });
    try {
      const response = await fetch('https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE', { headers: { accept: 'text/plain' } });
      if (!response.ok) return error(`CelesTrak returned HTTP ${response.status}.`, 502);
      const lines = (await response.text()).split('\n').map(line => line.trim()).filter(Boolean);
      const line1 = lines.find(line => line.startsWith('1 '));
      const line2 = lines.find(line => line.startsWith('2 '));
      const name = lines.find(line => !line.startsWith('1 ') && !line.startsWith('2 ')) || 'ISS (LIVE)';
      if (!line1 || !line2) return error('CelesTrak returned an unexpected ISS TLE payload.', 502);
      liveIssCache = { name, line1, line2, fetchedAt: now };
      return json({ ...liveIssCache, cached: false, source: 'CelesTrak GP' });
    } catch (cause) {
      return error(cause instanceof Error ? cause.message : 'Live ISS feed unavailable.', 502);
    }
  }],
  'POST /api/mission-analysis/orbit': [async ({ body }) => {
    const input = (body ?? {}) as { altitudeKm?: number; inclinationDeg?: number; eccentricity?: number };
    const altitudeKm = Number(input.altitudeKm), inclinationDeg = Number(input.inclinationDeg), eccentricity = Number(input.eccentricity);
    if (![altitudeKm, inclinationDeg, eccentricity].every(Number.isFinite)) return error('Altitude, inclination and eccentricity must be finite numbers.', 400);
    if (altitudeKm < 120 || altitudeKm > 100000) return error('Altitude must be between 120 and 100,000 km for this preliminary model.', 400);
    if (inclinationDeg < 0 || inclinationDeg > 180) return error('Inclination must be between 0 and 180 degrees.', 400);
    if (eccentricity < 0 || eccentricity >= 1) return error('Eccentricity must be at least zero and less than one.', 400);
    const serviceUrl = process.env.OREKIT_SERVICE_URL?.trim().replace(/\/$/, '');
    if (serviceUrl) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        let response: Response;
        try {
          response = await fetch(`${serviceUrl}/api/v1/orbit/analysis`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ altitudeKm, inclinationDeg, eccentricity }),
            signal: controller.signal
          });
        } finally {
          clearTimeout(timeout);
        }
        if (!response.ok) return error(`Orekit service returned HTTP ${response.status}.`, 502);
        const result = await response.json() as Record<string, unknown>;
        if (result.valid !== true || typeof result.engine !== 'string' || !result.orbit || typeof result.orbit !== 'object') {
          return error('Orekit service returned an invalid analysis response.', 502);
        }
        return json({ ...result, comparison: { engineAdapter: 'orekit-http', status: 'connected', note: 'Results returned by the independently hosted Orekit service.' } });
      } catch (cause) {
        return error(cause instanceof Error && cause.name === 'AbortError' ? 'Orekit service timed out after 15 seconds.' : 'Orekit service is configured but unavailable. Check its deployment and logs.', 502);
      }
    }
    const semiMajorAxisKm = EARTH_RADIUS + altitudeKm;
    const periapsisRadiusKm = semiMajorAxisKm * (1 - eccentricity);
    const apoapsisRadiusKm = semiMajorAxisKm * (1 + eccentricity);
    if (periapsisRadiusKm <= EARTH_RADIUS) return error('The selected orbit intersects Earth at periapsis.', 400);
    const periodSeconds = 2 * Math.PI * Math.sqrt(semiMajorAxisKm ** 3 / MU);
    const circularVelocityKmS = Math.sqrt(MU / semiMajorAxisKm);
    const specificOrbitalEnergyKm2S2 = -MU / (2 * semiMajorAxisKm);
    return json({
      valid: true, engine: 'Aryaksha Kepler baseline', engineVersion: '1.0',
      fidelity: 'Analytical two-body orbital elements',
      assumptions: ['Earth gravitational parameter MU = 398600.4418 km³/s²', 'Earth equatorial radius = 6378.137 km', 'No J2, drag, solar radiation pressure or third-body effects'],
      orbit: { altitudeKm, semiMajorAxisKm, eccentricity, inclinationDeg, periodSeconds, periodMinutes: periodSeconds / 60, periapsisAltitudeKm: periapsisRadiusKm - EARTH_RADIUS, apoapsisAltitudeKm: apoapsisRadiusKm - EARTH_RADIUS, circularVelocityKmS, specificOrbitalEnergyKm2S2 },
      comparison: { engineAdapter: 'kepler-baseline', status: 'baseline', note: 'Computed in the Aryaksha backend with a closed-form two-body model. No external mission-analysis engine is invoked yet.' }
    });
  }],
  'POST /api/simulation/propagate': [async ({ body }) => {
    const input = (body ?? {}) as Body;
    const seconds = Number(input.seconds ?? 0);
    if (!Number.isFinite(seconds)) return error('Simulation time must be finite.', 400);
    if (seconds < 0) return error('Simulation time cannot be negative.', 400);
    try {
      if (input.mode === 'tle') {
        const line1 = input.tle?.line1?.trim() ?? '';
        const line2 = input.tle?.line2?.trim() ?? '';
        if (!line1 || !line2) return error('Both TLE lines are required.', 400);
        const satrec = satellite.twoline2satrec(line1, line2);
        if (satrec.error && satrec.error !== 0) return error(`TLE rejected by SGP4 parser (code ${satrec.error}).`, 400);
        const epoch = new Date((Number(satrec.jdsatepoch) - 2440587.5) * 86400000);
        const date = new Date(epoch.getTime() + seconds * 1000);
        const result = satellite.propagate(satrec, date);
        if (!result?.position || !result?.velocity) return error('SGP4 propagation failed.', 422);
        const geo = satellite.eciToGeodetic(result.position, satellite.gstime(date));
        const state = { r: [result.position.x, result.position.y, result.position.z], v: [result.velocity.x, result.velocity.y, result.velocity.z], lla: { lat: deg(geo.latitude), lon: deg(geo.longitude), alt: geo.height } };
        if (!finiteState(state)) return error('SGP4 returned a non-finite state.', 422);
        return json({ valid: true, source: 'backend', propagator: 'SGP4', epoch: epoch.toISOString(), name: input.tle?.name || 'TLE Satellite', ...state });
      }
      const el = input.elements;
      if (!el || ![el.a, el.e, el.i, el.raan, el.argp, el.nu].every(Number.isFinite)) return error('Complete finite classical orbital elements are required.', 400);
      if (el.a <= EARTH_RADIUS || el.e < 0 || el.e >= 1 || Math.abs(el.i) > 180) return error('Orbital elements are outside supported bound limits.', 400);
      const date = new Date('2026-01-01T00:00:00.000Z');
      date.setTime(date.getTime() + seconds * 1000);
      const state0 = stateFromElements(el, seconds);
      const state = { ...state0, lla: eciToLla(state0.r, date) };
      if (!finiteState(state)) return error('Kepler propagation returned a non-finite state.', 422);
      return json({ valid: true, source: 'backend', propagator: 'KEPLER', epoch: date.toISOString(), name: 'MySat-1', ...state });
    } catch (cause) {
      return error(cause instanceof Error ? cause.message : 'Simulation core failed.', 500);
    }
  }],
});
