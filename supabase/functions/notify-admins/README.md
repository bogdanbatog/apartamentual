# Admin Notifications Edge Function

This Edge Function handles admin notifications for various site events and can send notifications via Slack and/or Email.

## Events Tracked

- **User Signup**: New user registration (via Auth webhook)
- **Grup Created/Updated**: New groups created or significant updates
- **Teren Created/Updated**: New land listings created or updated
- **Membership Requests**: Users requesting to join groups
- **Membership Approved**: Membership requests being approved
- **Profile Updated**: User profile changes

## Setup

### 1. Deploy the Edge Function

```bash
supabase functions deploy notify-admins
```

### 2. Configure Environment Variables

Set these secrets in Supabase Dashboard (Settings > Edge Functions > Secrets):

- `SLACK_WEBHOOK_URL` (optional): Slack incoming webhook URL for notifications
- `RESEND_API_KEY` (optional): Resend API key for email notifications
- `ADMIN_EMAIL` (optional): Admin email address to receive notifications

To set secrets:

```bash
supabase secrets set SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxx
supabase secrets set ADMIN_EMAIL=admin@example.com
```

### 3. Configure Edge Function Authentication

**Important**: The migration hardcodes your Supabase URL, so you don't need database settings. However, you need to handle authentication:

#### Option A: Disable Edge Function Auth (Easiest)

1. Go to **Dashboard → Edge Functions → notify-admins → Settings**
2. **Disable authentication**
3. This allows database triggers to call the function without auth

⚠️ **Note**: This makes the function publicly accessible. Consider Option B for production.

#### Option B: Use Service Role Key

If you want to use authentication:

1. **Get your service_role key** from Dashboard → Settings → API → service_role key
2. **Option 1**: If you have superuser access, set it via:
   ```sql
   ALTER DATABASE postgres SET app.service_role_key = 'your-service-role-key';
   ```
3. **Option 2**: If you don't have privileges, hardcode it in the migration (see migration file)
4. **Option 3**: Use Supabase Vault (if available) to store the key securely

The migration is already configured to work without the service_role_key (Option A is easiest).

### 4. Set Up Auth Webhook for User Signups

1. Go to Supabase Dashboard > Authentication > Webhooks
2. Add a new webhook with:
   - **URL**: `https://your-project-id.supabase.co/functions/v1/notify-admins`
   - **Events**: Select `user.created`
   - **HTTP Method**: POST
   - **HTTP Headers**: 
     ```
     Authorization: Bearer YOUR_SERVICE_ROLE_KEY
     Content-Type: application/json
     ```

Alternatively, you can set this up programmatically or via the Supabase CLI.

### 5. Run the Migration

The migration file `003_admin_notifications.sql` creates all the necessary database triggers:

```bash
supabase db push
```

Or run it manually in the Supabase SQL editor.

## How It Works

### Database Triggers

Database triggers in Postgres detect changes and call the `notify_admins()` function, which makes an HTTP request to the Edge Function.

### Edge Function

The Edge Function receives the notification payload, formats it into a human-readable message, and sends it via:
- **Slack** (if `SLACK_WEBHOOK_URL` is configured)
- **Email** (if `RESEND_API_KEY` and `ADMIN_EMAIL` are configured)

If neither is configured, the event is logged to the console.

## Testing

Test the function directly:

```bash
curl -i --location --request POST 'https://glbvbbgmcobtswwlktic.supabase.co/functions/v1/notify-admins' \
  --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsYnZiYmdtY29idHN3d2xrdGljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4ODgyMDMsImV4cCI6MjA3MjQ2NDIwM30.1Gd2UKwjVOJC_3iHxKOhV5KJkl_D1vpa8j_lHNiQIII' \
  --header 'Content-Type: application/json' \
  --data '{
    "event_type": "user_signup",
    "data": {
      "user_id": "123e4567-e89b-12d3-a456-426614174000",
      "email": "test@example.com",
      "created_at": "2024-01-01T00:00:00Z"
    }
  }'
```

## Troubleshooting

### Triggers Not Working

1. Check that `pg_net` extension is enabled:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_net';
   ```

2. Verify database settings are set:
   ```sql
   SELECT current_setting('app.supabase_url', true);
   SELECT current_setting('app.service_role_key', true);
   ```

3. Check Edge Function logs in Supabase Dashboard

### Notifications Not Sending

1. Verify environment variables are set:
   ```bash
   supabase secrets list
   ```

2. Check Edge Function logs for errors
3. Test Slack webhook URL directly
4. Verify Resend API key is valid

## Security Notes

- The Edge Function uses service role key for authentication (when available)
- Database triggers use `SECURITY DEFINER` to bypass RLS
- Secrets are stored securely in Supabase
- The function handles errors gracefully without failing transactions
