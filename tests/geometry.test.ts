import { describe, expect, it } from 'vitest';
import { boundsToMetres } from '../src/engineering/geometry';

describe('spacecraft mesh geometry unit conversion', () => {
  it('converts millimetre bounds and centre to SI metres', () => {
    expect(boundsToMetres({ min: [-500, -250, -100], max: [500, 250, 100] }, 'mm')).toEqual({
      width: 1, height: 0.5, depth: 0.2, centreM: [0, 0, 0]
    });
  });

  it('converts inch bounds and non-origin centre to metres', () => {
    const result = boundsToMetres({ min: [10, 20, 30], max: [12, 24, 36] }, 'in');
    expect(result.width).toBeCloseTo(0.0508);
    expect(result.height).toBeCloseTo(0.1016);
    expect(result.depth).toBeCloseTo(0.1524);
    expect(result.centreM[0]).toBeCloseTo(0.2794);
  });

  it('rejects non-finite, inverted and zero-thickness bounds', () => {
    expect(() => boundsToMetres({ min: [0, 0, 0], max: [1, Number.NaN, 1] }, 'm')).toThrow(/finite/);
    expect(() => boundsToMetres({ min: [2, 0, 0], max: [1, 1, 1] }, 'm')).toThrow(/maximum/);
    expect(() => boundsToMetres({ min: [0, 0, 0], max: [1, 1, 0] }, 'm')).toThrow(/non-zero/);
  });

  it('rejects unsupported runtime units and numeric overflow', () => {
    expect(() => boundsToMetres(
      { min: [0, 0, 0], max: [1, 1, 1] },
      'ft' as never
    )).toThrow(/Geometry unit must be one of/);
    expect(() => boundsToMetres(
      { min: [-Number.MAX_VALUE, 0, 0], max: [Number.MAX_VALUE, 1, 1] },
      'm'
    )).toThrow(/outside the supported numeric range/);
  });

});
