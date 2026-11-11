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

## Next implementation gate

A schema alone is not a CAD or mass-properties solver. Before this is called a spacecraft design module, add:
- runtime schema validation and semantic checks (wet mass ≥ dry mass; positive-definite inertia; component totals reconciled to bus totals);
- CAD import conversion/documentation and mesh unit/bounds validation;
- editable component placement and assembly transforms;
- mass-property aggregation and centre-of-mass calculation;
- known reference spacecraft fixtures and round-trip import tests.

Do not infer tank volume, propulsion performance, inertia or structural margins from a render mesh alone.
