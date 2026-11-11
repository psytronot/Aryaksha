# Perturbation reference functions

`src/engineering/perturbationReferences.ts` provides independent SI-unit acceleration equations for Earth J2 and differential third-body gravity. These are reference calculations for tests and future Orekit cross-checks. They are **not wired into the Orekit production propagator** and must not be presented as a perturbed trajectory.

The J2 function assumes an Earth-centred inertial frame aligned with Earth's spin axis. The third-body function uses the differential acceleration (spacecraft attraction minus central-body origin attraction), not the direct perturber acceleration alone.

Production force-model activation remains blocked until Orekit receives validated Earth gravity coefficients, body ephemerides and any required atmosphere/space-weather or solar radiation inputs.
