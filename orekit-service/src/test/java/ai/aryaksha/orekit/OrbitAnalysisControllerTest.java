package ai.aryaksha.orekit;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Map;
import org.junit.jupiter.api.Test;

class OrbitAnalysisControllerTest {
    private final OrbitAnalysisController controller = new OrbitAnalysisController();

    @Test
    void healthContractNamesOrekitEngine() {
        Map<String, Object> health = controller.health();
        assertEquals("ok", health.get("status"));
        assertEquals("aryaksha-orekit-service", health.get("service"));
        assertEquals("Orekit", health.get("engine"));
        assertEquals("13.1.9", health.get("version"));
    }

    @Test
    void returnsFiniteMetricsForValidOrbit() {
        var result = controller.analyze(new OrbitAnalysisController.AnalysisRequest(550, 97.6, 0.001));
        assertTrue(result.valid());
        assertEquals("Orekit", result.engine());
        assertEquals("13.1.9", result.engineVersion());
        assertTrue(Double.isFinite(result.orbit().periodSeconds()));
        assertTrue(result.orbit().periodSeconds() > 0);
        assertEquals(3, result.state().positionKm().length);
        assertEquals(3, result.state().velocityKmS().length);
    }

    @Test
    void rejectsEarthIntersectingOrbit() {
        var request = new OrbitAnalysisController.AnalysisRequest(120, 45, 0.99);
        assertThrows(IllegalArgumentException.class, () -> controller.analyze(request));
    }

    @Test
    void rejectsAltitudeOutsideSupportedBounds() {
        var request = new OrbitAnalysisController.AnalysisRequest(100, 45, 0.001);
        assertThrows(IllegalArgumentException.class, () -> controller.analyze(request));
    }
}
