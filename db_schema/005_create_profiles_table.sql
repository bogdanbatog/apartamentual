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

-- Policy 3: Super admins can view all profiles
CREATE POLICY "Super admins can view all profiles" ON profiles
    FOR SELECT TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = auth.uid() AND is_super_admin = true
        )
    );

-- Policy 4: Super admins can update all profiles
CREATE POLICY "Super admins can update all profiles" ON profiles
    FOR UPDATE TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = auth.uid() AND is_super_admin = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = auth.uid() AND is_super_admin = true
        )
    );

-- Policy 5: Super admins can insert new profiles
CREATE POLICY "Super admins can insert profiles" ON profiles
    FOR INSERT TO authenticated 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = auth.uid() AND is_super_admin = true
        )
    );

-- Add comments for documentation
COMMENT ON TABLE profiles IS 'User profiles with additional information beyond auth.users';
COMMENT ON COLUMN profiles.user_id IS 'Primary key referencing auth.users(id)';
COMMENT ON COLUMN profiles.email IS 'User email address (denormalized from auth.users)';
COMMENT ON COLUMN profiles.is_super_admin IS 'Flag indicating if user has super admin privileges';
COMMENT ON COLUMN profiles.first_name IS 'User first name';
COMMENT ON COLUMN profiles.last_name IS 'User last name';
COMMENT ON COLUMN profiles.phone IS 'User phone number';
