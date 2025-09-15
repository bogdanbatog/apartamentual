-- Setup Supabase Storage for group images
-- This migration creates the storage bucket and policies for group images

-- Create the group-images storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'group-images',
    'group-images', 
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Create policy to allow authenticated users to upload group images
CREATE POLICY "Authenticated users can upload group images" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'group-images');

-- Create policy to allow authenticated users to view group images
CREATE POLICY "Authenticated users can view group images" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'group-images');

-- Create policy to allow users to update their own group images
CREATE POLICY "Users can update their own group images" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'group-images' AND
        auth.uid()::text = (storage.foldername(name))[1]
    )
    WITH CHECK (
        bucket_id = 'group-images' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Create policy to allow users to delete their own group images
CREATE POLICY "Users can delete their own group images" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'group-images' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Add comment for documentation
COMMENT ON TABLE storage.buckets IS 'Storage buckets for file uploads - group-images bucket stores group profile images';
