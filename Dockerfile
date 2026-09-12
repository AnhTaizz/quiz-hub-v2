# Giai đoạn 1: Dùng Maven và Java 21 để build ra file .jar
FROM maven:3-eclipse-temurin-21 AS build
WORKDIR /app

# Copy file cấu hình trước để cache dependencies
COPY pom.xml .
RUN --mount=type=cache,target=/root/.m2 mvn dependency:go-offline -B

# Copy mã nguồn và đóng gói ứng dụng
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 mvn clean package -DskipTests

# Giai đoạn 2: Môi trường chạy JRE 21 siêu nhẹ
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Copy file .jar đã build sang image chạy chính thức
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
