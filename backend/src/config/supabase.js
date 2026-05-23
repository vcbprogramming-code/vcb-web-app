import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

/**
 * Admin client — uses the service_role key. Bypasses Row Level Security.
 * Use ONLY on the server for trusted business logic. Never expose this key.
 */
export const supabaseAdmin = createClient(
  env.supabaseUrl,
  env.supabaseServiceRoleKey,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
);

/**
 * Returns a Supabase client scoped to a specific user's access token.
 * Queries made with it run under that user's RLS policies — useful when we
 * want the database to enforce per-unit permissions instead of trusting code.
 */
export function supabaseForToken(accessToken) {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
