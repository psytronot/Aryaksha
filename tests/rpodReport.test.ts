import { describe, expect, it } from 'vitest';
import { serializeRpodEngineeringReport, type RpodEngineeringReport } from '../src/rpodReport';

const report: RpodEngineeringReport = {
  schema: 'aryaksha.rpod-engineering-report/v1',
  generatedAtUtc: '2026-11-15T08:00:00.000Z',
  mission: { epochTai: '2000-01-01T12:00:00', stateSource: 'manual-lvlh', importedFrame: null },
  model: {
    name: 'Clohessy-Wiltshire / Hill', chiefAltitudeKm: 550, meanMotionRadS: 0.001,
    rendezvousTimeSeconds: 1800, assumptions: ['Circular chief orbit', 'Small relative separation'],
  },
  initialRelativeState: { positionKm: [0.1, -0.2, 0.05], velocityKmS: [0.0001, 0.0002, -0.00005] },
  maneuvers: [
    { event: 'departure', elapsedSeconds: 0, deltaVKmS: [0.001, 0, 0], magnitudeMps: 1, execution: 'instantaneous-impulse' },
    { event: 'terminal-velocity-match', elapsedSeconds: 1800, deltaVKmS: [-0.001, 0, 0], magnitudeMps: 1, execution: 'instantaneous-impulse' },
  ],
  deltaVBudgetMps: { departure: 1, terminal: 1, total: 2 },
  terminalStateAfterArrivalImpulse: { positionKm: [0, 0, 0], velocityKmS: [0, 0, 0] },
  trajectory: [
    { elapsedSeconds: 0, positionKm: [0.1, -0.2, 0.05], velocityKmS: [0, 0, 0] },
    { elapsedSeconds: 1800, positionKm: [0, 0, 0], velocityKmS: [0, 0, 0] },
  ],
  keepOutScreen: {
    method: 'sampled-pre-terminal-spherical-range', keepOutRadiusKm: 0.05,
    minimumPreTerminalRangeKm: 0.1, closestElapsedSeconds: 0,
    enteredKeepOut: false, terminalCoincidenceExcluded: true,
  },
  uncertainty: {
    initialPositionSigmaM: 10, initialVelocitySigmaMmS: 1,
    assumption: 'independent-diagonal-initial-covariance',
    terminalPositionThreeSigmaM: [1, 2, 3], collisionProbabilityComputed: false,
  },
  orekitCrossCheck: { performed: false },
  engineeringLimitations: ['Not safe approach or docking guidance.', 'No finite-burn execution.'],
};

describe('RPOD engineering report', () => {
  it('serializes a versioned, traceable report with trajectory and limitations', () => {
    const serialized = serializeRpodEngineeringReport(report);
    const parsed = JSON.parse(serialized) as RpodEngineeringReport;
    expect(parsed.schema).toBe('aryaksha.rpod-engineering-report/v1');
    expect(parsed.trajectory).toHaveLength(2);
    expect(parsed.maneuvers).toHaveLength(2);
    expect(parsed.keepOutScreen.terminalCoincidenceExcluded).toBe(true);
    expect(parsed.uncertainty.collisionProbabilityComputed).toBe(false);
    expect(parsed.engineeringLimitations).toContain('No finite-burn execution.');
    expect(serialized.endsWith('\n')).toBe(true);
  });

  it('preserves imported EME2000 states without mislabelling the manual LVLH design inputs', () => {
    const imported = {
      ...report,
      mission: {
        ...report.mission,
        stateSource: 'manual-lvlh' as const,
        importedFrame: 'EME2000' as const,
        importedMissionState: {
          target: { positionKm: [7000, 0, 0] as [number, number, number], velocityKmS: [0, 7.5, 0] as [number, number, number] },
          chaser: { positionKm: [7000.1, -0.2, 0.05] as [number, number, number], velocityKmS: [0.0001, 7.5001, 0] as [number, number, number] },
        },
      },
    };
    const parsed = JSON.parse(serializeRpodEngineeringReport(imported));
    expect(parsed.mission.stateSource).toBe('manual-lvlh');
    expect(parsed.mission.importedFrame).toBe('EME2000');
    expect(parsed.mission.importedMissionState.target.positionKm).toEqual([7000, 0, 0]);
  });

  it('preserves signed Orekit-versus-HCW residual time series and component units', () => {
    const withResiduals = {
      ...report,
      orekitCrossCheck: {
        performed: true,
        epochTai: '2026-11-15T12:15:00',
        positionDifferenceM: 2.5,
        velocityDifferenceMmS: 0.4,
        history: [{
          elapsedSeconds: 0,
          positionKm: [0.1, -0.2, 0.05],
          velocityKmS: [0.0001, 0.0002, -0.00005],
          positionDifferenceM: 2.5,
          velocityDifferenceMmS: 0.4,
          positionResidualM: [1.5, -1.2, 1.6],
          velocityResidualMmS: [0.2, -0.1, 0.34],
        }],
      },
    };
    const parsed = JSON.parse(serializeRpodEngineeringReport(withResiduals));
    expect(parsed.orekitCrossCheck.history[0].positionResidualM).toEqual([1.5, -1.2, 1.6]);
    expect(parsed.orekitCrossCheck.history[0].velocityResidualMmS).toEqual([0.2, -0.1, 0.34]);
  });

  it('rejects missing provenance, model limitations, or trajectory history', () => {
    expect(() => serializeRpodEngineeringReport({ ...report, mission: { ...report.mission, epochTai: '' } })).toThrow(/provenance/);
    expect(() => serializeRpodEngineeringReport({ ...report, engineeringLimitations: [] })).toThrow(/provenance/);
    expect(() => serializeRpodEngineeringReport({ ...report, trajectory: [] })).toThrow(/provenance/);
  });
});
