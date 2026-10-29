import tzLookup from '@photostructure/tz-lookup';

export interface TerminatorCoord {
  lat: number;
  lon: number;
}

export interface DayNightBoundary {
  terminatorSegments: TerminatorCoord[][];
  nightShadePath: string;
  subSolarPoint: { lat: number; lon: number };
}

const DEG = Math.PI / 180;

function normalizeLongitude(lon: number) {
  return ((lon + 540) % 360 + 360) % 360 - 180;
}

export function solarSubpoint(date: Date) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const T = (jd - 2451545) / 36525;
  const L0 = ((280.46646 + 36000.76983 * T + 0.0003032 * T * T) % 360 + 360) % 360;
  const M = ((357.52911 + 35999.05029 * T - 0.0001537 * T * T) % 360 + 360) % 360;
  const Mr = M * DEG;
  const C = (1.914602 - 0.004817 * T) * Math.sin(Mr)
    + 0.019993 * Math.sin(2 * Mr)
    + 0.000289 * Math.sin(3 * Mr);
  const lambda = (L0 + C) * DEG;
  const eps = (23.439291 - 0.0130042 * T) * DEG;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const gmst = ((280.46061837 + 360.98564736629 * (jd - 2451545)) % 360 + 360) % 360;
  const lon = normalizeLongitude(ra / DEG - gmst);
  return { lat: dec / DEG, lon, ra, dec };
}

export function solarEciDirection(date: Date) {
  const sun = solarSubpoint(date);
  return {
    x: Math.cos(sun.dec) * Math.cos(sun.ra),
    y: Math.sin(sun.dec),
    z: Math.cos(sun.dec) * Math.sin(sun.ra),
  };
}

export function dayNightSnapshot(lat: number, lon: number, date: Date) {
  const sub = solarSubpoint(date);
  const safeLat = Number.isFinite(lat) ? lat : 0;
  const safeLon = Number.isFinite(lon) ? lon : 0;
  const timeZone = (() => {
    try { return tzLookup(safeLat, safeLon); } catch { return 'UTC'; }
  })();
  const localTime = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
  const hourAngle = normalizeLongitude(safeLon - sub.lon);
  const solarHour = ((12 + hourAngle / 15) % 24 + 24) % 24;
  const phi = safeLat * DEG;
  const delta = sub.lat * DEG;
  const h = hourAngle * DEG;
  const sinAltitude = Math.sin(phi) * Math.sin(delta)
    + Math.cos(phi) * Math.cos(delta) * Math.cos(h);
  const localSolar = `${String(Math.floor(solarHour)).padStart(2, '0')}:${String(Math.floor((solarHour % 1) * 60)).padStart(2, '0')}`;
  return {
    isDay: sinAltitude > 0,
    timeZone,
    localTime,
    localSolar,
    subsolarLat: sub.lat,
    subsolarLon: sub.lon,
  };
}

/** Build a singularity-free great-circle terminator and equirectangular night mask. */
export function computeDayNightBoundary(
  subSolarLatDeg: number,
  subSolarLonDeg: number,
  numSamples = 360,
): DayNightBoundary {
  const sunLat = Math.max(-90, Math.min(90, Number.isFinite(subSolarLatDeg) ? subSolarLatDeg : 0));
  const sunLon = normalizeLongitude(Number.isFinite(subSolarLonDeg) ? subSolarLonDeg : 0);
  const phiSun = sunLat * DEG;
  const lamSun = sunLon * DEG;

  // Unit sub-solar vector in ECEF.
  const sx = Math.cos(phiSun) * Math.cos(lamSun);
  const sy = Math.cos(phiSun) * Math.sin(lamSun);
  const sz = Math.sin(phiSun);

  // u = S × reference-axis; switch axes near a pole to avoid a zero norm.
  let ux: number;
  let uy: number;
  let uz: number;
  if (Math.abs(sz) < 0.9) {
    const length = Math.hypot(sy, sx);
    ux = sy / length;
    uy = -sx / length;
    uz = 0;
  } else {
    const length = Math.hypot(sy, sz);
    ux = 0;
    uy = sz / length;
    uz = -sy / length;
  }

  // v = S × u. u and v form an orthonormal basis for the terminator plane.
  const vx = sy * uz - sz * uy;
  const vy = sz * ux - sx * uz;
  const vz = sx * uy - sy * ux;

  let terminatorSegments: TerminatorCoord[][];
  // At an equinox the great circle passes through both poles. Longitude is
  // undefined at the poles, so represent the two meridians explicitly.
  if (Math.abs(sunLat) < 0.05) {
    const westMeridian = normalizeLongitude(sunLon - 90);
    const eastMeridian = normalizeLongitude(sunLon + 90);
    terminatorSegments = [
      [{ lat: 90, lon: westMeridian }, { lat: 0, lon: westMeridian }, { lat: -90, lon: westMeridian }],
      [{ lat: 90, lon: eastMeridian }, { lat: 0, lon: eastMeridian }, { lat: -90, lon: eastMeridian } ],
    ];
  } else {
    const count = Math.max(72, Math.floor(numSamples));
    const rawPoints: TerminatorCoord[] = [];
    for (let i = 0; i < count; i += 1) {
      const theta = (i / count) * 2 * Math.PI;
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);
      const px = ux * cosTheta + vx * sinTheta;
      const py = uy * cosTheta + vy * sinTheta;
      const pz = uz * cosTheta + vz * sinTheta;
      rawPoints.push({
        lat: Math.asin(Math.max(-1, Math.min(1, pz))) / DEG,
        lon: Math.atan2(py, px) / DEG,
      });
    }

    const segments: TerminatorCoord[][] = [];
    let current: TerminatorCoord[] = [{ ...rawPoints[0] }];
    const splitAtAntimeridian = (prev: TerminatorCoord, curr: TerminatorCoord) => {
      const prevPositive = prev.lon >= 0;
      const d1 = 180 - Math.abs(prev.lon);
      const d2 = 180 - Math.abs(curr.lon);
      const fraction = d1 + d2 > 0 ? d1 / (d1 + d2) : 0.5;
      const crossLat = prev.lat + fraction * (curr.lat - prev.lat);
      return {
        exit: { lat: crossLat, lon: prevPositive ? 180 : -180 },
        entry: { lat: crossLat, lon: prevPositive ? -180 : 180 },
      };
    };

    for (let i = 1; i < rawPoints.length; i += 1) {
      const prev = rawPoints[i - 1];
      const curr = rawPoints[i];
      if (Math.abs(curr.lon - prev.lon) > 180) {
        const crossing = splitAtAntimeridian(prev, curr);
        current.push(crossing.exit);
        segments.push(current);
        current = [crossing.entry, { ...curr }];
      } else {
        current.push({ ...curr });
      }
    }

    const last = rawPoints[rawPoints.length - 1];
    const first = rawPoints[0];
    if (Math.abs(first.lon - last.lon) > 180) {
      const crossing = splitAtAntimeridian(last, first);
      current.push(crossing.exit);
      segments.push(current);
      segments.push([crossing.entry, { ...first }]);
    } else {
      current.push({ ...first });
      segments.push(current);
    }
    terminatorSegments = segments;
  }

  return {
    terminatorSegments,
    nightShadePath: generateNightShadeSVG(sunLat, sunLon),
    subSolarPoint: { lat: sunLat, lon: sunLon },
  };
}

function generateNightShadeSVG(subSolarLat: number, subSolarLon: number): string {
  const xForLon = (lon: number) => ((lon + 180) / 360) * 1000;
  const yForLat = (lat: number) => ((90 - lat) / 180) * 500;
  const delta = subSolarLat * DEG;
  const rows: number[] = [];
  for (let lat = -90; lat <= 90; lat += 1) rows.push(lat);
  if (rows[rows.length - 1] !== 90) rows.push(90);

  // In each latitude row, the night region is the longitude interval centred
  // on the anti-solar meridian. The interval is kept unwrapped, then clipped
  // into 360-degree map tiles so it never draws a spike across the antimeridian.
  const rowIntervals = rows.map(lat => {
    const phi = lat * DEG;
    const sinTerm = Math.sin(phi) * Math.sin(delta);
    const cosTerm = Math.cos(phi) * Math.cos(delta);
    let halfAngle: number;
    if (Math.abs(cosTerm) < 1e-10) {
      halfAngle = sinTerm < 0 ? 0 : 180;
    } else {
      const threshold = -sinTerm / cosTerm;
      if (threshold >= 1) halfAngle = 0; // entire latitude row is dark
      else if (threshold <= -1) halfAngle = 180; // no dark longitude on this row
      else halfAngle = Math.acos(threshold) / DEG;
    }
    if (halfAngle >= 180 - 1e-8) return null;
    const left = subSolarLon + halfAngle;
    const right = subSolarLon + 360 - halfAngle;
    if (right - left < 1e-8) return null;
    return { left, right };
  });

  const polygons: string[] = [];
  for (let tile = -2; tile <= 2; tile += 1) {
    const tileMin = -180 + 360 * tile;
    const tileMax = 180 + 360 * tile;
    const groups: Array<Array<{ lat: number; left: number; right: number }>> = [];
    let group: Array<{ lat: number; left: number; right: number }> = [];
    rows.forEach((lat, index) => {
      const interval = rowIntervals[index];
      if (!interval) {
        if (group.length) groups.push(group);
        group = [];
        return;
      }
      const left = Math.max(interval.left, tileMin);
      const right = Math.min(interval.right, tileMax);
      if (right - left <= 1e-8) {
        if (group.length) groups.push(group);
        group = [];
        return;
      }
      group.push({ lat, left: left - 360 * tile, right: right - 360 * tile });
    });
    if (group.length) groups.push(group);

    for (const band of groups) {
      const leftPath = band.map((p, index) =>
        `${index === 0 ? 'M' : 'L'}${xForLon(p.left).toFixed(3)} ${yForLat(p.lat).toFixed(3)}`).join(' ');
      const rightPath = [...band].reverse().map(p =>
        `L${xForLon(p.right).toFixed(3)} ${yForLat(p.lat).toFixed(3)}`).join(' ');
      polygons.push(`${leftPath} ${rightPath} Z`);
    }
  }
  return polygons.join(' ');
}
