# Student Quiz List — SQL Scaling Trace

## 1. Trace Workloads (V2-021 Before, V2-022 After)

The following tables show query executions for identical API requests varying only the number of assigned quizzes in the dashboard.

### Before V2-022 (Linear Scaling)

| SQL Table / Entity | 10 Assignments | 50 Assignments | 100 Assignments | Classification |
| :--- | :--- | :--- | :--- | :--- |
| `_user` (SELECT by email) | 1 | 1 | 1 | CONSTANT |
| `_class_joining` (SELECT by learner_id and status) | 1 | 1 | 1 | CONSTANT |
| `_classroom` (SELECT by id) | 2 | 2 | 2 | CONSTANT |
| `_quiz_assigning` (SELECT by classroom_id) | 1 | 1 | 1 | CONSTANT |
| `_quiz_taking` (SELECT by learner_id and assigning_id) | 10 | 50 | 100 | **PER-ASSIGNMENT** |
| `_attempt` (SELECT by taking_id) | 10 | 50 | 100 | **PER-ASSIGNMENT** |
| | | | | |
| **TOTAL QUERIES** | **25** | **105** | **~205** | **LINEAR (~2N)** |

*Note: In some runs, a background scheduler fired a query against `_attempt` (ended_at is null), bringing the 100-assignment total to 206.*

### After V2-022 (Constant Scaling)

| SQL Table / Entity | 10 Assignments | 50 Assignments | 100 Assignments | Classification |
| :--- | :--- | :--- | :--- | :--- |
| `_user` | 1 | 1 | 1 | CONSTANT |
| `_class_joining` | 1 | 1 | 1 | CONSTANT |
| `_classroom` | 2 | 2 | 2 | CONSTANT |
| `_quiz_assigning` | 1 | 1 | 1 | CONSTANT |
| `_quiz_taking` | 1 | 1 | 1 | **CONSTANT (Bulk)** |
| `_attempt` | 1 | 1 | 1 | **CONSTANT (Bulk)** |
| | | | | |
| **TOTAL QUERIES** | **7** | **7** | **7** | **CONSTANT** |

## 2. Proven Cause of Original N+1

The observed scaling (25 → 105 → 206) before V2-022 was driven by two independent `PER-ASSIGNMENT` SELECT queries executed in a loop over visible assignments:

1. **Hypothesis A — QuizTaking:** The query `select qt1_0.id... from _quiz_taking qt1_0 left join _user l1_0... left join _quiz_assigning qa1_0... where l1_0.id=? and qa1_0.id=?` scaled linearly (10, 50, 100). This confirmed `quizTakingRepository.findByLearnerIdAndQuizAssigningId` ran once per assignment.

2. **Hypothesis B — Attempt:** The query `select a1_0.id... from _attempt a1_0 left join _quiz_taking qt1_0... where qt1_0.id=?` scaled linearly (10, 50, 100). This confirmed `attemptRepository.findByQuizTakingId` ran once per taking (which corresponds to once per assignment in this scenario).

There is no other scaling SQL. Other lazy relationships (e.g., `Classroom`, `Quiz` nested within `QuizAssigning`) were handled efficiently or grouped into the main `_quiz_assigning` query via joins.

## 3. Conclusion

The `StudentHomeServiceImpl.getAllQuizzes(String email)` method previously suffered from a strict linear `2N` query scaling problem relative to the number of visible assigned quizzes.

To stabilize performance in V2-022, both `_quiz_taking` and `_attempt` reads were converted to bulk `IN (...)` queries based on the collection of visible assignment IDs. The query execution count is now constant (7 queries) irrespective of the number of visible assigned quizzes.
