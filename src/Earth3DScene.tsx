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
  const showVectorsRef = useRef(true);
  const showAxesRef = useRef(false);
  const showSpaceEnvironmentRef = useRef(true);
  const selectedSatelliteRef = useRef('design');
  const footprintAngleRef = useRef(footprintAngleDeg);
  const frameRef = useRef<number | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>('TRACK');
  const [showFootprint, setShowFootprint] = useState(true);
  const [showVectors, setShowVectors] = useState(true);
  const [showAxes, setShowAxes] = useState(false);
  const [showSpaceEnvironment, setShowSpaceEnvironment] = useState(true);
  const [selectedSatellite, setSelectedSatellite] = useState('design');
  const [errorState, setErrorState] = useState('');
  const [wallTime, setWallTime] = useState(() => new Date());
  const cameraState = useRef({ yaw: 0.65, pitch: 0.26, distance: 11 });

  modelRef.current = model;
  currentRef.current = current;
  designRef.current = { busWidthM, busHeightM, busDepthM, panelAreaM2 };

  useEffect(() => {
    const timer = window.setInterval(() => setWallTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  secondsRef.current = seconds;
  cameraModeRef.current = cameraMode;
  showFootprintRef.current = showFootprint;
  showVectorsRef.current = showVectors;
  showAxesRef.current = showAxes;
  showSpaceEnvironmentRef.current = showSpaceEnvironment;
  selectedSatelliteRef.current = selectedSatellite;
  footprintAngleRef.current = footprintAngleDeg;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    let mounted = true;
    let cleanup = () => {};
    try {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#01040a');
      const sceneFog = new THREE.Fog('#01040a', 24, 52);
      scene.fog = sceneFog;
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 3500);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      const pixelRatioForViewport = () => Math.min(window.devicePixelRatio || 1, window.matchMedia('(max-width: 720px)').matches ? 1.25 : 1.75);
      renderer.setPixelRatio(pixelRatioForViewport());
      renderer.setSize(Math.max(container.clientWidth, 1), Math.max(container.clientHeight, 1), false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      container.replaceChildren(renderer.domElement);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.touchAction = 'none';

      const onContextLost = (event: Event) => {
        event.preventDefault();
        console.warn('Orbital Lab: WebGL context lost.');
        setErrorState('GPU WebGL context was lost. Reload to reinitialize the 3D viewport.');
        if (frameRef.current !== null) {
          cancelAnimationFrame(frameRef.current);
          frameRef.current = null;
        }
      };
      renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);

      const ambient = new THREE.HemisphereLight(0x9fd6ff, 0x06080c, 0.42);
      const sun = new THREE.DirectionalLight(0xffffff, 4.6);
      const rim = new THREE.DirectionalLight(0x59bfff, 0.7);
      scene.add(ambient, sun, rim);

      const starGeometry = new THREE.BufferGeometry();
      const stars = new Float32Array(900 * 3);
      for (let i = 0; i < 900; i += 1) {
        const radius = 40 + Math.random() * 24;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        stars[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        stars[i * 3 + 1] = radius * Math.cos(phi);
        stars[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
      }
      starGeometry.setAttribute('position', new THREE.BufferAttribute(stars, 3));
      const starMaterial = new THREE.PointsMaterial({ color: 0xbfe8ff, size: 0.045, sizeAttenuation: true, transparent: true, opacity: 0.9 });
      const starField = new THREE.Points(starGeometry, starMaterial);
      scene.add(starField);

      const earthRadius = 5.15;
      const scale = earthRadius / 6378.137;
      const moonRadius = earthRadius * (1737.4 / 6378.137);
      const moonDistance = earthRadius * (384400 / 6378.137);
      const earth = new THREE.Group();
      const earthTexture = makeEarthTexture();
      const nightTexture = makeNightLightsTexture();
      const cloudTexture = makeCloudTexture();
      const earthMaterial = new THREE.MeshPhongMaterial({ map: earthTexture, emissive: 0x03070d, emissiveMap: nightTexture, emissiveIntensity: 1.65, specular: 0x5d889c, shininess: 22 });
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(earthRadius, 128, 96), earthMaterial);
      earth.add(sphere);
      const cloudMaterial = new THREE.MeshPhongMaterial({ map: cloudTexture, transparent: true, opacity: 0.52, depthWrite: false, side: THREE.DoubleSide });
      const clouds = new THREE.Mesh(new THREE.SphereGeometry(earthRadius * 1.012, 96, 64), cloudMaterial);
      earth.add(clouds);
      const grid = new THREE.Mesh(new THREE.SphereGeometry(earthRadius * 1.004, 72, 48), new THREE.MeshBasicMaterial({ color: 0x9bdefe, wireframe: true, transparent: true, opacity: 0.035, depthWrite: false }));
      earth.add(grid);
      const atmosphereOuter = new THREE.Mesh(new THREE.SphereGeometry(earthRadius * 1.07, 96, 64), new THREE.MeshBasicMaterial({ color: 0x3bbcff, transparent: true, opacity: 0.08, side: THREE.BackSide, depthWrite: false }));
      earth.add(atmosphereOuter);
      const atmosphereCore = new THREE.Mesh(new THREE.SphereGeometry(earthRadius * 1.025, 96, 64), new THREE.MeshBasicMaterial({ color: 0x6dd8ff, transparent: true, opacity: 0.055, side: THREE.FrontSide, depthWrite: false }));
      earth.add(atmosphereCore);
      scene.add(earth);

      // The Moon and planet layer use a deliberately compressed display scale;
      // they are illustrative context, not ephemeris-grade planetary positions.
      const spaceEnvironment = createSpaceEnvironment(moonRadius, moonDistance);
      scene.add(spaceEnvironment.group);

      const orbitGeometry = new THREE.BufferGeometry();
      const orbitGlow = new THREE.Line(orbitGeometry, new THREE.LineBasicMaterial({ color: 0x1c97bc, transparent: true, opacity: 0.24 }));
      const orbitLine = new THREE.Line(orbitGeometry, new THREE.LineBasicMaterial({ color: 0x62e7ff, transparent: true, opacity: 0.95 }));
      scene.add(orbitGlow, orbitLine);

      let satellite = buildSatellite(busWidthM, busHeightM, busDepthM, panelAreaM2);
      let appliedSatellitePreset = selectedSatelliteRef.current;
      scene.add(satellite.root);

      const nadirGeometry = new THREE.BufferGeometry();
      const nadirPosition = new THREE.BufferAttribute(new Float32Array(6), 3);
      nadirGeometry.setAttribute('position', nadirPosition);
      nadirGeometry.setDrawRange(0, 2);
      const nadir = new THREE.Line(nadirGeometry, new THREE.LineBasicMaterial({ color: 0xffc857, transparent: true, opacity: 0.68 }));
      nadir.frustumCulled = false;
      scene.add(nadir);

      const footprintGeometry = new THREE.BufferGeometry();
      const footprint = new THREE.LineLoop(footprintGeometry, new THREE.LineBasicMaterial({ color: 0xffbf5a, transparent: true, opacity: 0.86 }));
      scene.add(footprint);

      const groundPoint = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffc857 }));
      scene.add(groundPoint);

      const velocityArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1.5, 0x64e8ff, 0.22, 0.12);
      const nadirArrow = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(), 1.3, 0xffc857, 0.2, 0.11);
      scene.add(velocityArrow, nadirArrow);

      const axes = new THREE.AxesHelper(7.1);
      axes.material.transparent = true;
      axes.material.opacity = 0.16;
      scene.add(axes);

      const resize = () => {
        const width = Math.max(container.clientWidth, 1);
        const height = Math.max(container.clientHeight, 1);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(pixelRatioForViewport());
        renderer.setSize(width, height, false);
      };
      const observer = new ResizeObserver(resize);
      observer.observe(container);

      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      const onPointerDown = (event: PointerEvent) => {
        dragging = true;
        lastX = event.clientX;
        lastY = event.clientY;
        renderer.domElement.setPointerCapture(event.pointerId);
      };
      const onPointerMove = (event: PointerEvent) => {
        if (!dragging) return;
        const dx = event.clientX - lastX;
        const dy = event.clientY - lastY;
        lastX = event.clientX;
        lastY = event.clientY;
        cameraState.current.yaw -= dx * 0.0075;
        cameraState.current.pitch = Math.max(-1.22, Math.min(1.22, cameraState.current.pitch - dy * 0.0075));
      };
      const onPointerUp = (event: PointerEvent) => {
        dragging = false;
        try { renderer.domElement.releasePointerCapture(event.pointerId); } catch {}
      };
      const onWheel = (event: WheelEvent) => {
        event.preventDefault();
        cameraState.current.distance = Math.max(2, Math.min(2600, cameraState.current.distance + event.deltaY * Math.max(0.012, cameraState.current.distance * 0.0012)));
      };
      renderer.domElement.addEventListener('pointerdown', onPointerDown);
      renderer.domElement.addEventListener('pointermove', onPointerMove);
      renderer.domElement.addEventListener('pointerup', onPointerUp);
      renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

      const updateOrbit = () => {
        const points = modelRef.current.map((point: any) => scenePosition(point.r, scale));
        orbitGeometry.setFromPoints(points);
      };
      updateOrbit();

      const animate = () => {
        if (!mounted) return;
        const state = currentRef.current;
        const markerVector = scenePosition(state.r, scale);
        const radial = markerVector.clone().normalize();
        const velocity = new THREE.Vector3(state.v[0] * scale, state.v[2] * scale, state.v[1] * scale);
        const tangent = velocity.lengthSq() > 1e-10 ? velocity.clone().sub(radial.clone().multiplyScalar(velocity.dot(radial))).normalize() : new THREE.Vector3(0, 1, 0);
        const side = new THREE.Vector3().crossVectors(radial, tangent).normalize();
        const basis = new THREE.Matrix4().makeBasis(side, tangent, radial);
        if (appliedSatellitePreset !== selectedSatelliteRef.current) {          const preset = selectedSatelliteRef.current;
          const dimensions: Record<string, [number, number, number, number]> = {
            design: [busWidthM, busHeightM, busDepthM, panelAreaM2],
            cubesat1u: [0.1, 0.1, 0.1, 0.04],
            cubesat3u: [0.1, 0.34, 0.1, 0.12],
            cubesat6u: [0.2, 0.34, 0.1, 0.24],
            microsat: [0.3, 0.4, 0.3, 1.2],
            iss: [73, 20, 109, 2500]
          };
          const dims = dimensions[preset] || dimensions.design;
          for (const child of satellite.root.children) {
            const mesh = child as THREE.Mesh;
            mesh.geometry?.dispose?.();
            const material = mesh.material;
            if (Array.isArray(material)) material.forEach(item => item.dispose()); else material?.dispose?.();
          }
          scene.remove(satellite.root);
          satellite = buildSatellite(...dims);
          scene.add(satellite.root);
          appliedSatellitePreset = preset;
        }
        satellite.root.position.copy(markerVector);
        satellite.root.quaternion.setFromRotationMatrix(basis);
        satellite.root.rotation.y += 0.008;
        satellite.beacon.material = satellite.beacon.material as THREE.Material;
        (satellite.beacon.material as THREE.MeshBasicMaterial).opacity = 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(performance.now() * 0.008));

        const ground = radial.clone().multiplyScalar(earthRadius * 1.012);
        groundPoint.position.copy(ground);
        nadirPosition.setXYZ(0, ground.x, ground.y, ground.z);
        nadirPosition.setXYZ(1, markerVector.x, markerVector.y, markerVector.z);
        nadirPosition.needsUpdate = true;
        updateFootprint(footprintGeometry, radial, earthRadius * 1.018, footprintAngleRef.current);
        footprint.visible = showFootprintRef.current;
        velocityArrow.position.copy(markerVector);
        velocityArrow.setDirection(velocity.lengthSq() > 1e-10 ? velocity.normalize() : new THREE.Vector3(0, 1, 0));
        velocityArrow.setLength(Math.max(1.1, Math.min(2.5, 1.1 + Math.hypot(...state.v) * 0.16)), 0.2, 0.11);
        nadirArrow.position.copy(markerVector);
        nadirArrow.setDirection(radial.clone().multiplyScalar(-1));
        nadirArrow.setLength(1.55, 0.21, 0.11);
        velocityArrow.visible = showVectorsRef.current;
        nadirArrow.visible = showVectorsRef.current;
        axes.visible = showAxesRef.current;
        const simSeconds = secondsRef.current;
        const earthRotation = Number.isFinite(simSeconds) ? -((simSeconds / 86164.0905) * Math.PI * 2) : 0;
        earth.rotation.y = earthRotation;
        clouds.rotation.y = earthRotation * 0.985;
        starField.rotation.y += 0.00002;

        const date = new Date(state.time || Date.now());
        const sunVector = solarEciDirection(date);
        // Keep solar illumination in the same scene frame as ECI-to-scene spacecraft coordinates.
        sun.position.set(sunVector.x * 30, sunVector.z * 30, sunVector.y * 30);
        rim.position.set(-sunVector.x * 14, -sunVector.z * 14, -sunVector.y * 14);
        spaceEnvironment.update(simSeconds);
        spaceEnvironment.group.visible = showSpaceEnvironmentRef.current;

        const mode = cameraModeRef.current;
        scene.fog = mode === 'SYSTEM' ? null : sceneFog;
        const s = cameraState.current;
        const origin = new THREE.Vector3();
        let target = origin;
        let distance = s.distance;
        if (mode === 'SATELLITE') {
          target = markerVector.clone();
          distance = Math.min(s.distance, 6.5);
        } else if (mode === 'MOON') {
          target = spaceEnvironment.moon.position.clone();
          distance = Math.min(s.distance, 2.0);
        } else if (mode === 'TRACK') {
          target = markerVector.clone().lerp(origin, 0.26);
          distance = Math.min(s.distance, 12.5);
        } else if (mode === 'SYSTEM') {
          target = origin;
          distance = s.distance;
        } else {
          target = origin;
          distance = Math.max(s.distance, 12);
        }
        const horizontal = Math.cos(s.pitch) * distance;
        camera.position.set(target.x + Math.sin(s.yaw) * horizontal, target.y + Math.sin(s.pitch) * distance, target.z + Math.cos(s.yaw) * horizontal);
        camera.lookAt(target);
        try {
          renderer.render(scene, camera);
        } catch (error) {
          setErrorState(error instanceof Error ? error.message : 'The WebGL renderer stopped unexpectedly.');
          if (frameRef.current !== null) {
            cancelAnimationFrame(frameRef.current);
            frameRef.current = null;
          }
          return;
        }
        frameRef.current = requestAnimationFrame(animate);
      };
      resize();
      animate();
      cleanup = () => {
        observer.disconnect();
        renderer.domElement.removeEventListener('webglcontextlost', onContextLost, false);
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
        renderer.domElement.removeEventListener('pointermove', onPointerMove);
        renderer.domElement.removeEventListener('pointerup', onPointerUp);
        renderer.domElement.removeEventListener('wheel', onWheel);
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
        orbitGeometry.dispose();
        (orbitGlow.material as THREE.Material).dispose();
        (orbitLine.material as THREE.Material).dispose();
        nadir.geometry.dispose();
        (nadir.material as THREE.Material).dispose();
        footprintGeometry.dispose();
        (footprint.material as THREE.Material).dispose();
        groundPoint.geometry.dispose();
        (groundPoint.material as THREE.Material).dispose();
        velocityArrow.line.geometry.dispose();
        (velocityArrow.line.material as THREE.Material).dispose();
        velocityArrow.cone.geometry.dispose();
        (velocityArrow.cone.material as THREE.Material).dispose();
        nadirArrow.line.geometry.dispose();
        (nadirArrow.line.material as THREE.Material).dispose();
        nadirArrow.cone.geometry.dispose();
        (nadirArrow.cone.material as THREE.Material).dispose();
        axes.geometry.dispose();
        (axes.material as THREE.Material).dispose();
        earthTexture.dispose();
        nightTexture.dispose();
        cloudTexture.dispose();
        spaceEnvironment.dispose();
        starGeometry.dispose();
        starMaterial.dispose();
        for (const child of satellite.root.children) {
          const mesh = child as THREE.Mesh;
          mesh.geometry?.dispose?.();
          const material = mesh.material;
          if (Array.isArray(material)) material.forEach(item => item.dispose()); else material?.dispose?.();
        }
        scene.clear();
        renderer.dispose();
      };
    } catch (error) {
      setErrorState(error instanceof Error ? error.message : '3D Earth could not be initialized.');
    }
    return () => {
      mounted = false;
      cleanup();
    };
  }, []);

  useEffect(() => {
    cameraModeRef.current = cameraMode;
    if (cameraMode === 'EARTH') cameraState.current.distance = 15;
    if (cameraMode === 'TRACK') cameraState.current.distance = Math.min(cameraState.current.distance, 12);
    if (cameraMode === 'SATELLITE') cameraState.current.distance = Math.min(cameraState.current.distance, 6.5);
    if (cameraMode === 'MOON') cameraState.current.distance = 2.0;
    if (cameraMode === 'SYSTEM') {
      const width = Math.max(1, containerRef.current?.clientWidth || 1);
      const height = Math.max(1, containerRef.current?.clientHeight || 1);
      const verticalFov = THREE.MathUtils.degToRad(42);
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * (width / height));
      const fitFov = Math.min(verticalFov, horizontalFov);
      const earthRadius = 5.15;
      const moonExtent = earthRadius * (384400 / 6378.137) + earthRadius * (1737.4 / 6378.137);
      cameraState.current.distance = Math.min(2600, (moonExtent + 1) / Math.tan(fitFov / 2) * 1.08);
    }
  }, [cameraMode]);

  const dayNight = dayNightSnapshot(Number(current?.lla?.lat), Number(current?.lla?.lon), new Date(current?.time || Date.now()));
  const speed = Math.hypot(...(current?.v || [0, 0, 0]));
  const maxBusDimensionM = Math.max(0.01, busWidthM, busHeightM, busDepthM);
  const earthDiameterKm = 2 * 6378.137;
  const trueEarthToBusRatio = (earthDiameterKm * 1000) / maxBusDimensionM;
  const visualExaggeration = 1_000_000;
  return (
    <div className="page">
      <div className="page-header"><div><small>3D MISSION VIEW</small><h1>Earth 3D</h1><p>A local spacecraft-tracking globe with a detailed Earth surface, orbital path, vectors and mission HUD.</p><small>Scale disclosure: Earth diameter is approximately {Math.round(trueEarthToBusRatio).toLocaleString()} times the maximum bus dimension at true scale. Spacecraft geometry is enlarged by {visualExaggeration.toLocaleString()}× for visibility; dimensions are not shown to physical scale.</small></div></div>
      <article className="earth3d-workspace glass-panel">
        <div className="earth3d-canvas" ref={containerRef} aria-label="Interactive 3D Earth with trackable spacecraft" />
        <div className="earth3d-topbar">
          <div className="earth3d-object">
            <span className="earth3d-live-dot" />
            <div><small>TRACKING OBJECT</small><b>{name || 'MySat-1'}</b></div>
            <span className="earth3d-badge">{propagator}</span>
            <span className="earth3d-ist-clock">REAL TIME · {formatIstDateTime(wallTime)} IST</span>
          </div>
          <div className="earth-camera-controls" aria-label="Camera modes">
            {(['TRACK', 'EARTH', 'SATELLITE', 'MOON', 'SYSTEM'] as CameraMode[]).map(mode => <button key={mode} type="button" className={`earth-camera-button ${cameraMode === mode ? 'active' : ''}`} onClick={() => { if (mode === 'MOON') setShowSpaceEnvironment(true); setCameraMode(mode); }}>{mode}</button>)}
            <button type="button" className="earth-camera-button" onClick={() => { cameraState.current = { yaw: 0.65, pitch: 0.26, distance: cameraMode === 'SATELLITE' ? 5.8 : cameraMode === 'EARTH' ? 15 : 11 }; }}>RESET</button>
          </div>
        </div>
        <div className="earth3d-left-hud">
          <div className="earth3d-hud-card"><small>POSITION / WGS84</small><b>{Number(current?.lla?.lat || 0).toFixed(3)}°</b><b>{Number(current?.lla?.lon || 0).toFixed(3)}°</b><span>ALT {Number(current?.lla?.alt || 0).toFixed(1)} km</span></div>
          <div className="earth3d-hud-card"><small>FLIGHT STATE</small><span>t+ {Number(seconds || 0).toFixed(1)} s</span><span>V {speed.toFixed(3)} km/s</span><span>{dayNight.isDay ? 'DAY SIDE' : 'NIGHT SIDE'} · {dayNight.localSolar}</span></div>
          <div className="earth3d-hud-card"><small>PHYSICAL SCALE · REFERENCE VALUES</small><span>EARTH RADIUS 6,378.137 km (WGS-84 equatorial)</span><span>MOON RADIUS 1,737.4 km · 0.2727 R⊕</span><span>EARTH–MOON CENTRES 384,400 km · 60.3 R⊕ mean</span><span>SUN RADIUS 695,700 km · 109.2 R⊕</span><span>SUN DISTANCE 149.6 million km · 1 AU mean</span><span>SPACECRAFT SIZE IS EXAGGERATED FOR VISIBILITY</span><span>ORBIT {inclinationDeg.toFixed(2)}° inc · e {eccentricity.toFixed(4)}</span></div>
          <div className="earth3d-hud-card"><small>ORBITAL ELEMENTS</small><span>RAAN {raanDeg.toFixed(2)}°</span><span>ARG PERIAPSIS {argumentOfPerigeeDeg.toFixed(2)}°</span><span>TRUE ANOMALY {trueAnomalyDeg.toFixed(2)}°</span><span>PERIOD {periodMin.toFixed(2)} min</span><span>RANGE FROM EARTH CENTRE {(6378.137 + Number(current?.lla?.alt ?? altitudeKm)).toFixed(2)} km</span></div>
        </div>
        <div className="earth3d-right-hud">
          <div className="earth3d-hud-card"><small>VISUAL LAYERS</small><label><input type="checkbox" checked={showFootprint} onChange={e => setShowFootprint(e.target.checked)} /> <span>Ground footprint</span></label><label><input type="checkbox" checked={showVectors} onChange={e => setShowVectors(e.target.checked)} /> <span>Velocity / nadir vectors</span></label><label><input type="checkbox" checked={showAxes} onChange={e => setShowAxes(e.target.checked)} /> <span>ECI axes</span></label></div>
          <div className="earth3d-hud-card"><small>EARTH–MOON SYSTEM</small><label><input type="checkbox" checked={showSpaceEnvironment} onChange={e => setShowSpaceEnvironment(e.target.checked)} /> <span>Show Moon and lunar orbit</span></label><div className="earth3d-planet-select"><span>SPACECRAFT MODEL</span><select aria-label="Choose spacecraft model" value={selectedSatellite} onChange={e => setSelectedSatellite(e.target.value)}><option value="design">Current mission design</option><option value="cubesat1u">CubeSat 1U · 10 cm</option><option value="cubesat3u">CubeSat 3U · 34 cm</option><option value="cubesat6u">CubeSat 6U</option><option value="microsat">Microsatellite · reference</option><option value="iss">ISS · reference silhouette</option></select></div><span>Model choice changes the 3D silhouette only; orbit and telemetry remain the selected mission state.</span></div>
          <div className="earth3d-hud-card"><small>SOLAR GEOMETRY</small><span>SUBSOLAR {dayNight.subsolarLat.toFixed(1)}°, {dayNight.subsolarLon.toFixed(1)}°</span><span>{dayNight.timeZone}</span></div>
        </div>
        <div className="earth3d-bottom-bar">
          <span><i className="legend-spacecraft" /> SPACECRAFT</span><span><i className="legend-orbit" /> ORBIT</span><span><i className="legend-footprint" /> FOOTPRINT · FOV GEOMETRY</span><span><i className="legend-vector" /> VECTORS</span>
          <span className="earth3d-help">DRAG TO ORBIT · WHEEL TO ZOOM · SYSTEM FRAMES EARTH + MOON · TRACK FOLLOWS SATELLITE</span>
        </div>
        {errorState && (
          <div className="earth-error" role="alert">
            <strong style={{ display: 'block', marginBottom: '8px', color: '#f87171', fontSize: '13px' }}>3D Viewport Offline</strong>
            <span style={{ display: 'block', color: '#cbd5e1', lineHeight: 1.5 }}>{errorState}</span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ marginTop: '12px', border: '1px solid #374151', borderRadius: '5px', padding: '7px 11px', background: '#1f2937', color: '#fff', cursor: 'pointer' }}
            >
              Retry GPU Init
            </button>
          </div>
        )}
      </article>
    </div>
  );
}