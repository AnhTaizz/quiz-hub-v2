# Quiz Result Scale Baseline (V2-023)

## 1. Goal

Measure how `QuizTakingServiceImpl.getQuizResult(...)` scales in SQL query execution as the number of questions in a quiz increases.

## 2. Methodology

A benchmark test `QuizResultScaleBenchmarkTest` was created with a real PostgreSQL database (via Testcontainers) to isolate the execution of `getQuizResult(...)`.

- Three identical quiz scenarios were created containing **50**, **100**, and **200** questions.
- Before measuring each workload, all database fixtures were completely cleared, and fresh fixtures were inserted specifically for that size limit.
- Each question was set as `SINGLE_CHOICE` with 4 answers (1 correct, 3 incorrect).
- A completed attempt was prepared with the student correctly answering every single question.
- The `QuizAssigning.showAnswer` field was set to `true` to ensure full diagnostic payloads were returned.
- The measured service invocation is executed inside a test transaction so Hibernate lazy relationships used by `getQuizResult()` remain accessible.
- The persistence context was cleared immediately prior to the execution to ensure we captured cold cache database retrieval.
- Hibernate Statistics was used as the authoritative query count mechanism.

## 3. Measurements

The following results trace the total number of SQL queries and elapsed time for the `getQuizResult` method execution:

| Metric | 50 Questions | 100 Questions | 200 Questions |
| :--- | :--- | :--- | :--- |
| **SQL queries** | 11 | 13 | 18 |
| **Elapsed ms** | 929 | 504 | 405 |

*(Note: Timing variances are typical of JVM/Hibernate warmup phases executing in sequence and are strictly diagnostic).*

## 4. Interpretation

**Classification: MILD SCALING**

Query count increases with quiz size, but much more slowly than one query per question. The exact SQL statement(s) responsible have not yet been identified. 

The shape may be compatible with batched fetching, but this remains a hypothesis until statement-level SQL tracing is performed. 

## 5. Correctness

For all workloads, the integrity of the returned `QuizResultResponseDTO` was asserted and proven correct:
- `attemptId` matches.
- `totalNum` == N.
- `correctNum` == N.
- `incorrectNum` == 0.
- `questions.size` == N.
- Exactly 4 answers/question.
- Exactly one selected answer/question (`selectedAnswerIds` has size 1).
- `isCorrect` == true.
- `score` == 10.00.

## 6. Next step

Statement-level SQL tracing before considering any optimization.

## 7. V2-025 Resolution (Backend Closing Sprint)

After bulk-fetching `getQuizResult()`'s answers (see `QUIZ_RESULT_SQL_TRACE.md` section 8), re-running this benchmark shows the query count is now flat:

| Metric | 50 Questions | 100 Questions | 200 Questions |
| :--- | :--- | :--- | :--- |
| **SQL queries (before)** | 11 | 13 | 18 |
| **SQL queries (after)** | **9** | **9** | **9** |

Correctness assertions (attemptId, totalNum, correctNum, incorrectNum, questions.size, answers/question, selectedAnswerIds, isCorrect, score) all continue to pass unchanged.
