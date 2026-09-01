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

export type HrRole = 'admin' | 'manager' | 'staff' | 'none';

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

/** The caller's role from public.users — 'none' when not listed. */
export async function myRole(): Promise<HrRole> {
  const { data, error } = await supabase.rpc('my_role');
  if (error || typeof data !== 'string') return 'none';
  return data as HrRole;
}

/** The caller's site_key, or null for an admin with no single site. */
export async function mySite(): Promise<string | null> {
  const { data, error } = await supabase.rpc('my_site');
  if (error) return null;
  return (data as string | null) ?? null;
}

/**
 * True when the signed-in user is an HR admin.
 *
 * Use this to hide controls the user cannot use — NOT to protect data. Every
 * read and write is already scoped by site in RLS (can_access_site), so a
 * non-admin who reached a foreign site's data would still be refused.
 */
export async function isAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_hr_admin');
  if (error) return false;
  return data === true;
}
