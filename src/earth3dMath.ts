export const EARTH_3D_FOV_DEGREES = 42;
export const MOON_CAMERA_MARGIN = 1.7;
// SphereGeometry's 0° texture meridian is local +X; rotate it onto the Earth-facing +Z axis.
export const MOON_TEXTURE_CENTER_ROTATION_RAD = -Math.PI / 2;
export const SYSTEM_CAMERA_MARGIN = 1.08;
export const EARTH_CAMERA_MARGIN = 1.35;
// In SYSTEM view, compress only the displayed Earth-Moon centre separation.
// Physical radii and the authoritative 384,400 km reference remain unchanged.
export const SYSTEM_DISPLAY_DISTANCE_RATIO = 0.0225;
export const NIGHT_LIGHT_TWILIGHT_START = -0.18;
export const NIGHT_LIGHT_TWILIGHT_END = 0.12;
export const MOON_ORBIT_PERIOD_SECONDS = 27.321661 * 86400;

export function fitCameraDistance(
  width: number,
  height: number,
  extent: number,
  fovDegrees = EARTH_3D_FOV_DEGREES,
  margin = 1.08
): number {
  const safeWidth = Math.max(1, Number.isFinite(width) ? width : 1);
  const safeHeight = Math.max(1, Number.isFinite(height) ? height : 1);
  const safeExtent = Math.max(0.1, Number.isFinite(extent) ? extent : 0.1);
  const safeFov = Math.max(1, Math.min(179, Number.isFinite(fovDegrees) ? fovDegrees : EARTH_3D_FOV_DEGREES));
  const safeMargin = Math.max(1, Number.isFinite(margin) ? margin : 1);
  const verticalFov = safeFov * Math.PI / 180;
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * (safeWidth / safeHeight));
  const limitingFov = Math.min(verticalFov, horizontalFov);
  // Fit the bounding sphere, not a flat plane: the sphere's angular radius is asin(r / d).
  return (safeExtent * safeMargin) / Math.sin(limitingFov / 2);
}

export function earthCameraDistance(width: number, height: number, earthRadius = 5.15): number {
  return fitCameraDistance(width, height, earthRadius, EARTH_3D_FOV_DEGREES, EARTH_CAMERA_MARGIN);
}

export function cloudRelativeRotation(earthRotation: number): number {
  if (!Number.isFinite(earthRotation) || earthRotation === 0) return 0;
  // Clouds are children of the rotating Earth group. Apply only the -1.5%
  // relative drift so the world-space rate is 98.5%, not 198.5%.
  return earthRotation * -0.015;
}

export function moonSynchronousYaw(phase: number): number {
  const safePhase = Number.isFinite(phase) ? phase : 0;
  // After the Moon geometry's -90° texture-centre rotation, local +Z points from the Moon back toward Earth.
  return -safePhase - Math.PI / 2;
}

export function moonCameraYaw(phase: number, yawOffset = 0): number {
  const safeOffset = Number.isFinite(yawOffset) ? yawOffset : 0;
  return moonSynchronousYaw(phase) + safeOffset;
}

export function nightLightFactor(normalDotSun: number): number {
  if (!Number.isFinite(normalDotSun)) return 1;
  const t = Math.max(0, Math.min(1,
    (normalDotSun - NIGHT_LIGHT_TWILIGHT_START) /
    (NIGHT_LIGHT_TWILIGHT_END - NIGHT_LIGHT_TWILIGHT_START)
  ));
  return 1 - t * t * (3 - 2 * t);
}


export type PlanetaryBodyName = 'Sun' | 'Mercury' | 'Venus' | 'Earth' | 'Mars' | 'Jupiter' | 'Saturn' | 'Uranus' | 'Neptune';

export type PlanetaryBodySpec = {
  name: PlanetaryBodyName;
  orbitRadius: number;
  radius: number;
  orbitalPeriodDays: number;
  phaseOffsetRad: number;
  color: number;
  ringed?: boolean;
};

// Readable schematic geometry only. These radii, orbit sizes and phase offsets
// are deliberately compressed/exaggerated; they are not physical scale or an ephemeris.
// The detailed Earth–Moon scene retains its own independent physical ratios.
export const PLANETARY_BODY_SPECS: readonly PlanetaryBodySpec[] = [
  { name: 'Sun', orbitRadius: 0, radius: 2.5, orbitalPeriodDays: 1, phaseOffsetRad: 0, color: 0xffc766 },
  { name: 'Mercury', orbitRadius: 4.8, radius: 0.32, orbitalPeriodDays: 87.969, phaseOffsetRad: 0.3, color: 0x9b9a97 },
  { name: 'Venus', orbitRadius: 7.2, radius: 0.52, orbitalPeriodDays: 224.701, phaseOffsetRad: 2.1, color: 0xd6b17a },
  { name: 'Earth', orbitRadius: 10, radius: 0.58, orbitalPeriodDays: 365.256, phaseOffsetRad: 4.2, color: 0x4b9fe8 },
  { name: 'Mars', orbitRadius: 15, radius: 0.42, orbitalPeriodDays: 686.98, phaseOffsetRad: 1.2, color: 0xc96f52 },
  { name: 'Jupiter', orbitRadius: 24, radius: 1.22, orbitalPeriodDays: 4332.59, phaseOffsetRad: 5.1, color: 0xd4b28b },
  { name: 'Saturn', orbitRadius: 33, radius: 1.02, orbitalPeriodDays: 10759.2, phaseOffsetRad: 2.8, color: 0xd8c69b, ringed: true },
  { name: 'Uranus', orbitRadius: 42, radius: 0.78, orbitalPeriodDays: 30688.5, phaseOffsetRad: 0.8, color: 0x8ed9df },
  { name: 'Neptune', orbitRadius: 52, radius: 0.76, orbitalPeriodDays: 60182, phaseOffsetRad: 3.7, color: 0x4d75e8 }
] as const;

export function planetaryPositionAt(name: PlanetaryBodyName, elapsedSeconds: number) {
  const body = PLANETARY_BODY_SPECS.find(item => item.name === name);
  if (!body || body.name === 'Sun') return { x: 0, y: 0, z: 0 };
  const safeSeconds = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
  const phase = body.phaseOffsetRad + (safeSeconds / (body.orbitalPeriodDays * 86400)) * Math.PI * 2;
  return { x: Math.cos(phase) * body.orbitRadius, y: 0, z: Math.sin(phase) * body.orbitRadius };
}
