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
  const factor = METRES_PER_UNIT[unit];
  const dimensions = bounds.max.map((value, axis) => (value - bounds.min[axis]) * factor);
  if (dimensions.some(value => value <= 0)) throw new Error('Imported geometry must have non-zero width, height and depth.');
  return {
    width: dimensions[0],
    height: dimensions[1],
    depth: dimensions[2],
    centreM: bounds.min.map((value, axis) => (value + bounds.max[axis]) * 0.5 * factor) as [number, number, number]
  };
}
