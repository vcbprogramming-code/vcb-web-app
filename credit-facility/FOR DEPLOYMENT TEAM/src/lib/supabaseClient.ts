import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fails loudly at startup rather than letting every downstream Supabase call
  // fail with a confusing network error — see .env.example.
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project values.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * The signed-in user's email, or '' when signed out.
 *
 * Replaces whoAmI() in ../../ORIGINAL CODE/Code.js, which read
 * Session.getActiveUser().getEmail() — supplied by Google inside the Apps
 * Script iframe and impossible to spoof. Here the value comes from the Supabase
 * session, so treat it as a display convenience only: every write is
 * authorised in the database by public.is_manager(), never by this function.
 */
export async function currentEmail(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? '';
}

/**
 * Whether the signed-in user may write, per public.managers.
 *
 * Use this to hide controls the user cannot use — NOT to protect data. The
 * real gate is row level security; this call only makes the UI honest.
 */
export async function isManager(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_manager');
  if (error) return false;
  return data === true;
}
