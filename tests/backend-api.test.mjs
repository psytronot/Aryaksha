import { spawn } from 'node:child_process';
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
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  return address.port;
}

async function waitForHealth(url, child) {
  const deadline = Date.now() + 15_000;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`API process exited before becoming healthy (code ${child.exitCode}).`);
    try {
      const response = await fetch(`${url}/api/v1/health`);
      if (response.ok) return;
      lastError = new Error(`Health endpoint returned HTTP ${response.status}.`);
    } catch (error) { lastError = error; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`API did not become healthy within 15 seconds: ${lastError}`);
}

beforeAll(async () => {
  const port = await getAvailablePort();
  baseUrl = `http://127.0.0.1:${port}`;
  apiProcess = spawn(process.execPath, ['backend/server.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), OREKIT_SERVICE_URL: '' },
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
      method: 'POST', headers: { 'content-type': 'application/json' },
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
  ])('rejects %s in the orbit-analysis contract', async (_label, requestBody) => {
    const response = await fetch(`${baseUrl}/api/mission-analysis/orbit`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(requestBody)
    });
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.error).toEqual(expect.any(String));
    expect(payload.error.length).toBeGreaterThan(0);
  });

  it('rejects an Earth-intersecting orbit', async () => {
    const response = await fetch(`${baseUrl}/api/mission-analysis/orbit`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ altitudeKm: 120, inclinationDeg: 45, eccentricity: 0.02 })
    });
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.error).toContain('intersects Earth');
  });

  it('returns structured errors for malformed and oversized JSON', async () => {
    const malformed = await fetch(`${baseUrl}/api/mission-analysis/orbit`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"altitudeKm":'
    });
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).error).toBe('Request body must be valid JSON.');

    const oversized = await fetch(`${baseUrl}/api/mission-analysis/orbit`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ altitudeKm: 550, inclinationDeg: 97.6, eccentricity: 0.001, padding: 'x'.repeat(70 * 1024) })
    });
    expect(oversized.status).toBe(413);
    expect((await oversized.json()).error).toBe('Request body exceeds the 64 KiB limit.');
  });

  it('sets no-store on API responses', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('rejects negative, non-numeric and excessive simulation time', async () => {
    for (const seconds of [-1, '10', 604800.01]) {
      const response = await fetch(`${baseUrl}/api/simulation/propagate`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ seconds, mode: 'tle', tle: { line1: '', line2: '' } })
      });
      expect(response.status).toBe(400);
      expect((await response.json()).error).toContain('Simulation time');
    }
  });

  it('rejects unexpected simulation fields', async () => {
    const response = await fetch(`${baseUrl}/api/simulation/propagate`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ seconds: 0, mode: 'tle', tle: { line1: '', line2: '' }, admin: true })
    });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('seconds, mode and tle only');
  });

  it('rejects TLE propagation when either TLE line is missing', async () => {
    const response = await fetch(`${baseUrl}/api/simulation/propagate`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ seconds: 0, mode: 'tle', tle: { line1: '', line2: '' } })
    });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Both TLE lines are required.');
  });

  it('rejects malformed TLE lines and unexpected TLE properties', async () => {
    const malformed = await fetch(`${baseUrl}/api/simulation/propagate`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ seconds: 0, mode: 'tle', tle: { line1: '1'.repeat(69), line2: '2'.repeat(69) } })
    });
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).error).toContain('69-character');

    const extra = await fetch(`${baseUrl}/api/simulation/propagate`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ seconds: 0, mode: 'tle', tle: { line1: 'x', line2: 'y', privileged: true } })
    });
    expect(extra.status).toBe(400);
    expect((await extra.json()).error).toContain('line1, line2 and optional name only');
  });
});
