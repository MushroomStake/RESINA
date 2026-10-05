/**
 * Service-role Supabase client — bypasses RLS. ONLY for server-side use.
 * Never import this in any client component or expose the key to the browser.
 */
export declare function createAdminClient(): import("@supabase/supabase-js").SupabaseClient<unknown, {
    PostgrestVersion: string;
}, never, never, {
    PostgrestVersion: string;
}>;
//# sourceMappingURL=admin.d.ts.map