-- Update terenuri RLS policies to use profiles table instead of auth.users
-- This migration updates the existing policies to reference the new profiles table

-- Drop the existing admin policy that references auth.users directly
DROP POLICY IF EXISTS "Admins can manage deleted_at field" ON terenuri;

-- Create new admin policy that uses the profiles table
CREATE POLICY "Admins can manage deleted_at field" ON terenuri
    FOR UPDATE TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = auth.uid() AND is_super_admin = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = auth.uid() AND is_super_admin = true
        )
    );

-- Add a new policy for super admins to manage all terenuri operations
-- This gives super admins full control over terenuri records
CREATE POLICY "Super admins can manage all terenuri" ON terenuri
    FOR ALL TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = auth.uid() AND is_super_admin = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = auth.uid() AND is_super_admin = true
        )
    );

-- Add a policy for super admins to view all terenuri (including soft-deleted ones)
CREATE POLICY "Super admins can view all terenuri including deleted" ON terenuri
    FOR SELECT TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = auth.uid() AND is_super_admin = true
        )
    );

-- Add a policy for super admins to restore soft-deleted terenuri
CREATE POLICY "Super admins can restore deleted terenuri" ON terenuri
    FOR UPDATE TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = auth.uid() AND is_super_admin = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = auth.uid() AND is_super_admin = true
        )
    );

-- Add comment for documentation
COMMENT ON POLICY "Super admins can manage all terenuri" ON terenuri IS 'Allows super admins to perform all operations on terenuri records';
COMMENT ON POLICY "Super admins can view all terenuri including deleted" ON terenuri IS 'Allows super admins to view soft-deleted terenuri records';
COMMENT ON POLICY "Super admins can restore deleted terenuri" ON terenuri IS 'Allows super admins to restore soft-deleted terenuri records';
