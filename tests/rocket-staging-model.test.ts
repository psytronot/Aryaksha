import { describe, expect, it } from 'vitest';
import {
  calculateRocketVehicle,
  type RocketVehicleConfiguration
} from '../src/aerospace/rocketStagingModel';

const twoStage: RocketVehicleConfiguration = {
  payloadMassKg: 1000,
  stages: [
    { name: 'Stage 1', propellantMassKg: 5000, specificImpulseS: 280, structuralFraction: 0.08 },
    { name: 'Stage 2', propellantMassKg: 1500, specificImpulseS: 340, structuralFraction: 0.1 }
  ]
};

describe('generalised rocket staging mass model', () => {
  it('closes the full initial mass budget for two, three and four stages', () => {
    for (const count of [2, 3, 4]) {
      const configuration: RocketVehicleConfiguration = {
        payloadMassKg: 1000,
        stages: Array.from({ length: count }, (_, index) => ({
          name: `Stage ${index + 1}`,
          propellantMassKg: 5000 / (index + 1),
          specificImpulseS: 270 + index * 20,
          structuralFraction: 0.07 + index * 0.01
        }))
      };
      const result = calculateRocketVehicle(configuration);
      const accounted = result.payloadMassKg +
        result.stages.reduce((sum, stage) => sum + stage.propellantMassKg + stage.inertMassKg, 0);
      expect(result.initialMassKg).toBeCloseTo(accounted, 8);
      expect(result.massClosureErrorKg).toBeCloseTo(0, 8);
      expect(result.stages).toHaveLength(count);
    }
  });

  it('keeps each stage inert mass attached through its burn and discards it before the next stage ignition', () => {
    const result = calculateRocketVehicle(twoStage);
    const [first, second] = result.stages;
    expect(first.ignitionMassKg).toBeCloseTo(result.initialMassKg, 8);
    expect(first.burnoutMassKg).toBeCloseTo(first.ignitionMassKg - first.propellantMassKg, 8);
    expect(first.separationMassKg).toBeCloseTo(first.burnoutMassKg - first.inertMassKg, 8);
    expect(second.ignitionMassKg).toBeCloseTo(first.separationMassKg, 8);
    expect(second.finalMassKg).toBeCloseTo(twoStage.payloadMassKg + second.inertMassKg, 8);
  });

  it('calculates stage delta-v using the ideal rocket equation and standard gravity', () => {
    const result = calculateRocketVehicle(twoStage);
    for (const stage of result.stages) {
      expect(stage.deltaVMs).toBeCloseTo(
        stage.specificImpulseS * 9.80665 * Math.log(stage.ignitionMassKg / stage.burnoutMassKg),
        8
      );
    }
    expect(result.totalDeltaVMs).toBeCloseTo(result.stages.reduce((sum, stage) => sum + stage.deltaVMs, 0), 8);
  });

  it('rejects unsupported stage counts and physically invalid stage inputs', () => {
    expect(() => calculateRocketVehicle({ payloadMassKg: 100, stages: [] })).toThrow(/2 and 4 stages/);
    expect(() => calculateRocketVehicle({ payloadMassKg: 100, stages: [twoStage.stages[0]] })).toThrow(/2 and 4 stages/);
    expect(() => calculateRocketVehicle({ ...twoStage, stages: [...twoStage.stages, ...twoStage.stages, ...twoStage.stages] })).toThrow(/2 and 4 stages/);
    expect(() => calculateRocketVehicle({ ...twoStage, payloadMassKg: Number.NaN })).toThrow(/finite/);
    expect(() => calculateRocketVehicle({ ...twoStage, stages: twoStage.stages.map(stage => ({ ...stage, specificImpulseS: 0 })) })).toThrow(/specific impulse/);
    expect(() => calculateRocketVehicle({ ...twoStage, stages: twoStage.stages.map(stage => ({ ...stage, structuralFraction: 0.5 })) })).toThrow(/structural fraction/);
    expect(() => calculateRocketVehicle({ ...twoStage, stages: twoStage.stages.map(stage => ({ ...stage, propellantMassKg: -1 })) })).toThrow(/propellant mass/);
  });
});
