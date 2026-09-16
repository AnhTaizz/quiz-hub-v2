# Student Quiz List — Query Scaling Baseline

## Method Measured

```
StudentHomeServiceImpl.getAllQuizzes(String email)
```

This method loads all assigned quizzes across a student's approved
classrooms and enriches each with attempt metadata (`attemptsMade`,
`attemptsLeft`, `hasStarted`, `hasUnfinished`).

## Fixture Design

| Dimension                  | Value           |
|----------------------------|-----------------|
| Students                   | 1               |
| Approved classrooms        | 1               |
| Assignments per workload   | 10 / 50 / 100   |
| QuizTaking per assignment  | 1 (completed)   |
| Attempt per taking         | 1 (finished)    |
| Hidden assignment (guard)  | 1               |

Each workload uses a unique quiz per assignment. One hidden assignment
is added to verify it does not leak into the result.

## Environment

- PostgreSQL 15-alpine via Testcontainers
- Hibernate Statistics (`getPrepareStatementCount()`)
- `entityManager.clear()` before measurement to prevent
  persistence-context reuse
- Fixture creation excluded from measurement window

## Baseline Results

```
                     10Q      50Q      100Q
SQL queries           25      105       206
elapsed ms           383      715      1477
```

> **Timing disclaimer:** Elapsed milliseconds are diagnostic only and
> depend on hardware, container startup order, JVM warmth, and other
> factors. They are not suitable for regression assertions. Only the
> SQL query count trend is meaningful for characterization.

## Classification

**LINEAR-SUSPICIOUS**

Query count grows roughly proportional to the number of assigned
quizzes:

| N   | Queries | Queries / N |
|-----|---------|-------------|
| 10  |      25 |        2.5  |
| 50  |     105 |        2.1  |
| 100 |     206 |        2.06 |

The ratio converges to approximately **2 queries per assignment**
plus a small constant overhead, indicating linear growth with the
assignment count.

## Analysis

The production code iterates over each `QuizAssigning` and issues:

1. `quizTakingRepository.findByLearnerIdAndQuizAssigningId()` — 1 query per assignment
2. `attemptRepository.findByQuizTakingId()` — 1 query per taking (when taking exists)

This accounts for the ~2× linear factor observed.

Additional constant-overhead queries include:

- `userRepository.findByEmail()` — 1
- `classJoiningRepository.findByLearnerIdAndStatusIn()` — 1
- `quizAssigningRepository.findByClassroomId()` — 1 per classroom
- Lazy-loading of related entities (`Quiz`, `Classroom`) triggered by
  access patterns within the loop

## Conclusion

Query count grows with the number of assigned quizzes. This identifies
`getAllQuizzes()` as a scaling hotspot.

The exact SQL statements responsible have not yet been established at
the individual statement level and should be traced before optimization.

## Next Investigation Target

A statement-level SQL trace (similar to `QuizSubmitSqlTraceTest`) should
be created to:

1. Identify each distinct SQL statement and its per-workload count
2. Confirm which repository calls are responsible for the linear growth
3. Inform a bulk-fetch optimization strategy
