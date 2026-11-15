import { describe, expect, it } from 'vitest';
import { parseRpodMissionState } from '../src/rpodMissionState';

const validMission = {
  epochTai: '2026-11-15T12:00:00',
  frame: 'EME2000',
  target: {
    positionKm: [6928.137, 0, 0],
    velocityKmS: [0, 7.585, 0],
  },
  chaser: {
    positionKm: [6928.237, -0.2, 0.05],
    velocityKmS: [0.0001, 7.585, 0],
  },
};

describe('RPOD mission-state import contract', () => {
  it('parses a valid EME2000 target/chaser state with an explicit TAI epoch', () => {
    expect(parseRpodMissionState(JSON.stringify(validMission))).toEqual(validMission);
  });

  it('rejects unsupported frames instead of relabelling inertial coordinates', () => {
    expect(() => parseRpodMissionState(JSON.stringify({ ...validMission, frame: 'GCRF' })))
      .toThrow(/EME2000/);
  });

  it('rejects malformed epochs', () => {
    expect(() => parseRpodMissionState(JSON.stringify({ ...validMission, epochTai: 'not-a-date' })))
      .toThrow(/epochTai/);
  });

  it('rejects calendar dates that JavaScript would otherwise normalize', () => {
    expect(() => parseRpodMissionState(JSON.stringify({
      ...validMission,
      epochTai: '2026-02-30T12:00:00',
    }))).toThrow(/epochTai/);
  });

  it('rejects vectors that do not contain three finite numeric components', () => {
    const malformed = {
      ...validMission,
      target: { ...validMission.target, positionKm: [7000, 0] },
    };
    expect(() => parseRpodMissionState(JSON.stringify(malformed))).toThrow(/three finite/);
  });

  it('rejects states at or below the Earth surface and degenerate target orbit definitions', () => {
    const insideEarth = {
      ...validMission,
      chaser: { ...validMission.chaser, positionKm: [6378, 0, 0] },
    };
    expect(() => parseRpodMissionState(JSON.stringify(insideEarth))).toThrow(/above Earth/);

    const degenerateTarget = {
      ...validMission,
      target: { ...validMission.target, velocityKmS: [1, 0, 0] },
    };
    expect(() => parseRpodMissionState(JSON.stringify(degenerateTarget))).toThrow(/orbital plane/);
  });

  it('rejects unknown fields to keep the import contract explicit', () => {
    expect(() => parseRpodMissionState(JSON.stringify({ ...validMission, surprise: true })))
      .toThrow(/unexpected/);
  });
});
