export const STANDARD_GRAVITY_M_S2 = 9.80665;
const EARTH_RADIUS_M = 6_378_137;
const EARTH_MU_M3_S2 = 3.986004418e14;
const SEA_LEVEL_DENSITY_KG_M3 = 1.225;
const ATMOSPHERE_SCALE_HEIGHT_M = 8_500;

export type RocketAscentInputs = {
  initialMassKg: number;
  dryMassKg: number;
  thrustN: number;
  specificImpulseS: number;
  referenceAreaM2: number;
  dragCoefficient: number;
  pitchStartTimeS: number;
  pitchEndTimeS: number;
  /** Pitch is measured from the local horizontal: 90° is vertical, 0° is horizontal. */
  pitchStartAngleDeg: number;
  pitchEndAngleDeg: number;
  timeStepS: number;
  maxFlightTimeS: number;
};

export type RocketAscentSample = {
  timeS: number;
  altitudeM: number;
  downrangeM: number;
  radialVelocityMps: number;
  horizontalVelocityMps: number;
  speedMps: number;
  massKg: number;
  thrustN: number;
  dragN: number;
  dynamicPressurePa: number;
  gravityMps2: number;
  pitchAngleDeg: number;
  phase: 'powered' | 'coast' | 'impact';
};

export type RocketAscentResult = {
  samples: RocketAscentSample[];
  burnoutTimeS: number | null;
  burnoutSpeedMps: number | null;
  maxDynamicPressurePa: number;
  maxDynamicPressureTimeS: number;
  maxAltitudeM: number;
  finalAltitudeM: number;
  terminationReason: 'impact' | 'max-flight-time';
};

type State = { radiusM: number; angleRad: number; radialVelocityMps: number; horizontalVelocityMps: number };
type Derivative = State;

function assertValidInputs(input: RocketAscentInputs): void {
  if (!Object.values(input).every(Number.isFinite)) {
    throw new Error('All rocket ascent inputs must be finite numbers.');
  }
  if (input.initialMassKg <= 0 || input.dryMassKg <= 0 || input.dryMassKg >= input.initialMassKg) {
    throw new Error('Dry mass must be greater than zero and smaller than initial mass.');
  }
  if (input.thrustN <= 0) throw new Error('Thrust must be greater than zero.');
  if (input.specificImpulseS <= 0) throw new Error('Specific impulse must be greater than zero.');
  if (input.referenceAreaM2 <= 0) throw new Error('Reference area must be greater than zero.');
  if (input.dragCoefficient < 0) throw new Error('Drag coefficient cannot be negative.');
  if (input.pitchStartTimeS < 0 || input.pitchEndTimeS <= input.pitchStartTimeS) {
    throw new Error('Pitch schedule end time must be greater than its non-negative start time.');
  }
  if (
    input.pitchStartAngleDeg < 0 || input.pitchStartAngleDeg > 90 ||
    input.pitchEndAngleDeg < 0 || input.pitchEndAngleDeg > 90
  ) {
    throw new Error('Pitch angles must be between 0 and 90 degrees from the local horizontal.');
  }
  if (input.timeStepS <= 0) throw new Error('Time step must be greater than zero.');
  if (input.maxFlightTimeS <= 0) throw new Error('Maximum flight time must be greater than zero.');
  if (Math.ceil(input.maxFlightTimeS / input.timeStepS) > 200_000) {
    throw new Error('Time step is too small for the selected maximum flight time.');
  }
}

const lerp = (a: number, b: number, fraction: number) => a + (b - a) * fraction;
const atmosphereDensity = (altitudeM: number) =>
  SEA_LEVEL_DENSITY_KG_M3 * Math.exp(-Math.max(0, altitudeM) / ATMOSPHERE_SCALE_HEIGHT_M);

function pitchAtTime(input: RocketAscentInputs, timeS: number): number {
  const fraction = Math.max(0, Math.min(1,
    (timeS - input.pitchStartTimeS) / (input.pitchEndTimeS - input.pitchStartTimeS)
  ));
  return lerp(input.pitchStartAngleDeg, input.pitchEndAngleDeg, fraction) * Math.PI / 180;
}

function derivative(
  input: RocketAscentInputs,
  state: State,
  timeS: number,
  burnoutTimeS: number,
  massFlowKgS: number
): Derivative {
  const altitudeM = state.radiusM - EARTH_RADIUS_M;
  const massKg = Math.max(input.dryMassKg, input.initialMassKg - massFlowKgS * timeS);
  const powered = timeS < burnoutTimeS - 1e-9;
  const thrustN = powered ? input.thrustN : 0;
  const speedMps = Math.hypot(state.radialVelocityMps, state.horizontalVelocityMps);
  const density = atmosphereDensity(altitudeM);
  const dragN = 0.5 * density * speedMps * speedMps *
    input.dragCoefficient * input.referenceAreaM2;
  const dragAcceleration = speedMps > 1e-9 ? dragN / massKg / speedMps : 0;
  const pitchRad = pitchAtTime(input, timeS);
  const gravityMps2 = EARTH_MU_M3_S2 / (state.radiusM * state.radiusM);
  const thrustAcceleration = thrustN / massKg;

  return {
    radiusM: state.radialVelocityMps,
    angleRad: state.horizontalVelocityMps / state.radiusM,
    radialVelocityMps:
      state.horizontalVelocityMps ** 2 / state.radiusM - gravityMps2 +
      thrustAcceleration * Math.sin(pitchRad) -
      dragAcceleration * state.radialVelocityMps,
    horizontalVelocityMps:
      -state.radialVelocityMps * state.horizontalVelocityMps / state.radiusM +
      thrustAcceleration * Math.cos(pitchRad) -
      dragAcceleration * state.horizontalVelocityMps
  };
}

function addScaled(state: State, derivativeValue: Derivative, scale: number): State {
  return {
    radiusM: state.radiusM + derivativeValue.radiusM * scale,
    angleRad: state.angleRad + derivativeValue.angleRad * scale,
    radialVelocityMps: state.radialVelocityMps + derivativeValue.radialVelocityMps * scale,
    horizontalVelocityMps: state.horizontalVelocityMps + derivativeValue.horizontalVelocityMps * scale
  };
}

function rk4Step(
  input: RocketAscentInputs,
  state: State,
  timeS: number,
  stepS: number,
  burnoutTimeS: number,
  massFlowKgS: number
): State {
  const k1 = derivative(input, state, timeS, burnoutTimeS, massFlowKgS);
  const k2 = derivative(input, addScaled(state, k1, stepS / 2), timeS + stepS / 2, burnoutTimeS, massFlowKgS);
  const k3 = derivative(input, addScaled(state, k2, stepS / 2), timeS + stepS / 2, burnoutTimeS, massFlowKgS);
  const k4 = derivative(input, addScaled(state, k3, stepS), timeS + stepS, burnoutTimeS, massFlowKgS);
  return {
    radiusM: state.radiusM + stepS / 6 * (k1.radiusM + 2 * k2.radiusM + 2 * k3.radiusM + k4.radiusM),
    angleRad: state.angleRad + stepS / 6 * (k1.angleRad + 2 * k2.angleRad + 2 * k3.angleRad + k4.angleRad),
    radialVelocityMps: state.radialVelocityMps + stepS / 6 * (
      k1.radialVelocityMps + 2 * k2.radialVelocityMps + 2 * k3.radialVelocityMps + k4.radialVelocityMps
    ),
    horizontalVelocityMps: state.horizontalVelocityMps + stepS / 6 * (
      k1.horizontalVelocityMps + 2 * k2.horizontalVelocityMps +
      2 * k3.horizontalVelocityMps + k4.horizontalVelocityMps
    )
  };
}

function makeSample(
  input: RocketAscentInputs,
  state: State,
  timeS: number,
  burnoutTimeS: number,
  massFlowKgS: number,
  impact = false
): RocketAscentSample {
  const altitudeM = state.radiusM - EARTH_RADIUS_M;
  const massKg = Math.max(input.dryMassKg, input.initialMassKg - massFlowKgS * timeS);
  const speedMps = Math.hypot(state.radialVelocityMps, state.horizontalVelocityMps);
  const density = atmosphereDensity(altitudeM);
  const dragN = 0.5 * density * speedMps ** 2 * input.dragCoefficient * input.referenceAreaM2;
  const powered = timeS < burnoutTimeS - 1e-9;
  return {
    timeS,
    altitudeM: Math.max(0, altitudeM),
    downrangeM: EARTH_RADIUS_M * state.angleRad,
    radialVelocityMps: state.radialVelocityMps,
    horizontalVelocityMps: state.horizontalVelocityMps,
    speedMps,
    massKg,
    thrustN: powered ? input.thrustN : 0,
    dragN,
    dynamicPressurePa: 0.5 * density * speedMps ** 2,
    gravityMps2: EARTH_MU_M3_S2 / (state.radiusM ** 2),
    pitchAngleDeg: pitchAtTime(input, timeS) * 180 / Math.PI,
    phase: impact ? 'impact' : powered ? 'powered' : 'coast'
  };
}

/**
 * Educational 2D point-mass ascent model.
 * Uses central Earth gravity, a non-rotating exponential atmosphere, constant
 * thrust/Isp until dry mass, a time-linear pitch schedule, and RK4 integration.
 */
export function calculateRocketAscent(input: RocketAscentInputs): RocketAscentResult {
  assertValidInputs(input);
  const massFlowKgS = input.thrustN / (input.specificImpulseS * STANDARD_GRAVITY_M_S2);
  const predictedBurnoutTimeS = (input.initialMassKg - input.dryMassKg) / massFlowKgS;
  const burnoutTimeS = predictedBurnoutTimeS <= input.maxFlightTimeS ? predictedBurnoutTimeS : null;
  const stateAtBurnoutTimeS = predictedBurnoutTimeS;
  const state: State = {
    radiusM: EARTH_RADIUS_M,
    angleRad: 0,
    radialVelocityMps: 0,
    horizontalVelocityMps: 0
  };
  const samples: RocketAscentSample[] = [
    makeSample(input, state, 0, stateAtBurnoutTimeS, massFlowKgS)
  ];

  let timeS = 0;
  let terminationReason: 'impact' | 'max-flight-time' = 'max-flight-time';
  while (timeS < input.maxFlightTimeS - 1e-10) {
    let stepS = Math.min(input.timeStepS, input.maxFlightTimeS - timeS);
    if (timeS < predictedBurnoutTimeS) {
      stepS = Math.min(stepS, predictedBurnoutTimeS - timeS);
    }
    const next = rk4Step(input, state, timeS, stepS, predictedBurnoutTimeS, massFlowKgS);
    timeS += stepS;
    Object.assign(state, next);
    const impact = state.radiusM <= EARTH_RADIUS_M && timeS > 0;
    samples.push(makeSample(input, state, timeS, stateAtBurnoutTimeS, massFlowKgS, impact));
    if (impact) {
      terminationReason = 'impact';
      break;
    }
  }

  const maxQSample = samples.reduce((best, sample) =>
    sample.dynamicPressurePa > best.dynamicPressurePa ? sample : best
  );
  const burnoutSample = samples.find(sample => Math.abs(sample.timeS - predictedBurnoutTimeS) < 1e-7);
  return {
    samples,
    burnoutTimeS,
    burnoutSpeedMps: burnoutSample?.speedMps ?? null,
    maxDynamicPressurePa: maxQSample.dynamicPressurePa,
    maxDynamicPressureTimeS: maxQSample.timeS,
    maxAltitudeM: Math.max(...samples.map(sample => sample.altitudeM)),
    finalAltitudeM: samples[samples.length - 1].altitudeM,
    terminationReason
  };
}
