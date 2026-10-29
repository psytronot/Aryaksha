# Aryaksha Orekit Service

Independent Java 21 / Spring Boot API for orbital analysis and Keplerian propagation.

## API
- `GET /api/v1/health`
- `POST /api/v1/orbit/analysis`

Example request:
```json
{ "altitudeKm": 550, "inclinationDeg": 97.6, "eccentricity": 0.001 }
```

The response contract matches Aryaksha's Mission Analysis view and includes orbital metrics plus an EME2000 state vector. The current model is two-body Keplerian; J2, drag, SRP, third-body perturbations, manoeuvre models and covariance propagation are not enabled.

## Run locally
```sh
mvn test
mvn spring-boot:run
```

## Container
Build from the repository root with Dockerfile path `orekit-service/Dockerfile` and build context `.`. Deploy as a separate web service and set Aryaksha's backend environment variable `OREKIT_SERVICE_URL` to that service's HTTPS base URL.

## Dependency and licence review
Orekit 13.1.9 is Apache-2.0. Its core runtime dependency, Hipparchus, is also Apache-2.0 according to Orekit's official documentation. Spring Boot dependencies and the complete resolved transitive dependency tree must still be scanned and recorded before production use. Do not assume the licence of the direct dependency settles every transitive dependency.
