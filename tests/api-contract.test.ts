import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import requestSchema from '../schemas/orbit-analysis-request.v1.schema.json';
import responseSchema from '../schemas/orbit-analysis-response.v1.schema.json';
import errorSchema from '../schemas/api-error.v1.schema.json';
import spacecraftSchema from '../schemas/spacecraft-configuration.v1.schema.json';

const ajv = new Ajv({ allErrors: true, strict: true });
const validateRequest = ajv.compile(requestSchema);
const validateResponse = ajv.compile(responseSchema);
const validateError = ajv.compile(errorSchema);
const validateSpacecraft = ajv.compile(spacecraftSchema);

const validRequest = {
  altitudeKm: 550,
  inclinationDeg: 97.6,
  eccentricity: 0.001
};

const validResponse = {
  valid: true,
  engine: 'Orekit',
  engineVersion: '13.1.9',
  fidelity: 'Orekit numerical propagation (two-body)',
  assumptions: [
    'Orekit 13.1.9; Apache-2.0; Java 21',
    'Frame: EME2000; epoch: J2000; Earth gravity parameter: WGS-84',
    'Only Newtonian central gravity is configured; no J2, atmospheric drag, solar radiation pressure or third-body forces'
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
    [{ altitudeKm: 550, inclinationDeg: 45, eccentricity: 0.001, surprise: true }],
    [{ altitudeKm: 550, inclinationDeg: 45, eccentricity: 0.001, elapsedSeconds: 604800.01 }],
    [{ altitudeKm: 550, inclinationDeg: 45, eccentricity: 0.001, elapsedSeconds: -1 }]
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


describe('Spacecraft configuration v1 JSON Schema', () => {
  const referenceConfiguration = {
    schemaVersion: '1.0.0',
    configurationId: 'ARY-SC-001',
    name: 'Reference 6U spacecraft',
    revision: 'A',
    units: { length: 'm', mass: 'kg', angle: 'deg' },
    referenceFrame: '+X forward, +Y starboard, +Z nadir',
    geometry: { bus: { width: 0.226, height: 0.366, depth: 0.1 }, modelFormat: 'unknown' },
    massProperties: { dryMassKg: 8.5 },
    components: [
      { componentId: 'BUS-01', type: 'bus', name: 'Primary structure', massKg: 4.2, positionM: [0, 0, 0], inertiaKgM2: [[0.08, 0, 0], [0, 0.09, 0], [0, 0, 0.1]] },
      { componentId: 'PWR-01', type: 'solar-array', name: 'Deployable array', massKg: 1.1, powerW: 40 }
    ],
    provenance: { author: 'Aryaksha engineering', notes: 'Illustrative schema fixture; not flight hardware data.' }
  };

  it('accepts a fully unit-tagged spacecraft configuration with explicit body frame', () => {
    expect(validateSpacecraft(referenceConfiguration)).toBe(true);
  });

  it('accepts component inertia tensors and rejects malformed component tensor shapes', () => {
    const invalidTensor = {
      ...referenceConfiguration,
      components: [{ ...referenceConfiguration.components[0], inertiaKgM2: [[1, 0], [0, 1]] }]
    };
    expect(validateSpacecraft(invalidTensor)).toBe(false);
  });

  it('rejects missing unit declarations, dimensions and dry mass', () => {
    expect(validateSpacecraft({ ...referenceConfiguration, units: undefined })).toBe(false);
    expect(validateSpacecraft({ ...referenceConfiguration, geometry: { bus: { width: 0, height: 1, depth: 1 } } })).toBe(false);
    expect(validateSpacecraft({ ...referenceConfiguration, massProperties: {} })).toBe(false);
  });
});
