-- Add helper functions for grup management
-- These functions provide convenient ways to manage group memberships and check permissions

-- Function to check if a user is a member of a group
CREATE OR REPLACE FUNCTION public.is_group_member(grup_id_param UUID, user_id_param UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM grup_membership 
        WHERE grup_id = grup_id_param 
        AND user_id = user_id_param 
        AND status = 'approved'
    );
$$;

-- Function to check if a user is the owner of a group
CREATE OR REPLACE FUNCTION public.is_group_owner(grup_id_param UUID, user_id_param UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM grup 
        WHERE id = grup_id_param 
        AND owner_user_id = user_id_param
        AND is_disabled = false
    );
$$;

-- Function to check if a user can manage a group (owner or super admin)
CREATE OR REPLACE FUNCTION public.can_manage_group(grup_id_param UUID, user_id_param UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
    SELECT public.is_group_owner(grup_id_param, user_id_param) OR public.is_super_admin();
$$;

-- Function to get group member count
CREATE OR REPLACE FUNCTION public.get_group_member_count(grup_id_param UUID)
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
    SELECT COUNT(*)::INTEGER FROM grup_membership 
    WHERE grup_id = grup_id_param 
    AND status = 'approved';
$$;

-- Function to check if a group is full
CREATE OR REPLACE FUNCTION public.is_group_full(grup_id_param UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
    SELECT public.get_group_member_count(grup_id_param) >= (
        SELECT max_members FROM grup WHERE id = grup_id_param
    );
$$;

-- Function to automatically approve group owner as a member
CREATE OR REPLACE FUNCTION public.auto_approve_group_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Automatically add the group owner as an approved member
    INSERT INTO grup_membership (grup_id, user_id, status, role, approved_at)
    VALUES (NEW.id, NEW.owner_user_id, 'approved', 'admin', NOW())
    ON CONFLICT (grup_id, user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$;

-- Create trigger to auto-approve group owner
CREATE TRIGGER auto_approve_group_owner_trigger
    AFTER INSERT ON grup
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_approve_group_owner();

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.is_group_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_owner(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_group(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_member_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_full(UUID) TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION public.is_group_member(UUID, UUID) IS 'Check if a user is an approved member of a group';
COMMENT ON FUNCTION public.is_group_owner(UUID, UUID) IS 'Check if a user is the owner of a group';
COMMENT ON FUNCTION public.can_manage_group(UUID, UUID) IS 'Check if a user can manage a group (owner or super admin)';
COMMENT ON FUNCTION public.get_group_member_count(UUID) IS 'Get the current number of approved members in a group';
COMMENT ON FUNCTION public.is_group_full(UUID) IS 'Check if a group has reached its maximum member limit';
COMMENT ON FUNCTION public.auto_approve_group_owner() IS 'Trigger function to automatically approve group owner as a member';
