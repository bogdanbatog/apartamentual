-- Fix is_super_admin() function to check profiles table instead of auth.users
-- The function was incorrectly checking auth.users.is_super_admin which was moved to profiles.is_super_admin

-- Drop and recreate the function to check the profiles table
DROP FUNCTION IF EXISTS public.is_super_admin();

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
    SELECT COALESCE(
        (SELECT is_super_admin FROM profiles WHERE user_id = auth.uid()),
        false
    );
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.is_super_admin() IS 'Security definer function to check if current user is super admin by checking profiles table';
