# QuizHub V2 — Frontend Audit

**Status:** Diagnosis only. No production frontend files were changed to produce this
document. This audit maps the current state of the Thymeleaf/CSS/vanilla-JS frontend
so a separate **Frontend Closing Sprint** can be scoped from real evidence rather than
guesswork.

Audited at commit `5912c6d7c5d573461c0fd40411d8e7ec4148c760` (branch `main`).

---

## 1. Executive Summary

The backend, CI, and deployment pipeline are stable. The frontend is functionally
complete across student/teacher/admin roles but was built incrementally, page by page,
without a shared component or token layer. The result is not "broken" — most flows
work — but it carries three compounding risks:

1. **No design system, heavy duplication.** Colors, radii, buttons, modals, and toasts
   are each reimplemented per page (in some cases per-file copy-pasted verbatim),
   which multiplies the cost of any future visual or behavioral change.
2. **Two real security-shaped bugs in JS/HTML**, not backend issues: an unescaped
   `innerHTML` interpolation of quiz content in `quiz-play.js`, an unescaped
   `innerHTML` interpolation of a URL-controlled error message in
   `oauth2-redirect.html`, and an open-redirect-shaped `returnUrl` handler in
   `login.js`. These are frontend-only findings; the backend lifecycle itself is not
   compromised.
3. **Inconsistent async/error handling.** A real shared API client (`api-client.js`)
   and toast system (`toast.js`) exist, but adoption is partial — most pages hand-roll
   their own `fetch` and error paths, so failure behavior varies page to page (some
   silently swallow errors, e.g. `practice-play.js` autosave).

Nothing found here blocks daily use of the product. The findings are prioritized so
the next sprint can fix the highest-leverage items (the two XSS-shaped bugs, the
open redirect, and the missing autosave-error visibility) without a full redesign.

---

## 2. Frontend Inventory

```
Templates (Thymeleaf, src/main/resources/templates/):  47 files
CSS files (src/main/resources/static/css/):             41 files, 15,995 lines total
JS files (src/main/resources/static/js/):               32 files, 13,387 lines total
Shared fragments:  layout/header.html, layout/footer.html, layout/sidebar.html,
                    fragments/question-editor.html, fragments/quiz-editor.html,
                    fragments/category-explorer-private.html,
                    fragments/category-explorer-public.html,
                    fragments/quiz-quick-create-ui.html, fragments/quiz-ai-create-ui.html,
                    fragments/question-bank-ui.html, fragments/quiz-preview.html,
                    fragments/quiz-grades.html
Major roles/pages: public (index/login/register/forgot-password),
                    student (home, quizzes, quiz-play, practice-play, result, history,
                    classrooms, categories), teacher (home, quiz create/edit,
                    classrooms, monitoring, category management, results),
                    admin (users, categories, moderation, reports, home)
```

Representative page → template → CSS → JS → role → API mapping:

| Page / Feature | Template | CSS | JS | Role | Main API deps |
|---|---|---|---|---|---|
| Login | `login.html` | `auth.css` | `login.js` | Public | `/api/auth/login` |
| Register | `register.html` | `auth.css` | `register.js` | Public | `/api/auth/register` |
| Forgot/reset password | `forgot-password.html` | `forgot-password.css` | `forgot-password.js` | Public | `/api/auth/forgot-password` |
| OAuth role choice / redirect | `static/oauth2-choose-role.html`, `static/oauth2-redirect.html` | inline | inline | Public | OAuth callback endpoints |
| Student home | `student/student-home.html` | `student.css` | `student/student-home.js` | Student | dashboard/summary endpoints |
| Quiz play (assignment) | `student/quiz-play.html` | `student/quiz-play.css`, `quiz-play-common.css` | `student/quiz-play.js` | Student | attempt/answer/submit endpoints |
| Quiz play (resume) | `student/quiz-play-student.html` (near-duplicate of above) | same | same | Student | same |
| Practice play | `student/practice-play.html` | `student/practice-play.css` | `student/practice-play.js` | Student | practice endpoints |
| Quiz result | `student/quiz-result.html` | `student/quiz-result.css` | `student/quiz-result.js` | Student | result endpoints |
| Quiz/practice history | `student/student-quiz-history.html`, `student/student-history.html` | `student-quiz-history.css`, `student-history.css` | `student/student-history.js` | Student | history endpoints |
| Teacher home | `teacher/teacher-home.html` | `teacher/teacher-home.css` | — | Teacher | dashboard endpoints |
| Quiz creation | `teacher/teacher-quiz-create.html` + `fragments/quiz-editor.html` + `fragments/question-editor.html` | `teacher-quiz-create.css` | inline (in fragments) | Teacher | quiz/question CRUD endpoints |
| AI quiz generation | `teacher/teacher-quiz-ai-create.html` + `fragments/quiz-ai-create-ui.html` | `fragments/quiz-ai-create.css` | inline (in fragment) | Teacher | AI generation endpoint |
| Classroom members | `teacher/teacher-classroom-members.html` | `teacher-classroom-members.css` | `teacher/teacher-classroom-members.js` | Teacher | classroom/member endpoints |
| Monitoring | `teacher/monitoring-overview.html`, `monitoring-log.html` | `monitoring-log.css` | `teacher/monitoring-log.js` | Teacher | monitoring/log endpoints |
| Admin users | `admin/admin-users.html` | `admin/admin-users.css` | `admin/admin-users.js` | Admin | `/api/admin/users` |
| Admin categories | `admin/admin-categories.html` | `admin/admin-categories.css` | `admin/admin-categories.js` (1,691 lines — largest JS file) | Admin | category/question/quiz moderation endpoints |

**Unused / duplicated / legacy files identified with evidence:**

- `home.html` — hand-rolled nav, hardcoded fake stats ("Đã làm: 15 Bài"), links to
  routes (`/my-classes`, `/history`) not registered by any controller. No controller
  returns view name `"home"` (`HomeController` maps `/` → `index`, not `home`).
  **Appears dead/unreachable.**
- `student/quiz-play.html` vs `student/quiz-play-student.html` — near-byte-identical
  (`diff` shows only 3 real line differences). Two controllers route into what is
  functionally one feature: `/quiz/play/{assigningId}` → `quiz-play`, `/play?attemptId`
  → `quiz-play-student`. Both load the same JS/CSS. This looks like accidental
  duplication from a missing resume-case branch, not an intentional two-flow design.
- `teacher/teacher-ai-generate.js` — **not referenced by any template in the repo**
  (confirmed by grep across all of `src/main/resources`). Orphaned code implementing a
  modal-based AI-generation flow that duplicates logic already live in
  `fragments/quiz-ai-create-ui.html`'s inline script.
- Admin CSS files (`admin-categories.css`, `admin-home.css`, `admin-moderation.css`,
  `admin-reports.css`, `admin-users.css`) each carry an **identical 15-line `:root`
  token block, copy-pasted verbatim** rather than shared via one file.
- `toast.css` (137 lines) is the intended shared toast component, but **16 other CSS
  files** hand-roll their own `#toastWrap`/`.toast` rules instead of using it —
  effectively dead weight next to 16 duplicates.
- Largest CSS files: `style.css` (2,466 lines), `teacher-category-management.css` /
  `admin-users.css` (908 lines each), `student/practice-play.css` (837 lines),
  `student.css` (804 lines).
- Largest JS files: `admin/admin-categories.js` (1,691 lines),
  `teacher/teacher-category-management.js` (1,191), `student/practice-play.js`
  (1,132), `student/student-categories-mine.js` (934),
  `student/student-categories-public.js` (929).

---

## 3. User Flow Map

### Student
`landing (index.html)` → `login/register` → `student-home` → `student-quizzes` /
`student-classrooms` → `quiz-play` (single-question view, prev/next + dot-grid
navigator, revision-based autosave) → **autosave** (per-answer POST, revision counter
for optimistic concurrency) → **resume** (`reconcileLocalAndServerState()` merges
`localStorage` cache with server state by revision) → **submit** (`isSubmitting` flag +
disabled button — protected against double-submit) → `quiz-result` → `student-history`
/ `student-quiz-history`.

Two friction points found with evidence:
- **Broken/duplicated entry point**: `quiz-play.html` and `quiz-play-student.html` are
  two near-identical routes into the same feature (see §2). A student resuming via one
  URL pattern vs. starting via the other gets subtly different markup for no product
  reason.
- **Silent resume failure**: if `localStorage` JSON is corrupted, `initQuiz()`'s
  try/catch (`quiz-play.js:120`) swallows the error and redirects to `/student`
  without a specific message — the student loses visibility into why their attempt
  vanished.

### Teacher
`login` → `teacher-home` → `teacher-quiz-create` (+ `fragments/quiz-editor.html`,
`fragments/question-editor.html`) → add questions/answers (unambiguous radio/checkbox
correct-answer marking, confirmed in `question-editor.html:203-207`) → save quiz
(`saveQuiz()`, no disable-guard, no autosave, **no `beforeunload` handler anywhere in
the three authoring files** — confirmed by grep) → `teacher-classrooms` /
`teacher-classroom-members` (manage) → `monitoring-overview` / `monitoring-log`
(inspect live attempts, 10s polling via `location.reload()`) → `teacher-quiz-result`
(inspect results).

Risk: **a teacher can lose an entire in-progress quiz draft** on accidental reload or
navigation — there is no autosave and no unload warning in the authoring fragments.

### Admin
`login` → `admin-home` → `admin-users` (real `<table>`, real pagination — page-size
selector, prev/next, page numbers, all wired to `/api/admin/users?page=&size=`) /
`admin-categories` (1,691-line JS file; category/question/quiz moderation via three
separately built delete-confirmation modals) / `admin-moderation` / `admin-reports`.
No admin screens exist beyond what's listed here — none were invented for this audit.

### Cross-cutting transitions worth flagging
- Public pages (`login`, `register`, `forgot-password`, `index`) each **hand-duplicate
  the header markup** instead of using the `public-header` fragment that already
  exists and is unused (`layout/header.html:6-24`). `register.html:28` even leaves a
  comment claiming reuse ("HEADER (reuse từ index/login)") while copy-pasting it a
  third time.
- None of those four public pages includes the `public-footer` fragment either.

---

## 4. Critical Findings

See §"Prioritized Remediation Plan" (§15 below) for the full list with severity. The
five most consequential, in order:

1. **F-01** — Unescaped quiz content in `quiz-play.js` innerHTML interpolation
   (stored-XSS-shaped gap, breaks the escaping discipline used everywhere else in the
   codebase).
2. **F-02** — Unescaped, URL-controlled error message rendered via innerHTML in
   `oauth2-redirect.html` (reflected DOM-XSS-shaped gap).
3. **F-03** — Unvalidated `returnUrl` post-login redirect in `login.js` (open-redirect
   pattern).
4. **F-04** — No autosave/`beforeunload` protection in quiz-authoring fragments (data
   loss for teachers).
5. **F-05** — No design system: colors, radii, buttons, modals, toasts each
   reimplemented per page with measured, non-trivial duplication.

Full evidence for each is in §"Prioritized Remediation Plan".

---

## 5. UI / Design Consistency

Verified counts (all read in full across the 41 CSS files, 15,995 lines):

- **`:root` token blocks exist in 15 separate files**, not one shared file. The five
  `admin/*.css` files copy-paste an identical 15-line `:root` block verbatim.
  `style.css` and `dashboard-layout.css` independently hardcode the same variable
  *names* with the same values but never share a source. Other files
  (`home.css`, `profile.css`, `practice-play.css`, `quiz-play(-common).css`,
  `quiz-result.css`, `student-categories-mine.css`, `student-quizzes.css`) each invent
  their own variable names for effectively the same blue/indigo.
- **Colors**: 2,034 hex-color occurrences, **128 distinct hex values**; plus 552
  `rgb()/rgba()` occurrences, 247 distinct. The "primary blue/indigo" intent alone is
  spread across **at least 9 different hex values** (`#2563eb`, `#1e1b4b`, `#6366f1`,
  `#3b82f6`, `#1d4ed8`, `#4f46e5`, `#4338ca`, `#38bdf8`, plus one-off outliers), each
  used in multiple files, with no single canonical brand blue. Two incompatible gray
  scales coexist: a custom set used by `style.css`/`dashboard-layout.css`/admin/profile
  pages, and the Tailwind default slate scale used verbatim by student pages.
- **Border-radius**: 53 distinct declared values across ~240+ declarations; only ~47
  reference a CSS variable, the rest are hardcoded literals (`12px`×75, `50%`×62,
  `10px`×47, `16px`×43, `8px`×41, `20px`×37, `14px`×36, and more) — many of these are
  redundant "rounded card" values with no visible semantic difference between them.
- **Buttons**: 102 distinct `.btn*`-prefixed selectors across 27 files. Four visibly
  different "submit" button treatments exist for the *same* action across pages: solid
  blue (`profile.css:346`), solid green (`quiz-play-common.css:406`), one indigo
  gradient direction (`admin-categories.css:690`), and the reverse gradient direction
  with a different radius (`teacher-category-management.css:760`,
  `student-quiz-create.css:184`, `teacher-quiz-create.css:184`).
- **Modals/toasts**: `.modal-content` is redefined independently in at least 3 admin
  CSS files with different radius/shadow values instead of one shared class; `.toast`
  is independently re-declared in 16 files despite a dedicated `toast.css` existing.
- **`!important`**: 206 occurrences across 30 of 41 files, heaviest in
  `layout/notifications.css` (25), `style.css` (24), `fragments/quiz-ai-create.css`
  (15) — a sign of styles patched reactively against specificity conflicts rather than
  restructured.

**Conclusion:** there is no enforced design system. Tokens exist in name but are
forked per file, and the visual language (color, radius, button/modal/toast treatment)
diverges page to page for equivalent actions.

---

## 6. Responsive Findings

Reasoned from actual markup/CSS structure, not just media-query presence.

- **Breakpoint usage is sparse and inconsistent**: only 20 `@media` rules total across
  15,995 lines of CSS. Most files — including **all five `admin/*.css` files** — have
  **zero** media queries. Where breakpoints do exist, near-duplicate values are used
  interchangeably for what should be the same intended breakpoint: `992px`/`991px` (9
  combined uses) and `768px`/`767px` (6 combined uses) across different files, with no
  shared breakpoint constant (there's no preprocessor, so this is expected without
  tooling, but it means visual breakpoints silently drift between pages).
- **`teacher-classroom-members.html`**: real `<table class="table-custom">` elements
  (lines 77, 129) with **no `.table-responsive` wrapper and zero `@media` rules** in
  its CSS. At 360–430px this table has no scroll affordance or stacking fallback and
  will overflow/clip.
- **`admin-users.html`**: table is wrapped in `.table-responsive { overflow-x: auto }`
  (scrolls rather than breaks), but still has zero `@media` rules — no card-transform
  for narrow screens, horizontal scroll is the only mobile accommodation.
- **`teacher-quizzes.css`** is the counter-example done right: real breakpoints at
  1200/992/768px that reflow `.col-title`/`.col-questions`/`.col-actions`, plus
  `-webkit-line-clamp` and `text-overflow: ellipsis` truncation on titles — proof the
  pattern exists in the codebase, it's just not applied to admin/classroom-member
  pages.
- **`quiz-play.html`/`quiz-play-student.html`**: use Bootstrap's responsive grid
  (`col-lg-8`/`col-lg-4`, stacks below `lg`) and CSS Grid `auto-fill, minmax(38px,1fr)`
  for the question-dot navigator, with an explicit 768px media query hiding the exam
  title on small screens. No hardcoded fixed-px panel widths were found that would
  force horizontal overflow.

**Worst pages, ranked:**
1. `teacher-classroom-members.html` — unwrapped table, zero responsive handling.
2. `admin-users.html` / other admin tables — horizontal-scroll-only, no small-screen
   layout considered.
3. Pages relying on the two inconsistent breakpoint pairs (992/991, 768/767) — not
   broken, but drift risk as pages are touched independently.

```
360px:  quiz-play reflows via Bootstrap grid; admin/classroom-member tables have no accommodation at all.
430px:  same as 360px — no breakpoint exists between them anywhere in the CSS.
768px:  the most-used breakpoint (5 files) but inconsistently paired with 767px elsewhere; teacher-quizzes.css correctly reflows here.
1024px: only teacher-quizzes.css (992px) and dashboard-layout.css (991px) act near this width; most pages have no explicit behavior.
1440px: two files reference 1400px; otherwise desktop layout is the unstated default everywhere.
```

---

## 7. Accessibility Findings

Practical, code-level findings only — not a formal WCAG audit.

- **A11Y MAJOR** — Modal ARIA: every Bootstrap `.modal.fade` in the codebase
  (`changePasswordModal`, `joinClassModal`, `submitModal`, `exitModal`, and every
  delete-confirmation modal) omits `role="dialog"` and `aria-modal="true"` — grepped
  repo-wide, zero hits for either attribute. Only the Bootstrap-default
  `aria-hidden="true"`/`tabindex="-1"` are present. No custom focus-trap or
  focus-return logic exists anywhere; modal focus behavior is entirely whatever
  Bootstrap's bundled JS provides by default.
- **A11Y MAJOR** — Clickable non-interactive elements: `register.html:74,80` uses
  `<div class="role-card" onclick="selectRole('STUDENT')">` with no `role="button"`,
  no `tabindex`, no keyboard handler — unreachable and unusable via keyboard. The same
  pattern (`onclick` on a `div`/`span`) recurs in 9 files total (12 occurrences):
  `fragments/question-editor.html`, `fragments/quiz-ai-create-ui.html`,
  `student/practice-play.html`, `admin/admin-categories.html`,
  `student/student-categories-mine.html`, `student/student-classroom-detail.html`,
  `teacher/teacher-category-management.html`, `teacher/teacher-classroom-detail.html`.
- **A11Y MAJOR** — Icon-only controls have no accessible name: the notification bell
  (`layout/header.html:326-330`, `bi-bell-fill` inside an `<a>`) has no `aria-label`.
  Hundreds of `<i class="bi/fa-...">` icons repo-wide carry no `aria-hidden="true"`
  and no accompanying accessible text.
- **A11Y MINOR** — Heading hierarchy is used for visual size, not structure:
  `teacher-home.html` and `admin-home.html` have **no `<h1>`** at all — the page title
  is an `<h4>` (line 32) that *precedes* `<h2>`s used for stat numbers (lines 41–65).
  `student-home.html` skips from `h2` to `h4` and back to `h2`.
  `fragments/question-editor.html` labels have no `for` attribute (association is
  visual/DOM-order only), unlike `login.html`/`register.html`/`forgot-password.html`,
  which correctly pair every `<label for="...">` with a matching input id.
- **A11Y MINOR** — Alt text is inconsistent: many avatar images have meaningful
  `alt="Avatar"`/`alt="Teacher"`, but `home.html:115,124` uses `alt=""` for
  teacher/admin avatars, and the marketing hero images in `index.html:119,164,208,250`
  appear to carry no `alt` attribute at all.

**Not found (verified, don't over-report):** no `th:field`/Spring-bound forms exist at
all (every form is plain HTML submitted via JS to REST endpoints), so there is no
server-side "preserve values after failed submit" mechanism to critique — that
responsibility is entirely client-side by design in this app, which is a UX finding
(§9) not an accessibility one.

---

## 8. JavaScript Architecture

- **Duplication of the "shared API client" concept**: `api-client.js` provides a real,
  reasonably complete `request()` wrapper (auth-header injection, 401/403 global
  redirect, JSON/text branching, centralized error toast). But **only 3 of ~30 page
  scripts use it** (`teacher-quizzes.js`, `teacher-category-management.js`,
  `teacher-quiz-result.js`). Everything else calls raw `fetch()` with hand-rolled
  logic. Worse, a **second, independent global mechanism** exists:
  `script.js:200-231` monkey-patches `window.fetch` itself to auto-inject the Bearer
  header and handle 401s — a different technique solving the same problem, active at
  the same time as `api-client.js`.
- **State handling**: each page is a standalone script with top-level `let` globals
  (acceptable for full-page-reload architecture, low risk of cross-page leakage since
  there's no SPA re-init). `quiz-play.js`'s `timerInterval` is cleared on timeout and
  on violation-triggered auto-submit, but not on normal exit/submit paths before
  navigation — inconsistent but low-impact since the page navigates away immediately
  after.
- **Async handling — the real gap**: `practice-play.js` autosave
  (`selectAnswer():712-716`, `handleFillInput():743-747`) has **no debounce on
  fill-in-blank keystrokes** (every `oninput` fires a fetch) and **only
  `.catch(console.error)`** — a failed save is completely invisible to the student.
  Contrast with `quiz-play.js`, which debounces fill-in-blank (500ms) and uses a
  revision counter for safe reconciliation, though even there, `saveToServer` has no
  in-flight/abort guard against overlapping requests from rapid clicking.
- **DOM architecture**: `practice-play.js` calls `renderAllQuestions()` — a full
  `innerHTML` rebuild of the entire question list — on every single answer click in
  "all questions" display mode, instead of patching just the changed node.
  `quiz-play.js` does this correctly (patches only the affected DOM). Separately,
  `fragments/question-bank-ui.js:530-541` runs an unbounded `setInterval(...,600)`
  forever, rewriting a badge's `innerHTML` every 600ms for the life of the page purely
  to sync a label.
- **Quiz lifecycle integration vs. backend guarantees**: the frontend does not bypass
  or contradict the backend's hardened lifecycle. `quiz-play.js`'s revision-based
  `reconcileLocalAndServerState()` correctly defers to the server as source of truth
  and replays only newer-revision local answers — a sound design. The failure mode
  found is UX-level (silent autosave failures, corrupted-localStorage handling
  redirects without a specific message), not a lifecycle-integrity break.
- **Unsafe DOM insertion (see also §10 Security)**: 243 `innerHTML=`/
  `insertAdjacentHTML` occurrences across 27 files. Most files that render
  backend-controlled text route it through an `esc()`/`escapeHTML()` helper — this
  discipline is present in 11+ files (`admin-users.js`, `admin-moderation.js`,
  `question-bank-ui.js`, `layout/notifications.js`, etc.). **`quiz-play.js` is the
  exception**: it defines no escaping helper at all, and interpolates answer/question
  text raw into `innerHTML` at two call sites (see F-01 in §15).
- **Double-submit protection**: present and correct in `login.js`, `register.js`, and
  `quiz-play.js`'s `executeSubmit()`. Absent in `teacher-quizzes.js`'s quiz-assignment
  confirm handler (no disable, no in-flight guard) and in `fragments/quiz-editor.html`'s
  `saveQuiz()` (no disable guard at all on the save button).

---

## 9. CSS Architecture

- **Duplication**: quantified in §5 — 128 distinct hex colors, 53 distinct
  border-radius values, 102 button selector variants, 16 independent `.toast`
  re-implementations next to an unused shared `toast.css`, 3+ independently authored
  `.modal-content` rules in admin pages alone.
  - **Duplicated `:root` token block, verbatim, across the 5 `admin/*.css` files.**
- **Specificity**: 206 `!important` occurrences across 30 files; 98 top-level ID
  selectors mixed with utility classes in layout/dashboard files. `admin-categories.css`
  contains one-line minified multi-declaration rule blocks — a sign of reactive
  patching rather than structured authoring.
- **Inline styles**: 721 `style="` attribute occurrences across templates, worst in
  `admin-categories.html` (95), `fragments/quiz-editor.html` (58), `index.html` (44).
- **Tokens/design system**: exists only nominally (see §5) — no single source of
  truth, no enforced usage.
- **Responsive strategy**: ad hoc, 20 total `@media` rules for a 41-file, 16k-line
  stylesheet base; several near-duplicate breakpoint values used interchangeably.
- **Genuine good example**: `dashboard-layout.css` (273 lines) is a real shared shell
  (`#sidebar`, base tokens, `.page-fade-in` animation) actually reused by 6 admin/
  profile files at the markup level — the sharing breaks down only at the token layer
  (§5), not the structural layer.

---

## 10. Async / Error-State UX

State-coverage matrix for representative pages (loading / empty / error / retry):

```
Admin — user list
  Loading: implicit (table populates after fetch, no visible spinner text found)
  Empty:   YES — "Không tìm thấy người dùng nào" with icon (admin-users.js:53-56)
  Error:   routed through shared error toast (via api-client.js patterns elsewhere)
  Retry:   NO explicit retry action

Teacher — quiz list
  Loading: implicit
  Empty:   YES — "Không tìm thấy đề thi nào" (teacher-quizzes.js:165-172)
  Error:   shared toast (uses api-client.js — one of only 3 adopters)
  Retry:   NO explicit retry action

Student — quiz/practice history (student-history.html)
  Loading: not verified as explicit
  Empty:   YES — th:if #lists.isEmpty() checks for both quizAttempts and practiceHistory
  Error:   server-rendered page, no client error path applicable
  Retry:   N/A

Student — quiz history (student-quiz-history.html, sibling page)
  Loading: not verified
  Empty:   NO explicit empty-state markup found (unlike its sibling above)
  Error:   N/A (server-rendered)
  Retry:   N/A

Student — practice-play autosave
  Loading: NO (no visible "saving..." indicator)
  Empty:   N/A
  Error:   NO — failures only logged to console via .catch(console.error), invisible to user
  Retry:   NO

Student — quiz-play autosave
  Loading: NO explicit indicator
  Empty:   N/A
  Error:   logged to console on network failure; not surfaced to user
  Retry:   NO (relies on next debounced attempt)

Teacher — quiz save (quiz-editor.html saveQuiz())
  Loading: NO disable-state on save button during request
  Empty:   N/A
  Error:   depends on fetch's own handling (not verified as user-facing)
  Retry:   N/A — no guard against duplicate submission either
```

**Pattern**: pages that adopted `api-client.js` (3 of ~30) get consistent toast-based
error feedback. Pages that didn't get inconsistent, sometimes silent, failure
handling — most notably quiz-taking autosave, where a failed save is the single
highest-stakes failure mode in the product and is currently invisible to the user in
both `quiz-play.js` and `practice-play.js`.

---

## 11. Frontend Security Findings

Concrete, code-path-based findings only (no generic "XSS may happen" claims).

- **F-01 (see §15)**: `student/quiz-play.js` interpolates `ans.text`/`q.text`
  (teacher/admin-authored quiz content) raw into `innerHTML` at two locations
  (single-answer render and `renderFullQuiz()`), with no `esc()`/escaping helper
  defined in the file at all — inconsistent with the escaping discipline used in 11+
  other JS files in the same codebase (including `practice-play.js`, which escapes
  the same category of data).
- **F-02 (see §15)**: `static/oauth2-redirect.html` reads `error` directly from the
  URL query string and injects it unescaped into `innerHTML` via a template literal —
  a reflected value rendered as raw HTML, i.e. a DOM-based XSS vector via a crafted
  OAuth redirect URL.
- **F-03 (see §15)**: `static/js/login.js` implements post-login redirect using an
  unvalidated `returnUrl` query parameter
  (`window.location.href = decodeURIComponent(returnUrl)`) with no same-origin/
  relative-path check — a textbook open-redirect pattern (e.g.
  `/login?returnUrl=https%3A%2F%2Fevil.com`).
- **Token storage**: the auth token is stored in `localStorage`/`sessionStorage` under
  key `token` and mirrored into a non-HttpOnly cookie for Thymeleaf/SSR use. This is
  standard-but-XSS-exposed JWT storage (any XSS elsewhere, including F-01/F-02 above,
  could exfiltrate it) — not itself a new finding beyond "this architecture makes the
  XSS findings above more consequential than they'd otherwise be," but worth stating
  explicitly as the reason F-01/F-02 matter.
- **Not found (verified)**: no token/secret values were found logged via
  `console.log`, placed in a URL query string, or otherwise leaked; `document.write`
  is not used anywhere; `target="_blank"` usage was not flagged as unsafe in the
  files reviewed (no `rel="noopener"` gaps were surfaced by the agents' searches,
  though this specific check was not exhaustively covered across all 47 templates and
  should be spot-checked in the closing sprint if `target="_blank"` links to
  user-controlled URLs are found).

---

## 12. Performance Findings

Static analysis only — no Lighthouse run was performed, and no Lighthouse scores are
reported (none should be assumed).

- **Unbounded polling interval**: `fragments/question-bank-ui.js:530-541` runs
  `setInterval(...,600)` for the life of the page, calling `document.getElementById`
  twice and rewriting `innerHTML` every 600ms just to sync a badge label — never
  cleared.
- **Full-list rebuilds on small interactions**: `practice-play.js`'s
  `renderAllQuestions()` rebuilds the entire question list's `innerHTML` on every
  single answer click in "all questions" mode, rather than patching the one affected
  node — likely to show up as visible jank on larger quizzes.
- **Largest static assets**: `style.css` at 2,466 lines and `admin-categories.js` at
  1,691 lines are both large, monolithic, page-agnostic-but-page-loaded files;
  neither appears to be split or lazy-loaded.
- **Duplicate CSS as a performance-adjacent cost**: 16 files independently
  implementing toast styles, 5 files copy-pasting an identical `:root` block — this
  is shipped, parsed CSS weight with no functional benefit over a single shared file.
- **Uncleared intervals** (also noted in §8): `layout/notifications.js` (60s poll),
  `teacher/monitoring-log.js` (10s poll via `location.reload()`), and
  `student/student-home.js` (1s clock tick) all run for the life of the page without
  `clearInterval` — low practical impact in this full-page-reload architecture (no
  SPA re-init to compound the leak), but worth cleaning up on principle.
- No image-size, blocking-script, or layout-thrashing evidence beyond the above was
  substantiated with concrete file:line citations, so none is reported here.

---

## 13. Testing Gaps

**Current state: no frontend testing exists.** No JS unit tests, no DOM tests, no
browser/E2E tests were found anywhere in the repository for the frontend layer. The
existing test investment (per the backend stabilization sprint) is entirely backend
(Maven/Testcontainers), which the CD hardening task in this same session confirmed is
green.

**Recommended minimal strategy for this project** (do not introduce a large framework):
- **Playwright**, scoped narrowly to the highest-risk flows first: login → quiz-play →
  autosave → submit → result, and teacher quiz-creation save. This is the smallest
  tool that can catch the double-submit and silent-autosave-failure classes of bug
  found in this audit, and can run headless in CI alongside the existing
  Backend Tests / Container Smoke Test jobs.
- **Spring MockMvc** for template-rendering smoke checks (e.g., "does `/admin/users`
  render without a 500, does a known fragment appear") where a full browser isn't
  needed — cheap regression coverage for the many `th:replace` fragment wiring points
  found in this audit.
- A small JS unit-test setup (e.g., plain Node + assertions, no framework) is
  justified only if/when `api-client.js` or a shared escaping/toast utility is
  consolidated in the closing sprint — testing the consolidated utility, not the 30
  page scripts individually.

---

## 14. Recommended Design System

Only primitives directly justified by measured repetition in this audit:

| Primitive | Justification (existing repetition) | Pages that would consume it |
|---|---|---|
| **Color tokens** (single `:root` source) | 128 distinct hex values, 15 separate `:root` blocks, 5 byte-identical copies | All 41 CSS files |
| **Spacing/radius tokens** | 53 distinct border-radius values, most hardcoded | All 41 CSS files |
| **Button** (primary/secondary/danger) | 102 divergent `.btn*` selectors, 4 different "submit" treatments for one action | Every page with a form or action button |
| **Modal shell** (structure + ARIA) | 5+ independently hand-built delete-confirmation modals; zero `role="dialog"`/`aria-modal` anywhere | admin-categories, admin-users, teacher-classroom-members, teacher-quizzes, question-bank-ui |
| **Toast/notification** | Real `toast.css`/`toast.js` already exist but are bypassed by 16 files | Those 16 files, consolidating onto the existing system rather than building a new one |
| **Table** (with responsive wrapper) | Two tables (`teacher-classroom-members`, several admin pages) with no or inconsistent responsive handling, vs. one page (`teacher-quizzes`) that does it correctly | teacher-classroom-members, admin-users, other admin list pages |
| **EmptyState** | Present ad hoc in 2 of 4 sampled list pages, absent in the other 2 (`student-quiz-history.html`) | Any list-rendering page |
| **PageHeader** | Heading-hierarchy inconsistency (h4 before h2, missing h1) across teacher-home, admin-home, student-home | Every dashboard-style page |

**Explicitly not recommended** (no repetition found to justify them): a Card
component (no strong duplication signal beyond general CSS noise), a form-Input
component (existing label/input patterns are already mostly correct — the gap is
`for` attributes on 1 fragment, not a systemic input-markup problem), and any
framework migration (React/Vue/Tailwind/Bootstrap-replacement) — explicitly out of
scope per the audit's own constraints and not justified by anything found.

---

## 15. Prioritized Remediation Plan

### Finding format

## F-01 — Unescaped quiz content interpolated into innerHTML in quiz-play.js

Severity: P1
Category: SECURITY / JS

Affected files/pages:
- `src/main/resources/static/js/student/quiz-play.js` (lines ~226-229, ~258-265, ~281)
- Consumed by `student/quiz-play.html` and `student/quiz-play-student.html`

Evidence:
`div.innerHTML = `...<div class="opt-text">${ans.text}</div>`` and, in
`renderFullQuiz()`, `` `<div class="fw-bold fs-5 mb-3">${q.text}</div>` `` both
interpolate question/answer text raw into `innerHTML`. The file defines no
`esc()`/`escapeHTML()` helper at all, unlike 11+ sibling files in the same codebase
(e.g. `practice-play.js` escapes the identical category of data via its own `esc()`).

Current behavior:
Any quiz/answer text containing HTML/script-like content renders as live markup in
the student's browser during quiz play.

Impact:
Stored-XSS-shaped gap. Exploitability depends on whether question/answer text is
sanitized at creation time elsewhere in the app (not re-verified here since that's
backend/creation-path territory) — but the frontend itself provides no defense at
render time, which is inconsistent with the rest of the codebase's own standard.

Recommended fix:
Add the same `esc()` helper pattern used in `practice-play.js` and other files;
route `ans.text`/`q.text` through it before interpolation, or switch these three call
sites to `textContent` assignment where a full HTML wrapper isn't needed.

Regression risk: Low — mirrors an existing, working pattern already used elsewhere in
the same codebase.

Suggested verification: Create a quiz question containing `<img src=x onerror=alert(1)>`
as its text (in a controlled/test environment) and confirm it renders as literal text,
not executes, after the fix.

---

## F-02 — Reflected error message rendered unescaped via innerHTML in oauth2-redirect.html

Severity: P1
Category: SECURITY

Affected files/pages:
- `src/main/resources/static/oauth2-redirect.html` (~lines 47-61)

Evidence:
The page reads `error` from the URL query string and injects it into the DOM via a
template literal: `` `...<p ...>${decodeURIComponent(error)}</p>...` ``, with no
escaping or sanitization of the decoded value.

Current behavior:
A crafted OAuth callback URL (e.g. `oauth2-redirect.html?error=<script>...`) renders
its `error` parameter as live HTML in the victim's browser.

Impact:
Reflected DOM-based XSS via a link an attacker could send to a user (classic
OAuth-callback-URL phishing vector), independent of any backend behavior.

Recommended fix:
Render the error value via `textContent` instead of `innerHTML`, or pass it through
an escaping helper before interpolation.

Regression risk: Low — the error message is display-only text, not markup that needs
to render as HTML.

Suggested verification: Load `oauth2-redirect.html?error=<img src=x onerror=alert(1)>`
locally and confirm it displays as literal text after the fix.

---

## F-03 — Unvalidated `returnUrl` enables open redirect after login

Severity: P1
Category: SECURITY / UX

Affected files/pages:
- `src/main/resources/static/js/login.js` (~lines 115-118)

Evidence:
`const returnUrl = params.get('returnUrl'); ... window.location.href = decodeURIComponent(returnUrl);`
with no check that the value is a relative path or same-origin URL.

Current behavior:
A login link crafted as `/login?returnUrl=https%3A%2F%2Fevil.example.com` will send
an authenticated user to an external site immediately after login.

Impact:
Open-redirect pattern, commonly used in phishing chains (a legitimate-looking login
link that redirects post-auth to a credential-harvesting or malware page).

Recommended fix:
Validate `returnUrl` is a same-origin, relative path (e.g. starts with `/` and does
not start with `//` or contain a scheme) before using it; otherwise fall back to a
safe default (e.g. the student/teacher home page).

Regression risk: Low — legitimate internal redirect links are relative paths and are
unaffected by the added check.

Suggested verification: Attempt login with `returnUrl` set to an external absolute
URL and confirm the app redirects to the safe default instead.

---

## F-04 — No autosave or unload protection in quiz-authoring fragments

Severity: P1
Category: UX

Affected files/pages:
- `src/main/resources/templates/fragments/quiz-editor.html`
- `src/main/resources/templates/fragments/question-editor.html`
- `src/main/resources/templates/teacher/teacher-quiz-create.html`

Evidence:
Grep for `beforeunload` across all three files returns zero matches. `saveQuiz()`
(`quiz-editor.html:631-676`) is the only persistence path and is only triggered by an
explicit button click; nothing warns on tab close, back-navigation, or reload while a
quiz/question set is being authored.

Current behavior:
A teacher who accidentally reloads or navigates away while creating a quiz loses all
unsaved questions/metadata with no warning.

Impact:
Direct content-loss risk for the core teacher content-creation flow — the same class
of finding the task called out as P0/P1-worthy ("teacher can accidentally lose
unsaved work").

Recommended fix:
Add a `beforeunload` handler that warns when unsaved changes exist in the quiz
editor; consider periodic local-draft persistence (localStorage) as a cheap
first step, following the same revision-tolerant pattern already proven in
`quiz-play.js`'s reconciliation logic.

Regression risk: Low-Medium — a `beforeunload` prompt is additive; a local-draft
cache needs care not to conflict with concurrent server state (the existing
`quiz-play.js` reconciliation pattern is a good template to reuse).

Suggested verification: Start creating a quiz, add a question, reload the tab, and
confirm a warning appears (post-fix) instead of silent loss.

---

## F-05 — No shared design system; measured duplication across color, radius, button, modal, and toast styles

Severity: P2
Category: CSS / MAINTAINABILITY

Affected files/pages: all 41 CSS files (see §5/§9 for exact counts).

Evidence: 128 distinct hex colors, 53 distinct border-radius values, 102 `.btn*`
selector variants, 16 independent toast re-implementations beside an unused shared
`toast.css`, 5 byte-identical copy-pasted `:root` blocks in `admin/*.css`, 206
`!important` occurrences across 30 files.

Current behavior: Any visual change (e.g. rebranding the primary color) requires
touching 15+ files individually with no guarantee of catching every instance.

Impact: High long-term maintenance cost; visible inconsistency across pages
(§5) for equivalent actions/components.

Recommended fix: Introduce one shared `tokens.css` (colors, spacing, radius, shadow)
and a small shared component stylesheet for buttons/modals/toasts; migrate pages
incrementally, starting with the 5 admin pages (identical `:root` already proves
they're consolidatable with zero behavior change).

Regression risk: Medium — requires careful visual regression checking per page
during migration since some hardcoded values may be intentionally divergent (verify
before assuming every duplicate is a mistake).

Suggested verification: Visual diff each migrated page before/after against a
reference screenshot.

---

## F-06 — Silent autosave failures in quiz-play.js and practice-play.js

Severity: P1
Category: UX / JS

Affected files/pages:
- `src/main/resources/static/js/student/quiz-play.js` (`saveToServer`, ~438-469)
- `src/main/resources/static/js/student/practice-play.js` (`selectAnswer` 712-716,
  `handleFillInput` 743-747)

Evidence: Both files' autosave fetch chains only `.catch(console.error)` (or
console-log equivalent) on failure — no toast, no visible indicator, no retry. Answer
selection appears to "just work" from the student's perspective even when the save
silently failed.

Current behavior: A student can answer questions throughout a quiz believing their
answers are saved, when a network blip caused one or more saves to fail invisibly.

Impact: Highest-stakes failure mode in the product (data loss during a graded quiz
attempt) is currently the least visible one.

Recommended fix: Surface autosave failures via the existing `toast.js` system (already
used elsewhere in the app) and/or a small persistent "last saved" indicator; consider
a lightweight retry-with-backoff for transient network failures.

Regression risk: Low — purely additive UI feedback, no change to save logic itself.

Suggested verification: Simulate a failed save (e.g. via dev-tools network throttling/
blocking) and confirm the student sees an explicit warning instead of nothing.

---

## F-07 — Public auth pages duplicate header markup instead of using the existing fragment

Severity: P2
Category: MAINTAINABILITY

Affected files/pages: `login.html`, `register.html`, `forgot-password.html`,
`index.html` (all four), vs. the unused `layout/header.html :: public-header`
fragment (lines 6-24).

Evidence: All four pages contain the identical navbar/header block by hand; none
`th:replace`s the existing `public-header` fragment. `register.html:28` contains a
comment claiming reuse ("HEADER (reuse từ index/login)") while still copy-pasting.

Current behavior: Any header change (e.g. adding a nav link) requires editing four
files identically and is prone to drift (already evidenced by the comment not
matching reality).

Impact: Maintainability only — no functional break found.

Recommended fix: Replace each inline header with
`th:replace="~{layout/header :: public-header}"`, matching how every other page in
the app already consumes the header/sidebar fragments correctly (confirmed for all
in-scope teacher/admin pages).

Regression risk: Low — the fragment already exists and presumably matches the intent
of the duplicated markup; diff carefully in case any of the four pages has since
diverged intentionally.

Suggested verification: Visual diff of all four pages before/after fragment adoption.

---

## F-08 — Duplicate/dead quiz-play route and orphaned AI-generate script

Severity: P2
Category: MAINTAINABILITY

Affected files/pages:
- `student/quiz-play.html` vs `student/quiz-play-student.html` (near-byte-identical)
- `static/js/teacher/teacher-ai-generate.js` (unreferenced by any template)
- `home.html` (unreferenced by any controller view name)

Evidence: `diff` between the two quiz-play templates shows only 3 real differences.
Grep across `src/main/resources` for `teacher-ai-generate.js` finds only the file
itself, never a `<script src>` reference. `HomeController` maps `/` to `index`, never
to a view named `home`.

Current behavior: Three files exist that either duplicate another file's job or are
never reached by any route.

Impact: Confuses future maintenance (which quiz-play file is "the real one"?) and
wastes review/audit effort on dead code.

Recommended fix: Confirm with routing/controller review which quiz-play template is
canonical and retire the other (or merge the one real difference — the resume-case
attempt-id handling — into a single template); delete or wire up
`teacher-ai-generate.js`; confirm `home.html` is truly unreachable and remove it.

Regression risk: Medium — requires confirming no external link/bookmark depends on
the seemingly-dead route before removal; do this as its own small, verifiable change,
not bundled silently into a larger refactor.

Suggested verification: Search server logs/analytics (if available) for hits to the
route serving `home.html` before deleting.

---

## F-09 — Modal accessibility gaps (no role="dialog"/aria-modal, no focus trap)

Severity: P2
Category: A11Y

Affected files/pages: every `.modal.fade` instance repo-wide (changePasswordModal,
joinClassModal, submitModal, exitModal, all delete-confirmation modals).

Evidence: repo-wide grep for `role="dialog"` and `aria-modal` returns zero hits; no
custom focus-trap/focus-return code exists anywhere.

Current behavior: Screen-reader users are not told a dialog has opened; keyboard
focus management relies entirely on unmodified Bootstrap defaults.

Impact: Meaningful accessibility gap across every modal in the product (a lot of
surface area, but a mechanical fix).

Recommended fix: Add `role="dialog"` and `aria-modal="true"` to the shared modal
markup pattern; since a modal-shell primitive is already recommended (§14, driven by
the separate finding that delete-confirm modals are duplicated 5+ times), fold this
fix into that consolidation rather than patching each modal individually.

Regression risk: Low — additive ARIA attributes, Bootstrap already supports them.

Suggested verification: Test with a screen reader (or axe-core/Lighthouse
accessibility audit) that modal open/close is announced correctly.

---

## F-10 — Unresponsive/overflow-risk tables on classroom-member and admin pages

Severity: P2
Category: RESPONSIVE

Affected files/pages: `teacher/teacher-classroom-members.html` (+ its CSS, zero
`@media` rules, no `.table-responsive` wrapper), `admin/admin-users.html` and other
admin tables (horizontal-scroll-only, zero `@media` rules).

Evidence: see §6 for exact grep-verified counts; `teacher-quizzes.css` is cited as
the working counter-example already present in the same codebase.

Current behavior: These tables have no or minimal mobile accommodation.

Impact: Degraded usability for teachers/admins on tablet/mobile widths.

Recommended fix: Apply the same responsive pattern already used successfully in
`teacher-quizzes.css` (breakpoint-based column reflow) to these pages, or at minimum
wrap `teacher-classroom-members`'s table in `.table-responsive`.

Regression risk: Low — copies an existing, working pattern.

Suggested verification: Render each page at 360/430/768px and confirm no horizontal
page overflow and legible touch targets.

---

## Answering the mobile quiz-taking question (Phase 9)

**Can a student comfortably complete a 50-question quiz on a 360px phone?**
Largely yes, with caveats. The quiz-play layout uses Bootstrap's responsive grid and
a CSS-Grid `auto-fill` question-dot navigator with no hardcoded fixed-px panel widths
found — it should reflow without horizontal overflow. The two real risks for a
50-question attempt on a small screen are not layout-shaped, they're **feedback**
and **duplication**-shaped: (1) F-06 — a silent autosave failure partway through a
long quiz is more consequential the longer the quiz is, since more answers are at
risk before the student notices; (2) the `quiz-play.html`/`quiz-play-student.html`
duplication (F-08) means a resumed attempt and a freshly started attempt take subtly
different code paths, which is exactly the scenario (resuming a long quiz after
losing connectivity) where a student is most likely to need the resume path to work
correctly.

---

## 16. Remediation Backlog

| ID | Severity | Area | Finding | Recommended fix | Scope | Dependencies |
|---|---|---|---|---|---|---|
| F-01 | P1 | SECURITY/JS | Unescaped innerHTML in quiz-play.js | Add `esc()` helper, use for text interpolation | S | None |
| F-02 | P1 | SECURITY | Unescaped reflected error in oauth2-redirect.html | Use textContent instead of innerHTML | S | None |
| F-03 | P1 | SECURITY/UX | Open-redirect via unvalidated returnUrl | Validate same-origin/relative path | S | None |
| F-04 | P1 | UX | No autosave/beforeunload in quiz authoring | Add beforeunload warning + optional local draft | M | Reuse quiz-play.js reconciliation pattern |
| F-06 | P1 | UX/JS | Silent autosave failures (quiz-play, practice-play) | Surface failures via existing toast.js | S | toast.js (already exists) |
| F-05 | P2 | CSS/MAINTAINABILITY | No shared design tokens; measured duplication | Introduce tokens.css + shared button/modal/toast styles | L | None; do incrementally |
| F-07 | P2 | MAINTAINABILITY | Public pages duplicate header instead of fragment | Adopt existing public-header fragment | S | None |
| F-08 | P2 | MAINTAINABILITY | Duplicate quiz-play route + orphaned/dead files | Consolidate route, remove/wire dead files | M | Confirm no external dependency first |
| F-09 | P2 | A11Y | Modals lack role="dialog"/aria-modal, no focus trap | Add ARIA attributes to shared modal pattern | M | Ties into F-05's modal-shell primitive |
| F-10 | P2 | RESPONSIVE | Unresponsive tables (classroom-members, admin) | Apply teacher-quizzes.css's existing responsive pattern | S | None |
| (minor) | P3 | A11Y | Heading hierarchy inconsistent (missing h1, out-of-order h2/h4) | Normalize heading levels on dashboard pages | S | None |
| (minor) | P3 | A11Y | Div/span-as-button (12 occurrences, 9 files) | Convert to `<button>` or add role/tabindex/keyboard handler | M | None |
| (minor) | P3 | JS | Two overlapping global fetch wrappers (api-client.js + script.js monkey-patch) | Consolidate onto api-client.js, migrate remaining ~27 pages | L | Needs careful per-page migration/testing |
| (minor) | P3 | PERFORMANCE | Unbounded 600ms setInterval in question-bank-ui.js | Clear interval on teardown or replace with event-driven update | S | None |
| (minor) | P3 | UX | No duplicate-submission guard on quiz-editor save, teacher-quizzes assign | Add disable-on-submit guard | S | None |

---

## 17. Implementation Waves

**Wave 1 — P0/P1 usability and correctness**
F-01, F-02, F-03 (the three security-shaped bugs), F-04 (authoring data loss), F-06
(silent autosave failures). All are small-to-medium, independently shippable, and
directly reduce real risk to users/content without touching visual design.

**Wave 2 — Responsive + accessibility**
F-09 (modal ARIA), F-10 (unresponsive tables), heading-hierarchy normalization,
div/span-as-button fixes. Evidence supports doing this as one wave since most fixes
are markup-only and don't require the design-system work below.

**Wave 3 — Design system / duplication**
F-05 (tokens + shared button/modal/toast styles), F-07 (public header fragment
adoption), F-08 (route/dead-file consolidation). Larger, benefits from being done
together since F-05's modal-shell primitive directly enables finishing F-09 properly
site-wide rather than patching each modal by hand.

**Wave 4 — performance + testability**
Unbounded interval cleanup, api-client.js consolidation (the two-fetch-wrapper
problem), and standing up the recommended Playwright + MockMvc test scaffolding
(§13) so future waves have regression coverage.

Evidence did not support a separate Wave 5 "polish" — the remaining P3 items
(duplicate-submission guards, minor consistency items) are small enough to fold into
whichever wave touches the same file, rather than justifying their own pass.

---

## Recommended Frontend Closing Sprint

**Scope for the next mission (high impact, low architectural risk, coherent):**
- F-01, F-02, F-03 — the three security-shaped bugs. Each is a small, isolated,
  independently testable fix with no dependency on anything else in this document.
- F-06 — silent autosave failure surfacing, reusing the existing `toast.js` (already
  proven in the codebase, zero new infrastructure).
- F-04 — `beforeunload` warning for quiz authoring (the local-draft-persistence
  enhancement can be deferred to a later sprint if scope needs trimming; the warning
  alone is the high-value, low-risk part).
- F-07 — public-header fragment adoption (mechanical, fragment already exists and
  works everywhere else).

This set is coherent (all reduce real user/content risk or fix an already-half-solved
problem), has no cross-dependencies, and touches a small, well-understood set of
files (4 JS files, 1 HTML file, 4 template headers).

**Explicitly NOT in the closing sprint** (defer to later waves):
- F-05 (design-system/token consolidation) — large, cross-cutting, needs its own
  dedicated pass with visual regression checking, not to be rushed alongside
  security fixes.
- F-08 (route/dead-file removal) — needs confirmation of zero external dependency on
  the seemingly-dead route before deletion; do as its own verifiable, reversible
  change.
- F-09 (modal ARIA) — better done once the modal-shell primitive from F-05 exists, to
  avoid patching 5+ modals twice.
- F-10 (responsive tables) — independent and low-risk, but not urgent enough to
  compete with the security/data-loss fixes above for the same sprint's attention.
- Any api-client.js/script.js consolidation, testing scaffolding, or design-system
  primitives beyond the public-header fragment.
