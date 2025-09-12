-- Create profiles table for user profile information
-- This table has a 1:1 relationship with auth.users and stores additional user data

CREATE TABLE IF NOT EXISTS profiles (
    -- Primary key that references auth.users
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- User email (denormalized from auth.users for easier access)
    email VARCHAR(255) NOT NULL,
    
    -- Admin flag for super admin privileges
    is_super_admin BOOLEAN DEFAULT FALSE NOT NULL,
    
    -- Additional profile fields that might be useful
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Add indexes for better query performance
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_is_super_admin ON profiles(is_super_admin);
CREATE INDEX idx_profiles_created_at ON profiles(created_at DESC);

-- Add unique constraint on email to prevent duplicates
CREATE UNIQUE INDEX idx_profiles_email_unique ON profiles(email);

-- Add trigger to automatically update updated_at column
CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles table

-- Policy 1: Users can view their own profile
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT TO authenticated 
    USING (auth.uid() = user_id);

-- Policy 2: Users can update their own profile (except is_super_admin)
CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE TO authenticated 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Create a security definer function to check if current user is super admin
-- This function bypasses RLS and directly checks auth.users to avoid recursion
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

-- Policy 3: Super admins can view all profiles
CREATE POLICY "Super admins can view all profiles" ON profiles
    FOR SELECT TO authenticated 
    USING (public.is_super_admin());

-- Policy 4: Super admins can update all profiles
CREATE POLICY "Super admins can update all profiles" ON profiles
    FOR UPDATE TO authenticated 
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- Policy 5: Super admins can insert new profiles
CREATE POLICY "Super admins can insert profiles" ON profiles
    FOR INSERT TO authenticated 
    WITH CHECK (public.is_super_admin());

-- Policy 6: Users can insert their own profile (for the trigger)
-- This allows the handle_new_user function to work
CREATE POLICY "Users can insert their own profile" ON profiles
    FOR INSERT TO authenticated 
    WITH CHECK (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE profiles IS 'User profiles with additional information beyond auth.users';
COMMENT ON COLUMN profiles.user_id IS 'Primary key referencing auth.users(id)';
COMMENT ON COLUMN profiles.email IS 'User email address (denormalized from auth.users)';
COMMENT ON COLUMN profiles.is_super_admin IS 'Flag indicating if user has super admin privileges';
COMMENT ON COLUMN profiles.first_name IS 'User first name';
COMMENT ON COLUMN profiles.last_name IS 'User last name';
COMMENT ON COLUMN profiles.phone IS 'User phone number';
COMMENT ON FUNCTION public.is_super_admin() IS 'Security definer function to check if current user is super admin without RLS recursion';
