import * as THREE from 'three';

export function makeNightLightsTexture(width = 1024, height = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Night-light texture could not be created.');
  const image = ctx.createImageData(width, height);
  for (let y = 0; y < height; y += 1) {
    const lat = (0.5 - y / height) * Math.PI;
    const latitudeBias = Math.max(0, 1 - Math.abs(lat) / 1.38);
    for (let x = 0; x < width; x += 1) {
      const lon = (x / width - 0.5) * Math.PI * 2;
      const n1 = Math.sin(lon * 83.1 + lat * 41.7) * 43758.5453;
      const n2 = Math.sin(lon * 171.4 - lat * 89.2) * 24634.6345;
      const noise = (n1 - Math.floor(n1)) * (n2 - Math.floor(n2));
      const coastBias = Math.sin(lon * 2.6 + lat * 4.1) * 0.5 + 0.5;
      const lit = noise > 0.985 && latitudeBias > 0.25 && coastBias > 0.24;
      const i = (y * width + x) * 4;
      image.data[i] = lit ? 255 : 0;
      image.data[i + 1] = lit ? 185 : 0;
      image.data[i + 2] = lit ? 82 : 0;
      image.data[i + 3] = lit ? 240 : 0;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
