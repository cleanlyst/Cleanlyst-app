import { isProductionEnvironment } from '@/config/environment'

/**
 * Returns the Stripe publishable key appropriate for the current environment.
 *
 * - Production domains (cleanlyst.co.uk, cleanlyst.app): VITE_STRIPE_LIVE_KEY (required)
 * - All other environments (local, staging, Vercel preview): VITE_STRIPE_TEST_KEY
 *
 * Returns undefined when the test key is absent — callers must treat undefined as
 * "Stripe not configured" and hide payment UI gracefully rather than throwing.
 *
 * A missing live key on a production domain throws immediately at startup,
 * preventing any accidental fallback to test mode in production.
 */
export function getStripePublishableKey(): string | undefined {
  if (isProductionEnvironment()) {
    const key = import.meta.env.VITE_STRIPE_LIVE_KEY?.trim()
    if (!key) {
      throw new Error(
        'VITE_STRIPE_LIVE_KEY is required on production domains. ' +
          'Set it in your Vercel environment variables for the production deployment.',
      )
    }
    if (!key.startsWith('pk_live_')) {
      throw new Error(
        'VITE_STRIPE_LIVE_KEY must be a Stripe live publishable key (pk_live_...). ' +
          'Test keys are not permitted on production domains.',
      )
    }
    return key
  }

  const key = import.meta.env.VITE_STRIPE_TEST_KEY?.trim()
  if (key && !key.startsWith('pk_test_')) {
    throw new Error(
      'VITE_STRIPE_TEST_KEY must be a Stripe test publishable key (pk_test_...). ' +
        'Live keys are not permitted outside production domains.',
    )
  }
  return key || undefined
}

// Short alias — used by stripeClient.ts
export const getStripeKey = getStripePublishableKey
