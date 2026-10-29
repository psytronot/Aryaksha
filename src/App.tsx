import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowRight, Battery, BookOpen, Calculator, Check, CircleHelp, Cpu, Download,
  Gauge, Globe2, Info, Layers3, Orbit, Pause, Play, Radio, RefreshCw, Rocket,
  Satellite, Search, Settings2, Target, Thermometer, TriangleAlert, Wrench, Zap
} from 'lucide-react';
import Earth3DScene from './Earth3DScene';
import AryakshaMark from './AryakshaMark';
import ScientificCalculator from './ScientificCalculator';
import SatelliteTrackingView from './SatelliteTrackingView';
import MissionAnalysisView from './MissionAnalysisView';
import { EARTH_RADIUS, Elements, orbitalSummary, propagateState, sampleOrbit, stateToLla } from './orbit';
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
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => { setView('mission'); setMobileNavOpen(false); }}>
          <span className="brand-mark"><AryakshaMark size={34} /></span>
          <span><strong>ARYAKSHA</strong><small>SPACE EXPLORATION LAB</small></span>
        </button>
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
      <div className="shell">
        {mobileNavOpen && <div className="mobile-nav-backdrop" onClick={() => setMobileNavOpen(false)} />}
        <aside className={mobileNavOpen ? 'sidebar mobile-open' : 'sidebar'}>
          <div className="side-title">SPACECRAFT DESIGN</div>
          {['DESIGN','RUN','OUTPUT','LEARN','TOOLS'].map(group => (