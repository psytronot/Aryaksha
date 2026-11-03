export const EARTH_3D_FOV_DEGREES = 42;
export const MOON_CAMERA_MARGIN = 1.7;
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
  // Three.js local +Z points from the Moon back toward Earth in the x-z orbital plane.
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
