-- Create grup table for ApartamenTUal platform
-- This table stores group information for Baugruppen construction groups

CREATE TABLE IF NOT EXISTS grup (
    -- Primary key
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Group owner (foreign key to profiles)
    owner_user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE NOT NULL,
    
    -- Group basic information
    nume VARCHAR(255) NOT NULL,
    descriere TEXT,
    poza BYTEA, -- Binary data for group image storage
    
    -- Group details
    zona VARCHAR(255), -- Preferred area/neighborhood
    nr_apartamente_dorite INTEGER CHECK (nr_apartamente_dorite > 0), -- Desired number of apartments
    buget_max_per_apartament DECIMAL(12,2) CHECK (buget_max_per_apartament > 0), -- Max budget per apartment in EUR
    data_incepere_proiect DATE, -- Expected project start date
    data_finalizare_proiect DATE, -- Expected project completion date
    
    -- Group status and settings
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'full', 'completed', 'cancelled')),
    is_public BOOLEAN DEFAULT true, -- Whether group is visible to all users
    max_members INTEGER DEFAULT 20 CHECK (max_members > 0), -- Maximum number of group members
    
    -- Soft delete
    is_disabled BOOLEAN DEFAULT false NOT NULL,
    disabled_at TIMESTAMP WITH TIME ZONE,
    disabled_by_user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Add indexes for better query performance
CREATE INDEX idx_grup_owner ON grup(owner_user_id);
CREATE INDEX idx_grup_status ON grup(status);
CREATE INDEX idx_grup_is_disabled ON grup(is_disabled);
CREATE INDEX idx_grup_is_public ON grup(is_public);
CREATE INDEX idx_grup_zona ON grup(zona);
CREATE INDEX idx_grup_created_at ON grup(created_at DESC);
CREATE INDEX idx_grup_disabled_at ON grup(disabled_at DESC);

-- Add trigger to automatically update updated_at column
CREATE TRIGGER update_grup_updated_at 
    BEFORE UPDATE ON grup 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE grup ENABLE ROW LEVEL SECURITY;

-- RLS Policies for grup table

-- Policy 1: Anyone can view active, public groups
CREATE POLICY "Anyone can view active public groups" ON grup
    FOR SELECT 
    USING (status = 'active' AND is_public = true AND is_disabled = false);

-- Policy 2: Authenticated users can view all non-disabled groups
CREATE POLICY "Authenticated users can view all active groups" ON grup
    FOR SELECT TO authenticated 
    USING (is_disabled = false);

-- Policy 3: Users can create groups (they become the owner)
CREATE POLICY "Users can create groups" ON grup
    FOR INSERT TO authenticated 
    WITH CHECK (auth.uid() = owner_user_id);

-- Policy 4: Users can update groups they own
CREATE POLICY "Users can update their own groups" ON grup
    FOR UPDATE TO authenticated 
    USING (auth.uid() = owner_user_id)
    WITH CHECK (auth.uid() = owner_user_id);

-- Policy 5: Super admins can view all groups (including disabled ones)
CREATE POLICY "Super admins can view all groups" ON grup
    FOR SELECT TO authenticated 
    USING (public.is_super_admin());

-- Policy 6: Super admins can update any group
CREATE POLICY "Super admins can update any group" ON grup
    FOR UPDATE TO authenticated 
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- Policy 7: Super admins can disable/enable groups
CREATE POLICY "Super admins can manage group status" ON grup
    FOR UPDATE TO authenticated 
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- Add comments for documentation
COMMENT ON TABLE grup IS 'Groups for Baugruppen construction projects';
COMMENT ON COLUMN grup.id IS 'Primary key UUID';
COMMENT ON COLUMN grup.owner_user_id IS 'User who owns/created this group';
COMMENT ON COLUMN grup.nume IS 'Group name';
COMMENT ON COLUMN grup.descriere IS 'Detailed description of the group and project';
COMMENT ON COLUMN grup.poza IS 'Binary image data for the group photo';
COMMENT ON COLUMN grup.zona IS 'Preferred area/neighborhood for the project';
COMMENT ON COLUMN grup.nr_apartamente_dorite IS 'Desired number of apartments in the project';
COMMENT ON COLUMN grup.buget_max_per_apartament IS 'Maximum budget per apartment in EUR';
COMMENT ON COLUMN grup.data_incepere_proiect IS 'Expected project start date';
COMMENT ON COLUMN grup.data_finalizare_proiect IS 'Expected project completion date';
COMMENT ON COLUMN grup.status IS 'Group status: active, inactive, full, completed, cancelled';
COMMENT ON COLUMN grup.is_public IS 'Whether group is visible to all users';
COMMENT ON COLUMN grup.max_members IS 'Maximum number of group members';
COMMENT ON COLUMN grup.is_disabled IS 'Soft delete flag - disabled groups are hidden';
COMMENT ON COLUMN grup.disabled_at IS 'Timestamp when group was disabled';
COMMENT ON COLUMN grup.disabled_by_user_id IS 'User who disabled the group';
