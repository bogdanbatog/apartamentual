-- Migration to set up admin notifications via Edge Function
-- Triggers notifications for: user signups, grup changes, teren changes, 
-- membership requests/joins, and profile updates

BEGIN;

-- Enable pg_net extension for HTTP calls to Edge Function
-- If pg_net is not available, contact Supabase support or use Database Webhooks instead
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'pg_net extension not available. HTTP calls from triggers will not work. Contact Supabase support or use Database Webhooks instead.';
END;
$$;

-- Function to call the notify-admins Edge Function
CREATE OR REPLACE FUNCTION public.notify_admins(
  event_type TEXT,
  event_data JSONB
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- response_status int;
BEGIN
  RAISE NOTICE 'notify_admins: calling http_post';
  PERFORM net.http_post(
    url := 'https://glbvbbgmcobtswwlktic.supabase.co/functions/v1/notify-admins',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('event_type', event_type, 'data', event_data, 'timestamp', NOW()::text)
  );
  RETURN;
END;
$$;

COMMENT ON FUNCTION public.notify_admins IS 'Calls the notify-admins Edge Function to send admin notifications';

-- Trigger function for grup INSERT
CREATE OR REPLACE FUNCTION public.notify_grup_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  owner_email TEXT;
BEGIN
  -- Get owner email from profiles
  SELECT email INTO owner_email
  FROM public.profiles
  WHERE user_id = NEW.owner_user_id;
  
  -- Notify admins
  PERFORM public.notify_admins(
    'grup_created',
    jsonb_build_object(
      'id', NEW.id,
      'nume', NEW.nume,
      'owner_user_id', NEW.owner_user_id,
      'owner_email', owner_email,
      'zona', NEW.zona,
      'max_members', NEW.max_members,
      'status', NEW.status,
      'is_public', NEW.is_public,
      'created_at', NEW.created_at
    )
  );
  
  RETURN NEW;
END;
$$;

-- Trigger function for grup UPDATE
CREATE OR REPLACE FUNCTION public.notify_grup_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  owner_email TEXT;
BEGIN
  -- Only notify if significant fields changed
  IF (OLD.nume IS DISTINCT FROM NEW.nume) OR
     (OLD.status IS DISTINCT FROM NEW.status) OR
     (OLD.is_disabled IS DISTINCT FROM NEW.is_disabled) OR
     (OLD.max_members IS DISTINCT FROM NEW.max_members) THEN
    
    -- Get owner email from profiles
    SELECT email INTO owner_email
    FROM public.profiles
    WHERE user_id = NEW.owner_user_id;
    
    -- Notify admins
    PERFORM public.notify_admins(
      'grup_updated',
      jsonb_build_object(
        'id', NEW.id,
        'nume', NEW.nume,
        'owner_user_id', NEW.owner_user_id,
        'owner_email', owner_email,
        'status', NEW.status,
        'is_disabled', NEW.is_disabled,
        'max_members', NEW.max_members,
        'updated_at', NEW.updated_at
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function for terenuri INSERT
CREATE OR REPLACE FUNCTION public.notify_teren_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  creator_email TEXT;
BEGIN
  -- Get creator email from auth.users or profiles
  SELECT email INTO creator_email
  FROM public.profiles
  WHERE user_id = NEW.created_by_user_id;
  
  -- Notify admins
  PERFORM public.notify_admins(
    'teren_created',
    jsonb_build_object(
      'id', NEW.id,
      'titlu', NEW.titlu,
      'created_by_user_id', NEW.created_by_user_id,
      'creator_email', creator_email,
      'zona', NEW.zona,
      'suprafata', NEW.suprafata,
      'status', NEW.status,
      'created_at', NEW.created_at
    )
  );
  
  RETURN NEW;
END;
$$;

-- Trigger function for terenuri UPDATE
CREATE OR REPLACE FUNCTION public.notify_teren_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  creator_email TEXT;
BEGIN
  -- Only notify if significant fields changed
  IF (OLD.status IS DISTINCT FROM NEW.status) OR
     (OLD.titlu IS DISTINCT FROM NEW.titlu) OR
     (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at) THEN
    
    -- Get creator email from profiles
    SELECT email INTO creator_email
    FROM public.profiles
    WHERE user_id = NEW.created_by_user_id;
    
    -- Notify admins
    PERFORM public.notify_admins(
      'teren_updated',
      jsonb_build_object(
        'id', NEW.id,
        'titlu', NEW.titlu,
        'created_by_user_id', NEW.created_by_user_id,
        'updated_by', creator_email,
        'status', NEW.status,
        'deleted_at', NEW.deleted_at,
        'updated_at', NEW.updated_at
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function for grup_membership INSERT (new requests/joins)
CREATE OR REPLACE FUNCTION public.notify_membership_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_email TEXT;
  grup_nume TEXT;
  event_type TEXT;
BEGIN
  -- Get user email
  SELECT email INTO user_email
  FROM public.profiles
  WHERE user_id = NEW.user_id;
  
  -- Get group name
  SELECT nume INTO grup_nume
  FROM public.grup
  WHERE id = NEW.grup_id;
  
  -- Determine event type based on status
  IF NEW.status = 'pending' THEN
    event_type := 'membership_request';
  ELSIF NEW.status = 'approved' THEN
    event_type := 'membership_approved';
  ELSE
    -- For other statuses, don't notify
    RETURN NEW;
  END IF;
  
  -- Notify admins
  PERFORM public.notify_admins(
    event_type,
    jsonb_build_object(
      'id', NEW.id,
      'grup_id', NEW.grup_id,
      'grup_nume', grup_nume,
      'user_id', NEW.user_id,
      'user_email', user_email,
      'status', NEW.status,
      'role', NEW.role,
      'joined_at', NEW.joined_at,
      'approved_at', NEW.approved_at,
      'approved_by_user_id', NEW.approved_by_user_id
    )
  );
  
  RETURN NEW;
END;
$$;

-- Trigger function for grup_membership UPDATE (status changes like approval)
CREATE OR REPLACE FUNCTION public.notify_membership_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_email TEXT;
  grup_nume TEXT;
  approved_by_email TEXT;
BEGIN
  -- Only notify on status changes, especially approval
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
      -- Get user email
      SELECT email INTO user_email
      FROM public.profiles
      WHERE user_id = NEW.user_id;
      
      -- Get group name
      SELECT nume INTO grup_nume
      FROM public.grup
      WHERE id = NEW.grup_id;
      
      -- Get approver email if available
      IF NEW.approved_by_user_id IS NOT NULL THEN
        SELECT email INTO approved_by_email
        FROM public.profiles
        WHERE user_id = NEW.approved_by_user_id;
      END IF;
      
      -- Notify admins of approval
      PERFORM public.notify_admins(
        'membership_approved',
        jsonb_build_object(
          'id', NEW.id,
          'grup_id', NEW.grup_id,
          'grup_nume', grup_nume,
          'user_id', NEW.user_id,
          'user_email', user_email,
          'approved_by_user_id', NEW.approved_by_user_id,
          'approved_by_email', approved_by_email,
          'approved_at', NEW.approved_at
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function for profiles UPDATE
CREATE OR REPLACE FUNCTION public.notify_profile_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  old_json jsonb;
  new_json jsonb;
BEGIN
  -- Compare entire row excluding updated_at to catch any meaningful change
  old_json := to_jsonb(OLD) - 'updated_at';
  new_json := to_jsonb(NEW) - 'updated_at';

  IF old_json IS DISTINCT FROM new_json THEN
    PERFORM public.notify_admins(
      'profile_updated',
      jsonb_build_object(
        'user_id', NEW.user_id,
        'email', NEW.email,
        'updated_at', NEW.updated_at
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS notify_grup_created_trigger ON public.grup;
CREATE TRIGGER notify_grup_created_trigger
  AFTER INSERT ON public.grup
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_grup_created();

-- Enable the trigger (ensures it's active)
ALTER TABLE public.grup ENABLE TRIGGER notify_grup_created_trigger;

DROP TRIGGER IF EXISTS notify_grup_updated_trigger ON public.grup;
CREATE TRIGGER notify_grup_updated_trigger
  AFTER UPDATE ON public.grup
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_grup_updated();

-- Enable the trigger
ALTER TABLE public.grup ENABLE TRIGGER notify_grup_updated_trigger;

DROP TRIGGER IF EXISTS notify_teren_created_trigger ON public.terenuri;
CREATE TRIGGER notify_teren_created_trigger
  AFTER INSERT ON public.terenuri
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_teren_created();

-- Enable the trigger
ALTER TABLE public.terenuri ENABLE TRIGGER notify_teren_created_trigger;

DROP TRIGGER IF EXISTS notify_teren_updated_trigger ON public.terenuri;
CREATE TRIGGER notify_teren_updated_trigger
  AFTER UPDATE ON public.terenuri
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_teren_updated();

-- Enable the trigger
ALTER TABLE public.terenuri ENABLE TRIGGER notify_teren_updated_trigger;

DROP TRIGGER IF EXISTS notify_membership_request_trigger ON public.grup_membership;
CREATE TRIGGER notify_membership_request_trigger
  AFTER INSERT ON public.grup_membership
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_membership_request();

-- Enable the trigger
ALTER TABLE public.grup_membership ENABLE TRIGGER notify_membership_request_trigger;

DROP TRIGGER IF EXISTS notify_membership_status_change_trigger ON public.grup_membership;
CREATE TRIGGER notify_membership_status_change_trigger
  AFTER UPDATE ON public.grup_membership
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_membership_status_change();

-- Enable the trigger
ALTER TABLE public.grup_membership ENABLE TRIGGER notify_membership_status_change_trigger;

DROP TRIGGER IF EXISTS notify_profile_updated_trigger ON public.profiles;
CREATE TRIGGER notify_profile_updated_trigger
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_profile_updated();

-- Enable the trigger
ALTER TABLE public.profiles ENABLE TRIGGER notify_profile_updated_trigger;

COMMENT ON FUNCTION public.notify_grup_created IS 'Trigger function to notify admins when a new group is created';
COMMENT ON FUNCTION public.notify_grup_updated IS 'Trigger function to notify admins when a group is updated';
COMMENT ON FUNCTION public.notify_teren_created IS 'Trigger function to notify admins when a new teren is created';
COMMENT ON FUNCTION public.notify_teren_updated IS 'Trigger function to notify admins when a teren is updated';
COMMENT ON FUNCTION public.notify_membership_request IS 'Trigger function to notify admins when a membership request is created';
COMMENT ON FUNCTION public.notify_membership_status_change IS 'Trigger function to notify admins when membership status changes (e.g., approval)';
COMMENT ON FUNCTION public.notify_profile_updated IS 'Trigger function to notify admins when a user profile is updated';

COMMIT;
