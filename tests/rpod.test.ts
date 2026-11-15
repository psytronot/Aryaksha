import { describe, expect, it } from 'vitest';
import {
  inertialToLvlh,
  propagateCw,
  solveRendezvousImpulse,
  solveTwoImpulseRendezvous,
  sampleCwTrajectory,
  propagateCwWithImpulses,
  screenCwKeepOut,
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

  it('samples a CW trajectory from the initial epoch through the requested final epoch', () => {
    const initial: RelativeState = {
      positionKm: [0.1, -0.2, 0.05],
      velocityKmS: [0.0001, 0.0002, -0.00005],
    };
    const n = Math.sqrt(398600.4418 / 7000 ** 3);
    const samples = sampleCwTrajectory(initial, n, 900, 5);

    expect(samples).toHaveLength(6);
    expect(samples[0].elapsedSeconds).toBe(0);
    expect(samples[5].elapsedSeconds).toBe(900);
    closeToVector(samples[0].state.positionKm, initial.positionKm);
    closeToVector(samples[0].state.velocityKmS, initial.velocityKmS);
    const final = propagateCw(initial, n, 900);
    closeToVector(samples[5].state.positionKm, final.positionKm);
    closeToVector(samples[5].state.velocityKmS, final.velocityKmS);
  });

  it('rejects invalid trajectory sample counts', () => {
    const initial: RelativeState = {
      positionKm: [0.1, 0, 0],
      velocityKmS: [0, 0, 0],
    };
    const n = Math.sqrt(398600.4418 / 7000 ** 3);
    expect(() => sampleCwTrajectory(initial, n, 900, 1)).toThrow();
    expect(() => sampleCwTrajectory(initial, n, 900, 0)).toThrow();
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
  it('propagates a piecewise HCW coast with a timed impulsive maneuver', () => {
    const initial: RelativeState = {
      positionKm: [0.1, -0.2, 0.05],
      velocityKmS: [0.0001, 0.0002, -0.00005],
    };
    const n = Math.sqrt(398600.4418 / 7000 ** 3);
    const burnTime = 300;
    const duration = 900;
    const deltaV: [number, number, number] = [0.00001, -0.00002, 0.000005];
    const beforeBurn = propagateCw(initial, n, burnTime);
    const afterBurn = propagateCw({
      positionKm: beforeBurn.positionKm,
      velocityKmS: [
        beforeBurn.velocityKmS[0] + deltaV[0],
        beforeBurn.velocityKmS[1] + deltaV[1],
        beforeBurn.velocityKmS[2] + deltaV[2],
      ],
    }, n, duration - burnTime);
    const result = propagateCwWithImpulses(initial, n, duration, [
      { elapsedSeconds: burnTime, deltaVKmS: deltaV },
    ]);
    closeToVector(result.positionKm, afterBurn.positionKm, 11);
    closeToVector(result.velocityKmS, afterBurn.velocityKmS, 11);
  });

  it('leaves the unpowered trajectory unchanged when the impulse list is empty', () => {
    const initial: RelativeState = {
      positionKm: [0.1, -0.2, 0.05],
      velocityKmS: [0.0001, 0.0002, -0.00005],
    };
    const n = Math.sqrt(398600.4418 / 7000 ** 3);
    const result = propagateCwWithImpulses(initial, n, 900, []);
    const expected = propagateCw(initial, n, 900);
    closeToVector(result.positionKm, expected.positionKm, 12);
    closeToVector(result.velocityKmS, expected.velocityKmS, 12);
  });

  it('applies an impulse at the initial epoch before propagation', () => {
    const initial: RelativeState = {
      positionKm: [0.1, -0.2, 0.05],
      velocityKmS: [0, 0, 0],
    };
    const n = Math.sqrt(398600.4418 / 7000 ** 3);
    const deltaV: [number, number, number] = [0.0001, 0, 0];
    const result = propagateCwWithImpulses(initial, n, 600, [
      { elapsedSeconds: 0, deltaVKmS: deltaV },
    ]);
    const expected = propagateCw({ positionKm: initial.positionKm, velocityKmS: deltaV }, n, 600);
    closeToVector(result.positionKm, expected.positionKm, 12);
    closeToVector(result.velocityKmS, expected.velocityKmS, 12);
  });

  it('rejects unordered, out-of-window and malformed impulsive maneuvers', () => {
    const initial: RelativeState = {
      positionKm: [0.1, 0, 0],
      velocityKmS: [0, 0, 0],
    };
    const n = Math.sqrt(398600.4418 / 7000 ** 3);
    expect(() => propagateCwWithImpulses(initial, n, 900, [
      { elapsedSeconds: 500, deltaVKmS: [0, 0, 0] },
      { elapsedSeconds: 400, deltaVKmS: [0, 0, 0] },
    ])).toThrow(/ordered/);
    expect(() => propagateCwWithImpulses(initial, n, 900, [
      { elapsedSeconds: 901, deltaVKmS: [0, 0, 0] },
    ])).toThrow(/ordered/);
    expect(() => propagateCwWithImpulses(initial, n, 900, [
      { elapsedSeconds: 100, deltaVKmS: [0, Number.NaN, 0] },
    ])).toThrow(/finite/);
  });

  it('screens pre-terminal sampled trajectory against a spherical keep-out radius', () => {
    const trajectory = [
      { elapsedSeconds: 0, state: { positionKm: [1, 0, 0] as [number, number, number], velocityKmS: [0, 0, 0] as [number, number, number] } },
      { elapsedSeconds: 10, state: { positionKm: [0.02, 0, 0] as [number, number, number], velocityKmS: [0, 0, 0] as [number, number, number] } },
      // The terminal coincidence is intentionally excluded from pre-terminal screening.
      { elapsedSeconds: 20, state: { positionKm: [0, 0, 0] as [number, number, number], velocityKmS: [0, 0, 0] as [number, number, number] } },
    ];
    const result = screenCwKeepOut(trajectory, 0.05);
    expect(result.minimumPreTerminalRangeKm).toBeCloseTo(0.02);
    expect(result.closestElapsedSeconds).toBe(10);
    expect(result.enteredKeepOut).toBe(true);
    expect(() => screenCwKeepOut(trajectory, 0)).toThrow(/positive/);
    expect(() => screenCwKeepOut([], 0.05)).toThrow(/two trajectory/);
  });

});
