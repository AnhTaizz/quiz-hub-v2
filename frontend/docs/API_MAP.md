# API migration map (React student slice)

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
| OAuth2 complete profile | `POST /api/auth/oauth2-register` | `{email,fullName,avatarUrl,role}` | `AuthResponse` | public | `oauth2-choose-role.html` (**still legacy**) |
| Profile | `GET/PUT /api/users/my-profile` | `{fullName,phone,avatarUrl}` | `UserProfileResponse` | any user | `js/profile.js` (page still legacy) |
| Avatar upload | `POST /api/users/upload-avatar` (multipart `file`) | ≤5 MB image | `{url: "/avatars/<uuid>.<ext>"}` | any user | `js/profile.js` |

OAuth2 success redirect (unchanged backend): `/oauth2-redirect.html?token=&id=&email=&fullName=<base64 utf-8>&role=&avatarUrl=`
or `?error=<message>` (locked account). Handled by `OAuth2RedirectPage`.

## Student dashboard, quizzes, classrooms

The Thymeleaf controllers returned view names + entity-filled models, so **no JSON existed** for these screens. The
endpoints marked **NEW** were added (additive, same service calls as the legacy controllers, JSON-safe DTOs, no business
change):

| React feature | Method + path | Response | Legacy source | Status |
|---|---|---|---|---|
| Dashboard | `GET /api/student/dashboard` | `StudentDashboardResponse {greeting,totalCompleted,quizAvg,practiceAvg,pendingCount,pendingThisWeekCount,assignedQuizzes[]}` | `StudentHomeController#home` | **NEW** (`StudentDashboardRestController`) |
| Assigned quiz list | `GET /api/student/quiz/assigned` | `AssignedQuizSummary[] {assigningId,quizId,quizTitle,classroomId,classroomName,startDate,dueDate,durationInMins,maxAttempt,attemptsMade,attemptsLeft(-1=∞),hasStarted,hasUnfinished}` | `StudentHomeController#listAllQuizzes` | **NEW** |
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

## Not migrated in Sprint 1 (still Thymeleaf)

Practice mode (`/api/student/practice/*`, no revision field), categories/question bank, personal quiz authoring
(`/student/quiz/create|quick-create|ai-create|{id}/edit`), per-assignment attempt history
(`/student/quiz/history/{assigningId}`), notifications (`/api/notifications`), profile page, all teacher/admin pages.
