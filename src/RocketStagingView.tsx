import { useMemo, useState } from 'react';
import { Activity, ArrowRight, BookOpen, CheckCircle2, FlaskConical, Rocket, SlidersHorizontal } from 'lucide-react';
import { optimiseRocketStaging, type RocketStagingInputs } from './aerospace/rocketStaging';

const defaults: RocketStagingInputs = {
  totalInitialMassKg: 100000,
  payloadMassKg: 5000,
  stage1SpecificImpulseS: 280,
  stage2SpecificImpulseS: 340,
  stage1StructuralFraction: 0.08,
  stage2StructuralFraction: 0.10
};

const upcoming = [
  { number: '02', name: 'Rocket ascent trajectory', discipline: 'Launch vehicle flight mechanics', status: 'NEXT' },
  { number: '03', name: 'Satellite orbital transfer', discipline: 'Astrodynamics and manoeuvre design', status: 'PLANNED' },
  { number: '04', name: 'Atmospheric re-entry', discipline: 'Entry dynamics and deceleration', status: 'PLANNED' },
  { number: '05', name: 'Rocket engine nozzle', discipline: 'Compressible flow and propulsion', status: 'PLANNED' },
  { number: '06', name: 'UAV conceptual sizing', discipline: 'Aircraft design and mass estimation', status: 'PLANNED' },
  { number: '07', name: 'Aircraft autopilot', discipline: 'Flight dynamics and control', status: 'PLANNED' }
];

function format(value: number, digits = 0) {
  return value.toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function NumberField({ label, unit, value, min, max, step, onChange }: {
  label: string; unit: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void;
}) {
  return <label className="aero-field">
    <span>{label}<small>{unit}</small></span>
    <input type="number" value={value} min={min} max={max} step={step}
      onChange={event => onChange(Number(event.target.value))} />
  </label>;
}

export default function RocketStagingView() {
  const [inputs, setInputs] = useState(defaults);
  const [showTheory, setShowTheory] = useState(true);
  const result = useMemo(() => {
    try {
      return { value: optimiseRocketStaging(inputs), error: '' };
    } catch (error) {
      return { value: null, error: error instanceof Error ? error.message : 'Unable to calculate this design.' };
    }
  }, [inputs]);

  const update = (key: keyof RocketStagingInputs, value: number) =>
    setInputs(current => ({ ...current, [key]: value }));

  const points = result.value?.points ?? [];
  const max = points.length ? Math.max(...points.map(point => point.totalDeltaVMs)) : 1;
  const min = points.length ? Math.min(...points.map(point => point.totalDeltaVMs)) : 0;
  const chartPath = points.map((point, index) => {
    const x = 18 + index / Math.max(1, points.length - 1) * 564;
    const y = 150 - ((point.totalDeltaVMs - min) / Math.max(1, max - min)) * 112;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
  const optimum = result.value?.optimum;

  return <div className="page aerospace-page">
    <header className="page-header aero-page-header">
      <div>
        <small>ARYAKSHA / ENGINEERING / LAUNCH VEHICLES</small>
        <h1>Aerospace Engineering Suite</h1>
        <p>Interactive engineering studies for launch vehicles, spacecraft and aircraft. Configure a model, run the calculation and inspect its assumptions.</p>
      </div>
      <div className="aero-engine-status"><span /> LOCAL ANALYTICAL ENGINE</div>
    </header>

    <section className="aero-project-intro">
      <div className="aero-intro-icon"><Rocket size={24} /></div>
      <div><small>PROJECT 01 · LAUNCH VEHICLE ENGINEERING</small><h2>Rocket staging optimisation</h2>
        <p>Find the two-stage propellant split that maximises ideal velocity increment for a fixed initial mass and payload.</p></div>
      <div className="aero-project-chip"><CheckCircle2 size={14}/> WORKING MODULE</div>
    </section>

    <div className="aero-workspace">
      <section className="card aero-input-card">
        <div className="card-head"><span><SlidersHorizontal size={17}/></span><b>Vehicle design inputs</b></div>
        <div className="aero-field-grid">
          <NumberField label="Initial vehicle mass" unit="kg" value={inputs.totalInitialMassKg} min={1000} max={10000000} step={1000} onChange={v=>update('totalInitialMassKg',v)}/>
          <NumberField label="Payload mass" unit="kg" value={inputs.payloadMassKg} min={1} max={9999999} step={100} onChange={v=>update('payloadMassKg',v)}/>
          <NumberField label="Stage 1 specific impulse" unit="s" value={inputs.stage1SpecificImpulseS} min={1} max={600} step={1} onChange={v=>update('stage1SpecificImpulseS',v)}/>
          <NumberField label="Stage 2 specific impulse" unit="s" value={inputs.stage2SpecificImpulseS} min={1} max={600} step={1} onChange={v=>update('stage2SpecificImpulseS',v)}/>
          <NumberField label="Stage 1 structural fraction" unit="0–0.49" value={inputs.stage1StructuralFraction} min={0} max={0.49} step={0.01} onChange={v=>update('stage1StructuralFraction',v)}/>
          <NumberField label="Stage 2 structural fraction" unit="0–0.49" value={inputs.stage2StructuralFraction} min={0} max={0.49} step={0.01} onChange={v=>update('stage2StructuralFraction',v)}/>
        </div>
        <button type="button" className="aero-reset-button" onClick={()=>setInputs(defaults)}>Reset reference vehicle</button>
        <div className="aero-note"><FlaskConical size={15}/><span>Change any input to recalculate all 91 candidate stage splits immediately.</span></div>
      </section>

      <section className="card aero-result-card">
        <div className="card-head"><span><Activity size={17}/></span><b>Optimisation result</b></div>
        {result.error ? <div className="aero-error" role="alert">{result.error}</div> : optimum && <>
          <small className="aero-result-label">MAXIMUM IDEAL VELOCITY INCREMENT</small>
          <div className="aero-big-result">{format(optimum.totalDeltaVMs / 1000, 3)} <span>km/s</span></div>
          <div className="aero-result-grid">
            <div><small>Stage 1 propellant</small><b>{format(optimum.stage1PropellantFraction * 100, 1)}%</b></div>
            <div><small>Stage 2 propellant</small><b>{format((1 - optimum.stage1PropellantFraction) * 100, 1)}%</b></div>
            <div><small>Stage 1 Δv</small><b>{format(optimum.stage1DeltaVMs / 1000, 3)} km/s</b></div>
            <div><small>Stage 2 Δv</small><b>{format(optimum.stage2DeltaVMs / 1000, 3)} km/s</b></div>
          </div>
          <div className="aero-mass-breakdown">
            <div><span>Stage 1 propellant</span><b>{format(optimum.stage1PropellantKg)} kg</b></div>
            <div><span>Stage 1 inert mass</span><b>{format(optimum.stage1DryMassKg)} kg</b></div>
            <div><span>Stage 2 propellant</span><b>{format(optimum.stage2PropellantKg)} kg</b></div>
            <div><span>Stage 2 inert mass</span><b>{format(optimum.stage2DryMassKg)} kg</b></div>
            <div><span>Payload</span><b>{format(inputs.payloadMassKg)} kg</b></div>
          </div>
        </>}
      </section>
    </div>

    <section className="card aero-chart-card">
      <div className="card-head"><span><Activity size={17}/></span><b>Stage split sensitivity</b><small>91 candidate configurations · 5% to 95%</small></div>
      {optimum && <div className="aero-chart-wrap">
        <svg viewBox="0 0 600 180" role="img" aria-label="Ideal velocity increment versus stage one propellant fraction">
          {[38, 94, 150].map(y=><line key={y} x1="18" x2="582" y1={y} y2={y} stroke="rgba(255,255,255,.10)" strokeDasharray="4 5"/>)}
          <path d={chartPath} fill="none" stroke="#51ddff" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
          <line x1={18 + (optimum.stage1PropellantFraction * 100 - 5) / 90 * 564} x2={18 + (optimum.stage1PropellantFraction * 100 - 5) / 90 * 564} y1="22" y2="150" stroke="#42df82" strokeDasharray="4 4"/>
          <circle cx={18 + (optimum.stage1PropellantFraction * 100 - 5) / 90 * 564} cy={150 - ((optimum.totalDeltaVMs - min) / Math.max(1, max - min)) * 112} r="5" fill="#42df82" stroke="#071019" strokeWidth="2"/>
          <text x="18" y="171" fill="#8d9aa7" fontSize="9">5%</text><text x="582" y="171" fill="#8d9aa7" fontSize="9" textAnchor="end">95%</text>
        </svg>
        <div className="aero-chart-legend"><span><i/> Total ideal Δv</span><span><i/> Best split: {format(optimum.stage1PropellantFraction * 100, 1)}%</span></div>
      </div>}
    </section>

    <section className="card aero-theory-card">
      <button className="aero-theory-toggle" type="button" onClick={()=>setShowTheory(value=>!value)}>
        <span><BookOpen size={17}/> Engineering model & assumptions</span><span>{showTheory ? 'HIDE' : 'SHOW'}</span>
      </button>
      {showTheory && <div className="aero-theory-content">
        <p>The ideal rocket equation is applied separately to each stage. The first-stage inert mass is discarded before the second-stage burn.</p>
        <div className="aero-equation">Δv = I<sub>sp</sub> g₀ ln(m₀ / m<sub>f</sub>)</div>
        <ul>
          <li>Initial vehicle mass and payload mass are fixed.</li>
          <li>Structural fraction means inert mass divided by stage wet mass (propellant + inert mass).</li>
          <li>Propellant is divided between stages; the total mass constraint determines the total propellant load.</li>
          <li>Stage burns are idealised instantaneous mass-depletion calculations using constant specific impulse.</li>
          <li>Gravity, atmospheric drag, steering, finite-burn losses, engine dry-mass variation and separation losses are excluded.</li>
        </ul>
        <div className="aero-caution">This is an ideal staging trade study, not a launch trajectory prediction or flight-certified vehicle design.</div>
      </div>}
    </section>

    <section className="aero-roadmap-section">
      <div className="aero-section-heading"><div><small>ENGINEERING ROADMAP</small><h2>Six more studies in the suite</h2></div><span>01 / 07 ACTIVE</span></div>
      <div className="aero-roadmap-grid">
        {upcoming.map(project=><article className="aero-roadmap-card" key={project.number}>
          <small>PROJECT {project.number}</small><h3>{project.name}</h3><p>{project.discipline}</p><span>{project.status}</span>
        </article>)}
      </div>
    </section>
  </div>;
}
