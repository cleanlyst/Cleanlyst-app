import { createPaymentIntent } from '@/services/paymentService'

export interface PaymentIntent {
  clientSecret: string
  paymentIntentId: string
  amountCents: number
  currency: string
}

/**
 * Calls the create-payment-intent Edge Function and returns a structured
 * PaymentIntent record.
 *
 * The clientSecret is passed to Stripe.js (Payment Element or confirmCardPayment)
 * in Phase 2. It must never be logged or stored client-side beyond the
 * immediate payment confirmation call.
 *
 * BookingService calls this — components should never call paymentService directly.
 */
export async function initializePaymentIntent(bookingId: string): Promise<PaymentIntent> {
  const result = await createPaymentIntent(bookingId)
  return {
    clientSecret: result.client_secret,
    paymentIntentId: result.payment_intent_id,
    amountCents: result.amount_cents,
    currency: result.currency,
  }
}
