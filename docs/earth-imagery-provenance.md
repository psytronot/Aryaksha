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

The Render web/API security header allowlists https://assets.science.nasa.gov and https://svs.gsfc.nasa.gov in connect-src for the CORS-mode image fetches. The application still uses self-hosted scripts/styles and blob: only for decoded local image sources; no wildcard origins are added.


## Cloud opacity — NASA/NOAA Climate Prediction Center composite

- Product: NASA Scientific Visualization Studio 4439, "High Resolution Layers from Monsoons: Wet, Dry, Repeat..."; the cloud layer is a global NOAA Climate Prediction Center (CPC) composite.
- Frame used: flat_cpc_clouds_8192x4096.01000_print.jpg (1024 × 512 JPEG). Frame 01000 corresponds to **2014-06-02 00:00 UTC**. The full 4096 × 2048 frame sequence is TIFF with alpha, but browser-native TIFF decoding is not assumed.
- Source page: https://svs.gsfc.nasa.gov/4439/
- Source image: https://svs.gsfc.nasa.gov/vis/a000000/a004400/a004439/flat_cpc_clouds_8192x4096.01000_print.jpg
- Credit: **NASA's Scientific Visualization Studio** and **NOAA Climate Prediction Center**.
- This is a historical cloud snapshot, not current weather or a live satellite feed. The print JPEG has a white background; runtime converts inverse grayscale luminance to alpha so the white background is transparent and darker cloud detail becomes opacity.

## Lunar surface color — NASA CGI Moon Kit 2025

- Product: 2025 lroc_color_2k.jpg (2048 × 1024), centered at 0° longitude.
- Source page: https://svs.gsfc.nasa.gov/4720/
- Source image: https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg
- Derived from the LRO Lunar Reconnaissance Orbiter Camera (LROC) Wide Angle Camera natural-color Hapke-normalized mosaic, with missing high-latitude regions filled using a lower-resolution LOLA albedo map.
- Credit: **NASA's Scientific Visualization Studio**; visualizer Ernie Wright (USRA); scientist Noah Petro (NASA/GSFC).
- NASA describes this map as optimized for visualization, not scientific analysis.

## Lunar elevation — NASA LOLA displacement map

- Product: ldem_3_8bit.jpg (1024 × 512), a low-resolution 8-bit visualization derivative of the Lunar Orbiter Laser Altimeter (LOLA) displacement map.
- Source page: https://svs.gsfc.nasa.gov/4720/
- Source image: https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_3_8bit.jpg
- Credit: **NASA's Scientific Visualization Studio** and the LRO LOLA instrument team.
- This map is used only as a restrained visual bump map. The LROC color/albedo image is not reused as a height map.

## Planetary texture runtime, fallbacks and orientation

- Cloud, lunar color and lunar elevation requests are asynchronous CORS-mode browser fetches with omitted credentials and browser caching. Each layer validates HTTP status, image content type, non-empty bytes and a 2:1 equirectangular aspect ratio.
- Cloud alpha is derived from inverse grayscale luminance because the selected print JPEG has a white background. Texture metadata retains source page, URL, credit and date.
- The Moon retains deterministic procedural color fallback. If a NASA layer fails CORS, HTTP validation or decoding, that layer remains on its safe fallback; synthetic content is never labelled as NASA data.
- Moon color and LOLA elevation are separate textures. ImageBitmaps are closed on texture disposal; cloud canvases are cleared; pending requests are aborted on scene unmount; replaced fallback textures are disposed immediately.
- Three.js SphereGeometry maps the 0° texture meridian to local +X. The lunar geometry rotates -90° around Y so the map centre aligns with local +Z, the synchronous Earth-facing axis. Tests verify this direction across orbital phases.
- The cloud layer retains the tested -1.5% local drift relative to the rotating Earth parent; its world-space rate remains 98.5% of Earth rotation.

