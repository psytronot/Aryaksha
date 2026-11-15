import { describe, expect, it } from 'vitest';
import {
  inertialToLvlh,
  propagateCw,
  solveRendezvousImpulse,
  type RelativeState,
} from '../src/rpod';

const closeToVector = (actual: number[], expected: number[], digits = 8) => {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((value, index) => expect(value).toBeCloseTo(expected[index], digits));
};

describe('RPOD relative-motion foundation', () => {
  it('converts inertial relative position and velocity into the target LVLH frame', () => {
    // Target is in a 7,000 km circular equatorial orbit at +X, moving +Y.
    const result = inertialToLvlh(
      [7000, 0, 0],
      [0, Math.sqrt(398600.4418 / 7000), 0],
      [7001, 2, 3],
      [-0.002, Math.sqrt(398600.4418 / 7000) + 0.001, 0.004],
    );

    closeToVector(result.positionKm, [1, 2, 3]);
    // LVLH angular velocity is n about +Z; subtract omega x rho.
    closeToVector(result.velocityKmS, [-0.002 - 2 * Math.sqrt(398600.4418 / 7000 ** 3), 0.001, 0.004]);
  });

  it('propagates a zero relative state as zero for any positive duration', () => {
    const zero: RelativeState = {
      positionKm: [0, 0, 0],
      velocityKmS: [0, 0, 0],
    };
    const result = propagateCw(zero, Math.sqrt(398600.4418 / 7000 ** 3), 1200);
    closeToVector(result.positionKm, [0, 0, 0]);
    closeToVector(result.velocityKmS, [0, 0, 0]);
  });

  it('matches the HCW closed-form solution for a radial initial displacement', () => {
    const n = 0.001078007;
    const result = propagateCw(
      { positionKm: [0.1, 0, 0], velocityKmS: [0, 0, 0] },
      n,
      600,
    );
    const nt = n * 600;
    closeToVector(result.positionKm, [
      (4 - 3 * Math.cos(nt)) * 0.1,
      6 * (Math.sin(nt) - nt) * 0.1,
      0,
    ]);
    closeToVector(result.velocityKmS, [
      3 * n * Math.sin(nt) * 0.1,
      -6 * n * (1 - Math.cos(nt)) * 0.1,
      0,
    ]);
  });

  it('computes an initial impulsive correction that reaches zero relative position at the target time', () => {
    const initial: RelativeState = {
      positionKm: [0.1, -0.2, 0.05],
      velocityKmS: [0.0001, 0.0002, -0.00005],
    };
    const n = Math.sqrt(398600.4418 / 7000 ** 3);
    const solution = solveRendezvousImpulse(initial, n, 1800);
    const terminal = propagateCw(
      { positionKm: initial.positionKm, velocityKmS: solution.postBurnVelocityKmS },
      n,
      1800,
    );

    closeToVector(terminal.positionKm, [0, 0, 0], 7);
    expect(solution.deltaVKmS).toHaveLength(3);
    expect(solution.deltaVMagnitudeMps).toBeGreaterThan(0);
    expect(solution.deltaVMagnitudeMps).toBeLessThan(100);
  });

  it('rejects non-physical mean motion and singular rendezvous times', () => {
    const initial: RelativeState = {
      positionKm: [0.1, 0, 0],
      velocityKmS: [0, 0, 0],
    };
    expect(() => propagateCw(initial, 0, 100)).toThrow();
    expect(() => propagateCw(initial, 0.001, -1)).toThrow();
    expect(() => solveRendezvousImpulse(initial, 0.001, 2 * Math.PI / 0.001)).toThrow();
  });
});
