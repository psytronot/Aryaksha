import * as THREE from 'three';
import { MOON_ORBIT_PERIOD_SECONDS, MOON_TEXTURE_CENTER_ROTATION_RAD, PLANETARY_BODY_SPECS, moonSynchronousYaw, planetaryPositionAt } from './earth3dMath';

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

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
  context.fillRect(2, 2, canvas.width - 4, canvas.height - 4);
  context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
  context.fillStyle = color;
  context.font = '600 34px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text.toUpperCase(), canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: true }));
  sprite.renderOrder = 10;
  return { sprite, texture };
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
  let lunarColorTexture: THREE.Texture = createLunarTexture();
  let lunarElevationTexture: THREE.Texture | null = null;
  let disposed = false;
  const moonMaterial = new THREE.MeshStandardMaterial({
    map: lunarColorTexture, color: 0xffffff, roughness: 1, metalness: 0
  });
  const moonGeometry = new THREE.SphereGeometry(moonRadius, 96, 64);
  moonGeometry.rotateY(MOON_TEXTURE_CENTER_ROTATION_RAD);
  const moon = new THREE.Mesh(moonGeometry, moonMaterial);
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

  const planetaryGroup = new THREE.Group();
  planetaryGroup.name = 'Schematic solar-system overview — not to scale or ephemeris';
  planetaryGroup.visible = false;
  const planetaryLabelTextures: THREE.Texture[] = [];
  const bodies = PLANETARY_BODY_SPECS.map((spec) => {
    const root = new THREE.Group();
    root.name = spec.name;
    const geometry = new THREE.SphereGeometry(spec.radius, spec.name === 'Sun' ? 48 : 32, spec.name === 'Sun' ? 32 : 24);
    const material = spec.name === 'Sun'
      ? new THREE.MeshBasicMaterial({ color: spec.color })
      : new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.82, metalness: 0.02 });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.name = spec.name + ' schematic body';
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
    planetaryLabelTextures.push(label.texture);
    label.sprite.position.y = spec.radius + (spec.ringed ? spec.radius * 1.3 + 0.45 : 0.75);
    label.sprite.scale.set(Math.max(3.4, spec.radius * 4.2), Math.max(0.85, spec.radius * 1.05), 1);
    root.add(label.sprite);

    if (spec.name !== 'Sun') {
      const orbitPoints = Array.from({ length: 193 }, (_, index) => {
        const angle = index / 192 * Math.PI * 2;
        return new THREE.Vector3(Math.cos(angle) * spec.orbitRadius, 0, Math.sin(angle) * spec.orbitRadius);
      });
      const orbit = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(orbitPoints),
        new THREE.LineBasicMaterial({ color: 0x78a9c6, transparent: true, opacity: 0.28, depthWrite: false })
      );
      orbit.name = spec.name + ' schematic orbit';
      planetaryGroup.add(orbit);
    }
    planetaryGroup.add(root);
    return { name: spec.name, root, spec };
  });

  const planetarySunLight = new THREE.PointLight(0xffe0a6, 2.2, 0, 0);
  planetarySunLight.name = 'Schematic Sun point light';
  planetaryGroup.add(planetarySunLight);

  return {
    group,
    planetaryGroup,
    moon,
    moonOrbit,
    bodies,
    update(elapsedSeconds: number, displayDistanceScale = 1) {
      const safeElapsedSeconds = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
      const phase = (safeElapsedSeconds / MOON_ORBIT_PERIOD_SECONDS) * Math.PI * 2;
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
      bodies.forEach((body) => {
        const position = planetaryPositionAt(body.name, safeElapsedSeconds);
        body.root.position.set(position.x, position.y, position.z);
      });
    },
    setLunarColorTexture(texture: THREE.Texture) {
      if (disposed) { texture.dispose(); return; }
      if (texture === lunarColorTexture) return;
      const previous = lunarColorTexture;
      lunarColorTexture = texture;
      moonMaterial.map = texture;
      moonMaterial.needsUpdate = true;
      previous.dispose();
    },
    setLunarElevationTexture(texture: THREE.Texture) {
      if (disposed) { texture.dispose(); return; }
      if (texture === lunarElevationTexture) return;
      const previous = lunarElevationTexture;
      lunarElevationTexture = texture;
      moonMaterial.bumpMap = texture;
      moonMaterial.bumpScale = moonRadius * 0.018;
      moonMaterial.needsUpdate = true;
      previous?.dispose();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      lunarColorTexture.dispose();
      lunarElevationTexture?.dispose();
      planetaryLabelTextures.forEach(texture => texture.dispose());
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
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
    }
  };
}
