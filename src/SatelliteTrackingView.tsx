import { useEffect, useMemo, useState } from 'react';
import * as satellite from 'satellite.js';
import {
  Activity, Clock3, Download, ExternalLink, MapPin, Radio,
  RefreshCw, Satellite as SatelliteIcon, Search, Target, Waves
} from 'lucide-react';
import { generateContinuousGroundTrack, parseTle, SubPoint, Tracking } from './tracking';
import './satellite-tracking.css';
import { Globe2 } from 'lucide-react';

type Tle = { name: string; line1: string; line2: string };
type CatalogGroup = 'stations' | 'amateur' | 'active' | 'weather' | 'starlink' | 'geosync' | 'gps-ops';
type Station = { lat: number; lon: number; heightM: number };
type SkyPoint = { azimuth: number; elevation: number };
type Look = SkyPoint & {
  rangeKm: number;
  latitude: number;
  longitude: number;
  altitudeKm: number;
  rangeRateKmS: number;
  dopplerHz: number;
};
type Pass = {
  aos: Date;
  los: Date;
  peak: Date;
  maxElevation: number;
  points: SkyPoint[];
};

const DEG = Math.PI / 180;
const C_M_S = 299792458;
const GROUPS: { value: CatalogGroup; label: string }[] = [
  { value: 'stations', label: 'Space stations' },
  { value: 'amateur', label: 'Amateur radio' },
  { value: 'active', label: 'Active satellites' },
  { value: 'weather', label: 'Weather satellites' },
  { value: 'starlink', label: 'Starlink' },
  { value: 'geosync', label: 'Geostationary' },
  { value: 'gps-ops', label: 'GPS / navigation' }
];

function parseCatalog(text: string): Tle[] {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const entries: Tle[] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    if (!lines[i].startsWith('1 ') || !lines[i + 1].startsWith('2 ')) continue;
    const previous = lines[i - 1];
    const name = previous && !/^[12]\s/.test(previous)
      ? previous.replace(/^0\s+/, '')
      : 'NORAD ' + lines[i + 1].slice(2, 7).trim();
    entries.push({ name, line1: lines[i], line2: lines[i + 1] });
    i++;
  }
  return entries;
}

function lookAt(tracking: Tracking, date: Date, station: Station, frequencyMHz: number): Look | null {
  const lib = satellite as any;
  const state = lib.propagate(tracking.satrec, date);
  if (!state?.position) return null;

  const gmst = lib.gstime(date);
  const ecf = lib.eciToEcf(state.position, gmst);
  const observer = {
    latitude: station.lat * DEG,
    longitude: station.lon * DEG,
    height: station.heightM / 1000
  };
  const look = lib.ecfToLookAngles(observer, ecf);
  const geo = lib.eciToGeodetic(state.position, gmst);

  const before = lib.propagate(tracking.satrec, new Date(date.getTime() - 1000));
  const after = lib.propagate(tracking.satrec, new Date(date.getTime() + 1000));
  let rangeRateKmS = 0;
  if (before?.position && after?.position) {
    const beforeEcf = lib.eciToEcf(before.position, lib.gstime(new Date(date.getTime() - 1000)));
    const afterEcf = lib.eciToEcf(after.position, lib.gstime(new Date(date.getTime() + 1000)));
    const beforeLook = lib.ecfToLookAngles(observer, beforeEcf);
    const afterLook = lib.ecfToLookAngles(observer, afterEcf);
    rangeRateKmS = (afterLook.rangeSat - beforeLook.rangeSat) / 2;
  }
  const dopplerHz = Number.isFinite(frequencyMHz) && frequencyMHz > 0
    ? -(rangeRateKmS * 1000 / C_M_S) * frequencyMHz * 1e6
    : 0;

  return {
    azimuth: (look.azimuth / DEG + 360) % 360,
    elevation: look.elevation / DEG,
    rangeKm: look.rangeSat,
    latitude: geo.latitude / DEG,
    longitude: ((geo.longitude / DEG + 540) % 360) - 180,
    altitudeKm: geo.height,
    rangeRateKmS,
    dopplerHz
  };
}

function predictPasses(
  tracking: Tracking,
  station: Station,
  minElevation: number,
  frequencyMHz: number,
  startTime = new Date(),
  hours = 24
): Pass[] {
  const startMs = startTime.getTime();
  const endMs = startMs + hours * 3600000;
  const stepMs = 30000;
  const results: Pass[] = [];
  let active: Pass | null = null;

  for (let ms = startMs; ms <= endMs; ms += stepMs) {
    const date = new Date(ms);
    const look = lookAt(tracking, date, station, frequencyMHz);
    const visible = !!look && look.elevation >= minElevation;

    if (visible && !active && look) {
      active = { aos: date, los: date, peak: date, maxElevation: look.elevation, points: [] };
    }
    if (visible && active && look) {
      active.los = date;
      active.points.push({ azimuth: look.azimuth, elevation: look.elevation });
      if (look.elevation > active.maxElevation) {
        active.maxElevation = look.elevation;
        active.peak = date;
      }
    }
    if (!visible && active) {
      results.push(active);
      active = null;
    }
  }
  if (active) {
    active.los = new Date(endMs);
    results.push(active);
  }
  return results;
}

function formatIST(date: Date, seconds = false): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    ...(seconds ? { second: '2-digit' } : {}),
    hour12: false
  }).format(date) + ' IST';
}

function compass(degrees: number): string {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(degrees / 45) % 8];
}

function skyCoordinates(point: SkyPoint): [number, number] {
  const radius = 94 * (90 - Math.max(0, Math.min(90, point.elevation))) / 90;
  const azimuth = point.azimuth * DEG;
  return [112 + radius * Math.sin(azimuth), 112 - radius * Math.cos(azimuth)];
}

function sampleVisualGroundTrack(tracking: Tracking | null, start: Date, durationSeconds = 90 * 60): SubPoint[][] {
  if (!tracking) return [];
  const lib = satellite as any;
  const points: SubPoint[] = [];
  for (let seconds = 0; seconds <= durationSeconds; seconds += 60) {
    const date = new Date(start.getTime() + seconds * 1000);
    try {
      const state = lib.propagate(tracking.satrec, date);
      if (!state?.position) continue;
      const geo = lib.eciToGeodetic(state.position, lib.gstime(date));
      points.push({
        lat: geo.latitude / DEG,
        lon: ((geo.longitude / DEG + 540) % 360) - 180,
        alt: geo.height,
        epoch: date.getTime()
      });
    } catch {
      // Omit isolated propagation failures from the visualization path.
    }
  }
  return generateContinuousGroundTrack(points);
}

function worldX(longitude: number): number {
  return ((longitude + 180) / 360) * 720;
}

function worldY(latitude: number): number {
  return ((90 - latitude) / 180) * 360;
}

function exportPassesCsv(passes: Pass[], satelliteName: string) {
  const rows = [
    ['Satellite', 'AOS (IST)', 'Peak (IST)', 'Max elevation (deg)', 'LOS (IST)', 'Duration (min)'],
    ...passes.map(pass => [
      satelliteName,
      formatIST(pass.aos),
      formatIST(pass.peak),
      pass.maxElevation.toFixed(2),
      formatIST(pass.los),
      ((pass.los.getTime() - pass.aos.getTime()) / 60000).toFixed(2)
    ])
  ];
  const csv = rows.map(row => row.map(value => '"' + String(value).replace(/"/g, '""') + '"').join(',')).join('\r\n');
  const blobUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = 'orbital-lab-pass-predictions.csv';
  link.click();
  URL.revokeObjectURL(blobUrl);
}

export default function SatelliteTrackingView() {
  const [catalog, setCatalog] = useState<Tle[]>([]);
  const [selectedName, setSelectedName] = useState('');
  const [catalogGroup, setCatalogGroup] = useState<CatalogGroup>('stations');
  const [catalogStatus, setCatalogStatus] = useState('Loading current orbital elements…');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [manualTle, setManualTle] = useState('');
  const [search, setSearch] = useState('');
  const [lat, setLat] = useState('12.9716');
  const [lon, setLon] = useState('77.5946');
  const [heightM, setHeightM] = useState('900');
  const [minElevation, setMinElevation] = useState('10');
  const [frequencyMHz, setFrequencyMHz] = useState('145.800');
  const [now, setNow] = useState(() => new Date());
  const [passes, setPasses] = useState<Pass[]>([]);
  const [selectedPassIndex, setSelectedPassIndex] = useState(0);
  const [predicting, setPredicting] = useState(false);

  const selected = catalog.find(item => item.name === selectedName) || catalog[0] || null;
  const tracking = useMemo(() => {
    if (!selected) return null;
    try { return parseTle(selected.name, selected.line1, selected.line2); }
    catch { return null; }
  }, [selected]);
  const station = useMemo<Station>(() => ({
    lat: Number(lat),
    lon: Number(lon),
    heightM: Number(heightM)
  }), [lat, lon, heightM]);

  const stationValid = Number.isFinite(station.lat) && station.lat >= -90 && station.lat <= 90 &&
    Number.isFinite(station.lon) && station.lon >= -180 && station.lon <= 180 &&
    Number.isFinite(station.heightM) && station.heightM >= -500 && station.heightM <= 10000;
  const frequency = Number(frequencyMHz);
  const current = useMemo(() => {
    if (!tracking || !stationValid) return null;
    try { return lookAt(tracking, now, station, frequency); }
    catch { return null; }
  }, [tracking, now, station, frequency, stationValid]);

  const tleAgeHours = tracking ? Math.max(0, (now.getTime() - tracking.epoch.getTime()) / 3600000) : null;
  const filteredCatalog = catalog.filter(item => item.name.toLowerCase().includes(search.trim().toLowerCase()));
  const catalogOptions = selected && !filteredCatalog.some(item => item.name === selected.name)
    ? [selected, ...filteredCatalog]
    : filteredCatalog;
  const selectedPass = passes[selectedPassIndex] || null;
  const skyPath = selectedPass
    ? selectedPass.points.map((point, index) => {
        const [x, y] = skyCoordinates(point);
        return (index === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2);
      }).join(' ')
    : '';
  const currentSky = current ? skyCoordinates(current) : null;
  const visualEpochMs = Math.floor(now.getTime() / 10000) * 10000;
  const visualTrack = useMemo(() => sampleVisualGroundTrack(tracking, new Date(visualEpochMs)), [tracking, visualEpochMs]);
  const visualTrackPaths = visualTrack.map(segment => segment.map((point, index) => (index === 0 ? 'M' : 'L') + ' ' + worldX(point.lon).toFixed(2) + ' ' + worldY(point.lat).toFixed(2)).join(' '));
  const currentMapPoint = current ? { x: worldX(current.longitude), y: worldY(current.latitude) } : null;
  const stationMapPoint = { x: worldX(station.lon), y: worldY(station.lat) };
  const passTimelineWindowMs = 24 * 60 * 60 * 1000;
  const timelineTicks = [0, 6, 12, 18, 24];

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function refreshCatalog(group = catalogGroup) {
    setLoading(true);
    setError('');
    setCatalogStatus('Fetching fresh TLE records…');
    try {
      const response = await fetch(
        'https://celestrak.org/NORAD/elements/gp.php?GROUP=' + encodeURIComponent(group) + '&FORMAT=tle',
        { cache: 'no-store' }
      );
      if (!response.ok) throw new Error('CelesTrak returned HTTP ' + response.status + '.');
      const rows = parseCatalog(await response.text());
      if (!rows.length) throw new Error('The source returned no valid two-line element records.');
      setCatalog(rows);
      const preferred = rows.find(item => /ISS\s*\(ZARYA\)|\bISS\b|ZARYA/i.test(item.name)) || rows[0];
      setSelectedName(preferred.name);
      setPasses([]);
      setSelectedPassIndex(0);
      setCatalogStatus('Live data loaded · ' + rows.length.toLocaleString() + ' objects · ' + GROUPS.find(item => item.value === group)?.label);
    } catch (reason) {
      setCatalogStatus('Live data unavailable. Manual TLE import is still available.');
      setError(reason instanceof Error ? reason.message : 'Unable to fetch current orbital elements.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refreshCatalog('stations'); }, []);

  function useManualTle() {
    setError('');
    try {
      const lines = manualTle.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      const named = !lines[0]?.startsWith('1 ');
      const name = named ? (lines[0] || 'Custom TLE').replace(/^0\s+/, '') : 'Custom TLE';
      const line1 = named ? lines[1] || '' : lines[0] || '';
      const line2 = named ? lines[2] || '' : lines[1] || '';
      const parsed = parseTle(name, line1, line2);
      const entry = { name: parsed.name, line1, line2 };
      setCatalog(previous => [entry, ...previous.filter(item => item.name !== entry.name)]);
      setSelectedName(entry.name);
      setPasses([]);
      setSelectedPassIndex(0);
      setCatalogStatus('Manual orbital elements loaded · SGP4 active');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The TLE could not be parsed.');
    }
  }

  function runPrediction() {
    if (!tracking) {
      setError('Select a satellite or load a valid TLE first.');
      return;
    }
    if (!stationValid) {
      setError('Check station latitude (−90…90°), longitude (−180…180°) and height (−500…10,000 m).');
      return;
    }
    if (!Number.isFinite(frequency) || frequency <= 0 || frequency > 100000) {
      setError('Enter a valid receive frequency in MHz.');
      return;
    }
    const elevation = Number(minElevation);
    if (!Number.isFinite(elevation) || elevation < 0 || elevation > 90) {
      setError('Minimum elevation must be between 0° and 90°.');
      return;
    }
    setError('');
    setPredicting(true);
    setPasses([]);
    setSelectedPassIndex(0);
    window.setTimeout(() => {
      try {
        const found = predictPasses(tracking, station, elevation, frequency, new Date(), 24);
        setPasses(found);
        if (!found.length) setCatalogStatus('Prediction complete · no passes meet the selected elevation mask in 24 hours.');
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Pass prediction failed.');
      } finally {
        setPredicting(false);
      }
    }, 20);
  }

  return (
    <div className="page sat-track-page">
      <div className="sat-track-heading">
        <div>
          <small>ARYAKSHA · SATELLITE OPS</small>
          <h1>Satellite tracking & pass planning</h1>
          <p>Track catalog objects, inspect the sky from your station, estimate radio Doppler shift and export visibility windows.</p>
        </div>
        <a href="https://celestrak.org/" target="_blank" rel="noreferrer">Orbital data source <ExternalLink size={13} /></a>
      </div>

      <div className="sat-track-banner">
        <Radio size={17} />
        <div>
          <b>Aryaksha Tracking Engine · SGP4 / TLE</b>
          <span>Original browser-native implementation using the existing orbital engine and public orbital elements. Radio hardware control and SDR decoding are not connected in this release.</span>
        </div>
      </div>

      <div className="sat-track-grid">
        <section className="card">
          <div className="card-head"><span><SatelliteIcon size={17} /></span><b>Satellite catalogue</b></div>
          <div className="sat-track-source-controls">
            <label className="sat-track-field">
              <span>CATALOG GROUP</span>
              <select value={catalogGroup} onChange={event => {
                const group = event.target.value as CatalogGroup;
                setCatalogGroup(group);
                void refreshCatalog(group);
              }}>
                {GROUPS.map(group => <option key={group.value} value={group.value}>{group.label}</option>)}
              </select>
            </label>
            <button className="sat-track-button" onClick={() => void refreshCatalog()} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'sat-track-spin' : ''} />
              {loading ? 'Refreshing…' : 'Refresh TLEs'}
            </button>
          </div>
          <div className="sat-track-status"><span className={catalog.length ? 'sat-track-status-dot' : 'sat-track-status-dot amber'} />{catalogStatus}</div>
          <label className="sat-track-field sat-track-search">
            <span>FIND AN OBJECT</span>
            <div><Search size={14} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Filter by satellite name" /></div>
          </label>
          {catalog.length > 0 && (
            <label className="sat-track-field">
              <span>SELECTED OBJECT · {catalogOptions.length.toLocaleString()} SHOWN</span>
              <select value={selected?.name || ''} onChange={event => {
                setSelectedName(event.target.value);
                setPasses([]);
                setSelectedPassIndex(0);
              }}>
                {catalogOptions.map(item => <option key={item.name + item.line1} value={item.name}>{item.name}</option>)}
              </select>
            </label>
          )}
          {tracking && (
            <div className="sat-track-stats">
              <div><small>OBJECT</small><b>{tracking.name}</b></div>
              <div><small>TLE EPOCH</small><b>{formatIST(tracking.epoch)}</b></div>
              <div><small>ELEMENT AGE</small><b className={tleAgeHours! > 72 ? 'sat-track-warning' : ''}>{tleAgeHours! < 1 ? Math.round(tleAgeHours! * 60) + ' min' : tleAgeHours!.toFixed(1) + ' h'}</b></div>
              <div><small>PROPAGATOR</small><b>SGP4 / TEME</b></div>
            </div>
          )}
          {tleAgeHours !== null && tleAgeHours > 72 && (
            <div className="sat-track-warning-panel">Orbital elements are over 72 hours old. Refresh before relying on pass timing.</div>
          )}
          <label className="sat-track-field">
            <span>IMPORT TLE · NAME + TWO LINES</span>
            <textarea rows={4} value={manualTle} onChange={event => setManualTle(event.target.value)} placeholder={'ISS (ZARYA)\n1 25544 …\n2 25544 …'} />
          </label>
          <button className="sat-track-secondary" onClick={useManualTle}>Load manual TLE</button>
          <p className="sat-track-note">If the live request is blocked by browser network policy, paste a current TLE. Predictions are limited by element quality and age.</p>
        </section>

        <section className="card">
          <div className="card-head"><span><MapPin size={17} /></span><b>Station & live look angles</b></div>
          <div className="sat-track-fields">
            <label className="sat-track-field"><span>LATITUDE · DEG</span><input type="number" min="-90" max="90" step="0.0001" value={lat} onChange={event => setLat(event.target.value)} /></label>
            <label className="sat-track-field"><span>LONGITUDE · DEG</span><input type="number" min="-180" max="180" step="0.0001" value={lon} onChange={event => setLon(event.target.value)} /></label>
            <label className="sat-track-field"><span>HEIGHT · METRES</span><input type="number" min="-500" max="10000" step="1" value={heightM} onChange={event => setHeightM(event.target.value)} /></label>
            <label className="sat-track-field"><span>MIN ELEVATION · DEG</span><input type="number" min="0" max="90" step="1" value={minElevation} onChange={event => setMinElevation(event.target.value)} /></label>
          </div>
          <p className="sat-track-note">Default station: Bengaluru city centre. Enter your own coordinates for local pass predictions.</p>
          <div className="sat-track-look">
            <div><small>AZIMUTH</small><b>{current ? current.azimuth.toFixed(1) + '°' : '—'}</b><span>{current ? compass(current.azimuth) : 'Waiting for orbital elements'}</span></div>
            <div><small>ELEVATION</small><b className={current && current.elevation >= Number(minElevation) ? 'sat-track-visible' : ''}>{current ? current.elevation.toFixed(1) + '°' : '—'}</b><span>{current && current.elevation >= Number(minElevation) ? 'Above elevation mask' : 'Below elevation mask'}</span></div>
            <div><small>SLANT RANGE</small><b>{current ? current.rangeKm.toFixed(1) + ' km' : '—'}</b><span>Station to object</span></div>
            <div><small>SUBSATELLITE POINT</small><b>{current ? current.latitude.toFixed(2) + '°, ' + current.longitude.toFixed(2) + '°' : '—'}</b><span>Latitude / longitude</span></div>
          </div>
          <div className="sat-track-radio">
            <div className="card-head"><span><Waves size={16} /></span><b>Radio Doppler estimate</b></div>
            <label className="sat-track-field"><span>NOMINAL FREQUENCY · MHz</span><input type="number" min="0.001" step="0.001" value={frequencyMHz} onChange={event => setFrequencyMHz(event.target.value)} /></label>
            <div className="sat-track-doppler-grid">
              <div><small>RANGE RATE</small><b>{current ? (current.rangeRateKmS >= 0 ? '+' : '') + current.rangeRateKmS.toFixed(3) + ' km/s' : '—'}</b></div>
              <div><small>EXPECTED SHIFT</small><b className={current && current.dopplerHz >= 0 ? 'sat-track-visible' : ''}>{current ? (current.dopplerHz >= 0 ? '+' : '') + current.dopplerHz.toFixed(0) + ' Hz' : '—'}</b></div>
              <div className="sat-track-doppler-wide"><small>EXPECTED RECEIVED FREQUENCY</small><b>{current && frequency > 0 ? (frequency + current.dopplerHz / 1e6).toFixed(6) + ' MHz' : '—'}</b></div>
            </div>
            <p className="sat-track-note">First-order geometric estimate from range change. Receiver tuning, radio hardware and signal acquisition are not controlled by this page.</p>
          </div>
          <div className="sat-track-clock"><Clock3 size={14} /> LIVE UTC <b>{now.toISOString().replace('T', ' ').slice(0, 19)} Z</b><span>{formatIST(now, true)}</span></div>
          <button className="sat-track-button sat-track-wide" onClick={runPrediction} disabled={!tracking || predicting}>
            <Target size={14} />{predicting ? 'Computing pass windows…' : 'Predict next 24 hours'}
          </button>
        </section>
      </div>

      {error && <div className="sat-track-error" role="alert"><Activity size={15} /><span>{error}</span></div>}

      <section className="card sat-track-visual-card">
        <div className="card-head"><span><Globe2 size={17} /></span><b>Orbital visualizer</b><small className="sat-track-count">SGP4 · NEXT 90 MIN</small></div>
        <p className="sat-track-note">Live Earth-fixed ground track for the selected object. The line is split at the date line to avoid a false wraparound across the map.</p>
        <div className="sat-track-world-wrap">
          <svg className="sat-track-world" viewBox="0 0 720 360" role="img" aria-label="Equirectangular Earth map with predicted satellite ground track and ground station">
            <defs>
              <linearGradient id="sat-world-ocean" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#0b2435" /><stop offset="100%" stopColor="#07131f" /></linearGradient>
              <linearGradient id="sat-world-track" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#39b8ff" /><stop offset="100%" stopColor="#7cf7d4" /></linearGradient>
            </defs>
            <rect width="720" height="360" rx="8" className="sat-track-world-ocean" />
            {Array.from({ length: 11 }, (_, index) => <line key={'lon-' + index} x1={index * 72} y1="0" x2={index * 72} y2="360" className="sat-track-world-grid" />)}
            {Array.from({ length: 7 }, (_, index) => <line key={'lat-' + index} x1="0" y1={index * 60} x2="720" y2={index * 60} className="sat-track-world-grid" />)}
            <g className="sat-track-world-land">
              <path d="M 45 58 L 77 36 117 43 142 61 173 69 190 91 176 112 155 120 145 145 126 159 112 190 94 177 88 148 68 133 61 107 45 94 Z" />
              <path d="M 153 184 L 177 194 195 220 191 247 178 271 171 305 154 326 144 300 149 272 137 247 139 220 Z" />
              <path d="M 315 66 L 339 52 367 57 383 72 371 85 350 83 340 98 321 91 Z" />
              <path d="M 336 104 L 367 92 396 107 412 135 402 165 384 194 372 228 355 251 343 221 339 190 325 162 326 133 Z" />
              <path d="M 382 61 L 426 39 473 47 504 60 541 62 572 83 602 87 637 108 663 136 642 153 611 147 593 163 567 154 548 171 521 162 499 144 477 148 463 126 438 121 425 98 401 91 Z" />
              <path d="M 565 203 L 595 194 624 206 643 231 633 255 606 267 583 252 568 228 Z" />
              <path d="M 655 281 L 674 276 690 289 683 305 663 308 651 296 Z" />
            </g>
            <g className="sat-track-world-track">
              {visualTrackPaths.map((path, index) => <path key={'track-' + index} d={path} />)}
            </g>
            {currentMapPoint && <g className="sat-track-world-current"><circle cx={currentMapPoint.x} cy={currentMapPoint.y} r="9" /><circle cx={currentMapPoint.x} cy={currentMapPoint.y} r="3.2" /><title>Current subsatellite point</title></g>}
            <g className="sat-track-world-station"><circle cx={stationMapPoint.x} cy={stationMapPoint.y} r="7" /><circle cx={stationMapPoint.x} cy={stationMapPoint.y} r="2.2" /><title>Ground station</title></g>
            <g className="sat-track-world-labels"><text x="10" y="17">90°N</text><text x="10" y="197">0°</text><text x="10" y="352">90°S</text><text x="360" y="350" textAnchor="middle">0° LONGITUDE</text></g>
          </svg>
        </div>
        <div className="sat-track-world-legend"><span><i className="sat-track-world-line" /> Predicted ground track</span><span><i className="sat-track-world-current-key" /> Current satellite subpoint</span><span><i className="sat-track-world-station-key" /> Ground station</span></div>
        <div className="sat-track-timeline-head"><div><b>24-hour visibility timeline</b><span>{passes.length ? passes.length + ' predicted pass' + (passes.length === 1 ? '' : 'es') : 'Run pass prediction to populate windows'}</span></div><small>RELATIVE TO NOW · IST TABLE BELOW</small></div>
        <svg className="sat-track-timeline" viewBox="0 0 720 96" role="img" aria-label="24-hour timeline of predicted satellite passes">
          {timelineTicks.map(hour => <g key={hour}><line x1={hour / 24 * 720} y1="12" x2={hour / 24 * 720} y2="76" className="sat-track-timeline-grid" /><text x={hour / 24 * 720} y="91" textAnchor={hour === 0 ? 'start' : hour === 24 ? 'end' : 'middle'}>{String(hour).padStart(2, '0') + ':00'}</text></g>)}
          <line x1="0" y1="44" x2="720" y2="44" className="sat-track-timeline-base" />
          {passes.map((pass, index) => {
            const startOffset = Math.max(0, Math.min(passTimelineWindowMs, pass.aos.getTime() - now.getTime()));
            const endOffset = Math.max(startOffset, Math.min(passTimelineWindowMs, pass.los.getTime() - now.getTime()));
            const x = startOffset / passTimelineWindowMs * 720;
            const width = Math.max(4, (endOffset - startOffset) / passTimelineWindowMs * 720);
            return <g key={pass.aos.toISOString()} className={selectedPassIndex === index ? 'sat-track-timeline-pass selected' : 'sat-track-timeline-pass'} role="button" tabIndex={0} aria-label={'Select pass ' + (index + 1)} onClick={() => setSelectedPassIndex(index)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') setSelectedPassIndex(index); }}><rect x={x} y="31" width={Math.min(width, 720 - x)} height="26" rx="5" /><text x={Math.min(714, x + Math.max(4, width / 2))} y="48" textAnchor="middle">{index + 1}</text><title>{'Pass ' + (index + 1) + ': ' + formatIST(pass.aos) + ' to ' + formatIST(pass.los) + '; peak ' + pass.maxElevation.toFixed(1) + '°'}</title></g>;
          })}
        </svg>
        <div className="sat-track-visual-foot"><span><i /> Selected pass</span><span>Times in pass table are shown in India Standard Time.</span></div>
      </section>

      <div className="sat-track-lower-grid">
        <section className="card sat-track-pass-card">
          <div className="card-head">
            <span><Clock3 size={17} /></span><b>Upcoming visibility windows</b>
            <small className="sat-track-count">{passes.length} passes · 24 h</small>
            <button className="sat-track-icon-button" title="Export pass predictions as CSV" aria-label="Export pass predictions as CSV" onClick={() => exportPassesCsv(passes, tracking?.name || 'Satellite')} disabled={!passes.length}><Download size={14} /></button>
          </div>
          {!passes.length ? (
            <p className="sat-track-note">{predicting ? 'Propagating orbital state and evaluating station elevation…' : 'Run a prediction to list acquisition, peak elevation and loss-of-signal times.'}</p>
          ) : (
            <>
              <label className="sat-track-field">
                <span>PASS PREVIEW</span>
                <select value={selectedPassIndex} onChange={event => setSelectedPassIndex(Number(event.target.value))}>
                  {passes.map((pass, index) => <option key={pass.aos.toISOString()} value={index}>Pass {String(index + 1).padStart(2, '0')} · {formatIST(pass.aos)} · peak {pass.maxElevation.toFixed(0)}°</option>)}
                </select>
              </label>
              <div className="sat-track-table-wrap">
                <table className="sat-track-table">
                  <thead><tr><th>#</th><th>AOS · IST</th><th>PEAK</th><th>PEAK · IST</th><th>LOS · IST</th><th>DURATION</th></tr></thead>
                  <tbody>{passes.map((pass, index) => (
                    <tr key={pass.aos.toISOString()} className={selectedPassIndex === index ? 'selected' : ''} onClick={() => setSelectedPassIndex(index)}>
                      <td>{String(index + 1).padStart(2, '0')}</td>
                      <td>{formatIST(pass.aos)}</td>
                      <td>{pass.maxElevation.toFixed(1)}°</td>
                      <td>{formatIST(pass.peak)}</td>
                      <td>{formatIST(pass.los)}</td>
                      <td>{((pass.los.getTime() - pass.aos.getTime()) / 60000).toFixed(1)} min</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </>
          )}
          <p className="sat-track-note">AOS/LOS crossings are sampled at 30-second intervals, so times are approximate to that interval. Results are for observation planning, not certified mission operations.</p>
        </section>

        <section className="card sat-track-sky-card">
          <div className="card-head"><span><Target size={17} /></span><b>Sky path</b><small className="sat-track-count">{selectedPass ? 'Pass ' + (selectedPassIndex + 1) : 'Polar view'}</small></div>
          <svg className="sat-track-sky" viewBox="0 0 224 224" role="img" aria-label="Polar sky plot with north at the top and elevation rings">
            <circle cx="112" cy="112" r="94" className="sat-track-sky-ring" />
            <circle cx="112" cy="112" r="62.7" className="sat-track-sky-ring" />
            <circle cx="112" cy="112" r="31.3" className="sat-track-sky-ring" />
            <line x1="18" y1="112" x2="206" y2="112" className="sat-track-sky-axis" />
            <line x1="112" y1="18" x2="112" y2="206" className="sat-track-sky-axis" />
            <text x="112" y="10" textAnchor="middle">N</text><text x="216" y="116" textAnchor="middle">E</text>
            <text x="112" y="221" textAnchor="middle">S</text><text x="8" y="116" textAnchor="middle">W</text>
            <text x="118" y="83" className="sat-track-sky-label">60°</text><text x="118" y="51" className="sat-track-sky-label">30°</text>
            {skyPath && <path d={skyPath} className="sat-track-sky-path" />}
            {currentSky && <circle cx={currentSky[0]} cy={currentSky[1]} r="4.5" className="sat-track-sky-current"><title>Current azimuth/elevation</title></circle>}
            {!skyPath && <text x="112" y="151" textAnchor="middle" className="sat-track-sky-empty">Predict a pass</text>}
          </svg>
          <div className="sat-track-sky-legend"><span><i className="sat-track-legend-path" /> Selected pass trajectory</span><span><i className="sat-track-legend-current" /> Current position</span></div>
          <p className="sat-track-note">Polar view: horizon at the outer ring, zenith at the centre. The selected pass trajectory and current position use the same azimuth/elevation convention.</p>
        </section>
      </div>

      <section className="sat-track-footer">
        <div><b>Aryaksha Satellite Ops</b><p>Original tracking interface using satellite.js for SGP4 propagation and CelesTrak for public orbital elements. Radio hardware integration is a separate future module.</p></div>
        <a href="https://celestrak.org/NORAD/elements/" target="_blank" rel="noreferrer">CelesTrak element sets <ExternalLink size={12} /></a>
        <a href="https://www.n2yo.com/" target="_blank" rel="noreferrer">Independent tracking reference <ExternalLink size={12} /></a>
      </section>
    </div>
  );
}