import './aerospace.css';
import { useMemo, useState } from 'react';
import { Activity, BookOpen, Download, FlaskConical, Rocket, SlidersHorizontal } from 'lucide-react';
import type { RocketVehicleConfiguration } from './aerospace/rocketStagingModel';
import {
  optimiseMaximumDeltaV,
  optimiseMinimumPropellantForDeltaV,
  type RocketOptimisationResult
} from './aerospace/rocketStagingOptimiser';
import {
  runRocketStagingSensitivityStudy,
  type RocketSensitivityStudy
} from './aerospace/rocketStagingStudies';
import { buildRocketStagingMarkdownReport } from './aerospace/rocketStagingReport';

const initialStages = [
  { name: 'Stage 1', propellantMassKg: 65000, specificImpulseS: 280, structuralFraction: 0.08 },
  { name: 'Stage 2', propellantMassKg: 25000, specificImpulseS: 340, structuralFraction: 0.1 }
];

const fmt = (value: number, digits = 2) => Number.isFinite(value)
  ? value.toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: digits })
  : '—';

export default function RocketStagingView() {
  const [stageCount, setStageCount] = useState(2);
  const [payloadMassKg, setPayloadMassKg] = useState(5000);
  const [stages, setStages] = useState(initialStages);
  const [objective, setObjective] = useState<'maximum-delta-v' | 'minimum-propellant'>('maximum-delta-v');
  const [targetDeltaVMs, setTargetDeltaVMs] = useState(8500);
  const [maximumInitialMassKg, setMaximumInitialMassKg] = useState(120000);
  const [sensitivity, setSensitivity] = useState<RocketSensitivityStudy | null>(null);
  const [showMethod, setShowMethod] = useState(true);

  const configuration: RocketVehicleConfiguration = useMemo(() => ({
    payloadMassKg,
    stages: stages.map(stage => ({ ...stage }))
  }), [payloadMassKg, stages]);

  const calculation = useMemo(() => {
    try {
      const result = objective === 'maximum-delta-v'
        ? optimiseMaximumDeltaV(configuration)
        : optimiseMinimumPropellantForDeltaV(configuration, targetDeltaVMs, maximumInitialMassKg);
      return { result, error: '' };
    } catch (error) {
      return {
        result: null,
        error: error instanceof Error ? error.message : 'Unable to calculate this staging configuration.'
      };
    }
  }, [configuration, objective, targetDeltaVMs, maximumInitialMassKg]);

  const updateStage = (index: number, key: 'propellantMassKg' | 'specificImpulseS' | 'structuralFraction', value: number) => {
    setStages(current => current.map((stage, stageIndex) =>
      stageIndex === index ? { ...stage, [key]: value } : stage));
  };

  const changeStageCount = (count: number) => {
    setStageCount(count);
    setStages(current => Array.from({ length: count }, (_, index) => current[index] ?? {
      name: \`Stage \${index + 1}\`,
      propellantMassKg: Math.max(500, 18000 / (index + 1)),
      specificImpulseS: index === 0 ? 280 : 340,
      structuralFraction: index === 0 ? 0.08 : 0.1
    }));
    setSensitivity(null);
  };

  const runSensitivity = () => {
    try {
      setSensitivity(runRocketStagingSensitivityStudy(configuration, {
        kind: 'stage-isp', stageIndex: 0,
        minimum: Math.max(100, stages[0].specificImpulseS * 0.8),
        maximum: stages[0].specificImpulseS * 1.2
      }, 9));
    } catch {
      setSensitivity(null);
    }
  };

  const downloadReport = (result: RocketOptimisationResult) => {
    const markdown = buildRocketStagingMarkdownReport(result, configuration, sensitivity ? [sensitivity] : []);
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'aryaksha-rocket-staging-study.md';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const result = calculation.result;
  const success = result && result.status === 'converged';
  const chartMax = sensitivity
    ? Math.max(1, ...sensitivity.samples.map(sample => sample.achievedDeltaVMs ?? 0))
    : 1;

  return <div className="page aerospace-page aero-staging-workspace">
    <header className="page-header aero-page-header">
      <div>
        <small>ARYAKSHA / ENGINEERING / LAUNCH VEHICLES</small>
        <h1>Rocket staging optimiser</h1>
        <p>Explore two-to-four-stage mass allocation using a bounded ideal rocket-equation model.</p>
      </div>
      <div className="aero-engine-status"><span/> LOCAL ANALYTICAL ENGINE</div>
    </header>

    <section className="aero-project-intro">
      <div className="aero-intro-icon"><Rocket size={24}/></div>
      <div><small>LAUNCH VEHICLE ARCHITECTURE / PRELIMINARY TRADE STUDY</small>
        <h2>Configure the vehicle. Compare the staging trade.</h2>
        <p>Every stage exposes propellant, specific impulse and structural fraction. Solver status and mass accounting remain visible.</p>
      </div>
    </section>

    <div className="aero-staging-layout">
      <section className="card aero-input-card">
        <div className="card-head"><span><SlidersHorizontal size={17}/></span><b>Vehicle configuration</b></div>
        <label className="aero-field"><span>Number of stages<small>2–4</small></span>
          <select value={stageCount} onChange={event => changeStageCount(Number(event.target.value))}>
            {[2, 3, 4].map(count => <option key={count} value={count}>{count} stages</option>)}
          </select>
        </label>
        <label className="aero-field"><span>Payload mass<small>kg</small></span>
          <input type="number" min="1" value={payloadMassKg} onChange={event => setPayloadMassKg(Number(event.target.value))}/>
        </label>
        {stages.map((stage, index) => <fieldset className="aero-stage-fieldset" key={index}>
          <legend>STAGE {index + 1} / {index === 0 ? 'FIRST TO FIRE' : index === stageCount - 1 ? 'FINAL STAGE' : 'UPPER STAGE'}</legend>
          <label className="aero-field"><span>Propellant mass<small>kg · reference allocation</small></span>
            <input type="number" min="0.001" value={stage.propellantMassKg} onChange={event => updateStage(index, 'propellantMassKg', Number(event.target.value))}/>
          </label>
          <label className="aero-field"><span>Specific impulse<small>s</small></span>
            <input type="number" min="1" value={stage.specificImpulseS} onChange={event => updateStage(index, 'specificImpulseS', Number(event.target.value))}/>
          </label>
          <label className="aero-field"><span>Structural fraction<small>0 ≤ ε &lt; 0.5</small></span>
            <input type="number" min="0" max="0.499999" step="0.001" value={stage.structuralFraction} onChange={event => updateStage(index, 'structuralFraction', Number(event.target.value))}/>
          </label>
        </fieldset>)}
        <p className="aero-note"><FlaskConical size={15}/> Structural fraction is inert mass divided by stage wet mass (propellant + inert).</p>
      </section>

      <section className="card aero-result-card">
        <div className="card-head"><span><Activity size={17}/></span><b>Optimisation objective</b></div>
        <div className="aero-objective-switch">
          <button className={objective === 'maximum-delta-v' ? 'active' : ''} onClick={() => setObjective('maximum-delta-v')}>Maximise ideal Δv</button>
          <button className={objective === 'minimum-propellant' ? 'active' : ''} onClick={() => setObjective('minimum-propellant')}>Meet target Δv</button>
        </div>
        {objective === 'minimum-propellant' && <div className="aero-field-grid">
          <label className="aero-field"><span>Target ideal Δv<small>m/s</small></span>
            <input type="number" min="1" value={targetDeltaVMs} onChange={event => setTargetDeltaVMs(Number(event.target.value))}/>
          </label>
          <label className="aero-field"><span>Maximum initial wet mass<small>kg</small></span>
            <input type="number" min="1" value={maximumInitialMassKg} onChange={event => setMaximumInitialMassKg(Number(event.target.value))}/>
          </label>
        </div>}
        {calculation.error ? <div className="aero-error" role="alert">{calculation.error}</div> : result && <>
          <div className="aero-solver-status" role="status">
            <b>{result.status.toUpperCase().replaceAll('-', ' ')}</b>
            <span>{result.evaluations.toLocaleString('en-IN')} evaluations · {result.converged ? 'tolerance reached' : 'solution not confirmed converged'}</span>
          </div>
          <small className="aero-result-label">{objective === 'maximum-delta-v' ? 'BEST IDEAL VELOCITY INCREMENT FOUND' : 'PROPellant MASS FOR TARGET Δv'}</small>
          <div className="aero-big-result">{fmt(result.vehicle.totalDeltaVMs / 1000, 3)} <span>km/s</span></div>
          <div className="aero-result-grid">
            <div><small>Initial wet mass</small><b>{fmt(result.vehicle.initialMassKg)} kg</b></div>
            <div><small>Total propellant</small><b>{fmt(result.vehicle.totalPropellantMassKg)} kg</b></div>
            <div><small>Total inert mass</small><b>{fmt(result.vehicle.totalInertMassKg)} kg</b></div>
            <div><small>Mass closure error</small><b>{fmt(result.vehicle.massClosureErrorKg, 8)} kg</b></div>
          </div>
          <p className="aero-solver-reason">{result.terminationReason}</p>
          <div className="aero-stage-results">
            {result.vehicle.stages.map((stage, index) => <div key={index}>
              <b>STAGE {index + 1}</b>
              <span>{fmt(stage.deltaVMs)} m/s Δv</span>
              <small>Propellant {fmt(stage.propellantMassKg)} kg · inert {fmt(stage.inertMassKg)} kg</small>
              <small>Ignition {fmt(stage.ignitionMassKg)} kg · burnout {fmt(stage.burnoutMassKg)} kg · separation {fmt(stage.separationMassKg)} kg</small>
            </div>)}
          </div>
          <div className="aero-action-row">
            <button className="aero-primary-button" onClick={() => downloadReport(result)}><Download size={14}/> Export Markdown report</button>
            <button className="aero-primary-button" onClick={runSensitivity}>Run Stage 1 Isp sensitivity</button>
          </div>
        </>}
      </section>
    </div>

    {sensitivity && <section className="card aero-chart-card">
      <div className="card-head"><span><Activity size={17}/></span><b>Stage 1 specific impulse sensitivity</b><small>Sampled study · {sensitivity.samples.length} points</small></div>
      <div className="aero-sensitivity-table">
        {sensitivity.samples.map((sample, index) => <div key={index}>
          <span>{fmt(sample.inputValue, 1)} s</span>
          <div className="aero-sensitivity-track"><i style={{ width: sample.achievedDeltaVMs ? \`\${sample.achievedDeltaVMs / chartMax * 100}%\` : '0%' }}/></div>
          <b>{sample.achievedDeltaVMs === null ? sample.status : \`\${fmt(sample.achievedDeltaVMs / 1000, 3)} km/s\`}</b>
        </div>)}
      </div>
    </section>}

    <section className="card aero-theory-card">
      <button className="aero-theory-toggle" type="button" onClick={() => setShowMethod(value => !value)}>
        <span><BookOpen size={17}/> Numerical method, equations and assumptions</span><span>{showMethod ? 'HIDE' : 'SHOW'}</span>
      </button>
      {showMethod && <div className="aero-theory-content">
        <div className="aero-equation">Δvᵢ = Ispᵢ × g₀ × ln(mᵢ,ignition / mᵢ,burnout)</div>
        <p>Maximum ideal Δv holds initial wet mass and payload fixed while exploring propellant allocations. Target Δv mode searches allocations and bisects total propellant under the initial wet-mass ceiling.</p>
        <ul>
          <li>Stage inert mass remains attached during its burn and is jettisoned before the next stage ignition.</li>
          <li>Final-stage inert mass remains attached to the payload.</li>
          <li>Search is deterministic and bounded. The best candidate found is not a proof of global optimality.</li>
          <li>Target-mode search failure is reported as inconclusive unless infeasibility is established; sampled search does not prove continuous-domain infeasibility.</li>
          <li>Gravity, drag, steering, finite burns, residual propellant, engine transients, thrust-to-weight, timing and separation losses are excluded.</li>
        </ul>
        <div className="aero-caution">Educational and preliminary trade-study only. Not a trajectory prediction, launch vehicle qualification or flight-certified design.</div>
      </div>}
    </section>
  </div>;
}
