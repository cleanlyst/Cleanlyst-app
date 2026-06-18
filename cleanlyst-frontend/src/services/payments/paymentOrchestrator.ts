/**
 * Payment Orchestrator — single entry point for ALL payment flows.
 *
 * ARCHITECTURE CONTRACT:
 *   - bookingService.ts  → orchestrator  (delegates payment concerns here)
 *   - UI components      → orchestrator  (never import paymentService or Stripe directly)
 *   - orchestrator       → stripe services + paymentRouter (never import bookingService)
 *   - orchestrator       → Supabase RPCs ONLY via the legacy simulation helpers below
 *
 * IMPORTANT — circular-dependency prevention:
 *   This file must NEVER import from bookingService.ts.
 *   Callers that need a refreshed BookingDetailRow after payment must call
 *   getBookingById() themselves — the orchestrator handles money only.
 *
 * PROVIDER ROUTING (current):
 *   No Stripe key → simulation (dev / staging without .env keys)
 *   Stripe key    → Stripe Checkout for initial, simulation for additional (Phase 1)
 *
 * Phase 2 additions:
 *   - startAdditionalPayment → stripe_intent + Payment Element
 *   - startInitialPayment    → stripe_intent option for embedded form
 * Phase 3 additions:
 *   - applyCoupon, creditWallet, compensateCleaner, refundPayment, partialRefund
 */

import { getSupabaseClient } from '@/services/supabaseClient'
import { initiateCheckoutSession } from '@/services/stripe/checkout'
import { initializePaymentIntent } from '@/services/stripe/payments'
import { resolvePaymentRoute } from './paymentRouter'
import type { OrchestratorResult, PaymentIntentContext } from './types'

// ─────────────────────────────────────────────────────────────────
// LEGACY SIMULATION PATHS
// Called ONLY when no Stripe publishable key is configured.
// In production, Stripe keys are always set — these paths must never run.
// DO NOT EXTEND. DO NOT ADD NEW BUSINESS LOGIC HERE.
// ─────────────────────────────────────────────────────────────────

async function legacyInitialPayment(bookingId: string): Promise<OrchestratorResult> {
  // LEGACY SIMULATION PATH — DO NOT EXTEND
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('record_initial_payment', { p_booking_id: bookingId })
  if (error) throw new Error(error.message ?? 'Simulation: record_initial_payment failed')
  return { success: true, provider: 'simulation', simulationMode: true }
}

async function legacyAdditionalPayment(bookingId: string): Promise<OrchestratorResult> {
  // LEGACY SIMULATION PATH — DO NOT EXTEND
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('record_additional_payment', { p_booking_id: bookingId })
  if (error) throw new Error(error.message ?? 'Simulation: record_additional_payment failed')
  return { success: true, provider: 'simulation', simulationMode: true }
}

// ─────────────────────────────────────────────────────────────────
// PUBLIC ORCHESTRATOR API
// ─────────────────────────────────────────────────────────────────

/**
 * Initiates payment for a new booking (initial charge).
 *
 * Route resolution:
 *   No Stripe key     → simulation  (legacyInitialPayment — dev fallback)
 *   Stripe configured → Stripe Checkout (returns redirectUrl)
 *
 * Callers MUST handle both outcomes:
 *
 *   const result = await startInitialPayment(booking.id)
 *   if (result.redirectUrl) {
 *     window.location.href = result.redirectUrl   // ← Stripe Checkout
 *   } else {
 *     await refreshBooking()                       // ← simulation complete
 *     paymentSuccess.value = true
 *   }
 */
export async function startInitialPayment(
  bookingId: string,
  _context?: Partial<PaymentIntentContext>,
): Promise<OrchestratorResult> {
  const route = resolvePaymentRoute({})

  if (route === 'simulation') {
    return legacyInitialPayment(bookingId)
  }

  if (route === 'stripe_checkout') {
    const session = await initiateCheckoutSession(bookingId)
    return {
      success: true,
      provider: 'stripe_checkout',
      redirectUrl: session.checkoutUrl,
      simulationMode: false,
    }
  }

  // stripe_intent (e.g. when preferIntent is added to the route options in Phase 2)
  const intent = await initializePaymentIntent(bookingId)
  return {
    success: true,
    provider: 'stripe_intent',
    clientSecret: intent.clientSecret,
    simulationMode: false,
  }
}

/**
 * Initiates an additional charge for a booking (estimate revision payment).
 *
 * Phase 1: Always uses simulation — the Payment Element UI required for
 * embedded additional payments does not exist yet.
 *
 * Phase 2 TODO: When the estimate-payment modal mounts a Stripe Payment Element,
 * change this to resolvePaymentRoute({ preferIntent: true }) and mount the
 * returned clientSecret in the modal.
 *
 * Caller must refresh booking state after this resolves:
 *
 *   await startAdditionalPayment(bookingId)
 *   const updated = await getBookingById(bookingId)
 *   if (updated) booking.value = updated
 */
export async function startAdditionalPayment(
  bookingId: string,
  _amount?: number,
): Promise<OrchestratorResult> {
  // Phase 1: simulation only — see JSDoc above for Phase 2 migration path.
  return legacyAdditionalPayment(bookingId)
}

// ─────────────────────────────────────────────────────────────────
// PHASE 3+ STUBS
// API shape defined now so callers can be written without knowing the
// implementation. Each will throw until its phase is implemented.
// ─────────────────────────────────────────────────────────────────

/**
 * Issues a full refund for a payment.
 * Phase 3: route to refund-payment Edge Function (already exists in paymentService).
 */
export async function refundPayment(_paymentId: string): Promise<OrchestratorResult> {
  throw new Error(
    '[paymentOrchestrator.refundPayment] Not yet implemented. ' +
      'Use adminPaymentService.refundPayment() (Edge Function) directly. Phase 3 will integrate this.',
  )
}

/**
 * Issues a partial refund for a payment.
 * Phase 3: extend refund-payment Edge Function to accept partial amount.
 */
export async function partialRefund(_paymentId: string, _amount: number): Promise<OrchestratorResult> {
  throw new Error(
    '[paymentOrchestrator.partialRefund] Not yet implemented. Phase 3.',
  )
}

/**
 * Applies a coupon or promotion code to a booking's price.
 * Phase 3: requires coupon validation service + pricing recalculation.
 */
export async function applyCoupon(
  _bookingId: string,
  _couponCode: string,
): Promise<OrchestratorResult> {
  throw new Error(
    '[paymentOrchestrator.applyCoupon] Coupon system not yet implemented. Phase 3.',
  )
}

/**
 * Credits the platform wallet for a user.
 * Phase 3: requires wallet ledger table + balance tracking.
 */
export async function creditWallet(_userId: string, _amount: number): Promise<OrchestratorResult> {
  throw new Error(
    '[paymentOrchestrator.creditWallet] Wallet system not yet implemented. Phase 3.',
  )
}

/**
 * Initiates a discretionary compensation payout to a cleaner.
 * Phase 3: requires admin authorization + Stripe transfer to cleaner account.
 */
export async function compensateCleaner(
  _cleanerId: string,
  _amount: number,
): Promise<OrchestratorResult> {
  throw new Error(
    '[paymentOrchestrator.compensateCleaner] Cleaner compensation not yet implemented. Phase 3.',
  )
}
