import { describe, expect, it } from 'vitest';
import {
  inertialToLvlh,
  propagateCw,
  solveRendezvousImpulse,
  solveTwoImpulseRendezvous,
  type RelativeState,
} from '../src/rpod';

const closeToVector = (actual: number[], expected: number[], digits = 8) => {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((value, index) => expect(value).toBeCloseTo(expected[index], digits));
};


const integrateCwRk4 = (initial: RelativeState, n: number, duration: number, step: number): RelativeState => {
  type State = [number, number, number, number, number, number];
  const derivative = (state: State): State => [
    state[3],
    state[4],
    state[5],
    3 * n * n * state[0] + 2 * n * state[4],
    -2 * n * state[3],
    -n * n * state[2],
  ];
  const add = (state: State, slope: State, factor: number): State =>
    state.map((value, index) => value + factor * slope[index]) as State;
  let state: State = [
    ...initial.positionKm,
    ...initial.velocityKmS,
  ];
  const steps = Math.ceil(duration / step);
  const dt = duration / steps;

  for (let index = 0; index < steps; index += 1) {
    const k1 = derivative(state);
    const k2 = derivative(add(state, k1, dt / 2));
    const k3 = derivative(add(state, k2, dt / 2));
    const k4 = derivative(add(state, k3, dt));
    state = state.map((value, component) =>
      value + (dt / 6) * (k1[component] + 2 * k2[component] + 2 * k3[component] + k4[component]),
    ) as State;
  }

  return {
    positionKm: [state[0], state[1], state[2]],
    velocityKmS: [state[3], state[4], state[5]],
  };
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
    closeToVector(result.velocityKmS, [-0.002 + 2 * Math.sqrt(398600.4418 / 7000 ** 3), 0.001 - Math.sqrt(398600.4418 / 7000 ** 3), 0.004]);
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


  it('cross-validates the closed-form HCW propagator against independent RK4 integration', () => {
    const initial: RelativeState = {
      positionKm: [0.1, -0.2, 0.05],
      velocityKmS: [0.0001, 0.0002, -0.00005],
    };
    const n = Math.sqrt(398600.4418 / 7000 ** 3);
    const analytical = propagateCw(initial, n, 900);
    const numerical = integrateCwRk4(initial, n, 900, 0.5);

    closeToVector(analytical.positionKm, numerical.positionKm, 9);
    closeToVector(analytical.velocityKmS, numerical.velocityKmS, 11);
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

  it('matches terminal relative velocity with a second ideal impulse at rendezvous', () => {
    const initial: RelativeState = {
      positionKm: [0.1, -0.2, 0.05],
      velocityKmS: [0.0001, 0.0002, -0.00005],
    };
    const n = Math.sqrt(398600.4418 / 7000 ** 3);
    const solution = solveTwoImpulseRendezvous(initial, n, 1800);

    closeToVector(solution.preArrivalBurnState.positionKm, [0, 0, 0], 7);
    expect(solution.arrivalDeltaVMagnitudeMps).toBeGreaterThanOrEqual(0);
    expect(solution.totalDeltaVMagnitudeMps).toBeCloseTo(
      solution.departureDeltaVMagnitudeMps + solution.arrivalDeltaVMagnitudeMps,
      10,
    );
    closeToVector(
      solution.preArrivalBurnState.velocityKmS.map((component, index) => component + solution.arrivalDeltaVKmS[index]),
      [0, 0, 0],
    );
    closeToVector(solution.postArrivalBurnState.velocityKmS, [0, 0, 0]);
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
