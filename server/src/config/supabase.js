import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

/**
 * Service-role client: full database access, bypasses Row Level Security.
 * Used by every service in src/services for all reads/writes to
 * questions/answers/comments/votes/etc.
 *
 * This key must NEVER be sent to, or used by, the frontend.
 */
export const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Anon-key client: used only for the parts of the Supabase Auth API that
 * are meant to run with a user's own credentials (sign up, sign in with
 * password). This mirrors what the browser would do with the anon key.
 */
export const supabaseAuth = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// A request-scoped client; never mutate another student's auth/session state.
export function createUserClient(accessToken) {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
