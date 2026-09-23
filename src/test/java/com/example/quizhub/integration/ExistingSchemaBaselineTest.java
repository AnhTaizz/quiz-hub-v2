package com.example.quizhub.integration;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers
public class ExistingSchemaBaselineTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15-alpine");

    @Test
    void testFlywayBaselinesExistingSchemaWithoutFailing() throws Exception {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName(postgres.getDriverClassName());
        dataSource.setUrl(postgres.getJdbcUrl());
        dataSource.setUsername(postgres.getUsername());
        dataSource.setPassword(postgres.getPassword());

        JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);

        // 1. Manually create tables to simulate existing schema
        String schemaSql = Files.readString(Path.of("src/main/resources/db/migration/V1__baseline_schema.sql"));
        jdbcTemplate.execute(schemaSql);

        // Ensure there is no flyway history yet
        Integer countHistoryBefore = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM information_schema.tables WHERE table_name = 'flyway_schema_history'",
                Integer.class);
        assertThat(countHistoryBefore).isEqualTo(0);

        // 2. Run Flyway
        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .baselineOnMigrate(true)
                .baselineVersion("1")
                .load();

        flyway.migrate();

        // 3. Verify Flyway history was created and baselined
        Integer countHistoryAfter = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM information_schema.tables WHERE table_name = 'flyway_schema_history'",
                Integer.class);
        assertThat(countHistoryAfter).isEqualTo(1);

        Integer countVersions = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM flyway_schema_history",
                Integer.class);
        assertThat(countVersions).isEqualTo(3);

        MigrationInfo currentInfo = flyway.info().current();
        assertThat(currentInfo).isNotNull();
        assertThat(currentInfo.getVersion().toString()).isEqualTo("3");
        assertThat(currentInfo.getDescription()).isEqualTo("oauth2 registration ticket");
        assertThat(currentInfo.getType().name()).isEqualTo("SQL");
    }
}
