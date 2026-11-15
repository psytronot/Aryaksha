export const OREKIT_ORBIT_FIELDS = Object.freeze([
  'altitudeKm', 'semiMajorAxisKm', 'eccentricity', 'inclinationDeg',
  'periodSeconds', 'periodMinutes', 'periapsisAltitudeKm', 'apoapsisAltitudeKm',
  'circularVelocityKmS', 'specificOrbitalEnergyKm2S2'
]);
export const OREKIT_STATE_FIELDS = Object.freeze([
  'elapsedSeconds', 'epoch', 'timeScale', 'frame', 'positionKm', 'velocityKmS'
]);

const finiteFields = (object, fields) =>
  fields.every(field => typeof object?.[field] === 'number' && Number.isFinite(object[field]));

export function normalizeOrekitResponse(payload, maxPropagationSeconds = 604_800) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  if (payload.valid !== true || payload.engine !== 'Orekit') return null;
  if (typeof payload.engineVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(payload.engineVersion)) return null;
  if (payload.fidelity !== 'Orekit numerical propagation (two-body)') return null;
  if (!Array.isArray(payload.assumptions) || payload.assumptions.length === 0 ||
      payload.assumptions.length > 20 ||
      !payload.assumptions.every(item => typeof item === 'string' && item.length > 0 && item.length <= 500)) return null;
  if (!payload.orbit || typeof payload.orbit !== 'object' || Array.isArray(payload.orbit) ||
      !finiteFields(payload.orbit, OREKIT_ORBIT_FIELDS)) return null;
  const state = payload.state;
  if (!state || typeof state !== 'object' || Array.isArray(state) ||
      typeof state.elapsedSeconds !== 'number' || !Number.isFinite(state.elapsedSeconds) ||
      state.elapsedSeconds < 0 || state.elapsedSeconds > maxPropagationSeconds ||
      typeof state.epoch !== 'string' || state.epoch.length > 64 ||
      state.timeScale !== 'TAI' || state.frame !== 'EME2000' ||
      !Array.isArray(state.positionKm) || state.positionKm.length !== 3 || !state.positionKm.every(Number.isFinite) ||
      !Array.isArray(state.velocityKmS) || state.velocityKmS.length !== 3 || !state.velocityKmS.every(Number.isFinite)) return null;
  if (payload.comparison?.engineAdapter !== 'orekit-http') return null;

  return {
    valid: true,
    engine: 'Orekit',
    engineVersion: payload.engineVersion,
    fidelity: 'Orekit numerical propagation (two-body)',
    assumptions: [...payload.assumptions],
    orbit: Object.fromEntries(OREKIT_ORBIT_FIELDS.map(field => [field, payload.orbit[field]])),
    state: Object.fromEntries(OREKIT_STATE_FIELDS.map(field => [field, state[field]])),
    comparison: {
      engineAdapter: 'orekit-http',
      status: 'connected',
      note: 'Results returned by the independently hosted Orekit service.'
    }
  };
}
