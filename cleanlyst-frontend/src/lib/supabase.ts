import { createClient } from '@supabase/supabase-js'
import { getSupabaseConfig } from '@/config/supabase'
import { logEnvironmentInfo } from '@/config/environment'

logEnvironmentInfo()

const { url, key } = getSupabaseConfig()

export const supabase = createClient(url, key)

// Kept for backward compatibility — always true after config validation above
export const hasSupabaseConfig = true
export const supabaseConfigError = null

export function requireSupabase() {
  return supabase
}
