import * as THREE from 'three';

type PlanetarySource = {
  id: string; url: string; assetPath: string; page: string; credit: string;
  width: number; height: number; historicalDate?: string; productYear?: string;
};

export const PLANETARY_IMAGERY_SOURCES = {
  clouds: {
    id: 'nasa-noaa-cpc-clouds-2014-06-02',
    url: 'https://svs.gsfc.nasa.gov/vis/a000000/a004400/a004439/flat_cpc_clouds_8192x4096.01000_print.jpg',
    assetPath: '/api/imagery/nasa-noaa-cpc-clouds-2014-06-02',
    page: 'https://svs.gsfc.nasa.gov/4439/',
    credit: 'NASA Scientific Visualization Studio; NOAA Climate Prediction Center',
    width: 1024, height: 512, historicalDate: '2014-06-02T00:00:00Z'
  },
  moonColor: {
    id: 'nasa-lroc-color-2025',
    url: 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg',
    assetPath: '/api/imagery/nasa-lroc-color-2025',
    page: 'https://svs.gsfc.nasa.gov/4720/',
    credit: 'NASA Scientific Visualization Studio; LRO LROC WAC; Ernie Wright',
    width: 2048, height: 1024, productYear: '2025'
  },
  moonElevation: {
    id: 'nasa-lola-elevation-2019',
    url: 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_3_8bit.jpg',
    assetPath: '/api/imagery/nasa-lola-elevation-2019',
    page: 'https://svs.gsfc.nasa.gov/4720/',
    credit: 'NASA Scientific Visualization Studio; Lunar Reconnaissance Orbiter LOLA',
    width: 1024, height: 512, productYear: '2019'
  }
} satisfies Record<string, PlanetarySource>;

export type PlanetaryImageryResult = {
  clouds: THREE.Texture | null;
  moonColor: THREE.Texture | null;
  moonElevation: THREE.Texture | null;
  failures: Record<string, string>;
};

export function cloudAlphaFromLuminance(luminance: number): number {
  const value = Number.isFinite(luminance) ? Math.max(0, Math.min(255, luminance)) : 255;
  return Math.max(0, Math.min(220, Math.round((252 - value) * 5.5)));
}

function abortError(): DOMException {
  return new DOMException('Planetary imagery loading was aborted.', 'AbortError');
}

async function loadBitmap(source: PlanetarySource, signal: AbortSignal): Promise<ImageBitmap> {
  const response = await fetch(source.assetPath, {
    mode: 'same-origin', credentials: 'same-origin', cache: 'force-cache', signal
  });
  if (!response.ok) throw new Error(source.id + ': HTTP ' + response.status);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('image/')) {
    throw new Error(source.id + ': unexpected content type ' + (contentType || 'unknown'));
  }
  const blob = await response.blob();
  if (!blob.size) throw new Error(source.id + ': empty image response');
  if (typeof createImageBitmap !== 'function') throw new Error('ImageBitmap decoding is unavailable.');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob, {
      imageOrientation: 'flipY',
      resizeWidth: source.width,
      resizeHeight: source.height,
      resizeQuality: 'high'
    });
  } catch (resizeError) {
    if (signal.aborted || (resizeError instanceof Error && resizeError.name === 'AbortError')) throw abortError();
    bitmap = await createImageBitmap(blob, { imageOrientation: 'flipY' });
  }
  if (signal.aborted) {
    bitmap.close();
    throw abortError();
  }
  if (Math.abs(bitmap.width / bitmap.height - 2) > 0.02) {
    const dimensions = bitmap.width + '×' + bitmap.height;
    bitmap.close();
    throw new Error(source.id + ': expected 2:1 equirectangular image, received ' + dimensions);
  }
  return bitmap;
}

function configureTexture(texture: THREE.Texture, bitmap: ImageBitmap, source: PlanetarySource, colorSpace: THREE.ColorSpace) {
  texture.colorSpace = colorSpace;
  texture.flipY = false;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.userData = {
    sourceId: source.id, sourceUrl: source.url, assetPath: source.assetPath, sourcePage: source.page,
    credit: source.credit, historicalDate: source.historicalDate || null,
    productYear: source.productYear || null
  };
  texture.addEventListener('dispose', () => bitmap.close());
  texture.needsUpdate = true;
  return texture;
}

async function loadLayer(
  source: PlanetarySource,
  signal: AbortSignal,
  makeTexture: (bitmap: ImageBitmap, source: PlanetarySource) => THREE.Texture
): Promise<THREE.Texture> {
  const bitmap = await loadBitmap(source, signal);
  try {
    if (signal.aborted) throw abortError();
    return makeTexture(bitmap, source);
  } catch (error) {
    bitmap.close();
    throw error;
  }
}

function makeCloudOpacityTexture(bitmap: ImageBitmap, source: PlanetarySource): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Cloud opacity texture canvas is unavailable.');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    const luminance = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
    data[i] = 255; data[i + 1] = 255; data[i + 2] = 255;
    data[i + 3] = cloudAlphaFromLuminance(luminance);
  }
  context.putImageData(pixels, 0, 0);
  bitmap.close();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.userData = {
    sourceId: source.id, sourceUrl: source.url, assetPath: source.assetPath, sourcePage: source.page,
    credit: source.credit, historicalDate: source.historicalDate || null,
    assetPath: source.assetPath, alphaDerivation: 'inverse grayscale luminance from NASA SVS print JPEG'
  };
  texture.addEventListener('dispose', () => { canvas.width = 0; canvas.height = 0; });
  texture.needsUpdate = true;
  return texture;
}

export async function loadPlanetaryImagery(signal: AbortSignal): Promise<PlanetaryImageryResult> {
  const settled = await Promise.allSettled([
    loadLayer(PLANETARY_IMAGERY_SOURCES.clouds, signal, makeCloudOpacityTexture),
    loadLayer(PLANETARY_IMAGERY_SOURCES.moonColor, signal, (bitmap, source) => configureTexture(new THREE.Texture(bitmap), bitmap, source, THREE.SRGBColorSpace)),
    loadLayer(PLANETARY_IMAGERY_SOURCES.moonElevation, signal, (bitmap, source) => configureTexture(new THREE.Texture(bitmap), bitmap, source, THREE.NoColorSpace))
  ]);
  const failures: Record<string, string> = {};
  const take = (index: number, key: string): THREE.Texture | null => {
    const result = settled[index];
    if (result.status === 'fulfilled') return result.value;
    if (!(result.reason instanceof Error && result.reason.name === 'AbortError')) {
      failures[key] = result.reason instanceof Error ? result.reason.message : String(result.reason);
    }
    return null;
  };
  const result = {
    clouds: take(0, 'clouds'),
    moonColor: take(1, 'moonColor'),
    moonElevation: take(2, 'moonElevation'),
    failures
  };
  if (signal.aborted) {
    result.clouds?.dispose(); result.moonColor?.dispose(); result.moonElevation?.dispose();
    throw abortError();
  }
  return result;
}
