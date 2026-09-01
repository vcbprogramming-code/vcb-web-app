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
 * Reading the SOP does not require signing in — it is reference material, open
 * to anon, exactly as the Apps Script app was. This only matters for editing.
 */
export async function currentEmail(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? '';
}

/**
 * True when the signed-in user may edit the SOP (public.sop_editors).
 *
 * Use this to hide the editing UI — NOT to protect the data. The real gate is
 * RLS; this only makes the UI honest.
 */
export async function isEditor(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_sop_editor');
  if (error) return false;
  return data === true;
}
