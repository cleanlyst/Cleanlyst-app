import { getSupabaseClient } from './supabaseClient'
import type { Profile } from '@/stores/auth'

export async function getProfile(userId: string): Promise<Profile> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data as Profile
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, 'full_name' | 'phone' | 'avatar_url'>>,
): Promise<Profile> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('*')
    .single()
  if (error) throw error
  return data as Profile
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const supabase = getSupabaseClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${userId}/avatar.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}
