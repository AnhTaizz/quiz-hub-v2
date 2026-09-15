# Quiz Scale Performance Baseline

**Commit SHA:** dfcaf1c56b62f8ef3a828acb6f2e56fe4953449b  
**Environment:** PostgreSQL 15-alpine (Testcontainers)  
**Workload:** Quizzes containing 50, 100, and 200 questions (each with 4 choices).

## Results

```text
                50Q       100Q       200Q
START
  queries       13        13         13
  ms            325       113        122

AUTOSAVE
  queries       8         8          8
  ms            109       48         91

RESUME
  queries       9         9          9
  ms            109       75         135

SUBMIT
  queries       16        18         23
  ms            237       167        197
```

## Interpretation

* **START**: CONSTANT. The query footprint is strictly bounded to 13 queries regardless of quiz size.
* **AUTOSAVE**: CONSTANT. The footprint for saving a single question's answer is firmly bounded to 8 queries.
* **RESUME**: CONSTANT. The optimized retrieval (from V2-015) successfully executes exactly 9 queries to load all previously answered items.
* **SUBMIT**: MILD SCALING / SUSPICIOUS. 

Submit is the only measured lifecycle operation whose SQL statement count grows with quiz size (16 -> 18 -> 23 for 50 -> 100 -> 200 questions). This identifies submit as the next scaling hotspot. The exact cause has not yet been established and should be investigated before applying an optimization.

Note: Execution-time measurements are diagnostic only because they are noisy and non-monotonic.
