import { requireSupabase } from '@/lib/supabase'

export function getSupabaseClient() {
  return requireSupabase()
}

export function getSupabaseClientSafe() {
  try {
    return requireSupabase()
  } catch {
    return null
  }
}
