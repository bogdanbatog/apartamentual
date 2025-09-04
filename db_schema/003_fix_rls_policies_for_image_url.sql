-- Fix RLS policies to ensure they work with the new image_url column
-- This addresses potential RLS policy violations when inserting terrain records

-- Drop and recreate the INSERT policy to ensure it works with all columns including image_url
DROP POLICY IF EXISTS "Users can create their own terenuri" ON terenuri;

-- Recreate the INSERT policy with explicit column permissions
CREATE POLICY "Users can create their own terenuri" ON terenuri
    FOR INSERT TO authenticated 
    WITH CHECK (auth.uid() = created_by_user_id);

-- Ensure the UPDATE policy also covers the new image_url column
DROP POLICY IF EXISTS "Users can update their own terenuri" ON terenuri;

CREATE POLICY "Users can update their own terenuri" ON terenuri
    FOR UPDATE TO authenticated 
    USING (auth.uid() = created_by_user_id)
    WITH CHECK (auth.uid() = created_by_user_id);

-- -- Add a debugging helper function to check current user authentication
-- -- This can be used to troubleshoot RLS issues
-- CREATE OR REPLACE FUNCTION debug_auth_status()
-- RETURNS TABLE (
--     current_user_id UUID,
--     is_authenticated BOOLEAN,
--     current_role TEXT
-- ) 
-- LANGUAGE SQL
-- SECURITY DEFINER
-- AS $$
--     SELECT 
--         auth.uid() AS current_user_id,
--         (auth.uid() IS NOT NULL) AS is_authenticated,
--         (auth.role())::TEXT AS current_role;
-- $$;

-- -- Grant execute permission to authenticated users
-- GRANT EXECUTE ON FUNCTION debug_auth_status() TO authenticated;