import type { RocketVehicleConfiguration } from './rocketStagingModel';
import {
  optimiseMaximumDeltaV,
  optimiseMinimumPropellantForDeltaV,
  type RocketOptimisationOptions,
  type RocketOptimisationResult
} from './rocketStagingOptimiser';

export type RocketSensitivityVariable =
  | { kind: 'stage-isp'; stageIndex: number; minimum: number; maximum: number }
  | { kind: 'structural-fraction'; stageIndex: number; minimum: number; maximum: number }
  | { kind: 'payload-mass'; minimum: number; maximum: number }
  | { kind: 'total-propellant'; minimum: number; maximum: number };

export type RocketStudySample = {
  inputValue: number;
  unit: 's' | 'fraction' | 'kg';
  objectiveValue: number | null;
  achievedDeltaVMs: number | null;
  initialMassKg: number | null;
  status: RocketOptimisationResult['status'] | 'invalid';
  error?: string;
};

export type RocketSensitivityStudy = {
  variable: RocketSensitivityVariable;
  samples: RocketStudySample[];
  baseline: RocketVehicleConfiguration;
};

export function runRocketStagingSensitivityStudy(
  configuration: RocketVehicleConfiguration,
  variable: RocketSensitivityVariable,
  sampleCount = 9,
  target?: { deltaVMs: number; maximumInitialMassKg: number },
  options: RocketOptimisationOptions = {}
): RocketSensitivityStudy {
  if (!Number.isInteger(sampleCount) || sampleCount < 2 || sampleCount > 101) {
    throw new Error('Sensitivity study sample count must be an integer from 2 to 101.');
  }
  if (!Number.isFinite(variable.minimum) || !Number.isFinite(variable.maximum) ||
      variable.minimum >= variable.maximum || variable.minimum < 0) {
    throw new Error('Sensitivity study range must contain finite, increasing, non-negative values.');
  }
  if ('stageIndex' in variable &&
      (!Number.isInteger(variable.stageIndex) || variable.stageIndex < 0 ||
       variable.stageIndex >= configuration.stages.length)) {
    throw new Error('Sensitivity study stage index is outside the configured stage range.');
  }

  const samples: RocketStudySample[] = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const inputValue = variable.minimum +
      (variable.maximum - variable.minimum) * index / (sampleCount - 1);
    const sample: RocketVehicleConfiguration = {
      payloadMassKg: configuration.payloadMassKg,
      stages: configuration.stages.map(stage => ({ ...stage }))
    };
    let unit: RocketStudySample['unit'] = 'kg';
    if (variable.kind === 'stage-isp') {
      sample.stages[variable.stageIndex].specificImpulseS = inputValue;
      unit = 's';
    } else if (variable.kind === 'structural-fraction') {
      sample.stages[variable.stageIndex].structuralFraction = inputValue;
      unit = 'fraction';
    } else if (variable.kind === 'payload-mass') {
      sample.payloadMassKg = inputValue;
    } else {
      const baselineTotal = sample.stages.reduce((sum, stage) => sum + stage.propellantMassKg, 0);
      sample.stages = sample.stages.map(stage => ({
        ...stage,
        propellantMassKg: stage.propellantMassKg / baselineTotal * inputValue
      }));
    }

    try {
      const result = target
        ? optimiseMinimumPropellantForDeltaV(sample, target.deltaVMs, target.maximumInitialMassKg, options)
        : optimiseMaximumDeltaV(sample, options);
      samples.push({
        inputValue, unit,
        objectiveValue: result.objectiveValue,
        achievedDeltaVMs: result.vehicle.totalDeltaVMs,
        initialMassKg: result.vehicle.initialMassKg,
        status: result.status
      });
    } catch (error) {
      samples.push({
        inputValue, unit, objectiveValue: null, achievedDeltaVMs: null,
        initialMassKg: null, status: 'invalid',
        error: error instanceof Error ? error.message : 'Study sample failed validation.'
      });
    }
  }

  return { variable: { ...variable }, samples, baseline: {
    payloadMassKg: configuration.payloadMassKg,
    stages: configuration.stages.map(stage => ({ ...stage }))
  } };
}

export function compareRocketStageCounts(
  base: Omit<RocketVehicleConfiguration, 'stages'> & { stageTemplates: RocketVehicleConfiguration['stages'] },
  options: RocketOptimisationOptions = {}
): Array<{ stageCount: number; result: RocketOptimisationResult }> {
  if (base.stageTemplates.length !== 4) {
    throw new Error('Stage-count comparison requires exactly 4 ordered stage templates.');
  }
  return [2, 3, 4].map(stageCount => {
    const templates = base.stageTemplates.slice(0, stageCount);
    if (templates.length !== stageCount) throw new Error('Not enough stage templates for stage-count comparison.');
    const configuration = {
      payloadMassKg: base.payloadMassKg,
      stages: templates.map(stage => ({ ...stage }))
    };
    return {
      stageCount,
      result: optimiseMaximumDeltaV(configuration, options)
    };
  });
}
