import { Buffer } from 'node:buffer';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_REDIRECTS = 3;
const NASA_SVS_HOSTNAME = 'svs.gsfc.nasa.gov';
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);
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

class PlanetaryImageryProxyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PlanetaryImageryProxyError';
  }
}

function assertAllowedNasaUrl(value) {
  let url;
  try {
    url = value instanceof URL ? new URL(value.href) : new URL(value);
  } catch {
    throw new PlanetaryImageryProxyError('NASA imagery source returned an invalid redirect URL.');
  }

  if (
    url.protocol !== 'https:' ||
    url.hostname !== NASA_SVS_HOSTNAME ||
    url.username ||
    url.password ||
    url.port
  ) {
    throw new PlanetaryImageryProxyError('NASA imagery source redirected outside the approved HTTPS NASA SVS host.');
  }

  return url;
}

async function cancelResponseBody(response, reason) {
  try {
    await response?.body?.cancel?.(reason);
  } catch {
    // The body may already be closed or cancelled; no further reads are attempted.
  }
}

async function fetchNasaResponse(assetUrl, fetchImpl, signal) {
  let currentUrl = assertAllowedNasaUrl(assetUrl);
  let redirectsFollowed = 0;

  while (true) {
    const upstream = await fetchImpl(currentUrl.href, {
      method: 'GET',
      headers: { accept: 'image/jpeg' },
      redirect: 'manual',
      signal
    });

    if (REDIRECT_STATUS_CODES.has(upstream.status)) {
      const location = upstream.headers.get('location');
      await cancelResponseBody(upstream, 'NASA imagery redirect response discarded');

      if (!location) {
        throw new PlanetaryImageryProxyError('NASA imagery source returned a redirect without a Location header.');
      }
      if (redirectsFollowed >= MAX_REDIRECTS) {
        throw new PlanetaryImageryProxyError('NASA imagery source exceeded the configured redirect-hop limit.');
      }

      let nextUrl;
      try {
        nextUrl = new URL(location, currentUrl);
      } catch {
        throw new PlanetaryImageryProxyError('NASA imagery source returned an invalid redirect URL.');
      }

      // Validate the destination before issuing another network request.
      currentUrl = assertAllowedNasaUrl(nextUrl);
      redirectsFollowed += 1;
      continue;
    }

    if (upstream.status >= 300 && upstream.status < 400) {
      await cancelResponseBody(upstream, 'Unsupported NASA imagery redirect response');
      throw new PlanetaryImageryProxyError('NASA imagery source returned an unsupported redirect response.');
    }

    if (upstream.url) assertAllowedNasaUrl(upstream.url);

    if (!upstream.ok) {
      await cancelResponseBody(upstream, 'Unsuccessful NASA imagery response');
      throw new PlanetaryImageryProxyError('NASA imagery source returned HTTP ' + upstream.status + '.');
    }

    return upstream;
  }
}

async function readBoundedBody(body, maxBytes) {
  if (!body || typeof body.getReader !== 'function') {
    throw new PlanetaryImageryProxyError('NASA imagery source did not provide a readable response body.');
  }

  const reader = body.getReader();
  const chunks = [];
  let totalBytes = 0;
  let completed = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        completed = true;
        break;
      }

      const chunk = Buffer.from(value);
      if (totalBytes + chunk.byteLength > maxBytes) {
        throw new PlanetaryImageryProxyError('NASA imagery source exceeded the configured byte limit.');
      }

      totalBytes += chunk.byteLength;
      chunks.push(chunk);
    }
  } catch (error) {
    if (!completed) {
      try {
        await reader.cancel(error);
      } catch {
        // Preserve the original stream or size-limit error.
      }
    }
    throw error;
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // A failed stream may already have released its reader.
    }
  }

  if (totalBytes === 0) {
    throw new PlanetaryImageryProxyError('NASA imagery source returned an empty image.');
  }

  return Buffer.concat(chunks, totalBytes);
}

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
      const upstream = await fetchNasaResponse(asset.url, fetchImpl, controller.signal);
      const contentType = (upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (contentType !== 'image/jpeg') {
        await cancelResponseBody(upstream, 'Unexpected NASA imagery content type');
        throw new PlanetaryImageryProxyError('NASA imagery source returned an unexpected content type.');
      }

      const contentLengthHeader = upstream.headers.get('content-length');
      if (contentLengthHeader !== null) {
        const normalizedLength = contentLengthHeader.trim();
        if (!/^\d+$/.test(normalizedLength)) {
          await cancelResponseBody(upstream, 'Invalid NASA imagery Content-Length');
          throw new PlanetaryImageryProxyError('NASA imagery source returned an invalid Content-Length header.');
        }

        const declaredLength = Number(normalizedLength);
        if (!Number.isSafeInteger(declaredLength) || declaredLength > asset.maxBytes) {
          await cancelResponseBody(upstream, 'Oversized NASA imagery Content-Length');
          throw new PlanetaryImageryProxyError('NASA imagery source exceeded the configured byte limit.');
        }
      }

      const bytes = await readBoundedBody(upstream.body, asset.maxBytes);
      const dimensions = jpegDimensions(bytes);
      if (!dimensions || dimensions.width < 2 || dimensions.height < 1 || Math.abs(dimensions.width / dimensions.height - 2) > 0.02) {
        throw new PlanetaryImageryProxyError('NASA imagery source returned an invalid 2:1 JPEG texture.');
      }

      cache.set(assetId, { bytes, cachedAt: now() });
      return sendImage(res, bytes, 'MISS');
    } catch (error) {
      const timedOut = controller.signal.aborted;
      const invalidUpstream = error instanceof PlanetaryImageryProxyError;
      return res.status(timedOut ? 504 : invalidUpstream ? 502 : 503).json({
        error: timedOut
          ? 'NASA imagery request timed out.'
          : invalidUpstream
            ? error.message
            : 'NASA imagery is temporarily unavailable.'
      });
    } finally {
      clearTimeout(timeout);
    }
  };
}
