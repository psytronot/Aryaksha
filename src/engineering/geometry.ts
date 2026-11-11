export type GeometryUnit = 'm' | 'cm' | 'mm' | 'in';

export interface GeometryBounds {
  min: readonly [number, number, number];
  max: readonly [number, number, number];
}

export interface GeometryDimensionsM {
  width: number;
  height: number;
  depth: number;
  centreM: readonly [number, number, number];
}

const METRES_PER_UNIT: Record<GeometryUnit, number> = {
  m: 1,
  cm: 0.01,
  mm: 0.001,
  in: 0.0254
};

/** Convert a validated axis-aligned mesh bounding box to metres. */
export function boundsToMetres(bounds: GeometryBounds, unit: GeometryUnit): GeometryDimensionsM {
  const values = [...bounds.min, ...bounds.max];
  if (!values.every(Number.isFinite)) throw new Error('Geometry bounds must contain only finite coordinates.');
  for (let axis = 0; axis < 3; axis += 1) {
    if (bounds.max[axis] < bounds.min[axis]) throw new Error('Geometry maximum bounds must not be smaller than minimum bounds.');
  }
  if (!Object.prototype.hasOwnProperty.call(METRES_PER_UNIT, unit)) {
    throw new Error('Geometry unit must be one of m, cm, mm or in.');
  }
  const factor = METRES_PER_UNIT[unit];
  const dimensions = bounds.max.map((value, axis) => (value - bounds.min[axis]) * factor);
  const centreM = bounds.min.map((value, axis) => (value * 0.5 + bounds.max[axis] * 0.5) * factor) as [number, number, number];
  if (![...dimensions, ...centreM].every(Number.isFinite)) {
    throw new Error('Converted geometry is outside the supported numeric range.');
  }
  if (dimensions.some(value => value <= 0)) throw new Error('Imported geometry must have non-zero width, height and depth.');
  return {
    width: dimensions[0],
    height: dimensions[1],
    depth: dimensions[2],
    centreM
  };
}
