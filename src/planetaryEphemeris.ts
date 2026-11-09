export const PLANETARY_POSITION_MODEL = 'JPL-approximate-keplerian-3000BC-3000AD';
export const PLANETARY_POSITION_SOURCE = 'https://ssd.jpl.nasa.gov/planets/approx_pos.html';
export const PLANETARY_POSITION_VALIDITY = '3000 BC–3000 AD';

export type PlanetaryBodyId =
  | 'mercury' | 'venus' | 'earth' | 'mars'
  | 'jupiter' | 'saturn' | 'uranus' | 'neptune';

export type PlanetaryBodyDefinition = {
  id: PlanetaryBodyId;
  name: string;
  sourceName: string;
  meanRadiusKm: number;
  color: number;
  semiMajorAxisAU: number;
  a0: number; adot: number;
  e0: number; edot: number;
  i0: number; idot: number;
  l0: number; ldot: number;
  varpi0: number; varpiDot: number;
  node0: number; nodeDot: number;
  b: number; c: number; s: number; f: number;
};

// JPL SSD Table 2a/2b: mean ecliptic and equinox of J2000.
// Earth uses the published Earth–Moon barycentre elements.
export const PLANETARY_BODIES: readonly PlanetaryBodyDefinition[] = [
  { id: 'mercury', name: 'Mercury', sourceName: 'Mercury', meanRadiusKm: 2439.7, color: 0x96999d, semiMajorAxisAU: 0.38709843, a0: 0.38709843, adot: 0, e0: 0.20563661, edot: 0.00002123, i0: 7.00559432, idot: -0.00590158, l0: 252.25166724, ldot: 149472.67486623, varpi0: 77.45771895, varpiDot: 0.15940013, node0: 48.33961819, nodeDot: -0.12214182, b: 0, c: 0, s: 0, f: 0 },
  { id: 'venus', name: 'Venus', sourceName: 'Venus', meanRadiusKm: 6051.8, color: 0xd2ad79, semiMajorAxisAU: 0.72332102, a0: 0.72332102, adot: -0.00000026, e0: 0.00676399, edot: -0.00005107, i0: 3.39777545, idot: 0.00043494, l0: 181.97970850, ldot: 58517.81560260, varpi0: 131.76755713, varpiDot: 0.05679648, node0: 76.67261496, nodeDot: -0.27274174, b: 0, c: 0, s: 0, f: 0 },
  { id: 'earth', name: 'Earth', sourceName: 'Earth–Moon barycentre', meanRadiusKm: 6371.0, color: 0x4b91c7, semiMajorAxisAU: 1.00000018, a0: 1.00000018, adot: -0.00000003, e0: 0.01673163, edot: -0.00003661, i0: -0.00054346, idot: -0.01337178, l0: 100.46691572, ldot: 35999.37306329, varpi0: 102.93005885, varpiDot: 0.31795260, node0: -5.11260389, nodeDot: -0.24123856, b: 0, c: 0, s: 0, f: 0 },
  { id: 'mars', name: 'Mars', sourceName: 'Mars', meanRadiusKm: 3389.5, color: 0xb96e52, semiMajorAxisAU: 1.52371243, a0: 1.52371243, adot: 0.00000097, e0: 0.09336511, edot: 0.00009149, i0: 1.85181869, idot: -0.00724757, l0: -4.56813164, ldot: 19140.29934243, varpi0: -23.91744784, varpiDot: 0.45223625, node0: 49.71320984, nodeDot: -0.26852431, b: 0, c: 0, s: 0, f: 0 },
  { id: 'jupiter', name: 'Jupiter', sourceName: 'Jupiter', meanRadiusKm: 69911, color: 0xc49a70, semiMajorAxisAU: 5.20248019, a0: 5.20248019, adot: -0.00002864, e0: 0.04853590, edot: 0.00018026, i0: 1.29861416, idot: -0.00322699, l0: 34.33479152, ldot: 3034.90371757, varpi0: 14.27495244, varpiDot: 0.18199196, node0: 100.29282654, nodeDot: 0.13024619, b: -0.00012452, c: 0.06064060, s: -0.35635438, f: 38.35125 },
  { id: 'saturn', name: 'Saturn', sourceName: 'Saturn', meanRadiusKm: 58232, color: 0xd4bf8d, semiMajorAxisAU: 9.54149883, a0: 9.54149883, adot: -0.00003065, e0: 0.05550825, edot: -0.00032044, i0: 2.49424102, idot: 0.00451969, l0: 50.07571329, ldot: 1222.11494724, varpi0: 92.86136063, varpiDot: 0.54179478, node0: 113.63998702, nodeDot: -0.25015002, b: 0.00025899, c: -0.13434469, s: 0.87320147, f: 38.35125 },
  { id: 'uranus', name: 'Uranus', sourceName: 'Uranus', meanRadiusKm: 25362, color: 0x78c6d2, semiMajorAxisAU: 19.18797948, a0: 19.18797948, adot: -0.00020455, e0: 0.04685740, edot: -0.00001550, i0: 0.77298127, idot: -0.00180155, l0: 314.20276625, ldot: 428.49512595, varpi0: 172.43404441, varpiDot: 0.09266985, node0: 73.96250215, nodeDot: 0.05739699, b: 0.00058331, c: -0.97731848, s: 0.17689245, f: 7.67025 },
  { id: 'neptune', name: 'Neptune', sourceName: 'Neptune', meanRadiusKm: 24622, color: 0x4778c5, semiMajorAxisAU: 30.06952752, a0: 30.06952752, adot: 0.00006447, e0: 0.00895439, edot: 0.00000818, i0: 1.77005520, idot: 0.00022400, l0: 304.22289287, ldot: 218.46515314, varpi0: 46.68158724, varpiDot: 0.01009938, node0: 131.78635853, nodeDot: -0.00606302, b: -0.00041348, c: 0.68346318, s: -0.10162547, f: 7.67025 }
] as const;

export type PlanetaryPositionAU = {
  id: PlanetaryBodyId;
  name: string;
  xAU: number;
  yAU: number;
  zAU: number;
  distanceAU: number;
};

const DEG = Math.PI / 180;
const normalizeRadians = (value: number) => {
  const wrapped = ((value + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return Number.isFinite(wrapped) ? wrapped : 0;
};

export function julianDateUtc(date: Date): number {
  const milliseconds = date instanceof Date && Number.isFinite(date.getTime()) ? date.getTime() : 0;
  return milliseconds / 86400000 + 2440587.5;
}

function findBody(id: PlanetaryBodyId): PlanetaryBodyDefinition {
  const body = PLANETARY_BODIES.find(candidate => candidate.id === id);
  if (!body) throw new Error('Unknown planetary body: ' + id);
  return body;
}

function elementsAt(body: PlanetaryBodyDefinition, date: Date) {
  const centuries = (julianDateUtc(date) - 2451545.0) / 36525;
  return {
    a: body.a0 + body.adot * centuries,
    e: Math.max(0, Math.min(0.999999, body.e0 + body.edot * centuries)),
    inclination: (body.i0 + body.idot * centuries) * DEG,
    meanLongitude: body.l0 + body.ldot * centuries,
    perihelionLongitude: body.varpi0 + body.varpiDot * centuries,
    ascendingNode: body.node0 + body.nodeDot * centuries,
    centuries
  };
}

export function planetaryMeanAnomalyRad(id: PlanetaryBodyId, date: Date): number {
  const body = findBody(id);
  const elements = elementsAt(body, date);
  const periodic = body.b * elements.centuries * elements.centuries
    + body.c * Math.cos(body.f * elements.centuries * DEG)
    + body.s * Math.sin(body.f * elements.centuries * DEG);
  return normalizeRadians((elements.meanLongitude - elements.perihelionLongitude + periodic) * DEG);
}

export function solveKeplerEccentricAnomaly(meanAnomalyRad: number, eccentricity: number): number {
  const safeEccentricity = Number.isFinite(eccentricity) ? Math.max(0, Math.min(0.999999, eccentricity)) : 0;
  const mean = normalizeRadians(Number.isFinite(meanAnomalyRad) ? meanAnomalyRad : 0);
  let eccentric = mean + safeEccentricity * Math.sin(mean);
  for (let iteration = 0; iteration < 16; iteration += 1) {
    const denominator = 1 - safeEccentricity * Math.cos(eccentric);
    if (Math.abs(denominator) < 1e-12) break;
    const correction = (eccentric - safeEccentricity * Math.sin(eccentric) - mean) / denominator;
    eccentric -= correction;
    if (Math.abs(correction) < 1e-13) break;
  }
  return Number.isFinite(eccentric) ? eccentric : mean;
}

export function planetaryPositionAtEccentricAnomaly(
  id: PlanetaryBodyId,
  date: Date,
  eccentricAnomalyRad: number
): PlanetaryPositionAU {
  const body = findBody(id);
  const elements = elementsAt(body, date);
  const eccentricAnomaly = Number.isFinite(eccentricAnomalyRad) ? eccentricAnomalyRad : 0;
  const argumentOfPerihelion = (elements.perihelionLongitude - elements.ascendingNode) * DEG;
  const xPrime = elements.a * (Math.cos(eccentricAnomaly) - elements.e);
  const yPrime = elements.a * Math.sqrt(1 - elements.e * elements.e) * Math.sin(eccentricAnomaly);
  const omega = argumentOfPerihelion;
  const node = elements.ascendingNode * DEG;
  const cosOmega = Math.cos(omega);
  const sinOmega = Math.sin(omega);
  const cosNode = Math.cos(node);
  const sinNode = Math.sin(node);
  const cosInclination = Math.cos(elements.inclination);
  const sinInclination = Math.sin(elements.inclination);
  const xAU = (cosOmega * cosNode - sinOmega * sinNode * cosInclination) * xPrime
    + (-sinOmega * cosNode - cosOmega * sinNode * cosInclination) * yPrime;
  const yAU = (cosOmega * sinNode + sinOmega * cosNode * cosInclination) * xPrime
    + (-sinOmega * sinNode + cosOmega * cosNode * cosInclination) * yPrime;
  const zAU = (sinOmega * sinInclination) * xPrime + (cosOmega * sinInclination) * yPrime;
  const distanceAU = Math.hypot(xAU, yAU, zAU);
  return { id, name: body.name, xAU, yAU, zAU, distanceAU };
}

export function planetaryPositionAU(id: PlanetaryBodyId, date: Date): PlanetaryPositionAU {
  const body = findBody(id);
  const elements = elementsAt(body, date);
  const eccentricAnomaly = solveKeplerEccentricAnomaly(planetaryMeanAnomalyRad(id, date), elements.e);
  return planetaryPositionAtEccentricAnomaly(id, date, eccentricAnomaly);
}

export function planetaryPositionsAU(date: Date): PlanetaryPositionAU[] {
  return PLANETARY_BODIES.map(body => planetaryPositionAU(body.id, date));
}
