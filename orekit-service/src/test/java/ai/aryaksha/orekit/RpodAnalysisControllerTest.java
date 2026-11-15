package ai.aryaksha.orekit;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class RpodAnalysisControllerTest {
    private final RpodAnalysisController controller = new RpodAnalysisController();

    @Test
    void identicalSpacecraftStatesProduceZeroLvlhRelativeState() {
        var state = new RpodAnalysisController.CartesianState(
            new double[] { 7000, 0, 0 },
            new double[] { 0, 7.54605329, 0 });
        var result = controller.relativeState(
            new RpodAnalysisController.RpodRequest(state, state, 0.0));

        assertTrue(result.valid());
        assertEquals("Orekit", result.engine());
        assertEquals("EME2000 / target LVLH", result.frame());
        assertArrayEquals(new double[] {0, 0, 0}, result.relativeLvlh().positionKm(), 1e-12);
        assertArrayEquals(new double[] {0, 0, 0}, result.relativeLvlh().velocityKmS(), 1e-12);
    }

    @Test
    void computesRotatingLvlhRelativeVelocityAtInitialEpoch() {
        var target = new RpodAnalysisController.CartesianState(
            new double[] { 7000, 0, 0 },
            new double[] { 0, 7.54605329, 0 });
        var chaser = new RpodAnalysisController.CartesianState(
            new double[] { 7001, 2, 3 },
            new double[] { -0.002, 7.54705329, 0.004 });
        var result = controller.relativeState(
            new RpodAnalysisController.RpodRequest(target, chaser, 0.0));

        assertArrayEquals(new double[] {1, 2, 3}, result.relativeLvlh().positionKm(), 1e-9);
        double n = Math.sqrt(398600.4418 / Math.pow(7000, 3));
        assertArrayEquals(new double[] {-0.002 + 2*n, 0.001 - n, 0.004},
            result.relativeLvlh().velocityKmS(), 2e-8);
    }

    @Test
    void independentlyPropagatesBothSpacecraftToRequestedEpoch() {
        var target = new RpodAnalysisController.CartesianState(
            new double[] { 6928.137, 0, 0 },
            new double[] { 0, 7.585, 0 });
        var chaser = new RpodAnalysisController.CartesianState(
            new double[] { 6928.237, 0, 0 },
            new double[] { 0, 7.585, 0 });
        var result = controller.relativeState(
            new RpodAnalysisController.RpodRequest(target, chaser, 600.0));

        assertEquals(600.0, result.elapsedSeconds(), 1e-12);
        assertTrue(result.target().positionKm().length == 3);
        assertTrue(result.chaser().positionKm().length == 3);
        assertTrue(java.util.Arrays.stream(result.relativeLvlh().positionKm()).allMatch(Double::isFinite));
        assertTrue(java.util.Arrays.stream(result.relativeLvlh().velocityKmS()).allMatch(Double::isFinite));
    }

    @Test
    void crossChecksOrekitDualPropagationAgainstHcwForSmallCircularOrbitSeparation() {
        double mu = 398600.4418;
        double radiusKm = 6378.137 + 550.0;
        double n = Math.sqrt(mu / Math.pow(radiusKm, 3));
        double targetSpeed = Math.sqrt(mu / radiusKm);
        double[] rho = {0.1, -0.2, 0.05};
        double[] relativeVelocity = {0.0001, 0.0002, -0.00005};
        var target = new RpodAnalysisController.CartesianState(
            new double[] {radiusKm, 0, 0}, new double[] {0, targetSpeed, 0});
        var chaser = new RpodAnalysisController.CartesianState(
            new double[] {radiusKm + rho[0], rho[1], rho[2]},
            new double[] {
                relativeVelocity[0] - n * rho[1],
                targetSpeed + n * rho[0] + relativeVelocity[1],
                relativeVelocity[2]
            });

        var orekit = controller.relativeState(
            new RpodAnalysisController.RpodRequest(target, chaser, 900.0));

        double nt = n * 900.0;
        double c = Math.cos(nt);
        double s = Math.sin(nt);
        double[] hcwPosition = {
            (4 - 3*c)*rho[0] + (s/n)*relativeVelocity[0] + (2*(1-c)/n)*relativeVelocity[1],
            6*(s-nt)*rho[0] + rho[1] - (2*(1-c)/n)*relativeVelocity[0] + ((4*s-3*nt)/n)*relativeVelocity[1],
            c*rho[2] + (s/n)*relativeVelocity[2]
        };
        double[] hcwVelocity = {
            3*n*s*rho[0] + c*relativeVelocity[0] + 2*s*relativeVelocity[1],
            -6*n*(1-c)*rho[0] - 2*s*relativeVelocity[0] + (4*c-3)*relativeVelocity[1],
            -n*s*rho[2] + c*relativeVelocity[2]
        };

        assertTrue(distance(orekit.relativeLvlh().positionKm(), hcwPosition) < 0.01,
            "Orekit and HCW relative position should agree within 10 m for this small-separation case");
        assertTrue(distance(orekit.relativeLvlh().velocityKmS(), hcwVelocity) < 0.00001,
            "Orekit and HCW relative velocity should agree within 10 mm/s for this small-separation case");
    }

    @Test
    void acceptsExplicitTaiMissionEpoch() {
        var state = new RpodAnalysisController.CartesianState(
            new double[] {7000, 0, 0}, new double[] {0, 7.54605329, 0});
        var result = controller.relativeState(new RpodAnalysisController.RpodRequest(
            state, state, 0.0, "2000-01-02T12:00:00"));
        assertTrue(result.valid());
        assertTrue(result.epoch().contains("2000-01-02"));
    }

    @Test
    void propagatesFromExplicitTaiEpochInsteadOfIntegratingFromJ2000() {
        var target = new RpodAnalysisController.CartesianState(
            new double[] {6928.137, 0, 0}, new double[] {0, 7.585, 0});
        var chaser = new RpodAnalysisController.CartesianState(
            new double[] {6928.237, -0.2, 0.05}, new double[] {0.0001, 7.585398018, -0.00005});
        var result = controller.relativeState(new RpodAnalysisController.RpodRequest(
            target, chaser, 900.0, "2026-11-15T12:00:00"));
        assertTrue(result.valid());
        assertTrue(result.epoch().contains("2026-11-15"));
        assertTrue(java.util.Arrays.stream(result.relativeLvlh().positionKm()).allMatch(Double::isFinite));
        assertTrue(java.util.Arrays.stream(result.relativeLvlh().velocityKmS()).allMatch(Double::isFinite));
    }

    @Test
    void rejectsTimezoneQualifiedEpochInsteadOfTreatingUtcAsTai() {
        var state = new RpodAnalysisController.CartesianState(
            new double[] {7000, 0, 0}, new double[] {0, 7.54605329, 0});
        assertThrows(IllegalArgumentException.class, () -> controller.relativeState(
            new RpodAnalysisController.RpodRequest(state, state, 0.0, "2026-11-15T12:00:00Z")));
    }

    @Test
    void rejectsMalformedExplicitTaiMissionEpoch() {
        var state = new RpodAnalysisController.CartesianState(
            new double[] {7000, 0, 0}, new double[] {0, 7.54605329, 0});
        assertThrows(IllegalArgumentException.class, () -> controller.relativeState(
            new RpodAnalysisController.RpodRequest(state, state, 0.0, "not-a-date")));
    }

    private double distance(double[] actual, double[] expected) {
        double sum = 0;
        for (int i = 0; i < actual.length; i++) {
            sum += Math.pow(actual[i] - expected[i], 2);
        }
        return Math.sqrt(sum);
    }

    @Test
    void rejectsInitialStateWhoseOsculatingPeriapsisIntersectsEarth() {
        var earthIntersecting = new RpodAnalysisController.CartesianState(
            new double[] {7000, 0, 0}, new double[] {0, 6.0, 0});
        var safeState = new RpodAnalysisController.CartesianState(
            new double[] {7000, 0, 0}, new double[] {0, 7.54605329, 0});
        var error = assertThrows(IllegalArgumentException.class, () -> controller.relativeState(
            new RpodAnalysisController.RpodRequest(earthIntersecting, safeState, 0.0)));
        assertTrue(error.getMessage().contains("periapsis intersects"));
    }

    @Test
    void rejectsInvalidElapsedTimeAndMalformedStateVectors() {
        var state = new RpodAnalysisController.CartesianState(
            new double[] {7000, 0, 0}, new double[] {0, 7.5, 0});
        assertThrows(IllegalArgumentException.class, () -> controller.relativeState(
            new RpodAnalysisController.RpodRequest(state, state, -1)));
        assertThrows(IllegalArgumentException.class, () -> controller.relativeState(
            new RpodAnalysisController.RpodRequest(state, state, 604801)));
        var malformed = new RpodAnalysisController.CartesianState(
            new double[] {7000, 0}, new double[] {0, 7.5, 0});
        assertThrows(IllegalArgumentException.class, () -> controller.relativeState(
            new RpodAnalysisController.RpodRequest(malformed, state, 0)));
        var insideEarth = new RpodAnalysisController.CartesianState(
            new double[] {6378, 0, 0}, new double[] {0, 7.9, 0});
        assertThrows(IllegalArgumentException.class, () -> controller.relativeState(
            new RpodAnalysisController.RpodRequest(insideEarth, state, 0)));
    }
}
