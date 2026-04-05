-- RLS for expo_push_tickets (누락 보완)
ALTER TABLE expo_push_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE expo_push_tickets FORCE ROW LEVEL SECURITY;

-- Service role: full access (worker writes/reads tickets)
CREATE POLICY expo_tickets_all_service ON expo_push_tickets
    FOR ALL USING (
        current_setting('role', true) = 'service_role'
    );

-- Users: read own tickets only
CREATE POLICY expo_tickets_select_own ON expo_push_tickets
    FOR SELECT USING (
        user_id = current_setting('app.current_user_id', true)::UUID
    );
