export type EphemerisBody = 'EARTH' | 'MOON' | 'SUN';
export type EphemerisFrame = 'GCRF' | 'EME2000';
export type EphemerisTimeScale = 'TDB' | 'TT' | 'UTC';

export interface EphemerisState {
  body: EphemerisBody;
  epoch: string;
  timeScale: EphemerisTimeScale;
  frame: EphemerisFrame;
  positionM: readonly [number, number, number];
  velocityMps: readonly [number, number, number];
  source: 'JPL-DE' | 'OREKIT-JPL';
  kernelId: string;
  coverageStart: string;
  coverageEnd: string;
  positionUncertaintyM: number;
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
  const epoch = Date.parse(state.epoch);
  const start = Date.parse(state.coverageStart);
  const end = Date.parse(state.coverageEnd);
  if (![epoch, start, end].every(Number.isFinite) || epoch < start || epoch > end) {
    issues.push('Requested epoch is outside the declared ephemeris kernel coverage.');
  }
  if (!state.kernelId.trim()) issues.push('Ephemeris kernel identifier is required.');
  if (!['JPL-DE', 'OREKIT-JPL'].includes(state.source)) issues.push('Ephemeris source is not an approved kernel source.');
  if (![...state.positionM, ...state.velocityMps, state.positionUncertaintyM].every(Number.isFinite)) {
    issues.push('Ephemeris state and uncertainty must be finite.');
  }
  if (state.positionUncertaintyM < 0) issues.push('Ephemeris uncertainty cannot be negative.');
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
