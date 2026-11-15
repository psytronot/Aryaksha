package ai.aryaksha.orekit;

import java.util.List;
import java.util.Map;

import org.hipparchus.geometry.euclidean.threed.Vector3D;
import org.hipparchus.ode.nonstiff.DormandPrince853Integrator;
import org.orekit.forces.gravity.NewtonianAttraction;
import org.orekit.frames.FramesFactory;
import org.orekit.orbits.CartesianOrbit;
import org.orekit.orbits.OrbitType;
import org.orekit.propagation.SpacecraftState;
import org.orekit.propagation.numerical.NumericalPropagator;
import org.orekit.time.AbsoluteDate;
import org.orekit.utils.Constants;
import org.orekit.utils.PVCoordinates;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/rpod")
public class RpodAnalysisController {
    private static final double MAX_PROPAGATION_SECONDS = 604800.0;
    private static final double MIN_STEP_SECONDS = 0.001;
    private static final double MAX_STEP_SECONDS = 60.0;
    private static final double POSITION_ERROR_METRES = 1.0;

    public record CartesianState(double[] positionKm, double[] velocityKmS) {}
    public record RelativeState(double[] positionKm, double[] velocityKmS) {}
    public record RpodRequest(CartesianState target, CartesianState chaser, double elapsedSeconds) {}
    public record StateVector(double[] positionKm, double[] velocityKmS) {}
    public record RpodResponse(
        boolean valid, String engine, String engineVersion, String frame, String epoch,
        double elapsedSeconds, StateVector target, StateVector chaser,
        RelativeState relativeLvlh, List<String> assumptions, Map<String, Object> comparison
    ) {}

    @PostMapping("/relative-state")
    public RpodResponse relativeState(@RequestBody RpodRequest request) {
        validate(request);
        AbsoluteDate epoch = AbsoluteDate.J2000_EPOCH;
        AbsoluteDate targetDate = epoch.shiftedBy(request.elapsedSeconds());
        SpacecraftState target = propagate(request.target(), targetDate);
        SpacecraftState chaser = propagate(request.chaser(), targetDate);

        PVCoordinates targetPv = target.getPVCoordinates(FramesFactory.getEME2000());
        PVCoordinates chaserPv = chaser.getPVCoordinates(FramesFactory.getEME2000());
        Vector3D r = targetPv.getPosition();
        Vector3D v = targetPv.getVelocity();
        Vector3D deltaR = chaserPv.getPosition().subtract(r);
        Vector3D deltaV = chaserPv.getVelocity().subtract(v);

        if (r.getNorm() < 1.0 || r.crossProduct(v).getNorm() < 1e-6) {
            throw new IllegalArgumentException("Target state must define a non-degenerate Earth orbit.");
        }
        Vector3D radial = r.normalize();
        Vector3D normal = r.crossProduct(v).normalize();
        Vector3D alongTrack = normal.crossProduct(radial).normalize();
        Vector3D omega = normal.scalarMultiply(r.crossProduct(v).getNorm() / r.getNormSq());
        Vector3D rotatingVelocity = deltaV.subtract(omega.crossProduct(deltaR));

        RelativeState relative = new RelativeState(
            new double[] { deltaR.dotProduct(radial) / 1000.0,
                           deltaR.dotProduct(alongTrack) / 1000.0,
                           deltaR.dotProduct(normal) / 1000.0 },
            new double[] { rotatingVelocity.dotProduct(radial) / 1000.0,
                           rotatingVelocity.dotProduct(alongTrack) / 1000.0,
                           rotatingVelocity.dotProduct(normal) / 1000.0 }
        );
        return new RpodResponse(true, "Orekit", "13.1.9", "EME2000 / target LVLH",
            targetDate.toString(org.orekit.time.TimeScalesFactory.getTAI()),
            request.elapsedSeconds(),
            toStateVector(targetPv), toStateVector(chaserPv), relative,
            List.of("Target and chaser are independently numerically propagated.",
                    "Force model: Newtonian central gravity only; no J2, drag, SRP or third bodies.",
                    "Frame: EME2000; epoch: J2000 TAI; integration tolerance: 1 m; maximum step: 60 s.",
                    "LVLH axes: +R radial outward, +T along-track, +N orbit-normal.",
                    "Relative velocity includes the rotating-frame transport correction.",
                    "This endpoint does not implement collision screening or safe-approach guidance."),
            Map.of("engineAdapter", "orekit-rpod-http", "status", "connected",
                   "note", "Relative state computed from two independently propagated Orekit spacecraft."));
    }

    private SpacecraftState propagate(CartesianState input, AbsoluteDate date) {
        Vector3D position = vector(input.positionKm()).scalarMultiply(1000.0);
        Vector3D velocity = vector(input.velocityKmS()).scalarMultiply(1000.0);
        CartesianOrbit orbit = new CartesianOrbit(
            new PVCoordinates(position, velocity), FramesFactory.getEME2000(),
            AbsoluteDate.J2000_EPOCH, Constants.WGS84_EARTH_MU);
        double[][] tolerances = NumericalPropagator.tolerances(
            POSITION_ERROR_METRES, orbit, OrbitType.CARTESIAN);
        DormandPrince853Integrator integrator = new DormandPrince853Integrator(
            MIN_STEP_SECONDS, MAX_STEP_SECONDS, tolerances[0], tolerances[1]);
        NumericalPropagator propagator = new NumericalPropagator(integrator);
        propagator.setOrbitType(OrbitType.CARTESIAN);
        propagator.setInitialState(new SpacecraftState(orbit));
        propagator.addForceModel(new NewtonianAttraction(Constants.WGS84_EARTH_MU));
        return propagator.propagate(date);
    }

    private StateVector toStateVector(PVCoordinates pv) {
        Vector3D p = pv.getPosition();
        Vector3D v = pv.getVelocity();
        return new StateVector(new double[] {p.getX()/1000.0, p.getY()/1000.0, p.getZ()/1000.0},
            new double[] {v.getX()/1000.0, v.getY()/1000.0, v.getZ()/1000.0});
    }

    private Vector3D vector(double[] values) {
        return new Vector3D(values[0], values[1], values[2]);
    }

    private void validate(RpodRequest request) {
        if (request == null || request.target() == null || request.chaser() == null
                || !Double.isFinite(request.elapsedSeconds())
                || request.elapsedSeconds() < 0 || request.elapsedSeconds() > MAX_PROPAGATION_SECONDS) {
            throw new IllegalArgumentException("Target, chaser and elapsedSeconds (0–604800 s) are required.");
        }
        validateState(request.target(), "target");
        validateState(request.chaser(), "chaser");
    }

    private void validateState(CartesianState state, String name) {
        if (state.positionKm() == null || state.velocityKmS() == null
                || state.positionKm().length != 3 || state.velocityKmS().length != 3) {
            throw new IllegalArgumentException(name + " position and velocity must each contain three components.");
        }
        for (double value : state.positionKm()) {
            if (!Double.isFinite(value)) throw new IllegalArgumentException(name + " position must be finite.");
        }
        for (double value : state.velocityKmS()) {
            if (!Double.isFinite(value)) throw new IllegalArgumentException(name + " velocity must be finite.");
        }
        if (vector(state.positionKm()).getNorm() < 1.0) {
            throw new IllegalArgumentException(name + " position must be outside the Earth centre.");
        }
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> invalidInput(IllegalArgumentException exception) {
        return Map.of("error", exception.getMessage());
    }
}
