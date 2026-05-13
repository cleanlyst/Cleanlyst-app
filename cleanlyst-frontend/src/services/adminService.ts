import { getSupabaseClient } from '@/services/supabaseClient'

export async function getPendingCleanerApplications() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('cleaner_applications')
    .select('*')
    .in('status', ['submitted', 'under_review', 'needs_info'])
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data
}

export async function reviewCleanerApplication(
  applicationId: string,
  action: 'approved' | 'rejected' | 'needs_info',
  notes?: string,
  requestedInfo?: string,
) {
  const supabase = getSupabaseClient()

  if (action === 'approved') {
    const { error } = await supabase.functions.invoke('approve-cleaner', {
      body: { application_id: applicationId, notes: notes ?? null },
    })
    if (error) throw error
    return
  }

  if (action === 'rejected') {
    if (!notes || notes.trim().length < 10) {
      throw new Error('Rejection reason must be at least 10 characters.')
    }
    const { error } = await supabase.functions.invoke('reject-cleaner', {
      body: { application_id: applicationId, rejection_reason: notes.trim() },
    })
    if (error) throw error
    return
  }

  const { data, error } = await supabase.rpc('admin_review_cleaner_application', {
    p_application_id: applicationId,
    p_action: action,
    p_notes: notes ?? null,
    p_requested_info: requestedInfo ?? null,
  })
  if (error) throw error
  return data
}
