/**
 * verify-cleaner-onboarding
 *
 * Validates an in-progress cleaner application and submits it for admin review.
 *
 * Validation checks:
 *   - Application exists and is owned by the caller
 *   - Application is in 'draft' or 'needs_info' status (not already submitted)
 *   - All three required documents are uploaded (id_document, dbs_document, insurance_document)
 *   - Required personal_details fields are present
 *
 * On success, calls the submit_cleaner_application RPC which transitions
 * the application to 'submitted' and notifies the admin team.
 */

import { corsHeaders, err, makeAdminClient, makeUserClient, ok, requireRole } from '../_shared/utils.ts'

const REQUIRED_DOCUMENTS = ['id_document', 'dbs_document', 'insurance_document'] as const

const REQUIRED_PERSONAL_FIELDS = [
  'first_name',
  'last_name',
  'date_of_birth',
  'address_line_1',
  'city',
  'postcode',
  'phone',
] as const

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const admin = makeAdminClient()

  try {
    const authHeader = req.headers.get('Authorization')
    const auth = await requireRole(authHeader, admin, 'cleaner_pending', 'cleaner_active')
    if (auth instanceof Response) return auth

    const body = await req.json().catch(() => null)
    const application_id: string | undefined = body?.application_id
    if (!application_id) return err(400, 'application_id is required')

    // ── Load application ───────────────────────────────────────────────────
    const { data: application, error: appError } = await admin
      .from('cleaner_applications')
      .select('id, cleaner_id, status, personal_details')
      .eq('id', application_id)
      .single()

    if (appError || !application) return err(404, 'Application not found')
    if (application.cleaner_id !== auth.userId) return err(403, 'Forbidden')

    const editableStatuses = ['draft', 'needs_info']
    if (!editableStatuses.includes(application.status)) {
      return err(409, `Application cannot be submitted in status: ${application.status}`)
    }

    // ── Validate personal_details fields ──────────────────────────────────
    const details = (application.personal_details ?? {}) as Record<string, unknown>
    const missingFields = REQUIRED_PERSONAL_FIELDS.filter(
      (f) => !details[f] || String(details[f]).trim() === '',
    )

    if (missingFields.length > 0) {
      return err(422, `Missing required personal details: ${missingFields.join(', ')}`)
    }

    // ── Validate all required documents are uploaded ───────────────────────
    const { data: documents, error: docsError } = await admin
      .from('cleaner_application_documents')
      .select('document_type')
      .eq('application_id', application_id)

    if (docsError) throw docsError

    const uploadedTypes = new Set((documents ?? []).map((d: { document_type: string }) => d.document_type))
    const missingDocs = REQUIRED_DOCUMENTS.filter((d) => !uploadedTypes.has(d))

    if (missingDocs.length > 0) {
      return err(
        422,
        `Missing required documents: ${missingDocs.map((d) => d.replace('_document', '')).join(', ')}`,
      )
    }

    // ── Submit application via security-definer RPC ───────────────────────
    // Must use user client so auth.uid() is populated inside the RPC.
    const uc = makeUserClient(authHeader!)
    const { data: submitted, error: submitError } = await uc.rpc('submit_cleaner_application', {
      p_application_id: application_id,
    })

    if (submitError) return err(400, submitError.message)

    // ── Notify admin team (all admins) ────────────────────────────────────
    const { data: adminProfiles } = await admin
      .from('profiles')
      .select('id')
      .eq('role', 'admin')

    if (adminProfiles && adminProfiles.length > 0) {
      const notifications = adminProfiles.map((a: { id: string }) => ({
        user_id: a.id,
        type: 'cleaner_application_submitted',
        title: 'New cleaner application',
        body: `A cleaner has submitted their onboarding application for review.`,
      }))
      await admin.from('notifications').insert(notifications)
    }

    return ok({ ok: true, application: submitted })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error'
    return err(500, message)
  }
})
