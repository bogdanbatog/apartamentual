-- Fix grup membership constraints with proper trigger functions
-- This migration adds trigger functions to enforce business rules that can't be handled by RLS

-- Function to validate membership status changes
CREATE OR REPLACE FUNCTION public.validate_membership_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only allow users to leave groups if they're currently pending or approved
    IF NEW.status = 'left' AND OLD.status NOT IN ('pending', 'approved') THEN
        RAISE EXCEPTION 'Cannot leave group with status: %', OLD.status;
    END IF;
    
    -- Only allow setting status to 'removed' if user is not the group owner
    IF NEW.status = 'removed' AND EXISTS (
        SELECT 1 FROM grup WHERE id = NEW.grup_id AND owner_user_id = NEW.user_id
    ) THEN
        RAISE EXCEPTION 'Group owners cannot be removed from their own groups';
    END IF;
    
    -- Only allow group owners or super admins to change status to 'removed'
    IF NEW.status = 'removed' AND NOT public.can_manage_group(NEW.grup_id) THEN
        RAISE EXCEPTION 'Only group owners or super admins can remove members';
    END IF;
    
    -- Only allow users to change their own status to 'left'
    IF NEW.status = 'left' AND NEW.user_id != auth.uid() THEN
        RAISE EXCEPTION 'Users can only leave groups in their own name';
    END IF;
    
    -- Set left_at timestamp when leaving
    IF NEW.status = 'left' AND OLD.status != 'left' THEN
        NEW.left_at = NOW();
    END IF;
    
    -- Set approved_at timestamp when approving
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        NEW.approved_at = NOW();
        NEW.approved_by_user_id = auth.uid();
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger to validate membership status changes
CREATE TRIGGER validate_membership_status_change_trigger
    BEFORE UPDATE ON grup_membership
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_membership_status_change();

-- Add comment for documentation
COMMENT ON FUNCTION public.validate_membership_status_change() IS 'Trigger function to validate membership status changes and enforce business rules';
