# Giai đoạn 1: Dùng Maven và Java 21 để build ra file .jar
FROM maven:3-eclipse-temurin-24 AS build
WORKDIR /app

# Copy file cấu hình trước để cache dependencies
COPY pom.xml .
RUN --mount=type=cache,target=/root/.m2 mvn -B -ntp dependency:go-offline

# Copy mã nguồn và đóng gói ứng dụng
# The React SPA is built by the same Maven invocation: frontend-maven-plugin (see
# pom.xml) downloads its pinned Node, runs `npm ci` + `vite build`, and Vite writes
# straight into target/classes/static/app, so the jar below always contains a fresh
# React bundle - no host-built dist/ is ever trusted or needed.
# Tests are skipped here on purpose: CI already runs the full Maven test suite
# (against real PostgreSQL via Testcontainers) and the frontend quality/E2E jobs
# before this image is ever built.
COPY frontend ./frontend
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 \
    --mount=type=cache,target=/root/.npm \
    mvn -B -ntp clean package -DskipTests

# Giai đoạn 2: Môi trường chạy JRE 21 siêu nhẹ
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# curl is required for the container HEALTHCHECK below; BusyBox wget's flag
# support varies across Alpine base image revisions, curl does not.
RUN apk add --no-cache curl \
    && addgroup -S quizhub \
    && adduser -S -G quizhub -h /app quizhub \
    && mkdir -p /app/uploads/avatars \
    && chown -R quizhub:quizhub /app

# Copy file .jar đã build sang image chạy chính thức
COPY --from=build --chown=quizhub:quizhub /app/target/*.jar app.jar

USER quizhub

EXPOSE 8080

# JAVA_TOOL_OPTIONS is read automatically by the JVM launcher when set as a
# container environment variable, so no entrypoint changes are needed to
# support optional runtime JVM tuning; it is unset (and therefore a no-op)
# by default.

HEALTHCHECK --start-period=40s --interval=30s --timeout=5s --retries=3 \
    CMD curl -f "http://localhost:${PORT:-8080}/actuator/health" || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]
