import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import requestSchema from '../schemas/orbit-analysis-request.v1.schema.json';
import responseSchema from '../schemas/orbit-analysis-response.v1.schema.json';
import errorSchema from '../schemas/api-error.v1.schema.json';

const ajv = new Ajv({ allErrors: true, strict: true });
const validateRequest = ajv.compile(requestSchema);
const validateResponse = ajv.compile(responseSchema);
const validateError = ajv.compile(errorSchema);

const validRequest = {
  altitudeKm: 550,
  inclinationDeg: 97.6,
  eccentricity: 0.001
};

const validResponse = {
  valid: true,
  engine: 'Orekit',
  engineVersion: '13.1.9',
  fidelity: 'Orekit Keplerian propagation (two-body)',
  assumptions: [
    'Orekit 13.1.9; Apache-2.0; Java 21',
    'Frame: EME2000; epoch: J2000; Earth gravity parameter: WGS-84',
    'No J2, atmospheric drag, solar radiation pressure or third-body forces configured'
  ],
  orbit: {
    altitudeKm: 550,
    semiMajorAxisKm: 6928.137,
    eccentricity: 0.001,
    inclinationDeg: 97.6,
    periodSeconds: 5738.992815,
    periodMinutes: 95.64988025,
    periapsisAltitudeKm: 543.071863,
    apoapsisAltitudeKm: 556.928137,
    circularVelocityKmS: 7.5850885,
    specificOrbitalEnergyKm2S2: -28.766784
  },
  state: {
    elapsedSeconds: 0,
    epoch: '2000-01-01T11:59:27.816',
    timeScale: 'TAI',
    frame: 'EME2000',
    positionKm: [6921.208863, 0, 0],
    velocityKmS: [0, -1.0, 7.5]
  },
  comparison: {
    engineAdapter: 'orekit-http',
    status: 'connected',
    note: 'Results returned by the independently hosted Orekit service.'
  }
};

describe('Orbit analysis API v1 JSON Schemas', () => {
  it('accepts the documented reference request', () => {
    expect(validateRequest(validRequest)).toBe(true);
  });

  it.each([
    [{ altitudeKm: 119.99, inclinationDeg: 45, eccentricity: 0.001 }],
    [{ altitudeKm: 550, inclinationDeg: 180.01, eccentricity: 0.001 }],
    [{ altitudeKm: 550, inclinationDeg: 45, eccentricity: 1 }],
    [{ altitudeKm: 550, inclinationDeg: 45, eccentricity: 0.001, surprise: true }]
  ])('rejects invalid or out-of-contract requests', request => {
    expect(validateRequest(request)).toBe(false);
  });

  it('accepts a representative Orekit response with explicit frame, time scale and units', () => {
    expect(validateResponse(validResponse)).toBe(true);
  });

  it('rejects responses that omit the time scale or have malformed state vectors', () => {
    const missingTimeScale = {
      ...validResponse,
      state: { ...validResponse.state, timeScale: undefined }
    };
    const shortPosition = {
      ...validResponse,
      state: { ...validResponse.state, positionKm: [6921, 0] }
    };
    expect(validateResponse(missingTimeScale)).toBe(false);
    expect(validateResponse(shortPosition)).toBe(false);
  });

  it('accepts the standard error envelope', () => {
    expect(validateError({ error: 'The selected orbit intersects Earth at periapsis.' })).toBe(true);
    expect(validateError({ error: '' })).toBe(false);
  });
});
