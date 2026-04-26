import type { CleanerApplication } from '@/types/domain'
import { getSupabaseClient } from '@/services/supabaseClient'

export async function getMyCleanerApplication() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('cleaner_applications')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data as CleanerApplication | null
}

export async function saveCleanerApplication(
  applicationId: string,
  payload: Partial<CleanerApplication>,
) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('cleaner_applications')
    .update(payload)
    .eq('id', applicationId)
    .select('*')
    .single()

  if (error) throw error
  return data as CleanerApplication
}

export async function submitCleanerApplication(applicationId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('submit_cleaner_application', {
    p_application_id: applicationId,
  })

  if (error) throw error
  return data as CleanerApplication
}

export async function uploadCleanerDocument(
  userId: string,
  fileName: string,
  file: File,
  applicationId: string,
  documentType: 'id_document' | 'dbs_document' | 'insurance_document',
) {
  const supabase = getSupabaseClient()
  const path = `${userId}/${applicationId}/${documentType}/${Date.now()}-${fileName}`

  const { error: storageError } = await supabase.storage
    .from('cleaner-documents')
    .upload(path, file, { upsert: false })
  if (storageError) throw storageError

  const { data, error } = await supabase
    .from('cleaner_application_documents')
    .upsert(
      {
        application_id: applicationId,
        cleaner_id: userId,
        document_type: documentType,
        file_path: path,
        mime_type: file.type,
        file_size_bytes: file.size,
      },
      { onConflict: 'application_id,document_type' },
    )
    .select('*')
    .single()

  if (error) throw error
  return data
}
