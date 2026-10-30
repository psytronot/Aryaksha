import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowRight, Battery, BookOpen, Calculator, Check, CircleHelp, Cpu, Download,
  Gauge, Globe2, Info, Layers3, Orbit, Play, Radio, RefreshCw, Rocket,
  Satellite, Search, Settings2, Target, Thermometer, TriangleAlert, Wrench, Zap
} from 'lucide-react';
const Earth3DScene = lazy(() => import('./Earth3DScene'));
import AryakshaMark from './AryakshaMark';
const ScientificCalculator = lazy(() => import('./ScientificCalculator'));
const SatelliteTrackingView = lazy(() => import('./SatelliteTrackingView'));
const MissionAnalysisView = lazy(() => import('./MissionAnalysisView'));
import { EARTH_RADIUS, orbitalSummary, propagateState, sampleOrbit, stateToLla } from './orbit';
import { getGlossaryEntries, getGlossaryEntry, GlossaryEntry } from './glossary';
import { generateContinuousGroundTrack, SubPoint } from './tracking';
import { computeDayNightBoundary, solarSubpoint } from './daynight';
import {
  Mission, Payload, Spacecraft, OrbitDesign, orbitFromAltitude, missionGeometry,
  propulsionAnalysis, maneuverDeltaV, adcsAnalysis, powerAnalysis, thermalAnalysis,
  communicationsAnalysis, systemVerification, formatNumber
} from './engineering';

const missionDefaults: Mission = {
  name: 'AgriWatch-01', type: 'Earth Observation', target: 'India',
  revisitDays: 2, lifetimeYears: 2, minElevationDeg: 10, maxMassKg: 50, launchSite: 'Sriharikota, India'
};
const payloadDefaults: Payload = {
  name: 'Multispectral Imaging Camera', massKg: 4.2, powerW: 18, dataRateMbps: 25,
  fovDeg: 12, resolutionM: 5, dutyCyclePct: 20, focalLengthMm: 550, detectorPitchUm: 5
};
const spacecraftDefaults: Spacecraft = {
  busWidthM: 0.1, busHeightM: 0.2, busDepthM: 0.1,
  dryMassKg: 8, panelAreaM2: 0.6, solarEfficiency: 0.25, batteryWh: 80, basePowerW: 12,
  txPowerW: 5, frequencyMHz: 437, bandwidthMHz: 2, txGainDb: 5, rxGainDb: 5,
  downlinkMbps: 1, dataStorageGb: 8, thrustN: 0.5, ispS: 220, propellantKg: 2,
  inertiaX: 0.08, inertiaY: 0.09, inertiaZ: 0.1, pointingAccuracyDeg: 0.2,
  settlingTimeS: 5, thermalAreaM2: 1.2, absorptivity: 0.7, emissivity: 0.85, batteryEfficiencyPct: 90, batteryDoDPct: 80, solarDegradationPct: 15, thermalHotFactor: 1.25, thermalColdFactor: 0.9
};

type View = 'mission' | 'payload' | 'spacecraft' | 'orbit' | 'simulation' | 'tracking' | 'missionAnalysis' | 'analysis' | 'verification' | 'report' | 'instructions' | 'tools';
const nav: { id: View; label: string; icon: React.ReactNode; group: string }[] = [
  { id: 'mission', label: 'Mission', icon: <Target size={16} />, group: 'DESIGN' },
  { id: 'payload', label: 'Payload', icon: <Globe2 size={16} />, group: 'DESIGN' },
  { id: 'spacecraft', label: 'Spacecraft', icon: <Satellite size={16} />, group: 'DESIGN' },
  { id: 'orbit', label: 'Orbit & Maneuver', icon: <Orbit size={16} />, group: 'DESIGN' },
  { id: 'simulation', label: 'Simulation', icon: <Gauge size={16} />, group: 'RUN' },
  { id: 'tracking', label: 'Satellite Tracking', icon: <Radio size={16} />, group: 'RUN' },
  { id: 'missionAnalysis', label: 'Mission Analysis', icon: <Orbit size={16} />, group: 'RUN' },
  { id: 'analysis', label: 'Engineering Analysis', icon: <Layers3 size={16} />, group: 'RUN' },
  { id: 'verification', label: 'Verification', icon: <Check size={16} />, group: 'RUN' },
  { id: 'report', label: 'Design Report', icon: <Download size={16} />, group: 'OUTPUT' },
  { id: 'instructions', label: 'Instructions & Glossary', icon: <BookOpen size={16} />, group: 'LEARN' },
  { id: 'tools', label: 'Calculator & Reference', icon: <Calculator size={16} />, group: 'TOOLS' }
];

function App() {
  const [mission, setMission] = useState(missionDefaults);
  const [payload, setPayload] = useState(payloadDefaults);
  const [spacecraft, setSpacecraft] = useState(spacecraftDefaults);
  const [orbit, setOrbit] = useState<OrbitDesign>(orbitFromAltitude(550, 97.6));
  const [view, setView] = useState<View>('mission');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [coachEnabled, setCoachEnabled] = useState(() => localStorage.getItem('orbital-lab-coach-enabled') !== 'false');
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [playback, setPlayback] = useState(20);
  const [notice, setNotice] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('Sun-Synchronous Reference');
  const [maneuverAltitude, setManeuverAltitude] = useState(700);
  const [maneuverInclination, setManeuverInclination] = useState(97.6);

  const summary = useMemo(() => orbitalSummary(orbit), [orbit]);
  const duration = Math.max(3600, summary.period * 2);
  const model = useMemo(() => sampleOrbit(orbit, duration, 20), [orbit, duration]);
  const currentState = useMemo(() => {
    const s = propagateState(orbit, Math.min(seconds, duration));
    const lla = stateToLla(s.r, new Date(Date.parse('2026-01-01T00:00:00.000Z') + Math.min(seconds, duration) * 1000));
    return { ...s, ...lla, time: new Date(Date.parse('2026-01-01T00:00:00.000Z') + Math.min(seconds, duration) * 1000).toISOString() };
  }, [orbit, seconds, duration]);
  const geometry = useMemo(() => missionGeometry(mission, payload, orbit), [mission, payload, orbit]);
  const verification = useMemo(() => systemVerification(mission, payload, spacecraft, orbit), [mission, payload, spacecraft, orbit]);
  const propulsion = useMemo(() => propulsionAnalysis(spacecraft, payload.massKg), [spacecraft, payload.massKg]);
  const power = useMemo(() => powerAnalysis(mission, payload, spacecraft, orbit), [mission, payload, spacecraft, orbit]);
  const thermal = useMemo(() => thermalAnalysis(payload, spacecraft), [payload, spacecraft]);
  const comms = useMemo(() => communicationsAnalysis(mission, payload, spacecraft, orbit), [mission, payload, spacecraft, orbit]);
  const adcs = useMemo(() => adcsAnalysis(spacecraft, payload, orbit), [spacecraft, payload, orbit]);
  const maneuver = useMemo(() => maneuverDeltaV(orbit, maneuverAltitude, maneuverInclination), [orbit, maneuverAltitude, maneuverInclination]);

  useEffect(() => {
    localStorage.setItem('orbital-lab-coach-enabled', String(coachEnabled));
  }, [coachEnabled]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSeconds(value => {
        const next = value + playback * 0.25;
        if (next >= duration) {
          setRunning(false);
          return duration;
        }
        return next;
      });
    }, 250);
    return () => window.clearInterval(id);
  }, [running, playback, duration]);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2800);
  };

  const updateOrbit = (patch: Partial<OrbitDesign>) => setOrbit(current => ({ ...current, ...patch, a: EARTH_RADIUS + (patch.altitudeKm ?? current.altitudeKm) }));

  const applyPreset = (name: string, altitude: number, inclination: number) => {
    setSelectedPreset(name);
    setOrbit(orbitFromAltitude(altitude, inclination));
    flash(`Applied ${name} concept.`);
  };

  const exportReport = () => {
    const lines = [
      'ARYAKSHA - STUDENT SPACECRAFT ENGINEERING REPORT',
      '',
      `Mission: ${mission.name}`, `Objective: ${mission.type}`, `Target: ${mission.target}`,
      `Revisit requirement: <= ${mission.revisitDays} days`, `Lifetime: ${mission.lifetimeYears} years`,
      `Launch site: ${mission.launchSite}`, `Maximum mass: ${mission.maxMassKg} kg`, '',
      'PAYLOAD',
      `Name: ${payload.name}`, `Mass: ${payload.massKg} kg`, `Power: ${payload.powerW} W`,
      `Data rate: ${payload.dataRateMbps} Mbps`, `FOV: ${payload.fovDeg} deg`, `Resolution: ${payload.resolutionM} m`,
      `Duty cycle: ${payload.dutyCyclePct}%`, '',
      'ORBIT',
      `Altitude: ${orbit.altitudeKm} km`, `Eccentricity: ${orbit.e}`, `Inclination: ${orbit.i} deg`,
      `RAAN: ${orbit.raan} deg`, `Argument of perigee: ${orbit.argp} deg`, `True anomaly: ${orbit.nu} deg`,
      `Period: ${formatNumber(summary.period / 60, 3)} min`, `Speed at epoch: ${formatNumber(summary.speed, 4)} km/s`, '',
      'PROPULSION',
      `Available delta-V: ${formatNumber(propulsion.deltaVms, 2)} m/s`, `Burn time: ${formatNumber(propulsion.burnTimeS, 1)} s`, '',
      'MISSION GEOMETRY',
      `Computed footprint radius: ${formatNumber(geometry.footprintRadiusKm, 1)} km`,
      `Estimated 48 h revisit: ${formatNumber(geometry.revisitDays, 2)} days`, '',
      'POWER',
      `Generation: ${formatNumber(power.generationW, 1)} W`, `Average load: ${formatNumber(power.averageLoadW, 1)} W`,
      `Eclipse: ${formatNumber(power.eclipseMin, 1)} min`, `Power margin: ${formatNumber(power.marginW, 1)} W`, '',
      'THERMAL',
      `Estimated temperature: ${formatNumber(thermal.temperatureC, 1)} C`, `Margin: ${formatNumber(thermal.marginC, 1)} C`, '',
      'COMMUNICATIONS',
      `Link margin: ${formatNumber(comms.marginDb, 1)} dB`, `Pass capacity: ${formatNumber(comms.capacityGb, 3)} GB`,
      `Estimated daily data: ${formatNumber(comms.generatedGbPerDay, 2)} GB`, '',
      'ADCS',
      `Required torque: ${formatNumber(adcs.requiredTorqueNm, 5)} Nm`, `Pointing requirement: ${formatNumber(adcs.pointingMarginDeg, 2)} deg margin`, '',
      'VERIFICATION',
      ...verification.checks.map(check => `${check.pass ? 'PASS' : 'FAIL'} | ${check.id} | ${check.name} | ${formatNumber(check.value, 3)} ${check.unit}`),
      '',
      'MODEL FIDELITY',
      'Orbit: two-body Keplerian analytical propagation.',
      'SSO reference: Sun-Synchronous Reference (Two-Body Baseline — J2 Secular Drift Not Propagated).',
      'Molniya reference: Molniya Orbit (12h Two-Body Reference — Critical Inclination Not Locked).',
      'Coordinates: ECI to Earth-fixed WGS84 conversion.',
      'Power, thermal, communications and ADCS are preliminary educational engineering models.',
      'Results are for learning and preliminary design, not flight certification.'
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${mission.name || 'orbital-lab'}-engineering-report.txt`;
    link.click();
    URL.revokeObjectURL(url);
    flash('Engineering report exported.');
  };

  return (
    <div className={view === 'simulation' ? 'app-shell mission-control-app' : 'app-shell'}>
      <header className="topbar">
        <button className="brand" onClick={() => { setView('mission'); setMobileNavOpen(false); }}>
          <span className="brand-mark"><AryakshaMark size={34} /></span>
          <span><strong>ARYAKSHA</strong><small>SPACE EXPLORATION LAB</small></span>
        </button>
        {view === 'simulation' && <nav className="mission-top-nav" aria-label="Mission control navigation">
          {nav.map(item => <button key={item.id} type="button" aria-current={view === item.id ? 'page' : undefined} className={view === item.id ? 'active' : ''} onClick={() => { setView(item.id); setMobileNavOpen(false); }}>{item.label}</button>)}
        </nav>}
        <div className="engine-status"><span /> PHYSICS ENGINE <b>READY</b></div>
        <div className="topbar-actions"><button className="mobile-menu-button" type="button" aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileNavOpen} aria-controls="mobile-navigation" onClick={() => setMobileNavOpen(v => !v)}><Layers3 size={17} /></button><button className={coachEnabled ? "coach-setting active" : "coach-setting"} type="button" aria-pressed={coachEnabled} onClick={() => setCoachEnabled(v => !v)}><CircleHelp size={15} /><span>COACH {coachEnabled ? "ON" : "OFF"}</span></button><button className="top-help" onClick={() => { setView('instructions'); setMobileNavOpen(false); }}><BookOpen size={16} /> <span>HELP · DEFINITIONS</span></button></div>
      </header>

      <section className="welcome-hero">
        <div className="welcome-orbit-art" aria-hidden="true"><img className="hero-space-illustration" src="/aryaksha-hero.svg" alt="Original illustration of a spacecraft orbiting Earth" /></div>
        <div className="welcome-copy"><div className="welcome-brand-lockup"><span className="welcome-brand-mark"><AryakshaMark size={60} /></span><div><div className="welcome-wordmark">ARYAKSHA</div><div className="welcome-wordmark-sub">SPACE EXPLORATION LAB</div></div></div>
        <p className="welcome-kicker">A SPACE LAB FOR THE NEXT GENERATION</p><h1>Explore Space.<br />Learn by Doing.<br /><em>Build What’s Next.</em></h1>
        <p className="welcome-description">A free, hands-on space lab for students to explore satellite tracking, understand orbits, run spacecraft simulations and learn real space engineering.</p>
        <div className="welcome-actions"><button type="button" className="welcome-primary" onClick={() => { setView('tracking'); document.querySelector('.shell')?.scrollIntoView({ behavior: 'smooth' }); }}><Rocket size={17} /> Start Exploring <ArrowRight size={17} /></button><button type="button" className="welcome-secondary" onClick={() => document.getElementById('about-aryaksha')?.scrollIntoView({ behavior: 'smooth' })}><BookOpen size={17} /> About the Lab</button></div></div>
        <div className="welcome-feature-grid">
          <button className="welcome-feature" onClick={() => { setView('tracking'); document.querySelector('.shell')?.scrollIntoView({ behavior: 'smooth' }); }}><Radio size={26}/><span><b>Track Satellites</b><small>Explore satellites and orbital paths around Earth.</small></span><ArrowRight size={15}/></button>
          <button className="welcome-feature" onClick={() => { setView('orbit'); document.querySelector('.shell')?.scrollIntoView({ behavior: 'smooth' }); }}><Globe2 size={26}/><span><b>Learn Orbital Science</b><small>Understand trajectories and orbital mechanics.</small></span><ArrowRight size={15}/></button>
          <button className="welcome-feature" onClick={() => { setView('simulation'); document.querySelector('.shell')?.scrollIntoView({ behavior: 'smooth' }); }}><Gauge size={26}/><span><b>Run Simulations</b><small>Experiment with mission and spacecraft concepts.</small></span><ArrowRight size={15}/></button>
          <button className="welcome-feature" onClick={() => { setView('mission'); document.querySelector('.shell')?.scrollIntoView({ behavior: 'smooth' }); }}><Cpu size={26}/><span><b>Build Projects</b><small>Turn curiosity into practical engineering work.</small></span><ArrowRight size={15}/></button>
        </div>
      </section>
      <section className="about-kakshiya" id="about-aryaksha"><div className="about-orbit-visual" aria-hidden="true"><div className="about-earth"><Globe2 size={82}/></div><div className="about-orbit-line"/><span className="about-mini-sat"><Satellite size={22}/></span><span className="about-visual-label">LEARN · EXPERIMENT · CREATE</span></div><div className="about-copy"><p className="welcome-kicker">ABOUT ARYAKSHA</p><h2>A Space Lab for the Next Generation</h2><p>Aryaksha brings space exploration and engineering tools into one accessible place. Explore satellite movement, investigate orbital mechanics, experiment with preliminary spacecraft mission design and understand the engineering trade-offs behind a mission.</p><p>Whether you are taking your first steps into space science or building practical aerospace skills, Aryaksha is designed to help you learn by doing.</p><div className="about-values"><span><Rocket size={19}/> Student focused</span><span><Globe2 size={19}/> Explore space data</span><span><Wrench size={19}/> Hands-on tools</span></div><small className="about-disclaimer">Some tools use public orbital data; simulations are educational models, not flight-certified systems.</small></div></section>
      <div className={view === 'simulation' ? 'shell simulation-shell' : 'shell'}>
        {mobileNavOpen && <div className="mobile-nav-backdrop" onClick={() => setMobileNavOpen(false)} />}
        <aside className={mobileNavOpen ? 'sidebar mobile-open' : 'sidebar'}>
          <div className="side-title">SPACECRAFT DESIGN</div>
          {['DESIGN','RUN','OUTPUT','LEARN','TOOLS'].map(group => (
            <div key={group} className="nav-group">
              <small>{group}</small>
              {nav.filter(item => item.group === group).map(item => (
                <button key={item.id} data-context-label={item.label} className={view === item.id ? 'nav-item active' : 'nav-item'} onClick={() => { setView(item.id); setMobileNavOpen(false); }}>
                  {item.icon}<span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
          <div className="side-health">
            <small>SYSTEM HEALTH</small>
            <div><span className="dot green" /> Physics engine</div>
            <div><span className="dot green" /> Mission model</div>
            <div><span className={verification.failCount ? 'dot amber' : 'dot green'} /> Verification {verification.failCount ? 'needs work' : 'clear'}</div>
          </div>
        </aside>

        <main className="main">
          <nav id="mobile-navigation" aria-label="Mobile navigation" aria-hidden={!mobileNavOpen} className={mobileNavOpen ? 'mobile-nav-panel is-open' : 'mobile-nav-panel'}>{nav.map(item => <button key={item.id} aria-current={view === item.id ? 'page' : undefined} className={view === item.id ? 'nav-item active' : 'nav-item'} onClick={() => { setView(item.id); setMobileNavOpen(false); }}>{item.icon}<span>{item.label}</span></button>)}</nav>
          <div className={view === 'simulation' ? 'mission-strip mission-strip-simulation' : 'mission-strip'}>
            <div><small>ACTIVE MISSION</small><b>{mission.name}</b><span>{mission.type} · {mission.target}</span></div>
            <div className="mission-strip-actions">
              <button data-context-label="Reset Simulation" onClick={() => { setSeconds(0); setRunning(false); }}><RefreshCw size={14} /> RESET SIM</button>
              <button data-context-label="Run Mission" className="run-button" onClick={() => { setRunning(true); setView('simulation'); }}><Play size={14} /> RUN MISSION</button>
            </div>
          </div>

          <Suspense fallback={<div role="status" className="page"><p>Loading workspace…</p></div>}>
          {view === 'mission' && <MissionView mission={mission} setMission={setMission} go={setView} />}
          {view === 'payload' && <PayloadView payload={payload} setPayload={setPayload} go={setView} />}
          {view === 'spacecraft' && <SpacecraftView spacecraft={spacecraft} setSpacecraft={setSpacecraft} payload={payload} mission={mission} verification={verification} />}
          {view === 'orbit' && <OrbitView orbit={orbit} updateOrbit={updateOrbit} maneuverAltitude={maneuverAltitude} setManeuverAltitude={setManeuverAltitude} maneuverInclination={maneuverInclination} setManeuverInclination={setManeuverInclination} maneuver={maneuver} applyPreset={applyPreset} selectedPreset={selectedPreset} />}
          {view === 'simulation' && <SimulationView model={model} current={currentState} seconds={seconds} duration={duration} running={running} setRunning={setRunning} playback={playback} setPlayback={setPlayback} setSeconds={setSeconds} mission={mission} payload={payload} spacecraft={spacecraft} orbit={orbit} footprintAngle={geometry.footprintDeg} />}
          {view === 'tracking' && <SatelliteTrackingView />}
          {view === 'missionAnalysis' && <MissionAnalysisView initialAltitudeKm={orbit.altitudeKm} initialInclinationDeg={orbit.i} initialEccentricity={orbit.e} />}
          {view === 'analysis' && <AnalysisView mission={mission} orbit={orbit} geometry={geometry} power={power} thermal={thermal} comms={comms} adcs={adcs} propulsion={propulsion} />}
          {view === 'verification' && <VerificationView verification={verification} />}
          {view === 'report' && <ReportView mission={mission} payload={payload} spacecraft={spacecraft} orbit={orbit} summary={summary} geometry={geometry} verification={verification} onExport={exportReport} />}
          {view === 'instructions' && <InstructionsView />}
          {view === 'tools' && <ToolsView />}
          </Suspense>
          {coachEnabled && view !== 'simulation' && <ContextCoach view={view} />}
        </main>
      </div>
      {notice && <div className="toast"><Check size={15} /> {notice}</div>}
    </div>
  );
}

function PageHeader({ eyebrow, title, text, action }: { eyebrow: string; title: string; text: string; action?: React.ReactNode }) {
  return <div data-context-label={title} className="page-header"><div><small>{eyebrow}</small><h1>{title}</h1><p>{text}</p></div>{action}</div>;
}

function MissionView({ mission, setMission, go }: { mission: Mission; setMission: React.Dispatch<React.SetStateAction<Mission>>; go: (v: View) => void }) {
  return <div className="page">
    <PageHeader eyebrow="01 · MISSION DEFINITION" title="Start with the engineering problem." text="Tell Aryaksha what the satellite must accomplish. The orbit and spacecraft should emerge from these constraints, not the other way around." />
    <div className="hero-grid">
      <Card title="Mission requirements" icon={<Target size={17} />}>
        <div className="field-grid">
          <Field label="MISSION NAME" value={mission.name} onChange={v => setMission(x => ({ ...x, name: v }))} />
          <SelectField label="MISSION TYPE" value={mission.type} options={['Earth Observation','Communications','Weather & Climate','Science','Technology Demonstration']} onChange={v => setMission(x => ({ ...x, type: v }))} />
          <Field label="TARGET / REGION" value={mission.target} onChange={v => setMission(x => ({ ...x, target: v }))} />
          <Field label="REVISIT REQUIREMENT" value={mission.revisitDays} unit="days" type="number" onChange={v => setMission(x => ({ ...x, revisitDays: Number(v) }))} />
          <Field label="MISSION LIFETIME" value={mission.lifetimeYears} unit="years" type="number" onChange={v => setMission(x => ({ ...x, lifetimeYears: Number(v) }))} />
          <Field label="MIN ELEVATION" value={mission.minElevationDeg} unit="deg" type="number" onChange={v => setMission(x => ({ ...x, minElevationDeg: Number(v) }))} />
          <Field label="MAX MASS" value={mission.maxMassKg} unit="kg" type="number" onChange={v => setMission(x => ({ ...x, maxMassKg: Number(v) }))} />
          <Field label="LAUNCH SITE" value={mission.launchSite} onChange={v => setMission(x => ({ ...x, launchSite: v }))} />
        </div>
        <div className="callout"><Target size={15} /><span><b>Engineering rule:</b> mission requirements drive orbit selection. The software will show the assumptions behind every recommendation.</span></div>
      </Card>
      <Card title="Mission chain" icon={<Activity size={17} />}>
        <Flow items={['Mission objective','Payload constraints','Orbit & trajectory','Spacecraft budgets','Simulation','Verification']} />
        <div className="metric-big"><b>{mission.revisitDays}</b><span>day revisit target</span></div>
        <button className="primary wide" onClick={() => go('payload')}>Define payload <ArrowRight size={15} /></button>
      </Card>
    </div>
  </div>;
}

function PayloadView({ payload, setPayload, go }: { payload: Payload; setPayload: React.Dispatch<React.SetStateAction<Payload>>; go: (v: View) => void }) {
  const avgData = payload.dataRateMbps * payload.dutyCyclePct / 100;
  return <div className="page">
    <PageHeader eyebrow="02 · PAYLOAD" title="Turn the payload into spacecraft constraints." text="Mass, power, field of view, resolution and data generation propagate into the rest of the spacecraft design." />
    <div className="hero-grid">
      <Card title="Payload definition" icon={<Globe2 size={17} />}>
        <div className="field-grid">
          <Field label="PAYLOAD NAME" value={payload.name} onChange={v => setPayload(x => ({ ...x, name: v }))} />
          <Field label="MASS" value={payload.massKg} unit="kg" type="number" onChange={v => setPayload(x => ({ ...x, massKg: Number(v) }))} />
          <Field label="POWER" value={payload.powerW} unit="W" type="number" onChange={v => setPayload(x => ({ ...x, powerW: Number(v) }))} />
          <Field label="DATA RATE" value={payload.dataRateMbps} unit="Mbps" type="number" onChange={v => setPayload(x => ({ ...x, dataRateMbps: Number(v) }))} />
          <Field label="FIELD OF VIEW" value={payload.fovDeg} unit="deg" type="number" onChange={v => setPayload(x => ({ ...x, fovDeg: Number(v) }))} />
          <Field label="GROUND RESOLUTION" value={payload.resolutionM} unit="m" type="number" onChange={v => setPayload(x => ({ ...x, resolutionM: Number(v) }))} />
          <Field label="DUTY CYCLE" value={payload.dutyCyclePct} unit="%" type="number" onChange={v => setPayload(x => ({ ...x, dutyCyclePct: Number(v) }))} /><Field label="FOCAL LENGTH" value={payload.focalLengthMm} unit="mm" type="number" onChange={v => setPayload(x => ({ ...x, focalLengthMm: Number(v) }))} /><Field label="DETECTOR PITCH" value={payload.detectorPitchUm} unit="µm" type="number" onChange={v => setPayload(x => ({ ...x, detectorPitchUm: Number(v) }))} />
        </div>
        <div className="callout"><Zap size={15} /><span>Changing the payload changes system mass, power, data and imaging geometry immediately.</span></div>
      </Card>
      <Card title="Derived payload constraints" icon={<Layers3 size={17} />}>
        <Stat label="Average data generation" value={`${formatNumber(avgData,2)} Mbps`} />
        <Stat label="Data generated / day" value={`${formatNumber(avgData*86400/8/1e3,2)} GB`} />
        <Stat label="Computed footprint" value="Calculated from FOV + altitude" />
        <Stat label="Pointing relevance" value={`${payload.resolutionM} m resolution`} />
        <button className="primary wide" onClick={() => go('spacecraft')}>Configure spacecraft <ArrowRight size={15} /></button>
      </Card>
    </div>
  </div>;
}

function SpacecraftView({ spacecraft, setSpacecraft, payload, mission, verification }: { spacecraft: Spacecraft; setSpacecraft: React.Dispatch<React.SetStateAction<Spacecraft>>; payload: Payload; mission: Mission; verification: ReturnType<typeof systemVerification> }) {
  const update = (patch: Partial<Spacecraft>) => setSpacecraft(x => ({ ...x, ...patch }));
  return <div className="page">
    <PageHeader eyebrow="03 · SPACECRAFT" title="Build the vehicle around the mission." text="These are preliminary subsystem parameters. Aryaksha uses them to expose coupled mass, power, propulsion, ADCS, thermal and communications consequences." />
    <div className="spacecraft-grid">
      <Card title="Mass, power & data" icon={<Battery size={17} />}>
        <div className="field-grid">
          <Field label="BUS WIDTH" value={spacecraft.busWidthM} unit="m" type="number" onChange={v => update({ busWidthM: Math.max(0.01, Number(v)) })} />
          <Field label="BUS HEIGHT" value={spacecraft.busHeightM} unit="m" type="number" onChange={v => update({ busHeightM: Math.max(0.01, Number(v)) })} />
          <Field label="BUS DEPTH" value={spacecraft.busDepthM} unit="m" type="number" onChange={v => update({ busDepthM: Math.max(0.01, Number(v)) })} />
          <Field label="DRY MASS" value={spacecraft.dryMassKg} unit="kg" type="number" onChange={v => update({ dryMassKg: Number(v) })} />
          <Field label="SOLAR PANEL AREA" value={spacecraft.panelAreaM2} unit="m²" type="number" onChange={v => update({ panelAreaM2: Number(v) })} />
          <Field label="SOLAR EFFICIENCY" value={spacecraft.solarEfficiency} unit="fraction" type="number" onChange={v => update({ solarEfficiency: Number(v) })} />
          <Field label="BATTERY" value={spacecraft.batteryWh} unit="Wh" type="number" onChange={v => update({ batteryWh: Number(v) })} />
          <Field label="BASE POWER" value={spacecraft.basePowerW} unit="W" type="number" onChange={v => update({ basePowerW: Number(v) })} />
          <Field label="DATA STORAGE" value={spacecraft.dataStorageGb} unit="GB" type="number" onChange={v => update({ dataStorageGb: Number(v) })} />
        </div>
      </Card>
      <Card title="Communications" icon={<Radio size={17} />}>
        <div className="field-grid">
          <Field label="TX POWER" value={spacecraft.txPowerW} unit="W" type="number" onChange={v => update({ txPowerW: Number(v) })} />
          <Field label="FREQUENCY" value={spacecraft.frequencyMHz} unit="MHz" type="number" onChange={v => update({ frequencyMHz: Number(v) })} />
          <Field label="BANDWIDTH" value={spacecraft.bandwidthMHz} unit="MHz" type="number" onChange={v => update({ bandwidthMHz: Number(v) })} />
          <Field label="DOWNLINK RATE" value={spacecraft.downlinkMbps} unit="Mbps" type="number" onChange={v => update({ downlinkMbps: Number(v) })} />
          <Field label="TX GAIN" value={spacecraft.txGainDb} unit="dBi" type="number" onChange={v => update({ txGainDb: Number(v) })} />
          <Field label="RX GAIN" value={spacecraft.rxGainDb} unit="dBi" type="number" onChange={v => update({ rxGainDb: Number(v) })} />
        </div>
      </Card>
      <Card title="Propulsion & ADCS" icon={<Rocket size={17} />}>
        <div className="field-grid">
          <Field label="THRUST" value={spacecraft.thrustN} unit="N" type="number" onChange={v => update({ thrustN: Number(v) })} />
          <Field label="ISP" value={spacecraft.ispS} unit="s" type="number" onChange={v => update({ ispS: Number(v) })} />
          <Field label="PROPELLANT" value={spacecraft.propellantKg} unit="kg" type="number" onChange={v => update({ propellantKg: Number(v) })} />
          <Field label="POINTING ACCURACY" value={spacecraft.pointingAccuracyDeg} unit="deg" type="number" onChange={v => update({ pointingAccuracyDeg: Number(v) })} />
          <Field label="SETTLING TIME" value={spacecraft.settlingTimeS} unit="s" type="number" onChange={v => update({ settlingTimeS: Number(v) })} />
          <Field label="INERTIA X / Y / Z" value={`${spacecraft.inertiaX} / ${spacecraft.inertiaY} / ${spacecraft.inertiaZ}`} onChange={() => {}} />
        </div>
        <div className="field-grid">
          <Field label="INERTIA X" value={spacecraft.inertiaX} unit="kg·m²" type="number" onChange={v => update({ inertiaX: Number(v) })} />
          <Field label="INERTIA Y" value={spacecraft.inertiaY} unit="kg·m²" type="number" onChange={v => update({ inertiaY: Number(v) })} />
          <Field label="INERTIA Z" value={spacecraft.inertiaZ} unit="kg·m²" type="number" onChange={v => update({ inertiaZ: Number(v) })} />
        </div>
      </Card>
      <Card title="Thermal" icon={<Thermometer size={17} />}>
        <div className="field-grid">
          <Field label="THERMAL AREA" value={spacecraft.thermalAreaM2} unit="m²" type="number" onChange={v => update({ thermalAreaM2: Number(v) })} />
          <Field label="ABSORPTIVITY" value={spacecraft.absorptivity} unit="fraction" type="number" onChange={v => update({ absorptivity: Number(v) })} />
          <Field label="EMISSIVITY" value={spacecraft.emissivity} unit="fraction" type="number" onChange={v => update({ emissivity: Number(v) })} /><Field label="BATTERY EFFICIENCY" value={spacecraft.batteryEfficiencyPct} unit="%" type="number" onChange={v => update({ batteryEfficiencyPct: Number(v) })} /><Field label="BATTERY DoD" value={spacecraft.batteryDoDPct} unit="%" type="number" onChange={v => update({ batteryDoDPct: Number(v) })} /><Field label="SOLAR EOL DEGRADATION" value={spacecraft.solarDegradationPct} unit="%" type="number" onChange={v => update({ solarDegradationPct: Number(v) })} /><Field label="THERMAL HOT FACTOR" value={spacecraft.thermalHotFactor} unit="×" type="number" onChange={v => update({ thermalHotFactor: Number(v) })} /><Field label="THERMAL COLD FACTOR" value={spacecraft.thermalColdFactor} unit="×" type="number" onChange={v => update({ thermalColdFactor: Number(v) })} />
        </div>
        <div className="callout"><Thermometer size={15} /><span>Thermal model is deliberately preliminary. It is a lumped-node estimate, not a spacecraft thermal qualification analysis.</span></div>
      </Card>
    </div>
    <div className="bottom-bar"><b>Current wet mass: {formatNumber(verification.massKg,2)} kg</b><span>Limit {mission.maxMassKg} kg · {verification.massKg <= mission.maxMassKg ? 'PASS' : 'FAIL'}</span><span>Payload {payload.massKg} kg included.</span></div>
  </div>;
}

function OrbitView({ orbit, updateOrbit, maneuverAltitude, setManeuverAltitude, maneuverInclination, setManeuverInclination, maneuver, applyPreset, selectedPreset }: { orbit: OrbitDesign; updateOrbit: (p: Partial<OrbitDesign>) => void; maneuverAltitude: number; setManeuverAltitude: (n: number) => void; maneuverInclination: number; setManeuverInclination: (n: number) => void; maneuver: ReturnType<typeof maneuverDeltaV>; applyPreset: (name: string, altitude: number, inclination: number) => void; selectedPreset: string }) {
  const summary = orbitalSummary(orbit);
  const presets = [['LEO Technology Demo',400,51.6],['ISS-class',420,51.6],['Sun-Synchronous Reference',550,97.6],['SAR / SSO Reference',650,98],['Weather / Polar',820,98.7],['GNSS MEO',20200,55],['GEO Communications',35786,0]] as const;
  return <div className="page">
    <PageHeader eyebrow="04 · ORBIT & MANEUVER" title="Make the orbital mechanics visible." text="Edit the classical elements, inspect the state consequences and design a maneuver from one orbit to another." />
    <div className="orbit-layout">
      <Card title="Classical orbital elements" icon={<Orbit size={17} />}>
        <div className="field-grid">
          <Field label="ALTITUDE" value={orbit.altitudeKm} unit="km" type="number" onChange={v => updateOrbit({ altitudeKm: Number(v) })} />
          <Field label="ECCENTRICITY" value={orbit.e} type="number" onChange={v => updateOrbit({ e: Number(v) })} />
          <Field label="INCLINATION" value={orbit.i} unit="deg" type="number" onChange={v => updateOrbit({ i: Number(v) })} />
          <Field label="RAAN" value={orbit.raan} unit="deg" type="number" onChange={v => updateOrbit({ raan: Number(v) })} />
          <Field label="ARGUMENT OF PERIGEE" value={orbit.argp} unit="deg" type="number" onChange={v => updateOrbit({ argp: Number(v) })} />
          <Field label="TRUE ANOMALY" value={orbit.nu} unit="deg" type="number" onChange={v => updateOrbit({ nu: Number(v) })} />
        </div>
        <div className="state-card">
          <div><small>PERIGEE</small><b>{formatNumber(summary.rp - EARTH_RADIUS,1)} km</b></div>
          <div><small>APOGEE</small><b>{formatNumber(summary.ra - EARTH_RADIUS,1)} km</b></div>
          <div><small>PERIOD</small><b>{formatNumber(summary.period/60,3)} min</b></div>
          <div><small>VELOCITY</small><b>{formatNumber(summary.speed,4)} km/s</b></div>
          <div><small>ENERGY</small><b>{formatNumber(summary.energy,3)} km²/s²</b></div>
          <div><small>ANGULAR MOMENTUM</small><b>{formatNumber(summary.h,1)} km²/s</b></div>
        </div>
      </Card>
      <Card title="Orbit presets" icon={<Settings2 size={17} />}>
        <div className="preset-list">{presets.map(([name,h,i]) => <button key={name} className={selectedPreset === name ? 'preset selected' : 'preset'} onClick={() => applyPreset(name,h,i)}><span>{name}</span><small>{h} km · {i}°</small></button>)}</div>
      </Card>
    </div>
    <Card title="Reference orbit fidelity" icon={<TriangleAlert size={17} />}>
      <div className="fidelity-table">
        <div><b>SSO reference</b><span>Sun-Synchronous Reference (Two-Body Baseline — J2 Secular Drift Not Propagated). This is a two-body baseline; J2 nodal drift is not propagated, so sun-synchronous behavior is not maintained by this model.</span><em>Two-body only</em></div>
        <div><b>Molniya reference</b><span>Molniya Orbit (12h Two-Body Reference — Critical Inclination Not Locked). Reference nomenclature only, not an active orbit preset; this propagator does not model J2-driven argument-of-perigee behavior.</span><em>Reference only</em></div>
      </div>
    </Card>
    <Card title="Maneuver designer" icon={<Rocket size={17} />}>
      <div className="maneuver-grid">
        <div><Field label="TARGET ALTITUDE" value={maneuverAltitude} unit="km" type="number" onChange={v => setManeuverAltitude(Number(v))} /><Field label="TARGET INCLINATION" value={maneuverInclination} unit="deg" type="number" onChange={v => setManeuverInclination(Number(v))} /></div>
        <div className="maneuver-result"><small>ESTIMATED MANEUVER ΔV</small><b>{formatNumber(maneuver.totalDvMs,1)} m/s</b><span>Altitude transfer: {formatNumber(maneuver.radialDvMs,1)} m/s</span><span>Plane change: {formatNumber(maneuver.planeChangeDvMs,1)} m/s</span><span>Compare this requirement with available propulsion ΔV.</span></div>
      </div>
      <div className="callout"><Wrench size={15} /><span><b>Vector rule:</b> a burn changes velocity first. The new orbital elements are the consequence of that vector change. This is why the simulation and maneuver tools share one state model.</span></div>
    </Card>
  </div>;
}

function SimulationView({ model, current, seconds, duration, running, setRunning, playback, setPlayback, setSeconds, mission, payload, spacecraft, orbit, footprintAngle }: { model: any[]; current: any; seconds: number; duration: number; running: boolean; setRunning: (v:boolean)=>void; playback:number; setPlayback:(v:number)=>void; setSeconds:(v:number)=>void; mission: Mission; payload: Payload; spacecraft: Spacecraft; orbit: OrbitDesign; footprintAngle:number }) {
  return <div className="page simulation-page">
    <PageHeader eyebrow="05 · SIMULATION" title="Run the spacecraft, not a picture of it." text="The animation, telemetry and engineering results read from the same propagated state. The current model is deterministic two-body Keplerian propagation; J2, drag, SRP, third-body gravity and operational effects remain outside the model." />
    <div className="simulation-grid mission-control-grid">
      <div className="scene-wrap"><Earth3DScene model={model} current={current} seconds={seconds} name={mission.name} propagator="KEPLER" footprintAngleDeg={footprintAngle} busWidthM={spacecraft.busWidthM} busHeightM={spacecraft.busHeightM} busDepthM={spacecraft.busDepthM} altitudeKm={orbit.altitudeKm} eccentricity={orbit.e} inclinationDeg={orbit.i} raanDeg={orbit.raan} argumentOfPerigeeDeg={orbit.argp} trueAnomalyDeg={orbit.nu} periodMin={orbitalSummary(orbit).period / 60} panelAreaM2={spacecraft.panelAreaM2} running={running} setRunning={setRunning} playback={playback} setPlayback={setPlayback} duration={duration} setSeconds={setSeconds} /></div>
    </div>
    <div className="mission-bottom-grid">
      <div className="mission-bottom-track"><GroundTrackMap model={model} current={current} /></div>
      <section className="mission-bottom-card">
        <div className="panel-title"><Orbit size={16} /> ORBIT PARAMETERS</div>
        <Telemetry label="APOGEE ALTITUDE" value={`${(orbit.a * (1 + orbit.e) - 6378.137).toFixed(2)} km`} />
        <Telemetry label="PERIGEE ALTITUDE" value={`${(orbit.a * (1 - orbit.e) - 6378.137).toFixed(2)} km`} />
        <Telemetry label="INCLINATION" value={`${orbit.i.toFixed(3)}°`} />
        <Telemetry label="ECCENTRICITY" value={orbit.e.toFixed(5)} />
        <Telemetry label="SEMI-MAJOR AXIS" value={`${orbit.a.toFixed(2)} km`} />
        <Telemetry label="ORBITAL PERIOD" value={`${(orbitalSummary(orbit).period / 60).toFixed(2)} min`} />
      </section>
      <section className="mission-bottom-card">
        <div className="panel-title"><Rocket size={16} /> MISSION INFO</div>
        <h3>{mission.name || 'Unnamed mission'}</h3>
        <p>Educational spacecraft simulation using the selected mission state. This view is not flight-certified and does not represent a live spacecraft command link.</p>
        <div className="mission-info-fact"><span>PROPAGATION</span><b>Two-body Kepler</b></div>
        <div className="mission-info-fact"><span>STATE SOURCE</span><b>ECI → ECEF → WGS84</b></div>
        <div className="mission-info-fact"><span>PAYLOAD FOOTPRINT</span><b>{footprintAngle.toFixed(3)}° · FOV {payload.fovDeg}°</b></div>
        <div className="mission-info-fact"><span>SCENARIO EPOCH</span><b>2026-01-01T00:00:00Z</b></div>
      </section>
    </div>
  </div>;
}

function GroundTrackMap({ model, current }: { model: any[]; current: any }) {
  const [solarEpoch, setSolarEpoch] = useState('simulation');
  const points = useMemo<SubPoint[]>(() => model.map(sample => ({
    lat: Number(sample.lla.lat),
    lon: Number(sample.lla.lon),
    alt: Number(sample.lla.alt),
    epoch: Number(sample.t),
  })), [model]);
  const segments = useMemo(() => generateContinuousGroundTrack(points), [points]);
  const simulationDate = new Date(current?.time || '2026-01-01T00:00:00.000Z');
  const calibrationEpochs: Record<string, string> = {
    vernal: '2026-03-20T14:46:00.000Z',
    summer: '2026-06-21T08:25:00.000Z',
    autumnal: '2026-09-23T00:05:00.000Z',
    winter: '2026-12-21T20:50:00.000Z',
  };
  const solarDate = solarEpoch === 'simulation' ? simulationDate : new Date(calibrationEpochs[solarEpoch]);
  const solar = useMemo(() => solarSubpoint(solarDate), [solarDate.getTime()]);
  const dayNight = useMemo(() => computeDayNightBoundary(solar.lat, solar.lon), [solar.lat, solar.lon]);
  const projectX = (lon: number) => ((lon + 180) / 360) * 1000;
  const projectY = (lat: number) => ((90 - lat) / 180) * 500;
  const currentLat = Number(current?.lla?.lat);
  const currentLon = Number(current?.lla?.lon);
  const hasCurrentPoint = Number.isFinite(currentLat) && Number.isFinite(currentLon);

  return (
    <Card title="2D Ground Track · Equirectangular" icon={<Globe2 size={17} />}>
      <div className="ground-track-controls">
        <label htmlFor="solar-epoch">Solar overlay epoch</label>
        <select id="solar-epoch" value={solarEpoch} onChange={event => setSolarEpoch(event.target.value)}>
          <option value="simulation">Simulation epoch</option>
          <option value="vernal">Vernal equinox · 20 Mar 2026</option>
          <option value="summer">Summer solstice · 21 Jun 2026</option>
          <option value="autumnal">Autumnal equinox · 23 Sep 2026</option>
          <option value="winter">Winter solstice · 21 Dec 2026</option>
        </select>
        <span>Sub-solar: {solar.lat.toFixed(2)}° lat · {solar.lon.toFixed(2)}° lon</span>
      </div>
      <div className="ground-track-wrap">
        <svg className="ground-track-svg" viewBox="0 0 1000 500" role="img" aria-label="Equirectangular ground track with day and night shading and antimeridian-split trajectory segments">
          <rect width="1000" height="500" fill="#071019" />
          <path d={dayNight.nightShadePath} fill="rgba(15, 23, 42, 0.68)" stroke="none" />
          <g stroke="#a8c0d1" strokeOpacity="0.16" strokeWidth="1">
            {Array.from({ length: 7 }, (_, i) => {
              const x = i * (1000 / 6);
              return <line key={`lon-${i}`} x1={x} y1="0" x2={x} y2="500" />;
            })}
            {Array.from({ length: 7 }, (_, i) => {
              const y = i * (500 / 6);
              return <line key={`lat-${i}`} x1="0" y1={y} x2="1000" y2={y} />;
            })}
          </g>
          <g fill="#9fb3c2" fontSize="16" fontFamily="ui-monospace, monospace">
            {Array.from({ length: 7 }, (_, i) => {
              const lon = -180 + i * 60;
              const x = i * (1000 / 6);
              const anchor = i === 0 ? 'start' : i === 6 ? 'end' : 'middle';
              return <text key={`lon-label-${i}`} x={x} y="22" textAnchor={anchor}>{lon > 0 ? `+${lon}°` : `${lon}°`}</text>;
            })}
            {[-60, -30, 0, 30, 60].map(lat => <text key={lat} x="8" y={projectY(lat) - 6}>{lat > 0 ? `+${lat}°` : `${lat}°`}</text>)}
          </g>
          <g>
            {dayNight.terminatorSegments.map((segment, index) => {
              const d = segment.map((point, pointIndex) =>
                `${pointIndex === 0 ? 'M' : 'L'} ${projectX(point.lon).toFixed(3)} ${projectY(point.lat).toFixed(3)}`
              ).join(' ');
              return <path key={`terminator-${index}`} d={d} fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.9" vectorEffect="non-scaling-stroke" />;
            })}
            <circle cx={projectX(dayNight.subSolarPoint.lon)} cy={projectY(dayNight.subSolarPoint.lat)} r="5" fill="#fbbf24" stroke="#ffffff" strokeWidth="1.5" />
          </g>
          <g>
            {segments.map((segment, index) => {
              const d = segment.map((point, pointIndex) =>
                `${pointIndex === 0 ? 'M' : 'L'} ${projectX(point.lon).toFixed(3)} ${projectY(point.lat).toFixed(3)}`
              ).join(' ');
              return <path key={index} d={d} fill="none" stroke="#51ddff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />;
            })}
          </g>
          {hasCurrentPoint && <g>
            <circle cx={projectX(currentLon)} cy={projectY(currentLat)} r="8" fill="#ffbf5a" fillOpacity="0.2" />
            <circle cx={projectX(currentLon)} cy={projectY(currentLat)} r="4" fill="#ffbf5a" stroke="#fff0c9" strokeWidth="1" />
          </g>}
        </svg>
      </div>
      <div className="ground-track-footer">
        <span><i /> SAMPLED TWO-BODY TRACK</span>
        <span>{points.length} samples · {segments.length} disconnected segment{segments.length === 1 ? '' : 's'}</span>
        <span><b style={{ color: '#f59e0b' }}>Dashed line: solar terminator</b> · Yellow marker: sub-solar point / spacecraft state</span>
        <span>Solar geometry: low-precision analytical model; not operational ephemeris</span>
      </div>
    </Card>
  );
}

function AnalysisView({ mission, orbit, geometry, power, thermal, comms, adcs, propulsion }: { mission: Mission; orbit: OrbitDesign; geometry: ReturnType<typeof missionGeometry>; power: ReturnType<typeof powerAnalysis>; thermal: ReturnType<typeof thermalAnalysis>; comms: ReturnType<typeof communicationsAnalysis>; adcs: ReturnType<typeof adcsAnalysis>; propulsion: ReturnType<typeof propulsionAnalysis> }) {
  const modules = [
    { title: 'Mission geometry', icon: <Target size={17} />, status: geometry.passesWithinRequirement && geometry.revisitStatus === 'MEASURED', metrics: [['Footprint radius', `${formatNumber(geometry.footprintRadiusKm,1)} km`],['48 h revisit', `${formatNumber(geometry.revisitDays,2)} d`],['Access samples', String(geometry.accessCount)]], note: `Sampled access/revisit model. Revisit status: ${geometry.revisitStatus}.` },
    { title: 'ADCS', icon: <Activity size={17} />, status: adcs.pointingPass, metrics: [['Required torque', `${formatNumber(adcs.requiredTorqueNm,5)} Nm`],['Actuator margin', `${formatNumber(adcs.actuatorMarginNm,5)} Nm`],['Ground error', `${formatNumber(adcs.pointingGroundErrorM,1)} m`]], note: 'Pointing is evaluated consistently as ground error at the current orbit altitude.' },
    { title: 'Propulsion', icon: <Rocket size={17} />, status: propulsion.deltaVms > 0, metrics: [['Available ΔV', `${formatNumber(propulsion.deltaVms,1)} m/s`],['Burn time', `${formatNumber(propulsion.burnTimeS,1)} s`],['Wet mass', `${formatNumber(propulsion.wetMassKg,2)} kg`]], note: 'Tsiolkovsky rocket equation with constant Isp.' },
    { title: 'Power', icon: <Zap size={17} />, status: power.pass, metrics: [['Generation', `${formatNumber(power.generationW,1)} W`],['Average load', `${formatNumber(power.averageLoadW,1)} W`],['Battery reserve', `${formatNumber(power.batteryEndWh,1)} Wh`]], note: 'Preliminary energy model with battery efficiency, DoD and EOL solar degradation.' },
    { title: 'Thermal', icon: <Thermometer size={17} />, status: thermal.pass, metrics: [['Nominal temp', `${formatNumber(thermal.temperatureC,1)} °C`],['Hot / cold', `${formatNumber(thermal.hotTemperatureC,1)} / ${formatNumber(thermal.coldTemperatureC,1)} °C`],['Hot margin', `${formatNumber(thermal.hotMarginC,1)} °C`]], note: 'Lumped-node radiative equilibrium with explicit hot/cold cases.' },
    { title: 'Communications', icon: <Radio size={17} />, status: comms.pass, metrics: [['Link margin', `${formatNumber(comms.marginDb,1)} dB`],['Daily capacity', `${formatNumber(comms.capacityGb,2)} GB`],['Data margin', `${formatNumber(comms.dataMarginGbPerDay,2)} GB/day`]], note: `Altitude-dependent preliminary link budget tied to ${comms.groundStation}.` },
  ];
  return <div className="page">
    <PageHeader eyebrow="06 · ENGINEERING ANALYSIS" title="See where the spacecraft succeeds or fails." text="Every module consumes the mission, payload, spacecraft and orbit model. The models are labelled so students know what the numbers mean." />
    <div className="analysis-banner"><div><b>CONNECTED ENGINEERING MODEL</b><span>Changing one design variable recalculates the dependent modules.</span></div><div><strong>{geometry.passesWithinRequirement ? 'MISSION GEOMETRY PASS' : 'MISSION GEOMETRY FAIL'}</strong><small>Target: {mission.target} · {orbit.altitudeKm} km</small></div></div>
    <div className="analysis-grid">{modules.map(module => <div className="analysis-card" key={module.title}><div className="analysis-card-head"><span>{module.icon}</span><b>{module.title}</b><em className={module.status ? 'status pass' : 'status fail'}>{module.status ? 'PASS' : 'FAIL'}</em></div>{module.metrics.map(([k,v]) => <div data-context-label={k} className="analysis-metric" key={k}><span className="result-label">{k}<HelpTip label={k} /></span><b>{v}</b></div>)}<p>{module.note}</p></div>)}</div>
    <div className="coupling-card"><div className="panel-title"><RefreshCw size={16} /> DESIGN CHANGE → CONSEQUENCES</div><div className="coupling-flow"><span>Altitude {orbit.altitudeKm} km</span><ArrowRight size={15}/><span>Period {formatNumber(2*Math.PI*Math.sqrt(orbit.a**3/398600.4418)/60,2)} min</span><ArrowRight size={15}/><span>Footprint {formatNumber(geometry.footprintRadiusKm,1)} km</span><ArrowRight size={15}/><span>Revisit {formatNumber(geometry.revisitDays,2)} d</span></div></div>
  </div>;
}

function VerificationView({ verification }: { verification: ReturnType<typeof systemVerification> }) {
  return <div className="page">
    <PageHeader eyebrow="07 · VERIFICATION" title="Prove the design meets the requirements." text="A result is useful only when the requirement, calculated value, limit and model are visible together." />
    <div className="verification-summary"><div><small>PASS</small><b>{verification.passCount}</b></div><div><small>FAIL</small><b>{verification.failCount}</b></div><div><small>TOTAL</small><b>{verification.checks.length}</b></div><div className="verification-note"><TriangleAlert size={17}/><span>Failures are design problems to investigate, not hidden warnings.</span></div></div>
    <div className="verification-table">{verification.checks.map(check => <div className="verification-row" key={check.id}><div><small>{check.id}</small><b className="result-label">{check.name}<HelpTip label={check.name} /></b></div><span>{formatNumber(check.value,3)} {check.unit}</span><span>Limit {formatNumber(check.limit,3)} {check.unit}</span><strong className={check.pass ? 'pass-text' : 'fail-text'}>{check.pass ? 'PASS' : 'FAIL'}</strong></div>)}</div>
  </div>;
}

function ReportView({ mission, payload, spacecraft, orbit, summary, geometry, verification, onExport }: { mission: Mission; payload: Payload; spacecraft: Spacecraft; orbit: OrbitDesign; summary: ReturnType<typeof orbitalSummary>; geometry: ReturnType<typeof missionGeometry>; verification: ReturnType<typeof systemVerification>; onExport: () => void }) {
  return <div className="page">
    <PageHeader eyebrow="08 · DESIGN REPORT" title="A traceable preliminary spacecraft design." text="The report preserves inputs, assumptions, model fidelity, derived results and verification outcomes." action={<button className="primary" onClick={onExport}><Download size={15}/> Export report</button>} />
    <div className="report-hero"><div><small>MISSION</small><h2>{mission.name}</h2><p>{mission.type} · {mission.target}</p></div><div><small>VERIFICATION</small><b>{verification.passCount}/{verification.checks.length}</b><span>requirements passing</span></div></div>
    <div className="report-grid">
      <Card title="Mission & payload" icon={<Target size={16}/>}><ReportRow k="Revisit requirement" v={`≤ ${mission.revisitDays} days`}/><ReportRow k="Lifetime" v={`${mission.lifetimeYears} years`}/><ReportRow k="Payload" v={payload.name}/><ReportRow k="Payload mass" v={`${payload.massKg} kg`}/><ReportRow k="Resolution requirement" v={`${payload.resolutionM} m`}/><ReportRow k="Estimated nadir GSD" v={`${formatNumber(verification.performance.gsdM,2)} m`}/></Card>
      <Card title="Orbit" icon={<Orbit size={16}/>}><ReportRow k="Altitude" v={`${orbit.altitudeKm} km`}/><ReportRow k="Inclination" v={`${orbit.i}°`}/><ReportRow k="Period" v={`${formatNumber(summary.period/60,3)} min`}/><ReportRow k="Perigee" v={`${formatNumber(summary.rp-EARTH_RADIUS,1)} km`}/><ReportRow k="Apogee" v={`${formatNumber(summary.ra-EARTH_RADIUS,1)} km`}/></Card>
      <Card title="Mission geometry" icon={<Target size={16}/>}><ReportRow k="Footprint radius" v={`${formatNumber(geometry.footprintRadiusKm,1)} km`}/><ReportRow k="48 h revisit estimate" v={`${formatNumber(geometry.revisitDays,2)} days`}/><ReportRow k="FOV" v={`${payload.fovDeg}°`}/></Card>
      <Card title="Spacecraft" icon={<Satellite size={16}/>}><ReportRow k="Wet mass" v={`${formatNumber(verification.massKg,2)} kg`}/><ReportRow k="Usable battery" v={`${formatNumber(verification.power.usableBatteryWh,1)} Wh`}/><ReportRow k="Propellant" v={`${spacecraft.propellantKg} kg`}/><ReportRow k="Downlink" v={`${spacecraft.downlinkMbps} Mbps`}/><ReportRow k="Data margin" v={`${formatNumber(verification.comms.dataMarginGbPerDay,2)} GB/day`}/></Card>
    </div>
    <div className="prototype-banner"><b>FUNCTIONAL PROTOTYPE</b><span>Educational preliminary mission-design software. Not flight-certified engineering software.</span></div><div className="report-disclaimer"><b>MODEL FIDELITY & ASSUMPTIONS</b><p>Keplerian propagation omits J2, drag, SRP and third-body gravity. Geometry is sampled over 48 h. Power, thermal, communications, ADCS and optical GSD are preliminary engineering models. Verification is requirement screening under declared assumptions, not flight certification.</p></div>
  </div>;
}

function InstructionsView(){
  const [query,setQuery]=useState('');
  const glossary=getGlossaryEntries();
  const filtered=glossary.filter(e=>[e.term,e.acronym||'',e.definition,e.calculation||'',e.why||''].join(' ').toLowerCase().includes(query.toLowerCase().trim()));
  return <div className="page">
    <PageHeader eyebrow="09 · LEARNING SYSTEM" title="How Aryaksha works." text="The operating manual and engineering dictionary. Read this before changing parameters."/>
    <div className="instruction-grid">
      <Card title="What this software is" icon={<BookOpen size={17}/>}>
        <div className="prototype-banner"><b>FUNCTIONAL PROTOTYPE</b><span>Results support learning, concept studies and trade analysis. They are not flight-certified.</span></div>
        <div className="instruction-copy"><p><b>Aryaksha is a functional prototype for preliminary spacecraft mission design.</b> It connects mission requirements, payload characteristics, spacecraft budgets, orbital mechanics, simulation, subsystem analysis and verification through one shared spacecraft model.</p><p>When you change an input, dependent engineering quantities are recalculated. The purpose is to teach why a design works, where it fails and which trade-offs caused the result.</p></div>
      </Card>
      <Card title="The one mathematical source of truth" icon={<Cpu size={17}/>}><Flow items={['Mission requirements','Payload + spacecraft inputs','Orbit state','Physics calculations','Simulation state','Subsystem analyses','Verification + report']}/><div className="callout"><Info size={15}/><span><b>Traceability rule:</b> animation, telemetry and engineering views consume the same underlying model state.</span></div></Card>
    </div>
    <Card title="Student workflow - use the laboratory in this order" icon={<ArrowRight size={17}/>}><div className="instruction-steps">{[
      ['01','Mission','Define objective, target, revisit, lifetime, elevation and mass constraints.'],
      ['02','Payload','Enter mass, power, data rate, FOV, ground resolution and duty cycle.'],
      ['03','Spacecraft','Configure preliminary mass, power, battery, communications, propulsion, ADCS and thermal parameters.'],
      ['04','Orbit & Maneuver','Edit classical orbital elements and compare target-orbit ΔV with available propulsion.'],
      ['05','Simulation','Run the propagated state and inspect altitude, position, velocity and WGS84 coordinates.'],
      ['06','Engineering Analysis','Inspect mission geometry, ADCS, propulsion, power, thermal and communications consequences.'],
      ['07','Verification','Read each requirement beside its calculated value and limit. Investigate every FAIL.'],
      ['08','Design Report','Export inputs, key results, verification status and model-fidelity assumptions.']
    ].map(([n,t,b])=><div className="instruction-step" key={n}><b>{n}</b><div><strong>{t}</strong><span>{b}</span></div></div>)}</div></Card>
    <div className="instruction-grid">
      <Card title="Where the calculations happen" icon={<Layers3 size={17}/>}><div className="architecture-list">
        <div><b>Orbit engine</b><span>Propagates the two-body Keplerian state and derives period, velocity, energy and angular momentum.</span></div>
        <div><b>Coordinate chain</b><span>Transforms ECI to Earth-fixed coordinates and then to WGS84 latitude, longitude and altitude.</span></div>
        <div><b>Mission geometry</b><span>Uses propagated ground position, target coordinates and payload FOV for footprint and sampled access/revisit.</span></div>
        <div><b>Subsystem models</b><span>Use shared mission, payload, spacecraft and orbit inputs for preliminary ADCS, propulsion, power, thermal and communications results.</span></div>
        <div><b>Verification layer</b><span>Compares modeled values with explicit requirements and reports PASS/FAIL without hiding failures.</span></div>
      </div></Card>
      <Card title="Model fidelity: what the numbers claim" icon={<TriangleAlert size={17}/>}><div className="fidelity-table">
        <div><b>Orbit</b><span>Two-body Keplerian. No J2, drag, SRP or third-body gravity.</span><em>Baseline</em></div>
        <div><b>Geometry</b><span>Sampled access/revisit using target and FOV footprint geometry.</span><em>Preliminary</em></div>
        <div><b>Propulsion</b><span>Ideal Tsiolkovsky ΔV with constant Isp/thrust assumptions.</span><em>Preliminary</em></div>
        <div><b>ADCS</b><span>Simplified inertia, pointing and settling-time torque estimate.</span><em>Preliminary</em></div>
        <div><b>Power</b><span>First-order solar generation and eclipse energy balance.</span><em>Preliminary</em></div>
        <div><b>Thermal</b><span>Lumped-node radiative equilibrium estimate.</span><em>Preliminary</em></div>
        <div><b>Communications</b><span>Free-space link budget with scalar gains and assumed range.</span><em>Preliminary</em></div>
      </div></Card>
    </div>
    <Card title={`Engineering dictionary · ${filtered.length} terms`} icon={<Search size={17}/>}><div className="glossary-search"><Search size={15}/><input aria-label="Search engineering definitions" placeholder="Search acronym, keyword or calculation…" value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="glossary-grid">{filtered.map(e=><GlossaryRow key={e.term} entry={e}/>)}</div></Card>
  </div>;
}
function GlossaryRow({entry}:{entry:GlossaryEntry}){return <div className="glossary-row"><div className="glossary-term"><b>{entry.term}</b>{entry.acronym&&<small>{entry.acronym}</small>}</div><p>{entry.definition}</p>{entry.calculation&&<div><small>CALCULATION</small><span>{entry.calculation}</span></div>}{entry.why&&<div><small>WHY IT MATTERS</small><span>{entry.why}</span></div>}<div className="glossary-meta"><span>{entry.units||'N/A'}</span><span>{entry.fidelity||'Engineering definition'}</span></div></div>}
function HelpTip({label}:{label:string}){const entry=getGlossaryEntry(label);if(!entry)return null;return <span className="help-tip"><button type="button" aria-label={`Explain ${entry.term}`}><CircleHelp size={11}/></button><span className="help-popover"><strong>{entry.term}{entry.acronym?` · ${entry.acronym}`:''}</strong><span>{entry.definition}</span>{entry.calculation&&<small>{entry.calculation}</small>}</span></span>}

function ContextCoach({ view }: { view: View }) {
  type CoachTarget = { element: HTMLElement; label: string; rect: DOMRect } | null;
  const [manual, setManual] = useState<GlossaryEntry | null>(null);
  const [target, setTarget] = useState<CoachTarget>(null);
  const [position, setPosition] = useState({ left: 16, top: 16, above: true });
  const closeTimer = useRef<number | null>(null);
  const active = manual || contextEntry(target?.label || null, view);

  useEffect(() => {
    setManual(null);
    setTarget(null);
  }, [view]);

  useEffect(() => {
    const clearClose = () => {
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
    };
    const closeSoon = () => {
      clearClose();
      closeTimer.current = window.setTimeout(() => setTarget(null), 140);
    };
    const pointAt = (source: HTMLElement) => {
      const label = source.dataset.contextLabel || source.getAttribute('aria-label') || '';
      if (!label) return;
      clearClose();
      setTarget({ element: source, label, rect: source.getBoundingClientRect() });
    };
    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const targetNode = event.target as HTMLElement | null;
      if (!targetNode || targetNode.closest('.context-coach')) return;
      const source = targetNode.closest('[data-context-label]') as HTMLElement | null;
      if (source) pointAt(source);
      else closeSoon();
    };
    const onPointerOut = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const source = (event.target as HTMLElement | null)?.closest('[data-context-label]');
      const next = event.relatedTarget as HTMLElement | null;
      if (source && next && source.contains(next)) return;
      if (next?.closest('.context-coach')) return;
      closeSoon();
    };
    const onFocus = (event: FocusEvent) => {
      const source = (event.target as HTMLElement | null)?.closest('[data-context-label]') as HTMLElement | null;
      if (source) pointAt(source);
    };
    const onResize = () => {
      setTarget(current => current?.element.isConnected ? { ...current, rect: current.element.getBoundingClientRect() } : null);
    };

    document.addEventListener('pointerover', onPointerOver);
    document.addEventListener('pointerout', onPointerOut);
    document.addEventListener('focusin', onFocus);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      clearClose();
      document.removeEventListener('pointerover', onPointerOver);
      document.removeEventListener('pointerout', onPointerOut);
      document.removeEventListener('focusin', onFocus);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, []);

  useEffect(() => {
    if (!target?.element) return;
    target.element.classList.add('coach-pointed');
    return () => target.element.classList.remove('coach-pointed');
  }, [target?.element]);

  useEffect(() => {
    if (!target?.rect) return;
    const margin = 14;
    const width = Math.min(390, window.innerWidth - margin * 2);
    const estimatedHeight = Math.min(420, Math.max(250, window.innerHeight * 0.52));
    const above = target.rect.top > estimatedHeight + 24;
    const rawLeft = target.rect.left + target.rect.width / 2 - width / 2;
    const left = Math.max(margin, Math.min(rawLeft, window.innerWidth - width - margin));
    const top = above
      ? Math.max(margin, target.rect.top - 10)
      : Math.min(window.innerHeight - margin, target.rect.bottom + 10);
    setPosition({ left, top, above });
  }, [target?.rect]);

  if (!active) return null;

  const pinCurrent = () => setManual(current => current ? null : active);

  return (
    <aside
      className={`context-coach is-open ${position.above ? 'coach-above' : 'coach-below'}`}
      style={{ left: position.left, top: position.top }}
      aria-label="On-board tutor"
    >
      <div className="coach-connector" aria-hidden="true" />
      <div className="coach-head">
        <div>
          <span className="coach-kicker">ON-BOARD TUTOR</span>
          <strong>Context Coach</strong>
        </div>
        <button className="coach-toggle" onClick={pinCurrent} aria-label={manual ? 'Unpin guidance' : 'Pin guidance'}>
          {manual ? '−' : '+'}
        </button>
      </div>
      <div className="coach-body">
        <div className="coach-location">
          <span className="coach-dot" />
          <span>{nav.find(item => item.id === view)?.label || 'Aryaksha'}</span>
          <small>{manual ? 'PINNED' : `POINTING AT: ${target?.label || ''}`}</small>
        </div>
        <div className="coach-title">
          <b>{active.term}</b>
          {active.acronym && <span>{active.acronym}</span>}
        </div>
        <p>{active.definition}</p>
        {active.calculation && <div className="coach-section"><small>HOW IT WORKS</small><span>{active.calculation}</span></div>}
        {active.why && <div className="coach-section"><small>WHY IT MATTERS</small><span>{active.why}</span></div>}
        <div className="coach-meta">
          <span>{active.units || 'N/A'}</span>
          <span>{active.fidelity || 'Engineering guidance'}</span>
        </div>
        <div className="coach-actions">
          <button onClick={() => setManual(contextEntry('Model Fidelity', view))}>Model assumptions</button>
          <button onClick={() => setManual(contextEntry('State Vector', view))}>Source of truth</button>
        </div>
      </div>
    </aside>
  );
}

const coachLabelAliases: Record<string, string> = {
  'Mission requirements': 'Mission definition',
  'Mission name': 'Mission definition',
  'Mission type': 'Mission definition',
  'Target / Region': 'Target region',
  'Mission lifetime': 'Mission lifetime',
  'Min elevation': 'Minimum Elevation',
  'Max mass': 'Mass constraint',
  'Launch site': 'Launch site',
  'Payload definition': 'Payload definition',
  'Payload name': 'Payload definition',
  'Mass': 'Payload mass',
  'Power': 'Payload power',
  'Data rate': 'OBDH',
  'Field of View': 'FOV',
  'Ground Resolution': 'Ground Resolution',
  'Duty Cycle': 'Payload duty cycle',
  'Focal Length': 'Focal length',
  'Detector Pitch': 'Detector pitch',
  'Average data generation': 'OBDH',
  'Data generated / day': 'OBDH',
  'Computed footprint': 'Footprint',
  'Pointing relevance': 'Pointing Accuracy',
  'Spacecraft configuration': 'Spacecraft configuration',
  'Dry Mass': 'Dry Mass',
  'Solar Panel Area': 'Power Budget',
  'Solar Efficiency': 'Power Budget',
  'Battery': 'Battery State',
  'Base Power': 'EPS',
  'Data Storage': 'OBDH',
  'TX Power': 'Communications Link Budget',
  'Frequency': 'Communications Link Budget',
  'Bandwidth': 'Bandwidth',
  'Downlink Rate': 'Communications Link Budget',
  'TX Gain': 'Gain',
  'RX Gain': 'Gain',
  'Propulsion configuration': 'Propulsion',
  'Thrust': 'Thrust',
  'ISP': 'Isp',
  'Propellant': 'Propellant',
  'Pointing Accuracy': 'Pointing Accuracy',
  'Settling Time': 'Settling Time',
  'Inertia X / Y / Z': 'Moment of Inertia',
  'Inertia X': 'Moment of Inertia',
  'Inertia Y': 'Moment of Inertia',
  'Inertia Z': 'Moment of Inertia',
  'Thermal configuration': 'Thermal configuration',
  'Thermal Area': 'Thermal Balance',
  'Absorptivity': 'Absorptivity',
  'Emissivity': 'Emissivity',
  'Battery Efficiency': 'Battery State',
  'Battery DoD': 'Battery State',
  'Solar EOL Degradation': 'Power Budget',
  'Thermal Hot Factor': 'Thermal Balance',
  'Thermal Cold Factor': 'Thermal Balance',
  'Orbit definition': 'Orbit & maneuver design',
  'Altitude': 'Altitude',
  'Eccentricity': 'Eccentricity',
  'Inclination': 'Inclination',
  'RAAN': 'RAAN',
  'Argument of Perigee': 'Argument of Perigee',
  'True Anomaly': 'True Anomaly',
  'Target Altitude': 'Altitude',
  'Target Inclination': 'Inclination',
  'Estimated Maneuver ΔV': 'ΔV',
  'Plane Change': 'Plane Change',
  'Available ΔV': 'ΔV',
  'Burn time': 'Burn time',
  'Time': 'Epoch',
  'Latitude': 'WGS84',
  'Longitude': 'WGS84',
  'Speed': 'Orbital Velocity',
  'ECI X': 'ECI',
  'ECI Y': 'ECI',
  'ECI Z': 'ECI',
  'VX / VY / VZ': 'State Vector',
  'Required torque': 'ADCS',
  'Actuator margin': 'ADCS',
  'Pointing margin': 'Pointing Accuracy',
  'Generation': 'Power Budget',
  'Average load': 'EPS',
  'Battery reserve': 'Battery State',
  'Eclipse': 'Eclipse',
  'Nominal temp': 'Thermal Balance',
  'Hot / cold': 'Thermal Balance',
  'Hot margin': 'Thermal Balance',
  'Link margin': 'Link Margin',
  'Daily capacity': 'Communications Link Budget',
  'Data margin': 'OBDH',
  'Model Fidelity': 'Model Fidelity',
  'State Vector': 'State Vector'
};

function contextEntry(label: string | null, view: View): GlossaryEntry | null {
  if (label) {
    const direct = getGlossaryEntry(label);
    if (direct) return direct;
    const mapped = coachLabelAliases[label];
    if (mapped) {
      const mappedEntry = getGlossaryEntry(mapped);
      if (mappedEntry) return mappedEntry;
    }
  }

  const page = nav.find(item => item.id === view);
  const pageMap: Record<string, GlossaryEntry> = {
    Mission: { term: 'Mission definition', definition: 'Defines what the spacecraft must accomplish. These requirements drive payload, orbit and spacecraft trades.', calculation: 'Mission requirements are inputs to the coupled geometry, resource and verification models.', why: 'Requirements establish what the spacecraft must achieve before an orbit or subsystem is selected.', fidelity: 'System-level requirements model.' },
    Payload: { term: 'Payload definition', definition: 'Defines the instrument that produces the mission data, including mass, power, data generation and optical parameters.', calculation: 'Payload parameters feed GSD, footprint, data generation, power demand and ADCS pointing checks.', why: 'The payload is the source of mission value and drives several spacecraft resources.', fidelity: 'Preliminary payload model.' },
    Spacecraft: { term: 'Spacecraft configuration', definition: 'Defines the vehicle mass, power, propulsion, attitude, thermal and communications assumptions used by the analysis.', calculation: 'Subsystem parameters are consumed by the shared engineering model and verification checks.', why: 'Spacecraft resources determine whether the mission can actually support its payload and orbit.', fidelity: 'Preliminary subsystem model.' },
    'Orbit & Maneuver': { term: 'Orbit & maneuver design', definition: 'Defines the orbital state and estimates the idealized velocity change required for a target orbit.', calculation: 'Orbital elements define the propagated state; maneuver estimates use two-body transfer and plane-change equations.', why: 'Orbit affects period, coverage, access, lighting and downstream subsystem constraints.', fidelity: 'Two-body Keplerian propagation + analytical maneuver estimate.' },
    Simulation: { term: 'Simulation workspace', definition: 'Propagates the spacecraft state through time and exposes that same state to the globe and telemetry.', calculation: 'The propagator produces position and velocity, then converts the state to Earth-fixed geographic coordinates.', why: 'The visualization and telemetry should always represent the same mathematical state.', fidelity: 'Two-body Keplerian model; perturbations are not included.' },
    'Engineering Analysis': { term: 'Engineering analysis', definition: 'Evaluates mission geometry and coupled subsystem budgets from the current design inputs.', calculation: 'ADCS, power, thermal, communications, propulsion and payload checks consume shared model inputs.', why: 'A coupled model exposes design consequences instead of isolated calculator results.', fidelity: 'Mixed analytical and preliminary subsystem models.' },
    Verification: { term: 'Verification', acronym: 'V&V', definition: 'Compares calculated quantities against explicit requirements or engineering limits.', calculation: 'Each check applies a declared pass/fail inequality to a calculated value.', why: 'Verification makes the design decision traceable and exposes failures that need investigation.', fidelity: 'Preliminary requirement screening.' },
    'Design Report': { term: 'Design report', definition: 'Packages the current requirements, inputs, derived results, assumptions and verification status.', calculation: 'Report values are read from the same shared model used by simulation and analysis.', why: 'Traceability makes a design study reproducible and reviewable.', fidelity: 'Study/report output; not flight certification.' },
    'Instructions & Glossary': { term: 'On-board tutor & glossary', definition: 'Explains engineering terms, calculations, workflow and model limitations used throughout Orbital Lab.', calculation: 'The Coach resolves the UI item under the cursor or keyboard focus to a canonical engineering definition.', why: 'The lab teaches the reasoning behind a result rather than only displaying a number.', fidelity: 'Educational guidance layer.' },
    'Calculator & Reference': { term: 'Engineering calculator & reference', definition: 'Provides local calculations and reference material for independently checking engineering quantities.', calculation: 'Calculator outputs are independent checks; the simulation state remains the source of truth for propagated spacecraft state.', why: 'Independent reproduction is a core engineering practice.', fidelity: 'Educational reference tool.' }
  };
  return (page && pageMap[page.label]) || {
    term: label || 'Orbital Lab',
    definition: 'This item is part of the current mission-design workflow. Move over a labeled engineering field or result to see its canonical definition and calculation basis.',
    calculation: 'The Coach uses the same engineering glossary and shared model used by the application.',
    why: 'Context is provided so the displayed result can be interpreted before making a design decision.',
    fidelity: 'Educational guidance layer.'
  };
}
function ToolsView() {
  return <div className="page"><PageHeader eyebrow="09 · TOOLS" title="Engineering tools without leaving the lab." text="Use the calculator to reproduce a number from the simulation. This is intentionally local and API-free." /><div className="tools-grid"><ScientificCalculator /><Card title="Reference model chain" icon={<Cpu size={17}/>}><Flow items={['Requirements','Inputs','Physics model','State vector','Derived quantities','Verification']} /><div className="reference-list"><p><b>Keplerian:</b> transparent two-body propagation.</p><p><b>SGP4:</b> available in the preserved tracking engine for TLE-based satellite analysis.</p><p><b>Coordinates:</b> ECI → ECEF → WGS84 latitude/longitude/altitude.</p><p><b>Traceability:</b> animation and result sheets should read from the same propagated state.</p></div></Card></div></div>;
}

function Card({ title, icon, children }: { title:string; icon:React.ReactNode; children:React.ReactNode }) { return <section data-context-label={title} className="card"><div className="card-head"><span>{icon}</span><b>{title}</b></div>{children}</section>; }
function Field({ label, value, unit, type='text', onChange }: { label:string; value:string|number; unit?:string; type?:string; onChange:(v:string)=>void }) { return <label data-context-label={label} className="field"><span><span className="field-label">{label}<HelpTip label={label} /></span><em>{unit || ''}</em></span><input type={type} value={value} onChange={e=>onChange(e.target.value)} /></label>; }
function SelectField({ label, value, options, onChange }: { label:string; value:string; options:string[]; onChange:(v:string)=>void }) { return <label data-context-label={label} className="field"><span><span className="field-label">{label}<HelpTip label={label} /></span></span><select value={value} onChange={e=>onChange(e.target.value)}>{options.map(x=><option key={x}>{x}</option>)}</select></label>; }
function Stat({ label, value }: { label:string; value:string }) { return <div data-context-label={label} className="stat-row"><span className="result-label">{label}<HelpTip label={label} /></span><b>{value}</b></div>; }
function Flow({ items }: { items:string[] }) { return <div data-context-label={items.join(' → ')} className="flow">{items.map((item,i)=><div key={item}><span>{String(i+1).padStart(2,'0')}</span><b>{item}</b>{i<items.length-1&&<ArrowRight size={13}/>}</div>)}</div>; }
function Telemetry({ label, value }: { label:string; value:string }) { return <div data-context-label={label} className="telemetry"><small className="result-label">{label}<HelpTip label={label} /></small><b>{value}</b></div>; }
function ReportRow({ k, v }: { k:string; v:string }) { return <div data-context-label={k} className="report-row"><span className="result-label">{k}<HelpTip label={k} /></span><b>{v}</b></div>; }

export default App;
