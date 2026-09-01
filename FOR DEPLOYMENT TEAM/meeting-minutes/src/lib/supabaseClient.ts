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
 * Replaces Session.getActiveUser().getEmail() in the Apps Script version, which
 * Google supplied and could not be spoofed. Here the value comes from the
 * Supabase session, so treat it as a display convenience only: authorisation
 * happens in the database via row level security, never via this function.
 */
export async function currentEmail(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? '';
}

/** True when the signed-in user is on public.admins. */
export async function isAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_admin');
  if (error) return false;
  return data === true;
}

/**
 * True when the signed-in user may edit content (admin OR editor).
 *
 * Use this to hide controls the user cannot use — NOT to protect data. The real
 * gate is RLS; this only makes the UI honest. Note that hidden/pinned changes
 * are admin-only and enforced by a trigger, so an editor seeing those controls
 * would still be refused by the database.
 */
export async function isEditor(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_editor');
  if (error) return false;
  return data === true;
}
