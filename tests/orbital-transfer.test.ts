import { describe, expect, it } from 'vitest';
import { calculateOrbitalTransfer, EARTH_MU_KM3_S2 } from '../src/aerospace/orbitalTransfer';

const reference = {
  initialAltitudeKm: 400,
  targetAltitudeKm: 800,
  inclinationChangeDeg: 0,
  spacecraftMassKg: 500,
  engineIspS: 320
};

describe('Hohmann orbital transfer design', () => {
  it('calculates the circular orbit reference and transfer ellipse', () => {
    const result = calculateOrbitalTransfer(reference);
    expect(result.transferSemiMajorAxisKm).toBeCloseTo((result.initialRadiusKm + result.targetRadiusKm) / 2, 8);
    expect(result.initialCircularVelocityKmS).toBeCloseTo(Math.sqrt(EARTH_MU_KM3_S2 / result.initialRadiusKm), 8);
    expect(result.totalDeltaVMs).toBeGreaterThan(0);
    expect(result.transferTimeMinutes).toBeGreaterThan(0);
  });

  it('has zero arrival burn for an identical coplanar orbit only when no transfer is required', () => {
    expect(() => calculateOrbitalTransfer({ ...reference, targetAltitudeKm: 400 }))
      .toThrow(/different target orbit/i);
  });

  it('accounts for plane change in the combined arrival manoeuvre', () => {
    const coplanar = calculateOrbitalTransfer(reference);
    const inclined = calculateOrbitalTransfer({ ...reference, inclinationChangeDeg: 10 });
    expect(inclined.arrivalDeltaVMs).toBeGreaterThan(coplanar.arrivalDeltaVMs);
    expect(inclined.totalDeltaVMs).toBeGreaterThan(coplanar.totalDeltaVMs);
  });

  it('estimates propellant using the ideal rocket equation', () => {
    const result = calculateOrbitalTransfer(reference);
    expect(result.propellantMassKg).toBeGreaterThan(0);
    expect(result.massAfterBurnsKg + result.propellantMassKg).toBeCloseTo(reference.spacecraftMassKg, 8);
  });

  it('rejects invalid and non-finite inputs', () => {
    expect(() => calculateOrbitalTransfer({ ...reference, initialAltitudeKm: 80 })).toThrow(/120 km/i);
    expect(() => calculateOrbitalTransfer({ ...reference, spacecraftMassKg: 0 })).toThrow(/mass/i);
    expect(() => calculateOrbitalTransfer({ ...reference, engineIspS: Number.NaN })).toThrow(/finite/i);
    expect(() => calculateOrbitalTransfer({ ...reference, inclinationChangeDeg: 181 })).toThrow(/inclination/i);
  });
});
