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
