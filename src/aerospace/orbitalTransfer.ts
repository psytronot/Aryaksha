export const EARTH_MU_KM3_S2 = 398600.4418;
export const EARTH_MEAN_RADIUS_KM = 6371.0088;
export const TRANSFER_G0_M_S2 = 9.80665;

export type OrbitalTransferInputs = {
  initialAltitudeKm: number;
  targetAltitudeKm: number;
  inclinationChangeDeg: number;
  spacecraftMassKg: number;
  engineIspS: number;
};

export type OrbitalTransferResult = {
  initialRadiusKm: number;
  targetRadiusKm: number;
  transferSemiMajorAxisKm: number;
  initialCircularVelocityKmS: number;
  targetCircularVelocityKmS: number;
  transferPerigeeVelocityKmS: number;
  transferApogeeVelocityKmS: number;
  departureDeltaVMs: number;
  arrivalDeltaVMs: number;
  totalDeltaVMs: number;
  transferTimeMinutes: number;
  initialPeriodMinutes: number;
  targetPeriodMinutes: number;
  propellantMassKg: number;
  massAfterBurnsKg: number;
};

export function calculateOrbitalTransfer(input: OrbitalTransferInputs): OrbitalTransferResult {
  const values = Object.values(input);
  if (!values.every(Number.isFinite)) throw new Error('All orbital transfer inputs must be finite numbers.');
  if (input.initialAltitudeKm < 120 || input.targetAltitudeKm < 120) {
    throw new Error('Orbit altitudes must be at least 120 km above the reference surface.');
  }
  if (Math.abs(input.targetAltitudeKm - input.initialAltitudeKm) < 1e-9 && input.inclinationChangeDeg === 0) {
    throw new Error('Choose a different target orbit or a non-zero inclination change.');
  }
  if (input.inclinationChangeDeg < 0 || input.inclinationChangeDeg > 180) {
    throw new Error('Inclination change must be between 0 and 180 degrees.');
  }
  if (input.spacecraftMassKg <= 0) throw new Error('Spacecraft mass must be greater than zero.');
  if (input.engineIspS <= 0) throw new Error('Engine specific impulse must be greater than zero.');

  const r1 = EARTH_MEAN_RADIUS_KM + input.initialAltitudeKm;
  const r2 = EARTH_MEAN_RADIUS_KM + input.targetAltitudeKm;
  const a = (r1 + r2) / 2;
  const circular1 = Math.sqrt(EARTH_MU_KM3_S2 / r1);
  const circular2 = Math.sqrt(EARTH_MU_KM3_S2 / r2);
  const transferPerigee = Math.sqrt(EARTH_MU_KM3_S2 * (2 / r1 - 1 / a));
  const transferApogee = Math.sqrt(EARTH_MU_KM3_S2 * (2 / r2 - 1 / a));
  const departure = Math.abs(transferPerigee - circular1);
  const planeChangeRad = input.inclinationChangeDeg * Math.PI / 180;
  const arrival = Math.sqrt(
    transferApogee ** 2 + circular2 ** 2 -
    2 * transferApogee * circular2 * Math.cos(planeChangeRad)
  );
  const total = departure + arrival;
  const transferTime = Math.PI * Math.sqrt(a ** 3 / EARTH_MU_KM3_S2);
  const period1 = 2 * Math.PI * Math.sqrt(r1 ** 3 / EARTH_MU_KM3_S2);
  const period2 = 2 * Math.PI * Math.sqrt(r2 ** 3 / EARTH_MU_KM3_S2);
  const massAfter = input.spacecraftMassKg * Math.exp(-(total * 1000) / (input.engineIspS * TRANSFER_G0_M_S2));

  return {
    initialRadiusKm: r1, targetRadiusKm: r2, transferSemiMajorAxisKm: a,
    initialCircularVelocityKmS: circular1, targetCircularVelocityKmS: circular2,
    transferPerigeeVelocityKmS: transferPerigee, transferApogeeVelocityKmS: transferApogee,
    departureDeltaVMs: departure * 1000, arrivalDeltaVMs: arrival * 1000,
    totalDeltaVMs: total * 1000, transferTimeMinutes: transferTime / 60,
    initialPeriodMinutes: period1 / 60, targetPeriodMinutes: period2 / 60,
    propellantMassKg: input.spacecraftMassKg - massAfter, massAfterBurnsKg: massAfter
  };
}
