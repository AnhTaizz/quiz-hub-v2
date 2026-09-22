# QuizHub V2 — Practice Ownership Security

Evidence record for the practice-ownership hardening sprint (branch
`fix/practice-ownership-hardening`, starting from `main`
`0cdbc2dc30702f3a54d050532ea76a21657093b6`). This documents defects that
were reproduced end-to-end against the pre-fix code, not a general audit
of the practice feature.

## 1. Confirmed defects (pre-fix)

All four were reproduced with `PracticeOwnershipIntegrationTest`
(Testcontainers + MockMvc, real JWTs, two real student accounts) against
the code at commit `0cdbc2d`.

| # | Endpoint | Root cause | Impact |
| :-- | :--- | :--- | :--- |
| A | `POST /api/student/practice/start` (resume branch, `practiceId` present) | `PracticeServiceImpl.startPractice` resolved the practice with `practiceRepository.findById(request.getPracticeId())` — no comparison against the caller's user id. | Any authenticated student who knew or guessed another student's numeric `practiceId` could resume it: read its saved answers/progress and, if the requested page size differed, overwrite its `totalQuestions`. |
| B | `POST /api/student/practice/save-answer?practiceId=` | `PracticeServiceImpl.saveAnswer` resolved the practice with `practiceRepository.findById(practiceId)` and never called `getCurrentUser()` at all. | Any authenticated student could overwrite another student's saved answer for any question, silently corrupting their in-progress practice. |
| C | `POST /api/student/practice/submit` (`practiceId` present) | `PracticeServiceImpl.submitPractice` resolved the practice with `practiceRepository.findById(request.getPracticeId())` — no ownership check. | Any authenticated student could submit, grade, and permanently complete (`isCompleted=true`) another student's practice, overwriting its `PracticeDetail` rows and `correctAnswers`. |
| D | `GET /api/student/practice/history/detail?id=` | `PracticeServiceImpl.getPracticeDetail` *did* check `practice.getUser().getId().equals(user.getId())`, but on failure threw `ErrorCode.UNAUTHORIZED` → HTTP **401**. | The React `httpClient` (`frontend/src/api/httpClient.ts`) treats *any* 401 as a dead session: it clears local auth state and forces the caller back to the login screen. A student who followed a stale/shared link to someone else's practice id was logged out of their own, valid session — a self-inflicted denial of service dressed as an auth bug. |

Two related, smaller gaps were found while reading the code and are also
fixed in this sprint (not part of the original four findings, but the
same code paths):

| Gap | Where | Detail |
| :--- | :--- | :--- |
| `practiceId`/`categoryId` mismatch | `startPractice`, `submitPractice` | A request could pass its own `practiceId` together with a `categoryId` that does not match that practice's stored category. The resume/submit went ahead anyway, returning a question set for one category against a practice row tagged with another. |
| Cross-question answer injection | `saveAnswer`, `submitPractice` | Neither method verified that `selectedAnswerId` / `selectedAnswerIds` actually belonged to the `questionId` being answered — only that the answer id existed at all (`answerRepository.findById`/`findAllById`). A request could submit an answer id that belongs to a *different* question and have it scored against the wrong question's correctness. `QuizTakingServiceImpl` already has this exact check (`validateAnswersBelongToQuestion`, `ErrorCode.ANSWER_NOT_IN_QUESTION`) for the quiz-attempt path; practice had no equivalent. |

**Not fixed, deliberately out of scope** (see §5 "Remaining risks"): a
sequential practice's question set (the `Question`s a given `practiceId`
is "allowed" to answer) is not persisted anywhere until a question is
actually answered — `PracticeDetail` rows are created lazily. This means
`saveAnswer`/`submitPractice` cannot currently verify that a submitted
`questionId` belongs to the *specific set of questions this practice
session was started with*, only that the question exists and (after this
fix) that any answer id belongs to it. Closing that gap fully would
require persisting the assigned question set at `startPractice` time
(mirroring `Quiz.questions` for quiz attempts) — a larger change than
this sprint's mandate, and explicitly deferred per the task instructions
rather than attempted ad hoc.

## 2. Invariants after the fix

- **Ownership is checked before any read or mutation.** `startPractice`
  (resume branch), `saveAnswer`, `submitPractice`, and `getPracticeDetail`
  all resolve the target `Practice` via
  `PracticeRepository.findByIdAndUserId(id, callerUserId)`. A practice
  that does not exist and one that belongs to someone else are
  **indistinguishable** to the caller — both come back as an empty
  `Optional`, both are reported as `PRACTICE_NOT_FOUND` (404, code 1027).
  This mirrors the existing pattern for notification ownership
  (`NOTIFICATION_NOT_FOUND`, `NotificationServiceImpl`).
- **No 401 for "not yours."** A denied cross-owner request never comes
  back as `UNAUTHORIZED`/401 — only a missing/invalid JWT does. This
  matters specifically because the frontend's `httpClient` uses 401 as
  the signal to clear the session; conflating "not authenticated" with
  "authenticated, but not your resource" would force-log-out the caller.
- **`practiceId` must agree with `categoryId`.** When a request supplies
  both, the practice's stored `category.id` must equal the request's
  `categoryId`, or the request is rejected as `PRACTICE_NOT_FOUND` — the
  same code as a foreign/missing id, so this does not create a new,
  distinguishable error surface.
- **An answer must belong to the question it was submitted for.**
  `saveAnswer` and `submitPractice` validate every `selectedAnswerId`/
  `selectedAnswerIds` entry against `Answer.question.id == questionId`
  before it is added to `selectedAnswers` or used to compute
  `isCorrect`, raising `ANSWER_NOT_IN_QUESTION` (400, code 1044)
  otherwise — same error code `QuizTakingServiceImpl` already uses for
  the equivalent quiz-attempt check.
- **Unchanged:** grading rules, the resume-vs-new-practice matching
  query for the no-`practiceId` path, random/sequential practice
  creation, the personal (no-`practiceId`) practice flow, and the
  existing "no save after completion" rule (`PRACTICE_ALREADY_SUBMITTED`,
  400, code 1033).

## 3. API status/error codes

See `frontend/docs/API_MAP.md` (Practice section) for the row-by-row
before/after. Summary:

| Endpoint | Case | Before | After |
| :--- | :--- | :--- | :--- |
| `POST /start` (resume) | foreign/missing `practiceId` | 200 (silently resumed) | 404 `PRACTICE_NOT_FOUND` |
| `POST /start` (resume) | own `practiceId`, mismatched `categoryId` | 200 | 404 `PRACTICE_NOT_FOUND` |
| `POST /save-answer` | foreign/missing `practiceId` | 200 (silently saved) | 404 `PRACTICE_NOT_FOUND` |
| `POST /save-answer` | answer belongs to a different question | 200 (silently mis-scored) | 400 `ANSWER_NOT_IN_QUESTION` |
| `POST /submit` | foreign/missing `practiceId` | 200 (silently completed/graded) | 404 `PRACTICE_NOT_FOUND` |
| `POST /submit` | answer belongs to a different question | 200 (silently mis-scored) | 400 `ANSWER_NOT_IN_QUESTION` |
| `GET /history/detail` | foreign/missing `id` | 401 `UNAUTHORIZED` | 404 `PRACTICE_NOT_FOUND` |
| any of the above | owner, valid request | 200 | 200 (unchanged) |
| any of the above | no/invalid JWT | 401 | 401 (unchanged) |

Legacy Thymeleaf pages do not call these REST endpoints directly (the
migrated React practice player is the only caller per
`frontend/docs/MIGRATION_PARITY.md`), so there is no legacy-page impact.

## 4. Test coverage

`src/test/java/com/example/quizhub/integration/PracticeOwnershipIntegrationTest.java`
— Testcontainers (`postgres:15-alpine`) + `MockMvc`, two real student
accounts (A, B) with real JWTs, a shared category with three PUBLIC
questions, and pre-seeded `Practice`/`PracticeDetail` rows for B.

17 tests, covering:

- A cannot resume, save into, submit, or read B's practice (each
  asserted at both the HTTP-status level and by re-reading B's row from
  the database afterward to prove it was not mutated).
- A foreign id and a non-existent id produce byte-identical responses
  (status + body, timestamp excluded) for both `save-answer` and
  `history/detail`.
- The owner can still resume, save into, submit, and read their own
  practice (regression coverage for the legitimate path).
- A `practiceId`/`categoryId` mismatch on the caller's *own* practice is
  rejected.
- An answer id from a different question is rejected on both
  `save-answer` and `submit`, and does not leave the practice
  half-graded.
- Saving after the owner's own practice is completed still returns
  `PRACTICE_ALREADY_SUBMITTED` (existing rule, unchanged).
- No JWT → 401; a valid JWT for the wrong owner → never 401.
- A multi-answer submit where one answer is ownership-invalid rolls back
  the *entire* transaction, including any earlier, valid answer already
  `save()`d in the same call — verified by direct `JdbcTemplate` reads
  against Postgres, not the JPA entity (added during the verification
  pass, see §5).

RED (pre-fix, commit `6ae76d3`): 16 tests, 10 failures, 0 errors.
GREEN (post-fix, commit `64ac144`): 16 tests, 0 failures, 0 errors.
GREEN (verification pass, commit below): 17 tests (added the rollback
proof), 0 failures, 0 errors.

## 5. Remaining risks (not fixed this sprint)

- **Sequential practice has no persisted question set** (see §1). Until
  a question is answered, nothing records that it is part of a given
  `practiceId`'s session. This sprint's fix stops a caller from
  operating on *someone else's* practice, and stops an answer from being
  attributed to the wrong question, but it does not stop the *owner* of
  a practice from submitting an answer for a `questionId` that was never
  part of that session's original question set (e.g. one from a sibling
  category). Recommended follow-up: persist the assigned question ids at
  `startPractice` time (a `PracticeQuestion` join table or similar,
  mirroring `Quiz.questions`) and validate `questionId` membership the
  same way `QuizTakingServiceImpl.validateQuestionInQuiz` does. Suggested
  test: an owner submits a `questionId` from a category never part of
  their practice's original range/category tree.
- **CORRECTED (verified, was wrong in the original version of this
  document):** this document previously claimed that `submitPractice`
  could leave earlier, valid answers persisted if a later answer in the
  same multi-answer payload failed `ANSWER_NOT_IN_QUESTION` validation,
  because `PracticeDetail` rows are saved question-by-question inside the
  loop rather than after a QuizTakingServiceImpl-style upfront
  `validateSubmitPayload` pass. **That claim was wrong.**
  `submitPractice` is `@Transactional`, `AppException extends
  RuntimeException`, and Spring's default rollback rule rolls back on
  any unchecked exception — so when `validateAnswerBelongsToQuestion`
  throws partway through the loop, the entire transaction (including any
  `PracticeDetail` rows already `save()`d earlier in the same call) rolls
  back, not just `isCompleted`/`correctAnswers`. This is now verified by
  `submitRollsBackEarlierValidAnswersWhenALaterAnswerFailsValidation`: it
  submits a valid answer for one question followed by an
  ownership-invalid answer for a second, then re-reads
  `_practice_detail` via a plain `JdbcTemplate` count (not the JPA
  entity, not a cached persistence context — a query that can only see
  what Postgres actually committed) and asserts **zero** rows exist for
  that practice afterward. `PracticeServiceImpl.submitPractice` does
  **not** need the `validateSubmitPayload`-style upfront-validation
  refactor that `QuizTakingServiceImpl` uses; the outcome is already
  equivalent (all-or-nothing) via transactional rollback, just achieved
  differently. No code change was needed for this item.
- **`saveAnswer`/`submitPractice` still trust `answerRepository.findById`
  silently returning nothing** for a `selectedAnswerId` that does not
  exist at all (as before this sprint) — this is existing, unchanged
  behavior (the answer is simply omitted from `selectedAnswers`), not a
  new gap, but is called out here for completeness since it sits next to
  the code this sprint touched.

## 6. Numbers in this document

All test counts and commit references above are as of commit `64ac144`
on `fix/practice-ownership-hardening`. If this file is read significantly
later, re-run `PracticeOwnershipIntegrationTest` and diff against current
`main` before trusting these numbers.
