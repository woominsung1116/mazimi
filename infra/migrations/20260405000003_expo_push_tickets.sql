-- Expo push ticket persistence for reliable receipt checking.
--
-- Tickets are written after a successful push send and polled every 15 min
-- by the worker receipt-check job. Rows are never deleted on failure so
-- they remain available for retry on the next poll cycle.
--
-- status:
--   pending              — sent, not yet checked
--   ok                   — receipt confirmed delivered
--   error                — receipt returned a non-DeviceNotRegistered error
--   device_not_registered — receipt returned DeviceNotRegistered; token removed

CREATE TABLE IF NOT EXISTS expo_push_tickets (
    id           SERIAL      PRIMARY KEY,
    ticket_id    TEXT        NOT NULL UNIQUE,
    user_id      UUID        REFERENCES users (id) ON DELETE SET NULL,
    expo_token   TEXT        NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status       TEXT        NOT NULL DEFAULT 'pending',
    checked_at   TIMESTAMPTZ,
    error_detail TEXT
);

CREATE INDEX IF NOT EXISTS expo_push_tickets_pending_idx
    ON expo_push_tickets (status)
    WHERE status = 'pending';
