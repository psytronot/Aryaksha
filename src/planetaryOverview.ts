import * as THREE from 'three';
import {
  PLANETARY_BODIES,
  PLANETARY_POSITION_MODEL,
  planetaryPositionAU,
  planetaryPositionAtEccentricAnomaly
} from './planetaryEphemeris';

const ORBIT_EPOCH = new Date('2026-01-01T00:00:00.000Z');
const SQRT_DISTANCE_SCALE = 4.8;

function toDisplayPosition(position: { xAU: number; yAU: number; zAU: number; distanceAU: number }) {
  const radius = SQRT_DISTANCE_SCALE * Math.sqrt(Math.max(0, position.distanceAU));
  const scale = radius / Math.max(position.distanceAU, 1e-9);
  // J2000 ecliptic x/y/z is mapped to the Three.js x/z/y scene convention.
  return new THREE.Vector3(position.xAU * scale, position.zAU * scale, position.yAU * scale);
}

function displayBodyRadius(meanRadiusKm: number) {
  return 0.28 + 0.32 * Math.pow(meanRadiusKm / 6371, 0.28);
}

export function createPlanetaryOverview() {
  const group = new THREE.Group();
  group.name = 'JPL approximate heliocentric planetary overview';
  group.visible = false;
  group.userData.model = PLANETARY_POSITION_MODEL;
  group.userData.distanceCompression = 'square-root radial';
  group.userData.bodyCount = PLANETARY_BODIES.length;
  let disposed = false;

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(1.65, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0xffc86b })
  );
  sun.name = 'planetary-sun';
  group.add(sun);
  const solarLight = new THREE.PointLight(0xffe5b0, 160, 0, 2);
  solarLight.name = 'planetary-point-light';
  group.add(solarLight);

  const bodies = new Map<string, THREE.Mesh>();
  const orbitMaterials = new Set<THREE.Material>();
  const orbitDate = ORBIT_EPOCH;

  for (const body of PLANETARY_BODIES) {
    const orbitPoints = Array.from({ length: 241 }, (_, index) => {
      const eccentricAnomaly = (index / 240) * Math.PI * 2;
      return toDisplayPosition(planetaryPositionAtEccentricAnomaly(body.id, orbitDate, eccentricAnomaly));
    });
    const orbitMaterial = new THREE.LineBasicMaterial({
      color: 0x4b718b,
      transparent: true,
      opacity: 0.34,
      depthWrite: false
    });
    orbitMaterials.add(orbitMaterial);
    const orbit = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(orbitPoints),
      orbitMaterial
    );
    orbit.name = body.name + ' heliocentric orbit (square-root compressed)';
    group.add(orbit);

    const radius = displayBodyRadius(body.meanRadiusKm);
    const material = new THREE.MeshStandardMaterial({
      color: body.color,
      roughness: 0.92,
      metalness: 0,
      emissive: body.color,
      emissiveIntensity: 0.035
    });
    const planet = new THREE.Mesh(new THREE.SphereGeometry(radius, 40, 28), material);
    planet.name = 'planet-' + body.id;
    planet.userData.planetId = body.id;
    planet.userData.meanRadiusKm = body.meanRadiusKm;
    if (body.id === 'earth') planet.userData.positionReference = 'Earth–Moon barycentre';
    bodies.set(body.id, planet);
    group.add(planet);

    if (body.id === 'saturn') {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(radius * 1.35, radius * 2.25, 96),
        new THREE.MeshBasicMaterial({
          color: 0xb7a17b,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.78,
          depthWrite: false
        })
      );
      ring.name = 'saturn-schematic-rings';
      ring.rotation.x = Math.PI / 2;
      ring.rotation.z = 26.7 * Math.PI / 180;
      ring.userData.axialTiltDeg = 26.7;
      planet.add(ring);
    }
  }

  return {
    group,
    bodies,
    update(date: Date) {
      if (disposed) return;
      for (const body of PLANETARY_BODIES) {
        const mesh = bodies.get(body.id);
        if (!mesh) continue;
        const position = planetaryPositionAU(body.id, date);
        mesh.position.copy(toDisplayPosition(position));
        mesh.userData.distanceAU = position.distanceAU;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      group.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          geometries.add(object.geometry);
          const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
          objectMaterials.forEach(material => materials.add(material));
        }
      });
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      bodies.clear();
      orbitMaterials.clear();
    }
  };
}
