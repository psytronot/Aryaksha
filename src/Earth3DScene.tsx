import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { dayNightSnapshot, solarEciDirection } from './daynight';
import { makeNightLightsTexture } from './earthVisuals';
import { formatIstDateTime } from './time';
import { createSpaceEnvironment } from './solarSystem';
import './earth3d-upgrade.css';

type Earth3DSceneProps = {
  model: any[];
  current: any;
  seconds: number;
  name: string;
  propagator: 'KEPLER' | 'SGP4';
  footprintAngleDeg?: number;
  busWidthM?: number;
  busHeightM?: number;
  busDepthM?: number;
  altitudeKm?: number;
  eccentricity?: number;
  inclinationDeg?: number;
  raanDeg?: number;
  argumentOfPerigeeDeg?: number;
  trueAnomalyDeg?: number;
  periodMin?: number;
  panelAreaM2?: number;
};

type CameraMode = 'TRACK' | 'EARTH' | 'SATELLITE' | 'MOON' | 'SYSTEM';

function fbm(x: number, y: number) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  for (let octave = 0; octave < 5; octave += 1) {
    value += amplitude * (
      Math.sin((x * 2.13 + y * 1.37) * frequency) * 0.55 +
      Math.sin((x * -1.71 + y * 2.47) * frequency + 1.2) * 0.3 +
      Math.cos((x * 3.31 - y * 1.19) * frequency - 0.7) * 0.15
    );
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value;
}

function makeEarthTexture() {
  const width = 768;
  const height = 384;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Earth texture could not be created.');
  const image = ctx.createImageData(width, height);
  const data = image.data;
  for (let y = 0; y < height; y += 1) {
    const lat = (0.5 - y / height) * Math.PI;
    const latNorm = lat / (Math.PI / 2);
    for (let x = 0; x < width; x += 1) {
      const lon = (x / width - 0.5) * Math.PI * 2;
      const base = fbm(lon, lat);
      const detail = fbm(lon * 2.2 + 2.5, lat * 2.0 - 0.8);
      const ridge = Math.sin(lon * 4.8 + Math.sin(lat * 2.4) * 1.6) * 0.12 + Math.cos(lat * 7.0 - lon * 1.6) * 0.06;
      const landField = base + detail * 0.18 + ridge;
      const polar = Math.abs(latNorm) > 0.82;
      const continent = !polar && landField > 0.16 + Math.abs(latNorm) * 0.06;
      const i = (y * width + x) * 4;
      if (continent) {
        const moisture = Math.max(0, Math.min(1, 0.55 + fbm(lon * 3.2 - 1.5, lat * 3.1 + 2.7) * 0.7));
        const elevation = Math.max(0, Math.min(1, 0.55 + detail));
        data[i] = Math.round(46 + 50 * elevation);
        data[i + 1] = Math.round(104 + 70 * moisture);
        data[i + 2] = Math.round(56 + 38 * (1 - moisture));
      } else {
        const depth = Math.max(0, Math.min(1, 0.52 + base * 0.55));
        data[i] = Math.round(6 + 8 * depth);
        data[i + 1] = Math.round(34 + 28 * depth);
        data[i + 2] = Math.round(65 + 46 * depth);
      }
      if (polar || Math.abs(latNorm) > 0.93) {
        const ice = Math.min(1, Math.max(0, (Math.abs(latNorm) - 0.78) / 0.22));
        data[i] = Math.round(140 + 95 * ice);
        data[i + 1] = Math.round(184 + 58 * ice);
        data[i + 2] = Math.round(202 + 44 * ice);
      }
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function makeCloudTexture() {
  const width = 768;
  const height = 384;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cloud texture could not be created.');
  const image = ctx.createImageData(width, height);
  const data = image.data;
  for (let y = 0; y < height; y += 1) {
    const lat = (0.5 - y / height) * Math.PI;
    for (let x = 0; x < width; x += 1) {
      const lon = (x / width - 0.5) * Math.PI * 2;
      const cloud = fbm(lon * 2.8 + 0.8, lat * 4.5 - 1.7) + Math.sin(lon * 9 + lat * 2.4) * 0.08;
      const alpha = Math.max(0, Math.min(210, Math.round((cloud - 0.05) * 260)));
      const i = (y * width + x) * 4;
      data[i] = 235;
      data[i + 1] = 245;
      data[i + 2] = 250;
      data[i + 3] = alpha;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function buildSatellite(busWidthM: number, busHeightM: number, busDepthM: number, panelAreaM2: number) {
  // The display uses a declared 1,000,000x linear visual exaggeration. All parts
  // use the same conversion so user-entered dimensions preserve their proportions.
  const root = new THREE.Group();
  const displayUnitsPerMetre = (5.15 / 6378.137 / 1000) * 1_000_000;
  const w = Math.max(0.01, busWidthM) * displayUnitsPerMetre;
  const h = Math.max(0.01, busHeightM) * displayUnitsPerMetre;
  const d = Math.max(0.01, busDepthM) * displayUnitsPerMetre;
  const panelSideM = Math.sqrt(Math.max(0.01, panelAreaM2) / 2);
  const panelSide = panelSideM * displayUnitsPerMetre;
  const busMaterial = new THREE.MeshStandardMaterial({ color: 0xb7bdc8, metalness: 0.65, roughness: 0.35 });
  const panelMaterial = new THREE.MeshStandardMaterial({ color: 0x214a6d, metalness: 0.4, roughness: 0.2, emissive: 0x06243c, emissiveIntensity: 0.5 });
  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0xc7a85a, metalness: 0.8, roughness: 0.28 });
  const bus = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), busMaterial);
  const panelThickness = Math.max(0.008, 0.012 * displayUnitsPerMetre);
  const panelA = new THREE.Mesh(new THREE.BoxGeometry(panelThickness, panelSide, panelSide), panelMaterial);
  const panelB = panelA.clone();
  panelA.position.x = -(w / 2 + panelSide / 2);
  panelB.position.x = w / 2 + panelSide / 2;
  const frameA = new THREE.Mesh(new THREE.BoxGeometry(panelThickness * 0.4, panelSide * 1.04, panelSide * 1.04), frameMaterial);
  const frameB = frameA.clone();
  frameA.position.copy(panelA.position);
  frameB.position.copy(panelB.position);
  const topPanel = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, Math.max(0.008, 0.012 * displayUnitsPerMetre), d * 0.82), new THREE.MeshStandardMaterial({ color: 0x334554, metalness: 0.3, roughness: 0.55 }));
  topPanel.position.y = h / 2 + 0.006;
  const antennaStem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, Math.max(h * 0.7, 0.06), 10), new THREE.MeshStandardMaterial({ color: 0xd8dde4, metalness: 0.8, roughness: 0.28 }));
  antennaStem.position.y = h / 2 + Math.max(h * 0.35, 0.03);
  const antenna = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.018, w * 0.08), 12, 12), new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.15, roughness: 0.45 }));
  antenna.position.y = antennaStem.position.y + Math.max(h * 0.35, 0.03);
  const dishRadius = Math.max(0.035, Math.min(w, h, d) * 0.55);
  const dishStem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, Math.max(d * 0.7, 0.05), 10), frameMaterial);
  dishStem.rotation.x = Math.PI / 2;
  dishStem.position.z = -(d / 2 + Math.max(d * 0.35, 0.025));
  const dish = new THREE.Mesh(new THREE.SphereGeometry(dishRadius, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8d959e, metalness: 0.65, roughness: 0.25, side: THREE.DoubleSide }));
  dish.rotation.x = -Math.PI / 2;
  dish.position.z = dishStem.position.z - Math.max(d * 0.25, 0.02);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.012, w * 0.06), 12, 12), new THREE.MeshBasicMaterial({ color: 0x72f1ff }));
  beacon.position.set(w * 0.28, h * 0.25, d * 0.34);
  root.add(bus, panelA, panelB, frameA, frameB, topPanel, antennaStem, antenna, dishStem, dish, beacon);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(Math.max(w, h, d) * 1.15, 18, 18), new THREE.MeshBasicMaterial({ color: 0x3cd3fe, transparent: true, opacity: 0.12, depthWrite: false }));
  root.add(halo);
  return { root, beacon, halo };
}

function scenePosition(r: number[], scale: number) {
  return new THREE.Vector3(r[0] * scale, r[2] * scale, r[1] * scale);
}

function updateFootprint(geometry: THREE.BufferGeometry, radial: THREE.Vector3, radius: number, angleDeg: number) {
  const points = 64;
  const tangent = Math.abs(radial.y) < 0.85 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  tangent.sub(radial.clone().multiplyScalar(tangent.dot(radial))).normalize();
  const bitangent = new THREE.Vector3().crossVectors(radial, tangent).normalize();
  const angular = THREE.MathUtils.degToRad(angleDeg);
  const ring = new Float32Array((points + 1) * 3);
  for (let i = 0; i <= points; i += 1) {
    const a = (i / points) * Math.PI * 2;
    const local = tangent.clone().multiplyScalar(Math.cos(a)).add(bitangent.clone().multiplyScalar(Math.sin(a)));
    const p = radial.clone().multiplyScalar(radius * Math.cos(angular)).add(local.multiplyScalar(radius * Math.sin(angular)));
    ring[i * 3] = p.x;
    ring[i * 3 + 1] = p.y;
    ring[i * 3 + 2] = p.z;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(ring, 3));
  geometry.attributes.position.needsUpdate = true;
}

export default function Earth3DScene({ model, current, seconds, name, propagator, footprintAngleDeg = 0.52, busWidthM = 0.1, busHeightM = 0.2, busDepthM = 0.1, altitudeKm = 550, eccentricity = 0, inclinationDeg = 0, raanDeg = 0, argumentOfPerigeeDeg = 0, trueAnomalyDeg = 0, periodMin = 95, panelAreaM2 = 0.6 }: Earth3DSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const modelRef = useRef(model);
  const currentRef = useRef(current);
  const designRef = useRef({ busWidthM, busHeightM, busDepthM, panelAreaM2 });
  const secondsRef = useRef(seconds);
  const cameraModeRef = useRef<CameraMode>('TRACK');  const showFootprintRef = useRef(true);