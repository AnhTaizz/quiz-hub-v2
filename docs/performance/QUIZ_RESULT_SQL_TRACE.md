# Quiz Result SQL Trace (V2-024)

## 1. V2-023 Baseline

The V2-023 benchmark recorded the following SQL scaling trend for `getQuizResult()`:

```text
Questions          50      100      200
SQL queries        11       13       18
```

This demonstrated a mild scale factor, ruling out a classic N+1 problem (which would scale strictly at `+N` or greater). 

## 2. SQL Frequency Table

A dedicated SQL tracing test `QuizResultSqlTraceTest` using `SqlCaptureInspector` was executed against the exact same 50/100/200 workloads.

The statements were grouped and normalized as follows:

| SQL Template | 50Q | 100Q | 200Q | Classification |
| :--- | :--- | :--- | :--- | :--- |
| `select a1_0.id,a1_0... from _attempt a1_0 where a1_0.id=?` | 1 | 1 | 1 | CONSTANT |
| `select u1_0.id,u1_0... from _user u1_0 where u1_0.id=?` | 1 | 1 | 1 | CONSTANT |
| `select qt1_0.id,qt1_0... from _quiz_taking qt1_0 where qt1_0.id=?` | 1 | 1 | 1 | CONSTANT |
| `select qa1_0.id,qa1_0... from _quiz_assigning qa1_0 where qa1_0.id=? and (qa1_0.is_deleted = false)` | 1 | 1 | 1 | CONSTANT |
| `select c1_0.id,c1_0... from _classroom c1_0 where c1_0.id=? and (c1_0.is_deleted = false)` | 1 | 1 | 1 | CONSTANT |
| `select uaa1_0.id,uaa1_0... from _user_attempt_answer uaa1_0 left join _attempt a1_0 on a1_0.id=uaa1_0.attempt_id where a1_0.id=?` | 1 | 1 | 1 | CONSTANT |
| `select q1_0.id,q1_0... from _quiz q1_0 where q1_0.id=?` | 1 | 1 | 1 | CONSTANT |
| `select q1_0.quiz_id,q1_1.id... from _question_creating q1_0 join _question q1_1 on q1_1.id=q1_0.quest_id where q1_0.quiz_id=?` | 1 | 1 | 1 | CONSTANT |
| `select a1_0.question_id,a1_0.id,a1_0.is_correct,a1_0.text from _answer a1_0 where a1_0.question_id = any (?)` | **3** | **5** | **10** | **GROWING** |
| **TOTAL** | **11** | **13** | **18** | |

## 3. Growing SQL Family

The exact growing statement is:
```sql
select a1_0.question_id,a1_0.id,a1_0.is_correct,a1_0.text from _answer a1_0 where a1_0.question_id = any (?)
```
This is the retrieval of `Answer` entities mapped to the initialized `Question` instances.

## 4. Delta Explanation

The baseline query counts are perfectly mathematically explained by the combination of fixed constant overhead and the batched answer fetches.

- Fixed overhead: **8 queries**
- `_answer` batched fetches: **3 / 5 / 10**

Total SQL queries:
- 50Q: `8 + 3 = 11`
- 100Q: `8 + 5 = 13`
- 200Q: `8 + 10 = 18`

**How does the delta occur?**
The batch fetch step function explains the exact query delta across scale.
- 50 → 100: +2 queries explained by answer batches increasing by +2
- 100 → 200: +5 queries explained by answer batches increasing by +5

## 5. Mechanism Classification

**Classification: BATCHED LAZY-LOAD SCALING**

The `Question` entity maps its `answers` collection with `@BatchSize(size = 20)`. 
When iterating over uninitialized collections, Hibernate delays the initialization until access and fetches up to 20 collections at once using an `IN` clause. 

The scaling function is mathematically:
`batches = ceil(Questions / 20)`

- 50Q → `ceil(50 / 20) = 3` batched queries
- 100Q → `ceil(100 / 20) = 5` batched queries
- 200Q → `ceil(200 / 20) = 10` batched queries

There is NO classic N+1 behavior observed here.

## 6. Root Cause in Production Code

The batched fetching is triggered inside `QuizTakingServiceImpl.getQuizResult()`. When compiling the result payload for each question, the collection is accessed inside the `.stream()` mapping loop.

For example:
```java
// QuizTakingServiceImpl.java (Line 508, 513, 520)
isCorrect = q.getAnswers().stream()...
List<Long> correctIds = q.getAnswers().stream()...
List<QuizResultResponseDTO.AnswerResultDTO> answerResults = q.getAnswers().stream()...
```
When `q.getAnswers()` is called on an uninitialized question, Hibernate executes the `_answer` batched query for the next 20 uninitialized questions in the persistence context. 

## 7. Recommended V2-025

The batch fetch protects the system from N+1 degradation, but we can eliminate the step-scaling completely. 
**Recommended narrowly scoped optimization:** Bulk-fetch all answers for the quiz's questions before iterating over them to build the result DTOs. A single `answerRepository.findByQuestionIdIn(...)` could resolve all lazy proxies in `O(1)` query, reducing the total query cost to exactly 9 queries regardless of quiz size.
