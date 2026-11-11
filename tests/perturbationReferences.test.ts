import { describe, expect, it } from 'vitest';
import { earthJ2Acceleration, thirdBodyDifferentialAcceleration } from '../src/engineering/perturbationReferences';

describe('independent perturbation acceleration references', () => {
  const earth = { muM3S2: 3.986004418e14, equatorialRadiusM: 6378137, j2: 1.08262668e-3 };

  it('returns the expected J2 symmetry on the equatorial plane', () => {
    const acceleration = earthJ2Acceleration([7000000, 0, 0], earth);
    expect(acceleration[0]).toBeLessThan(0);
    expect(acceleration[1]).toBeCloseTo(0);
    expect(acceleration[2]).toBeCloseTo(0);
  });

  it('returns finite non-zero out-of-plane J2 acceleration away from the equator', () => {
    const acceleration = earthJ2Acceleration([5000000, 0, 5000000], earth);
    expect(acceleration.every(Number.isFinite)).toBe(true);
    expect(acceleration[2]).not.toBe(0);
  });

  it('computes differential third-body acceleration and rejects singular geometry', () => {
    const result = thirdBodyDifferentialAcceleration(
      [7000000, 0, 0], [0, 384400000, 0], 4.9048695e12
    );
    expect(result.every(Number.isFinite)).toBe(true);
    expect(Math.hypot(...result)).toBeGreaterThan(0);
    expect(() => thirdBodyDifferentialAcceleration([0, 0, 0], [0, 0, 0], 1)).toThrow();
  });
});
