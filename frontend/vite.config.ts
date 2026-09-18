/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Built assets are served by Spring Boot under /app/** (see
// docs/frontend/REACT_MIGRATION.md - "Build integration"). The backend
// forwards React-owned routes (/, /login, /student/**, ...) to
// /app/index.html, whose own <script>/<link> tags then resolve against this
// base path as plain static files - no forwarding needed for them.
const BASE_PATH = "/app/";
const BACKEND_ORIGIN = "http://localhost:8080";

export default defineConfig(({ command }) => ({
  // Built assets live under /app/ (served by Spring); the dev server serves from the root so
  // React Router's root-level routes (/login, /student, ...) match during `npm run dev`.
  base: command === "build" ? BASE_PATH : "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    // Lands directly in the Maven build's output classpath so a plain
    // `mvn package` (which frontend-maven-plugin runs this build as part of,
    // see ../pom.xml) produces a jar that already contains the SPA - no
    // manual `vite build` step and no committed dist/.
    outDir: "../target/classes/static/app",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": { target: BACKEND_ORIGIN, changeOrigin: true },
      "/oauth2": { target: BACKEND_ORIGIN, changeOrigin: true },
      "/login/oauth2": { target: BACKEND_ORIGIN, changeOrigin: true },
      // Avatar uploads are served by Spring from file:./uploads/ at the
      // static-resource root (see application.yaml), i.e. at /avatars/**,
      // not /uploads/** - verified against the real config, not assumed.
      "/avatars": { target: BACKEND_ORIGIN, changeOrigin: true },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    // Playwright specs live in e2e/ and run under `npm run e2e`, never under Vitest.
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/testSetup.ts"],
    css: true,
  },
}));
