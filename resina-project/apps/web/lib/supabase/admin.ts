import { createClient as createSupabaseClient } from "@supabase/supabase-js";

let adminClientSingleton: ReturnType<typeof createSupabaseClient> | null = null;

/**
 * Service-role Supabase client — bypasses RLS. ONLY for server-side use.
 * Never import this in any client component or expose the key to the browser.
 */
export function createAdminClient() {
  if (adminClientSingleton) {
    return adminClientSingleton;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  adminClientSingleton = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClientSingleton;
}
