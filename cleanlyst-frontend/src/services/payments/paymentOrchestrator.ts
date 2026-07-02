/**
 * Payment Orchestrator — single entry point for ALL payment flows.
 *
 * ARCHITECTURE CONTRACT:
 *   - bookingService.ts  → orchestrator  (delegates payment concerns here)
 *   - UI components      → orchestrator  (never import paymentService or Stripe directly)
 *   - orchestrator       → stripe services + paymentRouter (never import bookingService)
 *
 * IMPORTANT — circular-dependency prevention:
 *   This file must NEVER import from bookingService.ts.
 *   Callers that need a refreshed BookingDetailRow after payment must call
 *   getBookingById() themselves — the orchestrator handles money only.
 *
 * PROVIDER ROUTING:
 *   Stripe key configured → Stripe Checkout (redirect to Stripe's hosted page)
 *   No Stripe key         → throws with a clear configuration error (not a fake path)
 *
 * WEBHOOK CONTRACT:
 *   All booking state changes flow exclusively through:
 *     Stripe → stripe-webhook EF → payment_ledger_events → sync_booking_from_ledger_event trigger
 *   The orchestrator never writes booking status or payment_status directly.
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
import { warnIfCalledOutsideServiceLayer } from './paymentGuards'
import { makePaymentStartedEvent, makePaymentRefundedEvent } from './paymentEvents'
import type { OrchestratorResult, PaymentIntentContext } from './types'

// ─────────────────────────────────────────────────────────────────
// PUBLIC ORCHESTRATOR API
// ─────────────────────────────────────────────────────────────────

/**
 * Initiates payment for a new booking (initial charge).
 *
 * Always routes to Stripe Checkout — callers MUST handle the redirect:
 *
 *   const result = await startInitialPayment(booking.id)
 *   if (result.redirectUrl) {
 *     window.location.href = result.redirectUrl   // ← always true with Stripe configured
 *   }
 *
 * Throws if Stripe is not configured (VITE_STRIPE_TEST_KEY missing in dev,
 * or VITE_STRIPE_LIVE_KEY missing in production). Configure the key — no
 * fake payment path is available.
 */
export async function startInitialPayment(
  bookingId: string,
  _context?: Partial<PaymentIntentContext>,
): Promise<OrchestratorResult> {
  warnIfCalledOutsideServiceLayer('startInitialPayment')
  const route = resolvePaymentRoute({})

  if (route === 'simulation') {
    throw new Error(
      '[PaymentOrchestrator] Stripe is not configured. ' +
      'Set VITE_STRIPE_TEST_KEY in your .env file (development) or ' +
      'VITE_STRIPE_LIVE_KEY in your deployment environment (production). ' +
      'The fake payment path has been removed — Stripe is required.',
    )
  }

  let result: OrchestratorResult
  if (route === 'stripe_checkout') {
    const session = await initiateCheckoutSession(bookingId)
    result = {
      success:        true,
      provider:       'stripe_checkout',
      redirectUrl:    session.checkoutUrl,
      simulationMode: false,
    }
  } else {
    // stripe_intent (embedded Payment Element — Phase 2)
    const intent = await initializePaymentIntent(bookingId)
    result = {
      success:        true,
      provider:       'stripe_intent',
      clientSecret:   intent.clientSecret,
      simulationMode: false,
    }
  }

  console.info('[payment:started]', makePaymentStartedEvent({
    bookingId,
    paymentType:    'initial',
    provider:       result.provider,
    simulationMode: result.simulationMode,
    redirectUrl:    result.redirectUrl,
    clientSecret:   result.clientSecret,
  }))

  return result
}

/**
 * Initiates an additional charge for a revised estimate.
 *
 * Routes through Stripe Checkout. The booking may be in `estimate_proposed`
 * or `awaiting_customer_payment` state — both are accepted by the Edge Function.
 * The Stripe webhook → ledger trigger handles all state transitions after payment.
 *
 * Callers MUST handle the redirect:
 *
 *   const result = await startAdditionalPayment(bookingId)
 *   if (result.redirectUrl) {
 *     window.location.href = result.redirectUrl
 *   }
 */
export async function startAdditionalPayment(
  bookingId: string,
  _amount?: number,
): Promise<OrchestratorResult> {
  warnIfCalledOutsideServiceLayer('startAdditionalPayment')
  const route = resolvePaymentRoute({})

  if (route === 'simulation') {
    throw new Error(
      '[PaymentOrchestrator] Stripe is not configured. ' +
      'Set VITE_STRIPE_TEST_KEY in your .env file to enable additional payments.',
    )
  }

  const supabase = getSupabaseClient()

  // Ensure the booking is in awaiting_customer_payment before creating the session.
  // If it's in estimate_proposed, transition it first. If already in awaiting_customer_payment
  // or another payable state, the transition_booking_state RPC will no-op or succeed quietly.
  // The Edge Function accepts pending_request, estimate_proposed, awaiting_customer_payment.
  const { data: booking } = await supabase
    .from('bookings')
    .select('status')
    .eq('id', bookingId)
    .maybeSingle()

  const currentStatus = (booking as { status: string } | null)?.status
  if (currentStatus === 'estimate_proposed') {
    const { error: txError } = await supabase.rpc('transition_booking_state', {
      p_booking_id:    bookingId,
      p_target_status: 'awaiting_customer_payment',
      p_notify:        false,
    })
    if (txError) throw new Error(txError.message)
  }

  const session = await initiateCheckoutSession(bookingId)
  const result: OrchestratorResult = {
    success:        true,
    provider:       'stripe_checkout',
    redirectUrl:    session.checkoutUrl,
    simulationMode: false,
  }

  console.info('[payment:started]', makePaymentStartedEvent({
    bookingId,
    paymentType:    'additional',
    provider:       result.provider,
    simulationMode: result.simulationMode,
    redirectUrl:    result.redirectUrl,
  }))

  return result
}

// ─────────────────────────────────────────────────────────────────
// REFUND & PAYOUT
// ─────────────────────────────────────────────────────────────────

/**
 * Issues a full or partial refund via the refund-payment Edge Function.
 *
 * For authorized (uncaptured) payments the EF cancels the PaymentIntent;
 * for captured payments it creates a Stripe refund. In both cases the
 * Stripe webhook is the sole writer of bookings.payment_status.
 */
export async function refundPayment(
  bookingId: string,
  options: { amountCents?: number; reason?: string } = {},
): Promise<OrchestratorResult> {
  const efResult = await callRefundPaymentEF(bookingId, options.amountCents, options.reason)

  console.info('[payment:refunded]', makePaymentRefundedEvent({
    bookingId,
    paymentType:    options.amountCents ? 'partial_refund' : 'refund',
    provider:       'stripe_checkout',
    refundId:       efResult.refund_id ?? undefined,
    amountCents:    options.amountCents,
    reason:         options.reason,
    isFullRefund:   !options.amountCents,
  }))

  return { success: true, provider: 'stripe_checkout', simulationMode: false }
}

/** Issues a partial refund. Delegates to refundPayment with amountCents set. */
export function partialRefund(bookingId: string, amountCents: number): Promise<OrchestratorResult> {
  return refundPayment(bookingId, { amountCents })
}

/**
 * Initiates Stripe Checkout for a price adjustment (positive difference only).
 *
 * Use this when booking.status === 'estimate_adjustment_requested' and
 * booking.adjustment_amount_cents > 0. The create-checkout-session Edge Function
 * charges only the adjustment_amount_cents and sets metadata.payment_type = 'adjustment'.
 * The Stripe webhook emits ADDITIONAL_PAYMENT_AUTHORIZED which transitions the booking
 * back to payment_authorized.
 *
 * For zero/negative adjustments use acceptPriceAdjustmentNoCharge() from bookingService.
 */
export async function startAdjustmentPayment(
  bookingId: string,
): Promise<OrchestratorResult> {
  warnIfCalledOutsideServiceLayer('startAdjustmentPayment')
  const route = resolvePaymentRoute({})

  if (route === 'simulation') {
    throw new Error(
      '[PaymentOrchestrator] Stripe is not configured. ' +
      'Set VITE_STRIPE_TEST_KEY to enable adjustment payments.',
    )
  }

  const session = await initiateCheckoutSession(bookingId)
  const result: OrchestratorResult = {
    success:        true,
    provider:       'stripe_checkout',
    redirectUrl:    session.checkoutUrl,
    simulationMode: false,
  }

  console.info('[payment:adjustment_started]', makePaymentStartedEvent({
    bookingId,
    paymentType:    'additional',
    provider:       result.provider,
    simulationMode: result.simulationMode,
    redirectUrl:    result.redirectUrl,
  }))

  return result
}

/**
 * Releases the cleaner payout for a completed booking via the process-payout Edge Function.
 * Admin-only operation.
 */
export function releasePayout(bookingId: string): Promise<ProcessPayoutResult> {
  return processPayout(bookingId)
}

// ─────────────────────────────────────────────────────────────────
// PHASE 3+ STUBS
// ─────────────────────────────────────────────────────────────────

export async function applyCoupon(
  _bookingId: string,
  _couponCode: string,
): Promise<OrchestratorResult> {
  throw new Error('[paymentOrchestrator.applyCoupon] Coupon system not yet implemented. Phase 3.')
}

export async function creditWallet(_userId: string, _amount: number): Promise<OrchestratorResult> {
  throw new Error('[paymentOrchestrator.creditWallet] Wallet system not yet implemented. Phase 3.')
}

export async function compensateCleaner(
  _cleanerId: string,
  _amount: number,
): Promise<OrchestratorResult> {
  throw new Error('[paymentOrchestrator.compensateCleaner] Not yet implemented. Phase 3.')
}
