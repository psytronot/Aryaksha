import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  fitCameraDistance,
  MOON_CAMERA_MARGIN,
  NIGHT_LIGHT_TWILIGHT_END,
  NIGHT_LIGHT_TWILIGHT_START,
  nightLightFactor,
  moonSynchronousYaw,
  SYSTEM_CAMERA_MARGIN
} from '../src/earth3dMath';
import { applyEarthNightLightMask } from '../src/earthVisuals';
import { disposeObjectResources, updateFootprint } from '../src/earth3dGeometry';

describe('Earth 3D lighting, camera and lunar geometry', () => {
  it('masks city lights on the day side and preserves them on the night side', () => {
    expect(nightLightFactor(-1)).toBeCloseTo(1, 8);
    expect(nightLightFactor((NIGHT_LIGHT_TWILIGHT_START + NIGHT_LIGHT_TWILIGHT_END) / 2)).toBeCloseTo(0.5, 8);
    expect(nightLightFactor(1)).toBeCloseTo(0, 8);
  });

  it('injects a world-space Sun direction into the Earth emissive shader', () => {
    const material = new THREE.MeshPhongMaterial();
    const sunUniform = { value: new THREE.Vector3(1, 0, 0) };
    applyEarthNightLightMask(material, sunUniform);
    const newline = String.fromCharCode(10);
    const shader: any = {
      uniforms: {},
      vertexShader: ['#include <common>', 'void main() {', '#include <beginnormal_vertex>', '}'].join(newline),
      fragmentShader: ['#include <common>', 'void main() {', '#include <emissivemap_fragment>', '}'].join(newline)
    };
    const compile = material.onBeforeCompile as unknown as (shader: any, renderer: any) => void;
    compile(shader, {});
    expect(shader.uniforms.uEarthSunDirection).toBe(sunUniform);
    expect(shader.vertexShader).toContain(newline + 'vEarthWorldNormal');
    expect(shader.vertexShader).not.toContain(String.fromCharCode(92) + 'n');
    expect(shader.fragmentShader).not.toContain(String.fromCharCode(92) + 'n');
    expect(shader.fragmentShader).toContain('uniform vec3 uEarthSunDirection');
    expect(shader.fragmentShader).toContain('smoothstep(' + NIGHT_LIGHT_TWILIGHT_START.toFixed(2) + ', ' + NIGHT_LIGHT_TWILIGHT_END.toFixed(2));
    expect(shader.fragmentShader).toContain('totalEmissiveRadiance *= (1.0 - earthDaylight)');
    expect(material.customProgramCacheKey()).toBe('earth-night-lights-terminator-v2');
    material.dispose();
  });

  it('keeps the same lunar hemisphere facing Earth over a full orbit', () => {
    for (let i = 0; i < 16; i += 1) {
      const phase = i * Math.PI / 8;
      const yaw = moonSynchronousYaw(phase);
      const facing = { x: Math.sin(yaw), z: Math.cos(yaw) };
      const earthDirection = { x: -Math.cos(phase), z: -Math.sin(phase) };
      expect(facing.x * earthDirection.x + facing.z * earthDirection.z).toBeCloseTo(1, 8);
    }
  });

  it('fits the Moon and Earth-Moon system as bounding spheres on desktop and portrait viewports', () => {
    const earthRadius = 5.15;
    const moonRadius = earthRadius * (1737.4 / 6378.137);
    const moonDistance = earthRadius * (384400 / 6378.137);
    const desktopMoon = fitCameraDistance(1536, 1024, moonRadius, 42, MOON_CAMERA_MARGIN);
    const portraitMoon = fitCameraDistance(390, 844, moonRadius, 42, MOON_CAMERA_MARGIN);
    const desktopSystem = fitCameraDistance(1536, 1024, moonDistance + moonRadius, 42, SYSTEM_CAMERA_MARGIN);
    const portraitSystem = fitCameraDistance(390, 844, moonDistance + moonRadius, 42, SYSTEM_CAMERA_MARGIN);
    expect(desktopMoon).toBeGreaterThan(6);
    expect(portraitMoon).toBeGreaterThan(desktopMoon);
    expect(portraitSystem).toBeGreaterThan(desktopSystem);
    expect(portraitSystem).toBeLessThan(2600);
    expect(2 * Math.asin(moonRadius / portraitMoon) / (2 * Math.atan(Math.tan(21 * Math.PI / 180) * (390 / 844)))).toBeLessThanOrEqual(0.6);
  });
});

describe('Earth 3D reusable geometry and disposal', () => {
  it('reuses one footprint BufferAttribute and backing array across updates', () => {
    const segments = 64;
    const positions = new Float32Array((segments + 1) * 3);
    const attribute = new THREE.BufferAttribute(positions, 3);
    const unitCircle = new Float32Array((segments + 1) * 2);
    for (let i = 0; i < segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      unitCircle[i * 2] = Math.cos(angle);
      unitCircle[i * 2 + 1] = Math.sin(angle);
    }
    unitCircle[segments * 2] = unitCircle[0];
    unitCircle[segments * 2 + 1] = unitCircle[1];
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
