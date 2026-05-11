/**
 * approve-cleaner
 *
 * Admin-only. Approves a cleaner's onboarding application.
 *
 * Delegates to the admin_review_cleaner_application(approved) security-definer
 * RPC which:
 *   - Transitions application status → 'approved'
 *   - Promotes cleaner role: cleaner_pending → cleaner_active
 *   - Sets cleaner_profiles.status = 'approved' and onboarding_complete = true
 *   - Writes an audit record to admin_application_reviews
 *
 * The RPC must be called via the user-scoped client (not service role)
 * because it checks auth.uid() internally via is_admin().
 */

import { corsHeaders, err, makeAdminClient, ok, requireRole } from '../_shared/utils.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const admin = makeAdminClient()

  try {
    const authHeader = req.headers.get('Authorization')
    const auth = await requireRole(authHeader, admin, 'admin')
    if (auth instanceof Response) return auth

    const body = await req.json().catch(() => null)
    const application_id: string | undefined = body?.application_id
    const notes: string | undefined = body?.notes

    if (!application_id) return err(400, 'application_id is required')

    // ── Verify application exists and is in a reviewable state ────────────
    const { data: application, error: appError } = await admin
      .from('cleaner_applications')
      .select('id, cleaner_id, status')
      .eq('id', application_id)
      .single()

    if (appError || !application) return err(404, 'Application not found')

    const reviewableStatuses = ['submitted', 'under_review', 'needs_info']
    if (!reviewableStatuses.includes(application.status)) {
      return err(409, `Application cannot be approved in status: ${application.status}`)
    }

    // ── Approve via security-definer RPC (requires caller JWT) ───────────
    const { data: updated, error: rpcError } = await auth.uc.rpc(
      'admin_review_cleaner_application',
      {
        p_application_id: application_id,
        p_action: 'approved',
        p_notes: notes ?? null,
        p_requested_info: null,
      },
    )

    if (rpcError) return err(400, rpcError.message)

    // ── Notify cleaner ────────────────────────────────────────────────────
    await admin.from('notifications').insert({
      user_id: application.cleaner_id,
      type: 'application_approved',
      title: 'Application approved',
      body: 'Congratulations! Your application has been approved. You can now start accepting bookings on Cleanlyst.',
    })

    return ok({ ok: true, application: updated })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error'
    return err(500, message)
  }
})
