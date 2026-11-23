import { STANDARD_GRAVITY_M_S2 } from './rocketStaging';

export type RocketStageParameters = {
  name: string;
  propellantMassKg: number;
  specificImpulseS: number;
  structuralFraction: number;
};

export type RocketVehicleConfiguration = {
  payloadMassKg: number;
  stages: RocketStageParameters[];
};

export type RocketStageResult = RocketStageParameters & {
  inertMassKg: number;
  wetMassKg: number;
  ignitionMassKg: number;
  burnoutMassKg: number;
  separationMassKg: number;
  finalMassKg: number;
  deltaVMs: number;
};

export type RocketVehicleMassBreakdown = {
  payloadMassKg: number;
  initialMassKg: number;
  finalMassKg: number;
  totalPropellantMassKg: number;
  totalInertMassKg: number;
  totalDeltaVMs: number;
  massClosureErrorKg: number;
  stages: RocketStageResult[];
};

const MASS_CLOSURE_ABSOLUTE_TOLERANCE_KG = 1e-8;

export function validateRocketVehicleConfiguration(
  configuration: RocketVehicleConfiguration
): void {
  if (!Number.isFinite(configuration.payloadMassKg) || configuration.payloadMassKg <= 0) {
    throw new Error('Payload mass must be a finite number greater than zero.');
  }
  if (!Array.isArray(configuration.stages) || configuration.stages.length < 2 || configuration.stages.length > 4) {
    throw new Error('Rocket staging model supports between 2 and 4 stages.');
  }

  configuration.stages.forEach((stage, index) => {
    const stageName = stage.name?.trim() || `Stage ${index + 1}`;
    if (![stage.propellantMassKg, stage.specificImpulseS, stage.structuralFraction].every(Number.isFinite)) {
      throw new Error(`${stageName}: all stage inputs must be finite numbers.`);
    }
    if (stage.propellantMassKg <= 0) {
      throw new Error(`${stageName}: propellant mass must be greater than zero.`);
    }
    if (stage.specificImpulseS <= 0) {
      throw new Error(`${stageName}: specific impulse must be greater than zero.`);
    }
    if (stage.structuralFraction < 0 || stage.structuralFraction >= 0.5) {
      throw new Error(`${stageName}: structural fraction must be between 0 (inclusive) and 0.5 (exclusive).`);
    }
  });
}

/**
 * Calculates an ideal, serially staged vehicle. Stages are ordered from
 * first-to-fire (lowest stage) to last-to-fire (uppermost stage).
 */
export function calculateRocketVehicle(
  configuration: RocketVehicleConfiguration
): RocketVehicleMassBreakdown {
  validateRocketVehicleConfiguration(configuration);

  const stageMasses = configuration.stages.map(stage => {
    const inertMassKg = stage.propellantMassKg * stage.structuralFraction /
      (1 - stage.structuralFraction);
    return { ...stage, inertMassKg, wetMassKg: stage.propellantMassKg + inertMassKg };
  });
  const totalPropellantMassKg = stageMasses.reduce((sum, stage) => sum + stage.propellantMassKg, 0);
  const totalInertMassKg = stageMasses.reduce((sum, stage) => sum + stage.inertMassKg, 0);
  const initialMassKg = configuration.payloadMassKg + totalPropellantMassKg + totalInertMassKg;

  let remainingStackMassKg = initialMassKg;
  const stages: RocketStageResult[] = stageMasses.map((stage, index) => {
    const ignitionMassKg = remainingStackMassKg;
    const burnoutMassKg = ignitionMassKg - stage.propellantMassKg;
    if (!(ignitionMassKg > burnoutMassKg && burnoutMassKg > 0)) {
      throw new Error(`${stage.name}: staging allocation produces a non-physical mass ratio.`);
    }
    const deltaVMs = stage.specificImpulseS * STANDARD_GRAVITY_M_S2 *
      Math.log(ignitionMassKg / burnoutMassKg);
    const isFinalStage = index === stageMasses.length - 1;
    const separationMassKg = isFinalStage ? burnoutMassKg : burnoutMassKg - stage.inertMassKg;
    const finalMassKg = isFinalStage ? burnoutMassKg : separationMassKg;
    if (!(separationMassKg > 0)) {
      throw new Error(`${stage.name}: separation produces a non-physical remaining mass.`);
    }
    remainingStackMassKg = separationMassKg;
    return {
      ...stage,
      ignitionMassKg,
      burnoutMassKg,
      separationMassKg,
      finalMassKg,
      deltaVMs
    };
  });

  const finalMassKg = configuration.payloadMassKg + stageMasses[stageMasses.length - 1].inertMassKg;
  const massClosureErrorKg = initialMassKg -
    (configuration.payloadMassKg + totalPropellantMassKg + totalInertMassKg);
  if (Math.abs(massClosureErrorKg) > MASS_CLOSURE_ABSOLUTE_TOLERANCE_KG) {
    throw new Error('Rocket vehicle mass accounting failed to close within the absolute tolerance.');
  }

  return {
    payloadMassKg: configuration.payloadMassKg,
    initialMassKg,
    finalMassKg,
    totalPropellantMassKg,
    totalInertMassKg,
    totalDeltaVMs: stages.reduce((sum, stage) => sum + stage.deltaVMs, 0),
    massClosureErrorKg,
    stages
  };
}
