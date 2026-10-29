import * as THREE from 'three';
import { PLANETARY_BODY_SPECS, planetaryPositionAt } from './earth3dMath';

function makeBodyLabel(text: string, color: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Planet label canvas could not be created.');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(3, 8, 15, 0.82)';
  context.strokeStyle = 'rgba(140, 185, 215, 0.65)';
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(2, 2, canvas.width - 4, canvas.height - 4, 12);
  context.fill();
  context.stroke();
  context.fillStyle = color;
  context.font = '600 34px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text.toUpperCase(), canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, sizeAttenuation: true }));
  sprite.scale.set(6.2, 1.55, 1);
  sprite.renderOrder = 10;
  return { sprite, texture };
}

export function createSpaceEnvironment(moonRadius: number, moonDistance: number) {
  const group = new THREE.Group();
  group.name = 'Earth–Moon physical-ratio view';
  const planetaryGroup = new THREE.Group();
  planetaryGroup.name = 'Schematic solar-system overview — not to scale';
  const lunarCanvas = document.createElement('canvas');
  lunarCanvas.width = 512;
  lunarCanvas.height = 256;
  const ctx = lunarCanvas.getContext('2d');
  if (!ctx) throw new Error('Lunar texture could not be created.');
  const image = ctx.createImageData(lunarCanvas.width, lunarCanvas.height);
  const craters = Array.from({ length: 46 }, (_, index) => ({
    x: ((index * 0.61803398875) % 1) * lunarCanvas.width,
    y: ((index * 0.41421356237) % 1) * lunarCanvas.height,
    radius: 3 + ((index * 7) % 15)
  }));
  for (let y = 0; y < lunarCanvas.height; y += 1) {
    for (let x = 0; x < lunarCanvas.width; x += 1) {
      const u = x / lunarCanvas.width;
      const v = y / lunarCanvas.height;
      let value = 145 + 8 * Math.sin(u * 83 + Math.sin(v * 41) * 3) + 6 * Math.sin(v * 119 - u * 27);
      for (let c = 0; c < craters.length; c += 1) {
        const crater = craters[c];
        const dx = (x - crater.x) * Math.cos((crater.y / lunarCanvas.height - 0.5) * Math.PI);
        const dy = y - crater.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < crater.radius) {
          const depth = 1 - distance / crater.radius;
          value -= 26 * depth;
          if (distance > crater.radius * 0.76) value += 15 * (1 - depth);
        }
      }
      const i = (y * lunarCanvas.width + x) * 4;
      value = Math.max(62, Math.min(214, value));
      image.data[i] = value;
      image.data[i + 1] = value;
      image.data[i + 2] = Math.min(222, value + 4);
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  // Deterministic shaded rims make the crater relief legible even when the Moon is small.
  craters.forEach((crater, index) => {
    const radius = crater.radius * (0.72 + (index % 4) * 0.1);
    const gradient = ctx.createRadialGradient(crater.x - radius * 0.22, crater.y - radius * 0.24, radius * 0.08, crater.x, crater.y, radius);
    gradient.addColorStop(0, 'rgba(24, 27, 31, 0.24)');
    gradient.addColorStop(0.64, 'rgba(46, 49, 54, 0.24)');
    gradient.addColorStop(0.82, 'rgba(235, 237, 240, 0.34)');
    gradient.addColorStop(1, 'rgba(92, 96, 102, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(crater.x, crater.y, radius, 0, Math.PI * 2);
    ctx.fill();
  });
  const lunarTexture = new THREE.CanvasTexture(lunarCanvas);
  lunarTexture.colorSpace = THREE.SRGBColorSpace;
  lunarTexture.anisotropy = 8;

  const moonMaterial = new THREE.MeshStandardMaterial({
    map: lunarTexture,
    bumpMap: lunarTexture,
    bumpScale: moonRadius * 0.075,
    roughness: 1,
    metalness: 0
  });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(moonRadius, 96, 64), moonMaterial);
  moon.name = 'Moon — procedural crater relief';
  const moonOrbit = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(Array.from({ length: 257 }, (_, i) => {
      const a = (i / 256) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * moonDistance, 0, Math.sin(a) * moonDistance);
    })),
    new THREE.LineBasicMaterial({ color: 0xc7d9e8, transparent: true, opacity: 0.42 })
  );
  moonOrbit.name = 'Mean Earth–Moon orbit (physical centre-separation ratio)';
  group.add(moonOrbit, moon);

  const labelTextures: THREE.Texture[] = [];
  const bodies = PLANETARY_BODY_SPECS.map((spec) => {
    const root = new THREE.Group();
    root.name = spec.name;
    const geometry = new THREE.SphereGeometry(spec.radius, spec.name === 'Sun' ? 48 : 32, spec.name === 'Sun' ? 32 : 24);
    const material = spec.name === 'Sun'
      ? new THREE.MeshBasicMaterial({ color: spec.color })
      : new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.82, metalness: 0.02 });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.name = spec.name;
    root.add(sphere);
    if (spec.ringed) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(spec.radius * 1.28, spec.radius * 2.05, 72),
        new THREE.MeshBasicMaterial({ color: 0xcbb98c, side: THREE.DoubleSide, transparent: true, opacity: 0.82, depthWrite: false })
      );
      ring.rotation.x = Math.PI / 2;
      ring.name = 'Saturn rings — schematic';
      root.add(ring);
    }
    const label = makeBodyLabel(spec.name, spec.name === 'Sun' ? '#ffd889' : '#d8edf8');
    labelTextures.push(label.texture);
    label.sprite.position.y = spec.radius + 1.15;
    root.add(label.sprite);
    if (spec.name !== 'Sun') {
      const orbitPoints = Array.from({ length: 193 }, (_, index) => {
        const angle = index / 192 * Math.PI * 2;
        return new THREE.Vector3(Math.cos(angle) * spec.orbitRadius, 0, Math.sin(angle) * spec.orbitRadius);
      });
      const orbit = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(orbitPoints),
        new THREE.LineBasicMaterial({ color: 0x78a9c6, transparent: true, opacity: 0.28 })
      );
      orbit.name = spec.name + ' schematic orbit';
      planetaryGroup.add(orbit);
    }
    planetaryGroup.add(root);
    return { name: spec.name, root, spec };
  });

  return {
    group,
    planetaryGroup,
    moon,
    moonOrbit,
    bodies,
    update(elapsedSeconds: number) {
      const safeSeconds = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
      const phase = (safeSeconds / (27.321661 * 86400)) * Math.PI * 2;
      moon.position.set(Math.cos(phase) * moonDistance, 0, Math.sin(phase) * moonDistance);
      // Local +Z remains pointed toward Earth as the Moon advances around the x-z plane.
      moon.rotation.y = -phase - Math.PI / 2;
      bodies.forEach((body) => {
        const position = planetaryPositionAt(body.name, safeSeconds);
        body.root.position.set(position.x, position.y, position.z);
      });
    },
    dispose() {
      lunarTexture.dispose();
      labelTextures.forEach(texture => texture.dispose());
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      [group, planetaryGroup].forEach(root => root.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) geometries.add(object.geometry);
        if (object instanceof THREE.Sprite) materials.add(object.material);
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
          objectMaterials.forEach(material => materials.add(material));
        }
      }));
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
    }
  };
}
