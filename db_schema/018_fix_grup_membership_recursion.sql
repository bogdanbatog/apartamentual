-- Fix infinite recursion in grup_membership RLS policies
-- The issue is that policies are querying the same table they're protecting, causing recursion

-- Drop the problematic policies that cause recursion
DROP POLICY IF EXISTS "Users can view memberships for their groups" ON grup_membership;
DROP POLICY IF EXISTS "Group owners can view all memberships" ON grup_membership;
DROP POLICY IF EXISTS "Super admins can view all memberships" ON grup_membership;
DROP POLICY IF EXISTS "Group owners can manage memberships" ON grup_membership;
DROP POLICY IF EXISTS "Group owners can remove members" ON grup_membership;
DROP POLICY IF EXISTS "Users can leave groups" ON grup_membership;
DROP POLICY IF EXISTS "Super admins can manage all memberships" ON grup_membership;
DROP POLICY IF EXISTS "Group owners can remove members" ON grup_membership;

DROP POLICY IF EXISTS "Users can create their own membership requests" ON grup_membership;
DROP POLICY IF EXISTS "Group owners can manage their group memberships" ON grup_membership;

-- Create simplified policies that don't cause recursion
-- Policy 1: Users can view their own memberships
CREATE POLICY "Users can view their own memberships" ON grup_membership
    FOR SELECT TO authenticated 
    USING (user_id = auth.uid());

-- Policy 2: Users can view memberships for groups they own (using direct grup table query)
CREATE POLICY "Group owners can view their group memberships" ON grup_membership
    FOR SELECT TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM grup g 
            WHERE g.id = grup_membership.grup_id 
            AND g.owner_user_id = auth.uid()
        )
    );

-- Policy 3: Super admins can view all memberships
CREATE POLICY "Super admins can view all memberships" ON grup_membership
    FOR SELECT TO authenticated 
    USING (public.is_super_admin());

-- Policy 4: Users can create their own membership requests
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

-- Policy 5: Group owners can manage memberships in their groups
CREATE POLICY "Group owners can manage their group memberships" ON grup_membership
    FOR UPDATE TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM grup g 
            WHERE g.id = grup_membership.grup_id 
            AND g.owner_user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM grup g 
            WHERE g.id = grup_membership.grup_id 
            AND g.owner_user_id = auth.uid()
        )
    );

-- Policy 6: Users can leave groups (update their own membership status)
CREATE POLICY "Users can leave groups" ON grup_membership
    FOR UPDATE TO authenticated 
    USING (auth.uid() = user_id)
    WITH CHECK (
        auth.uid() = user_id AND 
        status = 'left' -- Can only set status to 'left'
    );

-- Policy 7: Super admins can manage all memberships
CREATE POLICY "Super admins can manage all memberships" ON grup_membership
    FOR UPDATE TO authenticated 
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- Policy 8: Group owners can remove members (but not themselves)
CREATE POLICY "Group owners can remove members" ON grup_membership
    FOR UPDATE TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM grup g 
            WHERE g.id = grup_membership.grup_id 
            AND g.owner_user_id = auth.uid()
        ) AND user_id != auth.uid() -- Cannot remove themselves
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM grup g 
            WHERE g.id = grup_membership.grup_id 
            AND g.owner_user_id = auth.uid()
        ) AND user_id != auth.uid() AND
        status IN ('removed', 'left') -- Can only set to removed or left
    );

-- Add comment for documentation
COMMENT ON TABLE grup_membership IS 'Many-to-many relationship between groups and users - RLS policies fixed to prevent recursion';
