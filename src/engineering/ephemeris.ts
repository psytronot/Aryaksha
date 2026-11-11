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

/** Parse explicit ISO timestamps without silently assigning a timezone to date-only or local-time strings. */
function parseEphemerisTimestamp(value: string): number {
  if (typeof value !== 'string' || !value.trim()) return Number.NaN;
  // Ephemeris epochs must carry an explicit UTC designator or numeric offset.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return Number.NaN;
  }
  return Date.parse(value);
}

/** Validate provenance and coverage before an ephemeris state can enter a scene or analysis. */
export function validateEphemerisState(
  state: EphemerisState,
  expected: { body: EphemerisBody; epoch: string; frame: EphemerisFrame; timeScale: EphemerisTimeScale }
): string[] {
  const issues: string[] = [];
  const stateEpoch = parseEphemerisTimestamp(state.epoch);
  const requestedEpoch = parseEphemerisTimestamp(expected.epoch);
  const start = parseEphemerisTimestamp(state.coverageStart);
  const end = parseEphemerisTimestamp(state.coverageEnd);
  const timestampsValid = [stateEpoch, requestedEpoch, start, end].every(Number.isFinite);

  if (!timestampsValid) {
    issues.push('Ephemeris epoch and coverage dates must be valid timestamps.');
  } else {
    if (stateEpoch !== requestedEpoch) issues.push('Ephemeris epoch does not match the requested epoch.');
    if (start > end) {
      issues.push('Ephemeris coverage interval is invalid.');
    } else {
      if (requestedEpoch < start || requestedEpoch > end) {
        issues.push('Requested epoch is outside the declared ephemeris kernel coverage.');
      }
      if (stateEpoch < start || stateEpoch > end) {
        issues.push('Ephemeris state epoch is outside the declared coverage.');
      }
    }
  }

  if (state.body !== expected.body) issues.push('Ephemeris body does not match the requested body.');
  if (state.frame !== expected.frame) issues.push('Ephemeris frame does not match the requested frame.');
  if (state.timeScale !== expected.timeScale) issues.push('Ephemeris time scale does not match the requested time scale.');
  if (state.kernelId === null) {
    if (state.source !== 'JPL-HORIZONS') issues.push('A kernel identifier is required for this ephemeris provider.');
  } else if (typeof state.kernelId !== 'string' || !state.kernelId.trim()) {
    issues.push('Ephemeris kernel identifier cannot be blank.');
  }
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
