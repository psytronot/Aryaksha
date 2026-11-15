import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const orekitUrl = process.env.OREKIT_SERVICE_URL?.trim();
if (!orekitUrl) throw new Error('OREKIT_SERVICE_URL must point to the local Orekit test service.');

async function getAvailablePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const address = probe.address();
  if (!address || typeof address === 'string') throw new Error('Unable to allocate a local API port.');
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  return address.port;
}

async function waitFor(url, child, label) {
  const deadline = Date.now() + 45_000;
  let lastError;
  while (Date.now() < deadline) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) {
      throw new Error(`${label} exited before becoming ready (code ${child.exitCode}).`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`${label} returned HTTP ${response.status}.`);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`${label} did not become ready: ${lastError}`);
}

const orekitHealth = await fetch(`${orekitUrl}/api/v1/health`);
assert.equal(orekitHealth.status, 200, 'Orekit health endpoint must be ready.');
const health = await orekitHealth.json();
assert.equal(health.status, 'ok');
assert.equal(health.engine, 'Orekit');

const port = await getAvailablePort();
const apiUrl = `http://127.0.0.1:${port}`;
const api = spawn(process.execPath, ['backend/server.mjs'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port), OREKIT_SERVICE_URL: orekitUrl },
  stdio: 'inherit',
});

try {
  await waitFor(`${apiUrl}/api/v1/health`, api, 'Aryaksha API');

  const state = {
    positionKm: [6928.137, 0, 0],
    velocityKmS: [0, 7.585088535, 0],
  };
  const request = {
    epochTai: '2026-11-15T12:00:00',
    target: state,
    chaser: {
      positionKm: [6928.237, -0.2, 0.05],
      velocityKmS: [0.0001, 7.585398018, -0.00005],
    },
    elapsedSeconds: 900,
  };

  const response = await fetch(`${apiUrl}/api/rpod/relative-state`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(request),
  });
  const payload = await response.json();
  assert.equal(response.status, 200, JSON.stringify(payload));
  assert.equal(payload.valid, true);
  assert.equal(payload.engine, 'Orekit');
  assert.equal(payload.frame, 'EME2000 / target LVLH');
  assert.match(payload.epoch, /^2026-11-15T/);
  for (const component of [...payload.relativeLvlh.positionKm, ...payload.relativeLvlh.velocityKmS]) {
    assert.equal(Number.isFinite(component), true, 'Relative LVLH components must be finite.');
  }
  assert.equal(payload.comparison.engineAdapter, 'orekit-rpod-http');

  const invalidEpoch = await fetch(`${orekitUrl}/api/v1/rpod/relative-state`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...request, epochTai: 'not-a-date' }),
  });
  const invalidEpochPayload = await invalidEpoch.json();
  assert.equal(invalidEpoch.status, 400);
  assert.match(invalidEpochPayload.error, /epochTai/);

  const earthIntersecting = {
    ...request,
    target: { positionKm: [7000, 0, 0], velocityKmS: [0, 6, 0] },
  };
  const invalidOrbit = await fetch(`${orekitUrl}/api/v1/rpod/relative-state`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(earthIntersecting),
  });
  const invalidOrbitPayload = await invalidOrbit.json();
  assert.equal(invalidOrbit.status, 400);
  assert.match(invalidOrbitPayload.error, /periapsis intersects/);

  console.log('RPOD local integration smoke passed: proxy → Orekit, explicit TAI epoch, finite LVLH response and invalid-input rejection.');
} finally {
  if (api.exitCode === null) api.kill('SIGTERM');
}
