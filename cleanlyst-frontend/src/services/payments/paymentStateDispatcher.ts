/**
 * Payment State Dispatcher — frontend event routing
 *
 * Subscribes to Supabase Realtime on payment_webhook_events (INSERT).
 * When the stripe-webhook backend emits an event, this dispatcher:
 *   1. Maps the Stripe event type to a PaymentEventType
 *   2. Extracts bookingId from the payload
 *   3. Reads current booking status (DB already updated by backend state machine)
 *   4. Runs the frontend state machine to compute expected output (for validation/logging)
 *   5. Routes to the appropriate subscriber hook for UI reactivity
 *
 * INVARIANT: This dispatcher is READ-ONLY with respect to the database.
 * All booking mutations happen server-side (stripe-webhook → _shared/paymentStateMachine).
 * The dispatcher and subscriber hooks exist solely for frontend state synchronisation.
 *
 * Lifecycle:
 *   call startPaymentEventDispatcher() once at app startup
 *   call stopPaymentEventDispatcher(channel) on app teardown or user logout
 */

import type { RealtimeChannel } from '@supabase/supabase-js'
import { getSupabaseClient } from '@/services/supabaseClient'
import { handle, type PaymentEventType } from './paymentStateMachine'
import { onPaymentCaptured } from './subscribers/onPaymentCaptured'
import { onPaymentRefunded } from './subscribers/onPaymentRefunded'
import type { BookingStatus } from '@/types/domain'

// ─── Stripe → PaymentEventType mapping ───────────────────────────────────────

const STRIPE_TO_PAYMENT_EVENT: Readonly<Partial<Record<string, PaymentEventType>>> = {
  'checkout.session.completed':  'PaymentAuthorized',
  'payment_intent.succeeded':    'PaymentCaptured',
  'payment_intent.canceled':     'PaymentRefunded',
  'charge.refunded':             'PaymentRefunded',
  'transfer.paid':               'PayoutReleased',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractBookingIdFromPayload(payload: Record<string, unknown>): string {
  try {
    const obj = (payload as { data?: { object?: { metadata?: Record<string, unknown> } } })
      ?.data?.object
    const fromMeta = obj?.metadata?.booking_id
    return typeof fromMeta === 'string' ? fromMeta : ''
  } catch {
    return ''
  }
}

async function loadCurrentBookingStatus(bookingId: string): Promise<BookingStatus | null> {
  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('bookings')
    .select('status')
    .eq('id', bookingId)
    .maybeSingle()
  return (data?.status as BookingStatus) ?? null
}

// ─── Event routing ────────────────────────────────────────────────────────────

async function routePaymentEvent(
  stripeEventType: string,
  rawPayload: Record<string, unknown>,
): Promise<void> {
  const machineEventType = STRIPE_TO_PAYMENT_EVENT[stripeEventType]
  if (!machineEventType) return // unhandled event type — silently skip

  const bookingId = extractBookingIdFromPayload(rawPayload)
  if (!bookingId) return

  // Read confirmed DB state (backend state machine already applied the transition)
  const currentBookingStatus = await loadCurrentBookingStatus(bookingId)
  if (!currentBookingStatus) return

  // Run frontend state machine for consistency validation and structured logging
  const output = handle({ eventType: machineEventType, currentBookingStatus })
  console.info(`[paymentStateDispatcher] ${stripeEventType} → ${machineEventType}`, {
    bookingId,
    currentBookingStatus,
    output,
  })

  if (output.action === 'noop') return

  // Route to subscriber hooks
  switch (machineEventType) {
    case 'PaymentCaptured':
      await onPaymentCaptured(bookingId)
      break
    case 'PaymentRefunded':
      await onPaymentRefunded(bookingId)
      break
    default:
      break
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Starts the Realtime subscription for payment events.
 * Call once at app startup (e.g. in a top-level composable or App.vue).
 *
 * Returns the channel so it can be passed to stopPaymentEventDispatcher on teardown.
 */
export function startPaymentEventDispatcher(): RealtimeChannel {
  const supabase = getSupabaseClient()

  return supabase
    .channel('payment-state-authority')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'payment_webhook_events' },
      (change) => {
        const row = change.new as { stripe_event_type: string; payload: Record<string, unknown> }
        routePaymentEvent(row.stripe_event_type, row.payload).catch((err) => {
          console.error('[paymentStateDispatcher] unhandled error in event routing', err)
        })
      },
    )
    .subscribe()
}

/**
 * Removes the Realtime channel. Call on logout or app teardown.
 */
export function stopPaymentEventDispatcher(channel: RealtimeChannel): void {
  getSupabaseClient().removeChannel(channel)
}
