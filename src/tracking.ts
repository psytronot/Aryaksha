import * as satellite from 'satellite.js';

export type Tracking = {
  satrec: any;
  epoch: Date;
  name: string;
  source: string;
};

const lib = () => satellite as any;

export function parseTle(name: string, l1: string, l2: string): Tracking {
  const line1 = l1.trim();
  const line2 = l2.trim();
  if (!line1 || !line2) throw new Error('Both TLE lines are required.');
  if (!line1.startsWith('1 ') || !line2.startsWith('2 ')) {
    throw new Error('Invalid TLE format: line 1 must start with 1 and line 2 with 2.');
  }
  if (line1.length < 60 || line2.length < 60) throw new Error('TLE lines are too short. Paste complete two-line elements.');

  const s = lib();
  const satrec = s.twoline2satrec(line1, line2);
  if (satrec.error && satrec.error !== 0) {
    throw new Error(`TLE rejected by SGP4 parser (code ${satrec.error}). Check the epoch, checksum and orbital fields.`);
  }
  const epoch = new Date((Number(satrec.jdsatepoch) - 2440587.5) * 86400000);
  if (!Number.isFinite(epoch.getTime())) throw new Error('Invalid TLE epoch.');

  return {
    satrec,
    epoch,
    name: name || 'TLE Satellite',
    source: 'Manual TLE · SGP4',
  };
}

export function propagateSgp4(t: Tracking, date: Date) {
  const s = lib();
  const result = s.propagate(t.satrec, date);
  if (!result?.position || !result?.velocity) {
    throw new Error(`SGP4 propagation failed (code ${t.satrec.error ?? 'unknown'}).`);
  }
  const geo = s.eciToGeodetic(result.position, s.gstime(date));
  return {
    r: [result.position.x, result.position.y, result.position.z],
    v: [result.velocity.x, result.velocity.y, result.velocity.z],
    lla: {
      lat: (geo.latitude * 180) / Math.PI,
      lon: (geo.longitude * 180) / Math.PI,
      alt: geo.height,
    },
  };
}

export function sampleSgp4(t: Tracking, duration: number, step = 60) {
  const out: any[] = [];
  const increment = Math.max(1, Math.min(step, duration || step));
  for (let sec = 0; sec <= duration + 1e-9; sec += increment) {
    try {
      out.push({
        t: sec,
        ...propagateSgp4(t, new Date(t.epoch.getTime() + sec * 1000)),
      });
    } catch {
      // Keep a usable trajectory if an isolated sample fails near an SGP4 boundary.
    }
    if (duration === 0) break;
  }
  return out;
}



export interface SubPoint {
  lat: number;
  lon: number;
  alt: number;
  epoch: number;
}

export type GroundTrackSegment = SubPoint[];

/**
 * Split a longitude/latitude trajectory into independent equirectangular
 * sub-paths at the antimeridian. Boundary points are interpolated on both
 * map edges so renderers can draw each segment without a wraparound streak.
 *
 * Input longitude must use the conventional [-180, 180] degree range.
 */
export function generateContinuousGroundTrack(points: SubPoint[]): GroundTrackSegment[] {
  if (points.length === 0) return [];

  const segments: GroundTrackSegment[] = [];
  let currentSegment: GroundTrackSegment = [{ ...points[0] }];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    if (Math.abs(curr.lon - prev.lon) > 180) {
      const distanceToEdgePrev = 180 - Math.abs(prev.lon);
      const distanceToEdgeCurr = 180 - Math.abs(curr.lon);
      const distanceTotal = distanceToEdgePrev + distanceToEdgeCurr;
      const fraction = distanceTotal > 0 ? distanceToEdgePrev / distanceTotal : 0.5;
      const crossPoint: SubPoint = {
        lat: prev.lat + fraction * (curr.lat - prev.lat),
        lon: prev.lon >= 0 ? 180 : -180,
        alt: prev.alt + fraction * (curr.alt - prev.alt),
        epoch: prev.epoch + fraction * (curr.epoch - prev.epoch),
      };

      currentSegment.push(crossPoint);
      segments.push(currentSegment);

      currentSegment = [{
        ...crossPoint,
        lon: crossPoint.lon === 180 ? -180 : 180,
      }];
    }

    currentSegment.push({ ...curr });
  }

  if (currentSegment.length > 0) segments.push(currentSegment);
  return segments;
}

export function sgp4Summary(t: Tracking) {
  const s = t.satrec;
  const n = Number(s.no_kozai);
  if (!Number.isFinite(n) || n <= 0) throw new Error('Invalid TLE mean motion.');
  const mu = 398600.8;
  const period = (2 * Math.PI * 60) / n;
  const a = Math.cbrt(mu / (n / 60) ** 2);
  const e = Number(s.ecco);
  const energy = -mu / (2 * a);
  const h = Math.sqrt(Math.max(0, mu * a * (1 - e * e)));
  return {
    period,
    a,
    e,
    i: (Number(s.inclo) * 180) / Math.PI,
    rp: a * (1 - e),
    ra: a * (1 + e),
    energy,
    h,
  };
}
