import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_WINDOW_MS = 5 * 60 * 1000;

export function verifyAndParseTelemetry({ rawBody, timestamp, signature, secret, nowMs = Date.now(), windowMs = DEFAULT_WINDOW_MS }) {
  if (!Buffer.isBuffer(rawBody) || !secret) return { ok: false, status: 400, error: 'Signed raw body and server secret are required.' };
  const sentAt = Number(timestamp);
  if (!Number.isSafeInteger(sentAt) || Math.abs(nowMs - sentAt) > windowMs) {
    return { ok: false, status: 401, error: 'Telemetry signature timestamp is invalid or outside the replay window.' };
  }
  const expected = createHmac('sha256', secret).update(String(timestamp)).update('.').update(rawBody).digest();
  const suppliedHex = typeof signature === 'string' ? signature.replace(/^sha256=/, '') : '';
  if (!/^[a-f0-9]{64}$/i.test(suppliedHex)) return { ok: false, status: 401, error: 'Telemetry signature is malformed.' };
  const supplied = Buffer.from(suppliedHex, 'hex');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return { ok: false, status: 401, error: 'Telemetry signature verification failed.' };
  }

  let record;
  try { record = JSON.parse(rawBody.toString('utf8')); }
  catch { return { ok: false, status: 400, error: 'Telemetry payload must be valid JSON.' }; }
  const valid = record && typeof record === 'object' && !Array.isArray(record)
    && typeof record.spacecraftId === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(record.spacecraftId)
    && Number.isSafeInteger(record.sequence) && record.sequence >= 0
    && typeof record.observedAt === 'string' && Number.isFinite(Date.parse(record.observedAt))
    && ['GCRF', 'EME2000', 'ITRF'].includes(record.frame)
    && record.units?.position === 'm' && record.units?.velocity === 'm/s'
    && Array.isArray(record.positionM) && record.positionM.length === 3 && record.positionM.every(Number.isFinite)
    && Array.isArray(record.velocityMps) && record.velocityMps.length === 3 && record.velocityMps.every(Number.isFinite);
  if (!valid) return { ok: false, status: 400, error: 'Telemetry payload does not satisfy the v1 state-vector contract.' };
  return { ok: true, record: { ...record, receivedAt: new Date(nowMs).toISOString(), provenance: 'authenticated-source' } };
}

export function createTelemetryStore({ maxRecords = 1000, storagePath = null } = {}) {
  const latestBySpacecraft = new Map();
  const history = [];
  if (storagePath) {
    mkdirSync(dirname(storagePath), { recursive: true });
    if (existsSync(storagePath)) {
      const existing = readFileSync(storagePath, 'utf8').split(/\r?\n/).filter(Boolean);
      for (const line of existing) {
        try {
          const record = JSON.parse(line);
          if (typeof record.spacecraftId !== 'string' || !Number.isSafeInteger(record.sequence)) continue;
          const previous = latestBySpacecraft.get(record.spacecraftId);
          if (!previous || record.sequence > previous.sequence) latestBySpacecraft.set(record.spacecraftId, record);
          history.push(record);
        } catch { /* Ignore incomplete/corrupt trailing records; retain valid history. */ }
      }
      while (history.length > maxRecords) history.shift();
    }
  }
  return {
    accept(record) {
      const previous = latestBySpacecraft.get(record.spacecraftId);
      if (previous && record.sequence <= previous.sequence) {
        return { ok: false, status: 409, error: 'Telemetry sequence must increase monotonically for each spacecraft.' };
      }
      const frozen = Object.freeze({ ...record, positionM: [...record.positionM], velocityMps: [...record.velocityMps] });
      if (storagePath) {
        appendFileSync(storagePath, JSON.stringify(frozen) + '\n', { encoding: 'utf8', mode: 0o600 });
      }
      latestBySpacecraft.set(record.spacecraftId, frozen);
      history.push(frozen);
      while (history.length > maxRecords) history.shift();
      if (storagePath && history.length === maxRecords) {
        writeFileSync(storagePath, history.map(item => JSON.stringify(item)).join('\n') + '\n', { encoding: 'utf8', mode: 0o600 });
      }
      return { ok: true, record: frozen };
    },
    latest(spacecraftId) { return latestBySpacecraft.get(spacecraftId) ?? null; },
    history() { return [...history]; },
    get persisted() { return Boolean(storagePath); },
    get storage() { return storagePath ? 'append-only-file' : 'process-memory'; }
  };
}

/** Constant-time comparison for the separately scoped read token. */
export function verifyTelemetryReadToken(supplied, expected) {
  if (typeof supplied !== 'string' || typeof expected !== 'string' || !supplied || !expected) return false;
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes);
}

/** Extract a strict Bearer token without accepting malformed authorization schemes. */
export function parseBearerToken(header) {
  if (typeof header !== 'string') return '';
  const match = header.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] ?? '';
}
