package ai.aryaksha.orekit;

import java.util.List;
import java.util.Map;

import org.hipparchus.geometry.euclidean.threed.Vector3D;
import org.orekit.orbits.KeplerianOrbit;
import org.orekit.orbits.PositionAngleType;
import org.orekit.propagation.analytical.KeplerianPropagator;
import org.orekit.frames.FramesFactory;
import org.orekit.time.AbsoluteDate;
import org.orekit.utils.Constants;
import org.orekit.utils.PVCoordinates;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class OrbitAnalysisController {
    private static final double EARTH_RADIUS_KM = 6378.137;
    private static final double MU_KM3_S2 = 398600.4418;

    @Value("${ARYAKSHA_ALLOWED_ORIGIN:https://orbital-lab-lq22ug.v2.appdeploy.ai}")
    private String allowedOrigin;

    public record AnalysisRequest(double altitudeKm, double inclinationDeg, double eccentricity) {}
    public record OrbitMetrics(
        double altitudeKm, double semiMajorAxisKm, double eccentricity, double inclinationDeg,
        double periodSeconds, double periodMinutes, double periapsisAltitudeKm,
        double apoapsisAltitudeKm, double circularVelocityKmS, double specificOrbitalEnergyKm2S2
    ) {}
    public record StateVector(double elapsedSeconds, String epoch, double[] positionKm, double[] velocityKmS) {}
    public record AnalysisResponse(
        boolean valid, String engine, String engineVersion, String fidelity,
        List<String> assumptions, OrbitMetrics orbit, StateVector state, Map<String, Object> comparison
    ) {}

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of("status", "ok", "service", "aryaksha-orekit-service", "engine", "Orekit", "version", "13.1.9");
    }

    @PostMapping("/orbit/analysis")
    public AnalysisResponse analyze(@RequestBody AnalysisRequest input) {
        validate(input);
        double aKm = EARTH_RADIUS_KM + input.altitudeKm();
        double rpKm = aKm * (1 - input.eccentricity());
        double raKm = aKm * (1 + input.eccentricity());
        if (rpKm <= EARTH_RADIUS_KM) {
            throw new IllegalArgumentException("The selected orbit intersects Earth at periapsis.");
        }

        double aM = aKm * 1000.0;
        double e = input.eccentricity();
        double inclination = Math.toRadians(input.inclinationDeg());
        AbsoluteDate epoch = AbsoluteDate.J2000_EPOCH;
        KeplerianOrbit orbit = new KeplerianOrbit(
            aM, e, inclination, 0.0, 0.0, 0.0, PositionAngleType.TRUE,
            FramesFactory.getEME2000(), epoch, Constants.WGS84_EARTH_MU
        );
        KeplerianPropagator propagator = new KeplerianPropagator(orbit);
        PVCoordinates pv = propagator.propagate(epoch.shiftedBy(0.0)).getPVCoordinates(FramesFactory.getEME2000());
        Vector3D position = pv.getPosition();
        Vector3D velocity = pv.getVelocity();
        double periodSeconds = 2 * Math.PI * Math.sqrt(Math.pow(aM, 3) / Constants.WGS84_EARTH_MU);
        double circularVelocityKmS = Math.sqrt(Constants.WGS84_EARTH_MU / aM) / 1000.0;
        double energyKm2S2 = -Constants.WGS84_EARTH_MU / (2 * aM) / 1_000_000.0;

        OrbitMetrics metrics = new OrbitMetrics(
            input.altitudeKm(), aKm, e, input.inclinationDeg(), periodSeconds, periodSeconds / 60.0,
            rpKm - EARTH_RADIUS_KM, raKm - EARTH_RADIUS_KM, circularVelocityKmS, energyKm2S2
        );
        StateVector state = new StateVector(0.0, epoch.toString(),
            new double[] { position.getX() / 1000.0, position.getY() / 1000.0, position.getZ() / 1000.0 },
            new double[] { velocity.getX() / 1000.0, velocity.getY() / 1000.0, velocity.getZ() / 1000.0 }
        );
        return new AnalysisResponse(true, "Orekit", "13.1.9", "Orekit Keplerian propagation (two-body)",
            List.of("Orekit 13.1.9; Apache-2.0; Java 21",
                    "Frame: EME2000; epoch: J2000; Earth gravity parameter: WGS-84",
                    "No J2, atmospheric drag, solar radiation pressure or third-body forces configured"),
            metrics, state,
            Map.of("engineAdapter", "orekit-http", "status", "connected",
                   "note", "Computed by the independently hosted Orekit service."));
    }

    private void validate(AnalysisRequest input) {
        if (input == null || !Double.isFinite(input.altitudeKm())
                || !Double.isFinite(input.inclinationDeg()) || !Double.isFinite(input.eccentricity())) {
            throw new IllegalArgumentException("All orbit parameters must be finite numbers.");
        }
        if (input.altitudeKm() < 120 || input.altitudeKm() > 100000) {
            throw new IllegalArgumentException("Altitude must be between 120 and 100,000 km.");
        }
        if (input.inclinationDeg() < 0 || input.inclinationDeg() > 180) {
            throw new IllegalArgumentException("Inclination must be between 0 and 180 degrees.");
        }
        if (input.eccentricity() < 0 || input.eccentricity() >= 1) {
            throw new IllegalArgumentException("Eccentricity must be at least zero and less than one.");
        }
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> invalidInput(IllegalArgumentException exception) {
        return Map.of("error", exception.getMessage());
    }
}
