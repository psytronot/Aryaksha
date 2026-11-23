import { describe, expect, it } from 'vitest';
import { massClosureAnalysis, type Mission, type Payload, type Spacecraft } from '../src/engineering';

const mission = (maxMassKg: number) => ({ maxMassKg } as Mission);
const payload = (massKg: number) => ({ massKg } as Payload);
const spacecraft = (dryMassKg: number, propellantKg: number) => ({ dryMassKg, propellantKg } as Spacecraft);

describe('spacecraft mass closure', () => {
  it('closes dry mass, payload and propellant against the mission launch-mass limit', () => {
    const result = massClosureAnalysis(mission(50), payload(4.2), spacecraft(8, 2));
    expect(result.validInputs).toBe(true);
    expect(result.wetMassKg).toBeCloseTo(14.2, 10);
    expect(result.marginKg).toBeCloseTo(35.8, 10);
    expect(result.usedMassPct).toBeCloseTo(28.4, 10);
    expect(result.passes).toBe(true);
  });

  it('passes exactly at the declared maximum mass and fails above it', () => {
    expect(massClosureAnalysis(mission(14.2), payload(4.2), spacecraft(8, 2)).passes).toBe(true);
    const overloaded = massClosureAnalysis(mission(14), payload(4.2), spacecraft(8, 2));
    expect(overloaded.passes).toBe(false);
    expect(overloaded.marginKg).toBeCloseTo(-0.2, 10);
  });

  it('reports dry, payload and propellant fractions that sum to the wet mass', () => {
    const result = massClosureAnalysis(mission(50), payload(4), spacecraft(10, 6));
    expect(result.dryMassFractionPct + result.payloadMassFractionPct + result.propellantMassFractionPct).toBeCloseTo(100, 10);
  });

  it('fails closed for invalid or non-positive mass limits and negative component masses', () => {
    expect(massClosureAnalysis(mission(0), payload(4), spacecraft(10, 2)).passes).toBe(false);
    expect(massClosureAnalysis(mission(50), payload(-1), spacecraft(10, 2)).validInputs).toBe(false);
    expect(massClosureAnalysis(mission(50), payload(4), spacecraft(10, Number.NaN)).passes).toBe(false);
  });
});
