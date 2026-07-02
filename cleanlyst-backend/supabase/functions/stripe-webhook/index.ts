/**
 * stripe-webhook — ledger writer
 *
 * Responsibilities (ONLY):
 *   1. Verify the Stripe signature
 *   2. Deduplicate via payment_webhook_events
 *   3. Insert into payment_webhook_events (Realtime for frontend dispatcher)
 *   4. Resolve booking_id (from metadata or DB lookup)
 *   5. INSERT into payment_ledger_events (triggers sync_booking_from_ledger_event)
 *   6. Mark event processed
 *   7. Return 200
 *
 * INVARIANTS:
 *   - ZERO booking business logic in this file
 *   - ZERO direct booking table writes
 *   - All financial state changes flow through the ledger trigger
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

// ─── Stripe Signature Verification ───────────────────────────────────────────

function getEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

async function toHex(buffer: ArrayBuffer): Promise<string> {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function signPayload(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)))
}

async function verifyStripeSignature(
  payload: string,
  stripeSignature: string,
  secret: string,
): Promise<boolean> {
  const parts = stripeSignature.split(',').map((p) => p.trim())
  const timestamp = parts.find((p) => p.startsWith('t='))?.slice(2)
  const expected = parts.find((p) => p.startsWith('v1='))?.slice(3)
  if (!timestamp || !expected) return false
  const computed = await signPayload(secret, `${timestamp}.${payload}`)
  return computed === expected
}

// ─── Event Parsing ────────────────────────────────────────────────────────────

interface StripeEvent {
  id: string
  type: string
  data: { object: Record<string, unknown> }
}

// Stripe event type → ledger event type.
// Events not in this map are logged in payment_webhook_events but skipped from ledger.
const STRIPE_TO_LEDGER_EVENT: Readonly<Record<string, string>> = {
  'checkout.session.completed':    'PAYMENT_AUTHORIZED',
  'payment_intent.succeeded':      'PAYMENT_CAPTURED',
  'charge.refunded':               'PAYMENT_REFUNDED',
  'payment_intent.canceled':       'PAYMENT_REFUNDED',
  'transfer.paid':                 'PAYOUT_RELEASED',
}

interface LedgerPayload {
  bookingId: string
  amountCents: number | null
  stripePaymentIntentId: string | null
  stripeTransferId: string | null
  currency: string
}

/** Extracts structured data from a Stripe event object for the ledger row. */
function extractLedgerData(event: StripeEvent): Omit<LedgerPayload, 'bookingId'> {
  const obj = event.data.object

  const stripeTransferId  = event.type === 'transfer.paid'
    ? String(obj.id ?? '')
    : null

  const stripePaymentIntentId = event.type.startsWith('payment_intent.')
    ? String(obj.id ?? '')
    : obj.payment_intent
      ? String(obj.payment_intent)
      : null

  let amountCents: number | null = null
  if (event.type === 'checkout.session.completed') {
    amountCents = typeof obj.amount_total === 'number' ? obj.amount_total : null
  } else if (event.type === 'payment_intent.succeeded') {
    amountCents = typeof obj.amount_received === 'number' ? obj.amount_received : null
  } else if (event.type === 'charge.refunded') {
    amountCents = typeof obj.amount_refunded === 'number' ? obj.amount_refunded : null
  } else if (event.type === 'transfer.paid') {
    amountCents = typeof obj.amount === 'number' ? obj.amount : null
  }

  const currency = typeof obj.currency === 'string' ? obj.currency : 'gbp'

  return { amountCents, stripePaymentIntentId, stripeTransferId, currency }
}

type AdminClient = ReturnType<typeof createClient>

/** Resolves booking_id — checks event metadata first, then falls back to DB lookups. */
async function resolveBookingId(event: StripeEvent, admin: AdminClient): Promise<string> {
  const obj = event.data.object
  const metadata = obj.metadata as Record<string, unknown> | undefined

  // 1. Fast path: booking_id is in event metadata (checkout.session.completed)
  if (metadata?.booking_id) return String(metadata.booking_id)

  // 2. payment_intent events — look up via payments table
  if (event.type === 'payment_intent.succeeded' || event.type === 'payment_intent.canceled') {
    const paymentIntentId = String(obj.id ?? '')
    if (paymentIntentId) {
      const { data } = await admin
        .from('payments')
        .select('booking_id')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .maybeSingle()
      if (data?.booking_id) return String(data.booking_id)
    }
  }

  // 3. charge.refunded — payment_intent links to payments row
  if (event.type === 'charge.refunded') {
    const paymentIntentId = obj.payment_intent ? String(obj.payment_intent) : null
    if (paymentIntentId) {
      const { data } = await admin
        .from('payments')
        .select('booking_id')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .maybeSingle()
      if (data?.booking_id) return String(data.booking_id)
    }
  }

  // 4. transfer.paid — look up via payouts table
  if (event.type === 'transfer.paid') {
    const transferId = String(obj.id ?? '')
    if (transferId) {
      const { data } = await admin
        .from('payouts')
        .select('booking_id')
        .eq('stripe_transfer_id', transferId)
        .maybeSingle()
      if (data?.booking_id) return String(data.booking_id)
    }
  }

  return ''
}

// ─── HTTP Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const supabaseUrl   = getEnv('SUPABASE_URL')
    const serviceKey    = getEnv('SUPABASE_SERVICE_ROLE_KEY')
    const webhookSecret = getEnv('STRIPE_WEBHOOK_SECRET')

    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const rawBody = await req.text()
    if (!(await verifyStripeSignature(rawBody, signature, webhookSecret))) {
      return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const event = JSON.parse(rawBody) as StripeEvent
    const admin = createClient(supabaseUrl, serviceKey)

    // ── Deduplicate ───────────────────────────────────────────────────────────
    const { data: existing } = await admin
      .from('payment_webhook_events')
      .select('id')
      .eq('stripe_event_id', event.id)
      .maybeSingle()

    if (existing) {
      return new Response(JSON.stringify({ ok: true, deduped: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // ── Emit: record raw event (triggers Realtime for frontend dispatcher) ────
    const { error: emitError } = await admin.from('payment_webhook_events').insert({
      stripe_event_id:   event.id,
      stripe_event_type: event.type,
      payload:           event as unknown as Record<string, unknown>,
    })
    if (emitError) throw emitError

    // ── Write to ledger (if this event type maps to a financial event) ────────
    let ledgerEventType = STRIPE_TO_LEDGER_EVENT[event.type]

    // Detect adjustment payments: checkout.session.completed with payment_type=adjustment
    // emits ADDITIONAL_PAYMENT_AUTHORIZED instead of PAYMENT_AUTHORIZED.
    if (
      event.type === 'checkout.session.completed' &&
      ledgerEventType === 'PAYMENT_AUTHORIZED'
    ) {
      const sessionMetadata = event.data.object.metadata as Record<string, unknown> | undefined
      if (sessionMetadata?.payment_type === 'adjustment') {
        ledgerEventType = 'ADDITIONAL_PAYMENT_AUTHORIZED'
      }
    }

    if (ledgerEventType) {
      const bookingId = await resolveBookingId(event, admin)

      if (bookingId) {
        const { amountCents, stripePaymentIntentId, stripeTransferId, currency } =
          extractLedgerData(event)

        const { error: ledgerError } = await admin.from('payment_ledger_events').insert({
          booking_id:                bookingId,
          event_type:                ledgerEventType,
          amount_cents:              amountCents,
          currency,
          stripe_event_id:           event.id,
          stripe_payment_intent_id:  stripePaymentIntentId,
          stripe_transfer_id:        stripeTransferId,
          metadata:                  {
            stripe_event_type: event.type,
            resolved_at: new Date().toISOString(),
          },
        })

        if (ledgerError) {
          // UNIQUE violation means we already processed this stripe_event_id — safe to skip
          if (ledgerError.code !== '23505') throw ledgerError
        }
      } else {
        console.warn('[stripe-webhook] could not resolve booking_id for event', {
          eventId: event.id,
          eventType: event.type,
        })
      }
    }

    // ── Mark processed ────────────────────────────────────────────────────────
    await admin
      .from('payment_webhook_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('stripe_event_id', event.id)

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected webhook error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
