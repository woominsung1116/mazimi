-- Alert system tables

-- ── alert_subscriptions ────────────────────────────────────────────────────
-- 유저가 특정 프로그램의 마감 알림을 구독하는 설정.
-- enabled=false 로 끄기만 하고 기록은 보존.
CREATE TABLE alert_subscriptions (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    program_id UUID        NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    enabled    BOOLEAN     NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, program_id)
);

CREATE INDEX idx_alert_subs_user    ON alert_subscriptions(user_id);
CREATE INDEX idx_alert_subs_program ON alert_subscriptions(program_id);
CREATE INDEX idx_alert_subs_enabled ON alert_subscriptions(enabled) WHERE enabled = true;

-- ── alert_deliveries ───────────────────────────────────────────────────────
-- 실제 발송된(큐에 삽입된) 알림 기록.
-- (user_id, program_id, alert_type, alert_date) UNIQUE → 중복 발송 방지.
-- alert_type: 'd7' | 'd3' | 'd1' (마감 D-7/D-3/D-1)
CREATE TABLE alert_deliveries (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    program_id UUID        NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    alert_type TEXT        NOT NULL CHECK (alert_type IN ('d7', 'd3', 'd1')),
    alert_date DATE        NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, program_id, alert_type, alert_date)
);

CREATE INDEX idx_alert_del_user    ON alert_deliveries(user_id);
CREATE INDEX idx_alert_del_program ON alert_deliveries(program_id);
CREATE INDEX idx_alert_del_date    ON alert_deliveries(alert_date DESC);
-- 하루 2회 제한 체크용: (user_id, alert_date) 빠른 COUNT
CREATE INDEX idx_alert_del_user_date ON alert_deliveries(user_id, alert_date);
