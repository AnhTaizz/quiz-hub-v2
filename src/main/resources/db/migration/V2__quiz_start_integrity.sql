DO $$
BEGIN
    -- Check Invariant Q: duplicate assigning
    IF EXISTS (
        SELECT learner_id, assigning_id
        FROM _quiz_taking
        WHERE assigning_id IS NOT NULL
        GROUP BY learner_id, assigning_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'V2 Migration failed: Duplicate QuizTaking rows detected for the same learner_id and assigning_id. Clean up data first.';
    END IF;

    -- Check Invariant A: multiple active attempts
    IF EXISTS (
        SELECT taking_id
        FROM _attempt
        WHERE ended_at IS NULL
        GROUP BY taking_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'V2 Migration failed: Multiple active Attempt rows detected for the same taking_id. Clean up data first.';
    END IF;
END $$;

CREATE UNIQUE INDEX uq_quiz_taking_learner_assigning
ON _quiz_taking (learner_id, assigning_id)
WHERE assigning_id IS NOT NULL;

CREATE UNIQUE INDEX uq_attempt_one_active_per_taking
ON _attempt (taking_id)
WHERE ended_at IS NULL;
