import * as THREE from 'three';
import { moonSynchronousYaw } from './earth3dMath';

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function createLunarTexture() {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Lunar texture could not be created.');

  const image = ctx.createImageData(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const u = x / width;
      const v = y / height;
      const broad = Math.sin(u * 18.2 + Math.sin(v * 7.1) * 2.4) * 0.55
        + Math.cos(v * 23.4 - u * 5.7) * 0.3
        + Math.sin((u + v) * 41.7) * 0.15;
      const fine = Math.sin(x * 0.17 + y * 0.11) * 0.5 + Math.cos(x * 0.07 - y * 0.19) * 0.5;
      const grain = Math.sin(x * 12.9898 + y * 78.233) * 2.7;
      const value = Math.max(72, Math.min(205, 145 + broad * 10 + fine * 4 + grain));
      const i = (y * width + x) * 4;
      image.data[i] = value;
      image.data[i + 1] = value;
      image.data[i + 2] = Math.min(210, value + 2);
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  const random = seededRandom(0x4d4f4f4e);
  const drawCrater = (cx: number, cy: number, radius: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    const bowl = ctx.createRadialGradient(-radius * 0.2, -radius * 0.2, radius * 0.04, 0, 0, radius);
    bowl.addColorStop(0, 'rgba(42,42,42,0.62)');
    bowl.addColorStop(0.42, 'rgba(83,83,83,0.40)');
    bowl.addColorStop(0.70, 'rgba(135,135,135,0.18)');
    bowl.addColorStop(0.82, 'rgba(231,231,231,0.42)');
    bowl.addColorStop(0.92, 'rgba(103,103,103,0.28)');
    bowl.addColorStop(1, 'rgba(70,70,70,0)');
    ctx.fillStyle = bowl;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(238,238,238,0.26)';
    ctx.lineWidth = Math.max(0.7, radius * 0.055);
    ctx.beginPath();
    ctx.arc(-radius * 0.035, -radius * 0.04, radius * 0.79, 0, Math.PI * 2);
    ctx.stroke();
    if (radius > 13) {
      ctx.fillStyle = 'rgba(48,48,48,0.28)';
      ctx.beginPath();
      ctx.arc(radius * 0.045, radius * 0.07, radius * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  for (let i = 0; i < 260; i += 1) {
    const radius = 1.8 + Math.pow(random(), 2.05) * 28;
    const x = random() * width;
    const y = random() * height;
    drawCrater(x, y, radius);
    if (x < radius) drawCrater(x + width, y, radius);
    if (x > width - radius) drawCrater(x - width, y, radius);
  }
  for (let i = 0; i < 380; i += 1) {
    const radius = 0.7 + random() * 2.4;
    const x = random() * width;
    const y = random() * height;
    ctx.fillStyle = 'rgba(45,45,45,0.26)';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    if (x < radius) {
      ctx.beginPath();
      ctx.arc(x + width, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    if (x > width - radius) {
      ctx.beginPath();
      ctx.arc(x - width, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.generateMipmaps = true;
  return texture;
}

export function createSpaceEnvironment(moonRadius: number, moonDistance: number) {
  const group = new THREE.Group();
  const lunarTexture = createLunarTexture();
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(moonRadius, 96, 64),
    new THREE.MeshStandardMaterial({
      map: lunarTexture,
      bumpMap: lunarTexture,
      bumpScale: moonRadius * 0.16,
      color: 0xc9c9c9,
      roughness: 1,
      metalness: 0
    })
  );
  moon.name = 'Moon';

  const moonOrbit = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(Array.from({ length: 257 }, (_, i) => {
      const angle = (i / 256) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(angle) * moonDistance, 0, Math.sin(angle) * moonDistance);
    })),
    new THREE.LineBasicMaterial({ color: 0xc7d9e8, transparent: true, opacity: 0.3 })
  );
  moonOrbit.name = 'Mean Earth-Moon orbit (display-scale geometry)';
  group.add(moonOrbit, moon);

  return {
    group,
    moon,
    moonOrbit,
    update(elapsedSeconds: number, displayDistanceScale = 1) {
      const phase = (elapsedSeconds / (27.321661 * 86400)) * Math.PI * 2;
      const distanceScale = Number.isFinite(displayDistanceScale)
        ? Math.max(0.01, Math.min(1, displayDistanceScale))
        : 1;
      moon.position.set(
        Math.cos(phase) * moonDistance * distanceScale,
        0,
        Math.sin(phase) * moonDistance * distanceScale
      );
      moonOrbit.scale.setScalar(distanceScale);
      moon.rotation.y = moonSynchronousYaw(phase);
    },
    dispose() {
      lunarTexture.dispose();
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      group.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          geometries.add(object.geometry);
          const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
          objectMaterials.forEach((material) => materials.add(material));
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
    }
  };
}
