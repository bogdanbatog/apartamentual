-- Fix potential recursion in terenuri RLS policies
-- Update terenuri policies to use the is_super_admin() function instead of
-- directly querying the profiles table to avoid any potential recursion issues

-- Drop existing policies that might cause recursion
DROP POLICY IF EXISTS "Admins can manage deleted_at field" ON terenuri;
DROP POLICY IF EXISTS "Super admins can manage all terenuri" ON terenuri;
DROP POLICY IF EXISTS "Super admins can view all terenuri including deleted" ON terenuri;
DROP POLICY IF EXISTS "Super admins can restore deleted terenuri" ON terenuri;

-- Recreate policies using the is_super_admin() function
-- Policy 1: Super admins can manage deleted_at field
CREATE POLICY "Admins can manage deleted_at field" ON terenuri
    FOR UPDATE TO authenticated 
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- Policy 2: Super admins can manage all terenuri operations
CREATE POLICY "Super admins can manage all terenuri" ON terenuri
    FOR ALL TO authenticated 
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- Policy 3: Super admins can view all terenuri (including soft-deleted ones)
CREATE POLICY "Super admins can view all terenuri including deleted" ON terenuri
    FOR SELECT TO authenticated 
    USING (public.is_super_admin());

-- Add comment for documentation
COMMENT ON POLICY "Admins can manage deleted_at field" ON terenuri IS 'Allows super admins to manage soft deletion of terenuri records';
COMMENT ON POLICY "Super admins can manage all terenuri" ON terenuri IS 'Allows super admins to perform all operations on terenuri records';
COMMENT ON POLICY "Super admins can view all terenuri including deleted" ON terenuri IS 'Allows super admins to view soft-deleted terenuri records';
