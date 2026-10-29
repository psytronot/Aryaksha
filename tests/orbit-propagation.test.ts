import { describe, expect, test } from 'vitest';
import {
  EARTH_RADIUS,
  MU,
  propagate,
  propagateState,
  type Elements,
} from '../src/orbit';

const leoOrbit: Elements = {
  a: EARTH_RADIUS + 550,
  e: 0.001,
  i: 97.6,
  raan: 0,
  argp: 0,
  nu: 0,
};

describe('two-body Kepler propagation', () => {
  test('advances true anomaly and position with elapsed time', () => {
    const next = propagate(leoOrbit, 20);
    const initialState = propagateState(leoOrbit, 0);
    const laterState = propagateState(leoOrbit, 20);
    const displacementKm = Math.hypot(
      laterState.r[0] - initialState.r[0],
      laterState.r[1] - initialState.r[1],
      laterState.r[2] - initialState.r[2],
    );

    expect(next.nu).toBeGreaterThan(1);
    expect(next.nu).toBeLessThan(1.5);
    expect(displacementKm).toBeGreaterThan(100);
  });

  test('preserves orbital radius to the expected eccentric two-body tolerance', () => {
    const initial = propagateState(leoOrbit, 0);
    const later = propagateState(leoOrbit, 20);
    const initialRadiusKm = Math.hypot(...initial.r);
    const laterRadiusKm = Math.hypot(...later.r);

    expect(Math.abs(laterRadiusKm - initialRadiusKm)).toBeLessThan(0.1);
  });

  test('returns to the initial anomaly after one orbital period', () => {
    const periodSeconds = 2 * Math.PI * Math.sqrt(leoOrbit.a ** 3 / MU);
    expect(propagate(leoOrbit, periodSeconds).nu).toBeCloseTo(leoOrbit.nu, 4);
  });
});
