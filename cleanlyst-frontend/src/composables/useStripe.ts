import { ref } from 'vue'
import { getStripeInstance } from '@/services/stripe/stripeClient'
import { initiateCheckoutSession } from '@/services/stripe/checkout'
import { initializePaymentIntent, type PaymentIntent } from '@/services/stripe/payments'
import { parseCheckoutRedirectParams, type PostCheckoutRedirectParams } from '@/services/stripe/webhooks'

/**
 * useStripe — Vue composable for Stripe payment operations.
 *
 * Exposes three methods that cover the two Stripe payment flows:
 *
 *   Flow A — Stripe Checkout (hosted page):
 *     createCheckout(bookingId) → returns checkout URL → redirect customer
 *     retrieveSession()        → reads redirect params on return
 *
 *   Flow B — Payment Element (embedded form, Phase 2):
 *     confirmPayment(bookingId) → initialises PaymentIntent, returns clientSecret
 *
 * Components MUST NOT import from paymentService or stripeClient directly.
 * All Stripe interaction goes through this composable or BookingService.
 *
 * Phase 1: createCheckout and confirmPayment wire up the Edge Function calls.
 *          Stripe.js is loaded lazily — a missing key returns null gracefully.
 *
 * Phase 2: confirmPayment will additionally mount the Payment Element and
 *          call stripe.confirmPayment() with the clientSecret.
 */
export function useStripe() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Creates a Stripe Checkout Session for the given booking and returns the
   * hosted checkout URL. Caller is responsible for redirecting the customer.
   *
   * For an automatic redirect use: import { redirectToCheckout } from '@/services/stripe'
   */
  async function createCheckout(bookingId: string): Promise<string> {
    loading.value = true
    error.value = null
    try {
      const session = await initiateCheckoutSession(bookingId)
      return session.checkoutUrl
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create checkout session'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Phase 1: Initialises a Stripe PaymentIntent via Edge Function and returns
   * the clientSecret. The clientSecret is the input for stripe.confirmPayment()
   * or stripe.confirmCardPayment() in Phase 2.
   *
   * Phase 2 implementation note: after calling this, mount a Stripe Payment
   * Element, bind clientSecret to it, then call stripe.confirmPayment() on submit.
   * Do NOT store the clientSecret in component state beyond the payment form's
   * lifetime — treat it like a session token.
   */
  async function confirmPayment(bookingId: string): Promise<PaymentIntent> {
    loading.value = true
    error.value = null
    try {
      const stripe = await getStripeInstance()
      if (!stripe) {
        throw new Error(
          'Stripe is not configured. Set VITE_STRIPE_TEST_KEY in .env to enable payments.',
        )
      }
      return await initializePaymentIntent(bookingId)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to initialise payment'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Reads Stripe Checkout redirect params from the current URL.
   *
   * Call on the page the customer lands on after Checkout (success or cancel).
   * No async work — purely reads window.location.search.
   *
   * Phase 2: After reading the sessionId, validate it server-side by calling the
   * create-checkout-session Edge Function's verify endpoint, or wait for the
   * stripe-webhook Edge Function to update booking state via realtime.
   */
  function retrieveSession(): PostCheckoutRedirectParams {
    return parseCheckoutRedirectParams()
  }

  return {
    loading,
    error,
    createCheckout,
    confirmPayment,
    retrieveSession,
  }
}
