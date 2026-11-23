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
  targetDeltaVMs?: number;
  maximumInitialMassKg?: number;
};

const DEFAULTS = {
  minimumStagePropellantShare: 0.001,
  maxEvaluations: 20000,
  relativeObjectiveTolerance: 1e-6,
  absoluteObjectiveTolerance: 1e-7,
  constraintTolerance: 1e-7,
  initialGridDivisions: 8
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
  const walk = (index: number, unitsLeft: number, prefix: number[]) => {
    if (index === count - 1) {
      output.push([...prefix, minimum + remaining * unitsLeft / divisions]);
      return;
    }
    for (let units = 0; units <= unitsLeft; units += 1) {
      walk(index + 1, unitsLeft - units,
        [...prefix, minimum + remaining * units / divisions]);
    }
  };
  walk(0, divisions, []);
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
  const baselineVehicle = calculateRocketVehicle(configuration);
  const fixedInitialMassKg = baselineVehicle.initialMassKg;
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
      const massCoefficient = shares.reduce((sum, share, index) =>
        sum + share / (1 - configuration.stages[index].structuralFraction), 0);
      const totalPropellantKg = (fixedInitialMassKg - configuration.payloadMassKg) / massCoefficient;
      const vehicleConfiguration = makeConfiguration(configuration, shares, totalPropellantKg);
      const vehicle = calculateRocketVehicle(vehicleConfiguration);
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

  while (evaluations < resolved.maxEvaluations && step > resolved.constraintTolerance) {
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

  const converged = evaluations < resolved.maxEvaluations && step <= resolved.constraintTolerance;
  const finalMassCoefficient = best.shares.reduce((sum, share, index) =>
    sum + share / (1 - configuration.stages[index].structuralFraction), 0);
  const finalTotalPropellantKg = (fixedInitialMassKg - configuration.payloadMassKg) / finalMassCoefficient;
  const finalConfiguration = makeConfiguration(configuration, best.shares, finalTotalPropellantKg);
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


/**
 * Finds the lowest sampled total propellant that reaches the ideal delta-v
 * target without exceeding the initial wet-mass ceiling. Failure to find a
 * candidate is reported as non-converged, not as a proof of infeasibility.
 */
export function optimiseMinimumPropellantForDeltaV(
  configuration: RocketVehicleConfiguration,
  targetDeltaVMs: number,
  maximumInitialMassKg: number,
  options: RocketOptimisationOptions = {}
): RocketOptimisationResult {
  const resolved = resolveOptions(options);
  calculateRocketVehicle(configuration);
  if (!Number.isFinite(targetDeltaVMs) || targetDeltaVMs <= 0) {
    throw new Error('Target delta-v must be a finite number greater than zero.');
  }
  if (!Number.isFinite(maximumInitialMassKg) || maximumInitialMassKg <= configuration.payloadMassKg) {
    throw new Error('Maximum initial wet mass must be finite and greater than payload mass.');
  }

  const count = configuration.stages.length;
  const minimumShare = resolved.minimumStagePropellantShare;
  if (minimumShare * count >= 1) throw new Error('Minimum stage propellant share leaves no feasible allocation.');
  let evaluations = 0;
  let best: { shares: number[]; vehicle: RocketVehicleMassBreakdown; configuration: RocketVehicleConfiguration } | undefined;
  let anyCeilingFeasible = false;
  const massCoefficients = configuration.stages.map(stage =>
    1 / (1 - stage.structuralFraction)
  );

  const samples = allocations(count, resolved.initialGridDivisions, minimumShare);
  for (const shares of samples) {
    if (evaluations >= resolved.maxEvaluations) break;
    const coefficient = shares.reduce((sum, share, index) => sum + share * massCoefficients[index], 0);
    const maxPropellant = (maximumInitialMassKg - configuration.payloadMassKg) / coefficient;
    if (!(maxPropellant > 0)) continue;
    let low = 0;
    let high = maxPropellant;
    const makeAt = (total: number) => makeConfiguration(configuration, shares, total);
    let highVehicle: RocketVehicleMassBreakdown;
    try {
      highVehicle = calculateRocketVehicle(makeAt(high));
    } catch {
      continue;
    }
    evaluations += 1;
    if (highVehicle.initialMassKg > maximumInitialMassKg + resolved.constraintTolerance ||
        highVehicle.totalDeltaVMs + resolved.constraintTolerance < targetDeltaVMs) continue;
    anyCeilingFeasible = true;

    for (let iteration = 0; iteration < 48 && evaluations < resolved.maxEvaluations; iteration += 1) {
      const middle = (low + high) / 2;
      const candidate = calculateRocketVehicle(makeAt(middle));
      evaluations += 1;
      if (candidate.totalDeltaVMs >= targetDeltaVMs) high = middle;
      else low = middle;
      if (high - low <= resolved.absoluteObjectiveTolerance +
          high * resolved.relativeObjectiveTolerance) break;
    }
    if (evaluations >= resolved.maxEvaluations) break;
    const finalConfiguration = makeAt(high);
    const vehicle = calculateRocketVehicle(finalConfiguration);
    evaluations += 1;
    if (vehicle.initialMassKg <= maximumInitialMassKg + resolved.constraintTolerance &&
        vehicle.totalDeltaVMs + resolved.constraintTolerance >= targetDeltaVMs &&
        (!best || vehicle.totalPropellantMassKg < best.vehicle.totalPropellantMassKg)) {
      best = { shares, vehicle, configuration: finalConfiguration };
    }
  }

  if (!best) {
    const status: RocketSolverStatus = evaluations >= resolved.maxEvaluations
      ? 'evaluation-limit' : 'non-converged';
    const fallback = calculateRocketVehicle(configuration);
    return {
      objective: 'minimum-propellant',
      status,
      converged: false,
      terminationReason: anyCeilingFeasible
        ? 'A feasible candidate was found during exploration but no final solution met all constraints within the evaluation budget.'
        : 'No sampled allocation met the target and wet-mass ceiling; continuous-domain infeasibility has not been proven.',
      evaluations,
      tolerances: {
        relativeObjectiveTolerance: resolved.relativeObjectiveTolerance,
        absoluteObjectiveTolerance: resolved.absoluteObjectiveTolerance,
        constraintTolerance: resolved.constraintTolerance
      },
      method: 'Deterministic simplex allocation exploration with bounded bisection in total propellant',
      configuration,
      vehicle: fallback,
      stagePropellantShares: configuration.stages.map(stage =>
        stage.propellantMassKg / configuration.stages.reduce((sum, item) => sum + item.propellantMassKg, 0)),
      objectiveValue: Number.POSITIVE_INFINITY,
      targetDeltaVMs,
      maximumInitialMassKg
    };
  }

  const converged = false;
  return {
    objective: 'minimum-propellant',
    status: evaluations >= resolved.maxEvaluations ? 'evaluation-limit' : 'non-converged',
    converged,
    terminationReason: evaluations >= resolved.maxEvaluations
      ? 'Maximum objective evaluations reached; feasible best candidate returned without a convergence claim.'
      : 'A feasible target and mass-ceiling candidate was found by bounded allocation sampling and bisection; global allocation convergence is not established.',
    evaluations,
    tolerances: {
      relativeObjectiveTolerance: resolved.relativeObjectiveTolerance,
      absoluteObjectiveTolerance: resolved.absoluteObjectiveTolerance,
      constraintTolerance: resolved.constraintTolerance
    },
    method: 'Deterministic simplex allocation exploration with bounded bisection in total propellant',
    configuration: best.configuration,
    vehicle: best.vehicle,
    stagePropellantShares: [...best.shares],
    objectiveValue: best.vehicle.totalPropellantMassKg,
    targetDeltaVMs,
    maximumInitialMassKg
  };
}
