# 🚀 QuizHub V2 - Nền tảng Ôn luyện & Tạo đề trắc nghiệm thông minh với AI

[![CI](https://github.com/AnhTaizz/quiz-hub-v2/actions/workflows/ci.yml/badge.svg)](https://github.com/AnhTaizz/quiz-hub-v2/actions/workflows/ci.yml)

## Project Origin

QuizHub V2 is a personal stabilization and refactoring project based on lessons learned from an earlier collaborative QuizHub project. 

The original QuizHub was developed collaboratively. This repository focuses on subsequent engineering work including reliability, data consistency, security, performance, maintainability, and automated testing.

## V2 Focus

* quiz attempt correctness
* reliable autosave and submission
* database integrity
* security hardening
* backend/frontend performance
* automated regression testing
* maintainability

*Note: Major architectural or product redesign is deferred beyond V2.*

---

QuizHub là ứng dụng web toàn diện dành cho việc quản lý, tạo lập và ôn luyện các bộ câu hỏi trắc nghiệm trực tuyến. Điểm nổi bật của QuizHub là tích hợp **Google Gemini AI API** để hỗ trợ giáo viên tự động sinh câu hỏi thông minh dựa trên tài liệu bài học có sẵn.

Hệ thống được thiết kế với giao diện cao cấp, hiện đại, mang tính nhất quán cao về nhận diện thương hiệu.

---

## 🛠️ Công nghệ sử dụng (Tech Stack)

- **Backend**: Java 21, Spring Boot 3.x, Spring Security (OAuth2 Login Google, JWT)
- **Database**: PostgreSQL
- **Frontend**: HTML5 (Thymeleaf template engine), CSS3 (Vanilla CSS), Javascript (ES6+)
- **AI Integration**: Google Gemini AI API
- **Containerization**: Docker, Docker Compose
- **CI/CD**: GitHub Actions, GitHub Container Registry (GHCR)

---

## 📋 Yêu cầu hệ thống (Prerequisites)

- **Git**
- **Java Development Kit (JDK) 21** trở lên.
- **PostgreSQL** (nếu chạy trực tiếp trên máy).
- **Docker** và **Docker Compose** (Khuyên dùng).

---

## ⚙️ Cấu hình môi trường (`.env`)

1. Tạo file `.env` tại thư mục gốc (tham khảo mẫu `.env.example`).
2. Điền thông tin cấu hình:

```properties
# --- Cấu hình Database ---
DB_URL=jdbc:postgresql://localhost:5432/quiz_hub
DB_USERNAME=postgres
DB_PASSWORD=your_postgres_password

# --- Cấu hình Đăng nhập bằng Google (OAuth2) ---
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

# --- Cấu hình Gửi Email (SMTP Gmail) ---
SPRING_MAIL_USERNAME=your_gmail@gmail.com
SPRING_MAIL_PASSWORD=your_gmail_app_password

# --- Cấu hình bảo mật JWT Token ---
JWT_SECRET=your_jwt_secret_key_at_least_64_characters_long_for_security

# --- Cấu hình tích hợp Google Gemini AI ---
GEMINI_API_KEY=AIzaSyYourGeminiApiKeyHere...

# --- Khởi tạo dữ liệu ---
SQL_INIT_MODE=never
```

---

## 🚀 Hướng dẫn khởi chạy ứng dụng

### Cách 1: Chạy qua Docker & Docker Compose (Khuyên dùng 🐳)

```bash
cp .env.example .env
# điền thông tin cấu hình vào .env

docker compose up -d --build
docker compose ps
```
Web App sẽ chạy tại địa chỉ: **[http://localhost:8080](http://localhost:8080)**

Health check: **[http://localhost:8080/actuator/health](http://localhost:8080/actuator/health)** (dùng cho Docker healthcheck, không yêu cầu đăng nhập).

*Để dừng ứng dụng:*
```bash
docker compose down
```

### Cách 2: Chạy trực tiếp trên máy local (Development Mode 💻)

1. **Cài đặt PostgreSQL** và tạo db `quiz_hub`.
2. **Build dự án**:
   ```bash
   ./mvnw clean install -DskipTests
   ```
3. **Chạy ứng dụng**:
   ```bash
   ./mvnw spring-boot:run
   ```

---

## 🔄 CI/CD

Every pull request and push to `main` runs automatically in GitHub Actions:

```text
PR / push → main
  → Backend Tests      (Java 21, full Maven test suite against real PostgreSQL)
  → Container Smoke Test  (builds the real Dockerfile, starts the real
                            docker-compose stack, checks /actuator/health)

push → main (after both succeed)
  → Publish Image      (ghcr.io/anhtaizz/quiz-hub-v2:latest and :sha-<short-sha>)

manual only
  → Deploy Production  (GitHub "production" environment → SSH →
                         docker compose → health check → automatic
                         rollback on failure)
```

Production deployment is **manual** (`workflow_dispatch`) — pushing to
`main` never deploys by itself, it only publishes the image.

Full operational details (required secrets, server bootstrap, rollback
model, recommended branch protection) are documented in
[`docs/deployment/CI_CD.md`](docs/deployment/CI_CD.md).

---

## 📌 Lưu ý quan trọng

- **Khởi tạo dữ liệu**: Lần chạy đầu, đặt `SQL_INIT_MODE=always` trong `.env` để chạy `data.sql`. Các lần sau đổi thành `never` để tránh lỗi.
- **Login OAuth2 Google**: Cấu hình Authorized Redirect URIs trong Google Cloud Console: `http://localhost:8080/login/oauth2/code/google`.
- **Tạo câu hỏi AI**: Yêu cầu `GEMINI_API_KEY` hợp lệ.
