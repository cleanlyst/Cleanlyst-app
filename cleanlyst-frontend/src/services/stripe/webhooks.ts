/**
 * Stripe Webhook — Frontend Utilities (Phase 1 stub)
 *
 * Webhook *processing* is entirely server-side, handled by the
 * stripe-webhook Edge Function (cleanlyst-backend/supabase/functions/stripe-webhook/).
 * This module only provides:
 *
 *   1. The canonical list of webhook event types the system responds to (for IDE
 *      autocomplete and cross-layer consistency checks).
 *
 *   2. A helper to parse Stripe Checkout redirect URL params on the success/cancel
 *      return page — this is the only webhook-adjacent work the frontend does.
 *
 * Phase 2 will add: polling/realtime sync after Checkout redirect, and mounting
 * Stripe Payment Status components on the order-confirmation page.
 */

/** Events handled by the stripe-webhook Edge Function. */
export type StripeWebhookEventType =
  | 'checkout.session.completed'
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'
  | 'charge.refunded'
  | 'transfer.created'
  | 'account.updated'

export interface PostCheckoutRedirectParams {
  /** Stripe Checkout session ID from ?session_id= query param (if present) */
  sessionId: string | null
  /** Custom status param set in the Edge Function success/cancel URLs */
  checkoutStatus: 'success' | 'cancelled' | null
}

/**
 * Parses the current URL for Stripe Checkout redirect params.
 *
 * Call this on the page the customer lands on after Checkout.
 * The Edge Function's success_url should include {CHECKOUT_SESSION_ID}
 * so the server can validate the session against the booking.
 *
 * Example success_url: https://app.cleanlyst.co.uk/booking/{id}?checkout_status=success&session_id={CHECKOUT_SESSION_ID}
 */
export function parseCheckoutRedirectParams(): PostCheckoutRedirectParams {
  const params = new URLSearchParams(window.location.search)
  const rawStatus = params.get('checkout_status')
  const checkoutStatus =
    rawStatus === 'success' || rawStatus === 'cancelled' ? rawStatus : null

  return {
    sessionId: params.get('session_id'),
    checkoutStatus,
  }
}
