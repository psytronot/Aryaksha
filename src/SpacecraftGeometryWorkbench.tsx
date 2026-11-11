import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Box, Download, FileUp, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { computeCompositeMassProperties } from './engineering/massProperties';
import { boundsToMetres, type GeometryUnit } from './engineering/geometry';
import './spacecraft-geometry.css';

type ComponentRow = { id: string; massKg: number; x: number; y: number; z: number; ixx: number; iyy: number; izz: number };
type LoadedModel = { object: THREE.Object3D; name: string; format: 'glb' | 'gltf' | 'obj' | 'stl'; bounds: { min: [number, number, number]; max: [number, number, number] } };

const initialComponents: ComponentRow[] = [
  { id: 'bus', massKg: 8, x: 0, y: 0, z: 0, ixx: 0.08, iyy: 0.09, izz: 0.1 }
];
const inputStyle: React.CSSProperties = { width: '100%', minWidth: 0, background: '#081525', border: '1px solid #28435f', color: '#e6f1ff', borderRadius: 7, padding: '8px 9px', fontSize: 12 };
const fieldLabel: React.CSSProperties = { display: 'block', color: '#91a9c4', fontSize: 9, letterSpacing: '.06em', marginBottom: 4 };

async function parseModel(file: File): Promise<LoadedModel> {
  if (file.size === 0 || file.size > 50 * 1024 * 1024) throw new Error('Choose a non-empty model file smaller than 50 MB.');
  const extension = file.name.split('.').pop()?.toLowerCase();
  let object: THREE.Object3D;
  let format: LoadedModel['format'];
  if (extension === 'glb' || extension === 'gltf') {
    const loader = new GLTFLoader();
    const data = await file.arrayBuffer();
    const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => loader.parse(data, '', resolve, reject));
    object = gltf.scene;
    format = extension;
  } else if (extension === 'obj') {
    object = new OBJLoader().parse(await file.text());
    format = 'obj';
  } else if (extension === 'stl') {
    const geometry = new STLLoader().parse(await file.arrayBuffer());
    geometry.computeVertexNormals();
    object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x79c8dc, metalness: 0.45, roughness: 0.48 }));
    format = 'stl';
  } else {
    throw new Error('Supported formats: GLB, self-contained glTF, OBJ and STL. Export STEP from CAD to one of these formats first.');
  }
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) throw new Error('The imported file contains no renderable mesh geometry.');
  const min = box.min.toArray() as [number, number, number];
  const max = box.max.toArray() as [number, number, number];
  return { object, name: file.name, format, bounds: { min, max } };
}

function disposeObject(root: THREE.Object3D) {
  root.traverse(node => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach(material => material?.dispose());
  });
}

export default function SpacecraftGeometryWorkbench({ busDimensionsM, dryMassKg }: { busDimensionsM: { width: number; height: number; depth: number }; dryMassKg: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const [model, setModel] = useState<LoadedModel | null>(null);
  const [unit, setUnit] = useState<GeometryUnit | 'unknown'>('unknown');
  const [components, setComponents] = useState<ComponentRow[]>(() => initialComponents.map(row => ({ ...row, massKg: dryMassKg })));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#07111d');
    scene.add(new THREE.HemisphereLight(0xc7eaff, 0x182333, 2));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(5, 8, 6);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x54bde8, 1.1);
    fill.position.set(-5, 2, -4);
    scene.add(fill);
    const grid = new THREE.GridHelper(8, 16, 0x31516a, 0x203548);
    grid.position.y = -2.15;
    scene.add(grid);
    scene.add(new THREE.AxesHelper(1.4));
    const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 1000);
    camera.position.set(5, 3.6, 6);
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false }); }
    catch { setPreviewError('WebGL is unavailable in this browser. Geometry import and mass calculations remain available.'); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);
    sceneRef.current = scene;
    cameraRef.current = camera;
    controlsRef.current = controls;
    const resize = () => {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    let frame = 0;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      if (modelRef.current) disposeObject(modelRef.current);
      scene.clear();
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
    };
  }, []);

  useEffect(() => {
    setComponents(rows => rows.length === 1 && rows[0].id === 'bus' ? [{ ...rows[0], massKg: dryMassKg }] : rows);
  }, [dryMassKg]);

  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!scene || !camera || !controls) return;
    if (modelRef.current) {
      scene.remove(modelRef.current);
      disposeObject(modelRef.current);
      modelRef.current = null;
    }
    if (!model) return;
    const box = new THREE.Box3().setFromObject(model.object);
    const centre = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const extent = Math.max(size.x, size.y, size.z);
    model.object.position.sub(centre);
    model.object.scale.multiplyScalar(4 / extent);
    scene.add(model.object);
    modelRef.current = model.object;
    camera.position.set(5, 3.6, 6);
    controls.target.set(0, 0, 0);
    controls.update();
  }, [model]);

  const dimensions = useMemo(() => {
    if (!model || unit === 'unknown') return null;
    return boundsToMetres(model.bounds, unit);
  }, [model, unit]);

  const massProperties = useMemo(() => {
    try {
      return computeCompositeMassProperties(components.map(component => ({
        id: component.id,
        massKg: component.massKg,
        positionM: [component.x, component.y, component.z],
        inertiaKgM2: [[component.ixx, 0, 0], [0, component.iyy, 0], [0, 0, component.izz]]
      })));
    } catch (cause) {
      return { error: cause instanceof Error ? cause.message : 'Invalid mass properties.' };
    }
  }, [components]);

  const updateComponent = (id: string, patch: Partial<ComponentRow>) => {
    setComponents(rows => rows.map(row => row.id === id ? { ...row, ...patch } : row));
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const loaded = await parseModel(file);
      setModel(loaded);
      setUnit(loaded.format === 'glb' || loaded.format === 'gltf' ? 'm' : 'unknown');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to import this geometry.');
    } finally {
      setLoading(false);
    }
  };

  const exportConfiguration = () => {
    if (!massProperties || 'error' in massProperties) return;
    const config = {
      schemaVersion: '1.0.0',
      configurationId: `aryaksha-${Date.now()}`,
      name: model?.name.replace(/\.[^.]+$/, '') || 'Untitled spacecraft',
      units: { length: 'm', mass: 'kg', angle: 'deg' },
      referenceFrame: 'Spacecraft body frame: +X forward, +Y starboard, +Z nadir; confirm axis convention against the source CAD model.',
      geometry: {
        bus: { width: busDimensionsM.width, height: busDimensionsM.height, depth: busDimensionsM.depth },
        ...(dimensions ? { boundingBox: { width: dimensions.width, height: dimensions.height, depth: dimensions.depth } } : {}),
        ...(model ? { modelFormat: model.format, geometrySource: model.name } : {})
      },
      massProperties: {
        dryMassKg: massProperties.totalMassKg,
        centreOfMassM: massProperties.centreOfMassM,
        inertiaKgM2: massProperties.inertiaKgM2
      },
      components: components.map(component => ({
        componentId: component.id, type: component.id === 'bus' ? 'bus' : 'other', name: component.id,
        massKg: component.massKg, positionM: [component.x, component.y, component.z],
        inertiaKgM2: [[component.ixx, 0, 0], [0, component.iyy, 0], [0, 0, component.izz]],
        source: 'user-entered mass and body-frame centre of mass'
      })),
      provenance: { author: 'User supplied configuration', createdAt: new Date().toISOString(), notes: 'Geometry bounds are not mass properties. Component intrinsic inertia is user-entered and assumed aligned with the spacecraft body axes.' }
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${config.name.replace(/[^A-Za-z0-9_-]+/g, '-')}-spacecraft-config.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return <section className="spacecraft-geometry-workbench">
    <div className="spacecraft-geometry-heading"><div><small>GEOMETRY + MASS PROPERTIES</small><h2>Spacecraft model workbench</h2><p>Import a mesh, inspect its dimensions and calculate a component-based mass model. Geometry alone never determines mass.</p></div><Box size={22} /></div>
    <div className="spacecraft-geometry-layout">
      <div className="spacecraft-geometry-preview">
        <canvas ref={canvasRef} aria-label="Interactive 3D spacecraft model preview" />
        {!model && <div className="spacecraft-geometry-empty"><Box size={30} /><b>3D model preview</b><span>Import a GLB, glTF, OBJ or STL model to begin</span></div>}
        {previewError && <div className="spacecraft-geometry-overlay" role="status">{previewError}</div>}
        {loading && <div className="spacecraft-geometry-overlay">Loading geometry…</div>}
      </div>
      <div className="spacecraft-geometry-controls">
        <label className="spacecraft-geometry-upload"><FileUp size={17} /><span>{model ? 'Replace model file' : 'Import 3D model'}</span><input type="file" accept=".glb,.gltf,.obj,.stl" onChange={event => void importFile(event.target.files?.[0])} /></label>
        <p className="spacecraft-geometry-hint">Maximum 50 MB. GLB is preferred. glTF files must contain embedded resources; OBJ/STL units are not standardised.</p>
        {error && <div className="spacecraft-geometry-error" role="alert">{error}</div>}
        {model && <>
          <div className="spacecraft-geometry-file"><b>{model.name}</b><span>{model.format.toUpperCase()} · local browser import</span></div>
          <label style={fieldLabel}>SOURCE MODEL UNITS</label>
          <select style={inputStyle} value={unit} onChange={event => setUnit(event.target.value as GeometryUnit | 'unknown')}>
            <option value="unknown">Unknown — do not report dimensions</option><option value="m">Metres</option><option value="cm">Centimetres</option><option value="mm">Millimetres</option><option value="in">Inches</option>
          </select>
          {dimensions ? <div className="spacecraft-geometry-dimensions">
            <div><small>WIDTH</small><b>{dimensions.width.toFixed(4)} m</b></div>
            <div><small>HEIGHT</small><b>{dimensions.height.toFixed(4)} m</b></div>
            <div><small>DEPTH</small><b>{dimensions.depth.toFixed(4)} m</b></div>
          </div> : <p className="spacecraft-geometry-hint">Select the correct source units to convert mesh bounds to SI metres. The preview is normalised for viewing only.</p>}
        </>}
        <div className="spacecraft-geometry-axis"><b>Preview controls</b><span>Drag to rotate · scroll to zoom · right-drag to pan</span><button type="button" onClick={() => { if (cameraRef.current && controlsRef.current) { cameraRef.current.position.set(5, 3.6, 6); controlsRef.current.target.set(0, 0, 0); controlsRef.current.update(); } }}><RotateCcw size={13} /> Reset view</button></div>
      </div>
    </div>
    <div className="spacecraft-mass-panel">
      <div className="spacecraft-mass-heading"><div><small>BODY-FRAME COMPONENT MODEL</small><h3>Mass properties calculator</h3><p>Enter each component's mass, centre of mass and intrinsic diagonal inertia in kg, m and kg·m².</p></div><button type="button" onClick={() => setComponents(rows => [...rows, { id: `component-${rows.length + 1}`, massKg: 1, x: 0, y: 0, z: 0, ixx: 0, iyy: 0, izz: 0 }])}><Plus size={14} /> Add component</button></div>
      <div className="spacecraft-component-list">
        {components.map(component => <div className="spacecraft-component-row" key={component.id}>
          <div className="spacecraft-component-title"><b>{component.id}</b><button type="button" aria-label={`Remove ${component.id}`} disabled={components.length === 1} onClick={() => setComponents(rows => rows.filter(row => row.id !== component.id))}><Trash2 size={14} /></button></div>
          {([
            ['MASS KG', 'massKg'], ['X M', 'x'], ['Y M', 'y'], ['Z M', 'z'], ['IXX KG·M²', 'ixx'], ['IYY KG·M²', 'iyy'], ['IZZ KG·M²', 'izz']
          ] as const).map(([label, key]) => <label key={key} style={fieldLabel}>{label}<input style={inputStyle} type="number" step="any" value={component[key]} onChange={event => updateComponent(component.id, { [key]: Number(event.target.value) })} /></label>)}
        </div>)}
      </div>
      {'error' in massProperties ? <div className="spacecraft-geometry-error" role="alert">{massProperties.error}</div> : <div className="spacecraft-mass-results">
        <div><small>TOTAL MASS</small><b>{massProperties.totalMassKg.toFixed(3)} kg</b></div>
        <div><small>CENTRE OF MASS (X, Y, Z)</small><b>{massProperties.centreOfMassM.map(value => value.toFixed(4)).join(', ')} m</b></div>
        <div><small>IXX / IYY / IZZ</small><b>{massProperties.inertiaKgM2[0][0].toFixed(4)} / {massProperties.inertiaKgM2[1][1].toFixed(4)} / {massProperties.inertiaKgM2[2][2].toFixed(4)} kg·m²</b></div>
        <button type="button" onClick={exportConfiguration}><Download size={14} /> Export spacecraft configuration</button>
      </div>}
      <p className="spacecraft-geometry-disclaimer">Engineering boundary: imported mesh bounds do not establish material density, hollow/solid volume or mass distribution. This calculator combines user-entered component mass properties using the parallel-axis theorem. Products of inertia are assumed zero; confirm component axes and CAD mass properties independently.</p>
    </div>
  </section>;
}
