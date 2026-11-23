# Spacecraft configuration model v1

The initial machine-readable contract is `schemas/spacecraft-configuration.v1.schema.json`.

## Design principles

1. **Engineering data is not render geometry.** Dimensions, mass properties and component placements are authoritative inputs; meshes are presentation assets.
2. **Units are explicit.** Version 1 uses metres, kilograms and degrees. Imports must be normalized and unit conversions recorded.
3. **Frames are explicit.** Every configuration declares a spacecraft body frame and axis convention. Component position and orientation values are expressed in that frame.
4. **Unknown remains unknown.** Do not silently fill missing dimensions, mass, centre of mass or inertia with visually plausible values.
5. **Revision and provenance travel with the model.** Each model has a configuration ID, revision, source document and notes.
6. **No hidden scale correction.** Imported geometry must be checked against declared dimensions and reported when the mesh bounding box disagrees.

## Current schema scope

- Bus envelope dimensions;
- optional model URI and source format (GLB, glTF, OBJ, STL, STEP or unknown);
- dry/wet mass;
- optional centre of mass and 3×3 inertia tensor;
- component list for solar arrays, antennas, payloads, propulsion, tanks, radiators and sensors;
- per-component mass, power, dimensions, position and orientation;
- provenance metadata.

## Current workbench implementation

The Spacecraft page now includes a browser-local geometry and mass-properties workbench:

- Imports GLB, self-contained glTF, OBJ and STL for local 3D preview. STEP files must be exported from CAD to a supported mesh format first.
- Computes mesh bounding-box dimensions and centre only after source units are explicitly selected. GLB/glTF follow glTF metre conventions; OBJ/STL default to unknown units until selected.
- Accepts user-entered component mass, body-frame centre of mass and diagonal intrinsic inertia values.
- Aggregates component mass, composite centre of mass and inertia using the parallel-axis theorem.
- Updates the main spacecraft dry-mass and diagonal inertia budgets and exports a v1 JSON configuration.

The current UI assumes zero products of inertia and does not infer density, material, hollow/solid volume or component mass from mesh geometry. External glTF sidecar resources are not bundled by the local file importer.

## Remaining implementation gate

Before this is called a complete spacecraft CAD/mass-properties module, add:
- runtime schema validation and semantic checks (wet mass ≥ dry mass; positive-definite inertia; component totals reconciled to bus totals);
- material/density and closed-volume validation for supported mesh imports;
- editable component placement and assembly transforms with axis/unit conversion;
- product-of-inertia support and CAD reference-export comparisons;
- known reference spacecraft fixtures and round-trip import tests.

Do not infer tank volume, propulsion performance, inertia or structural margins from a render mesh alone.
