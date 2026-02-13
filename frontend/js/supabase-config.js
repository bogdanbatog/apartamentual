// Supabase Configuration
const SUPABASE_URL = 'https://glbvbbgmcobtswwlktic.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_I25cj3p8FZJyTAe0X2ngDA_vvz6ssWz';

// Create single global Supabase client — all scripts use `sb` or `supabase`
var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
var supabase = sb;
