# React frontend migration — Sprint 1

Status: **Sprint 1 complete for the auth pages and the student vertical slice. The migration is NOT finished.**
Teacher and Admin (and several student pages) remain on the legacy Thymeleaf frontend.

Companion documents: [`frontend/docs/API_MAP.md`](../../frontend/docs/API_MAP.md) (endpoint/DTO map),
[`frontend/docs/MIGRATION_PARITY.md`](../../frontend/docs/MIGRATION_PARITY.md) (feature-by-feature parity),
[`FRONTEND_AUDIT.md`](FRONTEND_AUDIT.md) (the audit that motivated this).

## 1. Why React

The audit found 41 CSS files / 15,995 LOC, 15 independent `:root` blocks, 128 distinct hex colors, 102 `.btn*`
selectors, 206 `!important`, duplicated fetch/auth/toast/modal code, partial `apiClient` adoption and no frontend tests.
Rather than patch that page by page, Sprint 1 builds a small typed foundation (one design system, one API layer, one auth
abstraction, one feedback system) and moves the highest-risk flow — student quiz taking — onto it, with the audit's
security findings eliminated by construction.

## 2. Architecture (strangler, single deployable)

```text
Browser ──> Spring Boot (one image, one port)
             ├─ SpaController  → forward:/app/index.html   React-owned routes (explicit allow-list)
             ├─ /app/**        → built React assets         (static, public)
             ├─ /api/**        → REST controllers           (unchanged contracts + 5 additive JSON endpoints)
             ├─ /actuator/health, /oauth2/**, /login/oauth2/**, /avatars/**
             └─ Thymeleaf controllers                       Teacher, Admin, unmigrated student pages, /profile
```

Stack: React 19, TypeScript (strict, `noUncheckedIndexedAccess`), Vite 8, React Router 7, TanStack Query 5, Vitest +
Testing Library, Playwright. No Redux/Next/UI framework. State policy: TanStack Query = server state; React Context =
auth + toasts only; `useReducer` = the quiz attempt; `localStorage` = quiz crash recovery only.

## 3. Directory structure (`frontend/`)

```text
src/app/        App, providers, router (route-level lazy loading), queryClient, ErrorBoundary
src/api/        httpClient.ts (the ONLY place that calls fetch) + auth/student/quiz/classroom API modules
src/auth/       AuthProvider, authStorage (single token/session abstraction), RequireAuth, RequireRole
src/components/ ui/ (Button, Input, PasswordInput, Card, Badge, Modal, Spinner, Pagination), layout/ (AppShell, PageHeader),
                feedback/ (ToastProvider, EmptyState, ErrorState)
src/features/   auth, student, classroom, history, quiz (play engine, reconcile, recovery storage, timer)
src/styles/     tokens.css (the only place colors/spacing/radius are defined) + global.css
src/utils/      safePath.ts (safe redirect validation)
e2e/            Playwright specs; each test builds its own isolated data through the public API (support/api.ts, `world` fixture) - no shared state, any spec runs alone and in any order
```

## 4. Build integration (decision)

**`frontend-maven-plugin` bound to `generate-resources`** (see `pom.xml`), rather than a separate Node stage in the
Dockerfile. Reasons: one authoritative build (`mvn package` = backend + fresh React, locally, in CI and in Docker), no
host Node required (the plugin downloads a pinned Node 22.20.0), and the Dockerfile only needed `COPY frontend` plus an npm
cache mount. Vite's `build.outDir` is `../target/classes/static/app`, so the Spring Boot repackage picks it up with no copy
step. Nothing generated is committed (`frontend/dist`, `node_modules`, `node/` are ignored). `-DskipFrontend=true` skips
it for backend-only iteration. Trade-off: the plugin re-runs `npm ci` on every package; CI's dedicated Frontend Quality job
is what provides fast feedback and npm caching.

## 5. Routing ownership

React owns exactly these paths (explicit list in `SpaController`, **not** a `/student/**` wildcard):

| Path | Owner | Notes |
|---|---|---|
| `/`, `/login`, `/register`, `/forgot-password`, `/oauth2-redirect.html` | React | public |
| `/student`, `/student/quizzes`, `/student/classrooms`, `/student/classrooms/{n}`, `/student/history` | React | `@PreAuthorize(STUDENT)` + existing `/student/**` filter rule |
| `/student/quiz/play/{n}`, `/student/quiz/resume/{n}`, `/student/quiz/result/{n}` | React | numeric ids only |
| `/student/categories`, `/student/practice/**`, `/student/questions`, `/student/quiz/create\|quick-create\|ai-create\|{id}/edit`, `/student/quiz/play?…`, `/student/quiz/result?…`, `/student/quiz/history/{n}`, `/student/practice-history` | Thymeleaf | not migrated |
| `/profile`, `/oauth2-choose-role.html` | Thymeleaf / static | not migrated |
| `/teacher/**`, `/admin/**` | Thymeleaf | untouched |
| `/api/**`, `/actuator/**`, `/oauth2/**`, `/login/oauth2/**`, `/avatars/**`, `/css|js|images/**` | never forwarded | |

The forward is internal (URL unchanged). `SecurityConfig`'s authorization rules are **unchanged**; the only edit is
permitting `/app/**` (static bundle; Spring Security also evaluates the forward). Unauthenticated hits still get
`/login?returnUrl=…` from `JwtAuthenticationEntryPoint`. `SpaRoutingIntegrationTest` and the CI smoke job prove the map.

## 6. Auth model

Unchanged JWT mechanism. `authStorage` is the only code that touches `localStorage`/`sessionStorage`/the `jwt` cookie;
it reads both storages and clears both, and keeps the non-HttpOnly `jwt` cookie because `JwtAuthenticationFilter` falls
back to it for full-page navigations — that is what lets Spring enforce roles on `/student/**` page loads and keeps
legacy and React pages in one session. `httpClient` injects the bearer token and, on 401, clears the session and calls the
`AuthProvider` handler. Known risk (unchanged from legacy): a JWT in web storage is readable by any XSS; F-01/F-02 were
the concrete XSS paths and are closed.

## 7. API layer and query strategy

`httpClient` centralizes base URL, JSON/text/multipart handling, auth header, 401 handling, `AbortSignal`, network-error and
HTTP-error normalization to a typed `ApiError`. `grep -r "fetch(" src` finds only `httpClient.ts` (and test mocks).
Queries: `staleTime` 30 s, no focus refetch, retry ≤2 for network/5xx and never for 4xx, **mutations never retry**. The quiz
attempt query is fetched once (`staleTime: Infinity`, no focus/reconnect refetch) so a background refetch can never overwrite
in-progress local answers.

## 8. Quiz lifecycle in React

`start`/`resume` (one fetch) → `reconcileQuizState()` (pure, unit-tested; per question the higher `revision` wins, local-newer
answers are re-POSTed) → `useReducer` state (answers, revisions, per-question save status) → every change bumps the
question's revision, is written to `localStorage` (`quizhub:attempt:<id>`) immediately and POSTed (choice: immediately;
fill-in: 500 ms debounce). Out-of-order responses are safe because the backend rejects stale revisions. Failures keep the
answer locally and show a persistent per-question "Save failed – Retry" (F-06). The timer derives from
`startedAtMillis + duration`; the backend stays authoritative. Submit: confirmation dialog, one in-flight request, recovery
data cleared **only** after a successful response.

## 9. Backend changes (kept deliberately small)

Additive JSON endpoints (same service calls as the Thymeleaf controllers, DTOs instead of leaking JPA entities):
`GET /api/student/dashboard`, `/api/student/quiz/assigned`, `/api/student/quiz/history?page&size`,
`/api/student/classrooms`, `/api/student/classrooms/{id}` — the legacy pages had no JSON equivalent, so React could not
otherwise render these screens. `SpaController` added. Legacy mappings for the React-owned paths were **removed** from
`HomeController`, `StudentHomeController` and `StudentClassroomWebController` (they would be ambiguous with the SPA
routes); their templates were left on disk. `QuizHistoryPaginationTest.testPageSizeClamp` was retargeted from the removed
`getHistory` model method to the new REST endpoint, asserting the same 1–50 clamp.

## 10. CI

`Frontend Quality` (typecheck, lint, Vitest, build; `setup-node` 22.x with npm cache keyed on
`frontend/package-lock.json`), existing `Backend Tests` (its package step also builds React), `Container Smoke Test`
(now also checks React vs legacy routing, built asset reachable, API not captured), new `E2E` (Playwright against the real
container). `Publish Image` requires all four.

## 11. Findings and risks discovered

- **Resolved after Sprint 1:** `GlobalExceptionHandle`'s catch-all `RuntimeException` handler used to swallow Spring Security's `AccessDeniedException`, so a wrong-role call to any `@PreAuthorize` REST endpoint returned 500 instead of 403 (still denied, no data). A dedicated `AccessDeniedException` handler with a new `FORBIDDEN` (1045) code now returns 403; unauthenticated stays 401.
- **Timezone:** `QuizHubApplication` pins the JVM to `Asia/Ho_Chi_Minh` and the API serializes `LocalDateTime` without an offset, so browser-side comparison of `startDate`/`dueDate` is wrong outside UTC+7. My first implementation did exactly that and failed in CI (UTC) while passing on a UTC+7 workstation. Availability is now computed by the server (`AssignedQuizSummaryDTO.availability`), and the E2E browser runs in `America/Los_Angeles` by default so this cannot regress silently. The quiz timer is unaffected (it uses the server's `startedAtMillis` epoch).
- **Question order is not guaranteed by the API.** `Quiz.questions` is an unordered many-to-many, so a quiz's first question may be the fill-in one rather than the single-choice one. My first E2E specs assumed an order and flaked (~1 in 3 runs); they are now order-agnostic and every test builds its own isolated data through the public API (no shared state, any spec runs alone and in any order; verified across forced orderings and 5 consecutive full runs). Whether quiz-question order should be stable is a backend follow-up (legacy pages have the same behavior).
- **CI smoke flake (unexplained).** The route-ownership smoke step failed once on CI (commit `337cb70`) and passed on the commits before/after. I could not reproduce it locally (including 300 iterations of the suspected pipe/SIGPIPE pattern), so the cause is unproven. The step was hardened (no pipes into `grep -q`) and now reports the failing check as a public `::error::` annotation, so a recurrence will be diagnosable.
- The dev proxy list from the brief named `/uploads`; the backend actually serves avatars at `/avatars/**`, which is what
  the proxy uses.
- Testcontainers-based tests need a running Docker engine; Docker Desktop had stopped mid-session and had to be restarted.

## 12. Bundle sizes (production build)

Measured from `vite build` (Vite 8):

| Asset | Raw | gzip |
|---|---|---|
| Entry JS (React, Router, TanStack Query, shell) | 245.80 kB | 76.13 kB |
| Entry CSS (tokens, global, shared primitives) | 5.12 kB | 1.54 kB |
| Largest lazy route chunk — quiz player JS / CSS | 11.44 kB / 4.29 kB | 4.00 kB / 1.15 kB |
| Other route chunks (auth, dashboard, list, classrooms, history, result) | 0.3–2.4 kB each | < 1.1 kB each |

Auth, dashboard, quiz list, classrooms, history, quiz player and result are separate lazily loaded chunks.
There is no code-splitting of vendor libraries beyond that; not needed at this size.

## 13. Remaining work (Sprint 2+)

Teacher and Admin UIs; student practice/categories/personal-quiz authoring/AI create; profile page; OAuth "choose role";
notifications; proctoring (`/log-violation`) in the React quiz player; "view all questions" mode; marketing landing
content; delete the orphaned Thymeleaf templates/JS/CSS once nothing links to them; `AccessDeniedException` → 403;
consider `check-email` live validation.
