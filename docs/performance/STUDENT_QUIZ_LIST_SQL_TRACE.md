# Student Quiz List — SQL Scaling Trace

## Baseline

From `StudentQuizListScaleBenchmarkTest` (V2-020) and confirmed by `StudentQuizListSqlTraceTest`:
- 10 assignments → 25 SQL queries
- 50 assignments → 105 SQL queries
- 100 assignments → 206 SQL queries

## Trace table

| SQL family/table | 10 | 50 | 100 | Classification |
| --- | --- | --- | --- | --- |
| `_user` (SELECT by email) | 1 | 1 | 1 | CONSTANT |
| `_class_joining` (SELECT by learner_id and status) | 1 | 1 | 1 | CONSTANT |
| `_classroom` (SELECT by id) | 2 | 2 | 2 | CONSTANT |
| `_quiz_assigning` (SELECT by classroom_id) | 1 | 1 | 1 | CONSTANT |
| `_quiz_taking` (SELECT by learner_id and assigning_id) | 10 | 50 | 100 | PER-ASSIGNMENT |
| `_attempt` (SELECT by taking_id) | 10 | 50 | 100 | PER-ASSIGNMENT |
| `_attempt` (SELECT ended_at is null) | 0 | 0 | 1 | CONSTANT (auto-submit) |

*Note: The final query (`_attempt` ended_at is null) is an unrelated scheduled task (auto-submit) that occasionally executes during tests and contributes to total variation (e.g., 206 total queries).*

## Proven cause

The observed scaling (25 → 105 → 206) is driven by two independent `PER-ASSIGNMENT` SELECT queries executed in a loop over visible assignments:

1. **Hypothesis A — QuizTaking:** Proven. The query `select qt1_0.id... from _quiz_taking qt1_0 left join _user l1_0... left join _quiz_assigning qa1_0... where l1_0.id=? and qa1_0.id=?` scales linearly (10, 50, 100). This confirms `quizTakingRepository.findByLearnerIdAndQuizAssigningId` runs once per assignment.

2. **Hypothesis B — Attempt:** Proven. The query `select a1_0.id... from _attempt a1_0 left join _quiz_taking qt1_0... where qt1_0.id=?` scales linearly (10, 50, 100). This confirms `attemptRepository.findByQuizTakingId` runs once per taking (which corresponds to once per assignment in this scenario).

There is no other scaling SQL. Other lazy relationships (e.g., `Classroom`, `Quiz` nested within `QuizAssigning`) were handled efficiently or grouped into the main `_quiz_assigning` query via joins.

## Terminology

The query pattern in `StudentHomeServiceImpl.getAllQuizzes` exhibits an **N+1 query pattern**, driven by two independent operations per assignment:
- An N+1 pattern caused by `quizTakingRepository.findByLearnerIdAndQuizAssigningId(studentId, assigningId)`.
- An N+1 pattern caused by `attemptRepository.findByQuizTakingId(takingId)`.

This results in a total of 2N queries executed per N visible assignments.

## Optimization candidates

To eliminate the 2N scaling, consider the following optimization candidates:
- Bulk fetch `QuizTaking` for a student and a list of `assigningIds` (e.g., `findByLearnerIdAndQuizAssigningIdIn`).
- Bulk fetch `Attempt` grouped by a list of `takingIds` (e.g., `findByQuizTakingIdIn`).
- Use a custom repository projection to fetch all `QuizDashboardInfoDTO` fields (including metadata like counts) in a single query by joining `_quiz_assigning`, `_quiz_taking`, and `_attempt`.
