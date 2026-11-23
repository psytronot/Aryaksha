import type { RocketVehicleConfiguration } from './rocketStagingModel';
import type { RocketOptimisationResult } from './rocketStagingOptimiser';
import type { RocketSensitivityStudy } from './rocketStagingStudies';

const n = (value: number, digits = 3) =>
  Number.isFinite(value) ? value.toFixed(digits) : 'Not available';

export function buildRocketStagingMarkdownReport(
  result: RocketOptimisationResult,
  configuration: RocketVehicleConfiguration,
  studies: RocketSensitivityStudy[] = []
): string {
  const lines = [
    '# Aryaksha — Rocket Staging Engineering Study',
    '',
    \`- Objective: \${result.objective}\`,
    \`- Solver status: \${result.status}\`,
    \`- Converged: \${result.converged ? 'Yes' : 'No'}\`,
    \`- Method: \${result.method}\`,
    \`- Evaluations: \${result.evaluations}\`,
    \`- Termination: \${result.terminationReason}\`,
    \`- Relative objective tolerance: \${result.tolerances.relativeObjectiveTolerance}\`,
    \`- Absolute objective tolerance: \${result.tolerances.absoluteObjectiveTolerance}\`,
    \`- Constraint tolerance: \${result.tolerances.constraintTolerance}\`,
    '',
    '## Vehicle inputs',
    '',
    \`- Payload mass: \${n(configuration.payloadMassKg)} kg\`,
    \`- Stage count: \${configuration.stages.length}\`,
    ...configuration.stages.map((stage, index) =>
      \`- Stage \${index + 1}: Isp \${n(stage.specificImpulseS)} s; structural fraction \${n(stage.structuralFraction, 5)}; propellant \${n(stage.propellantMassKg)} kg\`),
    '',
    '## Optimised vehicle result',
    '',
    \`- Initial wet mass: \${n(result.vehicle.initialMassKg)} kg\`,
    \`- Final mass: \${n(result.vehicle.finalMassKg)} kg\`,
    \`- Total propellant: \${n(result.vehicle.totalPropellantMassKg)} kg\`,
    \`- Total inert mass: \${n(result.vehicle.totalInertMassKg)} kg\`,
    \`- Total ideal delta-v: \${n(result.vehicle.totalDeltaVMs)} m/s\`,
    \`- Mass closure error: \${n(result.vehicle.massClosureErrorKg, 9)} kg\`,
    '',
    '| Stage | Isp (s) | Propellant (kg) | Inert (kg) | Ignition (kg) | Burnout (kg) | Separation (kg) | Ideal Δv (m/s) |',
    '|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...result.vehicle.stages.map((stage, index) =>
      \`| \${index + 1} | \${n(stage.specificImpulseS)} | \${n(stage.propellantMassKg)} | \${n(stage.inertMassKg)} | \${n(stage.ignitionMassKg)} | \${n(stage.burnoutMassKg)} | \${n(stage.separationMassKg)} | \${n(stage.deltaVMs)} |\`),
    '',
    '## Method',
    '',
    'Each stage uses the ideal Tsiolkovsky rocket equation:',
    '',
    '\`Δvᵢ = Ispᵢ × g₀ × ln(mᵢ,ignition / mᵢ,burnout)\` with \`g₀ = 9.80665 m/s²\`.',
    '',
    'Structural fraction is inert mass divided by stage wet mass (propellant plus inert mass). Stage inert mass remains attached during its burn. The inert mass of each spent lower stage is discarded before the next stage ignition. Final-stage inert mass remains attached to the payload.',
    '',
    '## Sensitivity studies',
    ''
  ];

  if (!studies.length) lines.push('No sensitivity studies included.');
  for (const study of studies) {
    lines.push(
      \`### \${study.variable.kind}\`,
      '',
      '| Input | Unit | Objective value | Achieved Δv (m/s) | Initial mass (kg) | Status |',
      '|---:|---|---:|---:|---:|---|',
      ...study.samples.map(sample =>
        \`| \${n(sample.inputValue)} | \${sample.unit} | \${sample.objectiveValue === null ? '—' : n(sample.objectiveValue)} | \${sample.achievedDeltaVMs === null ? '—' : n(sample.achievedDeltaVMs)} | \${sample.initialMassKg === null ? '—' : n(sample.initialMassKg)} | \${sample.status} |\`),
      ''
    );
  }

  lines.push(
    '## Assumptions and limitations',
    '',
    '- Ideal impulsive staging and constant stage-specific impulse.',
    '- No gravity, atmospheric drag, steering, finite-burn effects, residual propellant, engine transients, thrust-to-weight constraints, timing or separation losses.',
    '- Search is bounded and deterministic. A reported converged result is the best candidate found by the stated numerical method; it is not a mathematical proof of a global optimum.',
    '- For target delta-v studies, failure to find a feasible sampled candidate is not proof that the continuous design space is infeasible.',
    '- This is an educational preliminary trade-study model, not a trajectory prediction, launch vehicle qualification or flight-certified design.',
    ''
  );
  return lines.join('\n');
}
