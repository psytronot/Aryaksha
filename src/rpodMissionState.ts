export type RpodMissionCartesianState = {
  positionKm: [number, number, number];
  velocityKmS: [number, number, number];
};

export type RpodMissionState = {
  epochTai: string;
  frame: 'EME2000';
  target: RpodMissionCartesianState;
  chaser: RpodMissionCartesianState;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseVector = (value: unknown, label: string): [number, number, number] => {
  if (!Array.isArray(value) || value.length !== 3
      || !value.every(component => typeof component === 'number' && Number.isFinite(component))) {
    throw new Error(`${label} must contain exactly three finite numeric components.`);
  }
  return [value[0], value[1], value[2]];
};

const parseCartesianState = (value: unknown, label: string): RpodMissionCartesianState => {
  if (!isRecord(value) || Object.keys(value).some(key => !['positionKm', 'velocityKmS'].includes(key))) {
    throw new Error(`${label} must contain only positionKm and velocityKmS vectors.`);
  }
  const positionKm = parseVector(value.positionKm, `${label}.positionKm`);
  const velocityKmS = parseVector(value.velocityKmS, `${label}.velocityKmS`);
  const radiusKm = Math.hypot(...positionKm);
  if (radiusKm <= 6378.137) {
    throw new Error(`${label} initial position must be above Earth.`);
  }
  const [rx, ry, rz] = positionKm;
  const [vx, vy, vz] = velocityKmS;
  const hx = ry * vz - rz * vy;
  const hy = rz * vx - rx * vz;
  const hz = rx * vy - ry * vx;
  const angularMomentum = Math.hypot(hx, hy, hz);
  if (angularMomentum < 1e-6) {
    throw new Error(`${label} state must define a non-degenerate orbital plane.`);
  }
  const mu = 398600.4418;
  const evx = (vy * hz - vz * hy) / mu - rx / radiusKm;
  const evy = (vz * hx - vx * hz) / mu - ry / radiusKm;
  const evz = (vx * hy - vy * hx) / mu - rz / radiusKm;
  const eccentricity = Math.hypot(evx, evy, evz);
  const periapsisKm = angularMomentum ** 2 / mu / (1 + eccentricity);
  if (!Number.isFinite(periapsisKm) || periapsisKm <= 6378.137) {
    throw new Error(`${label} osculating periapsis intersects Earth.`);
  }
  return { positionKm, velocityKmS };
};

/**
 * Parse the intentionally narrow RPOD mission-import format.
 * Coordinates are EME2000 inertial Cartesian states in km and km/s,
 * referenced to the supplied ISO-8601 epoch interpreted as TAI.
 */
export function parseRpodMissionState(source: string): RpodMissionState {
  if (source.length > 64 * 1024) throw new Error('Mission-state file exceeds the 64 KiB limit.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error('Mission-state file must contain valid JSON.');
  }
  if (!isRecord(parsed)) throw new Error('Mission-state file must contain a JSON object.');
  const allowedKeys = ['epochTai', 'frame', 'target', 'chaser'];
  if (Object.keys(parsed).some(key => !allowedKeys.includes(key))) {
    throw new Error('Mission-state file contains an unexpected field.');
  }
  const epochBase = typeof parsed.epochTai === 'string' ? parsed.epochTai.slice(0, 19) : '';
  const parsedEpoch = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(String(parsed.epochTai))
    ? new Date(`${epochBase}Z`)
    : null;
  if (!parsedEpoch || !Number.isFinite(parsedEpoch.getTime())
      || parsedEpoch.toISOString().slice(0, 19) !== epochBase) {
    throw new Error('epochTai must be a valid ISO-8601 date-time interpreted in TAI.');
  }
  if (parsed.frame !== 'EME2000') {
    throw new Error('Only EME2000 mission states are currently supported; frame conversion is not implemented.');
  }
  const target = parseCartesianState(parsed.target, 'target');
  const chaser = parseCartesianState(parsed.chaser, 'chaser');
  const [rx, ry, rz] = target.positionKm;
  const [vx, vy, vz] = target.velocityKmS;
  const angularMomentum = Math.hypot(ry * vz - rz * vy, rz * vx - rx * vz, rx * vy - ry * vx);
  if (angularMomentum < 1e-6) {
    throw new Error('Target state must define a non-degenerate orbital plane.');
  }
  return {
    epochTai: parsed.epochTai,
    frame: 'EME2000',
    target,
    chaser,
  };
}
