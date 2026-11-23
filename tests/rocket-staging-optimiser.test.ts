import { describe, expect, it } from 'vitest';
import { optimiseMaximumDeltaV, optimiseMinimumPropellantForDeltaV } from '../src/aerospace/rocketStagingOptimiser';
import type { RocketVehicleConfiguration } from '../src/aerospace/rocketStagingModel';

const baseline: RocketVehicleConfiguration = {
  payloadMassKg: 500,
  stages: [
    { name: 'Stage 1', propellantMassKg: 4000, specificImpulseS: 280, structuralFraction: 0.08 },
    { name: 'Stage 2', propellantMassKg: 1200, specificImpulseS: 340, structuralFraction: 0.1 }
  ]
};

describe('bounded rocket staging optimiser', () => {
  it('returns deterministic feasible allocations for two, three and four stages', () => {
    for (const count of [2, 3, 4]) {
      const configuration = {
        payloadMassKg: baseline.payloadMassKg,
        stages: Array.from({ length: count }, (_, index) => ({
          name: `Stage ${index + 1}`,
          propellantMassKg: 4000 / (index + 1),
          specificImpulseS: 270 + index * 20,
          structuralFraction: 0.07 + index * 0.01
        }))
      };
      const first = optimiseMaximumDeltaV(configuration, { initialGridDivisions: 8, maxEvaluations: 5000 });
      const second = optimiseMaximumDeltaV(configuration, { initialGridDivisions: 8, maxEvaluations: 5000 });
      expect(first.stagePropellantShares).toEqual(second.stagePropellantShares);
      expect(first.vehicle.totalDeltaVMs).toBeCloseTo(second.vehicle.totalDeltaVMs, 10);
      expect(first.feasible).toBe(true);
      expect(first.stagePropellantShares.reduce((sum, share) => sum + share, 0)).toBeCloseTo(1, 10);
      expect(first.stagePropellantShares.every(share => share >= 0.001)).toBe(true);
      expect(first.vehicle.massClosureErrorKg).toBeCloseTo(0, 8);
      expect(first.evaluations).toBeLessThanOrEqual(5000);
    }
  });

  it('returns the best result from the bounded maximum delta-v search', () => {
    const result = optimiseMaximumDeltaV(baseline, { initialGridDivisions: 10, maxEvaluations: 5000 });
    expect(result.objective).toBe('maximum-delta-v');
    expect(result.objectiveValue).toBeCloseTo(result.vehicle.totalDeltaVMs, 8);
    expect(result.vehicle.initialMassKg).toBeCloseTo(
      baseline.payloadMassKg + baseline.stages.reduce((sum, stage) =>
        sum + stage.propellantMassKg / (1 - stage.structuralFraction), 0), 8);
  });

  it('finds a target delta-v solution under the maximum initial mass ceiling', () => {
    const reference = optimiseMaximumDeltaV(baseline, { initialGridDivisions: 8, maxEvaluations: 5000 });
    const ceiling = reference.vehicle.initialMassKg * 1.25;
    const result = optimiseMinimumPropellantForDeltaV(
      baseline, reference.vehicle.totalDeltaVMs * 0.75, ceiling,
      { initialGridDivisions: 8, maxEvaluations: 10000 }
    );
    expect(result.objective).toBe('minimum-propellant');
    expect(result.feasible).toBe(true);
    expect(result.vehicle.totalDeltaVMs).toBeGreaterThanOrEqual(reference.vehicle.totalDeltaVMs * 0.75 - 1e-5);
    expect(result.vehicle.initialMassKg).toBeLessThanOrEqual(ceiling + 1e-5);
    expect(result.objectiveValue).toBeCloseTo(result.vehicle.totalPropellantMassKg, 8);
  });

  it('rejects invalid target, ceiling and solver options', () => {
    expect(() => optimiseMinimumPropellantForDeltaV(baseline, 0, 10000)).toThrow(/Target delta-v/);
    expect(() => optimiseMinimumPropellantForDeltaV(baseline, 1000, 500)).toThrow(/Maximum initial wet mass/);
    expect(() => optimiseMaximumDeltaV(baseline, { maxEvaluations: 0 })).toThrow(/Solver options/);
  });
});
