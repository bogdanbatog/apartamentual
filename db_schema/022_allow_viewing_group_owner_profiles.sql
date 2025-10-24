-- Add policy to allow viewing group owner profiles
-- This allows users to view profiles of group owners for group detail pages

-- Policy: Users can view profiles of group owners
CREATE POLICY "Users can view group owner profiles" ON profiles
    FOR SELECT TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM grup 
            WHERE grup.owner_user_id = profiles.user_id 
            AND grup.is_public = true 
            AND grup.is_disabled = false
        )
    );

-- Add comment for documentation
COMMENT ON POLICY "Users can view group owner profiles" ON profiles IS 'Allows users to view profiles of group owners for public groups';
