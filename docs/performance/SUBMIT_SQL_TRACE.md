# Submit SQL Scaling Trace

## Baseline
* **50Q**: 16 queries
* **100Q**: 18 queries
* **200Q**: 23 queries

## Actual SQL Frequency Table

```text
SQL template                                                                                |  50Q | 100Q | 200Q
----------------------------------------------------------------------------------------------------------------
insert into notifications (created_at,is_read,link,message,title,type,user_id) values ...   |    1 |    1 |    1
select a1_0.id,a1_0.correct_num,a1_0.ended_at ... from _attempt a1_0 where a1_0.id=? ...    |    1 |    1 |    1
select a1_0.question_id,a1_0.id,a1_0.is_correct,a1_0.text from _answer a1_0 where ...       |    3 |    5 |   10
select c1_0.id,c1_0.code,c1_0.created_at ... from _classroom c1_0 where c1_0.id=? ...       |    1 |    1 |    1
select max(uaa1_0.revision) from _user_attempt_answer uaa1_0 where ...                      |    1 |    1 |    1
select q1_0.id,q1_0.category_id,q1_0.created_at ... from _quiz q1_0 where q1_0.id=?         |    1 |    1 |    1
select q1_0.quiz_id,q1_1.id,q1_1.category_id ... from _question_creating q1_0 join ...      |    1 |    1 |    1
select qa1_0.id,qa1_0.answer_shuffled ... from _quiz_assigning qa1_0 where qa1_0.id=? ...   |    1 |    1 |    1
select qt1_0.id,qt1_0.is_assigned,qt1_0.learner_id ... from _quiz_taking qt1_0 where ...    |    1 |    1 |    1
select u1_0.id,u1_0.avatar_url,u1_0.created_at ... from _user u1_0 where u1_0.id=?          |    2 |    2 |    2
select uaa1_0.id,uaa1_0.answer_id ... from _user_attempt_answer uaa1_0 left join ...        |    1 |    1 |    1
update _attempt set correct_num=?,ended_at=?,incorrect_num=?,taking_id=?,result=? ...       |    1 |    1 |    1
update _quiz_taking set is_assigned=?,learner_id=?,quiz_id=?,assigning_id=?,status=? ...    |    1 |    1 |    1
----------------------------------------------------------------------------------------------------------------
TOTALS                                                                                      |   16 |   18 |   23
```

## Which Statements Scale
The ONLY statement that scales during submit is the fetching of answers for questions:
`select a1_0.question_id,a1_0.id,a1_0.is_correct,a1_0.text from _answer a1_0 where a1_0.question_id = any (?)`

* 50 Questions: 3 queries
* 100 Questions: 5 queries
* 200 Questions: 10 queries

## Code Path Responsible
The scaling originates in `QuizTakingServiceImpl.java` inside the `finalizeAttempt(Attempt attempt)` method (called by `submitQuizAttempt`):

```java
for (Question question : quiz.getQuestions()) {
    ...
    List<Long> correctAnswersIds = question.getAnswers().stream() // <-- TRIGGERS LAZY LOAD
            .filter(Answer::getIsCorrect)
            .map(Answer::getId)
            .collect(Collectors.toList());
    ...
}
```

## Scaling Mechanism
**Classification**: `BATCHED LAZY-LOAD SCALING`

The entity mapping in `Question.java` defines the `answers` collection with a batch size of 20:
```java
@OneToMany(mappedBy = "question", cascade = CascadeType.ALL, orphanRemoval = true)
@BatchSize(size = 20)
List<Answer> answers;
```

When `question.getAnswers()` is called on the first uninitialized question during iteration, Hibernate fetches the answers for a batch of 20 uninitialized questions in the current persistence context. 
This produces exactly the observed query counts:
* ceil(50 / 20) = 3 queries
* 100 / 20 = 5 queries
* 200 / 20 = 10 queries

The exact delta between 50Q (16 total), 100Q (18 total), and 200Q (23 total) is perfectly explained by this statement's growth (`16 - 3 + 5 = 18`, and `18 - 5 + 10 = 23`). There are no other scaling queries.

## Recommended V2-019 Optimization
To optimize this operation to O(1) constant queries regardless of quiz size, we should decouple grading from entity traversal.
Recommendation: Pre-fetch all correct answers for the quiz's questions in a single bulk query (e.g., via a dedicated `AnswerRepository` method like `findByQuestionIdIn`) before entering the grading loop, bypassing the batched entity lazy loading entirely.
