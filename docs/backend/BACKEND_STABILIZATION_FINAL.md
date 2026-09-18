# QuizHub V2 — Backend Stabilization (Final)

This document summarizes the state of the quiz-taking backend
(`QuizTakingServiceImpl` and its collaborators) after the backend
closing sprint. It is evidence of the invariants the backend enforces,
not a feature description.

## 1. Lifecycle invariants

- **Attempt ownership.** Every mutating and reading entry point
  (`saveAnswer`, `submitQuizAttempt`, `recordViolation`,
  `getQuizResult`, `getQuizTakingState`) verifies the requesting
  student owns the attempt before acting on it. Teachers/admins may
  read attempt state; students may not act on another student's
  attempt.
- **Revision-aware autosave.** `saveAnswer` and `submitQuizAttempt`
  compare an incoming `revision` against
  `findMaxRevisionByAttemptIdAndQuestionId` and only apply a write
  when it is strictly newer (or when no revision has been persisted
  yet for an unversioned/legacy request). A stale or duplicate
  revision is ignored, not applied.
- **Stale-write protection.** The delayed-arrival case (an older
  autosave arriving after a newer one) cannot overwrite the newer
  state, because the newer revision is already persisted and the
  stale request's revision check fails.
- **Idempotent submit.** Submitting an already-completed attempt
  returns the existing persisted result without re-finalizing,
  re-scoring, or sending a second notification.
- **Concurrent submit safety.** `submitQuizAttempt` and `saveAnswer`
  both acquire `PESSIMISTIC_WRITE` on the attempt via
  `findWithLockById` before reading `endedAt`, so a submit racing an
  autosave for the same attempt serializes at the database.

## 2. Entity integrity (ownership boundaries)

- A `saveAnswer`/`submitQuizAttempt` request's `questionId` must
  belong to the attempt's own quiz (`validateQuestionInQuiz`), or the
  request is rejected with `QUESTION_NOT_IN_QUIZ` (400).
- Every `answerId` in a request must exist and belong to the exact
  question being answered (`validateAnswersBelongToQuestion`), or the
  request is rejected with `ANSWER_NOT_FOUND` / `ANSWER_NOT_IN_QUESTION`
  (400). This also rejects an answer that belongs to a *different*
  question within the *same* quiz.
- `submitQuizAttempt`'s multi-question payload is validated in full
  (`validateSubmitPayload`) — every question and every answer —
  *before* any `UserAttemptAnswer` row is mutated, so one malformed
  entry cannot leave a partially-applied submission.
- Duplicate answer IDs in a single request are normalized to distinct
  IDs before persistence (`replaceQuestionState`), so a client cannot
  create duplicate `UserAttemptAnswer` rows that would distort
  grading. This was a deliberate policy choice over rejecting
  duplicates as malformed input, since a normalize-and-accept policy
  is more tolerant of client bugs without changing grading semantics.

## 3. Attempt semantics

- `maxAttempt == null` or `maxAttempt <= 0` means **unlimited**
  attempts, consistent with `QuizAssigningServiceImpl` and
  `StudentHomeServiceImpl`. `startQuizAttempt` previously enforced the
  limit whenever `maxAttempt != null`, so `maxAttempt = 0` incorrectly
  behaved as "zero attempts allowed."
- `maxAttempt > 0` is still a hard cap: once that many attempts have
  `endedAt != null`, a further `startQuizAttempt` call throws
  `MAX_ATTEMPTS_REACHED`.

## 4. Result security (answer visibility)

`getQuizResult` reveals questions, answers, `isCorrect`,
`correctNum`, and `incorrectNum` only when:

- the requester is a teacher/admin, **or**
- the quiz is personal (no `QuizAssigning`), **or**
- the teacher explicitly set `showAnswer = true`, **or**
- the assignment's `dueDate` exists and has already passed.

A missing `dueDate` is **not** treated as a passed deadline — it used
to be, which meant an assigned quiz with `showAnswer = false` and no
due date leaked correct answers immediately after submission. That
edge case is now closed.

## 5. Concurrency

- **Violation threshold.** `recordViolation` acquires
  `PESSIMISTIC_WRITE` on the attempt as its first statement, before
  the `endedAt` check, the violation insert, and the
  threshold/auto-submit decision. Two concurrent violation requests
  that would both cross the auto-submit threshold (3) now serialize:
  the loser observes the attempt already finalized and does not
  append another violation or trigger a second finalization.
- **Competing finalization paths.** Manual submit
  (`submitQuizAttempt`), the violation auto-submit
  (`recordViolation`), and the scheduled expiration sweep
  (`autoSubmitExpiredAttempts`) all converge on the same
  `findWithLockById` + `finalizeAttempt` pattern. The scheduled sweep
  was rewritten to scan candidate attempt **IDs only**
  (`findActiveAttemptIdsWithAssigning`) rather than hydrating full
  `Attempt` entities before the locked re-fetch — hydrating them
  first meant the "locked" re-fetch returned the same (stale) Java
  object from Hibernate's persistence-context identity map instead of
  the freshly committed row, silently defeating the intended
  stale-state re-check. With the ID-only scan, the locked fetch is
  the first hydration of each `Attempt` in that session, so the
  re-check is genuinely fresh.

## 6. Performance evidence

### Quiz result page (`getQuizResult`)

`Question.answers`'s `@BatchSize(20)` lazy-load meant `_answer`
queries scaled with question count. Bulk-fetching all answers for the
quiz in one `answerRepository.findByQuestionIdIn(...)` call, and
replacing the per-question `userAnswers` re-scan (an O(Q²) pattern)
with a map built once, made the query count constant:

| Metric | 50Q | 100Q | 200Q |
| :--- | :--- | :--- | :--- |
| `_answer` fetches (before) | 3 | 5 | 10 |
| `_answer` fetches (after) | **1** | **1** | **1** |
| Total SQL (before) | 11 | 13 | 18 |
| Total SQL (after) | **9** | **9** | **9** |

### Submit (`submitQuizAttempt`)

Query count stays flat at every scale (constant `_answer` fetches
added by the new ownership-validation query, but not growing with
question count):

| Metric | 50Q | 100Q | 200Q |
| :--- | :--- | :--- | :--- |
| Total SQL | 15 | 15 | 15 |

### Student quiz list

Unaffected by this sprint's changes; still constant:

| Metric | 10 assignments | 50 | 100 |
| :--- | :--- | :--- | :--- |
| Total SQL | 7 | 7 | 7 |

## 7. Test evidence

Final full suite (`mvnw clean test`):

```text
Tests run: 73
Failures: 0
Errors: 0
Skipped: 0
BUILD SUCCESS
```

Package (`mvnw -DskipTests package`): `BUILD SUCCESS`.

New focused test classes added this sprint:

- `QuizAnswerOwnershipSecurityIntegrationTest` — cross-quiz/cross-question injection rejection, whole-payload validation before mutation, duplicate answer ID normalization.
- `QuizMaxAttemptSemanticsIntegrationTest` — `maxAttempt` null/0/positive semantics.
- `QuizResultVisibilitySecurityIntegrationTest` — showAnswer/deadline/personal-quiz visibility edge cases.
- `QuizViolationConcurrencyIntegrationTest` — concurrent violation-threshold race.
- `QuizFinalizationConcurrencyIntegrationTest` — manual submit vs. scheduled sweep race.
