import { getSupabaseClient } from './supabaseClient'

export type DocumentType = 'id_document' | 'dbs_document' | 'insurance_document' | 'other'

export interface UploadResult {
  path: string
  publicUrl: string
}

export async function uploadDocument(
  userId: string,
  type: DocumentType,
  file: File,
): Promise<UploadResult> {
  const supabase = getSupabaseClient()
  const ext = file.name.split('.').pop() ?? 'pdf'
  const path = `${userId}/${type}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('documents')
    .upload(path, file, { upsert: false, contentType: file.type })
  if (error) throw error

  const { data } = supabase.storage.from('documents').getPublicUrl(path)
  return { path, publicUrl: data.publicUrl }
}

export async function deleteDocument(path: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.storage.from('documents').remove([path])
  if (error) throw error
}

export async function getSignedDocumentUrl(path: string, expiresInSeconds = 3600): Promise<string> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(path, expiresInSeconds)
  if (error) throw error
  return data.signedUrl
}

export async function getSignedCleanerDocumentUrl(
  path: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.storage
    .from('cleaner-documents')
    .createSignedUrl(path, expiresInSeconds)
  if (error) throw error
  return data.signedUrl
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const supabase = getSupabaseClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${userId}/avatar.${ext}`

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}
