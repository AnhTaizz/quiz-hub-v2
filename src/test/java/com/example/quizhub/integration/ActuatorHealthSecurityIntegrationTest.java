package com.example.quizhub.integration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Proves the production health-check contract: /actuator/health is reachable
 * anonymously (required for Docker/orchestrator health checks) while no other
 * actuator endpoint leaks sensitive application information publicly.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Testcontainers
class ActuatorHealthSecurityIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15-alpine");

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void healthEndpointIsReachableAnonymouslyAndReportsUp() {
        ResponseEntity<String> response = restTemplate.getForEntity("/actuator/health", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("UP");
    }

    @Test
    void healthEndpointDoesNotLeakComponentDetails() {
        ResponseEntity<String> response = restTemplate.getForEntity("/actuator/health", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        // show-details: never means the response must not expose internal
        // component/datasource diagnostics, only the top-level status.
        assertThat(response.getBody()).doesNotContain("components");
    }

    @Test
    void sensitiveActuatorEndpointIsNotPubliclyExposed() {
        ResponseEntity<String> response = restTemplate.getForEntity("/actuator/env", String.class);

        // Whether Spring answers 401/404 directly, or security redirects an
        // unauthenticated browser-style request to the public login page (200
        // with login HTML), is an implementation detail. Either way, the actual
        // environment/property-source payload must never be served.
        assertThat(response.getBody()).doesNotContain("propertySources");
    }

    @Test
    void beansEndpointIsNotPubliclyExposed() {
        ResponseEntity<String> response = restTemplate.getForEntity("/actuator/beans", String.class);

        assertThat(response.getBody()).doesNotContain("\"beans\":");
    }
}
