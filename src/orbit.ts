export const MU = 398600.4418;
export const EARTH_RADIUS = 6378.137;
export const EARTH_E2 = 0.00669437999014;
export const SIMULATION_EPOCH = '2026-01-01T00:00:00.000Z';
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export type Elements = {
  a: number;
  e: number;
  i: number;
  raan: number;
  argp: number;
  nu: number;
};
export type State = { r: number[]; v: number[]; elements: Elements };
const mat = (m: number[][], v: number[]) =>
  m.map(row => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);

export function elementsToState(el: Elements) {
  const i = rad(el.i),
    O = rad(el.raan),
    w = rad(el.argp),
    nu = rad(el.nu);
  const p = el.a * (1 - el.e * el.e),
    r = p / (1 + el.e * Math.cos(nu));
  const rp = [r * Math.cos(nu), r * Math.sin(nu), 0];
  const vp = [
    -Math.sqrt(MU / p) * Math.sin(nu),
    Math.sqrt(MU / p) * (el.e + Math.cos(nu)),
    0,
  ];
  const cO = Math.cos(O),
    sO = Math.sin(O),
    ci = Math.cos(i),
    si = Math.sin(i),
    cw = Math.cos(w),
    sw = Math.sin(w);
  const R = [
    [cO * cw - sO * sw * ci, -cO * sw - sO * cw * ci, sO * si],
    [sO * cw + cO * sw * ci, -sO * sw + cO * cw * ci, -cO * si],
    [sw * si, cw * si, ci],
  ];
  return { r: mat(R, rp), v: mat(R, vp) };
}
function solveKepler(M: number, e: number) {
  let E = e < 0.8 ? M : Math.PI;
  for (let k = 0; k < 30; k++) {
    const f = E - e * Math.sin(E),
      d = f / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  return E;
}
function trueToE(nu: number, e: number) {
  const t = rad(nu);
  return (
    2 *
    Math.atan2(
      Math.sqrt(1 - e) * Math.sin(t / 2),
      Math.sqrt(1 + e) * Math.cos(t / 2)
    )
  );
}
function EToTrue(E: number, e: number) {
  return (
    2 *
    Math.atan2(
      Math.sqrt(1 + e) * Math.sin(E / 2),
      Math.sqrt(1 - e) * Math.cos(E / 2)
    )
  );
}
export function propagate(el: Elements, dt: number): Elements {
  const n = Math.sqrt(MU / el.a ** 3),
    E0 = trueToE(el.nu, el.e),
    M0 = E0 - el.e * Math.sin(E0);
  let M = M0 + n * dt;
  M = ((M + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  return { ...el, nu: deg(EToTrue(solveKepler(M, el.e), el.e)) };
}
export function propagateState(el: Elements, dt: number): State {
  const elements = propagate(el, dt),
    s = elementsToState(elements);
  return { ...s, elements };
}
export function orbitalSummary(el: Elements) {
  const s = elementsToState(el),
    rp = el.a * (1 - el.e),
    ra = el.a * (1 + el.e),
    period = 2 * Math.PI * Math.sqrt(el.a ** 3 / MU);
  const h = Math.hypot(
    s.r[1] * s.v[2] - s.r[2] * s.v[1],
    s.r[2] * s.v[0] - s.r[0] * s.v[2],
    s.r[0] * s.v[1] - s.r[1] * s.v[0]
  );
  return {
    rp,
    ra,
    period,
    speed: Math.hypot(...s.v),
    energy: -MU / (2 * el.a),
    e: el.e,
    i: el.i,
    h,
  };
}
export function eciToEcef(r: number[], date: Date) {
  const jd = date.getTime() / 86400000 + 2440587.5,
    T = (jd - 2451545) / 36525,
    theta = rad(
      (280.46061837 +
        360.98564736629 * (jd - 2451545) +
        0.000387933 * T * T -
        (T * T * T) / 38710000) %
        360
    ),
    c = Math.cos(theta),
    s = Math.sin(theta);
  return [c * r[0] + s * r[1], -s * r[0] + c * r[1], r[2]];
}
export function ecefToLla([x, y, z]: number[]) {
  const lon = Math.atan2(y, x), p = Math.hypot(x, y);
  if (p < 1e-9) {
    return { lat: z >= 0 ? 90 : -90, lon: 0, alt: Math.abs(z) - EARTH_RADIUS * Math.sqrt(1 - EARTH_E2) };
  }
  let lat = Math.atan2(z, p * (1 - EARTH_E2));
  for (let k = 0; k < 15; k++) {
    const sl = Math.sin(lat), N = EARTH_RADIUS / Math.sqrt(1 - EARTH_E2 * sl * sl);
    const next = Math.atan2(z + EARTH_E2 * N * sl, p);
    if (Math.abs(next - lat) < 1e-13) { lat = next; break; }
    lat = next;
  }
  const sl = Math.sin(lat), N = EARTH_RADIUS / Math.sqrt(1 - EARTH_E2 * sl * sl);
  return { lat: deg(lat), lon: deg(lon), alt: p / Math.cos(lat) - N };
}
export function stateToLla(r: number[], date: Date) {
  const ecef = eciToEcef(r, date);
  return { ecef, lla: ecefToLla(ecef) };
}
export function sampleOrbit(el: Elements, duration: number, step = 30) {
  const out: any[] = [];
  for (let t = 0; t <= duration + 1e-9; t += Math.min(step, duration || step)) {
    const s = propagateState(el, t),
      lla = stateToLla(s.r, new Date(Date.parse(SIMULATION_EPOCH) + t * 1000));
    out.push({ t, ...s, ...lla });
    if (duration === 0) break;
  }
  return out;
}
