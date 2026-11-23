import { useMemo, useState } from 'react';
import { Activity, Gauge, Rocket, TriangleAlert } from 'lucide-react';
import {
  calculateRocketAscent,
  type RocketAscentInputs
} from './aerospace/rocketAscent';

const defaults: RocketAscentInputs = {
  initialMassKg: 30000,
  dryMassKg: 5000,
  thrustN: 650000,
  specificImpulseS: 285,
  referenceAreaM2: 10,
  dragCoefficient: 0.35,
  pitchStartTimeS: 10,
  pitchEndTimeS: 90,
  pitchStartAngleDeg: 90,
  pitchEndAngleDeg: 5,
  timeStepS: 0.5,
  maxFlightTimeS: 600
};

const fields: { key: keyof RocketAscentInputs; label: string; unit: string; step?: number }[] = [
  { key: 'initialMassKg', label: 'Initial mass', unit: 'kg' },
  { key: 'dryMassKg', label: 'Dry mass', unit: 'kg' },
  { key: 'thrustN', label: 'Engine thrust', unit: 'N' },
  { key: 'specificImpulseS', label: 'Specific impulse', unit: 's' },
  { key: 'referenceAreaM2', label: 'Reference area', unit: 'm²', step: 0.1 },
  { key: 'dragCoefficient', label: 'Drag coefficient', unit: '—', step: 0.01 },
  { key: 'pitchStartTimeS', label: 'Pitch start time', unit: 's', step: 0.5 },
  { key: 'pitchEndTimeS', label: 'Pitch end time', unit: 's', step: 0.5 },
  { key: 'pitchStartAngleDeg', label: 'Initial pitch angle', unit: 'deg', step: 1 },
  { key: 'pitchEndAngleDeg', label: 'Final pitch angle', unit: 'deg', step: 1 },
  { key: 'timeStepS', label: 'Integration step', unit: 's', step: 0.1 },
  { key: 'maxFlightTimeS', label: 'Maximum flight time', unit: 's', step: 1 }
];

const fmt = (value: number, digits = 1) => Number.isFinite(value)
  ? value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits })
  : '—';

export default function RocketAscentView() {
  const [inputs, setInputs] = useState<RocketAscentInputs>(defaults);
  const result = useMemo(() => {
    try {
      return { value: calculateRocketAscent(inputs), error: '' };
    } catch (error) {
      return { value: null, error: error instanceof Error ? error.message : 'Invalid model inputs.' };
    }
  }, [inputs]);

  const update = (key: keyof RocketAscentInputs, value: string) => {
    setInputs(current => ({ ...current, [key]: Number(value) }));
  };

  const trajectory = result.value?.samples ?? [];
  const maxX = Math.max(1, ...trajectory.map(point => point.downrangeM));
  const maxY = Math.max(1, ...trajectory.map(point => point.altitudeM));
  const path = trajectory.map((point, index) => {
    const x = 34 + point.downrangeM / maxX * 520;
    const y = 150 - point.altitudeM / maxY * 126;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');

  return (
    <div className="page aerospace-page rocket-ascent-page">
      <div className="page-header aero-page-header">
        <div>
          <div className="eyebrow">PROJECT 02 · FLIGHT DYNAMICS</div>
          <h1>Rocket ascent trajectory</h1>
          <p>Integrate a powered launch and ballistic coast through a simplified atmosphere.</p>
        </div>
        <div className="aero-engine-status"><span /> RK4 POINT-MASS MODEL</div>
      </div>

      <div className="aero-project-intro">
        <div className="aero-intro-icon"><Rocket size={23} /></div>
        <div>
          <small>ASCENT SIMULATION / 2D PLANAR</small>
          <h2>From engine thrust to flight path</h2>
          <p>Change vehicle mass, propulsion, aerodynamic properties and pitch schedule to see how the trajectory responds.</p>
        </div>
        <div className="aero-project-chip"><Activity size={13} /> LIVE CALCULATION</div>
      </div>

      <div className="aero-workspace">
        <section className="card">
          <div className="card-head"><span><Gauge size={17} /></span><b>Vehicle & guidance inputs</b></div>
          <div className="aero-field-grid">
            {fields.map(field => (
              <label className="aero-field" key={field.key}>
                <span>{field.label}<small>{field.unit}</small></span>
                <input
                  aria-label={field.label}
                  type="number"
                  min="0"
                  step={field.step ?? 'any'}
                  value={inputs[field.key]}
                  onChange={event => update(field.key, event.target.value)}
                />
              </label>
            ))}
          </div>
          <button className="aero-reset-button" type="button" onClick={() => setInputs(defaults)}>RESET REFERENCE CASE</button>
          <div className="aero-note"><TriangleAlert size={14} /> Pitch is measured from the local horizontal: 90° is vertical and 0° is horizontal.</div>
        </section>

        <section className="card">
          <div className="card-head"><span><Activity size={17} /></span><b>Trajectory solution</b></div>
          {result.error ? <div className="aero-error" role="alert">{result.error}</div> : result.value && (
            <>
              <div className="aero-result-label">MAXIMUM SIMULATED ALTITUDE</div>
              <div className="aero-big-result">{fmt(result.value.maxAltitudeM / 1000, 2)} <span>km</span></div>
              <div className="aero-result-grid">
                <div><small>BURNOUT SPEED</small><b>{result.value.burnoutSpeedMps === null ? 'Not reached' : `${fmt(result.value.burnoutSpeedMps / 1000, 3)} km/s`}</b></div>
                <div><small>BURNOUT TIME</small><b>{result.value.burnoutTimeS === null ? 'Not reached' : `${fmt(result.value.burnoutTimeS)} s`}</b></div>
                <div><small>MAXIMUM DYNAMIC PRESSURE</small><b>{fmt(result.value.maxDynamicPressurePa / 1000, 2)} kPa</b></div>
                <div><small>MAX-Q TIME</small><b>{fmt(result.value.maxDynamicPressureTimeS)} s</b></div>
                <div><small>FINAL DOWNRANGE</small><b>{fmt((trajectory.at(-1)?.downrangeM ?? 0) / 1000, 2)} km</b></div>
                <div><small>SIMULATION END</small><b>{result.value.terminationReason === 'impact' ? 'Impact' : 'Time limit'}</b></div>
              </div>
              <div className="aero-mass-breakdown">
                <div><span>Final vehicle mass</span><b>{fmt(trajectory.at(-1)?.massKg ?? inputs.initialMassKg, 1)} kg</b></div>
                <div><span>Final altitude</span><b>{fmt(result.value.finalAltitudeM / 1000, 2)} km</b></div>
                <div><span>Samples integrated</span><b>{trajectory.length.toLocaleString()}</b></div>
              </div>
            </>
          )}
        </section>
      </div>

      {result.value && (
        <>
          <section className="card aero-chart-card">
            <div className="card-head"><span><Activity size={17} /></span><b>Altitude vs downrange</b><small>SIMULATED FLIGHT PATH</small></div>
            <div className="aero-chart-wrap">
              <svg viewBox="0 0 580 174" role="img" aria-label="Rocket altitude versus downrange trajectory plot">
                <path d="M34 12 V150 H554" fill="none" stroke="currentColor" opacity=".35" />
                {[0, 1, 2, 3].map(tick => <line key={tick} x1="34" x2="554" y1={150 - tick * 42} y2={150 - tick * 42} stroke="currentColor" opacity=".1" />)}
                <path d={path} fill="none" stroke="#51ddff" strokeWidth="2.5" strokeLinejoin="round" />
                <text x="34" y="168" fill="currentColor" opacity=".6" fontSize="9">0 km downrange</text>
                <text x="554" y="168" textAnchor="end" fill="currentColor" opacity=".6" fontSize="9">{fmt(maxX / 1000, 1)} km</text>
                <text x="38" y="10" fill="currentColor" opacity=".6" fontSize="9">{fmt(maxY / 1000, 1)} km altitude</text>
              </svg>
            </div>
          </section>
          <section className="card aero-theory-card">
            <div className="card-head"><span><BookOpenIcon /></span><b>Model equations & assumptions</b></div>
            <div className="aero-theory-content">
              <div className="aero-equation">ṁ = −T / (Isp · g₀)</div>
              <p>Radial and tangential motion are integrated with fourth-order Runge–Kutta (RK4). Gravity follows a central inverse-square law; aerodynamic drag opposes the velocity vector.</p>
              <ul>
                <li>Exponential density: ρ = ρ₀ exp(−h / H), with ρ₀ = 1.225 kg/m³ and H = 8,500 m.</li>
                <li>Constant thrust and specific impulse until dry mass, followed by ballistic coast.</li>
                <li>Pitch changes linearly with time between the entered guidance start and end times.</li>
                <li>Downrange is Earth-radius times the integrated angular displacement.</li>
              </ul>
              <div className="aero-caution">Educational preliminary model only. It excludes Earth rotation, winds, variable atmosphere, changing mass properties, staging, throttle control, guidance feedback, engine transients and 3D steering. It is not a launch prediction or flight-certified analysis.</div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function BookOpenIcon() {
  return <span aria-hidden="true">▤</span>;
}
