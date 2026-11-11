import { createHmac } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTelemetryStore, verifyAndParseTelemetry, verifyTelemetryReadToken, parseBearerToken } from '../backend/telemetry.mjs';

const secret = 'test-only-secret';
const payload = {
  spacecraftId: 'ARY-SC-001', sequence: 7, observedAt: '2026-11-11T00:00:00.000Z',
  frame: 'GCRF', units: { position: 'm', velocity: 'm/s' },
  positionM: [7000000, 0, 0], velocityMps: [0, 7500, 0]
};
function signed(rawBody, timestamp = '1794355200000') {
  const signature = createHmac('sha256', secret).update(timestamp).update('.').update(rawBody).digest('hex');
  return { rawBody, timestamp, signature, secret, nowMs: Number(timestamp) };
}

describe('authenticated telemetry ingestion', () => {
  it('accepts a valid signed state vector and attaches server receipt provenance', () => {
    const rawBody = Buffer.from(JSON.stringify(payload));
    const result = verifyAndParseTelemetry(signed(rawBody));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.provenance).toBe('authenticated-source');
      expect(result.record.receivedAt).toBe(new Date(1794355200000).toISOString());
    }
  });

  it('rejects invalid signatures, stale timestamps and malformed vectors', () => {
    const rawBody = Buffer.from(JSON.stringify(payload));
    expect(verifyAndParseTelemetry({ ...signed(rawBody), signature: '0'.repeat(64) }).status).toBe(401);
    expect(verifyAndParseTelemetry({ ...signed(rawBody), nowMs: 1794355200000 + 600001 }).status).toBe(401);
    const invalid = Buffer.from(JSON.stringify({ ...payload, positionM: [1, 2] }));
    expect(verifyAndParseTelemetry(signed(invalid)).status).toBe(400);
  });

  it('rejects repeated or out-of-order per-spacecraft sequence numbers', () => {
    const store = createTelemetryStore();
    expect(store.accept({ ...payload, sequence: 2 }).ok).toBe(true);
    expect(store.accept({ ...payload, sequence: 2 }).status).toBe(409);
    expect(store.accept({ ...payload, sequence: 1 }).status).toBe(409);
    expect(store.latest(payload.spacecraftId).sequence).toBe(2);
  });
});

describe('telemetry read authorization', () => {
  it('requires a non-empty exact bearer token and rejects mismatches', () => {
    expect(verifyTelemetryReadToken('read-secret', 'read-secret')).toBe(true);
    expect(verifyTelemetryReadToken('wrong', 'read-secret')).toBe(false);
    expect(verifyTelemetryReadToken('', 'read-secret')).toBe(false);
    expect(verifyTelemetryReadToken('read-secret', '')).toBe(false);
  });
});

describe('telemetry bearer header parsing', () => {
  it('extracts only a well-formed Bearer credential', () => {
    expect(parseBearerToken('Bearer read-secret')).toBe('read-secret');
    expect(parseBearerToken('bearer read-secret')).toBe('read-secret');
    expect(parseBearerToken('Basic read-secret')).toBe('');
    expect(parseBearerToken('Bearer')).toBe('');
    expect(parseBearerToken('Bearer read secret')).toBe('');
    expect(parseBearerToken(undefined)).toBe('');
  });
});

describe('optional durable telemetry store', () => {
  it('replays accepted records and sequence state from an append-only file', () => {
    const directory = mkdtempSync(join(tmpdir(), 'aryaksha-telemetry-'));
    const storagePath = join(directory, 'telemetry.jsonl');
    try {
      const first = createTelemetryStore({ storagePath });
      expect(first.persisted).toBe(true);
      expect(first.storage).toBe('append-only-file');
      expect(first.accept({ ...payload, sequence: 11 }).ok).toBe(true);

      const restarted = createTelemetryStore({ storagePath });
      expect(restarted.latest(payload.spacecraftId).sequence).toBe(11);
      expect(restarted.accept({ ...payload, sequence: 10 }).status).toBe(409);
      expect(restarted.accept({ ...payload, sequence: 12 }).ok).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('reports process memory as non-durable when no persistent path is configured', () => {
    const store = createTelemetryStore({ storagePath: undefined });
    expect(store.persisted).toBe(false);
    expect(store.storage).toBe('process-memory');
  });
});
