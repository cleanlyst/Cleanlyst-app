import Constants from "expo-constants";
import { createClient } from "@supabase/supabase-js";

const { supabaseUrl, supabaseAnonKey } =
  Constants.expoConfig?.extra ?? {};

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase environment variables are required.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});