import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';

/**
 * Creates a Supabase admin client using the service role key.
 * This client bypasses Row Level Security — use ONLY in server-side code
 * for operations that require elevated privileges (e.g., user management).
 *
 * NEVER expose this client or the service role key to the browser.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
