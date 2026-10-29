import { readFileSync } from 'node:fs';

const file = new URL('../tests/tests.json', import.meta.url);
const scenarios = JSON.parse(readFileSync(file, 'utf8'));
const errors = [];
const expectedOriginalScenarioCount = 9;

if (!Array.isArray(scenarios)) {
  throw new TypeError('tests/tests.json must contain a JSON array.');
}

if (scenarios.length !== expectedOriginalScenarioCount) {
  errors.push(
    `Expected ${expectedOriginalScenarioCount} original AppDeploy acceptance scenarios; found ${scenarios.length}. Update this guard deliberately if the canonical suite changes.`
  );
}

const names = new Set();
for (const [index, scenario] of scenarios.entries()) {
  const label = `scenario[${index}]`;

  if (!scenario || typeof scenario !== 'object' || Array.isArray(scenario)) {
    errors.push(`${label} must be an object.`);
    continue;
  }

  if (typeof scenario.name !== 'string' || !scenario.name.trim()) {
    errors.push(`${label}.name must be a non-empty string.`);
  } else if (names.has(scenario.name)) {
    errors.push(`Duplicate scenario name: ${scenario.name}`);
  } else {
    names.add(scenario.name);
  }

  if (!['desktop', 'mobile'].includes(scenario.viewport)) {
    errors.push(`${label}.viewport must be "desktop" or "mobile".`);
  }

  if (!Array.isArray(scenario.covers) || scenario.covers.length === 0 ||
      scenario.covers.some((item) => typeof item !== 'string' || !item.trim())) {
    errors.push(`${label}.covers must contain at least one non-empty acceptance area.`);
  }

  if (!Array.isArray(scenario.steps) || scenario.steps.length === 0 ||
      scenario.steps.some((step) => typeof step !== 'string' || !step.trim())) {
    errors.push(`${label}.steps must contain at least one non-empty step.`);
  }

  if (typeof scenario.expected !== 'string' || !scenario.expected.trim()) {
    errors.push(`${label}.expected must be a non-empty acceptance statement.`);
  }
}

if (errors.length > 0) {
  console.error('AppDeploy acceptance scenario contract: FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`AppDeploy acceptance scenario contract: PASS (${scenarios.length} definitions; unique names, viewport, coverage, steps and expected outcomes validated).`);
  console.log('This validates scenario definitions only; it does not claim that browser scenarios were executed.');
}
