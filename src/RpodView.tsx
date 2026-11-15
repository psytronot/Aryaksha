import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { AlertTriangle, Orbit, Play, Satellite } from 'lucide-react';
import { EARTH_RADIUS, MU } from './orbit';
import { propagateCw, sampleCwTrajectory, solveTwoImpulseRendezvous, screenCwKeepOut, propagateCwCovariance, type RelativeState } from './rpod';
import { parseRpodMissionState, type RpodMissionState } from './rpodMissionState';
import { serializeRpodEngineeringReport, type RpodEngineeringReport } from './rpodReport';

type ScenarioInput = {
  epochTai: string;
  chiefAltitudeKm: string;
  xKm: string;
  yKm: string;
  zKm: string;
  vxKmS: string;
  vyKmS: string;
  vzKmS: string;
  rendezvousMinutes: string;
  keepOutRadiusKm: string;
  positionSigmaM: string;
  velocitySigmaMmS: string;
};

const initialScenario: ScenarioInput = {
  epochTai: '2000-01-01T12:00:00',
  chiefAltitudeKm: '550',
  xKm: '0.1',
  yKm: '-0.2',
  zKm: '0.05',
  vxKmS: '0.0001',
  vyKmS: '0.0002',
  vzKmS: '-0.00005',
  rendezvousMinutes: '30',
  keepOutRadiusKm: '0.05',
  positionSigmaM: '10',
  velocitySigmaMmS: '1',
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
    trajectory: ReturnType<typeof sampleCwTrajectory>;
    keepOutScreen: ReturnType<typeof screenCwKeepOut>;
    terminalCovariance: number[][];
  } | null>(null);
  const [error, setError] = useState('');
  const [importedMissionState, setImportedMissionState] = useState<RpodMissionState | null>(null);
  const [importError, setImportError] = useState('');
  const [orekitLoading, setOrekitLoading] = useState(false);
  const [orekitError, setOrekitError] = useState('');
  const [orekitCheck, setOrekitCheck] = useState<{
    positionKm: number[];
    velocityKmS: number[];
    positionDifferenceM: number | null;
    velocityDifferenceMmS: number | null;
    epoch: string;
  } | null>(null);

  const importMissionState = async (event: ChangeEvent<HTMLInputElement>) => {
    const inputElement = event.currentTarget;
    const file = inputElement.files?.[0];
    if (!file) return;
    try {
      if (file.size > 64 * 1024) throw new Error('Mission-state file exceeds the 64 KiB limit.');
      const parsed = parseRpodMissionState(await file.text());
      setImportedMissionState(parsed);
      setInput(current => ({ ...current, epochTai: parsed.epochTai }));
      setImportError('');
      setOrekitCheck(null);
      setOrekitError('');
    } catch (cause) {
      setImportedMissionState(null);
      setImportError(cause instanceof Error ? cause.message : 'Unable to import mission-state file.');
    } finally {
      inputElement.value = '';
    }
  };

  const update = (key: keyof ScenarioInput, value: string) => {
    setInput(current => ({ ...current, [key]: value }));
    if (key === 'epochTai') {
      setImportedMissionState(current => current ? { ...current, epochTai: value } : current);
    }
    setResult(null);
    setOrekitCheck(null);
    setOrekitError('');
  };

  const defaultMeanMotion = useMemo(() => {
    const altitude = Number(input.chiefAltitudeKm);
    if (!Number.isFinite(altitude) || altitude <= -EARTH_RADIUS) return null;
    return Math.sqrt(MU / (EARTH_RADIUS + altitude) ** 3);
  }, [input.chiefAltitudeKm]);

  const trajectoryPlot = useMemo(() => {
    if (!result) return null;
    const extent = Math.max(
      ...result.trajectory.map(sample => Math.max(
        Math.abs(sample.state.positionKm[0]),
        Math.abs(sample.state.positionKm[1]),
      )),
      0.001,
    );
    const scale = 85 / extent;
    return result.trajectory.map(sample => {
      const x = 300 + sample.state.positionKm[0] * scale;
      const y = 110 - sample.state.positionKm[1] * scale;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');
  }, [result]);

  const crossCheckWithOrekit = async () => {
    setOrekitLoading(true);
    setOrekitError('');
    setOrekitCheck(null);
    try {
      const rendezvousMinutes = numberValue(input.rendezvousMinutes, 'Rendezvous time');
      if (rendezvousMinutes <= 0) throw new Error('Rendezvous time must be positive.');
      const elapsedSeconds = rendezvousMinutes * 60;
      let targetPositionKm: [number, number, number];
      let targetVelocityKmS: [number, number, number];
      let chaserPositionKm: [number, number, number];
      let chaserVelocityKmS: [number, number, number];
      let hcwInitialState: RelativeState | null = null;
      let hcwMeanMotion: number | null = null;

      if (importedMissionState) {
        targetPositionKm = importedMissionState.target.positionKm;
        targetVelocityKmS = importedMissionState.target.velocityKmS;
        chaserPositionKm = importedMissionState.chaser.positionKm;
        chaserVelocityKmS = importedMissionState.chaser.velocityKmS;
      } else {
        const altitude = numberValue(input.chiefAltitudeKm, 'Chief altitude');
        if (altitude <= 0) throw new Error('Chief altitude must be positive.');
        const radiusKm = EARTH_RADIUS + altitude;
        const meanMotion = Math.sqrt(MU / radiusKm ** 3);
        hcwMeanMotion = meanMotion;
        targetPositionKm = [radiusKm, 0, 0];
        targetVelocityKmS = [0, Math.sqrt(MU / radiusKm), 0];
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
        hcwInitialState = { positionKm: relativePosition, velocityKmS: relativeVelocity };
        chaserPositionKm = [
          targetPositionKm[0] + relativePosition[0],
          targetPositionKm[1] + relativePosition[1],
          targetPositionKm[2] + relativePosition[2],
        ];
        chaserVelocityKmS = [
          targetVelocityKmS[0] - meanMotion * relativePosition[1] + relativeVelocity[0],
          targetVelocityKmS[1] + meanMotion * relativePosition[0] + relativeVelocity[1],
          targetVelocityKmS[2] + relativeVelocity[2],
        ];
      }
      const response = await fetch('/api/rpod/relative-state', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          target: { positionKm: targetPositionKm, velocityKmS: targetVelocityKmS },
          chaser: { positionKm: chaserPositionKm, velocityKmS: chaserVelocityKmS },
          elapsedSeconds,
          epochTai: importedMissionState?.epochTai ?? input.epochTai.trim(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `Orekit request failed (HTTP ${response.status}).`);
      const orekitPosition = payload.relativeLvlh.positionKm as number[];
      const orekitVelocity = payload.relativeLvlh.velocityKmS as number[];
      const cw = hcwInitialState && hcwMeanMotion !== null
        ? propagateCw(hcwInitialState, hcwMeanMotion, elapsedSeconds)
        : null;
      const norm = (values: number[]) => Math.hypot(...values);
      setOrekitCheck({
        positionKm: orekitPosition,
        velocityKmS: orekitVelocity,
        positionDifferenceM: cw
          ? norm(orekitPosition.map((value, index) => value - cw.positionKm[index])) * 1000
          : null,
        velocityDifferenceMmS: cw
          ? norm(orekitVelocity.map((value, index) => value - cw.velocityKmS[index])) * 1_000_000
          : null,
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
      const postDepartureState: RelativeState = {
        positionKm: initial.positionKm,
        velocityKmS: [
          initial.velocityKmS[0] + solution.departureDeltaVKmS[0],
          initial.velocityKmS[1] + solution.departureDeltaVKmS[1],
          initial.velocityKmS[2] + solution.departureDeltaVKmS[2],
        ],
      };
      const trajectory = sampleCwTrajectory(
        postDepartureState,
        meanMotionRadS,
        rendezvousTimeSeconds,
        40,
      );
      const keepOutScreen = screenCwKeepOut(
        trajectory,
        numberValue(input.keepOutRadiusKm, 'Keep-out radius'),
      );
      const positionSigmaKm = numberValue(input.positionSigmaM, 'Position 1-sigma uncertainty') / 1000;
      const velocitySigmaKmS = numberValue(input.velocitySigmaMmS, 'Velocity 1-sigma uncertainty') / 1_000_000;
      if (positionSigmaKm < 0 || velocitySigmaKmS < 0) {
        throw new Error('Navigation uncertainty values cannot be negative.');
      }
      const initialCovariance = Array.from({ length: 6 }, (_, row) =>
        Array.from({ length: 6 }, (_, column) => row === column
          ? (row < 3 ? positionSigmaKm ** 2 : velocitySigmaKmS ** 2)
          : 0),
      );
      const terminalCovariance = propagateCwCovariance(
        initialCovariance,
        meanMotionRadS,
        rendezvousTimeSeconds,
      );

      setResult({
        meanMotionRadS,
        rendezvousTimeSeconds,
        departureDeltaVKmS: solution.departureDeltaVKmS,
        arrivalDeltaVKmS: solution.arrivalDeltaVKmS,
        departureDeltaVMagnitudeMps: solution.departureDeltaVMagnitudeMps,
        arrivalDeltaVMagnitudeMps: solution.arrivalDeltaVMagnitudeMps,
        totalDeltaVMagnitudeMps: solution.totalDeltaVMagnitudeMps,
        terminal,
        trajectory,
        keepOutScreen,
        terminalCovariance,
      });
      setError('');
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : 'Unable to solve this rendezvous scenario.');
    }
  };

  const exportEngineeringReport = () => {
    if (!result) return;
    const report: RpodEngineeringReport = {
      schema: 'aryaksha.rpod-engineering-report/v1',
      generatedAtUtc: new Date().toISOString(),
      mission: {
        epochTai: input.epochTai.trim(),
        stateSource: 'manual-lvlh',
        importedFrame: null,
      },
      model: {
        name: 'Clohessy-Wiltshire / Hill',
        chiefAltitudeKm: numberValue(input.chiefAltitudeKm, 'Chief altitude'),
        meanMotionRadS: result.meanMotionRadS,
        rendezvousTimeSeconds: result.rendezvousTimeSeconds,
        assumptions: [
          'Circular chief orbit with constant mean motion.',
          'Linearized relative motion with small separation.',
          'Two-body reference orbit; no perturbing forces.',
          'Instantaneous LVLH impulses; no finite-burn execution.',
        ],
      },
      initialRelativeState: {
        positionKm: [numberValue(input.xKm, 'Radial separation'), numberValue(input.yKm, 'Along-track separation'), numberValue(input.zKm, 'Cross-track separation')],
        velocityKmS: [numberValue(input.vxKmS, 'Radial relative velocity'), numberValue(input.vyKmS, 'Along-track relative velocity'), numberValue(input.vzKmS, 'Cross-track relative velocity')],
      },
      maneuvers: [
        { event: 'departure', elapsedSeconds: 0, deltaVKmS: result.departureDeltaVKmS, magnitudeMps: result.departureDeltaVMagnitudeMps, execution: 'instantaneous-impulse' },
        { event: 'terminal-velocity-match', elapsedSeconds: result.rendezvousTimeSeconds, deltaVKmS: result.arrivalDeltaVKmS, magnitudeMps: result.arrivalDeltaVMagnitudeMps, execution: 'instantaneous-impulse' },
      ],
      deltaVBudgetMps: {
        departure: result.departureDeltaVMagnitudeMps,
        terminal: result.arrivalDeltaVMagnitudeMps,
        total: result.totalDeltaVMagnitudeMps,
      },
      terminalStateAfterArrivalImpulse: {
        positionKm: result.terminal.positionKm,
        velocityKmS: result.terminal.velocityKmS,
      },
      trajectory: result.trajectory.map(sample => ({
        elapsedSeconds: sample.elapsedSeconds,
        positionKm: sample.state.positionKm,
        velocityKmS: sample.state.velocityKmS,
      })),
      keepOutScreen: {
        method: 'sampled-pre-terminal-spherical-range',
        keepOutRadiusKm: result.keepOutScreen.keepOutRadiusKm,
        minimumPreTerminalRangeKm: result.keepOutScreen.minimumPreTerminalRangeKm,
        closestElapsedSeconds: result.keepOutScreen.closestElapsedSeconds,
        enteredKeepOut: result.keepOutScreen.enteredKeepOut,
        terminalCoincidenceExcluded: true,
      },
      uncertainty: {
        initialPositionSigmaM: numberValue(input.positionSigmaM, 'Position 1-sigma uncertainty'),
        initialVelocitySigmaMmS: numberValue(input.velocitySigmaMmS, 'Velocity 1-sigma uncertainty'),
        assumption: 'independent-diagonal-initial-covariance',
        terminalPositionThreeSigmaM: [0, 1, 2].map(axis => 3 * Math.sqrt(Math.max(0, result.terminalCovariance[axis][axis])) * 1000) as [number, number, number],
        collisionProbabilityComputed: false,
      },
      orekitCrossCheck: {
        performed: orekitCheck !== null,
        ...(orekitCheck ? {
          epochTai: orekitCheck.epoch,
          positionKm: orekitCheck.positionKm,
          velocityKmS: orekitCheck.velocityKmS,
          positionDifferenceM: orekitCheck.positionDifferenceM,
          velocityDifferenceMmS: orekitCheck.velocityDifferenceMmS,
        } : {}),
      },
      engineeringLimitations: [
        'Not safe approach or docking guidance; no validated approach corridor.',
        'The terminal velocity match is an instantaneous impulse at the same epoch as position coincidence.',
        'Keep-out result is a sampled pre-terminal spherical range screen, not continuous-time collision certification.',
        'Uncertainty assumes independent diagonal initial covariance; no correlations, measurement updates or maneuver-execution uncertainty.',
        'No collision probability is computed.',
        'No J2, atmospheric drag, solar radiation pressure or third-body perturbations.',
        'This report is a preliminary analytical engineering record, not a flight-certified product.',
      ],
    };
    const blob = new Blob([serializeRpodEngineeringReport(report)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aryaksha-rpod-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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
            <div className="field"><span><label htmlFor="rpod-epoch-tai"><span className="field-label">MISSION EPOCH</span></label><em>TAI</em></span><input id="rpod-epoch-tai" aria-label="Mission epoch TAI" type="text" pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?" title="Use YYYY-MM-DDTHH:mm:ss in TAI" required value={input.epochTai} onChange={event => update('epochTai', event.target.value)} /></div>
            <div className="field"><span><label htmlFor="rpod-mission-file"><span className="field-label">IMPORT MISSION STATE</span></label><em>JSON · EME2000</em></span><input id="rpod-mission-file" aria-label="Import EME2000 mission-state JSON" type="file" accept=".json,application/json" onChange={importMissionState} /></div>
            {importedMissionState && <div className="callout"><Orbit size={15} /><span>Imported target and chaser Cartesian states in EME2000 at {importedMissionState.epochTai} TAI.</span></div>}
            {importError && <div className="callout"><AlertTriangle size={15} /><span>{importError}</span></div>}
            <div className="field-grid">
              <div className="field"><span><label htmlFor="rpod-chief-altitude"><span className="field-label">CHIEF ORBIT ALTITUDE</span></label><em>km</em></span><input id="rpod-chief-altitude" aria-label="Chief orbit altitude" type="number" min="1" step="any" required value={input.chiefAltitudeKm} onChange={event => update('chiefAltitudeKm', event.target.value)} /></div>
              <div className="field"><span><label htmlFor="rpod-rendezvous-time"><span className="field-label">RENDEZVOUS TIME</span></label><em>min</em></span><input id="rpod-rendezvous-time" aria-label="Rendezvous time" type="number" min="0.001" step="any" required value={input.rendezvousMinutes} onChange={event => update('rendezvousMinutes', event.target.value)} /></div>
              <div className="field"><span><label htmlFor="rpod-keepout-radius"><span className="field-label">PRE-TERMINAL KEEP-OUT RADIUS</span></label><em>km</em></span><input id="rpod-keepout-radius" aria-label="Pre-terminal keep-out radius" type="number" min="0.000001" step="any" required value={input.keepOutRadiusKm} onChange={event => update('keepOutRadiusKm', event.target.value)} /></div>
              <div className="field"><span><label htmlFor="rpod-position-sigma"><span className="field-label">POSITION 1-SIGMA UNCERTAINTY</span></label><em>m</em></span><input id="rpod-position-sigma" aria-label="Position one sigma uncertainty" type="number" min="0" step="any" required value={input.positionSigmaM} onChange={event => update('positionSigmaM', event.target.value)} /></div>
              <div className="field"><span><label htmlFor="rpod-velocity-sigma"><span className="field-label">VELOCITY 1-SIGMA UNCERTAINTY</span></label><em>mm/s</em></span><input id="rpod-velocity-sigma" aria-label="Velocity one sigma uncertainty" type="number" min="0" step="any" required value={input.velocitySigmaMmS} onChange={event => update('velocitySigmaMmS', event.target.value)} /></div>
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
              <button className="primary wide" type="button" onClick={exportEngineeringReport}>Export versioned engineering report (JSON)</button>
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
              <div className="trajectory-panel">
                <div className="stat-row"><span className="result-label">LVLH transfer path · radial vs along-track</span><b>40 intervals</b></div>
                <svg viewBox="0 0 600 220" role="img" aria-label="Predicted chaser trajectory in radial and along-track LVLH coordinates">
                  <line x1="20" y1="110" x2="580" y2="110" stroke="currentColor" opacity="0.25" />
                  <line x1="300" y1="15" x2="300" y2="205" stroke="currentColor" opacity="0.25" />
                  <polyline points={trajectoryPlot ?? ''} fill="none" stroke="#65a9ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx={300 + result.trajectory[0].state.positionKm[0] * (85 / Math.max(...result.trajectory.map(sample => Math.max(Math.abs(sample.state.positionKm[0]), Math.abs(sample.state.positionKm[1]))), 0.001))} cy={110 - result.trajectory[0].state.positionKm[1] * (85 / Math.max(...result.trajectory.map(sample => Math.max(Math.abs(sample.state.positionKm[0]), Math.abs(sample.state.positionKm[1]))), 0.001))} r="5" fill="#22c55e" />
                  <circle cx="300" cy="110" r="5" fill="#f59e0b" />
                  <text x="580" y="102" textAnchor="end" fill="currentColor" fontSize="11">+R</text>
                  <text x="310" y="20" fill="currentColor" fontSize="11">+T</text>
                </svg>
                <div className="stat-row"><span className="result-label">Green: post-departure state · amber: target rendezvous point</span><b>km</b></div>
              </div>
              <div className="result-list">
                <div className="stat-row"><span className="result-label">Terminal 3σ radial position uncertainty</span><b>{fixed(3 * Math.sqrt(Math.max(0, result.terminalCovariance[0][0])) * 1000, 2)} m</b></div>
                <div className="stat-row"><span className="result-label">Terminal 3σ along-track position uncertainty</span><b>{fixed(3 * Math.sqrt(Math.max(0, result.terminalCovariance[1][1])) * 1000, 2)} m</b></div>
                <div className="stat-row"><span className="result-label">Terminal 3σ cross-track position uncertainty</span><b>{fixed(3 * Math.sqrt(Math.max(0, result.terminalCovariance[2][2])) * 1000, 2)} m</b></div>
              </div>
              <div className="callout"><AlertTriangle size={15} /><span>Uncertainty is propagated from independent diagonal 1σ LVLH position/velocity inputs through the linear HCW state transition. Correlations, measurement updates and maneuver execution uncertainty are not included. These are not collision probabilities.</span></div>
              <div className="callout"><AlertTriangle size={15} /><span>{result.keepOutScreen.enteredKeepOut ? 'PRE-TERMINAL KEEP-OUT BREACH: ' : 'Pre-terminal keep-out screen clear: '}minimum sampled range {fixed(result.keepOutScreen.minimumPreTerminalRangeKm, 5)} km at T+{fixed(result.keepOutScreen.closestElapsedSeconds, 1)} s against {fixed(result.keepOutScreen.keepOutRadiusKm, 5)} km radius. Terminal coincidence is excluded. This is sampled geometry, not continuous-time or collision-probability certification.</span></div>
              <div className="result-list">
                <div className="stat-row"><span className="result-label">Maneuver event · departure</span><b>T+00:00 · {fixed(result.departureDeltaVMagnitudeMps, 4)} m/s</b></div>
                <div className="stat-row"><span className="result-label">Maneuver event · terminal velocity match</span><b>T+{fixed(result.rendezvousTimeSeconds, 1)} s · {fixed(result.arrivalDeltaVMagnitudeMps, 4)} m/s</b></div>
              </div>
              <div className="trajectory-panel">
                <div className="stat-row"><span className="result-label">Trajectory history · sampled LVLH states</span><b>5 checkpoints</b></div>
                {result.trajectory.filter((_, index) => index % 10 === 0).map((sample) => (
                  <div className="stat-row" key={sample.elapsedSeconds}>
                    <span className="result-label">T+{fixed(sample.elapsedSeconds, 1)} s · R {fixed(sample.state.positionKm[0], 5)} km · T {fixed(sample.state.positionKm[1], 5)} km</span>
                    <b>{fixed(Math.hypot(...sample.state.velocityKmS) * 1000, 3)} m/s</b>
                  </div>
                ))}
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
              <div className="callout"><Orbit size={15} /><span>Orekit cross-check uses imported EME2000 target/chaser states when a mission file is loaded; otherwise it constructs a synthetic circular equatorial chief orbit. The imported states are propagated from their declared TAI epoch. HCW residuals are shown only for the synthetic circular-orbit case.</span></div>
              <button className="primary wide" type="button" onClick={crossCheckWithOrekit} disabled={orekitLoading}>
                {orekitLoading ? 'Propagating both spacecraft with Orekit…' : (importedMissionState ? 'Cross-check imported mission states against Orekit' : 'Cross-check initial propagation (no burns) against Orekit')}
              </button>
              {orekitError && <div className="callout"><AlertTriangle size={15} /><span>{orekitError}</span></div>}
              {orekitCheck && <div className="result-list">
                {orekitCheck.positionDifferenceM !== null && <div className="stat-row"><span className="result-label">Orekit vs HCW position difference</span><b>{fixed(orekitCheck.positionDifferenceM, 4)} m</b></div>}
                {orekitCheck.velocityDifferenceMmS !== null && <div className="stat-row"><span className="result-label">Orekit vs HCW velocity difference</span><b>{fixed(orekitCheck.velocityDifferenceMmS, 4)} mm/s</b></div>}
                <div className="stat-row"><span className="result-label">Orekit propagated LVLH position</span><b>{orekitCheck.positionKm.map(value => fixed(value, 8)).join(', ')} km</b></div>
                <div className="stat-row"><span className="result-label">Orekit propagated LVLH velocity</span><b>{orekitCheck.velocityKmS.map(value => fixed(value, 10)).join(', ')} km/s</b></div>
                <div className="stat-row"><span className="result-label">Orekit epoch (TAI)</span><b>{orekitCheck.epoch}</b></div>
              </div>}
            </>
          )}
          <div className="callout"><AlertTriangle size={15} /><span>HCW assumes a circular chief orbit, constant mean motion and small relative separation. No perturbations, finite burns, navigation uncertainty, continuous-time collision screening or approach corridor are modelled. The sampled pre-terminal keep-out check is a coarse geometric indicator only.</span></div>
          {defaultMeanMotion !== null && <div className="bottom-bar"><b>Reference mean motion: {fixed(defaultMeanMotion, 9)} rad/s</b><span>Two-body circular orbit</span></div>}
        </section>
      </div>
    </div>
  );
}
