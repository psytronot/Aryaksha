import { describe, expect, it } from 'vitest';
import { computeCompositeMassProperties } from '../src/engineering/massProperties';

describe('spacecraft composite mass properties', () => {
  it('computes centre of mass and parallel-axis inertia for two point masses', () => {
    const result = computeCompositeMassProperties([
      { id: 'left', massKg: 2, positionM: [-1, 0, 0] },
      { id: 'right', massKg: 2, positionM: [1, 0, 0] }
    ]);
    expect(result.totalMassKg).toBe(4);
    expect(result.centreOfMassM).toEqual([0, 0, 0]);
    expect(result.inertiaKgM2[0][0]).toBeCloseTo(0);
    expect(result.inertiaKgM2[1][1]).toBeCloseTo(4);
    expect(result.inertiaKgM2[2][2]).toBeCloseTo(4);
  });

  it('includes each component intrinsic inertia tensor', () => {
    const result = computeCompositeMassProperties([{
      id: 'bus', massKg: 10, positionM: [0, 0, 0],
      inertiaKgM2: [[1, 0, 0], [0, 2, 0], [0, 0, 3]]
    }]);
    expect(result.inertiaKgM2).toEqual([[1, 0, 0], [0, 2, 0], [0, 0, 3]]);
  });

  it('rejects invalid mass, duplicate IDs, non-finite positions and asymmetric tensors', () => {
    expect(() => computeCompositeMassProperties([{ id: 'bad', massKg: 0, positionM: [0, 0, 0] }])).toThrow(/mass/);
    expect(() => computeCompositeMassProperties([
      { id: 'same', massKg: 1, positionM: [0, 0, 0] },
      { id: 'same', massKg: 1, positionM: [0, 0, 0] }
    ])).toThrow(/unique/);
    expect(() => computeCompositeMassProperties([{ id: 'bad', massKg: 1, positionM: [0, Number.NaN, 0] }])).toThrow(/finite/);
    expect(() => computeCompositeMassProperties([{
      id: 'bad', massKg: 1, positionM: [0, 0, 0],
      inertiaKgM2: [[1, 2, 0], [0, 1, 0], [0, 0, 1]]
    }])).toThrow(/symmetric/);
  });
});
