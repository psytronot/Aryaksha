export type Vector3 = readonly [number, number, number];
export type InertiaTensor = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number]
];

export interface MassComponent {
  id: string;
  massKg: number;
  positionM: Vector3;
  /** Inertia about this component's own centre of mass, expressed in the spacecraft body frame. */
  inertiaKgM2?: InertiaTensor;
}

export interface CompositeMassProperties {
  totalMassKg: number;
  centreOfMassM: Vector3;
  /** Inertia tensor about the composite centre of mass, expressed in the body frame. */
  inertiaKgM2: InertiaTensor;
}

const ZERO_TENSOR: InertiaTensor = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];

function finiteVector(value: Vector3): boolean {
  return value.length === 3 && value.every(Number.isFinite);
}

function validateTensor(tensor: InertiaTensor, id: string): void {
  if (tensor.length !== 3 || tensor.some(row => row.length !== 3 || !row.every(Number.isFinite))) {
    throw new Error(`Component ${id} has a non-finite or malformed inertia tensor.`);
  }
  const scale = Math.max(1, ...tensor.flat().map(Math.abs));
  for (let i = 0; i < 3; i += 1) {
    if (tensor[i][i] < 0) throw new Error(`Component ${id} has a negative principal diagonal inertia.`);
    for (let j = i + 1; j < 3; j += 1) {
      if (Math.abs(tensor[i][j] - tensor[j][i]) > 1e-10 * scale) {
        throw new Error(`Component ${id} inertia tensor must be symmetric.`);
      }
    }
  }
}

/** Combines component mass properties using the parallel-axis theorem.
 * All positions are metres from one shared spacecraft body-frame origin;
 * all masses are kilograms and inertias are kg·m².
 */
export function computeCompositeMassProperties(components: readonly MassComponent[]): CompositeMassProperties {
  if (components.length === 0) throw new Error('At least one mass component is required.');
  const ids = new Set<string>();
  let totalMassKg = 0;
  const weighted = [0, 0, 0];

  for (const component of components) {
    if (!component.id.trim() || ids.has(component.id)) throw new Error('Component IDs must be non-empty and unique.');
    ids.add(component.id);
    if (!Number.isFinite(component.massKg) || component.massKg <= 0) {
      throw new Error(`Component ${component.id} mass must be finite and greater than zero.`);
    }
    if (!finiteVector(component.positionM)) throw new Error(`Component ${component.id} position must contain three finite metre values.`);
    const tensor = component.inertiaKgM2 ?? ZERO_TENSOR;
    validateTensor(tensor, component.id);
    totalMassKg += component.massKg;
    for (let axis = 0; axis < 3; axis += 1) weighted[axis] += component.massKg * component.positionM[axis];
  }

  const centre = weighted.map(value => value / totalMassKg) as [number, number, number];
  const inertia = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];

  for (const component of components) {
    const own = component.inertiaKgM2 ?? ZERO_TENSOR;
    const d = component.positionM.map((value, axis) => value - centre[axis]);
    const d2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        const parallelAxis = component.massKg * ((row === column ? d2 : 0) - d[row] * d[column]);
        inertia[row][column] += own[row][column] + parallelAxis;
      }
    }
  }

  return {
    totalMassKg,
    centreOfMassM: centre,
    inertiaKgM2: inertia as unknown as InertiaTensor
  };
}
