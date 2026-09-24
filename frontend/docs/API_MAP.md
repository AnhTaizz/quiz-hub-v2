# API migration map (React student slice, Sprint 1 + 2A)

Every entry below was read from the actual Spring controllers/DTOs (not inferred). "Legacy caller" is the
Thymeleaf page/JS that used the data before the React migration. Types live in `src/types/api.ts`.

## Global contracts

- **Success bodies are raw DTOs** (`ResponseEntity<T>`), *not* wrapped in `ApiResponse<T>`.
- **Error body** (`ErrorResponse`, `GlobalExceptionHandle`): `{ code?, status, message, timestamp, errors?: {field: msg} }`
  (`errors` only on `@Valid` failures; nulls omitted). Mapped to the `ApiError` type by `src/api/httpClient.ts`.
- **Auth**: `Authorization: Bearer <jwt>`; the filter also accepts a `jwt` cookie (used for full-page navigations).
  CSRF is ignored for `/api/**`. Role gates: `/api/student/**` → ADMIN/TEACHER/STUDENT at the filter chain, and
  `@PreAuthorize("hasRole('STUDENT')")` on the student controllers.
- Static avatars are served from `file:./uploads/` at **`/avatars/**`** (not `/uploads/**`).

## Auth & profile

| React feature | Method + path | Request | Response | Auth | Legacy caller |
|---|---|---|---|---|---|
| Login | `POST /api/auth/login` | `{email, password}` | `AuthResponse {id,email,fullName,role,token,avatarUrl}` | public | `js/login.js` |
| Register | `POST /api/auth/register` | `{fullName,email,password(min 6),confirmPassword,role}` | `AuthResponse` | public | `js/register.js` |
| Live email check | `GET /api/auth/check-email?email=` | query | `boolean` | public | `js/register.js` |
| Forgot password | `POST /api/auth/forgot-password?email=` | **query param**, no body | `string` | public | `js/forgot-password.js` |
| Reset password | `POST /api/auth/reset-password` | `{email,otp,newPassword,confirmPassword}` | `string` | public | `js/forgot-password.js` |
| OAuth2 complete registration | `POST /api/auth/oauth2-register` | `{role}` only — identity comes from the `oauth2_reg_ticket` HttpOnly cookie, never the body (see `docs/backend/OAUTH2_REGISTRATION_SECURITY.md`) | `AuthResponse` | public, but requires a valid ticket cookie set by a real prior Google callback; 400 `OAUTH2_REGISTRATION_INVALID` (1047) without one, 400 `INVALID_ROLE` (1048) for an unrecognized role | `oauth2-choose-role.html` → React `OAuth2ChooseRolePage` (Sprint 2A; rewritten this sprint) |
| OAuth2 pending registration preview | `GET /api/auth/oauth2-register/pending` | — | `{email,fullName,avatarUrl}` for display only; 400 `OAUTH2_REGISTRATION_INVALID` if there is no valid ticket | public (ticket-cookie-scoped) | **NEW** this sprint |
| Profile | `GET/PUT /api/users/my-profile` | `{fullName,phone,avatarUrl}` | `UserProfileResponse` | any user | `js/profile.js` → React `ProfilePage` (Sprint 2A) |
| Avatar upload | `POST /api/users/upload-avatar` (multipart `file`) | ≤5 MB image | `{url: "/avatars/<uuid>.<ext>"}`; failures are `400 {error}` | any user | `js/profile.js` |
| Change password | `POST /api/users/change-password` | `{oldPassword,newPassword,confirmPassword}` | text | any user | `js/profile.js` |

**Changed this sprint:** a new Google user is now redirected to a bare `/oauth2-choose-role.html` with
**no query parameters at all** — identity travels only via the `oauth2_reg_ticket` cookie, never the URL.
`OAuth2ChooseRolePage` fetches the display preview via the new GET above instead of parsing `?email=&fullName=`.

**Unchanged, and a documented remaining risk:** the *existing*-Google-user login redirect still is
`/oauth2-redirect.html?token=&id=&email=&fullName=<base64 utf-8>&role=&avatarUrl=` (or `?error=<message>`
for a locked account) — a live JWT in a URL query parameter. This is a separate, pre-existing risk from
the registration defect this sprint closed; see `docs/backend/OAUTH2_REGISTRATION_SECURITY.md` §5. Handled
by `OAuth2RedirectPage` (unchanged).

## Student dashboard, quizzes, classrooms

The Thymeleaf controllers returned view names + entity-filled models, so **no JSON existed** for these screens. The
endpoints marked **NEW** were added (additive, same service calls as the legacy controllers, JSON-safe DTOs, no business
change):

| React feature | Method + path | Response | Legacy source | Status |
|---|---|---|---|---|
| Dashboard | `GET /api/student/dashboard` | `StudentDashboardResponse {greeting,totalCompleted,quizAvg,practiceAvg,pendingCount,pendingThisWeekCount,assignedQuizzes[]}` | `StudentHomeController#home` | **NEW** (`StudentDashboardRestController`) |
| Assigned quiz list | `GET /api/student/quiz/assigned` | `AssignedQuizSummary[] {assigningId,quizId,quizTitle,classroomId,classroomName,startDate,dueDate,durationInMins,maxAttempt,attemptsMade,attemptsLeft(-1=∞),hasStarted,hasUnfinished,availability(NOT_STARTED|AVAILABLE|EXPIRED, server clock)}` | `StudentHomeController#listAllQuizzes` | **NEW** |
| Classroom list | `GET /api/student/classrooms` | `StudentClassroomSummary[] {id,code,name,description,imageUrl,teacherName,joinStatus,joinedAt}` | `StudentClassroomWebController#listClassrooms` | **NEW** |
| Classroom detail | `GET /api/student/classrooms/{id}` | `StudentClassroomDetail {…,topics[],assignedQuizzes[]}`; non-APPROVED members get `USER_NOT_IN_CLASS` (400) | `StudentClassroomWebController#classroomDetailPage` | **NEW** |
| Join classroom | `POST /api/student/classrooms/join?code=` | `string` | existing | existing |
| History (paginated) | `GET /api/student/quiz/history?page=&size=` (size clamped 1–50) | Spring `Page<QuizHistoryItem {attemptId,result,startedAt,endedAt,quizTitle,quizAssigningId,classroomName}>` | `StudentHomeController#getHistory` | **NEW** |
| Practice history | `GET /api/student/practice/history` | plain list, **not paginated** | existing | not migrated |

## Quiz attempt lifecycle (all existing, unchanged)

| Step | Method + path | Request | Response |
|---|---|---|---|
| Start (idempotent per assignment) | `GET /api/student/quiz/start?assigningId=` | – | `QuizTakingResponse {attemptId,quizTitle,durationInMins,startedAt,startedAtMillis,questions[],selectedAnswers{qid:[aid]},selectedTexts{qid:text},answerRevisions{qid:n}}` (no `isCorrect`) |
| Resume | `GET /api/student/quiz/resume?attemptId=` | – | same shape, pre-populated |
| Autosave (revision-aware) | `POST /api/student/quiz/save-answer?attemptId=&questionId=` | `{answerIds\|null, selectedText\|null, revision}` | `200`, empty body |
| Submit | `POST /api/student/quiz/submit` | `{attemptId, questions:[{questionId,answerIds,selectedText,revision}]}` | `{id: attemptId, score}` |
| Result | `GET /api/student/quiz/result?attemptId=` | – | `QuizResultResponse` (`isCorrect` fields rendered exactly as returned; the DTO has no visibility flag, the service decides what to populate) |
| Violation log (proctoring) | `POST /api/student/quiz/log-violation` | `{attemptId,violationCode}` | `{violationCount,autoSubmitted,attemptId}` — **not wired into React in Sprint 1** |

Enums: `Role` ADMIN/TEACHER/STUDENT · `QuestionType` SINGLE_CHOICE/MULTIPLE_CHOICE/FILL_IN_BLANK · `QuestionLevel`
EASY/MEDIUM/HARD · `JoinStatus` PENDING/APPROVED/REJECTED/REMOVED.

## Practice (Sprint 2A)

Practice has **no revision field** and is not the quiz-attempt contract: saves are best-effort upserts, the backend
rejects a save after submit (`PRACTICE_ALREADY_SUBMITTED`, code 1033), and the score is computed only by the backend.

| React feature | Method + path | Request | Response | Notes |
|---|---|---|---|---|
| Category tree | `GET /api/categories` (via `category.api.ts`) | — | `CategoryNode[]` with question counts | Only PUBLIC questions count. |
| Question count | `GET /api/student/practice/count?categoryId=` | query | bare number | Category + descendants, PUBLIC only. |
| Start / resume sequential | `POST /api/student/practice/start` | `{categoryId,limit,offset,isRandom,forceNew,practiceId}` | `{questions,practiceId,categoryId,categoryName,quizTitle}` | `limit` must be ≥ 1 (0 divides by zero server-side; validated in the UI). Sequential paging is offset/limit based, so only chunk-aligned ranges are offered; custom free ranges are **not** ported. A `practiceId` that does not belong to the caller, does not exist, or whose stored category does not match `categoryId` now answers **404** (`PRACTICE_NOT_FOUND`, code 1027) instead of silently resuming it (see `docs/backend/PRACTICE_OWNERSHIP_SECURITY.md`). |
| Save answer | `POST /api/student/practice/save-answer?practiceId=` | `{questionId, selectedAnswerId \| selectedAnswerIds \| selectedText}` | empty | Choice saves immediately, fill-in debounced 500 ms. `practiceId` foreign/missing → **404** `PRACTICE_NOT_FOUND` (was: silently saved into the other student's practice). `selectedAnswerId`/`selectedAnswerIds` not belonging to `questionId` → **400** `ANSWER_NOT_IN_QUESTION` (code 1044). |
| Submit | `POST /api/student/practice/submit` | `{categoryId,practiceId,answers[]}` (every question, empty for unanswered) | `PracticeResult` | Client never recomputes the score. `practiceId` foreign/missing/category-mismatched → **404** `PRACTICE_NOT_FOUND` (was: silently graded and completed the other student's practice). Same `ANSWER_NOT_IN_QUESTION` (400) check as save-answer. |
| History list | `GET /api/student/practice/history` | — | `PracticeHistoryItem[]` | **Unpaginated** (backend has no paging); shown as a plain list. Not faked as server pagination. |
| Detail / review / resume random | `GET /api/student/practice/history/detail?id=` | query | `PracticeResult` | **Changed this sprint:** a foreign or non-existent id now answers **404** (`PRACTICE_NOT_FOUND`, code 1027), not 401. Previously it answered 401 (`UNAUTHORIZED`), which the shared `httpClient` treats as session expiry and force-logs the caller out — so viewing someone else's id used to silently sign the *caller* out. See `docs/backend/PRACTICE_OWNERSHIP_SECURITY.md`. |

The start response includes each answer's `isCorrect` (legacy behaviour). React uses it only for the optional
display-only "show answer" feedback and never for scoring. Legacy `sessionStorage` hand-off keys (`practice_questions`,
`practice_id`, `practice_category_id`, `practice_category_name`, `practice_offset`, `practice_settings[_{id}]`,
`practice_is_shuffled_{id}`, `studentReturnUrl`) are still read/written so the legacy category pages hand off to the
React player. A stateless personal-quiz practice (no `practice_id`) is handed to the legacy
`/student/practice/personal-play`.

## Notifications (Sprint 2A)

| React feature | Method + path | Response | Notes |
|---|---|---|---|
| List | `GET /api/notifications` | `NotificationResponseDTO[] {id,title,message,type,read,link,createdAt}` | Own notifications only. `read` is the wire name (legacy JS reads `read`). |
| Unread count | `GET /api/notifications/unread-count` | number | Polled every 60 s while the shell is mounted. |
| Mark one read | `PUT /api/notifications/{id}/read` | empty | **Ownership enforced** (see below). |
| Mark all read | `PUT /api/notifications/read-all` | empty | Scoped to the caller. |

**Fixed in this sprint (RED test first):** `markAsRead(id)` used to load the notification by id only, so any signed-in
user could mark another user's notification read (IDOR). It now uses `findByIdAndUserId`; a foreign **or** missing id both
answer `404 NOTIFICATION_NOT_FOUND` (1046) so the API does not reveal which ids exist. The controller also returns a DTO
instead of the JPA entity. Covered by `NotificationOwnershipIntegrationTest` (8 tests).

Notification `link` values are untrusted input: the React bell only navigates to an internal path that passes the same
safe-path helper used for `returnUrl` (rejects `https://…`, `//evil`, `javascript:`, `data:`, backslash tricks).

## Proctoring (Sprint 2A)

`POST /api/student/quiz/log-violation` `{attemptId, violationType}` (unchanged) → `{violationCount, maxViolations?, autoSubmitted, ...}`.
Codes: `TAB_SWITCH`, `WINDOW_BLUR`, `FULLSCREEN_EXIT`, `TAB_CLOSE`, `MANUAL_EXIT`. The server counts every code, auto-submits at
3 and is idempotent afterwards. `TAB_CLOSE` is sent with `fetch(..., {keepalive:true})` through `httpClient` (it needs the
`Authorization` header, which `sendBeacon` cannot set).

## Still Thymeleaf (not migrated)

Categories / question bank, Excel import, personal quiz authoring (`/student/quiz/create|quick-create|ai-create|{id}/edit`),
per-assignment attempt history (`/student/quiz/history/{assigningId}`), the stateless personal-quiz practice player,
all teacher and admin pages.
