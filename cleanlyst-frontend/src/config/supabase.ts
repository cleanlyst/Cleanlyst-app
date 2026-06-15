import { isProductionEnvironment } from './environment'

export function getSupabaseConfig(): { url: string; key: string } {
  if (isProductionEnvironment()) {
    const url = import.meta.env.VITE_SUPABASE_PROD_URL?.trim()
    const key = import.meta.env.VITE_SUPABASE_PROD_ANON_KEY?.trim()
    if (!url || !key) {
      throw new Error(
        'Production Supabase environment variables missing. ' +
          'VITE_SUPABASE_PROD_URL and VITE_SUPABASE_PROD_ANON_KEY are required for production domains.',
      )
    }
    return { url, key }
  }

  const url = import.meta.env.VITE_SUPABASE_STAGING_URL?.trim()
  const key = import.meta.env.VITE_SUPABASE_STAGING_ANON_KEY?.trim()
  if (!url || !key) {
    throw new Error(
      'Staging Supabase environment variables missing. ' +
        'Add VITE_SUPABASE_STAGING_URL and VITE_SUPABASE_STAGING_ANON_KEY to your .env file.',
    )
  }
  return { url, key }
}

export function getStripeKey(): string | undefined {
  if (isProductionEnvironment()) {
    const key = import.meta.env.VITE_STRIPE_LIVE_KEY?.trim()
    if (!key) {
      throw new Error(
        'Production Stripe live key missing. ' +
          'VITE_STRIPE_LIVE_KEY is required for production domains.',
      )
    }
    return key
  }
  return import.meta.env.VITE_STRIPE_TEST_KEY?.trim() || undefined
}
