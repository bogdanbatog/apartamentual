-- Add soft deletion support to terenuri table
-- This migration adds a deleted_at field and updates RLS policies accordingly

-- Add the deleted_at column with default NULL (not deleted)
ALTER TABLE terenuri 
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add index for better query performance on soft deletion filtering
CREATE INDEX idx_terenuri_deleted_at ON terenuri(deleted_at);

-- Add comment for documentation
COMMENT ON COLUMN terenuri.deleted_at IS 'Timestamp when the record was soft deleted. NULL means not deleted.';

-- Update existing RLS policies to filter out soft-deleted records

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Anyone can view active terenuri" ON terenuri;
DROP POLICY IF EXISTS "Authenticated users can view all terenuri" ON terenuri;

-- Create new SELECT policies that exclude soft-deleted records
-- Policy 1: Anyone can view active, non-deleted listings
CREATE POLICY "Anyone can view active non-deleted terenuri" ON terenuri
    FOR SELECT USING (status = 'active' AND deleted_at IS NULL);

-- Policy 2: Authenticated users can view all non-deleted listings
CREATE POLICY "Authenticated users can view all non-deleted terenuri" ON terenuri
    FOR SELECT TO authenticated USING (deleted_at IS NULL);

-- Update existing UPDATE policy to prevent updating deleted records
DROP POLICY IF EXISTS "Users can update their own terenuri" ON terenuri;

CREATE POLICY "Users can update their own non-deleted terenuri" ON terenuri
    FOR UPDATE TO authenticated 
    USING (auth.uid() = created_by_user_id AND deleted_at IS NULL)
    WITH CHECK (auth.uid() = created_by_user_id);

-- Create admin policy for managing the deleted_at field
-- This checks the auth.users table for is_super_admin flag
CREATE POLICY "Admins can manage deleted_at field" ON terenuri
    FOR UPDATE TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() AND is_super_admin = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() AND is_super_admin = true
        )
    );
