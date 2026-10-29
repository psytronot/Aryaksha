import { describe, expect, it } from 'vitest';
import { createRateLimiter, securityHeaders } from '../backend/security.mjs';

function fakeResponse() {
  const headers = {};
  let statusCode = 200;
  let body;
  const response = {
    setHeader(name, value) { headers[name.toLowerCase()] = value; },
    status(code) { statusCode = code; return this; },
    json(value) { body = value; return this; }
  };
  return { response, headers, get statusCode() { return statusCode; }, get body() { return body; } };
}

describe('API security middleware', () => {
  it('sets baseline security headers on every response', () => {
    const result = fakeResponse();
    let continued = false;
    securityHeaders({}, result.response, () => { continued = true; });
    expect(continued).toBe(true);
    expect(result.headers['x-content-type-options']).toBe('nosniff');
    expect(result.headers['x-frame-options']).toBe('DENY');
    expect(result.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(result.headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
    expect(result.headers['content-security-policy-report-only']).toContain("default-src 'self'");
    expect(result.headers['content-security-policy-report-only']).toContain("connect-src 'self' https://celestrak.org");
    expect(result.headers['content-security-policy-report-only']).toContain("object-src 'none'");
  });

  it('limits requests per client and resets after the time window', () => {
    let currentTime = 1_000;
    const limiter = createRateLimiter({ windowMs: 1_000, maxRequests: 2, now: () => currentTime });
    const call = (ip) => {
      const result = fakeResponse();
      let continued = false;
      limiter({ ip }, result.response, () => { continued = true; });
      return { ...result, continued };
    };

    expect(call('192.0.2.1').continued).toBe(true);
    expect(call('192.0.2.1').continued).toBe(true);
    const blocked = call('192.0.2.1');
    expect(blocked.continued).toBe(false);
    expect(blocked.statusCode).toBe(429);
    expect(blocked.body.error).toContain('Rate limit exceeded');
    expect(blocked.headers['retry-after']).toBe('1');

    currentTime += 1_000;
    expect(call('192.0.2.1').continued).toBe(true);
  });

  it('keeps client budgets isolated', () => {
    let currentTime = 5_000;
    const limiter = createRateLimiter({ windowMs: 1_000, maxRequests: 1, now: () => currentTime });
    const call = (ip) => {
      const result = fakeResponse();
      let continued = false;
      limiter({ ip }, result.response, () => { continued = true; });
      return { ...result, continued };
    };
    expect(call('192.0.2.1').continued).toBe(true);
    expect(call('192.0.2.2').continued).toBe(true);
    expect(call('192.0.2.1').statusCode).toBe(429);
  });
});
