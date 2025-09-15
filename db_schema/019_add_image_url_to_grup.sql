-- Migration: Add image_url field to grup table
-- This migration adds support for storing group images in Supabase Storage
-- instead of using the binary poza field

-- Add image_url column to grup table
ALTER TABLE grup 
ADD COLUMN image_url TEXT;

-- Add comment to document the field
COMMENT ON COLUMN grup.image_url IS 'URL of the group image stored in Supabase Storage';

-- Create index on image_url for better query performance
CREATE INDEX idx_grup_image_url ON grup(image_url) WHERE image_url IS NOT NULL;

-- Update RLS policies to include image_url in SELECT operations
-- (No changes needed as image_url is just a URL and doesn't contain sensitive data)

-- Note: The poza column is kept for backward compatibility but should not be used
-- for new groups. Existing groups with poza data can be migrated separately.
