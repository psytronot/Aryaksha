import { describe, expect, it } from 'vitest';
import {
  calculateStagingPoint,
  optimiseRocketStaging,
  STANDARD_GRAVITY_M_S2,
  type RocketStagingInputs
} from '../src/aerospace/rocketStaging';

const reference: RocketStagingInputs = {
  totalInitialMassKg: 100000,
  payloadMassKg: 5000,
  stage1SpecificImpulseS: 280,
  stage2SpecificImpulseS: 340,
  stage1StructuralFraction: 0.08,
  stage2StructuralFraction: 0.10
};

describe('two-stage rocket staging model', () => {
  it('uses standard gravity in the ideal rocket equation', () => {
    expect(STANDARD_GRAVITY_M_S2).toBeCloseTo(9.80665, 8);
  });

  it('conserves the fixed initial mass across the stage and payload mass budget', () => {
    const point = calculateStagingPoint(reference, 0.55);
    const total = point.stage1PropellantKg + point.stage2PropellantKg +
      point.stage1DryMassKg + point.stage2DryMassKg + reference.payloadMassKg;
    expect(total).toBeCloseTo(reference.totalInitialMassKg, 7);
  });

  it('evaluates exactly 91 candidate splits from 5% through 95%', () => {
    const result = optimiseRocketStaging(reference);
    expect(result.points).toHaveLength(91);
    expect(result.points[0].stage1PropellantFraction).toBeCloseTo(0.05, 10);
    expect(result.points[90].stage1PropellantFraction).toBeCloseTo(0.95, 10);
  });

  it('selects the highest total ideal delta-v among evaluated candidates', () => {
    const result = optimiseRocketStaging(reference);
    expect(result.optimum.totalDeltaVMs).toBe(
      Math.max(...result.points.map(point => point.totalDeltaVMs))
    );
  });

  it('rejects a payload that is not lighter than the launch vehicle', () => {
    expect(() => optimiseRocketStaging({ ...reference, payloadMassKg: 100000 }))
      .toThrow(/Payload mass/);
  });

  it('rejects structural fractions outside the model domain', () => {
    expect(() => optimiseRocketStaging({ ...reference, stage1StructuralFraction: 0.5 }))
      .toThrow(/structural fraction/);
  });

  it('rejects non-finite inputs', () => {
    expect(() => optimiseRocketStaging({ ...reference, stage2SpecificImpulseS: Number.NaN }))
      .toThrow(/finite numbers/);
  });

  it('matches the independently checked reference-case optimum', () => {
    const result = optimiseRocketStaging(reference);
    expect(result.optimum.stage1PropellantFraction).toBeCloseTo(0.77, 10);
    expect(result.optimum.totalDeltaVMs).toBeCloseTo(7464.67299, 3);
  });

  it('increases ideal delta-v when a stage specific impulse is increased at a fixed split', () => {
    const baseline = calculateStagingPoint(reference, 0.55);
    const improved = calculateStagingPoint({ ...reference, stage2SpecificImpulseS: 360 }, 0.55);
    expect(improved.totalDeltaVMs).toBeGreaterThan(baseline.totalDeltaVMs);
  });

});