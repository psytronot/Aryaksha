import { useMemo, useState } from 'react';
import { Activity, ArrowDownUp, BookOpen, Download, Orbit, Satellite, SlidersHorizontal, TriangleAlert } from 'lucide-react';
import { calculateOrbitalTransfer, type OrbitalTransferInputs } from './aerospace/orbitalTransfer';

const defaults: OrbitalTransferInputs = {
  initialAltitudeKm: 400, targetAltitudeKm: 800, inclinationChangeDeg: 0,
  spacecraftMassKg: 500, engineIspS: 320
};
const fmt = (n: number, digits = 2) => n.toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: digits });
type Tab = 'overview' | 'configure' | 'results' | 'method';

export default function OrbitalTransferView() {
  const [inputs, setInputs] = useState(defaults);
  const [tab, setTab] = useState<Tab>('overview');
  const solution = useMemo(() => {
    try { return { result: calculateOrbitalTransfer(inputs), error: '' }; }
    catch (error) { return { result: null, error: error instanceof Error ? error.message : 'Invalid orbital inputs.' }; }
  }, [inputs]);
  const update = (key: keyof OrbitalTransferInputs, value: string) =>
    setInputs(current => ({ ...current, [key]: Number(value) }));
  const fields: { key: keyof OrbitalTransferInputs; label: string; unit: string; step: number }[] = [
    { key: 'initialAltitudeKm', label: 'Initial orbit altitude', unit: 'km', step: 10 },
    { key: 'targetAltitudeKm', label: 'Target orbit altitude', unit: 'km', step: 10 },
    { key: 'inclinationChangeDeg', label: 'Inclination change', unit: 'deg', step: 0.1 },
    { key: 'spacecraftMassKg', label: 'Spacecraft mass', unit: 'kg', step: 1 },
    { key: 'engineIspS', label: 'Engine specific impulse', unit: 's', step: 1 }
  ];
  const exportCsv = () => {
    if (!solution.result) return;
    const rows = [['Parameter','Value','Unit'],['Departure delta-v',String(solution.result.departureDeltaVMs),'m/s'],['Arrival delta-v',String(solution.result.arrivalDeltaVMs),'m/s'],['Total delta-v',String(solution.result.totalDeltaVMs),'m/s'],['Transfer time',String(solution.result.transferTimeMinutes),'min'],['Propellant estimate',String(solution.result.propellantMassKg),'kg']];
    const blob = new Blob([rows.map(row => row.join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'aryaksha-orbital-transfer.csv'; a.click(); URL.revokeObjectURL(url);
  };
  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' }, { id: 'configure', label: 'Mission setup' },
    { id: 'results', label: 'Transfer analysis' }, { id: 'method', label: 'Methodology' }
  ];
  return <div className="page aerospace-page orbital-transfer-page">
    <header className="page-header aero-page-header"><div><small>ARYAKSHA / PROJECT 03 / ASTRODYNAMICS</small><h1>Satellite orbital transfer designer</h1><p>Plan a two-impulse transfer between circular Earth orbits and inspect the delta-v, transfer time and propellant implications.</p></div><div className="aero-engine-status"><span/> ANALYTICAL ORBITAL ENGINE</div></header>
    <section className="aero-project-intro"><div className="aero-intro-icon"><Orbit size={24}/></div><div><small>PROJECT 03 · MISSION DESIGN</small><h2>Hohmann transfer & combined plane change</h2><p>Set a starting orbit and target orbit, then evaluate the ideal impulsive manoeuvre sequence.</p></div><div className="aero-project-chip"><Activity size={14}/> LIVE SOLUTION</div></section>
    <nav className="aero-tabs" aria-label="Orbital transfer sections">{tabs.map(item=><button key={item.id} className={tab===item.id?'active':''} onClick={()=>setTab(item.id)}>{item.label}</button>)}</nav>
    {tab==='overview' && <div className="aero-overview-grid">
      <section className="card"><div className="card-head"><span><Satellite size={17}/></span><b>What this tool is for</b></div><p className="aero-body-copy">Use this workspace when you need to estimate the manoeuvre budget for moving a spacecraft from one circular Earth orbit to another. It is useful for early mission sizing, comparing altitude changes and understanding the cost of inclination changes.</p><div className="aero-usecase-list"><div><b>Mission designers</b><span>Estimate orbit-raising or orbit-lowering delta-v and transfer duration.</span></div><div><b>Spacecraft engineers</b><span>Translate delta-v into a first-order propellant estimate using engine Isp and spacecraft mass.</span></div><div><b>Students and educators</b><span>Explore vis-viva, circular velocity and the Hohmann transfer ellipse.</span></div></div></section>
      <section className="card"><div className="card-head"><span><ArrowDownUp size={17}/></span><b>Reference mission</b></div><div className="aero-transfer-visual"><div><small>INITIAL ORBIT</small><b>{fmt(inputs.initialAltitudeKm,0)} km</b></div><div className="aero-transfer-arrow">→</div><div><small>TARGET ORBIT</small><b>{fmt(inputs.targetAltitudeKm,0)} km</b></div></div><p className="aero-body-copy">The current reference case uses a 400 km to 800 km altitude transfer, a 500 kg spacecraft and a 320 s engine specific impulse.</p><button className="aero-primary-button" onClick={()=>setTab('configure')}>Configure mission <span>→</span></button></section>
      <section className="card aero-full-card"><div className="card-head"><span><BookOpen size={17}/></span><b>Choose this tool when…</b></div><div className="aero-need-grid"><div><b>Orbit raising</b><span>Move from a lower circular orbit to a higher circular orbit.</span></div><div><b>Orbit lowering</b><span>Estimate the ideal transfer to a lower circular orbit.</span></div><div><b>Plane adjustment</b><span>Estimate an idealised inclination change at arrival.</span></div><div><b>Propellant budgeting</b><span>Convert total ideal delta-v into an approximate propellant mass.</span></div></div></section>
    </div>}
    {tab==='configure' && <section className="card"><div className="card-head"><span><SlidersHorizontal size={17}/></span><b>Mission and propulsion inputs</b></div><div className="aero-field-grid">{fields.map(field=><label className="aero-field" key={field.key}><span>{field.label}<small>{field.unit}</small></span><input aria-label={field.label} type="number" step={field.step} min="0" value={inputs[field.key]} onChange={event=>update(field.key,event.target.value)}/></label>)}</div><div className="aero-action-row"><button className="aero-reset-button" onClick={()=>setInputs(defaults)}>Reset reference mission</button><button className="aero-primary-button" onClick={()=>setTab('results')}>Calculate transfer <span>→</span></button></div><p className="aero-note"><TriangleAlert size={14}/> Valid for idealised circular Earth orbits and impulsive burns. Use a higher-fidelity propagator for operational mission design.</p></section>}
    {tab==='results' && <>{solution.error?<section className="card aero-error" role="alert">{solution.error}</section>:solution.result&&<><div className="aero-result-grid aero-transfer-kpis"><div><small>TOTAL DELTA-V</small><b>{fmt(solution.result.totalDeltaVMs)} m/s</b></div><div><small>TRANSFER TIME</small><b>{fmt(solution.result.transferTimeMinutes)} min</b></div><div><small>PROPELLANT ESTIMATE</small><b>{fmt(solution.result.propellantMassKg)} kg</b></div><div><small>POST-MANOEUVRE MASS</small><b>{fmt(solution.result.massAfterBurnsKg)} kg</b></div></div><section className="card"><div className="card-head"><span><Orbit size={17}/></span><b>Manoeuvre breakdown</b></div><div className="aero-result-grid"><div><small>DEPARTURE BURN</small><b>{fmt(solution.result.departureDeltaVMs)} m/s</b></div><div><small>ARRIVAL / PLANE CHANGE BURN</small><b>{fmt(solution.result.arrivalDeltaVMs)} m/s</b></div><div><small>TRANSFER ELLIPSE SEMI-MAJOR AXIS</small><b>{fmt(solution.result.transferSemiMajorAxisKm)} km</b></div><div><small>INITIAL ORBIT PERIOD</small><b>{fmt(solution.result.initialPeriodMinutes)} min</b></div><div><small>TARGET ORBIT PERIOD</small><b>{fmt(solution.result.targetPeriodMinutes)} min</b></div><div><small>INCLINATION CHANGE</small><b>{fmt(inputs.inclinationChangeDeg,2)}°</b></div></div><div className="aero-action-row"><button className="aero-primary-button" onClick={exportCsv}><Download size={14}/> Export CSV</button><button className="aero-reset-button" onClick={()=>setTab('configure')}>Edit inputs</button></div></section></>}</>}
    {tab==='method' && <section className="card aero-theory-content"><div className="card-head"><span><BookOpen size={17}/></span><b>Equations, assumptions & limits</b></div><div className="aero-equation">aₜ = (r₁ + r₂) / 2</div><p>Transfer time is half the period of the transfer ellipse. Circular velocity and transfer-ellipse velocity are evaluated using the vis-viva equation.</p><div className="aero-equation">v = √(μ(2/r − 1/a))</div><p>Departure delta-v is the difference between initial circular speed and transfer perigee speed. Arrival delta-v is calculated as a vector velocity change that combines circularisation and the specified plane change at the target orbit.</p><div className="aero-equation">mₚ = m₀ [1 − exp(−Δv / (Isp · g₀))]</div><ul><li>Earth is modelled as a point mass with a fixed gravitational parameter.</li><li>Both initial and target orbits are circular before and after the manoeuvre.</li><li>Two ideal instantaneous impulses are assumed; plane change is combined with the arrival burn.</li><li>No atmospheric drag, Earth oblateness, third-body effects, finite burn duration, thrust constraints, eclipses or navigation errors.</li><li>Propellant estimate assumes one effective engine Isp across the total manoeuvre.</li></ul><div className="aero-caution">Preliminary educational analysis only. Not suitable for flight operations, mission assurance or certified propellant loading.</div></section>}
  </div>;
}
