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
 * The portal is the front door and renders for anonymous visitors, so this is
 * empty for most page loads. It only matters for the admin panel.
 */
export async function currentEmail(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? '';
}

/**
 * True when the signed-in user may edit the app tiles and announcement.
 *
 * This replaces the ADMIN_PASSWORD_HASH check in the Apps Script version. That
 * approach cannot survive in a SPA — the hash and the comparison would both sit
 * in the browser bundle, so anyone could read the hash or skip the check. Real
 * authentication plus RLS is the only equivalent that actually holds.
 *
 * Use this to show or hide the admin UI — NOT to protect data.
 */
export async function isAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_portal_admin');
  if (error) return false;
  return data === true;
}
