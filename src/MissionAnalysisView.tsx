import { useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Cpu, Orbit, RefreshCw } from 'lucide-react';

type Result = {
  valid: boolean; engine: string; engineVersion: string; fidelity: string; assumptions: string[];
  orbit: { altitudeKm: number; semiMajorAxisKm: number; eccentricity: number; inclinationDeg: number; periodSeconds: number; periodMinutes: number; periapsisAltitudeKm: number; apoapsisAltitudeKm: number; circularVelocityKmS: number; specificOrbitalEnergyKm2S2: number };
  comparison: { engineAdapter: string; status: string; note: string };
};
const panel: React.CSSProperties = { background: 'rgba(12,24,42,.76)', border: '1px solid rgba(100,180,220,.2)', borderRadius: 14, padding: 20 };
const label: React.CSSProperties = { display: 'block', color: '#91a9c4', fontSize: 11, letterSpacing: '.08em', marginBottom: 7 };
const inputStyle: React.CSSProperties = { width: '100%', background: '#081525', border: '1px solid #28435f', color: '#e6f1ff', borderRadius: 8, padding: '11px 12px', fontSize: 14 };
const buttonStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, border: 0, borderRadius: 8, padding: '11px 15px', background: 'linear-gradient(135deg,#0e7490,#2563eb)', color: 'white', fontWeight: 700, cursor: 'pointer' };

export default function MissionAnalysisView({ initialAltitudeKm = 550, initialInclinationDeg = 97.6, initialEccentricity = 0.001 }: { initialAltitudeKm?: number; initialInclinationDeg?: number; initialEccentricity?: number }) {
  const [altitudeKm, setAltitudeKm] = useState(String(Math.max(120, initialAltitudeKm)));
  const [inclinationDeg, setInclinationDeg] = useState(String(initialInclinationDeg));
  const [eccentricity, setEccentricity] = useState(String(Math.min(.8, Math.max(0, initialEccentricity))));
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const runAnalysis = async () => {
    setErrorMessage(''); setResult(null);
    const altitude = Number(altitudeKm), inclination = Number(inclinationDeg), ecc = Number(eccentricity);
    if (![altitude, inclination, ecc].every(Number.isFinite) || altitude < 120 || altitude > 100000 || inclination < 0 || inclination > 180 || ecc < 0 || ecc >= 1) {
      setErrorMessage('Enter altitude 120–100,000 km, inclination 0°–180°, and eccentricity from 0 to less than 1.'); return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/mission-analysis/orbit', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ altitudeKm: altitude, inclinationDeg: inclination, eccentricity: ecc })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || payload.message || `Mission analysis failed (HTTP ${response.status}).`);
      setResult(payload as Result);
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : 'Mission analysis service is unavailable. Try again.');
    } finally { setBusy(false); }
  };

  return <div className="page" style={{ display: 'grid', gap: 18 }}>
    <div className="page-header"><div><small>PHASE 01 · MISSION ANALYSIS FOUNDATION</small><h1>Orbital Mission Analysis</h1><p>Orbit analysis through Aryaksha’s backend, with an optional independently hosted Orekit service for numerical propagation.</p></div></div>
    <div style={{ ...panel, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 14 }}>
      <div><label style={label}>ALTITUDE ABOVE EARTH (KM)</label><input style={inputStyle} aria-label="Altitude above Earth in kilometres" type="number" min="120" max="100000" value={altitudeKm} onChange={e => setAltitudeKm(e.target.value)} /></div>
      <div><label style={label}>INCLINATION (DEG)</label><input style={inputStyle} aria-label="Orbit inclination in degrees" type="number" min="0" max="180" value={inclinationDeg} onChange={e => setInclinationDeg(e.target.value)} /></div>
      <div><label style={label}>ECCENTRICITY</label><input style={inputStyle} aria-label="Orbit eccentricity" type="number" min="0" max=".999" step=".001" value={eccentricity} onChange={e => setEccentricity(e.target.value)} /></div>
      <div style={{ display: 'flex', alignItems: 'end' }}><button style={buttonStyle} type="button" onClick={runAnalysis} disabled={busy}>{busy ? <RefreshCw size={16} /> : <Activity size={16} />}{busy ? 'Running…' : 'Run analysis'}</button></div>
    </div>
    {errorMessage && <div role="alert" style={{ ...panel, borderColor: '#b45353', color: '#fecaca', display: 'flex', gap: 10 }}><AlertTriangle size={18} /><span>{errorMessage}</span></div>}
    {result && <>
      <div style={{ ...panel, display: 'flex', gap: 12 }}><CheckCircle2 size={22} color="#34d399" /><div><strong>Analysis completed · {result.engine}</strong><p style={{ color: '#a8bdd4', marginBottom: 0 }}>{result.fidelity}. This is a two-body Keplerian baseline, not a high-fidelity mission solution.</p></div></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(165px,1fr))', gap: 12 }}>
        {[
          ['Orbital period', result.orbit.periodMinutes.toFixed(2) + ' min'],
          ['Semi-major axis', result.orbit.semiMajorAxisKm.toFixed(2) + ' km'],
          ['Periapsis altitude', result.orbit.periapsisAltitudeKm.toFixed(2) + ' km'],
          ['Apoapsis altitude', result.orbit.apoapsisAltitudeKm.toFixed(2) + ' km'],
          ['Circular velocity reference', result.orbit.circularVelocityKmS.toFixed(4) + ' km/s'],
          ['Specific orbital energy', result.orbit.specificOrbitalEnergyKm2S2.toFixed(4) + ' km²/s²']
        ].map(([name, value]) => <div key={name} style={{ ...panel, padding: 16 }}><span style={label}>{name.toUpperCase()}</span><strong style={{ fontSize: 19 }}>{value}</strong></div>)}
      </div>
      <div style={panel}><h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 9 }}><Cpu size={17} /> Engine integration status</h3><b>Current computation</b><p style={{ color: '#a8bdd4', margin: '4px 0 12px' }}>{result.comparison.note}</p><b>Orekit adapter</b><p style={{ color: '#a8bdd4', margin: '4px 0 12px' }}>{result.engine.toLowerCase().includes('orekit') ? 'Connected: this result came from the Orekit service.' : 'Adapter is ready to use an independent Orekit service when OREKIT_SERVICE_URL is configured on the Aryaksha backend.'}</p><b>GMAT / STK / FreeFlyer</b><p style={{ color: '#a8bdd4', margin: '4px 0 0' }}>GMAT, STK and FreeFlyer remain future optional adapters; their runtimes, APIs and applicable licenses must be available on their compute hosts first.</p></div>
    </>}
    {!result && !errorMessage && <div style={{ ...panel, display: 'flex', gap: 12 }}><Orbit size={20} color="#67e8f9" /><div><b>Phase 01 scope</b><p style={{ color: '#a8bdd4', marginBottom: 0 }}>Validated input → backend calculation → typed result → engine adapter status. Phase 02 can add numerical propagation, reference-case comparisons and exportable analysis runs.</p></div></div>}
    <div style={{ ...panel, display: 'flex', gap: 10 }}><AlertTriangle size={17} color="#fbbf24" /><div><b>Engineering fidelity notice</b><p style={{ color: '#a8bdd4', margin: '5px 0 0' }}>Educational preliminary analysis only. This baseline excludes J2, drag, solar radiation pressure, third-body effects, manoeuvre execution and covariance propagation. Do not use it for operational flight decisions.</p></div></div>
  </div>;
}
