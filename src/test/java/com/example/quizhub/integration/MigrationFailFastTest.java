package com.example.quizhub.integration;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.FlywayException;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

@Testcontainers
public class MigrationFailFastTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15-alpine");

    @Test
    void migrationFailsWhenDuplicateQuizTakingExists() throws Exception {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName(postgres.getDriverClassName());
        dataSource.setUrl(postgres.getJdbcUrl());
        dataSource.setUsername(postgres.getUsername());
        dataSource.setPassword(postgres.getPassword());

        JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);

        // 1. Manually create V1 schema
        String v1Schema = Files.readString(Path.of("src/main/resources/db/migration/V1__baseline_schema.sql"));
        jdbcTemplate.execute(v1Schema);

        // 2. Insert dirty data (duplicate quiz taking)
        jdbcTemplate.execute("INSERT INTO _user (id, is_enable, is_verified, email, full_name, password, role) VALUES (1001, true, true, 'dirty1@test.com', 'Dirty 1', 'pass', 'STUDENT')");
        jdbcTemplate.execute("INSERT INTO categories (id, name, is_public) VALUES (1001, 'Test Cat', false)");
        jdbcTemplate.execute("INSERT INTO _quiz (id, is_draft, is_enable, is_exam, created_id, category_id) VALUES ('" + UUID.randomUUID() + "', false, true, true, 1001, 1001)");
        // create assigning
        jdbcTemplate.execute("INSERT INTO _quiz_assigning (id, is_deleted, is_hidden) VALUES (2001, false, false)");
        
        // Insert duplicate quiz takings for same learner and assigning
        jdbcTemplate.execute("INSERT INTO _quiz_taking (id, learner_id, assigning_id, status) VALUES (3001, 1001, 2001, 'NOT_STARTED')");
        jdbcTemplate.execute("INSERT INTO _quiz_taking (id, learner_id, assigning_id, status) VALUES (3002, 1001, 2001, 'NOT_STARTED')");

        // 3. Configure Flyway
        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .baselineOnMigrate(true)
                .baselineVersion("1")
                .load();

        // 4. Migration should fail because of duplicates
        FlywayException exception = assertThrows(FlywayException.class, flyway::migrate);
        assertThat(exception.getMessage()).contains("Duplicate QuizTaking rows detected");
    }
}
