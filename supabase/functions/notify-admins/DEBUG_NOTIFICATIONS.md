# Debugging Admin Notifications

If database triggers aren't calling the Edge Function, follow these steps:

## Step 1: Run the Debug Script

Run the debug migration to check your setup:

```sql
-- Copy and paste the contents of supabase/migrations/004_debug_notifications.sql
-- into your Supabase SQL Editor and run it
```

This will check:
- ✅ If `pg_net` extension is enabled
- ✅ If all triggers exist
- ✅ If `notify_admins` function exists
- ✅ Test the function directly
- ✅ Test HTTP call from pg_net

## Step 2: Check Each Component

### A. Check pg_net Extension

```sql
SELECT * FROM pg_extension WHERE extname = 'pg_net';
```

**If it returns nothing**, pg_net is not enabled. Enable it:

```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
```

**If you get an error** like "permission denied", contact Supabase support or use Database Webhooks instead.

### B. Check Triggers Exist

```sql
SELECT 
    trigger_name,
    event_object_table as table_name,
    event_manipulation as event
FROM information_schema.triggers
WHERE trigger_schema = 'public' 
    AND trigger_name LIKE 'notify_%'
ORDER BY trigger_name;
```

You should see:
- `notify_grup_created_trigger`
- `notify_grup_updated_trigger`
- `notify_teren_created_trigger`
- `notify_teren_updated_trigger`
- `notify_membership_request_trigger`
- `notify_membership_status_change_trigger`
- `notify_profile_updated_trigger`

**If triggers are missing**, re-run the migration:

```sql
-- Copy and paste just the CREATE TRIGGER statements from 003_admin_notifications.sql
```

### C. Test notify_admins Function Directly

```sql
SELECT public.notify_admins(
    'grup_created'::text,
    jsonb_build_object(
        'id', gen_random_uuid(),
        'nume', 'Test Group',
        'owner_user_id', '00000000-0000-0000-0000-000000000000'::uuid,
        'owner_email', 'test@example.com',
        'zona', 'Test Zone',
        'max_members', 20,
        'status', 'active',
        'created_at', NOW()::text
    )
);
```

**Check the output**:
- If you see `NOTICE` messages, the function is running
- If you see `WARNING`, check the message for errors
- If it returns without output, check Edge Function logs

### D. Test HTTP Call from pg_net

```sql
DO $$
DECLARE
    response_status INT;
BEGIN
    SELECT status INTO response_status
    FROM net.http_post(
        url := 'https://glbvbbgmcobtswwlktic.supabase.co/functions/v1/notify-admins',
        headers := jsonb_build_object(
            'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
            'event_type', 'test',
            'data', jsonb_build_object('test', true),
            'timestamp', NOW()::text
        )
    );
    
    RAISE NOTICE 'HTTP call returned status: %', response_status;
END $$;
```

**Check the status**:
- `200` = Success! HTTP call works
- `401` = Authentication error (disable Edge Function auth)
- `404` = URL wrong or Edge Function not deployed
- `NULL` = pg_net not working or network issue

## Step 3: Test a Real Trigger

### Test Group Creation Trigger

```sql
-- Insert a test group (replace with a real user_id from your profiles table)
INSERT INTO public.grup (
    owner_user_id,
    nume,
    descriere,
    zona,
    nr_apartamente_dorite,
    buget_max_per_apartament,
    status,
    is_public,
    max_members
) VALUES (
    (SELECT user_id FROM public.profiles LIMIT 1), -- Use a real user
    'Debug Test Group',
    'This is a test',
    'Test Zone',
    10,
    50000.00,
    'active',
    true,
    20
);
```

**Then check**:
1. Edge Function logs in Dashboard → Edge Functions → notify-admins → Logs
2. PostgreSQL logs (if available) for NOTICE/WARNING messages
3. Your notification channel (Slack/Email) for the notification

### Test Teren Creation Trigger

```sql
-- Insert a test teren
INSERT INTO public.terenuri (
    created_by_user_id,
    titlu,
    descriere,
    zona,
    suprafata,
    pret_pe_mp,
    status
) VALUES (
    (SELECT user_id FROM auth.users LIMIT 1), -- Use a real user
    'Debug Test Teren',
    'This is a test teren',
    'Test Zone',
    1000,
    100.00,
    'active'
);
```

## Step 4: Check PostgreSQL Logs

If you have access to PostgreSQL logs, look for:
- `NOTICE` messages (successful calls)
- `WARNING` messages (errors)
- Check for messages containing "notify_admins" or "Failed to notify"

## Step 5: Verify Edge Function Authentication

1. Go to **Dashboard → Edge Functions → notify-admins → Settings**
2. Check if authentication is **disabled** (required for database triggers)
3. If it's enabled, the HTTP calls from pg_net will fail with 401

## Step 6: Common Issues and Fixes

### Issue: pg_net Returns NULL

**Cause**: Extension not enabled or not available

**Fix**: 
```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
```

If that fails, contact Supabase support or use Database Webhooks instead.

### Issue: HTTP Call Returns 401

**Cause**: Edge Function authentication is enabled

**Fix**: 
1. Go to Dashboard → Edge Functions → notify-admins → Settings
2. Disable authentication

### Issue: HTTP Call Returns 404

**Cause**: Edge Function not deployed or URL wrong

**Fix**: 
1. Verify Edge Function is deployed: `supabase functions list`
2. Check the URL matches your project: `https://glbvbbgmcobtswwlktic.supabase.co/functions/v1/notify-admins`

### Issue: Triggers Exist But Don't Fire

**Cause**: RLS policies might be blocking triggers

**Fix**: Triggers run as `SECURITY DEFINER`, so they should bypass RLS. Check:
```sql
-- Verify trigger functions are SECURITY DEFINER
SELECT 
    p.proname as function_name,
    p.prosecdef as is_security_definer
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
    AND p.proname LIKE 'notify_%';
```

All should return `true` for `is_security_definer`.

### Issue: Function Runs But No Notifications

**Cause**: Edge Function might not have secrets configured

**Fix**: Check Edge Function secrets:
```bash
supabase secrets list
```

Verify `SLACK_WEBHOOK_URL` or `RESEND_API_KEY` is set.

## Step 7: Enable Verbose Logging

The migration has been updated to include `RAISE NOTICE` statements. Check PostgreSQL logs or Supabase Dashboard logs for these messages when triggers fire.

## Still Not Working?

1. **Check Edge Function logs**: Dashboard → Edge Functions → notify-admins → Logs
2. **Verify pg_net is working**: Run the test HTTP call (Step 2.D)
3. **Test function directly**: Run the `notify_admins` test (Step 2.C)
4. **Check trigger firing**: Insert test data and check logs (Step 3)

If all else fails, you can use **Supabase Database Webhooks** instead of pg_net (requires Dashboard setup).

