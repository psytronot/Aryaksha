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