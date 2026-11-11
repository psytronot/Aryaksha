import { describe, expect, it, vi } from 'vitest';
import { fetchMoonStateAtTdbEpoch } from '../backend/horizonsEphemeris.mjs';

describe('JPL Horizons Moon state adapter', () => {
  it('requests a geocentric ICRF TDB state and converts km to metres', async () => {
    const fetchMock = vi.fn(async (url) => {
      const parsed = new URL(url);
      expect(parsed.searchParams.get('COMMAND')).toBe("'301'");
      expect(parsed.searchParams.get('CENTER')).toBe("'500@399'");
      expect(parsed.searchParams.get('REF_PLANE')).toBe("'FRAME'");
      expect(parsed.searchParams.get('TIME_TYPE')).toBe("'TDB'");
      return {
        ok: true,
        json: async () => ({
          signature: { source: 'NASA/JPL Horizons API', version: '1.3' },
          result: 'Ephemeris system: DE441\n$$SOE\n2461356.375, A.D. 2026-Nov-11 21:00:00.0000, 384400, 0, 0, 0, 1.022, 0\n$$EOE'
        })
      };
    });
    const state = await fetchMoonStateAtTdbEpoch('2026-11-11T21:00:00.000', fetchMock);
    expect(state.frame).toBe('ICRF');
    expect(state.kernelId).toBe('DE441');
    expect(state.positionM).toEqual([384400000, 0, 0]);
    expect(state.velocityMps).toEqual([0, 1022, 0]);
    expect(state.positionUncertaintyM).toBeNull();
  });

  it('rejects timezone-ambiguous input and malformed Horizons vectors', async () => {
    await expect(fetchMoonStateAtTdbEpoch('2026-11-11T21:00:00Z', vi.fn())).rejects.toThrow(/without a timezone/);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ signature: { source: 'NASA/JPL Horizons API' }, result: '$$SOE\\nnot,a,state,vector\\n$$EOE' })
    }));
    await expect(fetchMoonStateAtTdbEpoch('2026-11-11T21:00:00.000', fetchMock)).rejects.toThrow(/column count/);
  });
});
