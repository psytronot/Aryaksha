import { describe, expect, it, vi } from 'vitest';
import { createPlanetaryImageryHandler } from '../backend/planetaryImagery.mjs';

function jpegHeader(width, height) {
  return Buffer.from([
    0xff, 0xd8,
    0xff, 0xc0, 0x00, 0x11, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
    0xff, 0xd9
  ]);
}

function upstreamResponse(bytes, {
  status = 200,
  contentType = 'image/jpeg',
  url = 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg'
} = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    headers: {
      get(name) {
        if (name.toLowerCase() === 'content-type') return contentType;
        if (name.toLowerCase() === 'content-length') return String(bytes.length);
        return null;
      }
    },
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }
  };
}

function responseSink() {
  const headers = {};
  let statusCode = 200;
  let body;
  const res = {
    status(code) { statusCode = code; return this; },
    set(values) { Object.assign(headers, values); return this; },
    json(value) { body = value; return this; },
    send(value) { body = value; return this; }
  };
  return { res, headers, get statusCode() { return statusCode; }, get body() { return body; } };
}

describe('fixed NASA planetary imagery proxy', () => {
  it('rejects unknown asset identifiers without making an upstream request', async () => {
    const fetchImpl = vi.fn();
    const handler = createPlanetaryImageryHandler({ fetchImpl, cache: new Map() });
    const sink = responseSink();

    await handler({ params: { assetId: 'https://example.com/image.jpg' } }, sink.res);

    expect(sink.statusCode).toBe(404);
    expect(sink.body.error).toContain('Unknown NASA imagery asset');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('serves a validated NASA JPEG through a cacheable same-origin response', async () => {
    const bytes = jpegHeader(2048, 1024);
    const fetchImpl = vi.fn().mockResolvedValue(upstreamResponse(bytes));
    const handler = createPlanetaryImageryHandler({ fetchImpl, cache: new Map() });

    const first = responseSink();
    await handler({ params: { assetId: 'nasa-lroc-color-2025' } }, first.res);
    expect(first.statusCode).toBe(200);
    expect(first.headers['Content-Type']).toBe('image/jpeg');
    expect(first.headers['Cache-Control']).toContain('max-age=86400');
    expect(first.headers['Cross-Origin-Resource-Policy']).toBe('same-origin');
    expect(first.headers['X-Imagery-Cache']).toBe('MISS');
    expect(first.body.equals(bytes)).toBe(true);

    const second = responseSink();
    await handler({ params: { assetId: 'nasa-lroc-color-2025' } }, second.res);
    expect(second.statusCode).toBe(200);
    expect(second.headers['X-Imagery-Cache']).toBe('HIT');
    expect(second.body.equals(bytes)).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg',
      expect.objectContaining({ method: 'GET', redirect: 'follow' })
    );
  });

  it.each([
    ['unexpected content type', jpegHeader(2048, 1024), { contentType: 'text/html' }],
    ['invalid JPEG bytes', Buffer.from('not a jpeg'), {}],
    ['non-equirectangular image', jpegHeader(1024, 1024), {}],
    ['redirect outside NASA', jpegHeader(2048, 1024), { url: 'https://example.com/image.jpg' }]
  ])('rejects %s', async (_label, bytes, options) => {
    const fetchImpl = vi.fn().mockResolvedValue(upstreamResponse(bytes, options));
    const handler = createPlanetaryImageryHandler({ fetchImpl, cache: new Map() });
    const sink = responseSink();

    await handler({ params: { assetId: 'nasa-lroc-color-2025' } }, sink.res);

    expect(sink.statusCode).toBe(502);
    expect(sink.body.error).toEqual(expect.any(String));
  });

  it('returns a bounded unavailable response when the NASA origin cannot be reached', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('network unavailable'));
    const handler = createPlanetaryImageryHandler({ fetchImpl, cache: new Map() });
    const sink = responseSink();

    await handler({ params: { assetId: 'nasa-noaa-cpc-clouds-2014-06-02' } }, sink.res);

    expect(sink.statusCode).toBe(503);
    expect(sink.body.error).toContain('temporarily unavailable');
  });
});
