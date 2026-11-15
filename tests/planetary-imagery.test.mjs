import { describe, expect, it } from 'vitest';
import { createPlanetaryImageryHandler } from '../backend/planetaryImagery.mjs';

function fakeResponse() {
  let statusCode = 200;
  let payload;
  const headers = {};
  return {
    get statusCode() { return statusCode; },
    get payload() { return payload; },
    status(code) { statusCode = code; return this; },
    set(values) { Object.assign(headers, values); return this; },
    json(value) { payload = value; return this; },
    send(value) { payload = value; return this; }
  };
}

describe('NASA imagery proxy bounds', () => {
  it('rejects a chunked image that exceeds the asset byte limit', async () => {
    const handler = createPlanetaryImageryHandler({
      fetchImpl: async () => new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(4 * 1024 * 1024 + 1));
          controller.close();
        }
      }), { status: 200, headers: { 'content-type': 'image/jpeg' } })
    });
    const res = fakeResponse();
    await handler({ params: { assetId: 'nasa-noaa-cpc-clouds-2014-06-02' } }, res);
    expect(res.statusCode).toBe(502);
    expect(res.payload.error).toContain('exceeded the configured byte limit');
  });

  it('rejects an oversized declared content length before reading the body', async () => {
    const handler = createPlanetaryImageryHandler({
      fetchImpl: async () => new Response(new Uint8Array([0xff, 0xd8]), {
        status: 200,
        headers: { 'content-type': 'image/jpeg', 'content-length': String(5 * 1024 * 1024) }
      })
    });
    const res = fakeResponse();
    await handler({ params: { assetId: 'nasa-noaa-cpc-clouds-2014-06-02' } }, res);
    expect(res.statusCode).toBe(502);
    expect(res.payload.error).toContain('exceeded the configured byte limit');
  });
});
