import { requireSupabase } from '@/lib/supabase'

export function getSupabaseClient() {
  return requireSupabase()
}
