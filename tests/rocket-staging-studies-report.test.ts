import { describe, expect, it } from 'vitest';
import { calculateRocketVehicle } from '../src/aerospace/rocketStagingModel';
import { optimiseMaximumDeltaV } from '../src/aerospace/rocketStagingOptimiser';
import { runRocketStagingSensitivityStudy } from '../src/aerospace/rocketStagingStudies';
import { buildRocketStagingMarkdownReport } from '../src/aerospace/rocketStagingReport';

const configuration = {
  payloadMassKg: 400,
  stages: [
    { name: 'Stage 1', propellantMassKg: 3000, specificImpulseS: 280, structuralFraction: 0.08 },
    { name: 'Stage 2', propellantMassKg: 900, specificImpulseS: 340, structuralFraction: 0.1 }
  ]
};

describe('rocket staging sensitivity studies', () => {
  it('creates deterministic samples without mutating the baseline', () => {
    const before = JSON.stringify(configuration);
    const study = runRocketStagingSensitivityStudy(configuration, {
      kind: 'stage-isp', stageIndex: 0, minimum: 250, maximum: 310
    }, 5, undefined, { initialGridDivisions: 6, maxEvaluations: 2000 });
    expect(study.samples).toHaveLength(5);
    expect(study.samples.map(sample => sample.inputValue)).toEqual([250, 265, 280, 295, 310]);
    expect(JSON.stringify(configuration)).toBe(before);
    expect(study.samples.every(sample => sample.status !== undefined)).toBe(true);
  });

  it('reports invalid samples rather than hiding invalid parameter ranges', () => {
    const study = runRocketStagingSensitivityStudy(configuration, {
      kind: 'structural-fraction', stageIndex: 0, minimum: 0.1, maximum: 0.6
    }, 3, undefined, { initialGridDivisions: 4, maxEvaluations: 500 });
    expect(study.samples.some(sample => sample.status === 'invalid')).toBe(true);
    expect(() => runRocketStagingSensitivityStudy(configuration, {
      kind: 'payload-mass', minimum: 100, maximum: 50
    })).toThrow(/range/);
  });
});

describe('rocket staging Markdown report', () => {
  it('includes inputs, stage mass accounting, solver evidence, equations and limitations', () => {
    const result = optimiseMaximumDeltaV(configuration, { initialGridDivisions: 6, maxEvaluations: 2000 });
    const study = runRocketStagingSensitivityStudy(configuration, {
      kind: 'stage-isp', stageIndex: 0, minimum: 260, maximum: 300
    }, 3, undefined, { initialGridDivisions: 4, maxEvaluations: 500 });
    const report = buildRocketStagingMarkdownReport(result, configuration, [study]);
    expect(report).toContain('Solver status');
    expect(report).toContain('Evaluations');
    expect(report).toContain('Payload mass');
    expect(report).toContain('Ignition (kg)');
    expect(report).toContain('9.80665 m/s²');
    expect(report).toContain('not a mathematical proof');
    expect(report).toContain('not a trajectory prediction');
    expect(report).toContain('stage-isp');
  });

  it('keeps mass closure consistent with the physical model', () => {
    const vehicle = calculateRocketVehicle(configuration);
    expect(vehicle.massClosureErrorKg).toBeCloseTo(0, 8);
  });
});
