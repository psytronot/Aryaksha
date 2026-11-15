import { useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, Orbit, Play, Satellite } from 'lucide-react';
import { EARTH_RADIUS, MU } from './orbit';
import { propagateCw, solveTwoImpulseRendezvous, type RelativeState } from './rpod';

type ScenarioInput = {
  chiefAltitudeKm: string;
  xKm: string;
  yKm: string;
  zKm: string;
  vxKmS: string;
  vyKmS: string;
  vzKmS: string;
  rendezvousMinutes: string;
};

const initialScenario: ScenarioInput = {
  chiefAltitudeKm: '550',
  xKm: '0.1',
  yKm: '-0.2',
  zKm: '0.05',
  vxKmS: '0.0001',
  vyKmS: '0.0002',
  vzKmS: '-0.00005',
  rendezvousMinutes: '30',
};

const numberValue = (value: string, label: string): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a finite number.`);
  return parsed;
};

const fixed = (value: number, digits = 6): string => value.toFixed(digits);

export default function RpodView() {
  const [input, setInput] = useState<ScenarioInput>(initialScenario);
  const [result, setResult] = useState<{
    meanMotionRadS: number;
    rendezvousTimeSeconds: number;
    departureDeltaVKmS: [number, number, number];
    arrivalDeltaVKmS: [number, number, number];
    departureDeltaVMagnitudeMps: number;
    arrivalDeltaVMagnitudeMps: number;
    totalDeltaVMagnitudeMps: number;
    terminal: RelativeState;
  } | null>(null);
  const [error, setError] = useState('');
  const [orekitLoading, setOrekitLoading] = useState(false);
  const [orekitError, setOrekitError] = useState('');
  const [orekitCheck, setOrekitCheck] = useState<{
    positionKm: number[];
    velocityKmS: number[];
    positionDifferenceM: number;
    velocityDifferenceMmS: number;
    epoch: string;
  } | null>(null);

  const update = (key: keyof ScenarioInput, value: string) => {
    setInput(current => ({ ...current, [key]: value }));
    setResult(null);
    setOrekitCheck(null);
    setOrekitError('');
  };

  const defaultMeanMotion = useMemo(() => {
    const altitude = Number(input.chiefAltitudeKm);
    if (!Number.isFinite(altitude) || altitude <= -EARTH_RADIUS) return null;
    return Math.sqrt(MU / (EARTH_RADIUS + altitude) ** 3);
  }, [input.chiefAltitudeKm]);

  const crossCheckWithOrekit = async () => {
    setOrekitLoading(true);
    setOrekitError('');
    setOrekitCheck(null);
    try {
      const altitude = numberValue(input.chiefAltitudeKm, 'Chief altitude');
      const rendezvousMinutes = numberValue(input.rendezvousMinutes, 'Rendezvous time');
      if (altitude <= 0 || rendezvousMinutes <= 0) throw new Error('Altitude and rendezvous time must be positive.');
      const radiusKm = EARTH_RADIUS + altitude;
      const meanMotion = Math.sqrt(MU / radiusKm ** 3);
      const targetPositionKm: [number, number, number] = [radiusKm, 0, 0];
      const targetVelocityKmS: [number, number, number] = [0, Math.sqrt(MU / radiusKm), 0];
      const relativePosition: [number, number, number] = [
        numberValue(input.xKm, 'Radial separation'),
        numberValue(input.yKm, 'Along-track separation'),
        numberValue(input.zKm, 'Cross-track separation'),
      ];
      const relativeVelocity: [number, number, number] = [
        numberValue(input.vxKmS, 'Radial relative velocity'),
        numberValue(input.vyKmS, 'Along-track relative velocity'),
        numberValue(input.vzKmS, 'Cross-track relative velocity'),
      ];
      const chaserPositionKm: [number, number, number] = [
        targetPositionKm[0] + relativePosition[0],
        targetPositionKm[1] + relativePosition[1],
        targetPositionKm[2] + relativePosition[2],
      ];
      const chaserVelocityKmS: [number, number, number] = [
        targetVelocityKmS[0] - meanMotion * relativePosition[1] + relativeVelocity[0],
        targetVelocityKmS[1] + meanMotion * relativePosition[0] + relativeVelocity[1],
        targetVelocityKmS[2] + relativeVelocity[2],
      ];
      const elapsedSeconds = rendezvousMinutes * 60;
      const response = await fetch('/api/rpod/relative-state', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          target: { positionKm: targetPositionKm, velocityKmS: targetVelocityKmS },
          chaser: { positionKm: chaserPositionKm, velocityKmS: chaserVelocityKmS },
          elapsedSeconds,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `Orekit request failed (HTTP ${response.status}).`);
      const orekitPosition = payload.relativeLvlh.positionKm as number[];
      const orekitVelocity = payload.relativeLvlh.velocityKmS as number[];
      const cw = propagateCw({ positionKm: relativePosition, velocityKmS: relativeVelocity }, meanMotion, elapsedSeconds);
      const norm = (values: number[]) => Math.hypot(...values);
      setOrekitCheck({
        positionKm: orekitPosition,
        velocityKmS: orekitVelocity,
        positionDifferenceM: norm(orekitPosition.map((value, index) => value - cw.positionKm[index])) * 1000,
        velocityDifferenceMmS: norm(orekitVelocity.map((value, index) => value - cw.velocityKmS[index])) * 1_000_000,
        epoch: payload.epoch,
      });
    } catch (cause) {
      setOrekitError(cause instanceof Error ? cause.message : 'Orekit cross-check failed.');
    } finally {
      setOrekitLoading(false);
    }
  };

  const runScenario = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const altitude = numberValue(input.chiefAltitudeKm, 'Chief altitude');
      const rendezvousMinutes = numberValue(input.rendezvousMinutes, 'Rendezvous time');
      if (altitude <= 0) throw new Error('Chief altitude must be above the Earth surface.');
      if (rendezvousMinutes <= 0) throw new Error('Rendezvous time must be greater than zero.');

      const meanMotionRadS = Math.sqrt(MU / (EARTH_RADIUS + altitude) ** 3);
      const rendezvousTimeSeconds = rendezvousMinutes * 60;
      const initial: RelativeState = {
        positionKm: [
          numberValue(input.xKm, 'Radial separation'),
          numberValue(input.yKm, 'Along-track separation'),
          numberValue(input.zKm, 'Cross-track separation'),
        ],
        velocityKmS: [
          numberValue(input.vxKmS, 'Radial relative velocity'),
          numberValue(input.vyKmS, 'Along-track relative velocity'),
          numberValue(input.vzKmS, 'Cross-track relative velocity'),
        ],
      };

      const solution = solveTwoImpulseRendezvous(initial, meanMotionRadS, rendezvousTimeSeconds);
      const terminal = solution.postArrivalBurnState;

      setResult({
        meanMotionRadS,
        rendezvousTimeSeconds,
        departureDeltaVKmS: solution.departureDeltaVKmS,
        arrivalDeltaVKmS: solution.arrivalDeltaVKmS,
        departureDeltaVMagnitudeMps: solution.departureDeltaVMagnitudeMps,
        arrivalDeltaVMagnitudeMps: solution.arrivalDeltaVMagnitudeMps,
        totalDeltaVMagnitudeMps: solution.totalDeltaVMagnitudeMps,
        terminal,
      });
      setError('');
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : 'Unable to solve this rendezvous scenario.');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <small>RPOD · PHASE 02 · TWO-IMPULSE CW</small>
          <h1>Design a preliminary rendezvous.</h1>
          <p>Initialize a chaser relative to a target in its LVLH frame, calculate departure and terminal velocity-matching impulses under the linear CW model.</p>
        </div>
      </div>

      <div className="orbit-layout">
        <section className="card">
          <div className="card-head"><span><Satellite size={17} /></span><b>Target orbit and chaser initial state</b></div>
          <form onSubmit={runScenario}>
            <div className="field-grid">
              <div className="field"><span><label htmlFor="rpod-chief-altitude"><span className="field-label">CHIEF ORBIT ALTITUDE</span></label><em>km</em></span><input id="rpod-chief-altitude" aria-label="Chief orbit altitude" type="number" min="1" step="any" required value={input.chiefAltitudeKm} onChange={event => update('chiefAltitudeKm', event.target.value)} /></div>
              <div className="field"><span><label htmlFor="rpod-rendezvous-time"><span className="field-label">RENDEZVOUS TIME</span></label><em>min</em></span><input id="rpod-rendezvous-time" aria-label="Rendezvous time" type="number" min="0.001" step="any" required value={input.rendezvousMinutes} onChange={event => update('rendezvousMinutes', event.target.value)} /></div>
              <div className="field"><span><label htmlFor="rpod-x"><span className="field-label">RADIAL SEPARATION</span></label><em>km</em></span><input id="rpod-x" aria-label="Radial separation" type="number" step="any" required value={input.xKm} onChange={event => update('xKm', event.target.value)} /></div>
              <div className="field"><span><label htmlFor="rpod-y"><span className="field-label">ALONG-TRACK SEPARATION</span></label><em>km</em></span><input id="rpod-y" aria-label="Along-track separation" type="number" step="any" required value={input.yKm} onChange={event => update('yKm', event.target.value)} /></div>
              <div className="field"><span><label htmlFor="rpod-z"><span className="field-label">CROSS-TRACK SEPARATION</span></label><em>km</em></span><input id="rpod-z" aria-label="Cross-track separation" type="number" step="any" required value={input.zKm} onChange={event => update('zKm', event.target.value)} /></div>
              <div className="field"><span><label htmlFor="rpod-vx"><span className="field-label">RADIAL RELATIVE VELOCITY</span></label><em>km/s</em></span><input id="rpod-vx" aria-label="Radial relative velocity" type="number" step="any" required value={input.vxKmS} onChange={event => update('vxKmS', event.target.value)} /></div>
              <div className="field"><span><label htmlFor="rpod-vy"><span className="field-label">ALONG-TRACK RELATIVE VELOCITY</span></label><em>km/s</em></span><input id="rpod-vy" aria-label="Along-track relative velocity" type="number" step="any" required value={input.vyKmS} onChange={event => update('vyKmS', event.target.value)} /></div>
              <div className="field"><span><label htmlFor="rpod-vz"><span className="field-label">CROSS-TRACK RELATIVE VELOCITY</span></label><em>km/s</em></span><input id="rpod-vz" aria-label="Cross-track relative velocity" type="number" step="any" required value={input.vzKmS} onChange={event => update('vzKmS', event.target.value)} /></div>
            </div>
            <button className="primary wide" type="submit"><Play size={15} /> Solve two-impulse rendezvous</button>
          </form>
          <div className="callout"><Orbit size={15} /><span>LVLH convention: +R radial outward, +T along-track, +N orbit-normal. Relative velocity is expressed in the rotating LVLH frame.</span></div>
          {error && <div className="callout"><AlertTriangle size={15} /><span>{error}</span></div>}
        </section>

        <section className="card">
          <div className="card-head"><span><Orbit size={17} /></span><b>Rendezvous solution</b></div>
          {!result ? (
            <div className="empty-state"><p>Run the scenario to calculate departure and arrival impulses and the predicted terminal relative state.</p></div>
          ) : (
            <>
              <div className="metric-big"><b>{fixed(result.totalDeltaVMagnitudeMps, 4)}</b><span>m/s · total ideal impulsive Δv</span></div>
              <div className="state-card">
                <div><small>ΔV RADIAL</small><b>{fixed(result.departureDeltaVKmS[0], 8)} km/s</b></div>
                <div><small>ΔV ALONG-TRACK</small><b>{fixed(result.departureDeltaVKmS[1], 8)} km/s</b></div>
                <div><small>ΔV CROSS-TRACK</small><b>{fixed(result.departureDeltaVKmS[2], 8)} km/s</b></div>
              </div>
              <div className="state-card">
                <div><small>ARRIVAL ΔV RADIAL</small><b>{fixed(result.arrivalDeltaVKmS[0], 8)} km/s</b></div>
                <div><small>ARRIVAL ΔV ALONG-TRACK</small><b>{fixed(result.arrivalDeltaVKmS[1], 8)} km/s</b></div>
                <div><small>ARRIVAL ΔV CROSS-TRACK</small><b>{fixed(result.arrivalDeltaVKmS[2], 8)} km/s</b></div>
              </div>
              <div className="result-list">
                <div className="stat-row"><span className="result-label">Departure impulse</span><b>{fixed(result.departureDeltaVMagnitudeMps, 4)} m/s</b></div>
                <div className="stat-row"><span className="result-label">Arrival velocity match</span><b>{fixed(result.arrivalDeltaVMagnitudeMps, 4)} m/s</b></div>
                <div className="stat-row"><span className="result-label">Chief mean motion</span><b>{fixed(result.meanMotionRadS, 9)} rad/s</b></div>
                <div className="stat-row"><span className="result-label">Rendezvous time</span><b>{fixed(result.rendezvousTimeSeconds, 2)} s</b></div>
                <div className="stat-row"><span className="result-label">Terminal radial position</span><b>{fixed(result.terminal.positionKm[0], 9)} km</b></div>
                <div className="stat-row"><span className="result-label">Terminal along-track position</span><b>{fixed(result.terminal.positionKm[1], 9)} km</b></div>
                <div className="stat-row"><span className="result-label">Terminal cross-track position</span><b>{fixed(result.terminal.positionKm[2], 9)} km</b></div>
                <div className="stat-row"><span className="result-label">Terminal relative speed after arrival burn</span><b>{fixed(Math.hypot(...result.terminal.velocityKmS) * 1000, 4)} m/s</b></div>
              </div>
              <div className="callout"><AlertTriangle size={15} /><span>The arrival impulse mathematically cancels terminal relative velocity at the same epoch as position coincidence. This is not a safe approach or docking guidance solution.</span></div>
              <div className="callout"><Orbit size={15} /><span>Orekit cross-check creates a synthetic circular equatorial chief orbit in EME2000 at J2000 TAI, converts the entered LVLH state to inertial Cartesian states, and independently propagates target and chaser. This is a model comparison case, not an arbitrary mission-orbit import.</span></div>
              <button className="primary wide" type="button" onClick={crossCheckWithOrekit} disabled={orekitLoading}>
                {orekitLoading ? 'Propagating both spacecraft with Orekit…' : 'Cross-check initial propagation (no burns) against Orekit'}
              </button>
              {orekitError && <div className="callout"><AlertTriangle size={15} /><span>{orekitError}</span></div>}
              {orekitCheck && <div className="result-list">
                <div className="stat-row"><span className="result-label">Orekit vs HCW position difference</span><b>{fixed(orekitCheck.positionDifferenceM, 4)} m</b></div>
                <div className="stat-row"><span className="result-label">Orekit vs HCW velocity difference</span><b>{fixed(orekitCheck.velocityDifferenceMmS, 4)} mm/s</b></div>
                <div className="stat-row"><span className="result-label">Orekit propagated LVLH position</span><b>{orekitCheck.positionKm.map(value => fixed(value, 8)).join(', ')} km</b></div>
                <div className="stat-row"><span className="result-label">Orekit propagated LVLH velocity</span><b>{orekitCheck.velocityKmS.map(value => fixed(value, 10)).join(', ')} km/s</b></div>
                <div className="stat-row"><span className="result-label">Orekit epoch (TAI)</span><b>{orekitCheck.epoch}</b></div>
              </div>}
            </>
          )}
          <div className="callout"><AlertTriangle size={15} /><span>HCW assumes a circular chief orbit, constant mean motion and small relative separation. No perturbations, finite burns, navigation uncertainty, collision screening, keep-out zone or approach corridor are modelled.</span></div>
          {defaultMeanMotion !== null && <div className="bottom-bar"><b>Reference mean motion: {fixed(defaultMeanMotion, 9)} rad/s</b><span>Two-body circular orbit</span></div>}
        </section>
      </div>
    </div>
  );
}
