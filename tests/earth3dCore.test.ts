import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  cloudRelativeRotation,
  earthCameraDistance,
  EARTH_CAMERA_MARGIN,
  fitCameraDistance,
  MOON_CAMERA_MARGIN,
  NIGHT_LIGHT_TWILIGHT_END,
  NIGHT_LIGHT_TWILIGHT_START,
  nightLightFactor,
  moonSynchronousYaw,
  moonCameraYaw,
  SYSTEM_CAMERA_MARGIN,
  SYSTEM_DISPLAY_DISTANCE_RATIO
} from '../src/earth3dMath';
import { applyEarthNightLightMask, makeFallbackNightLightsTexture } from '../src/earthVisuals';
import { EARTH_IMAGERY_SOURCES, loadEarthImagery } from '../src/earthImagery';
import { disposeObjectResources, updateFootprint } from '../src/earth3dGeometry';
import { greenwichMeanSiderealAngle, solarEciDirection, solarSubpoint } from '../src/daynight';
import { eciToEcef } from '../src/orbit';

describe('NASA Earth imagery source and fallback behavior', () => {
  it('pins the NASA Blue Marble and Black Marble equirectangular sources with attribution', () => {
    expect(EARTH_IMAGERY_SOURCES.albedo.id).toBe('nasa-blue-marble');
    expect(EARTH_IMAGERY_SOURCES.albedo.url).toContain('world.topo.bathy.200401.3x5400x2700.jpg');
    expect(EARTH_IMAGERY_SOURCES.albedo.credit).toBe('NASA Earth Observatory');
    expect(EARTH_IMAGERY_SOURCES.nightLights.id).toBe('nasa-black-marble');
    expect(EARTH_IMAGERY_SOURCES.nightLights.url).toContain('BlackMarble_2016_01deg.jpg');
    expect(EARTH_IMAGERY_SOURCES.nightLights.credit).toContain('NASA Earth Observatory');
  });

  it('keeps both imagery layers on safe fallbacks when CORS or network requests fail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('CORS blocked')));
    try {
      const result = await loadEarthImagery(new AbortController().signal);
      expect(result.albedo).toBeNull();
      expect(result.nightLights).toBeNull();
      expect(result.failures.albedo).toContain('CORS blocked');
      expect(result.failures.nightLights).toContain('CORS blocked');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('uses a black night-light fallback instead of synthetic city lights', () => {
    const texture = makeFallbackNightLightsTexture();
    expect(Array.from((texture.image as unknown as { data: ArrayLike<number> }).data)).toEqual([0, 0, 0, 255]);
    texture.dispose();
  });
});

describe('Sun direction and Earth-fixed frame coherence', () => {
  it('maps the geocentric Sun vector through GMST to the displayed subsolar point', () => {
    const dates = [
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-03-20T12:00:00.000Z'),
      new Date('2026-06-21T00:00:00.000Z'),
      new Date('2026-09-22T12:00:00.000Z')
    ];
    const northAxis = new THREE.Vector3(0, 1, 0);
    const degrees = 180 / Math.PI;

    for (const date of dates) {
      const sun = solarEciDirection(date);
      const subsolar = solarSubpoint(date);
      const sunMagnitude = Math.hypot(sun.x, sun.y, sun.z);
      expect(sunMagnitude).toBeCloseTo(1, 10);

      // The orbital engine's ECI→ECEF transform must put the same Sun at the
      // longitude/latitude reported by the day/night telemetry.
      const ecef = eciToEcef([sun.x, sun.y, sun.z], date);
      const ecefMagnitude = Math.hypot(ecef[0], ecef[1], ecef[2]);
      const ecefLatitude = Math.asin(ecef[2] / ecefMagnitude) * degrees;
      const ecefLongitude = Math.atan2(ecef[1], ecef[0]) * degrees;
      const longitudeError = ((ecefLongitude - subsolar.lon + 540) % 360) - 180;
      expect(ecefLatitude).toBeCloseTo(subsolar.lat, 6);
      expect(longitudeError).toBeCloseTo(0, 6);

      // Earth-fixed local +X at longitude zero rotates by -GMST in the
      // Three.js Y-up scene. The subsolar surface normal must face the Sun.
      const latitude = subsolar.lat / degrees;
      const longitude = subsolar.lon / degrees;
      const earthFixedNormal = new THREE.Vector3(
        Math.cos(latitude) * Math.cos(longitude),
        Math.sin(latitude),
        Math.cos(latitude) * Math.sin(longitude)
      );
      earthFixedNormal.applyAxisAngle(northAxis, -greenwichMeanSiderealAngle(date));
      const sunSceneDirection = new THREE.Vector3(sun.x, sun.z, sun.y);
      expect(earthFixedNormal.dot(sunSceneDirection)).toBeCloseTo(1, 8);
    }
  });
});

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
    expect(shader.fragmentShader).toContain('float nightLightLuminance = dot(totalEmissiveRadiance, vec3(0.2126, 0.7152, 0.0722));');
    expect(shader.fragmentShader).toContain('float nightLightSignal = smoothstep(0.012, 0.08, nightLightLuminance);');
    expect(shader.fragmentShader).toContain('totalEmissiveRadiance *= nightLightSignal * (1.0 - earthDaylight)');
    expect(material.customProgramCacheKey()).toBe('earth-night-lights-terminator-v3');
    material.dispose();
  });

  it('fits the full Earth disc at desktop and portrait aspect ratios', () => {
    const desktop = earthCameraDistance(1536, 1024);
    const portrait = earthCameraDistance(390, 844);
    expect(desktop).toBeGreaterThan(5.15);
    expect(portrait).toBeGreaterThan(desktop);
    expect(earthCameraDistance(390, 844, 5.15)).toBeCloseTo(fitCameraDistance(390, 844, 5.15, 42, EARTH_CAMERA_MARGIN), 8);
    const verticalFov = 42 * Math.PI / 180;
    const desktopHorizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * (1536 / 1024));
    const portraitHorizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * (390 / 844));
    const desktopFraction = 2 * Math.asin(5.15 / desktop) / Math.min(verticalFov, desktopHorizontalFov);
    const portraitFraction = 2 * Math.asin(5.15 / portrait) / Math.min(verticalFov, portraitHorizontalFov);
    expect(desktopFraction).toBeLessThan(0.8);
    expect(portraitFraction).toBeLessThan(0.8);
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
    const displayMoonDistance = moonDistance * SYSTEM_DISPLAY_DISTANCE_RATIO;
    const desktopSystem = fitCameraDistance(1536, 1024, displayMoonDistance + moonRadius, 42, SYSTEM_CAMERA_MARGIN);
    const portraitSystem = fitCameraDistance(390, 844, displayMoonDistance + moonRadius, 42, SYSTEM_CAMERA_MARGIN);
    expect(SYSTEM_DISPLAY_DISTANCE_RATIO).toBe(0.0225);
    expect(displayMoonDistance).toBeLessThan(moonDistance);
    expect(displayMoonDistance).toBeGreaterThan(earthRadius + moonRadius);
    expect(desktopMoon).toBeGreaterThan(6);
    expect(portraitMoon).toBeGreaterThan(desktopMoon);
    expect(portraitSystem).toBeGreaterThan(portraitMoon);
    expect(portraitSystem).toBeGreaterThan(desktopSystem);
    expect(portraitSystem).toBeLessThan(300);
    const portraitHorizontalFov = 2 * Math.atan(Math.tan(21 * Math.PI / 180) * (390 / 844));
    const portraitLimitingFov = Math.min(42 * Math.PI / 180, portraitHorizontalFov);
    expect(2 * Math.asin(earthRadius / portraitSystem) / portraitLimitingFov).toBeGreaterThan(0.5);
    expect(2 * Math.asin(moonRadius / portraitSystem) / portraitLimitingFov).toBeGreaterThan(0.14);
    expect(2 * Math.asin(earthRadius / portraitSystem)).toBeGreaterThan(0.05);
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


describe('Earth-facing lunar camera', () => {
  it('keeps the camera on the Earth-facing side at multiple lunar orbital phases', () => {
    for (let i = 0; i < 32; i += 1) {
      const phase = i * Math.PI / 16;
      const yaw = moonCameraYaw(phase);
      const cameraDirection = { x: Math.sin(yaw), z: Math.cos(yaw) };
      const earthDirection = { x: -Math.cos(phase), z: -Math.sin(phase) };
      const dot = cameraDirection.x * earthDirection.x + cameraDirection.z * earthDirection.z;
      expect(dot).toBeCloseTo(1, 10);
    }
  });

  it('preserves a user orbit offset around the Earth-facing lunar reference', () => {
    const phase = 1.234;
    expect(moonCameraYaw(phase, 0.4) - moonCameraYaw(phase)).toBeCloseTo(0.4, 10);
  });
});

describe('Earth cloud rotation relative to the rotating Earth frame', () => {
  it('produces a 0.985 world-space rotation rate without double-counting the parent rotation', () => {
    for (const earthRotation of [-6.1, -2.4, -0.2, 0, 1.7, 4.9]) {
      const worldCloudRotation = earthRotation + cloudRelativeRotation(earthRotation);
      expect(worldCloudRotation).toBeCloseTo(earthRotation * 0.985, 10);
    }
  });

  it('returns a finite neutral rotation for invalid inputs', () => {
    expect(cloudRelativeRotation(Number.NaN)).toBe(0);
    expect(cloudRelativeRotation(Number.POSITIVE_INFINITY)).toBe(0);
  });
});


describe('Solar ECI direction reusable output', () => {
  it('writes into a caller-owned vector without replacing its identity', () => {
    const target = { x: 0, y: 0, z: 0 };
    const result = solarEciDirection(new Date('2026-06-21T00:00:00.000Z'), target);
    expect(result).toBe(target);
    expect(Math.hypot(result.x, result.y, result.z)).toBeCloseTo(1, 10);
  });
});
