-- Application status history: records every state transition for audit and display.
-- The current state lives in user_program_states; this table stores the changelog.

CREATE TABLE user_program_state_history (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    program_id UUID        NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    state      TEXT        NOT NULL,
    memo       TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_state_history_user_program
    ON user_program_state_history(user_id, program_id, changed_at DESC);

-- Constrain the state column on the main table to the defined enum values.
-- This enforces integrity at the DB layer in addition to the application layer.
ALTER TABLE user_program_states
    ADD CONSTRAINT chk_program_state CHECK (
        state IN (
            'interested',
            'planning',
            'applying',
            'applied',
            'waiting',
            'received',
            'abandoned'
        )
    );

-- Backfill history from any existing rows so the history table is never empty
-- for users who already have a state record.
INSERT INTO user_program_state_history (user_id, program_id, state, memo, changed_at)
SELECT user_id, program_id, state, memo, created_at
FROM user_program_states;
