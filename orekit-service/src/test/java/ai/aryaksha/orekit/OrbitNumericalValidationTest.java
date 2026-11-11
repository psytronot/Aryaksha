package ai.aryaksha.orekit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

/** Independent invariants for the current two-body integrator; not a validation of perturbed dynamics. */
class OrbitNumericalValidationTest {
    private static final double MU_KM3_S2 = 398600.4418;

    private static double specificEnergy(double[] r, double[] v) {
        double radius = Math.sqrt(r[0] * r[0] + r[1] * r[1] + r[2] * r[2]);
        double speed2 = v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
        return 0.5 * speed2 - MU_KM3_S2 / radius;
    }

    private static double[] angularMomentum(double[] r, double[] v) {
        return new double[] {
            r[1] * v[2] - r[2] * v[1],
            r[2] * v[0] - r[0] * v[2],
            r[0] * v[1] - r[1] * v[0]
        };
    }

    private static double norm(double[] v) {
        return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    }

    @Test
    void twoBodyPropagationConservesSpecificEnergyAndAngularMomentumOverOneOrbit() {
        var controller = new OrbitAnalysisController("test-secret");
        var initial = controller.analyze(new OrbitAnalysisController.AnalysisRequest(550, 97.6, 0.001, 0));
        double period = initial.orbit().periodSeconds();
        var finalState = controller.analyze(new OrbitAnalysisController.AnalysisRequest(550, 97.6, 0.001, period));

        double energy0 = specificEnergy(initial.state().positionKm(), initial.state().velocityKmS());
        double energy1 = specificEnergy(finalState.state().positionKm(), finalState.state().velocityKmS());
        double h0 = norm(angularMomentum(initial.state().positionKm(), initial.state().velocityKmS()));
        double h1 = norm(angularMomentum(finalState.state().positionKm(), finalState.state().velocityKmS()));

        assertEquals(energy0, energy1, Math.abs(energy0) * 1e-8);
        assertEquals(h0, h1, h0 * 1e-8);
        assertTrue(Double.isFinite(energy1));
        assertTrue(Double.isFinite(h1));
    }
}
