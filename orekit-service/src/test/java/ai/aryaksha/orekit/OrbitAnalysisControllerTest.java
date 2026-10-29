package ai.aryaksha.orekit;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class OrbitAnalysisControllerTest {
    private static final double EARTH_RADIUS_KM = 6378.137;
    private final OrbitAnalysisController controller = new OrbitAnalysisController();
    private final MockMvc http = MockMvcBuilders.standaloneSetup(controller).build();

    @Test
    void healthContractNamesOrekitEngineAndVersion() {
        Map<String, Object> health = controller.health();

        assertEquals("ok", health.get("status"));
        assertEquals("aryaksha-orekit-service", health.get("service"));
        assertEquals("Orekit", health.get("engine"));
        assertEquals("13.1.9", health.get("version"));
    }

    @Test
    void computesKnown550KmOrbitReferenceMetrics() {
        var result = controller.analyze(
            new OrbitAnalysisController.AnalysisRequest(550, 97.6, 0.001));

        assertTrue(result.valid());
        assertEquals("Orekit", result.engine());
        assertEquals("13.1.9", result.engineVersion());
        assertEquals("Orekit Keplerian propagation (two-body)", result.fidelity());
        assertEquals(6928.137, result.orbit().semiMajorAxisKm(), 0.001);
        assertEquals(95.64988, result.orbit().periodMinutes(), 0.01);
        assertEquals(543.071863, result.orbit().periapsisAltitudeKm(), 0.01);
        assertEquals(556.928137, result.orbit().apoapsisAltitudeKm(), 0.01);
        assertEquals(7.58509, result.orbit().circularVelocityKmS(), 0.001);
        assertEquals(-28.76678, result.orbit().specificOrbitalEnergyKm2S2(), 0.001);
    }

    @Test
    void stateVectorIsFiniteAndConsistentWithPeriapsisAtTrueAnomalyZero() {
        var result = controller.analyze(
            new OrbitAnalysisController.AnalysisRequest(550, 97.6, 0.001));
        assertEquals("TAI", result.state().timeScale());
        assertEquals("EME2000", result.state().frame());
        assertEquals("2000-01-01T11:59:27.816", result.state().epoch());
        double[] position = result.state().positionKm();
        double[] velocity = result.state().velocityKmS();
        double radiusKm = Math.sqrt(position[0] * position[0]
            + position[1] * position[1] + position[2] * position[2]);
        double speedKmS = Math.sqrt(velocity[0] * velocity[0]
            + velocity[1] * velocity[1] + velocity[2] * velocity[2]);
        double semiMajorAxisKm = EARTH_RADIUS_KM + 550;
        double expectedPeriapsisRadiusKm = semiMajorAxisKm * (1 - 0.001);
        double expectedPeriapsisSpeedKmS = Math.sqrt(
            398600.4418 * (1 + 0.001) / (semiMajorAxisKm * (1 - 0.001)));

        assertEquals(3, position.length);
        assertEquals(3, velocity.length);
        assertTrue(java.util.Arrays.stream(position).allMatch(Double::isFinite));
        assertTrue(java.util.Arrays.stream(velocity).allMatch(Double::isFinite));
        assertEquals(expectedPeriapsisRadiusKm, radiusKm, 0.01);
        assertEquals(expectedPeriapsisSpeedKmS, speedKmS, 0.001);
    }

    @Test
    void responseDisclosesTwoBodyModelLimitations() {
        var result = controller.analyze(
            new OrbitAnalysisController.AnalysisRequest(550, 97.6, 0.001));

        assertTrue(result.assumptions().stream().anyMatch(s -> s.contains("No J2")));
        assertTrue(result.assumptions().stream().anyMatch(s -> s.contains("EME2000")));
        assertEquals("orekit-http", result.comparison().get("engineAdapter"));
        assertEquals("connected", result.comparison().get("status"));
    }

    @Test
    void rejectsOrbitWhosePeriapsisIntersectsEarth() {
        var request = new OrbitAnalysisController.AnalysisRequest(120, 45, 0.02);

        IllegalArgumentException error = assertThrows(
            IllegalArgumentException.class, () -> controller.analyze(request));
        assertTrue(error.getMessage().contains("intersects Earth"));
    }

    @Test
    void rejectsAltitudeBelowAndAboveSupportedBounds() {
        assertThrows(IllegalArgumentException.class, () -> controller.analyze(
            new OrbitAnalysisController.AnalysisRequest(119.99, 45, 0.001)));
        assertThrows(IllegalArgumentException.class, () -> controller.analyze(
            new OrbitAnalysisController.AnalysisRequest(100000.01, 45, 0.001)));
    }

    @Test
    void rejectsInclinationOutsideZeroTo180Degrees() {
        assertThrows(IllegalArgumentException.class, () -> controller.analyze(
            new OrbitAnalysisController.AnalysisRequest(550, -0.01, 0.001)));
        assertThrows(IllegalArgumentException.class, () -> controller.analyze(
            new OrbitAnalysisController.AnalysisRequest(550, 180.01, 0.001)));
    }

    @Test
    void rejectsEccentricityOutsideZeroInclusiveAndOneExclusive() {
        assertThrows(IllegalArgumentException.class, () -> controller.analyze(
            new OrbitAnalysisController.AnalysisRequest(550, 45, -0.001)));
        assertThrows(IllegalArgumentException.class, () -> controller.analyze(
            new OrbitAnalysisController.AnalysisRequest(550, 45, 1.0)));
    }

    @Test
    void rejectsNonFiniteOrbitParameters() {
        assertThrows(IllegalArgumentException.class, () -> controller.analyze(
            new OrbitAnalysisController.AnalysisRequest(Double.NaN, 45, 0.001)));
        assertThrows(IllegalArgumentException.class, () -> controller.analyze(
            new OrbitAnalysisController.AnalysisRequest(550, Double.POSITIVE_INFINITY, 0.001)));
        assertThrows(IllegalArgumentException.class, () -> controller.analyze(
            new OrbitAnalysisController.AnalysisRequest(550, 45, Double.NaN)));
    }

    @Test
    void acceptsAValidOrbitJustAboveEarthAtPeriapsis() {
        var result = controller.analyze(
            new OrbitAnalysisController.AnalysisRequest(120, 45, 0.018));

        assertTrue(result.valid());
        assertTrue(result.orbit().periapsisAltitudeKm() > 0);
        assertTrue(Double.isFinite(result.orbit().periodMinutes()));
    }

    @Test
    void httpHealthEndpointReturnsServiceContract() throws Exception {
        http.perform(get("/api/v1/health"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ok"))
            .andExpect(jsonPath("$.engine").value("Orekit"))
            .andExpect(jsonPath("$.version").value("13.1.9"));
    }

    @Test
    void httpAnalysisEndpointReturnsMetricsForValidRequest() throws Exception {
        http.perform(post("/api/v1/orbit/analysis")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"altitudeKm\":550,\"inclinationDeg\":97.6,\"eccentricity\":0.001}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.valid").value(true))
            .andExpect(jsonPath("$.engine").value("Orekit"))
            .andExpect(jsonPath("$.orbit.periodMinutes").isNumber())
            .andExpect(jsonPath("$.state.timeScale").value("TAI"))
            .andExpect(jsonPath("$.state.frame").value("EME2000"))
            .andExpect(jsonPath("$.state.epoch").value("2000-01-01T11:59:27.816"))
            .andExpect(jsonPath("$.state.positionKm.length()").value(3));
    }

    @Test
    void httpAnalysisEndpointReturnsBadRequestForEarthIntersectingOrbit() throws Exception {
        http.perform(post("/api/v1/orbit/analysis")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"altitudeKm\":120,\"inclinationDeg\":45,\"eccentricity\":0.02}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error", containsString("intersects Earth")));
    }
}
