import {
  calculateRocketVehicle,
  type RocketVehicleConfiguration,
  type RocketVehicleMassBreakdown
} from './rocketStagingModel';

export type RocketOptimisationObjective = 'maximum-delta-v' | 'minimum-propellant';
export type RocketSolverStatus = 'converged' | 'evaluation-limit' | 'no-feasible-candidate' | 'infeasible' | 'non-converged';

export type RocketOptimisationOptions = {
  minimumStagePropellantShare?: number;
  maxEvaluations?: number;
  relativeObjectiveTolerance?: number;
  absoluteObjectiveTolerance?: number;
  constraintTolerance?: number;
  initialGridDivisions?: number;
};

export type RocketOptimisationResult = {
  objective: RocketOptimisationObjective;
  status: RocketSolverStatus;
  converged: boolean;
  terminationReason: string;
  evaluations: number;
  tolerances: Required<Pick<RocketOptimisationOptions,
    'relativeObjectiveTolerance' | 'absoluteObjectiveTolerance' | 'constraintTolerance'>>;
  method: string;
  configuration: RocketVehicleConfiguration;
  vehicle: RocketVehicleMassBreakdown;
  stagePropellantShares: number[];
  objectiveValue: number;
};

const DEFAULTS = {
  minimumStagePropellantShare: 0.001,
  maxEvaluations: 20000,
  relativeObjectiveTolerance: 1e-6,
  absoluteObjectiveTolerance: 1e-7,
  constraintTolerance: 1e-7,
  initialGridDivisions: 20
} as const;

function resolveOptions(options: RocketOptimisationOptions) {
  const resolved = { ...DEFAULTS, ...options };
  if (!Number.isInteger(resolved.maxEvaluations) || resolved.maxEvaluations < 1 ||
      !Number.isInteger(resolved.initialGridDivisions) || resolved.initialGridDivisions < 2 ||
      !Number.isFinite(resolved.minimumStagePropellantShare) ||
      resolved.minimumStagePropellantShare <= 0 ||
      resolved.minimumStagePropellantShare * 4 >= 1 ||
      ![resolved.relativeObjectiveTolerance, resolved.absoluteObjectiveTolerance, resolved.constraintTolerance]
        .every(value => Number.isFinite(value) && value > 0)) {
    throw new Error('Solver options must be finite, positive and within the supported search bounds.');
  }
  return resolved;
}

function allocations(count: number, divisions: number, minimum: number): number[][] {
  const remaining = 1 - count * minimum;
  const output: number[][] = [];
  const walk = (index: number, left: number, prefix: number[]) => {
    if (index === count - 1) {
      output.push([...prefix, minimum + left]);
      return;
    }
    for (let part = 0; part <= divisions; part += 1) {
      const amount = remaining * part / divisions;
      walk(index + 1, left - amount, [...prefix, minimum + amount]);
    }
  };
  walk(0, remaining, []);
  return output;
}

function makeConfiguration(
  baseline: RocketVehicleConfiguration,
  shares: number[],
  totalPropellantKg: number
): RocketVehicleConfiguration {
  return {
    payloadMassKg: baseline.payloadMassKg,
    stages: baseline.stages.map((stage, index) => ({
      ...stage,
      propellantMassKg: shares[index] * totalPropellantKg
    }))
  };
}

/** Bounded deterministic search over a fixed total-propellant allocation simplex. */
export function optimiseMaximumDeltaV(
  configuration: RocketVehicleConfiguration,
  options: RocketOptimisationOptions = {}
): RocketOptimisationResult {
  const resolved = resolveOptions(options);
  // Validate baseline and establish the fixed total propellant budget.
  calculateRocketVehicle(configuration);
  const totalPropellantKg = configuration.stages.reduce((sum, stage) => sum + stage.propellantMassKg, 0);
  const count = configuration.stages.length;
  if (resolved.minimumStagePropellantShare * count >= 1) {
    throw new Error('Minimum stage propellant share leaves no feasible allocation.');
  }

  let evaluations = 0;
  let best: { shares: number[]; vehicle: RocketVehicleMassBreakdown } | undefined;
  const evaluate = (shares: number[]) => {
    if (evaluations >= resolved.maxEvaluations) return;
    evaluations += 1;
    try {
      const vehicle = calculateRocketVehicle(makeConfiguration(configuration, shares, totalPropellantKg));
      if (!best || vehicle.totalDeltaVMs > best.vehicle.totalDeltaVMs) best = { shares, vehicle };
    } catch {
      // Invalid physical candidates are excluded from the feasible set.
    }
  };

  const candidates = allocations(count, resolved.initialGridDivisions, resolved.minimumStagePropellantShare);
  for (const candidate of candidates) {
    if (evaluations >= resolved.maxEvaluations) break;
    evaluate(candidate);
  }

  if (!best) {
    const fallbackShares = Array(count).fill(1 / count);
    evaluate(fallbackShares);
  }

  if (!best) {
    throw new Error('No physically feasible propellant allocation was found.');
  }

  let step = (1 - count * resolved.minimumStagePropellantShare) /
    resolved.initialGridDivisions;
  let lastImprovement = Number.POSITIVE_INFINITY;
  const tolerance = resolved.absoluteObjectiveTolerance +
    Math.abs(best.vehicle.totalDeltaVMs) * resolved.relativeObjectiveTolerance;

  while (evaluations < resolved.maxEvaluations && step > resolved.constraintTolerance &&
    lastImprovement > tolerance) {
    const startValue = best.vehicle.totalDeltaVMs;
    let improved = false;
    for (let from = 0; from < count; from += 1) {
      for (let to = 0; to < count; to += 1) {
        if (from === to || evaluations >= resolved.maxEvaluations) continue;
        const candidate = [...best.shares];
        const transfer = Math.min(step, candidate[from] - resolved.minimumStagePropellantShare);
        if (transfer <= resolved.constraintTolerance) continue;
        candidate[from] -= transfer;
        candidate[to] += transfer;
        evaluate(candidate);
        if (best.vehicle.totalDeltaVMs > startValue + resolved.absoluteObjectiveTolerance) improved = true;
      }
    }
    lastImprovement = best.vehicle.totalDeltaVMs - startValue;
    if (!improved) step /= 2;
  }

  const converged = evaluations < resolved.maxEvaluations &&
    step <= resolved.constraintTolerance || lastImprovement <= tolerance;
  const finalConfiguration = makeConfiguration(configuration, best.shares, totalPropellantKg);
  const finalVehicle = calculateRocketVehicle(finalConfiguration);
  const status: RocketSolverStatus = evaluations >= resolved.maxEvaluations
    ? 'evaluation-limit'
    : converged ? 'converged' : 'non-converged';

  return {
    objective: 'maximum-delta-v',
    status,
    converged,
    terminationReason: status === 'converged'
      ? 'Local refinement reached the configured objective or allocation tolerance; best bounded-search candidate returned.'
      : status === 'evaluation-limit'
        ? 'Maximum objective evaluations reached before convergence.'
        : 'Search stopped before meeting the configured convergence tolerances.',
    evaluations,
    tolerances: {
      relativeObjectiveTolerance: resolved.relativeObjectiveTolerance,
      absoluteObjectiveTolerance: resolved.absoluteObjectiveTolerance,
      constraintTolerance: resolved.constraintTolerance
    },
    method: 'Deterministic simplex grid exploration followed by bounded pairwise coordinate refinement',
    configuration: finalConfiguration,
    vehicle: finalVehicle,
    stagePropellantShares: [...best.shares],
    objectiveValue: finalVehicle.totalDeltaVMs
  };
}
