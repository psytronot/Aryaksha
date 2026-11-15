/**
 * Relative-orbit dynamics for preliminary RPOD design.
 *
 * Units: inertial position km, inertial velocity km/s, mean motion rad/s,
 * elapsed time s. The CW model assumes a circular chief orbit and small
 * relative separation. It is not a high-fidelity proximity-operations model.
 */

export type Vector3 = [number, number, number];

export type RelativeState = {
  /** Chaser position relative to target, expressed in target LVLH, km. */
  positionKm: Vector3;
  /** Chaser velocity relative to target, expressed in rotating target LVLH, km/s. */
  velocityKmS: Vector3;
};

export type RendezvousImpulseSolution = {
  /** Single instantaneous velocity change applied at the initial epoch, km/s. */
  deltaVKmS: Vector3;
  /** Chaser LVLH velocity immediately after the initial impulse, km/s. */
  postBurnVelocityKmS: Vector3;
  /** Magnitude of the initial impulse, m/s. */
  deltaVMagnitudeMps: number;
  /** Requested time at which relative position is zero, s. */
  rendezvousTimeSeconds: number;
};

const dot = (a: Vector3, b: Vector3): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const cross = (a: Vector3, b: Vector3): Vector3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const magnitude = (v: Vector3): number => Math.hypot(v[0], v[1], v[2]);

const scale = (v: Vector3, factor: number): Vector3 => [
  v[0] * factor,
  v[1] * factor,
  v[2] * factor,
];

const subtract = (a: Vector3, b: Vector3): Vector3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];

function validateVector(name: string, value: number[]): asserts value is Vector3 {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    value.some(component => !Number.isFinite(component))
  ) {
    throw new Error(`${name} must contain exactly three finite components.`);
  }
}

const validateState = (state: RelativeState): void => {
  if (!state || typeof state !== 'object') {
    throw new Error('A relative state is required.');
  }
  validateVector('positionKm', state.positionKm);
  validateVector('velocityKmS', state.velocityKmS);
};

const validateMeanMotionAndTime = (meanMotionRadS: number, elapsedSeconds: number): void => {
  if (!Number.isFinite(meanMotionRadS) || meanMotionRadS <= 0) {
    throw new Error('Mean motion must be a positive finite value in rad/s.');
  }
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
    throw new Error('Elapsed time must be a finite non-negative value in seconds.');
  }
};

/**
 * Convert chaser inertial state to the target's instantaneous rotating LVLH frame.
 * LVLH axes: +R radial outward, +T along-track, +N orbit-normal.
 * Relative velocity includes the rotating-frame transport correction.
 */
export function inertialToLvlh(
  targetPositionKm: number[],
  targetVelocityKmS: number[],
  chaserPositionKm: number[],
  chaserVelocityKmS: number[],
): RelativeState {
  validateVector('targetPositionKm', targetPositionKm);
  validateVector('targetVelocityKmS', targetVelocityKmS);
  validateVector('chaserPositionKm', chaserPositionKm);
  validateVector('chaserVelocityKmS', chaserVelocityKmS);

  const targetR = targetPositionKm;
  const targetV = targetVelocityKmS;
  const radiusKm = magnitude(targetR);
  if (radiusKm <= 0) throw new Error('Target position must have non-zero magnitude.');

  const angularMomentum = cross(targetR, targetV);
  const angularMomentumMagnitude = magnitude(angularMomentum);
  if (angularMomentumMagnitude <= 1e-12) {
    throw new Error('Target position and velocity must define a non-degenerate orbital plane.');
  }

  const radial: Vector3 = scale(targetR, 1 / radiusKm);
  const normal: Vector3 = scale(angularMomentum, 1 / angularMomentumMagnitude);
  const alongTrack: Vector3 = cross(normal, radial);
  const deltaPosition = subtract(chaserPositionKm, targetPositionKm);
  const deltaVelocity = subtract(chaserVelocityKmS, targetVelocityKmS);
  const angularVelocity = scale(normal, angularMomentumMagnitude / (radiusKm * radiusKm));
  const rotatingFrameVelocity = subtract(deltaVelocity, cross(angularVelocity, deltaPosition));

  return {
    positionKm: [
      dot(deltaPosition, radial),
      dot(deltaPosition, alongTrack),
      dot(deltaPosition, normal),
    ],
    velocityKmS: [
      dot(rotatingFrameVelocity, radial),
      dot(rotatingFrameVelocity, alongTrack),
      dot(rotatingFrameVelocity, normal),
    ],
  };
}

/**
 * Propagate a relative state with the Clohessy-Wiltshire / Hill equations.
 * Assumes a circular reference orbit, constant mean motion and small separation.
 */
export function propagateCw(
  initial: RelativeState,
  meanMotionRadS: number,
  elapsedSeconds: number,
): RelativeState {
  validateState(initial);
  validateMeanMotionAndTime(meanMotionRadS, elapsedSeconds);

  const [x0, y0, z0] = initial.positionKm;
  const [vx0, vy0, vz0] = initial.velocityKmS;
  const n = meanMotionRadS;
  const nt = n * elapsedSeconds;
  const c = Math.cos(nt);
  const s = Math.sin(nt);

  return {
    positionKm: [
      (4 - 3 * c) * x0 + (s / n) * vx0 + (2 * (1 - c) / n) * vy0,
      6 * (s - nt) * x0 + y0 - (2 * (1 - c) / n) * vx0 + ((4 * s - 3 * nt) / n) * vy0,
      c * z0 + (s / n) * vz0,
    ],
    velocityKmS: [
      3 * n * s * x0 + c * vx0 + 2 * s * vy0,
      -6 * n * (1 - c) * x0 - 2 * s * vx0 + (4 * c - 3) * vy0,
      -n * s * z0 + c * vz0,
    ],
  };
};

/** Solve a 3x3 linear system with partial pivoting. */
const solve3x3 = (matrix: number[][], rhs: number[]): Vector3 => {
  const augmented = matrix.map((row, index) => [...row, rhs[index]]);
  const scaleFactor = Math.max(...matrix.flat().map(Math.abs), 1);

  for (let column = 0; column < 3; column += 1) {
    let pivotRow = column;
    for (let row = column + 1; row < 3; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivotRow][column])) {
        pivotRow = row;
      }
    }

    if (Math.abs(augmented[pivotRow][column]) <= 1e-12 * scaleFactor) {
      throw new Error('Rendezvous time produces a singular or ill-conditioned transfer matrix.');
    }

    [augmented[column], augmented[pivotRow]] = [augmented[pivotRow], augmented[column]];
    const pivot = augmented[column][column];
    for (let entry = column; entry < 4; entry += 1) {
      augmented[column][entry] /= pivot;
    }

    for (let row = 0; row < 3; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let entry = column; entry < 4; entry += 1) {
        augmented[row][entry] -= factor * augmented[column][entry];
      }
    }
  }

  return [augmented[0][3], augmented[1][3], augmented[2][3]];
};

/**
 * Compute one initial impulsive velocity correction that makes the HCW
 * relative position zero at the requested terminal time.
 *
 * This is a single-burn position rendezvous solution. It does NOT constrain
 * terminal relative velocity, enforce collision/keep-out constraints, or
 * optimize a multi-burn/finite-thrust sequence.
 */
export function solveRendezvousImpulse(
  initial: RelativeState,
  meanMotionRadS: number,
  rendezvousTimeSeconds: number,
): RendezvousImpulseSolution {
  validateState(initial);
  validateMeanMotionAndTime(meanMotionRadS, rendezvousTimeSeconds);
  if (rendezvousTimeSeconds <= 0) {
    throw new Error('Rendezvous time must be greater than zero.');
  }

  const n = meanMotionRadS;
  const nt = n * rendezvousTimeSeconds;
  const c = Math.cos(nt);
  const s = Math.sin(nt);
  const [x0, y0, z0] = initial.positionKm;

  // Position at t = Phi_rr * r0 + Phi_rv * v0.
  const positionFromInitialPosition: Vector3 = [
    (4 - 3 * c) * x0,
    6 * (s - nt) * x0 + y0,
    c * z0,
  ];
  const velocityToPositionMatrix = [
    [s / n, (2 * (1 - c)) / n, 0],
    [(-2 * (1 - c)) / n, (4 * s - 3 * nt) / n, 0],
    [0, 0, s / n],
  ];
  const postBurnVelocity = solve3x3(
    velocityToPositionMatrix,
    scale(positionFromInitialPosition, -1),
  );
  const deltaV = subtract(postBurnVelocity, initial.velocityKmS);

  return {
    deltaVKmS: deltaV,
    postBurnVelocityKmS: postBurnVelocity,
    deltaVMagnitudeMps: magnitude(deltaV) * 1000,
    rendezvousTimeSeconds,
  };
}


export type TwoImpulseRendezvousSolution = {
  /** Initial departure impulse, km/s. */
  departureDeltaVKmS: Vector3;
  /** Instantaneous terminal velocity-matching impulse at rendezvous, km/s. */
  arrivalDeltaVKmS: Vector3;
  /** Magnitudes of the departure and arrival impulses, m/s. */
  departureDeltaVMagnitudeMps: number;
  arrivalDeltaVMagnitudeMps: number;
  /** Total ideal impulsive delta-v, m/s. */
  totalDeltaVMagnitudeMps: number;
  /** Relative state immediately before the terminal impulse. */
  preArrivalBurnState: RelativeState;
  /** Relative state immediately after the terminal impulse. */
  postArrivalBurnState: RelativeState;
  rendezvousTimeSeconds: number;
};

/**
 * Two-impulse CW rendezvous: departure burn selects a trajectory that reaches
 * zero relative position at T; a second instantaneous burn at T cancels the
 * residual relative velocity. This is an idealized terminal velocity match,
 * not a safe approach, docking, or collision-avoidance guidance solution.
 */
export function solveTwoImpulseRendezvous(
  initial: RelativeState,
  meanMotionRadS: number,
  rendezvousTimeSeconds: number,
): TwoImpulseRendezvousSolution {
  const departure = solveRendezvousImpulse(initial, meanMotionRadS, rendezvousTimeSeconds);
  const preArrivalBurnState = propagateCw(
    { positionKm: initial.positionKm, velocityKmS: departure.postBurnVelocityKmS },
    meanMotionRadS,
    rendezvousTimeSeconds,
  );
  const arrivalDeltaVKmS = scale(preArrivalBurnState.velocityKmS, -1);
  const arrivalMagnitude = magnitude(arrivalDeltaVKmS) * 1000;
  const postArrivalBurnState: RelativeState = {
    positionKm: preArrivalBurnState.positionKm,
    velocityKmS: [0, 0, 0],
  };

  return {
    departureDeltaVKmS: departure.deltaVKmS,
    arrivalDeltaVKmS,
    departureDeltaVMagnitudeMps: departure.deltaVMagnitudeMps,
    arrivalDeltaVMagnitudeMps: arrivalMagnitude,
    totalDeltaVMagnitudeMps: departure.deltaVMagnitudeMps + arrivalMagnitude,
    preArrivalBurnState,
    postArrivalBurnState,
    rendezvousTimeSeconds,
  };
}
