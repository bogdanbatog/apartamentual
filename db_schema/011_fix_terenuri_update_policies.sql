-- Fix conflicting UPDATE policies on terenuri table
-- The issue is that there are multiple UPDATE policies that might be conflicting
-- This migration cleans up all UPDATE policies and creates a single comprehensive one

-- Drop ALL existing UPDATE policies on terenuri table
DROP POLICY IF EXISTS "Users can update their own terenuri" ON terenuri;
DROP POLICY IF EXISTS "Users can update their own non-deleted terenuri" ON terenuri;
DROP POLICY IF EXISTS "Admins can manage deleted_at field" ON terenuri;
DROP POLICY IF EXISTS "Super admins can manage all terenuri" ON terenuri;
DROP POLICY IF EXISTS "Super admins can restore deleted terenuri" ON terenuri;

-- Create a single comprehensive UPDATE policy that handles all cases
-- This policy allows:
-- 1. Users to update their own non-deleted terenuri (except deleted_at field)
-- 2. Super admins to update any terenuri including the deleted_at field
CREATE POLICY "Comprehensive terenuri update policy" ON terenuri
    FOR UPDATE TO authenticated 
    USING (
        -- Users can update their own non-deleted terenuri
        (auth.uid() = created_by_user_id AND deleted_at IS NULL)
        OR
        -- Super admins can update any terenuri
        public.is_super_admin()
    )
    WITH CHECK (
        -- Users can only update their own terenuri and cannot modify deleted_at
        (auth.uid() = created_by_user_id AND deleted_at IS NULL)
        OR
        -- Super admins can update any terenuri including deleted_at
        public.is_super_admin()
    );

-- Add comment for documentation
COMMENT ON POLICY "Comprehensive terenuri update policy" ON terenuri IS 'Allows users to update their own non-deleted terenuri and super admins to update any terenuri including soft deletion';
