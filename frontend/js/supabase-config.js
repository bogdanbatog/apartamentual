// Supabase Configuration
const SUPABASE_URL = 'https://glbvbbgmcobtswwlktic.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsYnZiYmdtY29idHN3d2xrdGljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4ODgyMDMsImV4cCI6MjA3MjQ2NDIwM30.1Gd2UKwjVOJC_3iHxKOhV5KJkl_D1vpa8j_lHNiQIII';

// Save SDK reference before creating client (SDK loads as window.supabase)
var supabaseSDK = window.supabase;

// Create single global Supabase client
var sb = supabaseSDK.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// IMPORTANT: Many scripts use `supabase.auth`, `supabase.from()` etc.
// We must expose the client as `supabase` too (overwriting the SDK reference).
// This is safe because no other script should call createClient() anymore.
var supabase = sb;
