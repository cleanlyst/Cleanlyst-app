/**
 * Payment Router — decides WHICH provider handles a given payment operation.
 *
 * This is the only place where provider selection logic lives. Adding support
 * for a new provider (Apple Pay, Klarna, wallets) means a change here only —
 * the orchestrator and callers stay untouched.
 *
 * Current routing rules:
 *   No Stripe key configured  → 'simulation'  (dev / CI without .env keys)
 *   Stripe key present        → 'stripe_checkout' by default
 *   Stripe key + preferIntent → 'stripe_intent'  (embedded Payment Element, Phase 2)
 */

import { getStripePublishableKey } from '@/config/stripe'
import type { PaymentProvider } from './types'

export interface RouteOptions {
  /**
   * When true, prefers stripe_intent over stripe_checkout.
   * Use for flows where the customer stays on-page (additional payment modals,
   * deposit collection, embedded forms).
   * Phase 2 will activate this path via the Payment Element.
   */
  preferIntent?: boolean
}

function isStripeConfigured(): boolean {
  try {
    return !!getStripePublishableKey()
  } catch {
    // getStripePublishableKey() throws when a wrong key type is used for the env.
    // Treat as not configured so the app degrades safely.
    return false
  }
}

/**
 * Returns the PaymentProvider the orchestrator should use for the current operation.
 * Called once per orchestrator method — result is not cached.
 */
export function resolvePaymentRoute(options: RouteOptions = {}): PaymentProvider {
  if (!isStripeConfigured()) return 'simulation'
  if (options.preferIntent) return 'stripe_intent'
  return 'stripe_checkout'
}
