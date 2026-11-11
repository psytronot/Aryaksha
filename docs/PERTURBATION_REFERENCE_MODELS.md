# Perturbation reference functions

`src/engineering/perturbationReferences.ts` provides independent SI-unit acceleration equations for Earth J2 and differential third-body gravity. The production Orekit service now offers an explicit J2-only option through `J2OnlyPerturbation`; the reference functions remain independent cross-checks and are not themselves the production force implementation.

The J2 function assumes an Earth-centred inertial frame aligned with Earth's spin axis. The third-body function uses the differential acceleration (spacecraft attraction minus central-body origin attraction), not the direct perturber acceleration alone.

J2-only integration uses a constant WGS-84 J2 coefficient and fixed EME2000 +Z symmetry axis. It excludes pole motion/EOP and higher harmonics. Third-body gravity, drag and SRP remain blocked pending validated ephemerides, atmosphere/space-weather and spacecraft optical/aerodynamic parameters.
