import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { disposeObjectResources, updateFootprint } from '../src/Earth3DScene';

describe('Earth 3D resource disposal', () => {
  it('disposes shared geometry and materials once, including sprite materials', () => {
    const root = new THREE.Group();
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial();
    const spriteMaterial = new THREE.SpriteMaterial();
    root.add(new THREE.Mesh(geometry, material));
    root.add(new THREE.Mesh(geometry, material));
    root.add(new THREE.Sprite(spriteMaterial));

    const geometryDispose = vi.spyOn(geometry, 'dispose');
    const materialDispose = vi.spyOn(material, 'dispose');
    const spriteDispose = vi.spyOn(spriteMaterial, 'dispose');

    disposeObjectResources(root);

    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(spriteDispose).toHaveBeenCalledTimes(1);
  });
});


describe('Earth 3D dynamic footprint buffer', () => {
  it('reuses one BufferAttribute and backing array across updates', () => {
    const segments = 64;
    const positions = new Float32Array((segments + 1) * 3);
    const attribute = new THREE.BufferAttribute(positions, 3);
    const unitCircle = new Float32Array((segments + 1) * 2);
    for (let i = 0; i <= segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      unitCircle[i * 2] = Math.cos(angle);
      unitCircle[i * 2 + 1] = Math.sin(angle);
    }
    const tangent = new THREE.Vector3();
    const bitangent = new THREE.Vector3();
    const firstRadial = new THREE.Vector3(1, 0, 0);
    const secondRadial = new THREE.Vector3(0, 1, 0);

    updateFootprint(attribute, firstRadial, 5.2, 0.52, tangent, bitangent, unitCircle);
    const originalArray = attribute.array;
    const originalVersion = attribute.version;
    const firstPoint = Array.from(positions.slice(0, 3));

    updateFootprint(attribute, secondRadial, 5.2, 0.52, tangent, bitangent, unitCircle);

    expect(attribute.array).toBe(originalArray);
    expect(attribute.version).toBeGreaterThan(originalVersion);
    expect(Array.from(positions.slice(0, 3))).not.toEqual(firstPoint);
    expect(Array.from(positions.slice(0, 3))).toEqual(Array.from(positions.slice(-3)));
    expect(Array.from(positions).every(Number.isFinite)).toBe(true);
  });
});
