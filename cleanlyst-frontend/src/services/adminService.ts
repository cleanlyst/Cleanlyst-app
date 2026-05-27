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

  // Client-side validation before hitting the DB
  if (action === 'rejected') {
    if (!notes || notes.trim().length < 10) {
      throw new Error('Rejection reason must be at least 10 characters.')
    }
  }

  console.log('Reviewing cleaner application:', { applicationId, action, notes, requestedInfo })

  const { data, error } = await supabase.rpc('admin_review_cleaner_application', {
    p_application_id: applicationId,
    p_action: action,
    p_notes: action === 'rejected' ? (notes?.trim() ?? null) : (notes ?? null),
    p_requested_info: requestedInfo ?? null,
  })

  console.log('Review response:', { data, error })

  if (error) {
    if (error.message.toLowerCase().includes('not found')) {
      throw new Error('Cleaner application not found.')
    }
    if (error.message.toLowerCase().includes('only admin')) {
      throw new Error('Only admins can approve applications.')
    }
    if (error.message.toLowerCase().includes('cannot be reviewed')) {
      throw new Error('This application cannot be reviewed in its current status.')
    }
    if (error.message.toLowerCase().includes('missing required')) {
      throw new Error('Missing required documents.')
    }
    throw new Error(error.message)
  }

  return data
}
