// js/supabaseClient.js
// Central Supabase client used by all modules

export const SUPABASE_URL = 'https://ybrdqxetprlhscfuebyy.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlicmRxeGV0cHJsaHNjZnVlYnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MTg2NjksImV4cCI6MjA3NzQ5NDY2OX0.N7pxPNmi1ZowVd9Nik9KABhqTtp3NP-XlEcEiNlJ-8M';

// `supabase-js` loaded globally by <script src="...@2"></script> in HTML
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
