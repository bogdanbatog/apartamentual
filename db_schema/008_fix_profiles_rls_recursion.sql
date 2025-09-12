-- Fix infinite recursion in profiles RLS policies
-- The issue is that policies reference the profiles table within their conditions,
-- creating circular dependencies. This fix uses auth.users directly or creates
-- a security definer function to avoid recursion.

-- Drop the problematic policies that cause recursion
DROP POLICY IF EXISTS "Super admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Super admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Super admins can insert profiles" ON profiles;

-- Create a security definer function to check if current user is super admin
-- This function bypasses RLS and directly checks auth.users
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
    SELECT COALESCE(
        (SELECT is_super_admin FROM auth.users WHERE id = auth.uid()),
        false
    );
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- Recreate the policies using the security definer function
-- Policy 1: Super admins can view all profiles
CREATE POLICY "Super admins can view all profiles" ON profiles
    FOR SELECT TO authenticated 
    USING (public.is_super_admin());

-- Policy 2: Super admins can update all profiles
CREATE POLICY "Super admins can update all profiles" ON profiles
    FOR UPDATE TO authenticated 
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- Policy 3: Super admins can insert new profiles
CREATE POLICY "Super admins can insert profiles" ON profiles
    FOR INSERT TO authenticated 
    WITH CHECK (public.is_super_admin());

-- Add a policy for users to insert their own profile (for the trigger)
-- This allows the handle_new_user function to work
CREATE POLICY "Users can insert their own profile" ON profiles
    FOR INSERT TO authenticated 
    WITH CHECK (auth.uid() = user_id);

-- Add comment for documentation
COMMENT ON FUNCTION public.is_super_admin() IS 'Security definer function to check if current user is super admin without RLS recursion';
