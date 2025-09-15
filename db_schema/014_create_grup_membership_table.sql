-- Create grup_membership table for ApartamenTUal platform
-- This table manages the many-to-many relationship between groups and profiles (users)

CREATE TABLE IF NOT EXISTS grup_membership (
    -- Primary key
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Foreign keys
    grup_id UUID REFERENCES grup(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE NOT NULL,
    
    -- Membership details
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'left', 'removed')),
    role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('member', 'admin', 'moderator')),
    
    -- Membership metadata
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    approved_by_user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Ensure unique membership per user per group
    UNIQUE(grup_id, user_id)
);

-- Add indexes for better query performance
CREATE INDEX idx_grup_membership_grup_id ON grup_membership(grup_id);
CREATE INDEX idx_grup_membership_user_id ON grup_membership(user_id);
CREATE INDEX idx_grup_membership_status ON grup_membership(status);
CREATE INDEX idx_grup_membership_role ON grup_membership(role);
CREATE INDEX idx_grup_membership_joined_at ON grup_membership(joined_at DESC);
CREATE INDEX idx_grup_membership_approved_at ON grup_membership(approved_at DESC);

-- Add trigger to automatically update updated_at column
CREATE TRIGGER update_grup_membership_updated_at 
    BEFORE UPDATE ON grup_membership 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE grup_membership ENABLE ROW LEVEL SECURITY;

-- RLS Policies for grup_membership table

-- Policy 1: Users can view memberships for groups they belong to
CREATE POLICY "Users can view memberships for their groups" ON grup_membership
    FOR SELECT TO authenticated 
    USING (
        user_id = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM grup_membership gm2 
            WHERE gm2.grup_id = grup_membership.grup_id 
            AND gm2.user_id = auth.uid() 
            AND gm2.status = 'approved'
        )
    );

-- Policy 2: Group owners can view all memberships for their groups
CREATE POLICY "Group owners can view all memberships" ON grup_membership
    FOR SELECT TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM grup g 
            WHERE g.id = grup_membership.grup_id 
            AND g.owner_user_id = auth.uid()
        )
    );

-- Policy 3: Super admins can view all memberships
CREATE POLICY "Super admins can view all memberships" ON grup_membership
    FOR SELECT TO authenticated 
    USING (public.is_super_admin());

-- Policy 4: Users can create their own membership requests
CREATE POLICY "Users can create their own membership requests" ON grup_membership
    FOR INSERT TO authenticated 
    WITH CHECK (auth.uid() = user_id);

-- Policy 5: Group owners can approve/reject membership requests
CREATE POLICY "Group owners can manage memberships" ON grup_membership
    FOR UPDATE TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM grup g 
            WHERE g.id = grup_membership.grup_id 
            AND g.owner_user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM grup g 
            WHERE g.id = grup_membership.grup_id 
            AND g.owner_user_id = auth.uid()
        )
    );

-- Policy 6: Users can leave groups (update their own membership status)
CREATE POLICY "Users can leave groups" ON grup_membership
    FOR UPDATE TO authenticated 
    USING (auth.uid() = user_id)
    WITH CHECK (
        auth.uid() = user_id AND 
        status IN ('left', 'pending', 'approved') -- Can only leave if not already rejected/removed
    );

-- Policy 7: Super admins can manage all memberships
CREATE POLICY "Super admins can manage all memberships" ON grup_membership
    FOR UPDATE TO authenticated 
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- Policy 8: Group owners can remove members (but not themselves)
CREATE POLICY "Group owners can remove members" ON grup_membership
    FOR UPDATE TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM grup g 
            WHERE g.id = grup_membership.grup_id 
            AND g.owner_user_id = auth.uid()
        ) AND user_id != auth.uid() -- Cannot remove themselves
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM grup g 
            WHERE g.id = grup_membership.grup_id 
            AND g.owner_user_id = auth.uid()
        ) AND user_id != auth.uid()
    );

-- Add comments for documentation
COMMENT ON TABLE grup_membership IS 'Many-to-many relationship between groups and users';
COMMENT ON COLUMN grup_membership.id IS 'Primary key UUID';
COMMENT ON COLUMN grup_membership.grup_id IS 'Foreign key to grup table';
COMMENT ON COLUMN grup_membership.user_id IS 'Foreign key to profiles table';
COMMENT ON COLUMN grup_membership.status IS 'Membership status: pending, approved, rejected, left, removed';
COMMENT ON COLUMN grup_membership.role IS 'User role in the group: member, admin, moderator';
COMMENT ON COLUMN grup_membership.joined_at IS 'When user joined the group';
COMMENT ON COLUMN grup_membership.left_at IS 'When user left the group';
COMMENT ON COLUMN grup_membership.approved_by_user_id IS 'User who approved the membership';
COMMENT ON COLUMN grup_membership.approved_at IS 'When membership was approved';
