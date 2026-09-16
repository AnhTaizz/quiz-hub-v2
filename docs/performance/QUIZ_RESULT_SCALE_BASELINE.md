# Quiz Result Scale Baseline (V2-023)

## 1. Goal

Measure how `QuizTakingServiceImpl.getQuizResult(...)` scales in SQL query execution as the number of questions in a quiz increases.

## 2. Methodology

A benchmark test `QuizResultScaleBenchmarkTest` was created with a real PostgreSQL database (via Testcontainers) to isolate the execution of `getQuizResult(...)`.

- Three identical quiz scenarios were created containing **50**, **100**, and **200** questions.
- Each question was set as `SINGLE_CHOICE` with 4 answers (1 correct, 3 incorrect).
- A completed attempt was prepared with the student correctly answering every single question.
- The `QuizAssigning.showAnswer` field was set to `true` to ensure full diagnostic payloads were returned.
- To simulate production behavior (like Spring's Open Session in View), `getQuizResult` was executed inside a transaction boundary.
- The persistence context and Hibernate statistics were cleared immediately prior to the execution to ensure we captured cold cache database retrieval.

## 3. Measurements

The following results trace the total number of SQL queries and elapsed time for the `getQuizResult` method execution:

| Metric | 50 Questions | 100 Questions | 200 Questions |
| :--- | :--- | :--- | :--- |
| **SQL queries** | 12 | 13 | 18 |
| **Elapsed ms** | 468 | 365 | 193 |

*(Note: Timing variances [468ms -> 193ms] are typical of JVM/Hibernate warmup phases executing in sequence and are strictly diagnostic).*

## 4. Classification

**Classification: MILD SCALING**

The query count grows in small steps (12 -> 13 -> 18) rather than strictly linearly (e.g. 50 -> 100 -> 200). This evidence rules out a pure strict `N+1` per-question scaling problem. The mild growth is consistent with Hibernate batch fetching (e.g., `@BatchSize`) being exhausted and triggering additional batched `SELECT ... WHERE ... IN (...)` queries for deeper associations (like user selected answers or answer options).

## 5. Correctness

For all workloads, the integrity of the returned `QuizResultResponseDTO` was asserted and proven correct:
- Total questions correctly matched N.
- Total correct answers correctly matched N (0 incorrect).
- Each question returned exactly 4 answers.
- Each question returned a populated list of `selectedAnswerIds`.
- The overall attempt ID tied back perfectly.
