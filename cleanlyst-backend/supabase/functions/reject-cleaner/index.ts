/**
 * reject-cleaner
 *
 * Admin-only. Rejects a cleaner's onboarding application with a required reason.
 *
 * Delegates to admin_review_cleaner_application(rejected) RPC which:
 *   - Transitions application status → 'rejected'
 *   - Stores the rejection_reason on the application row
 *   - Keeps cleaner role as cleaner_pending (not demoted to customer)
 *   - Writes an audit record to admin_application_reviews
 *
 * The cleaner can re-apply by updating their application after a rejection.
 * To ask for more info rather than reject, use the needs_info action
 * directly via the admin_review_cleaner_application RPC.
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
    const rejection_reason: string | undefined = body?.rejection_reason

    if (!application_id) return err(400, 'application_id is required')
    if (!rejection_reason || rejection_reason.trim().length < 10) {
      return err(400, 'rejection_reason is required and must be at least 10 characters')
    }

    // ── Verify application is in a reviewable state ───────────────────────
    const { data: application, error: appError } = await admin
      .from('cleaner_applications')
      .select('id, cleaner_id, status')
      .eq('id', application_id)
      .single()

    if (appError || !application) return err(404, 'Application not found')

    const reviewableStatuses = ['submitted', 'under_review', 'needs_info']
    if (!reviewableStatuses.includes(application.status)) {
      return err(409, `Application cannot be rejected in status: ${application.status}`)
    }

    // ── Reject via security-definer RPC (requires caller JWT) ────────────
    const { data: updated, error: rpcError } = await auth.uc.rpc(
      'admin_review_cleaner_application',
      {
        p_application_id: application_id,
        p_action: 'rejected',
        p_notes: rejection_reason.trim(),
        p_requested_info: null,
      },
    )

    if (rpcError) return err(400, rpcError.message)

    // ── Notify cleaner ─────────────────────────────────────────────────────
    await admin.from('notifications').insert({
      user_id: application.cleaner_id,
      type: 'application_rejected',
      title: 'Application not approved',
      body: `Your application has not been approved at this time. Reason: ${rejection_reason.trim()}`,
    })

    return ok({ ok: true, application: updated })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error'
    return err(500, message)
  }
})
