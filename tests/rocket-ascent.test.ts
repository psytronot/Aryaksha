import { describe, expect, it } from 'vitest';
import {
  calculateRocketAscent,
  STANDARD_GRAVITY_M_S2,
  type RocketAscentInputs
} from '../src/aerospace/rocketAscent';

const reference: RocketAscentInputs = {
  initialMassKg: 30000,
  dryMassKg: 5000,
  thrustN: 650000,
  specificImpulseS: 285,
  referenceAreaM2: 10,
  dragCoefficient: 0.35,
  pitchStartTimeS: 10,
  pitchEndTimeS: 90,
  pitchStartAngleDeg: 90,
  pitchEndAngleDeg: 5,
  timeStepS: 0.5,
  maxFlightTimeS: 600
};

describe('2D rocket ascent trajectory model', () => {
  it('uses standard gravity for propellant mass flow', () => {
    expect(STANDARD_GRAVITY_M_S2).toBeCloseTo(9.80665, 8);
  });

  it('returns a time-ordered trajectory with explicit SI-unit state values', () => {
    const result = calculateRocketAscent(reference);
    expect(result.samples.length).toBeGreaterThan(2);
    expect(result.samples[0].timeS).toBe(0);
    expect(result.samples.at(-1)!.timeS).toBeGreaterThan(0);
    expect(result.samples.every((sample, index, all) =>
      index === 0 || sample.timeS > all[index - 1].timeS
    )).toBe(true);
    expect(result.samples.every(sample =>
      Number.isFinite(sample.altitudeM) &&
      Number.isFinite(sample.downrangeM) &&
      Number.isFinite(sample.speedMps) &&
      Number.isFinite(sample.dynamicPressurePa)
    )).toBe(true);
  });

  it('conserves the commanded mass-flow rate until dry mass and then coasts', () => {
    const result = calculateRocketAscent(reference);
    expect(result.burnoutTimeS).toBeCloseTo(
      (reference.initialMassKg - reference.dryMassKg) *
      reference.specificImpulseS * STANDARD_GRAVITY_M_S2 / reference.thrustN,
      8
    );
    const burnout = result.samples.find(sample => sample.phase === 'coast');
    expect(burnout).toBeDefined();
    expect(burnout!.massKg).toBeCloseTo(reference.dryMassKg, 6);
    expect(result.samples.every(sample => sample.massKg >= reference.dryMassKg - 1e-7)).toBe(true);
  });

  it('reports maximum dynamic pressure from the sampled trajectory', () => {
    const result = calculateRocketAscent(reference);
    expect(result.maxDynamicPressurePa).toBeCloseTo(
      Math.max(...result.samples.map(sample => sample.dynamicPressurePa)), 6
    );
    expect(result.maxDynamicPressurePa).toBeGreaterThan(0);
    expect(result.maxDynamicPressureTimeS).toBeGreaterThanOrEqual(0);
  });

  it('increases burnout speed when specific impulse increases', () => {
    const baseline = calculateRocketAscent(reference);
    const improved = calculateRocketAscent({ ...reference, specificImpulseS: 310 });
    expect(baseline.burnoutSpeedMps).not.toBeNull();
    expect(improved.burnoutSpeedMps).not.toBeNull();
    expect(improved.burnoutSpeedMps!).toBeGreaterThan(baseline.burnoutSpeedMps!);
  });


  it('matches an independently integrated reference trajectory', () => {
    const result = calculateRocketAscent(reference);
    expect(result.burnoutTimeS).toBeCloseTo(107.49597115, 6);
    expect(result.burnoutSpeedMps).toBeCloseTo(3463.86223, 2);
    expect(result.maxAltitudeM).toBeCloseTo(82831.639, 0);
    expect(result.maxDynamicPressurePa).toBeCloseTo(99207.17, 0);
  });

  it('converges in maximum altitude when the integration step is halved', () => {
    const coarse = calculateRocketAscent({ ...reference, timeStepS: 0.5 });
    const fine = calculateRocketAscent({ ...reference, timeStepS: 0.25 });
    expect(Math.abs(coarse.maxAltitudeM - fine.maxAltitudeM)).toBeLessThan(1);
  });

  it('rejects non-physical mass, propulsion, aerodynamic and integration inputs', () => {
    expect(() => calculateRocketAscent({ ...reference, dryMassKg: reference.initialMassKg }))
      .toThrow(/dry mass/);
    expect(() => calculateRocketAscent({ ...reference, thrustN: 0 }))
      .toThrow(/thrust/);
    expect(() => calculateRocketAscent({ ...reference, referenceAreaM2: -1 }))
      .toThrow(/reference area/);
    expect(() => calculateRocketAscent({ ...reference, timeStepS: 0 }))
      .toThrow(/time step/);
    expect(() => calculateRocketAscent({ ...reference, pitchEndTimeS: reference.pitchStartTimeS }))
      .toThrow(/pitch schedule/);
  });

  it('rejects non-finite values', () => {
    expect(() => calculateRocketAscent({ ...reference, specificImpulseS: Number.NaN }))
      .toThrow(/finite numbers/);
  });
});
