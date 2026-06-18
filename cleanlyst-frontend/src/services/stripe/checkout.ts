import { createCheckoutSession } from '@/services/paymentService'

export interface CheckoutSession {
  checkoutUrl: string
  sessionId: string
}

/**
 * Calls the create-checkout-session Edge Function and returns the Stripe-hosted
 * checkout URL and session ID.
 *
 * BookingService calls this — components should never call paymentService directly.
 */
export async function initiateCheckoutSession(bookingId: string): Promise<CheckoutSession> {
  const result = await createCheckoutSession(bookingId)
  return {
    checkoutUrl: result.checkout_url,
    sessionId: result.checkout_session_id,
  }
}

/**
 * Initiates checkout and immediately redirects the browser to Stripe's hosted
 * checkout page. Control returns only if the redirect fails.
 *
 * Phase 2: After payment, Stripe redirects back to the success_url configured
 * in the create-checkout-session Edge Function. The success_url should include
 * {CHECKOUT_SESSION_ID} so the frontend can validate the session on return.
 */
export async function redirectToCheckout(bookingId: string): Promise<never> {
  const session = await initiateCheckoutSession(bookingId)
  window.location.href = session.checkoutUrl
  // Location change is async in some browsers — this path is only reached on failure
  throw new Error('Redirect to Stripe Checkout failed — window.location.href did not navigate')
}
