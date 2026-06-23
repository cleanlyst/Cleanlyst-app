/**
 * stripeFactory — synthetic Stripe event payloads for webhook and unit tests.
 *
 * All IDs use the evt_test_ prefix so they are clearly not real Stripe events.
 * No secret keys are used — these are structural mocks only.
 */

export interface MockStripeEvent {
  id: string
  type: string
  data: { object: Record<string, unknown> }
  created: number
  livemode: boolean
}

let evtSeq = 0
export function resetEvtSeq() { evtSeq = 0 }
function evtId() { return `evt_test_${String(++evtSeq).padStart(6, '0')}` }

const BOOKING_ID  = '11111111-1111-1111-1111-111111111111'
const PI_ID       = 'pi_test_123456'
const SESSION_ID  = 'cs_test_abcdef'
const CHARGE_ID   = 'ch_test_abcdef'
const TRANSFER_ID = 'tr_test_abcdef'

export function makeCheckoutCompleted(overrides?: Record<string, unknown>): MockStripeEvent {
  return {
    id:       evtId(),
    type:     'checkout.session.completed',
    created:  1700000000,
    livemode: false,
    data: {
      object: {
        id:              SESSION_ID,
        payment_intent:  PI_ID,
        amount_total:    10_000,
        currency:        'gbp',
        payment_status:  'paid',
        metadata:        { booking_id: BOOKING_ID },
        ...overrides,
      },
    },
  }
}

export function makePaymentIntentSucceeded(overrides?: Record<string, unknown>): MockStripeEvent {
  return {
    id:       evtId(),
    type:     'payment_intent.succeeded',
    created:  1700000060,
    livemode: false,
    data: {
      object: {
        id:              PI_ID,
        amount_received: 10_000,
        currency:        'gbp',
        metadata:        { booking_id: BOOKING_ID },
        ...overrides,
      },
    },
  }
}

export function makeChargeRefunded(amountRefunded = 10_000, overrides?: Record<string, unknown>): MockStripeEvent {
  return {
    id:       evtId(),
    type:     'charge.refunded',
    created:  1700000120,
    livemode: false,
    data: {
      object: {
        id:              CHARGE_ID,
        payment_intent:  PI_ID,
        amount_refunded: amountRefunded,
        currency:        'gbp',
        metadata:        { booking_id: BOOKING_ID },
        ...overrides,
      },
    },
  }
}

export function makePaymentIntentCanceled(overrides?: Record<string, unknown>): MockStripeEvent {
  return {
    id:       evtId(),
    type:     'payment_intent.canceled',
    created:  1700000120,
    livemode: false,
    data: {
      object: {
        id:       PI_ID,
        currency: 'gbp',
        metadata: { booking_id: BOOKING_ID },
        ...overrides,
      },
    },
  }
}

export function makeTransferPaid(overrides?: Record<string, unknown>): MockStripeEvent {
  return {
    id:       evtId(),
    type:     'transfer.paid',
    created:  1700001000,
    livemode: false,
    data: {
      object: {
        id:       TRANSFER_ID,
        amount:   8_500,
        currency: 'gbp',
        ...overrides,
      },
    },
  }
}

export function makePaymentIntentFailed(overrides?: Record<string, unknown>): MockStripeEvent {
  return {
    id:       evtId(),
    type:     'payment_intent.payment_failed',
    created:  1700000030,
    livemode: false,
    data: {
      object: {
        id:       PI_ID,
        currency: 'gbp',
        last_payment_error: { message: 'Your card has insufficient funds.', code: 'insufficient_funds' },
        metadata: { booking_id: BOOKING_ID },
        ...overrides,
      },
    },
  }
}
