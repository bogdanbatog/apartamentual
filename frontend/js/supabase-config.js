// Supabase Configuration
const SUPABASE_URL = 'https://glbvbbgmcobtswwlktic.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsYnZiYmdtY29idHN3d2xrdGljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4ODgyMDMsImV4cCI6MjA3MjQ2NDIwM30.1Gd2UKwjVOJC_3iHxKOhV5KJkl_D1vpa8j_lHNiQIII';

// Save SDK reference before creating client
var supabaseSDK = window.supabase;

// Create single global Supabase client — all scripts use `sb`
var sb = supabaseSDK.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Also expose as `supabase` for scripts that use that name,
// but use a different variable name to not overwrite the SDK
var supabaseClient = sb;
