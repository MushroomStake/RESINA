import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Using fallback client configuration.");
}

export const supabase = createClient(
  supabaseUrl ?? "https://placeholder.supabase.co",
  supabaseAnonKey ?? "public-anon-key-placeholder",
  {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
},
);

AppState.addEventListener("change", (nextState) => {
  if (nextState === "active") {
    // Only start the auto-refresh loop when we actually have a stored session
    // containing a refresh token. In some environments the stored session may
    // be absent or expired and starting auto-refresh can cause an
    // unhandled/auth API error (Invalid Refresh Token).
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.refresh_token) {
          supabase.auth.startAutoRefresh();
        }
      } catch {
        // ignore and avoid starting auto-refresh
      }
    })();

    return;
  }

  supabase.auth.stopAutoRefresh();
});
