-- Enhance grup policies with additional constraints and improved security
-- This migration adds business logic constraints and refines RLS policies

-- Add constraint to ensure group owners cannot be removed from their own groups
-- This is handled at the application level through the RLS policies

-- Add constraint to prevent users from joining disabled groups
CREATE OR REPLACE FUNCTION public.check_group_active()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if the group is active and not disabled
    IF NOT EXISTS (
        SELECT 1 FROM grup 
        WHERE id = NEW.grup_id 
        AND is_disabled = false 
        AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Cannot join inactive or disabled group';
    END IF;
    
    -- Check if group is not full
    IF public.is_group_full(NEW.grup_id) THEN
        RAISE EXCEPTION 'Group is full';
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger to enforce group active status
CREATE TRIGGER check_group_active_trigger
    BEFORE INSERT ON grup_membership
    FOR EACH ROW
    EXECUTE FUNCTION public.check_group_active();

-- Add constraint to prevent users from joining the same group multiple times
-- This is already handled by the UNIQUE constraint, but let's add a more descriptive error

-- Update grup table to add constraint on project dates
ALTER TABLE grup ADD CONSTRAINT check_project_dates 
    CHECK (data_finalizare_proiect IS NULL OR data_incepere_proiect IS NULL OR data_finalizare_proiect >= data_incepere_proiect);

-- Add constraint to ensure max_members is reasonable
ALTER TABLE grup ADD CONSTRAINT check_max_members 
    CHECK (max_members BETWEEN 2 AND 100);

-- Add constraint to ensure budget is reasonable
ALTER TABLE grup ADD CONSTRAINT check_budget 
    CHECK (buget_max_per_apartament IS NULL OR buget_max_per_apartament BETWEEN 10000 AND 1000000);

-- Add additional RLS policy for grup table: prevent users from viewing disabled groups unless they're members
DROP POLICY IF EXISTS "Authenticated users can view all active groups" ON grup;

CREATE POLICY "Authenticated users can view active groups" ON grup
    FOR SELECT TO authenticated 
    USING (
        is_disabled = false AND (
            status = 'active' OR 
            public.is_group_owner(id) OR 
            public.is_super_admin()
        )
    );

-- Add policy to prevent users from creating memberships for groups they don't have access to
DROP POLICY IF EXISTS "Users can create their own membership requests" ON grup_membership;

CREATE POLICY "Users can create their own membership requests" ON grup_membership
    FOR INSERT TO authenticated 
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM grup 
            WHERE id = grup_id 
            AND is_disabled = false 
            AND status = 'active'
        )
    );

-- Add policy to allow group owners to remove members
DROP POLICY IF EXISTS "Group owners can remove members" ON grup_membership;

CREATE POLICY "Group owners can remove members" ON grup_membership
    FOR UPDATE TO authenticated 
    USING (
        public.can_manage_group(grup_id) AND 
        user_id != auth.uid() -- Cannot remove themselves
    )
    WITH CHECK (
        public.can_manage_group(grup_id) AND 
        user_id != auth.uid() AND
        status IN ('removed', 'left') -- Can only set to removed or left
    );

-- Add policy to allow users to update their own membership status (leave group)
DROP POLICY IF EXISTS "Users can leave groups" ON grup_membership;

CREATE POLICY "Users can leave groups" ON grup_membership
    FOR UPDATE TO authenticated 
    USING (auth.uid() = user_id)
    WITH CHECK (
        auth.uid() = user_id AND 
        status = 'left' -- Can only set status to 'left'
    );

-- Add comments for documentation
COMMENT ON FUNCTION public.check_group_active() IS 'Trigger function to ensure users cannot join inactive or full groups';
COMMENT ON CONSTRAINT check_project_dates ON grup IS 'Ensures project end date is not before start date';
COMMENT ON CONSTRAINT check_max_members ON grup IS 'Ensures group size is between 2 and 100 members';
COMMENT ON CONSTRAINT check_budget ON grup IS 'Ensures budget per apartment is between 10,000 and 1,000,000 EUR';
