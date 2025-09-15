-- Fix profiles table security - prevent users from modifying is_super_admin field
-- This migration fixes the critical security issue where users can modify their own is_super_admin status

-- Drop the existing policy that allows users to update their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- Create a new policy that allows users to update their own profile EXCEPT is_super_admin
CREATE POLICY "Users can update their own profile except admin status" ON profiles
    FOR UPDATE TO authenticated 
    USING (auth.uid() = user_id)
    WITH CHECK (
        auth.uid() = user_id 
        AND is_super_admin = (
            SELECT is_super_admin FROM profiles WHERE user_id = auth.uid()
        )
    );

-- Create a separate policy for super admins to update any profile
CREATE POLICY "Super admins can update any profile" ON profiles
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
COMMENT ON POLICY "Users can update their own profile except admin status" ON profiles IS 'Allows users to update their own profile but prevents modification of is_super_admin field';
COMMENT ON POLICY "Super admins can update any profile" ON profiles IS 'Allows super admins to update any profile including admin status';
