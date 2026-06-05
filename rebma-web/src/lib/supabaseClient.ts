// rebma-web/src/lib/supabaseClient.ts
// Single Supabase client for the entire frontend application.
// Uses the anon key (safe for browser) — RLS policies protect data server-side.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables. ' +
    'Please set them in rebma-web/.env'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
