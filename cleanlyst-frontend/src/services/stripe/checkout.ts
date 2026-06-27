import { createCheckoutSession } from '@/services/paymentService'

export interface CheckoutSession {
  checkoutUrl: string
  sessionId: string
}

function buildCheckoutUrls(): { successUrl: string; cancelUrl: string } {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return {
    successUrl: `${origin}/checkout/success`,
    cancelUrl:  `${origin}/checkout/cancel`,
  }
}

/**
 * Calls the create-checkout-session Edge Function and returns the Stripe-hosted
 * checkout URL and session ID.
 *
 * The success/cancel redirect targets are derived from the current window origin,
 * so they work correctly in dev, staging, and production without per-environment
 * env vars on the frontend.
 */
export async function initiateCheckoutSession(bookingId: string): Promise<CheckoutSession> {
  const { successUrl, cancelUrl } = buildCheckoutUrls()
  const result = await createCheckoutSession(bookingId, successUrl, cancelUrl)
  return {
    checkoutUrl: result.checkout_url,
    sessionId:   result.checkout_session_id,
  }
}

/**
 * Initiates checkout and immediately redirects the browser to Stripe's hosted
 * checkout page. Control returns only if the redirect fails.
 */
export async function redirectToCheckout(bookingId: string): Promise<never> {
  const session = await initiateCheckoutSession(bookingId)
  window.location.href = session.checkoutUrl
  throw new Error('Redirect to Stripe Checkout failed — window.location.href did not navigate')
}
