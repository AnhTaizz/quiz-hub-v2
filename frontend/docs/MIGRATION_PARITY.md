# Legacy → React parity checklist (Sprint 1)

Legend: **=** parity · **≈** intentional/benign difference · **✖** not migrated (still legacy) · **★** fixes an audit finding.
"Legacy" = the Thymeleaf template + vanilla JS that existed at commit `987af4c`.

## Authentication

| Feature | Legacy behavior | React behavior | Parity | Known difference |
|---|---|---|---|---|
| Login | `login.html` + `login.js`; toast + 1 s delay, then redirect | `LoginPage`; button loading state, inline `role="alert"` error, native form | ≈ | No "Remember me" checkbox: the session is always kept in `localStorage` (legacy "remembered" mode) and the `jwt` cookie lives 7 days (legacy: 24 h). Sessions started on legacy pages in `sessionStorage` are still read and cleared. |
| Post-login redirect | `window.location.href = decodeURIComponent(returnUrl)` — any URL | `resolveSafeReturnPath()` — only same-origin relative paths, else the role dashboard | ★ | F-03 fixed. Backend still produces `?returnUrl=<request URI>`; that always passes the check. |
| Google sign-in | Link to `/oauth2/authorization/google` | Same URL, real `<a>` (full-page navigation) | = | Button styling only. |
| OAuth callback | `static/oauth2-redirect.html` reads `?token…` / `?error=` and writes it with `innerHTML` | `OAuth2RedirectPage`; `error` rendered as a text node | ★ | F-02 fixed. The URL is unchanged (`/oauth2-redirect.html`) so `OAuth2AuthenticationSuccessHandler` was **not** touched. The old static file is still on disk but shadowed by `SpaController`. |
| OAuth "choose role" (new Google users) | `static/oauth2-choose-role.html` | unchanged legacy page | ✖ | Deferred. It is reached only for first-time Google users. |
| Register | `register.html`; role picked with clickable `<div>` cards | `RegisterPage`; native radio group, `autocomplete="new-password"`, password reveal | ≈ | Fewer visual flourishes. Live "email already used" check (`/api/auth/check-email`) is not wired (server validation still rejects duplicates and the message is shown). |
| Forgot / reset password | Single page, JS-driven steps | Two-step form (request code → code + new password) | = | Same two endpoints. |
| Locked account | Backend redirects `/login?error=locked`; legacy login ignores it | Login shows a friendly locked-account message | ≈ | Improvement. |
| Logout | Legacy header clears storage + cookie | `AuthProvider.logout()` clears both storages + cookie | = | |
| Landing page `/` | Marketing page (`index.html`) | Redirect to `/login` or the role dashboard | ✖ | The marketing content was **not** ported (out of the student vertical slice); only routing. `index.html`/`home.html` remain unused on disk. |

## Student experience

| Feature | Legacy behavior | React behavior | Parity | Known difference |
|---|---|---|---|---|
| Shell / navigation | Bootstrap header fragment | `AppShell`: sidebar on desktop, drawer on mobile, keyboard accessible | ≈ | Extra "Practice / My library / Profile" entries are plain links to the still-legacy pages. No notifications bell yet. |
| Dashboard `/student` | Greeting, completed count, averages, pending count, assigned quizzes | Same data via new `GET /api/student/dashboard` | = | "Pending this week" and "practice average" are returned by the API but not displayed. |
| Assigned quiz list | `/student/quizzes` | Same data via new `GET /api/student/quiz/assigned` | = | Availability (not started / expired) is computed **by the server** (`availability` field, same rule as the template's `now.isBefore/isAfter`) and merely displayed; the backend additionally enforces `QUIZ_NOT_STARTED` / `QUIZ_EXPIRED` / `MAX_ATTEMPTS_REACHED` on start. |
| Classroom list | `/student/classrooms` (+ form join) | React list + join form (`POST /api/student/classrooms/join`) | = | Legacy form POST handler kept for legacy pages. |
| Classroom detail | Assigned quizzes with schedule and attempt limit; non-approved members are silently redirected | Same, via new JSON endpoint; non-approved members get `USER_NOT_IN_CLASS` shown as an error | ≈ | Topic filter chips from the legacy page are not implemented (topics are returned by the API). Attempts made/left are not shown here — the legacy template did not show them either. |
| Quiz start / resume | `/student/quiz/play/{assigningId}` (+ near-duplicate `quiz-play-student.html` for `?attemptId`) | `QuizPlayByAssigningPage` and `QuizPlayByAttemptPage` sharing one implementation | = | The two duplicate templates are replaced by one component (audit F-08). |
| Answering | Per-question DOM patching; text via `innerHTML` | Controlled components; **all quiz text rendered as text nodes** | ★ | F-01 fixed; regression-tested. |
| Autosave | `revision` per question, POST per change, only `console.error` on failure | Same revision contract; fill-in debounced 500 ms; per-question `Saving… / Saved / Save failed + Retry` | ★ | F-06 fixed. Legacy did not debounce practice fill-ins; quiz fill-ins were debounced in both. |
| Local recovery + reconcile | `localStorage` merge by revision inside `quiz-play.js` | Pure, unit-tested `reconcileQuizState()`; local-newer answers are re-POSTed | = | Corrupted local data now degrades to server-only state instead of redirecting away. |
| Timer | Server start time + duration | Same (`startedAtMillis` + duration), auto-submit at 0 | = | Backend remains the authority on expiry. |
| Submit | `isSubmitting` guard + disabled button | Confirmation dialog (focus-trapped), single in-flight guard, disabled button; recovery data cleared only after success | = | |
| "View all questions" mode, flag-for-review persistence | Present | Single-question view + navigator dots + local flag toggle | ✖ | "All questions" view mode not ported. Flags are in-memory only (also not persisted server-side in legacy). |
| Proctoring (`/log-violation`, fullscreen/tab-switch) | Present in `quiz-play.js` | **Not wired** | ✖ | Deferred; endpoint unchanged. Attempts started from React are not proctored client-side. |
| Result | `/student/quiz/result/{id}` | `QuizResultPage`; renders backend fields exactly (no client-side visibility inference) | = | Legacy result JS also rendered per-question review; React shows the same data in cards. |
| History `/student/history` | Server-rendered page (`page`,`size`) + practice history section | Backend-paginated quiz history (`GET /api/student/quiz/history`) with prev/next, empty/error/retry | ≈ | The **practice history** section is not shown in React (that API is not paginated and practice is not migrated). |

## Explicitly unchanged (still Thymeleaf)

Teacher (all `/teacher/**`), Admin (all `/admin/**`), student practice, categories/question bank, personal quiz
authoring (`/student/quiz/create|quick-create|ai-create|{id}/edit`), per-assignment attempt history
(`/student/quiz/history/{assigningId}`), profile (`/profile`), OAuth "choose role".

## Dead / orphaned legacy files (not ported, not deleted)

`home.html`, `teacher/teacher-ai-generate.js`, `student/quiz-play.html` (its `/student/quiz/play/{assigningId}` mapping
moved to React), the static `oauth2-redirect.html`, and the Thymeleaf templates for routes React now owns
(`student-home.html`, `student-quizzes.html`, `student-history.html`, `student-classrooms.html`,
`student-classroom-detail.html`, `index.html`, `login.html`, `register.html`, `forgot-password.html`). Their controller
mappings were removed (they would otherwise conflict with the SPA routes); the files stay until Sprint 2 confirms nothing
links to them.

**Still in use, do not remove:** `student/quiz-play-student.html` and `js/student/quiz-play.js` — the legacy
personal-quiz flow (`/student/quiz/play?attemptId=&quizId=`, reached from the question bank/categories pages) still
renders them, and `QuizPlayClientConsolidationTest` guards that pairing.
