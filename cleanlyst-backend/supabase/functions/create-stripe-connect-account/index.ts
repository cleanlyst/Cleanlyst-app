/**
 * create-stripe-connect-account
 *
 * Creates a Stripe Express Connect account for a cleaner and returns
 * an onboarding URL they must visit to complete verification with Stripe.
 *
 * The onboarding URL is single-use and expires after 24 hours. If the
 * cleaner navigates away, call this function again to generate a new link
 * (the existing account is reused; only the link is regenerated).
 *
 * Steps:
 *   1. Validate cleaner auth
 *   2. If cleaner already has a stripe_account_id, generate a fresh link
 *   3. Otherwise, create a new Stripe Express account
 *   4. Store stripe_account_id in cleaner_profiles
 *   5. Generate and return the onboarding account_link URL
 */

import { corsHeaders, env, err, makeAdminClient, ok, requireRole, stripeGet, stripePost } from '../_shared/utils.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const admin = makeAdminClient()

  try {
    const auth = await requireRole(
      req.headers.get('Authorization'),
      admin,
      'cleaner_active',
      'cleaner_pending',
    )
    if (auth instanceof Response) return auth

    // ── Load cleaner profile ───────────────────────────────────────────────
    const { data: cleanerProfile, error: profileError } = await admin
      .from('cleaner_profiles')
      .select('user_id, stripe_account_id, onboarding_complete')
      .eq('user_id', auth.userId)
      .single()

    if (profileError || !cleanerProfile) return err(404, 'Cleaner profile not found')

    const { data: profile } = await admin
      .from('profiles')
      .select('email, full_name')
      .eq('id', auth.userId)
      .single()

    let stripeAccountId = cleanerProfile.stripe_account_id

    // ── Create Stripe Express account if not already set ──────────────────
    if (!stripeAccountId) {
      const accountParams = new URLSearchParams({
        type: 'express',
        country: 'GB',
        'capabilities[transfers][requested]': 'true',
        'capabilities[card_payments][requested]': 'true',
        'metadata[user_id]': auth.userId,
      })

      if (profile?.email) accountParams.set('email', profile.email)

      const account = await stripePost('accounts', accountParams)
      stripeAccountId = account['id'] as string

      // Persist to cleaner_profiles immediately
      const { error: updateError } = await admin
        .from('cleaner_profiles')
        .update({ stripe_account_id: stripeAccountId })
        .eq('user_id', auth.userId)

      if (updateError) throw updateError
    } else {
      // Verify the existing account is still valid
      const account = await stripeGet(`accounts/${stripeAccountId}`)
      if (account['details_submitted'] === true) {
        // Onboarding already complete — update flag if not already set
        if (!cleanerProfile.onboarding_complete) {
          await admin
            .from('cleaner_profiles')
            .update({ onboarding_complete: true })
            .eq('user_id', auth.userId)
        }
        return ok({
          already_onboarded: true,
          stripe_account_id: stripeAccountId,
        })
      }
    }

    // ── Generate account_link for onboarding ──────────────────────────────
    const frontendUrl = env('FRONTEND_URL')

    const linkParams = new URLSearchParams({
      account: stripeAccountId,
      refresh_url: `${frontendUrl}/dashboard/cleaner/stripe-connect?reauth=true`,
      return_url: `${frontendUrl}/dashboard/cleaner/stripe-connect?success=true`,
      type: 'account_onboarding',
    })

    const link = await stripePost('account_links', linkParams)

    return ok({
      onboarding_url: link['url'],
      stripe_account_id: stripeAccountId,
      expires_at: link['expires_at'],
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error'
    return err(500, message)
  }
})
