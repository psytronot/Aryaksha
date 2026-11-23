export const STANDARD_GRAVITY_M_S2 = 9.80665;

export type RocketStagingInputs = {
  totalInitialMassKg: number;
  payloadMassKg: number;
  stage1SpecificImpulseS: number;
  stage2SpecificImpulseS: number;
  stage1StructuralFraction: number;
  stage2StructuralFraction: number;
};

export type RocketStagingPoint = {
  stage1PropellantFraction: number;
  stage1PropellantKg: number;
  stage2PropellantKg: number;
  stage1DryMassKg: number;
  stage2DryMassKg: number;
  totalPropellantKg: number;
  stage1DeltaVMs: number;
  stage2DeltaVMs: number;
  totalDeltaVMs: number;
};

export type RocketStagingResult = {
  inputs: RocketStagingInputs;
  points: RocketStagingPoint[];
  optimum: RocketStagingPoint;
};

function assertValidInputs(input: RocketStagingInputs): void {
  const values = Object.values(input);
  if (!values.every(Number.isFinite)) {
    throw new Error('All rocket design inputs must be finite numbers.');
  }
  if (input.totalInitialMassKg <= 0 || input.payloadMassKg <= 0) {
    throw new Error('Initial mass and payload mass must be greater than zero.');
  }
  if (input.payloadMassKg >= input.totalInitialMassKg) {
    throw new Error('Payload mass must be smaller than total initial mass.');
  }
  if (input.stage1SpecificImpulseS <= 0 || input.stage2SpecificImpulseS <= 0) {
    throw new Error('Specific impulse must be greater than zero.');
  }
  for (const [name, fraction] of [
    ['Stage 1', input.stage1StructuralFraction],
    ['Stage 2', input.stage2StructuralFraction]
  ] as const) {
    if (fraction < 0 || fraction >= 0.5) {
      throw new Error(`${name} structural fraction must be between 0 (inclusive) and 0.5 (exclusive).`);
    }
  }
}

export function calculateStagingPoint(
  input: RocketStagingInputs,
  stage1PropellantFraction: number
): RocketStagingPoint {
  assertValidInputs(input);
  if (!Number.isFinite(stage1PropellantFraction) || stage1PropellantFraction <= 0 || stage1PropellantFraction >= 1) {
    throw new Error('Stage 1 propellant split must be greater than 0% and less than 100%.');
  }

  const availableMass = input.totalInitialMassKg - input.payloadMassKg;
  const stage1MassCoefficient = 1 / (1 - input.stage1StructuralFraction);
  const stage2MassCoefficient = 1 / (1 - input.stage2StructuralFraction);
  const totalPropellantKg = availableMass / (
    stage1PropellantFraction * stage1MassCoefficient +
    (1 - stage1PropellantFraction) * stage2MassCoefficient
  );
  const stage1PropellantKg = totalPropellantKg * stage1PropellantFraction;
  const stage2PropellantKg = totalPropellantKg - stage1PropellantKg;
  const stage1DryMassKg = stage1PropellantKg * input.stage1StructuralFraction / (1 - input.stage1StructuralFraction);
  const stage2DryMassKg = stage2PropellantKg * input.stage2StructuralFraction / (1 - input.stage2StructuralFraction);

  // Stage 1 burns first. Its inert mass is discarded before stage 2 ignition.
  const stage1MassAfterBurnKg = input.totalInitialMassKg - stage1PropellantKg;
  const stage2IgnitionMassKg = stage1MassAfterBurnKg - stage1DryMassKg;
  const stage2FinalMassKg = input.payloadMassKg + stage2DryMassKg;
  if (stage1MassAfterBurnKg <= 0 || stage2IgnitionMassKg <= stage2FinalMassKg) {
    throw new Error('This staging split produces a non-physical mass ratio.');
  }

  const stage1DeltaVMs = input.stage1SpecificImpulseS * STANDARD_GRAVITY_M_S2 *
    Math.log(input.totalInitialMassKg / stage1MassAfterBurnKg);
  const stage2DeltaVMs = input.stage2SpecificImpulseS * STANDARD_GRAVITY_M_S2 *
    Math.log(stage2IgnitionMassKg / stage2FinalMassKg);

  return {
    stage1PropellantFraction,
    stage1PropellantKg,
    stage2PropellantKg,
    stage1DryMassKg,
    stage2DryMassKg,
    totalPropellantKg,
    stage1DeltaVMs,
    stage2DeltaVMs,
    totalDeltaVMs: stage1DeltaVMs + stage2DeltaVMs
  };
}

export function optimiseRocketStaging(input: RocketStagingInputs): RocketStagingResult {
  assertValidInputs(input);
  const points = Array.from({ length: 91 }, (_, index) =>
    calculateStagingPoint(input, (index + 5) / 100)
  );
  const optimum = points.reduce((best, point) =>
    point.totalDeltaVMs > best.totalDeltaVMs ? point : best
  );
  return { inputs: { ...input }, points, optimum };
}
