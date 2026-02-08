// Supabase Configuration
const SUPABASE_URL = 'https://glbvbbgmcobtswwlktic.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsYnZiYmdtY29idHN3d2xrdGljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4ODgyMDMsImV4cCI6MjA3MjQ2NDIwM30.1Gd2UKwjVOJC_3iHxKOhV5KJkl_D1vpa8j_lHNiQIII';

// Create Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
