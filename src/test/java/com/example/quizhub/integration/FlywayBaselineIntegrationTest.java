package com.example.quizhub.integration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Testcontainers
@ActiveProfiles("test")
public class FlywayBaselineIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15-alpine");

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void testFlywayBaselineAndSchemaCreation() {
        // 1. Verify flyway_schema_history exists
        Integer countHistory = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM information_schema.tables WHERE table_name = 'flyway_schema_history'",
                Integer.class);
        assertThat(countHistory).isEqualTo(1);

        // 2. Verify migration version 1 and 2 exist
        Integer countVersion1 = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM flyway_schema_history WHERE version = '1'",
                Integer.class);
        assertThat(countVersion1).isEqualTo(1);

        Integer countVersion2 = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM flyway_schema_history WHERE version = '2'",
                Integer.class);
        assertThat(countVersion2).isEqualTo(1);

        // 3. Verify representative tables exist
        Integer countQuizTaking = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM information_schema.tables WHERE table_name = '_quiz_taking'",
                Integer.class);
        assertThat(countQuizTaking).isEqualTo(1);

        Integer countAttempt = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM information_schema.tables WHERE table_name = '_attempt'",
                Integer.class);
        assertThat(countAttempt).isEqualTo(1);

        // 4. Verify indexes exist
        Integer countQIndex = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM pg_indexes WHERE indexname = 'uq_quiz_taking_learner_assigning'",
                Integer.class);
        assertThat(countQIndex).isEqualTo(1);

        Integer countAIndex = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM pg_indexes WHERE indexname = 'uq_attempt_one_active_per_taking'",
                Integer.class);
        assertThat(countAIndex).isEqualTo(1);
    }
}
