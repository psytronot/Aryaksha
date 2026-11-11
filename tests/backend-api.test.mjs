import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let apiProcess;
let baseUrl;

async function getAvailablePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });

  const address = probe.address();
  if (!address || typeof address === 'string') {
    await new Promise(resolve => probe.close(resolve));
    throw new Error('Could not allocate a local test port.');
  }

  await new Promise((resolve, reject) => {
    probe.close(error => error ? reject(error) : resolve());
  });
  return address.port;
}

async function waitForHealth(url, child) {
  const deadline = Date.now() + 15_000;
  let lastError;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`API process exited before becoming healthy (code ${child.exitCode}).`);
    }

    try {
      const response = await fetch(`${url}/api/v1/health`);
      if (response.ok) return;
      lastError = new Error(`Health endpoint returned HTTP ${response.status}.`);
    } catch (error) {
      lastError = error;
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw new Error(`API did not become healthy within 15 seconds: ${lastError}`);
}

beforeAll(async () => {
  const port = await getAvailablePort();
  baseUrl = `http://127.0.0.1:${port}`;
  apiProcess = spawn(process.execPath, ['backend/server.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), OREKIT_SERVICE_URL: '', ARYAKSHA_TELEMETRY_HMAC_SECRET: 'integration-test-ingest-secret', ARYAKSHA_TELEMETRY_READ_TOKEN: 'integration-test-read-secret' },
    stdio: 'ignore'
  });
  await waitForHealth(baseUrl, apiProcess);
}, 20_000);

afterAll(() => {
  if (apiProcess && apiProcess.exitCode === null) apiProcess.kill('SIGTERM');
});

describe('standalone orbit-analysis HTTP contract', () => {
  it('fails explicitly when Orekit is not configured instead of returning a misleading fallback', async () => {
    const response = await fetch(`${baseUrl}/api/mission-analysis/orbit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ altitudeKm: 550, inclinationDeg: 97.6, eccentricity: 0.001 })
    });
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.error).toContain('Orekit service is not configured');
  });

  it.each([
    ['numeric strings', { altitudeKm: '550', inclinationDeg: '97.6', eccentricity: '0.001' }],
    ['additional fields', { altitudeKm: 550, inclinationDeg: 97.6, eccentricity: 0.001, surprise: true }],
    ['missing required field', { altitudeKm: 550, inclinationDeg: 97.6 }],
    ['null body', null],
    ['array body', [550, 97.6, 0.001]],
    ['negative propagation time', { altitudeKm: 550, inclinationDeg: 97.6, eccentricity: 0.001, elapsedSeconds: -1 }],
    ['propagation time beyond seven days', { altitudeKm: 550, inclinationDeg: 97.6, eccentricity: 0.001, elapsedSeconds: 604800.01 }],
    ['string propagation time', { altitudeKm: 550, inclinationDeg: 97.6, eccentricity: 0.001, elapsedSeconds: '600' }]
  ])('rejects %s in the request contract', async (_label, requestBody) => {
    const response = await fetch(`${baseUrl}/api/mission-analysis/orbit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toEqual(expect.any(String));
    expect(payload.error.length).toBeGreaterThan(0);
  });

  it('rejects an unsupported force model at the web API boundary', async () => {
    const response = await fetch(`${baseUrl}/api/mission-analysis/orbit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ altitudeKm: 550, inclinationDeg: 97.6, eccentricity: 0.001, forceModel: 'UNSUPPORTED' })
    });
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.error).toContain('forceModel must be TWO_BODY or J2');
  });

  it('accepts J2 as a valid model choice and then reports unavailable Orekit explicitly', async () => {
    const response = await fetch(`${baseUrl}/api/mission-analysis/orbit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ altitudeKm: 550, inclinationDeg: 97.6, eccentricity: 0.001, forceModel: 'J2' })
    });
    const payload = await response.json();
    expect(response.status).toBe(503);
    expect(payload.error).toContain('Orekit service is not configured');
  });

  it('rejects a malformed TDB ephemeris epoch before making an upstream request', async () => {
    const response = await fetch(`${baseUrl}/api/v1/ephemeris/moon?epochTdb=not-a-date`);
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.error).toContain('epochTdb');
  });

  it('rejects a physically Earth-intersecting orbit even when each field is in range', async () => {
    const response = await fetch(`${baseUrl}/api/mission-analysis/orbit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ altitudeKm: 120, inclinationDeg: 45, eccentricity: 0.02 })
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain('intersects Earth');
  });

  it('returns a structured JSON error for malformed JSON', async () => {
    const response = await fetch(`${baseUrl}/api/mission-analysis/orbit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"altitudeKm":'
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(payload.error).toBe('Request body must be valid JSON.');
  });

  it('returns a structured JSON error when the request body exceeds 64 KiB', async () => {
    const body = JSON.stringify({
      altitudeKm: 550,
      inclinationDeg: 97.6,
      eccentricity: 0.001,
      padding: 'x'.repeat(70 * 1024)
    });
    const response = await fetch(`${baseUrl}/api/mission-analysis/orbit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body
    });
    const payload = await response.json();

    expect(response.status).toBe(413);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(payload.error).toBe('Request body exceeds the 64 KiB limit.');
  });

  it('rejects negative simulation time with a structured JSON error', async () => {
    const response = await fetch(`${baseUrl}/api/simulation/propagate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ seconds: -1 })
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('Simulation time must be finite and non-negative.');
  });

  it('rejects TLE propagation when either TLE line is missing', async () => {
    const response = await fetch(`${baseUrl}/api/simulation/propagate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ seconds: 0, mode: 'tle', tle: { line1: '', line2: '' } })
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('Both TLE lines are required.');
  });

});

describe('authenticated telemetry HTTP contract', () => {
  const telemetry = {
    spacecraftId: 'ARY-TEST-HTTP-01',
    sequence: 1,
    observedAt: '2026-11-11T00:00:00.000Z',
    frame: 'GCRF',
    units: { position: 'm', velocity: 'm/s' },
    positionM: [7000000, 0, 0],
    velocityMps: [0, 7500, 0]
  };

  async function ingest(body = telemetry, signatureOverride) {
    const rawBody = JSON.stringify(body);
    const timestamp = String(Date.now());
    const signature = signatureOverride ?? createHmac('sha256', 'integration-test-ingest-secret')
      .update(timestamp).update('.').update(rawBody).digest('hex');
    return fetch(`${baseUrl}/api/v1/telemetry/ingest`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-aryaksha-timestamp': timestamp,
        'x-aryaksha-signature': `sha256=${signature}`
      },
      body: rawBody
    });
  }

  it('accepts signed telemetry and exposes it only with the read bearer token', async () => {
    const accepted = await ingest();
    const acceptedBody = await accepted.json();
    expect(accepted.status).toBe(202);
    expect(acceptedBody.accepted).toBe(true);
    expect(acceptedBody.persisted).toBe(false);
    expect(acceptedBody.storage).toBe('process-memory');

    const denied = await fetch(`${baseUrl}/api/v1/telemetry/ARY-TEST-HTTP-01/latest`);
    expect(denied.status).toBe(401);

    const allowed = await fetch(`${baseUrl}/api/v1/telemetry/ARY-TEST-HTTP-01/latest`, {
      headers: { authorization: 'Bearer integration-test-read-secret' }
    });
    const latest = await allowed.json();
    expect(allowed.status).toBe(200);
    expect(latest.record.spacecraftId).toBe('ARY-TEST-HTTP-01');
    expect(latest.record.sequence).toBe(1);
  });

  it('rejects an invalid HMAC signature', async () => {
    const response = await ingest({ ...telemetry, spacecraftId: 'ARY-TEST-HTTP-BAD' }, '0'.repeat(64));
    expect(response.status).toBe(401);
  });
});

describe('deployed API security boundary', () => {
  it('returns baseline security headers from the health endpoint', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`);
    expect(response.status).toBe(200);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('content-security-policy-report-only')).toContain("default-src 'self'");
  });

  it('rate-limits a client after the configured request budget', async () => {
    const clientIp = '198.51.100.77';
    let lastResponse;
    for (let index = 0; index < 61; index += 1) {
      lastResponse = await fetch(`${baseUrl}/api/v1/ephemeris/moon?epochTdb=invalid`, {
        headers: { 'x-forwarded-for': clientIp }
      });
      if (index < 60) expect(lastResponse.status).toBe(400);
    }
    expect(lastResponse.status).toBe(429);
    const payload = await lastResponse.json();
    expect(payload.error).toContain('Rate limit exceeded');
  });
});
