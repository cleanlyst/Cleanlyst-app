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
import {
  refundPayment as callRefundPaymentEF,
  processPayout,
  type ProcessPayoutResult,
} from '@/services/paymentService'
import { resolvePaymentRoute } from './paymentRouter'
import { assertSimulationNotInProduction, warnIfCalledOutsideServiceLayer } from './paymentGuards'
import { makePaymentStartedEvent, makePaymentRefundedEvent } from './paymentEvents'
import type { OrchestratorResult, PaymentIntentContext } from './types'

// ─────────────────────────────────────────────────────────────────
// LEGACY SIMULATION PATHS
// Called ONLY when no Stripe publishable key is configured.
// In production, Stripe keys are always set — these paths must never run.
// DO NOT EXTEND. DO NOT ADD NEW BUSINESS LOGIC HERE.
// ─────────────────────────────────────────────────────────────────

async function legacyInitialPayment(bookingId: string): Promise<OrchestratorResult> {
  // LEGACY SIMULATION PATH — DO NOT EXTEND
  // This path runs ONLY when no Stripe publishable key is configured (local dev without .env keys).
  // It short-circuits the webhook by calling record_initial_payment directly.
  // In production, Stripe keys are always set so this code path must never execute.
  assertSimulationNotInProduction('legacyInitialPayment')
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('record_initial_payment', { p_booking_id: bookingId })
  if (error) throw new Error(error.message ?? 'Simulation: record_initial_payment failed')
  return { success: true, provider: 'simulation', simulationMode: true }
}

async function legacyAdditionalPayment(bookingId: string): Promise<OrchestratorResult> {
  // LEGACY SIMULATION PATH — DO NOT EXTEND
  // Same caveat as legacyInitialPayment — dev-only fallback, must not run in production.
  assertSimulationNotInProduction('legacyAdditionalPayment')
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
  warnIfCalledOutsideServiceLayer('startInitialPayment')
  const route = resolvePaymentRoute({})

  let result: OrchestratorResult
  if (route === 'simulation') {
    result = await legacyInitialPayment(bookingId)
  } else if (route === 'stripe_checkout') {
    const session = await initiateCheckoutSession(bookingId)
    result = {
      success: true,
      provider: 'stripe_checkout',
      redirectUrl: session.checkoutUrl,
      simulationMode: false,
    }
  } else {
    // stripe_intent (e.g. when preferIntent is added to the route options in Phase 2)
    const intent = await initializePaymentIntent(bookingId)
    result = {
      success: true,
      provider: 'stripe_intent',
      clientSecret: intent.clientSecret,
      simulationMode: false,
    }
  }

  console.info('[payment:started]', makePaymentStartedEvent({
    bookingId,
    paymentType: 'initial',
    provider: result.provider,
    simulationMode: result.simulationMode,
    redirectUrl: result.redirectUrl,
    clientSecret: result.clientSecret,
  }))

  return result
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
  warnIfCalledOutsideServiceLayer('startAdditionalPayment')
  // Phase 1: simulation only — see JSDoc above for Phase 2 migration path.
  const result = await legacyAdditionalPayment(bookingId)

  console.info('[payment:started]', makePaymentStartedEvent({
    bookingId,
    paymentType: 'additional',
    provider: result.provider,
    simulationMode: result.simulationMode,
  }))

  return result
}

// ─────────────────────────────────────────────────────────────────
// PHASE 3+ STUBS
// API shape defined now so callers can be written without knowing the
// implementation. Each will throw until its phase is implemented.
// ─────────────────────────────────────────────────────────────────

/**
 * Issues a full or partial refund via the refund-payment Edge Function.
 *
 * For authorized (uncaptured) payments the EF cancels the PaymentIntent;
 * for captured payments it creates a Stripe refund. In both cases the
 * Stripe webhook is the sole writer of bookings.payment_status.
 *
 * Callers do NOT need to update booking state — the webhook handles it.
 */
export async function refundPayment(
  bookingId: string,
  options: { amountCents?: number; reason?: string } = {},
): Promise<OrchestratorResult> {
  const efResult = await callRefundPaymentEF(bookingId, options.amountCents, options.reason)

  console.info('[payment:refunded]', makePaymentRefundedEvent({
    bookingId,
    paymentType: options.amountCents ? 'partial_refund' : 'refund',
    provider: 'stripe_checkout',
    simulationMode: false,
    refundId: efResult.refund_id ?? undefined,
    amountCents: options.amountCents,
    reason: options.reason,
    isFullRefund: !options.amountCents,
  }))

  return { success: true, provider: 'stripe_checkout', simulationMode: false }
}

/**
 * Issues a partial refund. Delegates to refundPayment with amountCents set.
 */
export function partialRefund(bookingId: string, amountCents: number): Promise<OrchestratorResult> {
  return refundPayment(bookingId, { amountCents })
}

/**
 * Releases the cleaner payout for a completed booking via the process-payout Edge Function.
 * Admin-only operation. Returns the payout result from the Edge Function.
 */
export function releasePayout(bookingId: string): Promise<ProcessPayoutResult> {
  return processPayout(bookingId)
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
