import { Buffer } from 'node:buffer';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const JPEG_SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

const NASA_IMAGERY_ASSETS = Object.freeze({
  'nasa-noaa-cpc-clouds-2014-06-02': {
    url: 'https://svs.gsfc.nasa.gov/vis/a000000/a004400/a004439/flat_cpc_clouds_8192x4096.01000_print.jpg',
    maxBytes: 4 * 1024 * 1024
  },
  'nasa-lroc-color-2025': {
    url: 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg',
    maxBytes: 4 * 1024 * 1024
  },
  'nasa-lola-elevation-2019': {
    url: 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_3_8bit.jpg',
    maxBytes: 2 * 1024 * 1024
  }
});

function jpegDimensions(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return null;
    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    if (JPEG_SOF_MARKERS.has(marker)) {
      if (segmentLength < 7) return null;
      return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
    }
    offset += segmentLength;
  }
  return null;
}

function sendImage(res, bytes, cacheState) {
  return res.status(200).set({
    'Content-Type': 'image/jpeg',
    'Content-Length': String(bytes.length),
    'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Imagery-Cache': cacheState
  }).send(bytes);
}

export function createPlanetaryImageryHandler({
  fetchImpl = globalThis.fetch,
  cache = new Map(),
  now = Date.now,
  timeoutMs = 15_000
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required.');
  if (!(cache instanceof Map)) throw new TypeError('The imagery cache must be a Map.');
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RangeError('timeoutMs must be positive.');

  return async function planetaryImageryHandler(req, res) {
    const assetId = req.params?.assetId;
    const asset = NASA_IMAGERY_ASSETS[assetId];
    if (!asset) return res.status(404).json({ error: 'Unknown NASA imagery asset.' });

    const cached = cache.get(assetId);
    if (cached && now() - cached.cachedAt < CACHE_TTL_MS) return sendImage(res, cached.bytes, 'HIT');
    if (cached) cache.delete(assetId);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const upstream = await fetchImpl(asset.url, {
        method: 'GET',
        headers: { accept: 'image/jpeg' },
        redirect: 'follow',
        signal: controller.signal
      });
      if (!upstream.ok) {
        return res.status(502).json({ error: 'NASA imagery source returned HTTP ' + upstream.status + '.' });
      }

      const finalUrl = new URL(upstream.url || asset.url);
      if (finalUrl.protocol !== 'https:' || !finalUrl.hostname.endsWith('.nasa.gov')) {
        return res.status(502).json({ error: 'NASA imagery source redirected outside the NASA domain.' });
      }

      const contentType = (upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (contentType !== 'image/jpeg') {
        return res.status(502).json({ error: 'NASA imagery source returned an unexpected content type.' });
      }
      const declaredLength = Number(upstream.headers.get('content-length') || 0);
      if (Number.isFinite(declaredLength) && declaredLength > asset.maxBytes) {
        return res.status(502).json({ error: 'NASA imagery source exceeded the configured byte limit.' });
      }

      const bytes = Buffer.from(await upstream.arrayBuffer());
      if (bytes.length === 0 || bytes.length > asset.maxBytes) {
        return res.status(502).json({ error: 'NASA imagery source returned an empty or oversized image.' });
      }
      const dimensions = jpegDimensions(bytes);
      if (!dimensions || dimensions.width < 2 || dimensions.height < 1 || Math.abs(dimensions.width / dimensions.height - 2) > 0.02) {
        return res.status(502).json({ error: 'NASA imagery source returned an invalid 2:1 JPEG texture.' });
      }

      cache.set(assetId, { bytes, cachedAt: now() });
      return sendImage(res, bytes, 'MISS');
    } catch (error) {
      const timedOut = controller.signal.aborted;
      return res.status(timedOut ? 504 : 503).json({
        error: timedOut ? 'NASA imagery request timed out.' : 'NASA imagery is temporarily unavailable.'
      });
    } finally {
      clearTimeout(timeout);
    }
  };
}
