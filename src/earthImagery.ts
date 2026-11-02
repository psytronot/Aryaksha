import * as THREE from 'three';

export const EARTH_IMAGERY_SOURCES = {
  albedo: {
    id: 'nasa-blue-marble',
    name: 'NASA Blue Marble: Next Generation — January 2004, topography and bathymetry',
    url: 'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/january/world.topo.bathy.200401.3x5400x2700.jpg',
    sourcePage: 'https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/',
    credit: 'NASA Earth Observatory',
    textureWidth: 3072,
    textureHeight: 1536
  },
  nightLights: {
    id: 'nasa-black-marble',
    name: 'NASA Black Marble — 2016 Color, global 0.1° map',
    url: 'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg',
    sourcePage: 'https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/',
    credit: 'NASA Earth Observatory; Suomi NPP VIIRS data processed by NASA GSFC',
    textureWidth: 2048,
    textureHeight: 1024
  }
} as const;

type EarthImageryLayer = keyof typeof EARTH_IMAGERY_SOURCES;

export type EarthImageryLoadResult = {
  albedo: THREE.Texture | null;
  nightLights: THREE.Texture | null;
  failures: Partial<Record<EarthImageryLayer, string>>;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown imagery loading error';
}

function abortError() {
  const error = new Error('Earth imagery loading was aborted.');
  error.name = 'AbortError';
  return error;
}

async function loadNasaTexture(
  source: (typeof EARTH_IMAGERY_SOURCES)[EarthImageryLayer],
  signal: AbortSignal
) {
  const response = await fetch(source.url, {
    mode: 'cors',
    credentials: 'omit',
    cache: 'force-cache',
    signal
  });
  if (!response.ok) throw new Error(`${source.id} request failed with HTTP ${response.status}`);

  const blob = await response.blob();
  if (blob.size === 0) throw new Error(`${source.id} returned an empty image.`);
  if (signal.aborted) throw abortError();

  let texture: THREE.Texture;
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob, {
        imageOrientation: 'flipY',
        resizeWidth: source.textureWidth,
        resizeHeight: source.textureHeight,
        resizeQuality: 'high'
      });
      if (signal.aborted) {
        bitmap.close();
        throw abortError();
      }
      if (Math.abs(bitmap.width / bitmap.height - 2) > 0.015) {
        bitmap.close();
        throw new Error(`${source.id} is not a 2:1 equirectangular image.`);
      }
      texture = new THREE.Texture(bitmap);
      texture.flipY = false;
      texture.addEventListener('dispose', () => bitmap.close());
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error;
      // Older browsers may not support ImageBitmap resizing/options. The
      // fetched Blob is already CORS-approved, so an object URL is safe.
      const image = new Image();
      image.decoding = 'async';
      const fallbackLoad = typeof image.decode === 'function'
        ? null
        : new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () => reject(new Error(`${source.id} image decode failed.`));
          });
      const objectUrl = URL.createObjectURL(blob);
      image.src = objectUrl;
      try {
        if (typeof image.decode === 'function') await image.decode();
        else await fallbackLoad;
      } catch (decodeError) {
        URL.revokeObjectURL(objectUrl);
        image.src = '';
        throw decodeError;
      }
      URL.revokeObjectURL(objectUrl);
      if (signal.aborted) {
        image.src = '';
        throw abortError();
      }
      if (image.naturalWidth < 2048 || image.naturalHeight < 1024
        || Math.abs(image.naturalWidth / image.naturalHeight - 2) > 0.015) {
        image.src = '';
        throw new Error(`${source.id} is not a usable 2:1 equirectangular image.`);
      }
      texture = new THREE.Texture(image);
      texture.flipY = true;
      texture.addEventListener('dispose', () => { image.src = ''; });
    }
  } else {
    const image = new Image();
    image.decoding = 'async';
    const fallbackLoad = typeof image.decode === 'function'
      ? null
      : new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error(`${source.id} image decode failed.`));
        });
    const objectUrl = URL.createObjectURL(blob);
    image.src = objectUrl;
    try {
      if (typeof image.decode === 'function') await image.decode();
      else await fallbackLoad;
    } catch (decodeError) {
      URL.revokeObjectURL(objectUrl);
      image.src = '';
      throw decodeError;
    }
    URL.revokeObjectURL(objectUrl);
    if (signal.aborted) {
      image.src = '';
      throw abortError();
    }
    if (image.naturalWidth < 2048 || image.naturalHeight < 1024
      || Math.abs(image.naturalWidth / image.naturalHeight - 2) > 0.015) {
      image.src = '';
      throw new Error(`${source.id} is not a usable 2:1 equirectangular image.`);
    }
    texture = new THREE.Texture(image);
    texture.flipY = true;
    texture.addEventListener('dispose', () => { image.src = ''; });
  }

  texture.name = source.name;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.userData.earthImagerySource = source.id;
  texture.userData.earthImageryUrl = source.url;
  texture.needsUpdate = true;
  return texture;
}

export async function loadEarthImagery(signal: AbortSignal): Promise<EarthImageryLoadResult> {
  const [albedoResult, nightLightsResult] = await Promise.allSettled([
    loadNasaTexture(EARTH_IMAGERY_SOURCES.albedo, signal),
    loadNasaTexture(EARTH_IMAGERY_SOURCES.nightLights, signal)
  ]);
  const albedo = albedoResult.status === 'fulfilled' ? albedoResult.value : null;
  const nightLights = nightLightsResult.status === 'fulfilled' ? nightLightsResult.value : null;

  if (signal.aborted) {
    albedo?.dispose();
    nightLights?.dispose();
    throw abortError();
  }

  const failures: EarthImageryLoadResult['failures'] = {};
  if (albedoResult.status === 'rejected') failures.albedo = errorMessage(albedoResult.reason);
  if (nightLightsResult.status === 'rejected') failures.nightLights = errorMessage(nightLightsResult.reason);
  return { albedo, nightLights, failures };
}
