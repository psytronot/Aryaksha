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

function byteStream(chunks, { onCancel } = {}) {
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(chunks[index]);
        index += 1;
      } else {
        controller.close();
      }
    },
    cancel(reason) {
      onCancel?.(reason);
    }
  });
}

function upstreamResponse(bytes, {
  status = 200,
  contentType = 'image/jpeg',
  contentLength = String(bytes.length),
  url = 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg',
  location = null,
  body = byteStream(bytes.length ? [bytes] : [])
} = {}) {
  const values = new Map([['content-type', contentType]]);
  if (contentLength !== null) values.set('content-length', String(contentLength));
  if (location !== null) values.set('location', location);

  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    headers: {
      get(name) {
        return values.get(name.toLowerCase()) ?? null;
      }
    },
    body
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
      expect.objectContaining({ method: 'GET', redirect: 'manual' })
    );
  });

  it('follows a relative redirect only after validating the same approved NASA SVS host', async () => {
    const bytes = jpegHeader(2048, 1024);
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(upstreamResponse(Buffer.alloc(0), {
        status: 302,
        location: '/vis/redirected/lroc_color_2k.jpg'
      }))
      .mockResolvedValueOnce(upstreamResponse(bytes));
    const handler = createPlanetaryImageryHandler({ fetchImpl, cache: new Map() });
    const sink = responseSink();

    await handler({ params: { assetId: 'nasa-lroc-color-2025' } }, sink.res);

    expect(sink.statusCode).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1][0]).toBe('https://svs.gsfc.nasa.gov/vis/redirected/lroc_color_2k.jpg');
    expect(fetchImpl.mock.calls.every(([, options]) => options.redirect === 'manual')).toBe(true);
  });

  it.each([
    ['external hostname', 'https://example.com/image.jpg'],
    ['unapproved NASA subdomain', 'https://cdn.svs.gsfc.nasa.gov/image.jpg'],
    ['non-default port', 'https://svs.gsfc.nasa.gov:8443/image.jpg'],
    ['embedded credentials', 'https://user:secret@svs.gsfc.nasa.gov/image.jpg'],
    ['unencrypted HTTP', 'http://svs.gsfc.nasa.gov/image.jpg']
  ])('never requests a redirect target with %s', async (_label, location) => {
    const cancel = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue(upstreamResponse(Buffer.alloc(0), {
      status: 302,
      location,
      body: byteStream([], { onCancel: cancel })
    }));
    const handler = createPlanetaryImageryHandler({ fetchImpl, cache: new Map() });
    const sink = responseSink();

    await handler({ params: { assetId: 'nasa-lroc-color-2025' } }, sink.res);

    expect(sink.statusCode).toBe(502);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalled();
  });

  it('stops after the configured redirect-hop limit', async () => {
    let responseNumber = 0;
    const fetchImpl = vi.fn(async () => {
      responseNumber += 1;
      return upstreamResponse(Buffer.alloc(0), {
        status: 302,
        location: '/redirect-' + responseNumber
      });
    });
    const handler = createPlanetaryImageryHandler({ fetchImpl, cache: new Map() });
    const sink = responseSink();

    await handler({ params: { assetId: 'nasa-lroc-color-2025' } }, sink.res);

    expect(sink.statusCode).toBe(502);
    expect(sink.body.error).toContain('redirect-hop limit');
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it.each([
    ['unexpected content type', jpegHeader(2048, 1024), { contentType: 'text/html' }],
    ['invalid JPEG bytes', Buffer.from('not a jpeg'), {}],
    ['non-equirectangular image', jpegHeader(1024, 1024), {}],
    ['final response URL outside the approved host', jpegHeader(2048, 1024), { url: 'https://example.com/image.jpg' }]
  ])('rejects %s', async (_label, bytes, options) => {
    const fetchImpl = vi.fn().mockResolvedValue(upstreamResponse(bytes, options));
    const handler = createPlanetaryImageryHandler({ fetchImpl, cache: new Map() });
    const sink = responseSink();

    await handler({ params: { assetId: 'nasa-lroc-color-2025' } }, sink.res);

    expect(sink.statusCode).toBe(502);
    expect(sink.body.error).toEqual(expect.any(String));
  });

  it('rejects an oversized declared Content-Length before reading the body', async () => {
    const cancel = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue(upstreamResponse(Buffer.alloc(0), {
      contentLength: 4 * 1024 * 1024 + 1,
      body: byteStream([], { onCancel: cancel })
    }));
    const handler = createPlanetaryImageryHandler({ fetchImpl, cache: new Map() });
    const sink = responseSink();

    await handler({ params: { assetId: 'nasa-lroc-color-2025' } }, sink.res);

    expect(sink.statusCode).toBe(502);
    expect(sink.body.error).toContain('byte limit');
    expect(cancel).toHaveBeenCalled();
  });

  it('cancels a chunked response as soon as the streamed bytes exceed the asset limit', async () => {
    const cancel = vi.fn();
    const body = byteStream([
      Buffer.alloc(3 * 1024 * 1024, 0x01),
      Buffer.alloc(2 * 1024 * 1024, 0x02),
      jpegHeader(2048, 1024)
    ], { onCancel: cancel });
    const fetchImpl = vi.fn().mockResolvedValue(upstreamResponse(Buffer.alloc(0), {
      contentLength: null,
      body
    }));
    const handler = createPlanetaryImageryHandler({ fetchImpl, cache: new Map() });
    const sink = responseSink();

    await handler({ params: { assetId: 'nasa-lroc-color-2025' } }, sink.res);

    expect(sink.statusCode).toBe(502);
    expect(sink.body.error).toContain('byte limit');
    expect(cancel).toHaveBeenCalled();
    expect(sink.headers['X-Imagery-Cache']).toBeUndefined();
  });

  it('returns HTTP 504 when the NASA origin exceeds the configured timeout', async () => {
    const fetchImpl = vi.fn((_url, { signal }) => new Promise((_resolve, reject) => {
      if (signal.aborted) {
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        return;
      }
      signal.addEventListener('abort', () => {
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      }, { once: true });
    }));
    const handler = createPlanetaryImageryHandler({ fetchImpl, cache: new Map(), timeoutMs: 1 });
    const sink = responseSink();

    await handler({ params: { assetId: 'nasa-noaa-cpc-clouds-2014-06-02' } }, sink.res);

    expect(sink.statusCode).toBe(504);
    expect(sink.body.error).toContain('timed out');
  });

  it('keeps the timeout active while the streamed body is being read', async () => {
    const fetchImpl = vi.fn((_url, { signal }) => Promise.resolve(upstreamResponse(Buffer.alloc(0), {
      contentLength: null,
      body: new ReadableStream({
        start(controller) {
          signal.addEventListener('abort', () => {
            controller.error(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          }, { once: true });
        }
      })
    })));
    const handler = createPlanetaryImageryHandler({ fetchImpl, cache: new Map(), timeoutMs: 5 });
    const sink = responseSink();

    await handler({ params: { assetId: 'nasa-noaa-cpc-clouds-2014-06-02' } }, sink.res);

    expect(sink.statusCode).toBe(504);
    expect(sink.body.error).toContain('timed out');
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
