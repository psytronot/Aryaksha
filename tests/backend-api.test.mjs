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
    env: { ...process.env, PORT: String(port), OREKIT_SERVICE_URL: '' },
    stdio: 'ignore'
  });
  await waitForHealth(baseUrl, apiProcess);
}, 20_000);

afterAll(() => {
  if (apiProcess && apiProcess.exitCode === null) apiProcess.kill('SIGTERM');
});

describe('standalone orbit-analysis HTTP contract', () => {
  it('returns the explicit analytical baseline when no Orekit URL is configured', async () => {
    const response = await fetch(`${baseUrl}/api/mission-analysis/orbit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ altitudeKm: 550, inclinationDeg: 97.6, eccentricity: 0.001 })
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.valid).toBe(true);
    expect(payload.engine).toBe('Aryaksha Kepler baseline');
    expect(payload.comparison).toMatchObject({ engineAdapter: 'kepler-baseline', status: 'baseline' });
    expect(payload.orbit.periodMinutes).toBeCloseTo(95.65, 1);
  });

  it.each([
    ['numeric strings', { altitudeKm: '550', inclinationDeg: '97.6', eccentricity: '0.001' }],
    ['additional fields', { altitudeKm: 550, inclinationDeg: 97.6, eccentricity: 0.001, surprise: true }],
    ['missing required field', { altitudeKm: 550, inclinationDeg: 97.6 }],
    ['null body', null],
    ['array body', [550, 97.6, 0.001]]
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
});
