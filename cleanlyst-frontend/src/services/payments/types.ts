/**
 * Shared types for the Payment Orchestrator layer.
 *
 * All payment-related code should import from here — not from paymentService.ts
 * or individual Stripe service files — to keep the payment domain coherent.
 */

/** Every distinct payment operation the system can perform. */
export type PaymentType =
  | 'initial'              // First payment for a new booking
  | 'additional'           // Extra charge after estimate revision
  | 'refund'               // Full customer refund
  | 'partial_refund'       // Partial customer refund
  | 'deposit'              // Upfront deposit (future)
  | 'coupon'               // Coupon / promo code redemption (Phase 3)
  | 'wallet_credit'        // Platform wallet credit (Phase 3)
  | 'cleaner_compensation' // Admin-initiated cleaner compensation (Phase 3)

/** Which payment provider executed (or will execute) this transaction. */
export type PaymentProvider =
  | 'stripe_checkout' // Stripe-hosted Checkout page (redirect flow)
  | 'stripe_intent'   // Stripe Payment Intent (embedded Payment Element, Phase 2)
  | 'simulation'      // Legacy RPC simulation (dev without Stripe key)

/**
 * Context passed to orchestrator methods. All fields are optional — the
 * orchestrator fills in defaults from the booking or environment.
 */
export interface PaymentIntentContext {
  bookingId?: string
  userId?: string
  /** Amount in pence/cents — used for partial flows where amount != full booking value */
  amount?: number
  currency: 'gbp'
  metadata?: Record<string, string>
}

/**
 * Return value of every paymentOrchestrator method.
 *
 * Callers MUST branch on provider/simulationMode:
 *
 *   if (result.redirectUrl) {
 *     window.location.href = result.redirectUrl  // Stripe Checkout
 *   } else if (result.clientSecret) {
 *     // Phase 2: mount Payment Element with clientSecret
 *   } else {
 *     // simulationMode — booking already updated in DB, refresh UI
 *   }
 */
export interface OrchestratorResult {
  /** True when the operation succeeded or was dispatched to Stripe */
  success: boolean
  /** Which provider handled the transaction */
  provider: PaymentProvider
  /** Stripe Checkout URL — caller must redirect browser here immediately */
  redirectUrl?: string
  /** Stripe PaymentIntent clientSecret — caller mounts Payment Element (Phase 2) */
  clientSecret?: string
  /** True when the simulation RPC path ran (no Stripe key configured) */
  simulationMode: boolean
  /** Stripe refund/cancellation id — set only by refundPayment/partialRefund */
  refundId?: string
  /** Actual refunded amount in pence, clamped to the payment total — set only by refundPayment/partialRefund */
  refundCents?: number
  /** True when the refund covered the full payment amount — set only by refundPayment/partialRefund */
  isFullRefund?: boolean
}
