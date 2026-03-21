-- Push token registration table for Expo Push Notifications API.
--
-- Stores Expo push tokens (format: ExponentPushToken[xxx]) per user/device.
-- One user may have multiple devices; one token is UNIQUE across users.
-- platform: 'ios' | 'android'

CREATE TABLE IF NOT EXISTS push_tokens (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token       TEXT        NOT NULL,
    platform    TEXT        CHECK (platform IN ('ios', 'android')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT push_tokens_token_unique UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS push_tokens_user_id_idx ON push_tokens (user_id);

-- Trigger to keep updated_at current on upsert
CREATE OR REPLACE FUNCTION push_tokens_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER push_tokens_updated_at
    BEFORE UPDATE ON push_tokens
    FOR EACH ROW EXECUTE FUNCTION push_tokens_set_updated_at();
