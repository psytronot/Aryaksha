import { describe, expect, test } from 'vitest';
import { computeDayNightBoundary, solarSubpoint } from '../src/daynight';

const epochs = {
  vernal: new Date('2026-03-20T14:46:00.000Z'),
  summer: new Date('2026-06-21T08:25:00.000Z'),
  autumnal: new Date('2026-09-23T00:05:00.000Z'),
  winter: new Date('2026-12-21T20:50:00.000Z'),
};

function latitudeExtrema(segments: Array<Array<{ lat: number; lon: number }>>) {
  const lats = segments.flat().map(point => point.lat);
  return { min: Math.min(...lats), max: Math.max(...lats) };
}

function svgPathPolygons(path: string): Array<Array<{ x: number; y: number }>> {
  const tokens = path.match(/[MLZ]|-?\d+(?:\.\d+)?/g) ?? [];
  const polygons: Array<Array<{ x: number; y: number }>> = [];
  let active: Array<{ x: number; y: number }> | null = null;
  let i = 0;

  while (i < tokens.length) {
    const command = tokens[i++];
    if (command === 'M') {
      active = [];
      polygons.push(active);
      active.push({ x: Number(tokens[i++]), y: Number(tokens[i++]) });
    } else if (command === 'L' && active) {
      active.push({ x: Number(tokens[i++]), y: Number(tokens[i++]) });
    } else if (command === 'Z') {
      active = null;
    }
  }
  return polygons;
}

function svgContainsGeoPoint(path: string, lat: number, lon: number): boolean {
  const point = { x: ((lon + 180) / 360) * 1000, y: ((90 - lat) / 180) * 500 };
  return svgPathPolygons(path).some(polygon => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i];
      const b = polygon[j];
      const crosses = (a.y > point.y) !== (b.y > point.y)
        && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
      if (crosses) inside = !inside;
    }
    return inside;
  });
}

describe('Gate 2.3: solar terminator seasonal calibration', () => {
  test('vernal equinox: two pole-to-pole meridians and symmetric night mask', () => {
    const sun = solarSubpoint(epochs.vernal);
    expect(Math.abs(sun.lat)).toBeLessThan(0.05);

    const boundary = computeDayNightBoundary(sun.lat, sun.lon);
    expect(boundary.terminatorSegments).toHaveLength(2);
    for (const segment of boundary.terminatorSegments) {
      expect(segment.map(point => point.lat)).toEqual([90, 0, -90]);
    }
    expect(boundary.nightShadePath).toContain('Z');
    expect(boundary.subSolarPoint.lat).toBeCloseTo(sun.lat, 8);
  });

  test('summer solstice: north polar daylight and ±66.56° terminator limits', () => {
    const sun = solarSubpoint(epochs.summer);
    expect(sun.lat).toBeGreaterThan(23.3);
    expect(sun.lat).toBeLessThan(23.5);

    const boundary = computeDayNightBoundary(sun.lat, sun.lon);
    const extrema = latitudeExtrema(boundary.terminatorSegments);
    expect(extrema.max).toBeCloseTo(90 - sun.lat, 1);
    expect(extrema.min).toBeCloseTo(-(90 - sun.lat), 1);
    expect(boundary.terminatorSegments.length).toBeGreaterThanOrEqual(2);
  });

  test('autumnal equinox: singularity-free pole-to-pole meridians', () => {
    const sun = solarSubpoint(epochs.autumnal);
    expect(Math.abs(sun.lat)).toBeLessThan(0.05);

    const boundary = computeDayNightBoundary(sun.lat, sun.lon);
    expect(boundary.terminatorSegments).toHaveLength(2);
    expect(boundary.terminatorSegments.every(segment =>
      segment[0].lat === 90 && segment[1].lat === 0 && segment[2].lat === -90
    )).toBe(true);
    expect(boundary.nightShadePath).toContain('Z');
  });

  test('winter solstice: south polar daylight and ±66.56° terminator limits', () => {
    const sun = solarSubpoint(epochs.winter);
    expect(sun.lat).toBeLessThan(-23.3);
    expect(sun.lat).toBeGreaterThan(-23.5);

    const boundary = computeDayNightBoundary(sun.lat, sun.lon);
    const extrema = latitudeExtrema(boundary.terminatorSegments);
    expect(extrema.max).toBeCloseTo(90 - Math.abs(sun.lat), 1);
    expect(extrema.min).toBeCloseTo(-(90 - Math.abs(sun.lat)), 1);
    expect(boundary.terminatorSegments.length).toBeGreaterThanOrEqual(2);
  });

  test('equinox terminator crosses the equator at sub-solar longitude ±90°', () => {
    const result = computeDayNightBoundary(0, 30);
    const equatorialPoints = result.terminatorSegments
      .flat()
      .filter(point => Math.abs(point.lat) < 0.2);
    const longitudes = equatorialPoints.map(point => point.lon);

    expect(longitudes).toHaveLength(2);
    expect(longitudes).toContain(-60);
    expect(longitudes).toContain(120);
  });

  test('summer solstice SVG shade contains the anti-solar point but not the sub-solar point', () => {
    const sunLat = 23.44;
    const result = computeDayNightBoundary(sunLat, 0);

    expect(svgContainsGeoPoint(result.nightShadePath, -sunLat, 179.9)).toBe(true);
    expect(svgContainsGeoPoint(result.nightShadePath, sunLat, 0)).toBe(false);
    expect(svgContainsGeoPoint(result.nightShadePath, -89.9, 0)).toBe(true);
    expect(svgContainsGeoPoint(result.nightShadePath, 89.9, 0)).toBe(false);

    const extrema = latitudeExtrema(result.terminatorSegments);
    expect(extrema.max).toBeCloseTo(66.56, 1);
    expect(extrema.min).toBeCloseTo(-66.56, 1);
  });

  test('winter solstice SVG shade contains the anti-solar point but not the sub-solar point', () => {
    const sunLat = -23.44;
    const result = computeDayNightBoundary(sunLat, 0);

    expect(svgContainsGeoPoint(result.nightShadePath, -sunLat, 179.9)).toBe(true);
    expect(svgContainsGeoPoint(result.nightShadePath, sunLat, 0)).toBe(false);
    expect(svgContainsGeoPoint(result.nightShadePath, 89.9, 0)).toBe(true);
    expect(svgContainsGeoPoint(result.nightShadePath, -89.9, 0)).toBe(false);

    const extrema = latitudeExtrema(result.terminatorSegments);
    expect(extrema.max).toBeCloseTo(66.56, 1);
    expect(extrema.min).toBeCloseTo(-66.56, 1);
  });
});
