/**
 * Versioned RPOD engineering-report serialization.
 *
 * Reports are engineering records of the current analytical design state;
 * they are not certified guidance products or flight-safety assessments.
 */
export type RpodEngineeringReport = {
  schema: 'aryaksha.rpod-engineering-report/v1';
  generatedAtUtc: string;
  mission: {
    epochTai: string;
    stateSource: 'manual-lvlh' | 'imported-eme2000';
    importedFrame: 'EME2000' | null;
    importedMissionState?: {
      target: { positionKm: [number, number, number]; velocityKmS: [number, number, number] };
      chaser: { positionKm: [number, number, number]; velocityKmS: [number, number, number] };
    };
  };
  model: {
    name: 'Clohessy-Wiltshire / Hill';
    chiefAltitudeKm: number | null;
    meanMotionRadS: number;
    rendezvousTimeSeconds: number;
    maximumSampledSeparationRatio: number;
    assumptions: string[];
  };
  initialRelativeState: {
    positionKm: [number, number, number];
    velocityKmS: [number, number, number];
  };
  maneuvers: Array<{
    event: 'departure' | 'terminal-velocity-match';
    elapsedSeconds: number;
    deltaVKmS: [number, number, number];
    magnitudeMps: number;
    execution: 'instantaneous-impulse';
  }>;
  deltaVBudgetMps: {
    departure: number;
    terminal: number;
    total: number;
  };
  terminalStateAfterArrivalImpulse: {
    positionKm: [number, number, number];
    velocityKmS: [number, number, number];
  };
  trajectory: Array<{
    elapsedSeconds: number;
    positionKm: [number, number, number];
    velocityKmS: [number, number, number];
  }>;
  keepOutScreen: {
    method: 'sampled-pre-terminal-spherical-range';
    keepOutRadiusKm: number;
    minimumPreTerminalRangeKm: number;
    closestElapsedSeconds: number;
    enteredKeepOut: boolean;
    terminalCoincidenceExcluded: true;
  };
  uncertainty: {
    initialPositionSigmaM: number;
    initialVelocitySigmaMmS: number;
    assumption: 'independent-diagonal-initial-covariance';
    terminalPositionThreeSigmaM: [number, number, number];
    collisionProbabilityComputed: false;
  };
  orekitCrossCheck: {
    performed: boolean;
    epochTai?: string;
    positionKm?: number[];
    velocityKmS?: number[];
    positionDifferenceM?: number | null;
    velocityDifferenceMmS?: number | null;
    history?: Array<{
      elapsedSeconds: number;
      positionKm: number[];
      velocityKmS: number[];
      positionDifferenceM: number | null;
      velocityDifferenceMmS: number | null;
      positionResidualM: number[] | null;
      velocityResidualMmS: number[] | null;
    }>;
  };
  engineeringLimitations: string[];
};

export function serializeRpodEngineeringReport(report: RpodEngineeringReport): string {
  if (report.schema !== 'aryaksha.rpod-engineering-report/v1') {
    throw new Error('Unsupported RPOD engineering report schema.');
  }
  if (!Number.isFinite(Date.parse(report.generatedAtUtc))) {
    throw new Error('Report generation timestamp must be a valid date-time.');
  }
  if (!report.mission.epochTai || !report.model.assumptions.length ||
      !report.engineeringLimitations.length || report.trajectory.length < 2) {
    throw new Error('RPOD engineering report is missing required provenance or model-boundary data.');
  }
  return `${JSON.stringify(report, null, 2)}\n`;
}
