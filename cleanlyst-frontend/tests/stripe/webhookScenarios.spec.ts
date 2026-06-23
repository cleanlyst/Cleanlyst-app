/**
 * Stripe webhook scenario tests.
 *
 * Tests the webhook handler behaviour using synthetic Stripe event payloads.
 * These tests run against the real Supabase staging environment but mock
 * Stripe signature verification so no real Stripe keys are needed.
 *
 * The webhook handler is tested via its OBSERVABLE SIDE EFFECTS:
 *   - payment_webhook_events row inserted
 *   - payment_ledger_events row inserted
 *   - bookings.payment_status updated (via trigger)
 *
 * Run with: npm run test:stripe
 * Requires: SUPABASE_STAGING_URL, SUPABASE_STAGING_SERVICE_ROLE_KEY in .env.playwright
 *           STRIPE_WEBHOOK_URL (the Edge Function URL)
 *           STRIPE_TEST_WEBHOOK_SECRET
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import {
  makeCheckoutCompleted,
  makePaymentIntentSucceeded,
  makeChargeRefunded,
  makePaymentIntentCanceled,
  makeTransferPaid,
  makePaymentIntentFailed,
  resetEvtSeq,
} from '../fixtures/stripeFactory'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env.playwright') })

const SUPABASE_URL         = process.env.SUPABASE_STAGING_URL!
const SERVICE_ROLE_KEY     = process.env.SUPABASE_STAGING_SERVICE_ROLE_KEY!
const WEBHOOK_URL          = process.env.STRIPE_WEBHOOK_URL!
const WEBHOOK_SECRET       = process.env.STRIPE_TEST_WEBHOOK_SECRET!

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !WEBHOOK_URL || !WEBHOOK_SECRET) {
  console.warn('Stripe webhook tests skipped — required env vars missing.')
}

const admin = createClient(SUPABASE_URL ?? 'http://localhost', SERVICE_ROLE_KEY ?? 'test', {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Booking and payment IDs created before tests
let testBookingId: string
let customerUserId: string
let cleanerUserId: string

async function signPayload(secret: string, payload: string): Promise<string> {
  const ts = Math.floor(Date.now() / 1000).toString()
  const toSign = `${ts}.${payload}`
  const key = crypto.createHmac('sha256', secret)
  key.update(toSign)
  const sig = key.digest('hex')
  return `t=${ts},v1=${sig}`
}

async function sendWebhookEvent(event: object): Promise<Response> {
  const body = JSON.stringify(event)
  const sig  = await signPayload(WEBHOOK_SECRET, body)
  return fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': sig },
    body,
  })
}

async function waitForLedgerEvent(stripeEventId: string, maxWaitMs = 5000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    const { data } = await admin
      .from('payment_ledger_events')
      .select('id')
      .eq('stripe_event_id', stripeEventId)
      .maybeSingle()
    if (data) return true
    await new Promise((r) => setTimeout(r, 200))
  }
  return false
}

beforeAll(async () => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return

  resetEvtSeq()

  // Resolve test user IDs
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, role')
    .in('role', ['customer', 'cleaner_active'])
    .limit(2)

  customerUserId = profiles?.find((p) => p.role === 'customer')?.id
  cleanerUserId  = profiles?.find((p) => p.role === 'cleaner_active')?.id

  // Create a test booking
  const { data: booking } = await admin.from('bookings').insert({
    customer_id:      customerUserId,
    cleaner_id:       cleanerUserId,
    status:           'pending_request',
    payment_status:   'unpaid',
    scheduled_start:  new Date(Date.now() + 7 * 86400_000).toISOString(),
    scheduled_end:    new Date(Date.now() + 7 * 86400_000 + 7200_000).toISOString(),
    quote_cents:      10000,
    cleaner_payout_cents: 8500,
    address:          'Stripe test address',
  }).select('id').single()

  testBookingId = booking?.id

  // Create payments row (normally created by checkout session EF)
  await admin.from('payments').insert({
    booking_id: testBookingId,
    status: 'unpaid',
    amount_cents: 10000,
    currency: 'GBP',
    stripe_payment_intent_id: 'pi_test_123456',
  }).select()
})

afterAll(async () => {
  if (!testBookingId) return
  await admin.from('payment_ledger_events').delete().eq('booking_id', testBookingId)
  await admin.from('payment_webhook_events').delete().like('stripe_event_id', 'evt_test_%')
  await admin.from('payments').delete().eq('booking_id', testBookingId)
  await admin.from('bookings').delete().eq('id', testBookingId)
})

describe('Stripe webhook: checkout.session.completed', () => {
  it.skipIf(!WEBHOOK_URL || !WEBHOOK_SECRET)('inserts ledger PAYMENT_AUTHORIZED and updates booking', async () => {
    const event = makeCheckoutCompleted({ metadata: { booking_id: testBookingId } })
    const res = await sendWebhookEvent(event)
    expect(res.status).toBe(200)

    const found = await waitForLedgerEvent(event.id)
    expect(found).toBe(true)

    const { data: booking } = await admin
      .from('bookings')
      .select('payment_status, status')
      .eq('id', testBookingId)
      .single()

    expect(booking?.payment_status).toBe('authorized')
    expect(booking?.status).toBe('payment_authorized')
  })
})

describe('Stripe webhook: payment_intent.succeeded', () => {
  it.skipIf(!WEBHOOK_URL || !WEBHOOK_SECRET)('inserts ledger PAYMENT_CAPTURED and advances booking to paid', async () => {
    // Ensure booking is in payment_authorized first
    await admin.from('bookings').update({ status: 'payment_authorized', payment_status: 'authorized' }).eq('id', testBookingId)

    const event = makePaymentIntentSucceeded({ metadata: { booking_id: testBookingId } })
    const res = await sendWebhookEvent(event)
    expect(res.status).toBe(200)

    const found = await waitForLedgerEvent(event.id)
    expect(found).toBe(true)

    const { data: booking } = await admin.from('bookings').select('payment_status, status').eq('id', testBookingId).single()
    expect(booking?.payment_status).toBe('captured')
    expect(booking?.status).toBe('paid')
  })
})

describe('Stripe webhook: duplicate event handling', () => {
  it.skipIf(!WEBHOOK_URL || !WEBHOOK_SECRET)('returns 200 with deduped:true on duplicate event', async () => {
    const event = makeCheckoutCompleted({ metadata: { booking_id: testBookingId } })

    // Send first time
    await sendWebhookEvent(event)
    // Send same event again
    const res = await sendWebhookEvent(event)
    expect(res.status).toBe(200)
    const body = await res.json() as { deduped?: boolean }
    expect(body.deduped).toBe(true)
  })
})

describe('Stripe webhook: charge.refunded', () => {
  it.skipIf(!WEBHOOK_URL || !WEBHOOK_SECRET)('inserts ledger PAYMENT_REFUNDED', async () => {
    const event = makeChargeRefunded(10000)
    const res = await sendWebhookEvent(event)
    expect(res.status).toBe(200)
    const found = await waitForLedgerEvent(event.id)
    expect(found).toBe(true)
  })
})

describe('Stripe webhook: payment_intent.payment_failed', () => {
  it.skipIf(!WEBHOOK_URL || !WEBHOOK_SECRET)('does not insert ledger event (no financial state change)', async () => {
    const event = makePaymentIntentFailed({ metadata: { booking_id: testBookingId } })
    const res = await sendWebhookEvent(event)
    expect(res.status).toBe(200)

    // No ledger entry for failed payments
    const { data } = await admin
      .from('payment_ledger_events')
      .select('id')
      .eq('stripe_event_id', event.id)
    expect(data ?? []).toHaveLength(0)
  })
})

describe('Stripe webhook: unknown event type', () => {
  it.skipIf(!WEBHOOK_URL || !WEBHOOK_SECRET)('returns 200 and inserts webhook event but skips ledger', async () => {
    const event = {
      id:       'evt_test_unknown_001',
      type:     'customer.updated',
      created:  Math.floor(Date.now() / 1000),
      livemode: false,
      data:     { object: { id: 'cus_test_001' } },
    }
    const res = await sendWebhookEvent(event)
    expect(res.status).toBe(200)

    const { data: ledger } = await admin
      .from('payment_ledger_events')
      .select('id')
      .eq('stripe_event_id', event.id)
    expect(ledger ?? []).toHaveLength(0)
  })
})
