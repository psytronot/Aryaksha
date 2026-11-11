export type EphemerisBody = 'EARTH' | 'MOON' | 'SUN';
export type EphemerisFrame = 'GCRF' | 'EME2000' | 'ICRF';
export type EphemerisTimeScale = 'TDB' | 'TT' | 'UTC';

export interface EphemerisState {
  body: EphemerisBody;
  epoch: string;
  timeScale: EphemerisTimeScale;
  frame: EphemerisFrame;
  positionM: readonly [number, number, number];
  velocityMps: readonly [number, number, number];
  source: 'JPL-DE' | 'OREKIT-JPL' | 'JPL-HORIZONS';
  kernelId: string | null;
  coverageStart: string;
  coverageEnd: string;
  positionUncertaintyM: number | null;
}

export interface EphemerisProvider {
  stateAt(body: EphemerisBody, epoch: string, frame: EphemerisFrame, timeScale: EphemerisTimeScale): Promise<EphemerisState>;
}

export class EphemerisUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EphemerisUnavailableError';
  }
}

/** Validate provenance and coverage before an ephemeris state can enter a scene or analysis. */
export function validateEphemerisState(
  state: EphemerisState,
  expected: { body: EphemerisBody; epoch: string; frame: EphemerisFrame; timeScale: EphemerisTimeScale }
): string[] {
  const issues: string[] = [];
  if (state.body !== expected.body) issues.push('Ephemeris body does not match the requested body.');
  if (Date.parse(state.epoch) !== Date.parse(expected.epoch)) issues.push('Ephemeris epoch does not match the requested epoch.');
  if (state.frame !== expected.frame) issues.push('Ephemeris frame does not match the requested frame.');
  if (state.timeScale !== expected.timeScale) issues.push('Ephemeris time scale does not match the requested time scale.');
  const parseEpoch = (value: string) => Date.parse(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value) ? value + 'Z' : value);
  const stateEpoch = parseEpoch(state.epoch);
  const requestedEpoch = parseEpoch(expected.epoch);
  const start = parseEpoch(state.coverageStart);
  const end = parseEpoch(state.coverageEnd);
  if (![stateEpoch, requestedEpoch, start, end].every(Number.isFinite) || requestedEpoch < start || requestedEpoch > end) {
    issues.push('Requested epoch is outside the declared ephemeris kernel coverage.');
  }
  if (state.kernelId !== null && !state.kernelId.trim()) issues.push('Ephemeris kernel identifier cannot be blank.');
  if (!['JPL-DE', 'OREKIT-JPL', 'JPL-HORIZONS'].includes(state.source)) issues.push('Ephemeris source is not an approved kernel source.');
  if (![...state.positionM, ...state.velocityMps].every(Number.isFinite)) {
    issues.push('Ephemeris state must be finite.');
  }
  if (state.positionUncertaintyM !== null && !Number.isFinite(state.positionUncertaintyM)) {
    issues.push('Ephemeris uncertainty must be finite or explicitly unknown.');
  }
  if (state.positionUncertaintyM !== null && state.positionUncertaintyM < 0) issues.push('Ephemeris uncertainty cannot be negative.');
  return issues;
}

/** Fail closed: never silently replace a missing precision ephemeris with a circular display approximation. */
export async function requireEphemerisState(
  provider: EphemerisProvider | null,
  body: EphemerisBody,
  epoch: string,
  frame: EphemerisFrame = 'GCRF',
  timeScale: EphemerisTimeScale = 'TDB'
): Promise<EphemerisState> {
  if (!provider) throw new EphemerisUnavailableError('No precision ephemeris provider is configured.');
  const state = await provider.stateAt(body, epoch, frame, timeScale);
  const issues = validateEphemerisState(state, { body, epoch, frame, timeScale });
  if (issues.length) throw new EphemerisUnavailableError(issues.join(' '));
  return state;
}
