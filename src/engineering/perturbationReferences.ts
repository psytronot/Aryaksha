export type Vector3 = readonly [number, number, number];

export interface J2Parameters {
  muM3S2: number;
  equatorialRadiusM: number;
  j2: number;
}

/** Earth J2 perturbing acceleration in m/s²; input position is in an Earth-centred inertial frame whose +Z is the spin axis. */
export function earthJ2Acceleration(positionM: Vector3, parameters: J2Parameters): [number, number, number] {
  const [x, y, z] = positionM;
  const { muM3S2, equatorialRadiusM, j2 } = parameters;
  const r2 = x * x + y * y + z * z;
  if (![x, y, z, muM3S2, equatorialRadiusM, j2].every(Number.isFinite)
      || r2 <= 0 || muM3S2 <= 0 || equatorialRadiusM <= 0 || j2 < 0) {
    throw new Error('J2 acceleration requires finite position, positive GM/radius and non-negative J2.');
  }
  const r = Math.sqrt(r2);
  const factor = 1.5 * j2 * muM3S2 * equatorialRadiusM ** 2 / r ** 5;
  const zRatio = (z * z) / r2;
  return [
    factor * x * (5 * zRatio - 1),
    factor * y * (5 * zRatio - 1),
    factor * z * (5 * zRatio - 3)
  ];
}

/** Differential third-body acceleration in m/s². r is central-body-to-spacecraft; r3 is central-body-to-perturber. */
export function thirdBodyDifferentialAcceleration(
  spacecraftPositionM: Vector3,
  perturberPositionM: Vector3,
  perturberMuM3S2: number
): [number, number, number] {
  const delta = perturberPositionM.map((value, axis) => value - spacecraftPositionM[axis]);
  const norm = (v: readonly number[]) => Math.hypot(v[0], v[1], v[2]);
  const d = norm(delta);
  const r3 = norm(perturberPositionM);
  if (![...spacecraftPositionM, ...perturberPositionM, perturberMuM3S2].every(Number.isFinite)
      || d <= 0 || r3 <= 0 || perturberMuM3S2 <= 0) {
    throw new Error('Third-body acceleration requires finite non-coincident positions and positive GM.');
  }
  const scaleNear = perturberMuM3S2 / d ** 3;
  const scaleOrigin = perturberMuM3S2 / r3 ** 3;
  return delta.map((value, axis) => scaleNear * value - scaleOrigin * perturberPositionM[axis]) as [number, number, number];
}
