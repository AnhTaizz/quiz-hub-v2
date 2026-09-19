# Legacy → React parity checklist (Sprint 1 + Sprint 2A)

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
| Shell / navigation | Bootstrap header fragment | `AppShell`: legacy-style fixed top bar (gradient logo, horizontal nav with gradient underline, notification bell, avatar, log out); the nav collapses into a dropdown below 900 px; keyboard accessible | ≈ | Sprint 2A: Practice, History and Profile are React `NavLink`s and the header has the notification bell. "My library" stays a plain link to the legacy page. |
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
| Proctoring (`/log-violation`, fullscreen/tab-switch) | Present in `quiz-play.js` | `useQuizProctoring()` (Sprint 2A): listeners attach only while an attempt is active, are cleaned up, are disabled before submit/exit/after auto-submit | ≈ | See "Sprint 2A deviations" below (blur de-dup, monitoring re-enabled after a failed submit). Auto-submit clears local recovery and goes to the result **without a second submit**. |
| Result | `/student/quiz/result/{id}` | `QuizResultPage`; renders backend fields exactly (no client-side visibility inference) | = | Legacy result JS also rendered per-question review; React shows the same data in cards. |
| History `/student/history` | Server-rendered page (`page`,`size`) + practice history section | Backend-paginated quiz history (`GET /api/student/quiz/history`) with prev/next, empty/error/retry | ≈ | Sprint 2A adds a Quizzes \| Practice tab (`?tab=practice`). The practice list comes from the unpaginated `GET /api/student/practice/history`, so it is a plain list, not paginated. |

## Sprint 2A additions

| Feature | Legacy behavior | React behavior | Parity | Known difference |
|---|---|---|---|---|
| Practice setup `/student/practice` | Category page + settings modal | `PracticeSetupPage`: category tree with counts, chunked ranges, settings (show answer, shuffle questions/answers, display mode, random) | ≈ | Custom free ranges and the pre-start question preview are not ported (backend offset/limit alignment makes arbitrary ranges unsafe). |
| Practice player `/student/practice/play` | `practice-play.html` + JS, `innerHTML` for question text | `PracticePlayPage`: sequential / all / flashcard modes, navigator, flags, arrow-key nav, choice saves at once, fill-in debounced, visible save error + retry, one in-flight submit | ★ | All text rendered as text nodes; no client-side scoring; no `alert()/confirm()`. |
| Practice review `/student/practice/review/:id` | Detail modal in history | `PracticeReviewPage`, read-only, backend verdicts | = | |
| Practice history | Section on the history page | Practice tab, resume unfinished, open review | ≈ | Unpaginated (backend). Legacy `/student/practice-history` had no template; it now redirects to the tab. |
| Profile `/profile` | `profile.html` + `profile.js` | `ProfilePage` (any signed-in role): name, phone, avatar upload/remove, change password modal | = | The avatar "URL" tab is not ported (upload only). |
| Notifications | Header dropdown | `NotificationBell`: unread badge, accessible panel (Escape closes, focus returns), mark one / all read, safe internal-link navigation | ★ | Ownership defect fixed on the backend (see API map). |
| OAuth choose role | `oauth2-choose-role.html` (toast via `innerHTML`) | `OAuth2ChooseRolePage`, all text rendered as text | ★ | **Deviation:** on success the session is written directly with `login()` instead of hopping through `/oauth2-redirect.html?token=…`, so the token never appears in a URL. `OAuth2AuthenticationSuccessHandler` is unchanged. |

### Visual parity (Sprint 2A follow-up)

Requirement from the product owner: the migrated pages must keep looking like the old Thymeleaf UI. `tokens.css` now carries the legacy palette (green `#28a745` primary, blue `#2563eb` links/accent, `#f4f7fa` page background, `#1e1b4b` text), Inter + Nunito Sans (loaded from Google Fonts like the legacy pages), 8/14/20 px radii and the soft card shadow, and the shell copies the legacy header. The React-only dark theme was removed because the legacy site never had one. **Not done:** the legacy pages are in Vietnamese while the React copy is still English (labels such as "Trang chủ" / "Bài thi của tôi"); translating all strings is a separate, larger change and the E2E/unit tests select by the English names.

### Sprint 2A deviations and follow-ups

- **Blur de-duplication:** a `WINDOW_BLUR` within 1000 ms of a `TAB_SWITCH` is ignored (one physical tab switch fires both events; legacy counted two strikes).
- **Monitoring is re-enabled after a failed submit** so a network error does not leave the exam unproctored.
- **Post-login redirect fix:** a TEACHER/ADMIN signing in from React used to be sent to `/teacher` or `/admin` through the React router (blank screen). `goToSafePath()` now uses a full page load for server-rendered destinations.
- **Pre-existing risks, documented not fixed:** `POST /api/auth/oauth2-register` is a public endpoint that creates an account for any email without proof of a Google login; avatar uploads are stored under the client-supplied extension and served from `/avatars/**`.
- **Foreign practice detail id → 401** makes the shared client sign the user out (see API map).
- **E2E limit:** a real practice run needs PUBLIC questions, which only an admin approval creates; no public API can create an admin, so the Playwright specs cover setup, empty states, history tab, redirect and routing, while the start → answer → submit → review flow is covered by `usePracticePlayer`, `PracticePlayPage` and `PracticeReviewPage` component tests.

## Explicitly unchanged (still Thymeleaf)

Teacher (all `/teacher/**`), Admin (all `/admin/**`), categories/question bank, personal quiz authoring
(`/student/quiz/create|quick-create|ai-create|{id}/edit`), the stateless personal-quiz practice player
(`/student/practice/personal-play`), per-assignment attempt history (`/student/quiz/history/{assigningId}`).

## Dead / orphaned legacy files (not ported, not deleted)

`home.html`, `teacher/teacher-ai-generate.js`, `student/quiz-play.html` (its `/student/quiz/play/{assigningId}` mapping
moved to React), the static `oauth2-redirect.html`, and the Thymeleaf templates for routes React now owns
(`student-home.html`, `student-quizzes.html`, `student-history.html`, `student-classrooms.html`,
`student-classroom-detail.html`, `index.html`, `login.html`, `register.html`, `forgot-password.html`). Their controller
mappings were removed (they would otherwise conflict with the SPA routes); the files stay until Sprint 2 confirms nothing
links to them.

Sprint 2A orphans (kept, unlinked from React): `templates/profile.html` + `static/js/profile.js` (the `/profile` mapping is now the
SPA's), `static/oauth2-choose-role.html`, and the `HomeController` (removed; its only route was replaced by the SPA
landing). `StudentPracticeWebController` now serves only `/student/practice/personal-play`.

**Still in use, do not remove:** `student/quiz-play-student.html` and `js/student/quiz-play.js` — the legacy
personal-quiz flow (`/student/quiz/play?attemptId=&quizId=`, reached from the question bank/categories pages) still
renders them, and `QuizPlayClientConsolidationTest` guards that pairing.
