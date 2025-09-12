-- Data migration: Populate profiles table from auth.users data
-- This migration creates profile records for all existing users in auth.users

-- Insert profiles for all existing users in auth.users
-- This handles the case where users already exist before the profiles table was created
INSERT INTO profiles (user_id, email, is_super_admin, created_at, updated_at)
SELECT 
    id as user_id,
    email,
    COALESCE(is_super_admin, false) as is_super_admin,
    created_at,
    updated_at
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM profiles)
ON CONFLICT (user_id) DO NOTHING;

-- Create a function to automatically create a profile when a new user signs up
-- This ensures all future users get a profile automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email, is_super_admin, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.is_super_admin, false),
        NEW.created_at,
        NEW.updated_at
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create profile when new user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create a function to sync profile data when auth.users is updated
CREATE OR REPLACE FUNCTION public.sync_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the corresponding profile record
    UPDATE public.profiles 
    SET 
        email = NEW.email,
        updated_at = NEW.updated_at
    WHERE user_id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to sync profile when user data is updated
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
    AFTER UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.sync_user_profile();

-- Grant necessary permissions for the functions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.profiles TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

-- Add comment for documentation
COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates a profile when a new user is created in auth.users';
COMMENT ON FUNCTION public.sync_user_profile() IS 'Syncs profile data when auth.users is updated';
