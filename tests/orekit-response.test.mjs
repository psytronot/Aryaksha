import { describe, expect, it } from 'vitest';
import { normalizeOrekitResponse } from '../backend/orekitResponse.mjs';

const validPayload = () => ({
  valid: true,
  engine: 'Orekit',
  engineVersion: '13.1.9',
  fidelity: 'Orekit numerical propagation (two-body)',
  assumptions: ['Newtonian central gravity only'],
  orbit: {
    altitudeKm: 550,
    semiMajorAxisKm: 6928.137,
    eccentricity: 0.001,
    inclinationDeg: 97.6,
    periodSeconds: 5700,
    periodMinutes: 95,
    periapsisAltitudeKm: 543,
    apoapsisAltitudeKm: 557,
    circularVelocityKmS: 7.58,
    specificOrbitalEnergyKm2S2: -28.8,
    injectedSecret: 'must not be forwarded'
  },
  state: {
    elapsedSeconds: 0,
    epoch: '2026-11-15T00:00:00Z',
    timeScale: 'TAI',
    frame: 'EME2000',
    positionKm: [1, 2, 3],
    velocityKmS: [4, 5, 6],
    injectedOwnerId: 'must not be forwarded'
  },
  comparison: { engineAdapter: 'orekit-http', injectedMetadata: 'must not be forwarded' },
  injectedTopLevelSecret: 'must not be forwarded'
});

describe('Orekit upstream response normalization', () => {
  it('returns only allowlisted fields and strips upstream extras', () => {
    const normalized = normalizeOrekitResponse(validPayload());
    expect(normalized).not.toBeNull();
    expect(normalized).not.toHaveProperty('injectedTopLevelSecret');
    expect(normalized.orbit).not.toHaveProperty('injectedSecret');
    expect(normalized.state).not.toHaveProperty('injectedOwnerId');
    expect(normalized.comparison).not.toHaveProperty('injectedMetadata');
    expect(Object.keys(normalized.orbit)).toHaveLength(10);
    expect(Object.keys(normalized.state)).toEqual([
      'elapsedSeconds', 'epoch', 'timeScale', 'frame', 'positionKm', 'velocityKmS'
    ]);
  });

  it.each([
    ['non-object payload', null],
    ['wrong engine', { ...validPayload(), engine: 'unknown' }],
    ['invalid semantic version', { ...validPayload(), engineVersion: 'latest' }],
    ['non-finite orbit metric', { ...validPayload(), orbit: { ...validPayload().orbit, periodSeconds: Infinity } }],
    ['oversized assumptions list', { ...validPayload(), assumptions: Array(21).fill('assumption') }],
    ['invalid frame', { ...validPayload(), state: { ...validPayload().state, frame: 'TEME' } }],
    ['out-of-range elapsed time', { ...validPayload(), state: { ...validPayload().state, elapsedSeconds: 604801 } }],
    ['wrong vector dimensions', { ...validPayload(), state: { ...validPayload().state, positionKm: [1, 2] } }]
  ])('rejects %s', (_label, payload) => {
    expect(normalizeOrekitResponse(payload)).toBeNull();
  });
});
