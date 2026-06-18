import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { getStripePublishableKey } from '@/config/stripe'

let instance: Stripe | null = null
let pendingLoad: Promise<Stripe | null> | null = null

/**
 * Returns a singleton Stripe.js instance, lazily loaded on first call.
 *
 * Returns null when no publishable key is configured (e.g. local dev without .env).
 * Callers must handle null — payment UI should be hidden, not shown with errors.
 *
 * Throws if the key fails the pk_test_ / pk_live_ guard in getStripePublishableKey().
 */
export async function getStripeInstance(): Promise<Stripe | null> {
  if (instance) return instance
  if (pendingLoad) return pendingLoad

  let key: string | undefined
  try {
    key = getStripePublishableKey()
  } catch (e) {
    // Re-throw key validation failures (wrong key type for environment, etc.)
    throw e
  }

  if (!key) {
    if (import.meta.env.DEV) {
      console.warn(
        '[Stripe] No publishable key configured. ' +
          'Set VITE_STRIPE_TEST_KEY in .env to enable payment forms in development.',
      )
    }
    return null
  }

  pendingLoad = loadStripe(key).then((stripe) => {
    instance = stripe
    pendingLoad = null
    return stripe
  })

  return pendingLoad
}

/**
 * Clears the cached Stripe instance. Useful in tests or when the key changes.
 * Not needed in normal application flow.
 */
export function resetStripeInstance(): void {
  instance = null
  pendingLoad = null
}
