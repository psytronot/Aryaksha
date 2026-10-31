import * as THREE from 'three';

export function updateFootprint(
  attribute: THREE.BufferAttribute,
  radial: THREE.Vector3,
  radius: number,
  angleDeg: number,
  tangent: THREE.Vector3,
  bitangent: THREE.Vector3,
  unitCircle: Float32Array
) {
  if (unitCircle.length < 4 || unitCircle.length % 2 !== 0) {
    throw new Error('Footprint unit-circle buffer must contain at least two x/y points.');
  }
  const ring = attribute.array as Float32Array;
  const points = unitCircle.length / 2 - 1;
  if (ring.length < (points + 1) * 3) {
    throw new Error('Footprint position buffer is smaller than its unit-circle definition.');
  }
  tangent.set(Math.abs(radial.y) < 0.85 ? 0 : 1, Math.abs(radial.y) < 0.85 ? 1 : 0, 0);
  tangent.addScaledVector(radial, -tangent.dot(radial)).normalize();
  bitangent.crossVectors(radial, tangent).normalize();
  const angular = THREE.MathUtils.degToRad(angleDeg);
  const radialFactor = radius * Math.cos(angular);
  const ringFactor = radius * Math.sin(angular);
  for (let i = 0; i <= points; i += 1) {
    const circleOffset = i * 2;
    const offset = i * 3;
    const tangentFactor = ringFactor * unitCircle[circleOffset];
    const bitangentFactor = ringFactor * unitCircle[circleOffset + 1];
    ring[offset] = radial.x * radialFactor + tangent.x * tangentFactor + bitangent.x * bitangentFactor;
    ring[offset + 1] = radial.y * radialFactor + tangent.y * tangentFactor + bitangent.y * bitangentFactor;
    ring[offset + 2] = radial.z * radialFactor + tangent.z * tangentFactor + bitangent.z * bitangentFactor;
  }
  attribute.needsUpdate = true;
}

export function disposeObjectResources(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
      geometries.add(object.geometry);
      const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
      objectMaterials.forEach(material => materials.add(material));
    }
    if (object instanceof THREE.Sprite) materials.add(object.material);
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
}
