# Earth–Moon reference model and scale modes

## Physical reference constants

| Quantity | Value | Meaning |
|---|---:|---|
| Earth equatorial radius | 6,378.137 km | WGS-84 equatorial reference |
| Moon mean radius | 1,737.4 km | Mean lunar radius |
| Earth–Moon centre distance | 384,400 km | Mean reference distance, not instantaneous range |
| Mean lunar sidereal orbital period | 27.321661 days | Mean period reference |

The scene maps the Earth equatorial radius to 5.15 scene units. The Moon radius is scaled by the ratio of mean lunar radius to Earth equatorial radius.

## Scale modes

- **Presentation scale (default):** the Earth–Moon centre separation is compressed to 2.25% of the mean physical ratio so both bodies remain visible in the mission-control viewport. The body radii are retained. This is not to scale.
- **True mean-distance scale:** the centre separation uses the declared 384,400 km mean distance without compression. The camera fits the full system. The Moon orbit remains a circular, constant-mean-distance visual model in this implementation.

The true mean-distance toggle is a geometry-scale improvement, **not an ephemeris implementation**. The current Moon phase is still advanced using a fixed mean sidereal period. It does not model eccentricity, inclination, perturbations, libration, topocentric parallax or time-dependent lunar orientation from a precision ephemeris.

## Engineering use restrictions

Do not use this scene as an ephemeris source or as a flight-dynamics input. Before an ephemeris-grade mode is claimed, integrate a versioned JPL SPICE or equivalent ephemeris source and record:
- kernel/source identity and checksum;
- time scale and epoch;
- origin and reference frame;
- interpolation/coverage interval;
- units and any frame transformations;
- source accuracy and extrapolation policy.

Never reuse the presentation-scale transform in numerical calculations. Scene display units and physical kilometres are separate quantities.

## Verification

Unit tests verify the physical constants, the true mean-distance conversion and the presentation compression ratio. Browser acceptance must also verify that both modes fit on desktop and portrait viewports and that the visible scale disclosure changes with the toggle.

## JPL Horizons point lookup boundary

The Mission Analysis panel can request the Moon's geometric state relative to Earth's centre from JPL Horizons at an explicitly supplied TDB calendar epoch. The adapter requests ICRF vectors and converts km and km/s to metres and metres per second. It records the kernel identifier only when the response reports one and reports formal position uncertainty as unknown when unavailable. This point lookup is not yet wired into the 3D scene's animation or a continuous local SPK kernel; the scene's circular mean-distance display remains a visual approximation.
