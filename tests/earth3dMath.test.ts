import { describe, expect, it } from 'vitest';
import {
  PLANETARY_BODY_SPECS,
  fitCameraDistance,
  MOON_CAMERA_MARGIN,
  moonSynchronousYaw,
  nightLightFactor,
  planetaryPositionAt
} from '../src/earth3dMath';

describe('Earth 3D mission-control math', () => {
  it('preserves night lights on the dark hemisphere and masks them on the day side', () => {
    expect(nightLightFactor(-1)).toBeCloseTo(1, 8);
    expect(nightLightFactor(-0.03)).toBeCloseTo(0.5, 8);
    expect(nightLightFactor(1)).toBeCloseTo(0, 8);
  });

  it('defines all eight planets plus the Sun for the schematic selector', () => {
    expect(PLANETARY_BODY_SPECS.map(body => body.name)).toEqual([
      'Sun', 'Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'
    ]);
    expect(PLANETARY_BODY_SPECS.find(body => body.name === 'Saturn')?.ringed).toBe(true);
  });

  it('keeps schematic planet positions deterministic and on the x-z orbit plane', () => {
    for (const body of PLANETARY_BODY_SPECS.filter(body => body.name !== 'Sun')) {
      const first = planetaryPositionAt(body.name, 123456);
      const second = planetaryPositionAt(body.name, 123456);
      expect(first).toEqual(second);
      expect(first.y).toBe(0);
      expect(Math.hypot(first.x, first.z)).toBeCloseTo(body.orbitRadius, 8);
    }
  });

  it('keeps the same lunar hemisphere Earth-facing through a full orbit', () => {
    for (let i = 0; i < 16; i += 1) {
      const phase = i * Math.PI / 8;
      const yaw = moonSynchronousYaw(phase);
      const facing = { x: Math.sin(yaw), z: Math.cos(yaw) };
      const earthDirection = { x: -Math.cos(phase), z: -Math.sin(phase) };
      expect(facing.x * earthDirection.x + facing.z * earthDirection.z).toBeCloseTo(1, 8);
    }
  });

  it('fits larger and narrower viewports without returning invalid distances', () => {
    const desktop = fitCameraDistance(1536, 1024, 310);
    const portrait = fitCameraDistance(390, 844, 310);
    const wideExtent = fitCameraDistance(1536, 1024, 520);
    expect(desktop).toBeGreaterThan(0);
    expect(portrait).toBeGreaterThan(desktop);
    expect(wideExtent).toBeGreaterThan(desktop);
  });
});


describe('Moon camera framing', () => {
  it('fits the lunar disc on desktop and portrait viewports', () => {
    const moonRadius = 5.15 * (1737.4 / 6378.137);
    const desktop = fitCameraDistance(1536, 1024, moonRadius, 42, MOON_CAMERA_MARGIN);
    const portrait = fitCameraDistance(390, 844, moonRadius, 42, MOON_CAMERA_MARGIN);
    const desktopFov = 42 * Math.PI / 180;
    const portraitFov = 2 * Math.atan(Math.tan(desktopFov / 2) * (390 / 844));
    const desktopAngularDiameter = 2 * Math.asin(moonRadius / desktop);
    const portraitAngularDiameter = 2 * Math.asin(moonRadius / portrait);
    expect(desktop).toBeGreaterThan(6);
    expect(portrait).toBeGreaterThan(desktop);
    expect(desktopAngularDiameter / desktopFov).toBeLessThanOrEqual(0.6);
    expect(portraitAngularDiameter / portraitFov).toBeLessThanOrEqual(0.6);
  });
});
