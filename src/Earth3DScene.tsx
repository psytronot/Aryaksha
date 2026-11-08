import { memo, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Maximize2, Minimize2, Pause, Play } from 'lucide-react';
import { dayNightSnapshot, greenwichMeanSiderealAngle, solarEciDirection } from './daynight';
import { applyEarthNightLightMask, makeFallbackNightLightsTexture } from './earthVisuals';
import { EARTH_IMAGERY_SOURCES, loadEarthImagery } from './earthImagery';
import { formatIstDateTime } from './time';
import { createSpaceEnvironment } from './solarSystem';
import { cloudRelativeRotation, earthCameraDistance, fitCameraDistance, MOON_CAMERA_MARGIN, MOON_ORBIT_PERIOD_SECONDS, moonCameraYaw, SYSTEM_CAMERA_MARGIN, SYSTEM_DISPLAY_DISTANCE_RATIO } from './earth3dMath';
import { disposeObjectResources, updateFootprint } from './earth3dGeometry';
import './earth3d-upgrade.css';

type Earth3DSceneProps = {
  model: any[];
  current: any;
  seconds: number;
  name: string;
  propagator: 'KEPLER' | 'SGP4';
  objectStatus?: 'TRACKED' | 'SIMULATED';
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
  missionType?: string;
  missionTarget?: string;
  payloadName?: string;
  payloadMassKg?: number;
  payloadPowerW?: number;
  spacecraftDryMassKg?: number;
  selectedPreset?: string;
  onApplyPreset?: (name: string, altitudeKm: number, inclinationDeg: number) => void;
  onUpdateOrbit?: (patch: { altitudeKm?: number; i?: number; raan?: number }) => void;
  onOpenMissionSetup?: () => void;
  onOpenOrbitDesign?: () => void;
  running: boolean;
  setRunning: (value: boolean) => void;
  playback: number;
  setPlayback: (value: number) => void;
  duration: number;
  setSeconds: (value: number) => void;
};

type CameraMode = 'TRACK' | 'EARTH' | 'SATELLITE' | 'MOON' | 'SYSTEM';

type MissionSetupPreset = { label: string; name: string; altitudeKm: number; inclinationDeg: number; detail: string };
const MISSION_SETUP_PRESETS: MissionSetupPreset[] = [
  { label: 'ISS', name: 'ISS-class', altitudeKm: 420, inclinationDeg: 51.6, detail: '~420 km LEO' },
  { label: 'POLAR', name: 'Weather / Polar', altitudeKm: 820, inclinationDeg: 98.7, detail: '~820 km polar reference' },
  { label: 'SUN-SYNC', name: 'Sun-Synchronous Reference', altitudeKm: 550, inclinationDeg: 97.6, detail: '~550 km SSO reference' },
  { label: 'GEO', name: 'GEO Communications', altitudeKm: 35786, inclinationDeg: 0, detail: '35,786 km GEO reference' },
];

type SimulationControlsProps = {
  running: boolean;
  setRunning: (value: boolean) => void;
  playback: number;
  setPlayback: (value: number) => void;
  simulationTimeRef: { current: string };
  secondsRef: { current: number };
};

type SimulationClockProps = {
  simulationTimeRef: { current: string };
  secondsRef: { current: number };
};

// Keep the one-second display clock isolated from the interactive playback
// controls. Updating telemetry must not detach their DOM hit targets.
const SimulationClock = memo(function SimulationClock({ simulationTimeRef, secondsRef }: SimulationClockProps) {
  const [simulationUtcLabel, setSimulationUtcLabel] = useState('2026-01-01 00:00:00.000 UTC');
  const [elapsedSeconds, setElapsedSeconds] = useState(secondsRef.current);

  useEffect(() => {
    const updateClock = () => {
      const date = new Date(simulationTimeRef.current || '2026-01-01T00:00:00.000Z');
      setSimulationUtcLabel(
        Number.isFinite(date.getTime())
          ? date.toISOString().replace('T', ' ').replace('Z', ' UTC')
          : 'UTC unavailable'
      );
      setElapsedSeconds(secondsRef.current);
    };
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, [simulationTimeRef, secondsRef]);

  return <div className="earth3d-simulation-clock"><small>SIMULATION TIME (UTC)</small><b>{simulationUtcLabel}</b><span>T+ {Number(elapsedSeconds || 0).toFixed(1)} s</span></div>;
});

const SimulationControls = memo(function SimulationControls({
  running,
  setRunning,
  playback,
  setPlayback,
  simulationTimeRef,
  secondsRef,
}: SimulationControlsProps) {
  return (
    <div className="earth3d-hud-card earth3d-simulation-controls-card" data-testid="earth3d-simulation-controls">
      <small>SIMULATION CONTROLS</small>
      <div className="earth3d-control-actions">
        <button type="button" className="earth3d-play-control" aria-label={running ? 'Pause simulation' : 'Play simulation'} onClick={() => setRunning(!running)}>{running ? <Pause size={13} /> : <Play size={13} />}<span>{running ? 'PAUSE' : 'PLAY'}</span></button>
        <div className="earth3d-speed-presets" role="group" aria-label="Simulation playback speed">
          {[1, 10, 20, 60, 120].map(rate => <button key={rate} type="button" aria-label={`Set playback speed ${rate}x`} aria-pressed={playback === rate} className={playback === rate ? 'active' : ''} onClick={() => setPlayback(rate)}>{rate}×</button>)}
        </div>
      </div>
      <SimulationClock simulationTimeRef={simulationTimeRef} secondsRef={secondsRef} />
    </div>
  );
});

type SceneGalleryProps = {
  cameraMode: CameraMode;
  setCameraMode: (mode: CameraMode) => void;
  setShowSpaceEnvironment: (visible: boolean) => void;
};

// The scene buttons are intentionally independent of the 4 Hz simulation
// timeline updates so their DOM nodes remain stable during hit-testing/clicks.
const SceneGallery = memo(function SceneGallery({ cameraMode, setCameraMode, setShowSpaceEnvironment }: SceneGalleryProps) {
  return (
    <div className="earth3d-scene-gallery" aria-label="Scene gallery">
      <button type="button" className={`earth3d-gallery-item ${cameraMode === "EARTH" ? "active" : ""}`} aria-label="Earth scene" aria-pressed={cameraMode === "EARTH"} onClick={() => setCameraMode("EARTH")}><span className="earth3d-gallery-thumb" data-scene="earth" aria-hidden="true" /><b>EARTH</b></button>
      <button type="button" className={`earth3d-gallery-item ${cameraMode === "MOON" ? "active" : ""}`} aria-label="Moon scene" aria-pressed={cameraMode === "MOON"} onClick={() => { setShowSpaceEnvironment(true); setCameraMode("MOON"); }}><span className="earth3d-gallery-thumb" data-scene="moon" aria-hidden="true" /><b>MOON</b></button>
      <button type="button" className={`earth3d-gallery-item ${cameraMode === "SYSTEM" ? "active" : ""}`} aria-label="Earth and Moon scene" aria-pressed={cameraMode === "SYSTEM"} onClick={() => { setShowSpaceEnvironment(true); setCameraMode("SYSTEM"); }}><span className="earth3d-gallery-thumb" data-scene="system" aria-hidden="true" /><b>EARTH + MOON</b></button>
    </div>
  );
});

function systemCameraDistance(width: number, height: number) {
  const earthRadius = 5.15;
  const moonRadius = earthRadius * (1737.4 / 6378.137);
  const moonDistance = earthRadius * (384400 / 6378.137);
  return Math.max(2, Math.min(2600,
    fitCameraDistance(width, height, moonDistance * SYSTEM_DISPLAY_DISTANCE_RATIO + moonRadius, 42, SYSTEM_CAMERA_MARGIN)
  ));
}

function moonCameraDistance(width: number, height: number) {
  const moonRadius = 5.15 * (1737.4 / 6378.137);
  return Math.max(2, Math.min(2600,
    fitCameraDistance(width, height, moonRadius, 42, MOON_CAMERA_MARGIN)
  ));
}

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

export default function Earth3DScene({ model, current, seconds, name, propagator, objectStatus = 'SIMULATED', footprintAngleDeg = 0.52, busWidthM = 0.1, busHeightM = 0.2, busDepthM = 0.1, altitudeKm = 550, eccentricity = 0, inclinationDeg = 0, raanDeg = 0, argumentOfPerigeeDeg = 0, trueAnomalyDeg = 0, periodMin = 95, panelAreaM2 = 0.6, missionType = 'Earth Observation', missionTarget = '—', payloadName = 'Payload', payloadMassKg = 0, payloadPowerW = 0, spacecraftDryMassKg = 0, selectedPreset = 'Sun-Synchronous Reference', onApplyPreset, onUpdateOrbit, onOpenMissionSetup, onOpenOrbitDesign, running, setRunning, playback, setPlayback, duration, setSeconds }: Earth3DSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const modelRef = useRef(model);
  const currentRef = useRef(current);
  const designRef = useRef({ busWidthM, busHeightM, busDepthM, panelAreaM2 });
  const secondsRef = useRef(seconds);
  const simulationTimeRef = useRef<string>('2026-01-01T00:00:00.000Z');
  const initialCameraMode: CameraMode = typeof window !== 'undefined' && window.matchMedia('(max-width: 800px)').matches ? 'EARTH' : 'TRACK';
  const cameraModeRef = useRef<CameraMode>(initialCameraMode);
  const previousCameraModeRef = useRef<CameraMode>('TRACK');  const showFootprintRef = useRef(true);
  const showVectorsRef = useRef(true);
  const showAxesRef = useRef(false);
  const showGridRef = useRef(false);
  const showSpaceEnvironmentRef = useRef(true);
  const selectedSatelliteRef = useRef('design');
  const footprintAngleRef = useRef(footprintAngleDeg);
  const frameRef = useRef<number | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>(initialCameraMode);
  const [showFootprint, setShowFootprint] = useState(true);
  const [showVectors, setShowVectors] = useState(true);
  const [showAxes, setShowAxes] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showSpaceEnvironment, setShowSpaceEnvironment] = useState(true);
  const [selectedSatellite, setSelectedSatellite] = useState('design');
  const [errorState, setErrorState] = useState('');
  const [imageryState, setImageryState] = useState<'loading' | 'nasa' | 'partial' | 'fallback'>('loading');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobileHudOpen, setMobileHudOpen] = useState(false);
  const [missionSetupTab, setMissionSetupTab] = useState<'presets' | 'custom'>('presets');
  const [imageryStatus, setImageryStatus] = useState('Loading NASA Blue Marble and Black Marble imagery…');
  const [wallTime, setWallTime] = useState(() => new Date());
  const cameraState = useRef({ yaw: 0.65, pitch: 0.26, distance: 11 });
  const systemZoomRatioRef = useRef(1);
  const moonZoomRatioRef = useRef(1);
  const earthZoomRatioRef = useRef(1);

  modelRef.current = model;
  currentRef.current = current;
  simulationTimeRef.current = String(current?.time || '2026-01-01T00:00:00.000Z');
  designRef.current = { busWidthM, busHeightM, busDepthM, panelAreaM2 };

  useEffect(() => {
    const timer = window.setInterval(() => setWallTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const syncFullscreenState = () => setIsFullscreen(document.fullscreenElement === workspaceRef.current);
    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, []);
  secondsRef.current = seconds;
  cameraModeRef.current = cameraMode;
  showFootprintRef.current = showFootprint;
  showVectorsRef.current = showVectors;
  showAxesRef.current = showAxes;
  showGridRef.current = showGrid;
  showSpaceEnvironmentRef.current = showSpaceEnvironment;
  selectedSatelliteRef.current = selectedSatellite;
  footprintAngleRef.current = footprintAngleDeg;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    // AppDeploy injects a fixed <pwa-install> host outside the React tree. Keep it
    // out of the interactive Earth 3D workspace so it cannot intercept controls.
    document.documentElement.classList.add('earth3d-active');
    let mounted = true;
    let cleanup = () => {};
    const imageryAbortController = new AbortController();
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
      let earthTexture: THREE.Texture = makeEarthTexture();
      let nightTexture: THREE.Texture = makeFallbackNightLightsTexture();
      const cloudTexture = makeCloudTexture();
      const earthMaterial = new THREE.MeshPhongMaterial({ map: earthTexture, emissive: 0xffffff, emissiveMap: nightTexture, emissiveIntensity: 1.25, specular: 0x5d889c, shininess: 22 });
      const earthSunUniform = { value: new THREE.Vector3(1, 0, 0) };
      applyEarthNightLightMask(earthMaterial, earthSunUniform);
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(earthRadius, 128, 96), earthMaterial);
      earth.add(sphere);
      const cloudMaterial = new THREE.MeshPhongMaterial({ map: cloudTexture, transparent: true, opacity: 0.52, depthWrite: false, side: THREE.DoubleSide });
      const clouds = new THREE.Mesh(new THREE.SphereGeometry(earthRadius * 1.012, 96, 64), cloudMaterial);
      earth.add(clouds);
      const grid = new THREE.Mesh(new THREE.SphereGeometry(earthRadius * 1.004, 72, 48), new THREE.MeshBasicMaterial({ color: 0x9bdefe, wireframe: true, transparent: true, opacity: 0.035, depthWrite: false }));
      grid.visible = false;
      earth.add(grid);
      const atmosphereOuter = new THREE.Mesh(new THREE.SphereGeometry(earthRadius * 1.07, 96, 64), new THREE.MeshBasicMaterial({ color: 0x3bbcff, transparent: true, opacity: 0.08, side: THREE.BackSide, depthWrite: false }));
      earth.add(atmosphereOuter);
      const atmosphereCore = new THREE.Mesh(new THREE.SphereGeometry(earthRadius * 1.025, 96, 64), new THREE.MeshBasicMaterial({ color: 0x6dd8ff, transparent: true, opacity: 0.055, side: THREE.FrontSide, depthWrite: false }));
      earth.add(atmosphereCore);
      scene.add(earth);

      container.dataset.earthImageryState = 'loading';
      container.dataset.earthImageryAlbedo = 'cartographic-fallback';
      container.dataset.earthImageryNightLights = 'transparent-fallback';
      void loadEarthImagery(imageryAbortController.signal).then(({ albedo, nightLights, failures }) => {
        if (!mounted || imageryAbortController.signal.aborted) {
          albedo?.dispose();
          nightLights?.dispose();
          return;
        }

        if (albedo) {
          const fallback = earthTexture;
          earthTexture = albedo;
          earthMaterial.map = albedo;
          fallback.dispose();
        }
        if (nightLights) {
          const fallback = nightTexture;
          nightTexture = nightLights;
          earthMaterial.emissiveMap = nightLights;
          fallback.dispose();
        }
        earthMaterial.needsUpdate = true;

        const nextState = albedo && nightLights ? 'nasa' : albedo || nightLights ? 'partial' : 'fallback';
        const albedoSource = albedo ? EARTH_IMAGERY_SOURCES.albedo.id : 'cartographic-fallback';
        const nightLightsSource = nightLights ? EARTH_IMAGERY_SOURCES.nightLights.id : 'transparent-fallback';
        container.dataset.earthImageryState = nextState;
        container.dataset.earthImageryAlbedo = albedoSource;
        container.dataset.earthImageryNightLights = nightLightsSource;
        container.dataset.earthImageryFailures = Object.keys(failures).join(',');
        setImageryState(nextState);
        setImageryStatus(`${albedo ? 'NASA Blue Marble' : 'Cartographic fallback'} · ${nightLights ? 'NASA Black Marble' : 'No night-light layer'}`);
        if (Object.keys(failures).length > 0) {
          console.warn('Orbital Lab: one or more NASA Earth imagery layers used their safe fallback.', failures);
        }
      }).catch((error) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        if (!mounted) return;
        container.dataset.earthImageryState = 'fallback';
        container.dataset.earthImageryAlbedo = 'cartographic-fallback';
        container.dataset.earthImageryNightLights = 'transparent-fallback';
        setImageryState('fallback');
        setImageryStatus('Cartographic fallback · No night-light layer');
        console.warn('Orbital Lab: NASA Earth imagery could not be loaded; safe fallback textures remain active.', error);
      });

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
      const footprintSegments = 64;
      const footprintPosition = new THREE.BufferAttribute(new Float32Array((footprintSegments + 1) * 3), 3);
      footprintGeometry.setAttribute('position', footprintPosition);
      footprintGeometry.setDrawRange(0, footprintSegments + 1);
      const footprintTangent = new THREE.Vector3();
      const footprintBitangent = new THREE.Vector3();
      const footprintUnitCircle = new Float32Array((footprintSegments + 1) * 2);
      for (let i = 0; i < footprintSegments; i += 1) {
        const angle = (i / footprintSegments) * Math.PI * 2;
        footprintUnitCircle[i * 2] = Math.cos(angle);
        footprintUnitCircle[i * 2 + 1] = Math.sin(angle);
      }
      footprintUnitCircle[footprintSegments * 2] = footprintUnitCircle[0];
      footprintUnitCircle[footprintSegments * 2 + 1] = footprintUnitCircle[1];
      const footprint = new THREE.LineLoop(footprintGeometry, new THREE.LineBasicMaterial({ color: 0xffbf5a, transparent: true, opacity: 0.86 }));
      footprint.frustumCulled = false;
      scene.add(footprint);

      const groundPoint = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffc857 }));
      scene.add(groundPoint);

      const velocityArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1.5, 0x64e8ff, 0.22, 0.12);
      const nadirArrow = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(), 1.3, 0xffc857, 0.2, 0.11);
      scene.add(velocityArrow, nadirArrow);

      const axes = new THREE.AxesHelper(7.1);
      const axesMaterials = Array.isArray(axes.material) ? axes.material : [axes.material];
      axesMaterials.forEach(material => {
        material.transparent = true;
        material.opacity = 0.16;
      });
      scene.add(axes);

      const resize = () => {
        const width = Math.max(container.clientWidth, 1);
        const height = Math.max(container.clientHeight, 1);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(pixelRatioForViewport());
        renderer.setSize(width, height, false);
        container.dataset.cameraViewport = `${width}x${height}`;
        if (cameraModeRef.current === 'SYSTEM') cameraState.current.distance = Math.max(2, Math.min(2600, systemCameraDistance(width, height) * systemZoomRatioRef.current));
        if (cameraModeRef.current === 'MOON') cameraState.current.distance = Math.max(2, Math.min(2600, moonCameraDistance(width, height) * moonZoomRatioRef.current));
        if (cameraModeRef.current === 'EARTH') cameraState.current.distance = Math.max(2, Math.min(2600, earthCameraDistance(width, height) * earthZoomRatioRef.current));
      };
      let resizeFrame: number | null = null;
      const scheduleResize = () => {
        if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => {
          resizeFrame = null;
          resize();
        });
      };
      const observer = new ResizeObserver(resize);
      observer.observe(container);
      window.addEventListener('resize', scheduleResize, { passive: true });
      window.addEventListener('orientationchange', scheduleResize, { passive: true });
      window.visualViewport?.addEventListener('resize', scheduleResize, { passive: true });

      const activePointers = new Map<number, { x: number; y: number }>();
      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      let lastPinchDistance = 0;
      const pointerPairDistance = () => {
        const points = [...activePointers.values()];
        if (points.length < 2) return 0;
        return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      };
      const updateZoomRatio = () => {
        const width = Math.max(container.clientWidth, 1);
        const height = Math.max(container.clientHeight, 1);
        if (cameraModeRef.current === 'SYSTEM') systemZoomRatioRef.current = cameraState.current.distance / systemCameraDistance(width, height);
        if (cameraModeRef.current === 'MOON') moonZoomRatioRef.current = cameraState.current.distance / moonCameraDistance(width, height);
        if (cameraModeRef.current === 'EARTH') earthZoomRatioRef.current = cameraState.current.distance / earthCameraDistance(width, height);
      };
      let lastCameraDistance = Number.NaN;
      let lastCameraYaw = Number.NaN;
      let lastCameraPitch = Number.NaN;
      let lastMoonFacingDiagnosticAt = 0;
      const syncCameraDiagnostics = () => {
        const state = cameraState.current;
        if (!Number.isFinite(lastCameraDistance) || Math.abs(state.distance - lastCameraDistance) > 1e-6) {
          container.dataset.cameraDistance = state.distance.toFixed(6);
          lastCameraDistance = state.distance;
        }
        if (!Number.isFinite(lastCameraYaw) || Math.abs(state.yaw - lastCameraYaw) > 1e-6) {
          container.dataset.cameraYaw = state.yaw.toFixed(6);
          lastCameraYaw = state.yaw;
        }
        if (!Number.isFinite(lastCameraPitch) || Math.abs(state.pitch - lastCameraPitch) > 1e-6) {
          container.dataset.cameraPitch = state.pitch.toFixed(6);
          lastCameraPitch = state.pitch;
        }
        if (container.dataset.cameraMode !== cameraModeRef.current) container.dataset.cameraMode = cameraModeRef.current;
      };
      const onPointerDown = (event: PointerEvent) => {
        activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        dragging = activePointers.size === 1;
        lastX = event.clientX;
        lastY = event.clientY;
        lastPinchDistance = pointerPairDistance();
        try { renderer.domElement.setPointerCapture(event.pointerId); } catch {}
      };
      const onPointerMove = (event: PointerEvent) => {
        if (!activePointers.has(event.pointerId)) return;
        activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (activePointers.size >= 2) {
          const nextDistance = pointerPairDistance();
          if (lastPinchDistance > 0 && nextDistance > 0) {
            cameraState.current.distance = Math.max(2, Math.min(2600, cameraState.current.distance * lastPinchDistance / nextDistance));
            updateZoomRatio();
          }
          lastPinchDistance = nextDistance;
          return;
        }
        if (!dragging) return;
        const dx = event.clientX - lastX;
        const dy = event.clientY - lastY;
        lastX = event.clientX;
        lastY = event.clientY;
        cameraState.current.yaw -= dx * 0.0075;
        cameraState.current.pitch = Math.max(-1.22, Math.min(1.22, cameraState.current.pitch - dy * 0.0075));
      };
      const onPointerUp = (event: PointerEvent) => {
        activePointers.delete(event.pointerId);
        dragging = activePointers.size === 1;
        if (dragging) {
          const remaining = [...activePointers.values()][0];
          lastX = remaining.x;
          lastY = remaining.y;
        }
        lastPinchDistance = pointerPairDistance();
        try { renderer.domElement.releasePointerCapture(event.pointerId); } catch {}
      };
      const onWheel = (event: WheelEvent) => {
        event.preventDefault();
        cameraState.current.distance = Math.max(2, Math.min(2600, cameraState.current.distance + event.deltaY * Math.max(0.012, cameraState.current.distance * 0.0012)));
        updateZoomRatio();
      };
      renderer.domElement.addEventListener('pointerdown', onPointerDown);
      renderer.domElement.addEventListener('pointermove', onPointerMove);
      renderer.domElement.addEventListener('pointerup', onPointerUp);
      renderer.domElement.addEventListener('pointercancel', onPointerUp);
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
          disposeObjectResources(satellite.root);
          scene.remove(satellite.root);
          satellite = buildSatellite(...dims);
          scene.add(satellite.root);
          appliedSatellitePreset = preset;
        }
        satellite.root.position.copy(markerVector);
        satellite.root.quaternion.setFromRotationMatrix(basis);
        satellite.root.rotation.y += 0.008;
        (satellite.beacon.material as THREE.MeshBasicMaterial).opacity = 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(performance.now() * 0.008));

        const ground = radial.clone().multiplyScalar(earthRadius * 1.012);
        groundPoint.position.copy(ground);
        nadirPosition.setXYZ(0, ground.x, ground.y, ground.z);
        nadirPosition.setXYZ(1, markerVector.x, markerVector.y, markerVector.z);
        nadirPosition.needsUpdate = true;
        updateFootprint(footprintPosition, radial, earthRadius * 1.018, footprintAngleRef.current, footprintTangent, footprintBitangent, footprintUnitCircle);
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
        grid.visible = showGridRef.current;
        container.dataset.gridVisible = String(grid.visible);
        const simSeconds = secondsRef.current;
        const date = new Date(state.time || Date.now());
        // The Earth-fixed texture frame rotates into ECI by -GMST in this Y-up scene.
        // Use the absolute simulation epoch, not elapsed seconds from an arbitrary zero.
        const earthRotation = -greenwichMeanSiderealAngle(date);
        earth.rotation.y = earthRotation;
        clouds.rotation.y = cloudRelativeRotation(earthRotation);
        starField.rotation.y += 0.00002;

        const sunVector = solarEciDirection(date);
        // Keep solar illumination in the same scene frame as ECI-to-scene spacecraft coordinates.
        earthSunUniform.value.set(sunVector.x, sunVector.z, sunVector.y).normalize();
        sun.position.copy(earthSunUniform.value).multiplyScalar(30);
        rim.position.copy(earthSunUniform.value).multiplyScalar(-14);
        const mode = cameraModeRef.current;
        spaceEnvironment.update(simSeconds, mode === 'SYSTEM' ? SYSTEM_DISPLAY_DISTANCE_RATIO : 1);
        const moonPhase = (simSeconds / MOON_ORBIT_PERIOD_SECONDS) * Math.PI * 2;
        spaceEnvironment.group.visible = showSpaceEnvironmentRef.current;
        syncCameraDiagnostics();
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
          distance = s.distance;
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
        const cameraYaw = mode === 'MOON' ? moonCameraYaw(moonPhase, s.yaw) : s.yaw;
        if (mode === 'MOON') {
          const diagnosticTime = performance.now();
          if (diagnosticTime - lastMoonFacingDiagnosticAt >= 100) {
            const moonPosition = spaceEnvironment.moon.position;
            const earthX = -moonPosition.x;
            const earthZ = -moonPosition.z;
            const earthLength = Math.hypot(earthX, earthZ) || 1;
            const cameraX = Math.sin(cameraYaw);
            const cameraZ = Math.cos(cameraYaw);
            container.dataset.moonEarthFacingDot = ((cameraX * earthX + cameraZ * earthZ) / earthLength).toFixed(6);
            lastMoonFacingDiagnosticAt = diagnosticTime;
          }
        } else {
          delete container.dataset.moonEarthFacingDot;
        }
        camera.position.set(target.x + Math.sin(cameraYaw) * horizontal, target.y + Math.sin(s.pitch) * distance, target.z + Math.cos(cameraYaw) * horizontal);
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
        window.removeEventListener('resize', scheduleResize);
        window.removeEventListener('orientationchange', scheduleResize);
        window.visualViewport?.removeEventListener('resize', scheduleResize);
        if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
        renderer.domElement.removeEventListener('webglcontextlost', onContextLost, false);
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
        renderer.domElement.removeEventListener('pointermove', onPointerMove);
        renderer.domElement.removeEventListener('pointerup', onPointerUp);
        renderer.domElement.removeEventListener('pointercancel', onPointerUp);
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
        disposeObjectResources(earth);
        disposeObjectResources(satellite.root);
        earthTexture.dispose();
        nightTexture.dispose();
        cloudTexture.dispose();
        spaceEnvironment.dispose();
        starGeometry.dispose();
        starMaterial.dispose();
        scene.clear();
        renderer.forceContextLoss();
        renderer.dispose();
        if (renderer.domElement.parentElement === container) container.removeChild(renderer.domElement);
      };
    } catch (error) {
      setErrorState(error instanceof Error ? error.message : '3D Earth could not be initialized.');
    }
    return () => {
      mounted = false;
      document.documentElement.classList.remove('earth3d-active');
      imageryAbortController.abort();
      cleanup();
    };
  }, []);

  useEffect(() => {
    cameraModeRef.current = cameraMode;
    if (cameraMode === 'MOON') {
      cameraState.current.yaw = 0;
      cameraState.current.pitch = 0.16;
    } else if (previousCameraModeRef.current === 'MOON') {
      cameraState.current.yaw = 0.65;
      cameraState.current.pitch = 0.26;
    }
    previousCameraModeRef.current = cameraMode;
    if (cameraMode === 'EARTH') cameraState.current.distance = earthCameraDistance(containerRef.current?.clientWidth || 1, containerRef.current?.clientHeight || 1) * earthZoomRatioRef.current;
    if (cameraMode === 'TRACK') cameraState.current.distance = Math.min(cameraState.current.distance, 12);
    if (cameraMode === 'SATELLITE') cameraState.current.distance = Math.min(cameraState.current.distance, 6.5);
    if (cameraMode === 'MOON') cameraState.current.distance = Math.max(2, Math.min(2600, moonCameraDistance(containerRef.current?.clientWidth || 1, containerRef.current?.clientHeight || 1) * moonZoomRatioRef.current));
    if (cameraMode === 'SYSTEM') cameraState.current.distance = Math.max(2, Math.min(2600, systemCameraDistance(containerRef.current?.clientWidth || 1, containerRef.current?.clientHeight || 1) * systemZoomRatioRef.current));
  }, [cameraMode]);

  const toggleFullscreen = async () => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (typeof workspace.requestFullscreen === 'function') {
        await workspace.requestFullscreen();
      } else {
        setErrorState('Full-screen mode is not supported by this browser.');
      }
    } catch (error) {
      setErrorState(error instanceof Error ? error.message : 'Full-screen mode could not be opened.');
    }
  };

  const simulationUtc = new Date(current?.time || '2026-01-01T00:00:00.000Z');
  const dayNight = dayNightSnapshot(Number(current?.lla?.lat), Number(current?.lla?.lon), simulationUtc);
  const speed = Math.hypot(...(current?.v || [0, 0, 0]));
  const maxBusDimensionM = Math.max(0.01, busWidthM, busHeightM, busDepthM);
  const earthDiameterKm = 2 * 6378.137;
  const trueEarthToBusRatio = (earthDiameterKm * 1000) / maxBusDimensionM;
  const visualExaggeration = 1_000_000;
  return (
    <div className="page">
      <div className="page-header earth3d-page-header"><div><small>3D MISSION VIEW</small><h1>Earth 3D</h1><p>A local spacecraft-tracking globe with asynchronous NASA Earth imagery, orbital path, vectors and mission HUD.</p><small className="earth3d-imagery-status" data-testid="earth-imagery-status" data-imagery-state={imageryState} role="status" aria-live="polite">{imageryStatus}</small><small>Scale disclosure: Earth diameter is approximately {Math.round(trueEarthToBusRatio).toLocaleString()} times the maximum bus dimension at true scale. Spacecraft geometry is enlarged by {visualExaggeration.toLocaleString()}× for visibility; dimensions are not shown to physical scale.</small></div></div>
      <article ref={workspaceRef} className="earth3d-workspace glass-panel">
        <div className="earth3d-canvas" ref={containerRef} role="region" aria-label="Interactive 3D Earth with trackable spacecraft" />
        <div className="earth3d-topbar">
          <div className="earth3d-object">
            <span className="earth3d-live-dot" />
            <div><small>{objectStatus === 'TRACKED' ? 'TRACKED OBJECT' : 'SIMULATED MISSION OBJECT'}</small><b>{name || 'MySat-1'}</b></div>
            <span className={`earth3d-badge earth3d-source-badge ${objectStatus.toLowerCase()}`}>{objectStatus}</span>
            <span className="earth3d-badge">{propagator}</span>
            <span className="earth3d-ist-clock">LOCAL CLOCK · {formatIstDateTime(wallTime)} IST</span>
          </div>
          <div className="earth-camera-controls" aria-label="Camera modes">
            {(['TRACK', 'EARTH', 'SATELLITE', 'MOON', 'SYSTEM'] as CameraMode[]).map(mode => <button key={mode} type="button" className={`earth-camera-button ${cameraMode === mode ? 'active' : ''}`} onClick={() => { if (mode === 'MOON' || mode === 'SYSTEM') setShowSpaceEnvironment(true); setCameraMode(mode); }}>{mode}</button>)}
            <button type="button" className="earth-camera-button" aria-label="Reset camera framing" onClick={() => { const width = containerRef.current?.clientWidth || 1; const height = containerRef.current?.clientHeight || 1; if (cameraMode === 'SYSTEM') systemZoomRatioRef.current = 1; if (cameraMode === 'MOON') moonZoomRatioRef.current = 1; if (cameraMode === 'EARTH') earthZoomRatioRef.current = 1; const distance = cameraMode === 'SATELLITE' ? 5.8 : cameraMode === 'EARTH' ? earthCameraDistance(width, height) : cameraMode === 'MOON' ? moonCameraDistance(width, height) : cameraMode === 'SYSTEM' ? systemCameraDistance(width, height) : 11; cameraState.current = { yaw: cameraMode === 'MOON' ? 0 : 0.65, pitch: cameraMode === 'MOON' ? 0.16 : 0.26, distance }; }}>RESET</button>
            <button type='button' className='earth-camera-button earth-fullscreen-button' aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'} onClick={() => void toggleFullscreen()}>{isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}<span>{isFullscreen ? 'EXIT FULL SCREEN' : 'FULL SCREEN'}</span></button>
            <button type="button" className="earth-camera-button earth-mobile-data-toggle" aria-label={mobileHudOpen ? 'Hide mission data panels' : 'Show mission data panels'} aria-expanded={mobileHudOpen} aria-controls="earth3d-left-hud earth3d-right-hud" onClick={() => setMobileHudOpen(value => !value)}>DATA</button>
          </div>
        </div>
        <div id="earth3d-left-hud" className="earth3d-left-hud" data-mobile-open={mobileHudOpen ? "true" : "false"} role="complementary" aria-label="Mission setup, state and orbital details">
          <div className="earth3d-hud-card earth3d-mission-setup-card" data-testid="earth3d-mission-setup">
            <div className="earth3d-card-heading"><small>MISSION SETUP</small><span>{missionType}</span></div>
            <b className="earth3d-mission-setup-name">{name || 'MySat-1'}</b>
            <span className="earth3d-mission-setup-target">{missionTarget} · {payloadName}</span>
            <div className="earth3d-mission-setup-tabs" role="tablist" aria-label="Mission setup mode">
              <button type="button" role="tab" aria-selected={missionSetupTab === 'presets'} className={missionSetupTab === 'presets' ? 'active' : ''} onClick={() => setMissionSetupTab('presets')}>QUICK PRESETS</button>
              <button type="button" role="tab" aria-selected={missionSetupTab === 'custom'} className={missionSetupTab === 'custom' ? 'active' : ''} onClick={() => setMissionSetupTab('custom')}>CUSTOM ORBIT</button>
            </div>
            {missionSetupTab === 'presets' ? (
              <div className="earth3d-mission-preset-list">
                {MISSION_SETUP_PRESETS.map(preset => (
                  <button key={preset.name} type="button" aria-pressed={selectedPreset === preset.name} className={selectedPreset === preset.name ? 'active' : ''} onClick={() => onApplyPreset?.(preset.name, preset.altitudeKm, preset.inclinationDeg)}>
                    <span>{preset.label}</span><small>{preset.detail}</small>
                  </button>
                ))}
              </div>
            ) : (
              <div className="earth3d-custom-orbit">
                <label>ALTITUDE · KM<input aria-label="Mission setup altitude" type="number" min="120" max="35786" step="1" value={altitudeKm} onChange={event => { const value = Number(event.currentTarget.value); if (Number.isFinite(value) && value >= 120 && value <= 35786) onUpdateOrbit?.({ altitudeKm: value }); }} /></label>
                <label>INCLINATION · DEG<input aria-label="Mission setup inclination" type="number" min="0" max="180" step="0.1" value={inclinationDeg} onChange={event => { const value = Number(event.currentTarget.value); if (Number.isFinite(value) && value >= 0 && value <= 180) onUpdateOrbit?.({ i: value }); }} /></label>
                <label>RAAN · DEG<input aria-label="Mission setup RAAN" type="number" min="0" max="360" step="0.1" value={raanDeg} onChange={event => { const value = Number(event.currentTarget.value); if (Number.isFinite(value) && value >= 0 && value <= 360) onUpdateOrbit?.({ raan: value }); }} /></label>
                <small>Edits update the existing two-body orbit state; J2 and drag are not propagated.</small>
              </div>
            )}
            <div className="earth3d-mission-setup-actions">
              <button type="button" aria-label="Edit mission requirements" onClick={() => onOpenMissionSetup?.()}>MISSION</button>
              <button type="button" aria-label="Open full orbit design" onClick={() => onOpenOrbitDesign?.()}>ORBIT</button>
              <button type="button" className="primary-action" aria-label={running ? 'Simulation already running' : 'Start simulation'} onClick={() => setRunning(true)} disabled={running}>{running ? 'RUNNING' : 'START SIMULATION'}</button>
            </div>
            <div className="earth3d-mission-setup-meta"><span>PAYLOAD {payloadMassKg.toFixed(1)} kg · {payloadPowerW.toFixed(1)} W</span><span>DRY MASS {spacecraftDryMassKg.toFixed(1)} kg</span></div>
          </div>
          <div className="earth3d-hud-card"><small>POSITION / WGS84</small><b>{Number(current?.lla?.lat || 0).toFixed(3)}°</b><b>{Number(current?.lla?.lon || 0).toFixed(3)}°</b><span>ALT {Number(current?.lla?.alt || 0).toFixed(1)} km</span></div>
          <div className="earth3d-hud-card"><small>FLIGHT STATE</small><span>t+ {Number(seconds || 0).toFixed(1)} s</span><span>V {speed.toFixed(3)} km/s</span><span>{dayNight.isDay ? 'DAY SIDE' : 'NIGHT SIDE'} · {dayNight.localSolar}</span></div>
          <div className="earth3d-hud-card"><small>PHYSICAL SCALE · REFERENCE VALUES</small><span>EARTH RADIUS 6,378.137 km (WGS-84 equatorial)</span><span>MOON RADIUS 1,737.4 km · 0.2727 R⊕</span><span>EARTH–MOON CENTRES 384,400 km · 60.3 R⊕ mean</span>{cameraMode === 'SYSTEM' && <span>SYSTEM DISPLAY: CENTRE SEPARATION COMPRESSED TO {(SYSTEM_DISPLAY_DISTANCE_RATIO * 100).toFixed(2)}% ({(1 / SYSTEM_DISPLAY_DISTANCE_RATIO).toFixed(1)}×) FOR VISIBILITY; BODY RADII RETAINED; NOT TO SCALE</span>}<span>SUN RADIUS 695,700 km · 109.2 R⊕</span><span>SUN DISTANCE 149.6 million km · 1 AU mean</span><span>SPACECRAFT SIZE IS EXAGGERATED FOR VISIBILITY</span><span>ORBIT {inclinationDeg.toFixed(2)}° inc · e {eccentricity.toFixed(4)}</span></div>
          <div className="earth3d-hud-card"><small>ORBITAL ELEMENTS</small><span>RAAN {raanDeg.toFixed(2)}°</span><span>ARG PERIAPSIS {argumentOfPerigeeDeg.toFixed(2)}°</span><span>TRUE ANOMALY {trueAnomalyDeg.toFixed(2)}°</span><span>PERIOD {periodMin.toFixed(2)} min</span><span>RANGE FROM EARTH CENTRE {(6378.137 + Number(current?.lla?.alt ?? altitudeKm)).toFixed(2)} km</span></div>
        </div>
        <div id="earth3d-right-hud" className="earth3d-right-hud" data-mobile-open={mobileHudOpen ? "true" : "false"} role="complementary" aria-label="Simulation controls and live telemetry">
          <SimulationControls
            running={running}
            setRunning={setRunning}
            playback={playback}
            setPlayback={setPlayback}
            simulationTimeRef={simulationTimeRef}
            secondsRef={secondsRef}
          />
          <div className="earth3d-hud-card earth3d-telemetry-card" aria-label="Live telemetry">
            <small>LIVE TELEMETRY</small>
            <div className="earth3d-telemetry-row"><span>TIME</span><b>{Number(seconds || 0).toFixed(1)} s</b></div>
            <div className="earth3d-telemetry-row"><span>ALTITUDE</span><b>{Number(current?.lla?.alt ?? altitudeKm).toFixed(2)} km</b></div>
            <div className="earth3d-telemetry-row"><span>LATITUDE</span><b>{Number(current?.lla?.lat ?? 0).toFixed(3)}°</b></div>
            <div className="earth3d-telemetry-row"><span>LONGITUDE</span><b>{Number(current?.lla?.lon ?? 0).toFixed(3)}°</b></div>
            <div className="earth3d-telemetry-row"><span>SPEED</span><b>{speed.toFixed(4)} km/s</b></div>
            <div className="earth3d-telemetry-row"><span>ECI X / Y / Z</span><b>{(current?.r || [0, 0, 0]).map((value:number) => Number(value).toFixed(1)).join(' / ')} km</b></div>
            <div className="earth3d-telemetry-row"><span>VX / VY / VZ</span><b>{(current?.v || [0, 0, 0]).map((value:number) => Number(value).toFixed(4)).join(' / ')} km/s</b></div>
            <div className="earth3d-model-box"><small>MODEL FIDELITY</small><b>{propagator === 'SGP4' ? 'SGP4 / TLE' : 'Two-body Keplerian'}</b><span>{propagator === 'SGP4' ? 'Element-set propagation; accuracy depends on TLE age and source.' : 'Transparent analytical model. No J2, drag, SRP or third-body gravity.'}</span></div>
          </div>
          <div className="earth3d-hud-card"><small>VISUAL LAYERS</small><label><input type="checkbox" checked={showFootprint} onChange={e => setShowFootprint(e.target.checked)} /> <span>Ground footprint</span></label><label><input type="checkbox" checked={showVectors} onChange={e => setShowVectors(e.target.checked)} /> <span>Velocity / nadir vectors</span></label><label><input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} /> <span>Reference grid</span></label><label><input type="checkbox" checked={showAxes} onChange={e => setShowAxes(e.target.checked)} /> <span>ECI axes</span></label></div>
          <div className="earth3d-hud-card"><small>EARTH–MOON SYSTEM</small>{cameraMode === 'SYSTEM' && <span className="earth3d-scale-warning">SCHEMATIC VIEW · 44.4× DISTANCE COMPRESSION</span>}<label><input type="checkbox" checked={showSpaceEnvironment} onChange={e => setShowSpaceEnvironment(e.target.checked)} /> <span>Show Moon and lunar orbit</span></label><div className="earth3d-planet-select"><span>SPACECRAFT MODEL</span><select aria-label="Choose spacecraft model" value={selectedSatellite} onChange={e => setSelectedSatellite(e.target.value)}><option value="design">Current mission design</option><option value="cubesat1u">CubeSat 1U · 10 cm</option><option value="cubesat3u">CubeSat 3U · 34 cm</option><option value="cubesat6u">CubeSat 6U</option><option value="microsat">Microsatellite · reference</option><option value="iss">ISS · reference silhouette</option></select></div><span>Model choice changes the 3D silhouette only; orbit and telemetry remain the selected mission state.</span></div>
          <div className="earth3d-hud-card"><small>SOLAR GEOMETRY</small><span>SUBSOLAR {dayNight.subsolarLat.toFixed(1)}°, {dayNight.subsolarLon.toFixed(1)}°</span><span>{dayNight.timeZone}</span></div>
        </div>
        <div className="earth3d-bottom-bar">
          <span><i className="legend-spacecraft" /> SPACECRAFT</span><span><i className="legend-orbit" /> ORBIT</span><span><i className="legend-footprint" /> FOOTPRINT · FOV GEOMETRY</span><span><i className="legend-vector" /> VECTORS</span>
          <span className="earth3d-help">DRAG TO ORBIT · WHEEL TO ZOOM · SYSTEM FRAMES EARTH + MOON · TRACK FOLLOWS SATELLITE</span>{cameraMode === "SYSTEM" && <span className="earth3d-scale-note" data-testid="earth3d-scale-note">SCHEMATIC SYSTEM · {(1 / SYSTEM_DISPLAY_DISTANCE_RATIO).toFixed(1)}× CENTRE-DISTANCE COMPRESSION · PHYSICAL RADII RETAINED · NOT TO SCALE</span>}
        </div>
        <div className="earth3d-timeline" role="region" aria-label="Mission timeline and scene gallery" data-testid="earth3d-timeline">
          <div className="earth3d-timeline-heading"><span>MISSION TIMELINE / SCENE GALLERY</span><b>T+ {Number(seconds || 0).toFixed(1)} s</b></div>
          <SceneGallery
            cameraMode={cameraMode}
            setCameraMode={setCameraMode}
            setShowSpaceEnvironment={setShowSpaceEnvironment}
          />
          <input className="earth3d-time-range" aria-label="Simulation timeline" type="range" min={0} max={Math.max(1, duration)} step={0.1} value={Math.max(0, Math.min(duration, seconds))} onChange={event => setSeconds(Number(event.currentTarget.value))} />
          <div className="earth3d-timeline-actions">
            <button type="button" aria-label="Rewind simulation by 10 seconds" onClick={() => setSeconds(Math.max(0, seconds - 10))}>−10 s</button>
            <button type="button" aria-label="Advance simulation by 10 seconds" onClick={() => setSeconds(Math.min(duration, seconds + 10))}>+10 s</button>
            <button type="button" aria-label="Reset simulation time" onClick={() => { setSeconds(0); setRunning(false); }}>RESET TIME</button>
            <span>PERIOD {periodMin.toFixed(1)} min</span>
          </div>
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