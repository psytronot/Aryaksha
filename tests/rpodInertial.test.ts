import { describe, expect, it } from 'vitest';
import { propagateTwoBodyState, sampleTwoBodyTrajectory, type CartesianOrbitState } from '../src/rpodInertial';

const mu = 398600.4418;

describe('two-body inertial trajectory history', () => {
  const circular: CartesianOrbitState = {
    positionKm: [7000, 0, 0],
    velocityKmS: [0, Math.sqrt(mu / 7000), 0],
  };

  it('preserves a circular orbit radius and returns near the initial state after one period', () => {
    const period = 2 * Math.PI * Math.sqrt(7000 ** 3 / mu);
    const final = propagateTwoBodyState(circular, period, mu);
    expect(Math.hypot(...final.positionKm)).toBeCloseTo(7000, 3);
    expect(final.positionKm[0]).toBeCloseTo(7000, 2);
    expect(final.positionKm[1]).toBeCloseTo(0, 2);
    expect(final.velocityKmS[1]).toBeCloseTo(circular.velocityKmS[1], 5);
  });

  it('samples both spacecraft epochs uniformly and includes both endpoints', () => {
    const samples = sampleTwoBodyTrajectory(circular, 120, 12, mu);
    expect(samples).toHaveLength(13);
    expect(samples[0].elapsedSeconds).toBe(0);
    expect(samples[12].elapsedSeconds).toBe(120);
    expect(samples[6].elapsedSeconds).toBe(60);
    expect(Math.hypot(...samples[12].state.positionKm)).toBeCloseTo(7000, 5);
  });

  it('rejects invalid states, gravitational parameters and sampling intervals', () => {
    expect(() => propagateTwoBodyState({ positionKm: [0, 0, 0], velocityKmS: [0, 0, 0] }, 10, mu)).toThrow(/position/);
    expect(() => propagateTwoBodyState(circular, 10, 0)).toThrow(/gravitational parameter/);
    expect(() => sampleTwoBodyTrajectory(circular, 100, 1, mu)).toThrow(/at least two/);
  });
});
