import { describe, expect, it } from 'vitest';
import { EphemerisUnavailableError, requireEphemerisState, validateEphemerisState, type EphemerisState } from '../src/engineering/ephemeris';

const state: EphemerisState = {
  body: 'MOON', epoch: '2026-11-11T00:00:00.000Z', timeScale: 'TDB', frame: 'GCRF',
  positionM: [384400000, 0, 0], velocityMps: [0, 0, 0],
  source: 'JPL-DE', kernelId: 'DE440', coverageStart: '2020-01-01T00:00:00.000Z',
  coverageEnd: '2030-01-01T00:00:00.000Z', positionUncertaintyM: 1000
};

describe('precision ephemeris boundary', () => {
  it('accepts only a provenance-complete state inside kernel coverage', () => {
    expect(validateEphemerisState(state, {
      body: 'MOON', epoch: state.epoch, frame: 'GCRF', timeScale: 'TDB'
    })).toEqual([]);
  });

  it('rejects mismatched frames, epochs and out-of-coverage requests', () => {
    expect(validateEphemerisState(state, {
      body: 'MOON', epoch: '2040-01-01T00:00:00.000Z', frame: 'EME2000', timeScale: 'UTC'
    })).toEqual(expect.arrayContaining([
      'Ephemeris epoch does not match the requested epoch.',
      'Ephemeris frame does not match the requested frame.',
      'Ephemeris time scale does not match the requested time scale.',
      'Requested epoch is outside the declared ephemeris kernel coverage.'
    ]));
  });

  it('fails closed when no provider is configured', async () => {
    await expect(requireEphemerisState(null, 'MOON', state.epoch)).rejects.toBeInstanceOf(EphemerisUnavailableError);
  });
});
