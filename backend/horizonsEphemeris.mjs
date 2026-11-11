const API_URL = 'https://ssd.jpl.nasa.gov/api/horizons.api';
const TDB_EPOCH_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?$/;

/** Fetch the Moon's geometric state relative to Earth's centre from JPL Horizons. */
export async function fetchMoonStateAtTdbEpoch(epochTdb, fetchImpl = fetch) {
  if (typeof epochTdb !== 'string' || !TDB_EPOCH_PATTERN.test(epochTdb)) {
    throw new Error('epochTdb must be an ISO calendar timestamp without a timezone suffix; it is interpreted as TDB.');
  }
  const date = new Date(epochTdb + 'Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 19) !== epochTdb.slice(0, 19)) throw new Error('epochTdb is not a valid calendar date.');
  const params = new URLSearchParams({
    format: 'json',
    COMMAND: "'301'",
    OBJ_DATA: "'YES'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'VECTORS'",
    CENTER: "'500@399'",
    REF_PLANE: "'FRAME'",
    REF_SYSTEM: "'ICRF'",
    TIME_TYPE: "'TDB'",
    OUT_UNITS: "'KM-S'",
    VEC_TABLE: "'2'",
    VEC_CORR: "'NONE'",
    VEC_LABELS: "'NO'",
    CSV_FORMAT: "'YES'",
    TIME_DIGITS: "'FRACSEC'",
    TLIST_TYPE: "'CAL'",
    TLIST: "'" + epochTdb.replace('T', ' ') + "'"
  });
  const response = await fetchImpl(API_URL + '?' + params.toString(), {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error('JPL Horizons returned HTTP ' + response.status + '.');
  const payload = await response.json();
  if (typeof payload?.result !== 'string' || !String(payload?.signature?.source || '').toLowerCase().includes('jpl')) {
    throw new Error('JPL Horizons response is missing its expected source signature or ephemeris result.');
  }
  const section = payload.result.match(/\$\$SOE([\s\S]*?)\$\$EOE/);
  if (!section) throw new Error('JPL Horizons returned no state vector for the requested epoch.');
  const row = section[1].split(/\r?\n/).map(value => value.trim()).find(Boolean);
  if (!row) throw new Error('JPL Horizons returned an empty state-vector record.');
  const fields = row.split(',').map(value => value.trim());
  if (fields.length < 8) throw new Error('JPL Horizons vector record has an unexpected column count.');
  const values = fields.slice(2, 8).map(value => Number(value));
  if (values.length !== 6 || !values.every(Number.isFinite)) throw new Error('JPL Horizons vector record contains invalid numeric values.');
  const kernelMatch = payload.result.match(/Ephemeris system:\s*(DE\d+)/i);
  return {
    body: 'MOON',
    epoch: epochTdb,
    timeScale: 'TDB',
    frame: 'ICRF',
    positionM: values.slice(0, 3).map(value => value * 1000),
    velocityMps: values.slice(3, 6).map(value => value * 1000),
    source: 'JPL-HORIZONS',
    kernelId: kernelMatch?.[1] ?? null,
    coverageStart: epochTdb,
    coverageEnd: epochTdb,
    positionUncertaintyM: null,
    provenance: {
      provider: payload.signature.source,
      apiVersion: payload.signature.version ?? null,
      centre: 'Earth centre (500@399)',
      correction: 'Geometric state; no light-time or stellar-aberration correction',
      kernelReported: kernelMatch?.[1] ?? null
    }
  };
}
