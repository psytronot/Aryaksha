# Earth imagery provenance

## Surface albedo — NASA Blue Marble: Next Generation

- Product: Base Map with Topography and Bathymetry, January 2004 global composite.
- Resolution used as the source: 5,400 × 2,700 pixels (8 km/pixel); the browser decodes it asynchronously and downsamples the GPU texture to 3,072 × 1,536.
- Source page: https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/
- Source image: https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/january/world.topo.bathy.200401.3x5400x2700.jpg
- Requested credit: **NASA Earth Observatory**. NASA's Blue Marble page asks users to credit NASA Earth Observatory.

## Night lights — NASA Black Marble

- Product: 2016 Color global night-lights map, 0.1° grid (3,600 × 1,800 pixels); the browser downsamples the GPU texture to 2,048 × 1,024.
- The NASA Earth Observatory page describes the 2016 product as a cloud-free monthly composite of observed night lights.
- Source page: https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/
- Source image: https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg
- Credit: **NASA Earth Observatory**; Suomi NPP VIIRS observations, processed by NASA GSFC.

## Reuse and attribution

NASA's Earth Science FAQ says most material published under science.nasa.gov/earth, including imagery, is available for reuse (including commercial reuse) unless a copyright notice identifies a third-party rights holder. NASA should be acknowledged as the source. This implementation links the original NASA product pages, carries the dataset credits, does not include NASA insignia/logotypes, and must not imply NASA endorsement. Check the individual source page for any later copyright or credit changes before redistribution.

## Runtime and fallback behavior

- Requests use browser fetch with CORS mode, omit credentials, and use the browser cache. A response that fails CORS, HTTP validation, image decoding, or the 2:1 equirectangular dimension check is rejected for that layer.
- Image decoding is asynchronous. Where supported, createImageBitmap resizes the decoded image before GPU upload; the bitmap is closed when its Three.js texture is disposed. The HTML image fallback releases its decoded source when its texture is disposed.
- Pending requests are aborted when the Earth scene unmounts. Replaced fallback textures are disposed after the NASA texture is attached.
- If Blue Marble cannot load, the scene retains the deterministic illustrative cartographic fallback and reports that state in the UI.
- If Black Marble cannot load, the scene uses a black 1 × 1 texture. No synthetic city lights are generated or presented as observed data.
- The imagery dates are historical (January 2004 surface composite and 2016 night lights). These textures are visual context, not live Earth observation, a synchronized epoch, or an operational geospatial data product.


## Content Security Policy

The Render web/API security header allowlists https://assets.science.nasa.gov in connect-src for the two CORS-mode image fetches. The application still uses self-hosted scripts/styles and blob: only for the decoded local image source; no wildcard origins are added.


## Sun-driven atmospheric scattering and polar illumination

- The inner and outer atmospheric shells use a shared world-space Sun-direction uniform populated from the same ECI-derived vector as the Earth day/night mask and directional key light.
- Scattering is view-angle dependent: a limb/Fresnel term concentrates the blue atmospheric glow near the visible edge, while solar incidence controls day-side, twilight and night-side intensity.
- The terminator uses the same smooth solar-incidence transition as the night-light mask. Twilight scattering decays with angular distance from the terminator.
- Polar illumination is not a latitude-only brightness boost. The north/south polar response follows the sign and magnitude of the actual solar declination through the same normal·Sun calculation used everywhere else. No aurora or live atmospheric observation is implied.
- This is a real-time visual approximation, not a calibrated radiative-transfer model. Both shell geometries and ShaderMaterials are owned by the Earth scene graph and released by the existing deterministic disposeObjectResources teardown.
