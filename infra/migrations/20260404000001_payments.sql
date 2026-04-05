-- Payments: subscription plans and payment verification records.
--
-- Security model:
--   - Prices are stored server-side in subscription_plans; clients NEVER supply prices.
--   - user_subscriptions records are only written by the API server after verifying
--     the payment_id against the plan price fetched from this table.
--   - RLS: users may only read their own subscription rows.
--
-- Plan types:
--   "premium_monthly"  — 4,900 KRW / month
--   "premium_yearly"   — 39,900 KRW / year

-- ── Subscription plan catalogue (server-authoritative prices) ──

CREATE TABLE IF NOT EXISTS subscription_plans (
    id            TEXT PRIMARY KEY,          -- e.g. "premium_monthly"
    display_name  TEXT        NOT NULL,
    price_krw     BIGINT      NOT NULL CHECK (price_krw > 0),
    duration_days INTEGER     NOT NULL CHECK (duration_days > 0),
    active        BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed canonical plans — price is the source of truth; never read from clients.
INSERT INTO subscription_plans (id, display_name, price_krw, duration_days)
VALUES
    ('premium_monthly', '마지미 프리미엄 월정액', 4900,  30),
    ('premium_yearly',  '마지미 프리미엄 연정액',  39900, 365)
ON CONFLICT (id) DO UPDATE
    SET price_krw    = EXCLUDED.price_krw,
        display_name = EXCLUDED.display_name,
        duration_days = EXCLUDED.duration_days;

-- ── User subscriptions ──

CREATE TABLE IF NOT EXISTS user_subscriptions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id         TEXT        NOT NULL REFERENCES subscription_plans(id),
    -- payment_id is the opaque ID returned by the payment gateway (e.g. PortOne).
    -- Stored for idempotency: re-submitting the same payment_id is a no-op.
    payment_id      TEXT        NOT NULL UNIQUE,
    -- price_krw records what was actually charged (from the DB plan, not the client).
    price_krw       BIGINT      NOT NULL,
    status          TEXT        NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'expired', 'refunded')),
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_subscriptions_user_id_idx
    ON user_subscriptions (user_id);

CREATE INDEX IF NOT EXISTS user_subscriptions_expires_at_idx
    ON user_subscriptions (user_id, expires_at DESC);

-- ── RLS ──

ALTER TABLE subscription_plans    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions     ENABLE ROW LEVEL SECURITY;

-- subscription_plans: public read (prices are not secret), service write only.
CREATE POLICY plans_select_all    ON subscription_plans FOR SELECT USING (true);
CREATE POLICY plans_all_service   ON subscription_plans FOR ALL   USING (is_service_role());

-- user_subscriptions: each user sees only their own rows.
CREATE POLICY subs_select_own     ON user_subscriptions FOR SELECT
    USING (user_id = app_user_id());
CREATE POLICY subs_insert_service ON user_subscriptions FOR INSERT
    WITH CHECK (is_service_role());
CREATE POLICY subs_update_service ON user_subscriptions FOR UPDATE
    USING (is_service_role());
CREATE POLICY subs_all_service    ON user_subscriptions FOR ALL
    USING (is_service_role());
