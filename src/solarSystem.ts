import * as THREE from 'three';

export function createSpaceEnvironment(moonRadius: number, moonDistance: number) {
  const group = new THREE.Group();
  const lunarCanvas = document.createElement('canvas');
  lunarCanvas.width = 512;
  lunarCanvas.height = 256;
  const ctx = lunarCanvas.getContext('2d');
  if (!ctx) throw new Error('Lunar texture could not be created.');
  const image = ctx.createImageData(lunarCanvas.width, lunarCanvas.height);
  for (let y = 0; y < lunarCanvas.height; y += 1) {
    for (let x = 0; x < lunarCanvas.width; x += 1) {
      const u = x / lunarCanvas.width;
      const v = y / lunarCanvas.height;
      let value = 145 + 8 * Math.sin(u * 83 + Math.sin(v * 41) * 3) + 6 * Math.sin(v * 119 - u * 27);
      for (let c = 0; c < 18; c += 1) {
        const cx = ((c * 0.61803398875) % 1);
        const cy = ((c * 0.41421356237) % 1);
        const dx = (u - cx) * Math.cos(cy * Math.PI);
        const dy = v - cy;
        const r = 0.012 + (c % 5) * 0.004;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < r) value -= 24 * (1 - d / r);
      }
      const i = (y * lunarCanvas.width + x) * 4;
      value = Math.max(70, Math.min(205, value));
      image.data[i] = value;
      image.data[i + 1] = value;
      image.data[i + 2] = Math.min(215, value + 3);
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const lunarTexture = new THREE.CanvasTexture(lunarCanvas);
  lunarTexture.colorSpace = THREE.SRGBColorSpace;
  lunarTexture.anisotropy = 8;

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(moonRadius, 64, 48),
    new THREE.MeshStandardMaterial({ map: lunarTexture, roughness: 1, metalness: 0 })
  );
  moon.name = 'Moon';
  const moonOrbit = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(Array.from({ length: 257 }, (_, i) => {
      const a = (i / 256) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * moonDistance, 0, Math.sin(a) * moonDistance);
    })),
    new THREE.LineBasicMaterial({ color: 0xc7d9e8, transparent: true, opacity: 0.3 })
  );
  moonOrbit.name = 'Mean Earth–Moon orbit (display-scale geometry)';
  group.add(moonOrbit, moon);

  return {
    group,
    moon,
    moonOrbit,
    update(elapsedSeconds: number) {
      const phase = (elapsedSeconds / (27.321661 * 86400)) * Math.PI * 2;
      moon.position.set(Math.cos(phase) * moonDistance, 0, Math.sin(phase) * moonDistance);
      // Keep the same lunar hemisphere facing Earth as the simulated orbit advances.
      moon.rotation.y = phase + Math.PI;
    },
    dispose() {
      lunarTexture.dispose();
      group.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
    }
  };
}
