-- Admin user promotion function
-- Usage: SELECT promote_to_admin('user-uuid-here');
-- Or directly: UPDATE users SET role = 'admin' WHERE id = 'user-uuid-here';

CREATE OR REPLACE FUNCTION promote_to_admin(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE users SET role = 'admin' WHERE id = target_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User % not found', target_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoke public access — only superuser/owner can call
REVOKE ALL ON FUNCTION promote_to_admin(UUID) FROM PUBLIC;
