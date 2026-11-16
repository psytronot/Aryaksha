/**
 * Independent two-body inertial propagation for RPOD history visualization.
 * Units: EME2000-like Cartesian position km, velocity km/s, mu km^3/s^2.
 * This is a Newtonian point-mass model, not the Orekit high-fidelity service.
 */
export type CartesianOrbitState = {
  positionKm: [number, number, number];
  velocityKmS: [number, number, number];
};

export type InertialTrajectorySample = {
  elapsedSeconds: number;
  state: CartesianOrbitState;
};

const DEFAULT_EARTH_MU_KM3_S2 = 398600.4418;
const MAX_INTEGRATION_STEP_SECONDS = 10;

type StateVector = [number, number, number, number, number, number];

const toVector = (state: CartesianOrbitState): StateVector => [
  ...state.positionKm,
  ...state.velocityKmS,
];

const fromVector = (state: StateVector): CartesianOrbitState => ({
  positionKm: [state[0], state[1], state[2]],
  velocityKmS: [state[3], state[4], state[5]],
});

const derivative = (state: StateVector, mu: number): StateVector => {
  const [x, y, z, vx, vy, vz] = state;
  const radiusSquared = x * x + y * y + z * z;
  const radius = Math.sqrt(radiusSquared);
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new Error('Cartesian position must have a finite non-zero magnitude.');
  }
  const accelerationScale = -mu / (radiusSquared * radius);
  return [vx, vy, vz, accelerationScale * x, accelerationScale * y, accelerationScale * z];
};

const addScaled = (state: StateVector, slope: StateVector, scale: number): StateVector =>
  state.map((value, index) => value + slope[index] * scale) as StateVector;

const rk4Step = (state: StateVector, step: number, mu: number): StateVector => {
  const k1 = derivative(state, mu);
  const k2 = derivative(addScaled(state, k1, step / 2), mu);
  const k3 = derivative(addScaled(state, k2, step / 2), mu);
  const k4 = derivative(addScaled(state, k3, step), mu);
  return state.map((value, index) =>
    value + step / 6 * (k1[index] + 2 * k2[index] + 2 * k3[index] + k4[index]),
  ) as StateVector;
};

const validate = (initial: CartesianOrbitState, durationSeconds: number, mu: number): void => {
  if (!initial || !Array.isArray(initial.positionKm) || !Array.isArray(initial.velocityKmS)
      || initial.positionKm.length !== 3 || initial.velocityKmS.length !== 3
      || [...initial.positionKm, ...initial.velocityKmS].some(value => !Number.isFinite(value))) {
    throw new Error('Cartesian state must contain three finite position and velocity components.');
  }
  if (Math.hypot(...initial.positionKm) <= 0) {
    throw new Error('Cartesian position must have a positive magnitude.');
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
    throw new Error('Propagation duration must be finite and non-negative.');
  }
  if (!Number.isFinite(mu) || mu <= 0) {
    throw new Error('Earth gravitational parameter must be positive and finite.');
  }
};

/** Propagate one inertial Cartesian state with fixed-step RK4 two-body gravity. */
export function propagateTwoBodyState(
  initial: CartesianOrbitState,
  elapsedSeconds: number,
  mu = DEFAULT_EARTH_MU_KM3_S2,
): CartesianOrbitState {
  validate(initial, elapsedSeconds, mu);
  if (elapsedSeconds === 0) return fromVector(toVector(initial));

  const stepCount = Math.ceil(elapsedSeconds / MAX_INTEGRATION_STEP_SECONDS);
  const step = elapsedSeconds / stepCount;
  let state = toVector(initial);
  for (let index = 0; index < stepCount; index += 1) {
    state = rk4Step(state, step, mu);
  }
  if (state.some(value => !Number.isFinite(value))) {
    throw new Error('Two-body propagation produced a non-finite state.');
  }
  return fromVector(state);
}

/**
 * Sample an inertial orbit history at uniform epochs, including t=0 and T.
 * Each sample is independently propagated from the supplied initial state to
 * avoid accumulated output-grid rounding drift.
 */
export function sampleTwoBodyTrajectory(
  initial: CartesianOrbitState,
  durationSeconds: number,
  intervalCount: number,
  mu = DEFAULT_EARTH_MU_KM3_S2,
): InertialTrajectorySample[] {
  validate(initial, durationSeconds, mu);
  if (!Number.isInteger(intervalCount) || intervalCount < 2) {
    throw new Error('Trajectory interval count must be an integer of at least two.');
  }
  return Array.from({ length: intervalCount + 1 }, (_, index) => {
    const elapsedSeconds = durationSeconds * index / intervalCount;
    return {
      elapsedSeconds,
      state: propagateTwoBodyState(initial, elapsedSeconds, mu),
    };
  });
}


export type LvlhImpulse = {
  /** Burn epoch relative to the common initial epoch, seconds. */
  elapsedSeconds: number;
  /** Instantaneous LVLH velocity increment [R, T, N], km/s. */
  deltaVKmS: [number, number, number];
};

export type AppliedInertialImpulse = LvlhImpulse & {
  /** Same impulse resolved into EME2000-like inertial axes at burn epoch. */
  deltaVInertialKmS: [number, number, number];
};

export type ManeuverAwareInertialState = {
  target: CartesianOrbitState;
  chaser: CartesianOrbitState;
  appliedImpulses: AppliedInertialImpulse[];
};

const vectorCross = (a: [number, number, number], b: [number, number, number]): [number, number, number] => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/**
 * Propagate two inertial spacecraft states and apply ordered impulsive burns
 * expressed in the target's instantaneous rotating LVLH frame.
 *
 * Each LVLH increment is resolved using the target radial/along-track/normal
 * basis at its actual burn epoch, then added to chaser inertial velocity.
 * Newtonian two-body RK4 only; this is not Orekit maneuver propagation.
 */
export function propagateTwoBodyWithLvlhImpulses(
  targetInitial: CartesianOrbitState,
  chaserInitial: CartesianOrbitState,
  durationSeconds: number,
  impulses: LvlhImpulse[],
  mu = DEFAULT_EARTH_MU_KM3_S2,
): ManeuverAwareInertialState {
  validate(targetInitial, durationSeconds, mu);
  validate(chaserInitial, durationSeconds, mu);
  if (!Array.isArray(impulses)) throw new Error('Maneuvers must be supplied as an ordered array.');
  let previousEpoch = -Infinity;
  impulses.forEach((impulse, index) => {
    if (!impulse || !Number.isFinite(impulse.elapsedSeconds)
        || impulse.elapsedSeconds < 0 || impulse.elapsedSeconds > durationSeconds) {
      throw new Error(`Maneuver ${index + 1} epoch must be within the propagation interval.`);
    }
    if (impulse.elapsedSeconds <= previousEpoch) {
      throw new Error('Maneuver epochs must be strictly increasing.');
    }
    if (!Array.isArray(impulse.deltaVKmS) || impulse.deltaVKmS.length !== 3
        || impulse.deltaVKmS.some(value => !Number.isFinite(value))) {
      throw new Error(`Maneuver ${index + 1} LVLH delta-v must contain three finite components.`);
    }
    previousEpoch = impulse.elapsedSeconds;
  });

  let target = fromVector(toVector(targetInitial));
  let chaser = fromVector(toVector(chaserInitial));
  let cursor = 0;
  const appliedImpulses: AppliedInertialImpulse[] = [];

  for (const impulse of impulses) {
    const segment = impulse.elapsedSeconds - cursor;
    target = propagateTwoBodyState(target, segment, mu);
    chaser = propagateTwoBodyState(chaser, segment, mu);

    const r = target.positionKm;
    const v = target.velocityKmS;
    const radius = Math.hypot(...r);
    const h = vectorCross(r, v);
    const hMagnitude = Math.hypot(...h);
    if (!Number.isFinite(radius) || radius <= 0 || !Number.isFinite(hMagnitude) || hMagnitude <= 1e-12) {
      throw new Error('Target state at maneuver epoch must define a non-degenerate LVLH frame.');
    }
    const radial = r.map(value => value / radius) as [number, number, number];
    const normal = h.map(value => value / hMagnitude) as [number, number, number];
    const alongTrack = vectorCross(normal, radial);
    const [dvr, dvt, dvn] = impulse.deltaVKmS;
    const inertialDeltaV: [number, number, number] = [0, 1, 2].map(axis =>
      dvr * radial[axis] + dvt * alongTrack[axis] + dvn * normal[axis],
    ) as [number, number, number];
    chaser = {
      positionKm: [...chaser.positionKm] as [number, number, number],
      velocityKmS: chaser.velocityKmS.map((value, axis) => value + inertialDeltaV[axis]) as [number, number, number],
    };
    appliedImpulses.push({ ...impulse, deltaVKmS: [...impulse.deltaVKmS], deltaVInertialKmS: inertialDeltaV });
    cursor = impulse.elapsedSeconds;
  }

  const remaining = durationSeconds - cursor;
  target = propagateTwoBodyState(target, remaining, mu);
  chaser = propagateTwoBodyState(chaser, remaining, mu);
  return { target, chaser, appliedImpulses };
}

/** Uniform paired target/chaser history, with every impulse applied at its exact epoch. */
export function sampleManeuverAwareTwoBodyTrajectory(
  targetInitial: CartesianOrbitState,
  chaserInitial: CartesianOrbitState,
  durationSeconds: number,
  intervalCount: number,
  impulses: LvlhImpulse[],
  mu = DEFAULT_EARTH_MU_KM3_S2,
): Array<ManeuverAwareInertialState & { elapsedSeconds: number }> {
  validate(targetInitial, durationSeconds, mu);
  validate(chaserInitial, durationSeconds, mu);
  if (!Number.isInteger(intervalCount) || intervalCount < 2) {
    throw new Error('Trajectory interval count must be an integer of at least two.');
  }
  return Array.from({ length: intervalCount + 1 }, (_, index) => {
    const elapsedSeconds = durationSeconds * index / intervalCount;
    const activeImpulses = impulses.filter(impulse => impulse.elapsedSeconds <= elapsedSeconds);
    return {
      elapsedSeconds,
      ...propagateTwoBodyWithLvlhImpulses(targetInitial, chaserInitial, elapsedSeconds, activeImpulses, mu),
    };
  });
}
