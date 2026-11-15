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
    }
}
