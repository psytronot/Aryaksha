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

// Deliberately schematic radii/orbits for a readable overview, not physical scale
// or ephemeris. The detailed Earth–Moon scene keeps its own physical ratio.
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

export function nightLightFactor(normalDotSun: number): number {
  if (!Number.isFinite(normalDotSun)) return 1;
  const t = Math.max(0, Math.min(1, (normalDotSun + 0.18) / 0.3));
  return 1 - t * t * (3 - 2 * t);
}

export function planetaryPositionAt(name: PlanetaryBodyName, elapsedSeconds: number) {
  const body = PLANETARY_BODY_SPECS.find(item => item.name === name);
  if (!body || body.name === 'Sun') return { x: 0, y: 0, z: 0 };
  const safeSeconds = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
  const phase = body.phaseOffsetRad + (safeSeconds / (body.orbitalPeriodDays * 86400)) * Math.PI * 2;
  return { x: Math.cos(phase) * body.orbitRadius, y: 0, z: Math.sin(phase) * body.orbitRadius };
}

export function moonSynchronousYaw(phase: number): number {
  // Three.js local +Z, rotated around +Y, points from the Moon back toward Earth.
  return -phase - Math.PI / 2;
}

export const MOON_CAMERA_MARGIN = 1.7;

export function fitCameraDistance(width: number, height: number, extent: number, fovDegrees = 42, margin = 1.08): number {
  const safeWidth = Math.max(1, Number.isFinite(width) ? width : 1);
  const safeHeight = Math.max(1, Number.isFinite(height) ? height : 1);
  const safeExtent = Math.max(0.1, Number.isFinite(extent) ? extent : 0.1);
  const verticalFov = fovDegrees * Math.PI / 180;
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * (safeWidth / safeHeight));
  const limitingFov = Math.min(verticalFov, horizontalFov);
  // Sphere fit: the tangent fit is for a flat plane; use sine for the sphere's angular radius.
  return (safeExtent * Math.max(1, margin)) / Math.sin(limitingFov / 2);
}


export function spacecraftVisualExaggeration(maxBusDimensionM: number, targetDisplayExtent = 0.5): number {
  const safeBusDimensionM = Math.max(0.01, Number.isFinite(maxBusDimensionM) ? maxBusDimensionM : 0.01);
  const safeDisplayExtent = Math.max(0.01, Number.isFinite(targetDisplayExtent) ? targetDisplayExtent : 0.5);
  return Math.max(1, Math.round((safeDisplayExtent * 6378.137 / 5.15 * 1000) / safeBusDimensionM));
}

export function trueEarthDiameterToBusRatio(maxBusDimensionM: number): number {
  const safeBusDimensionM = Math.max(0.01, Number.isFinite(maxBusDimensionM) ? maxBusDimensionM : 0.01);
  return Math.round((2 * 6378.137 * 1000) / safeBusDimensionM);
}
