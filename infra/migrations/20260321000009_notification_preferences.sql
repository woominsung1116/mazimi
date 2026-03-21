-- Notification preferences: per-user toggles for alert event types and delivery channels.
-- Each user has exactly one row (upserted on first access).

CREATE TABLE notification_preferences (
    user_id            UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

    -- Event type toggles
    notify_deadline    BOOLEAN     NOT NULL DEFAULT true,
    notify_new_program BOOLEAN     NOT NULL DEFAULT true,
    notify_profile_update BOOLEAN  NOT NULL DEFAULT true,

    -- Delivery channel toggles
    channel_in_app     BOOLEAN     NOT NULL DEFAULT true,
    channel_push       BOOLEAN     NOT NULL DEFAULT true,
    channel_kakao      BOOLEAN     NOT NULL DEFAULT false,
    channel_email      BOOLEAN     NOT NULL DEFAULT false,

    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notif_prefs_user ON notification_preferences(user_id);
