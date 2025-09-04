-- Add image_url column to terenuri table for Supabase Storage integration
-- This migration adds support for storing image URLs instead of blob data

-- Add new column for image URL from Supabase Storage
ALTER TABLE terenuri ADD COLUMN image_url VARCHAR(500);

-- Add index for potential image URL queries
CREATE INDEX idx_terenuri_image_url ON terenuri(image_url) WHERE image_url IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN terenuri.image_url IS 'Public URL to image stored in Supabase Storage terrain-images bucket';

-- Note: The existing poza BYTEA column is kept for backward compatibility
-- Future migration may remove it after data migration is complete