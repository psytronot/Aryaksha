import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createServer as createHttpServer } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let apiProcess;
let apiUrl;
let upstreamServer;
let upstreamUrl;
let lastRequest;

async function availablePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const address = probe.address();
  if (!address || typeof address === 'string') throw new Error('Could not allocate a test port.');
  const port = address.port;
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  return port;
}

async function waitForHealth(url, child) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`API process exited with code ${child.exitCode}.`);
    try {
      const response = await fetch(`${url}/api/_healthcheck`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('API did not become healthy within 15 seconds.');
}

beforeAll(async () => {
  upstreamServer = createHttpServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    lastRequest = JSON.parse(Buffer.concat(chunks).toString('utf8'));

    if (lastRequest.elapsedSeconds === 123) {
      response.writeHead(400, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'The selected orbit intersects Earth at periapsis.' }));
      return;
    }

    if (lastRequest.elapsedSeconds === 124) {
      response.writeHead(429, { 'content-type': 'application/json', 'retry-after': '30' });
      response.end(JSON.stringify({ error: 'Too Many Requests' }));
      return;
    }

    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({
      valid: true,
      engine: 'Orekit',
      engineVersion: '13.1.9',
      fidelity: 'Orekit numerical propagation (two-body)',
      assumptions: ['Newtonian central gravity only'],
      orbit: { periodMinutes: 95.65 },
      state: { elapsedSeconds: lastRequest.elapsedSeconds, epoch: '2000-01-01T12:09:27.816', timeScale: 'TAI', frame: 'EME2000', positionKm: [1, 2, 3], velocityKmS: [4, 5, 6] },
      comparison: { engineAdapter: 'orekit-http', status: 'connected', note: 'Mocked upstream response for proxy contract testing.' }
    }));
  });
  const upstreamPort = await availablePort();
  await new Promise(resolve => upstreamServer.listen(upstreamPort, '127.0.0.1', resolve));
  upstreamUrl = `http://127.0.0.1:${upstreamPort}`;

  const apiPort = await availablePort();
  apiUrl = `http://127.0.0.1:${apiPort}`;
  apiProcess = spawn(process.execPath, ['backend/server.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(apiPort), OREKIT_SERVICE_URL: upstreamUrl },
    stdio: 'ignore'
  });
  await waitForHealth(apiUrl, apiProcess);
}, 25000);

afterAll(async () => {
  if (apiProcess && apiProcess.exitCode === null) apiProcess.kill('SIGTERM');
  if (upstreamServer?.listening) await new Promise(resolve => upstreamServer.close(resolve));
});

describe('Orekit upstream proxy contract', () => {
  it('forwards numeric mission parameters and returns the numerical result', async () => {
    const response = await fetch(`${apiUrl}/api/mission-analysis/orbit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ altitudeKm: 550, inclinationDeg: 97.6, eccentricity: 0.001, elapsedSeconds: 600 })
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(lastRequest).toEqual({ altitudeKm: 550, inclinationDeg: 97.6, eccentricity: 0.001, elapsedSeconds: 600 });
    expect(payload.engine).toBe('Orekit');
    expect(payload.state.elapsedSeconds).toBe(600);
  });

  it('surfaces a sanitized upstream validation reason instead of hiding it behind a generic 502', async () => {
    const response = await fetch(`${apiUrl}/api/mission-analysis/orbit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ altitudeKm: 550, inclinationDeg: 45, eccentricity: 0.001, elapsedSeconds: 123 })
    });
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.error).toContain('The selected orbit intersects Earth at periapsis.');
  });

  it('converts upstream rate limiting into a retryable service-unavailable response', async () => {
    const response = await fetch(`${apiUrl}/api/mission-analysis/orbit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ altitudeKm: 550, inclinationDeg: 45, eccentricity: 0.001, elapsedSeconds: 124 })
    });
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('30');
    expect(payload.error).toContain('temporarily rate-limited');
  });
});
