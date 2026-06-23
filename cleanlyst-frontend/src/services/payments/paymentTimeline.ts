/**
 * paymentTimeline — merges ledger, booking, and payout events into one
 * deterministic chronological timeline per booking.
 *
 * Supports future support tooling and admin investigation views.
 * Pure read. No writes.
 */

import { getSupabaseClient } from '@/services/supabaseClient'
import { getLedgerEvents, type LedgerEvent } from './paymentLedgerResolver'

export type TimelineEventType =
  | 'BOOKING_CREATED'
  | 'BOOKING_ACCEPTED'
  | 'BOOKING_DECLINED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_STARTED'
  | 'BOOKING_COMPLETED'
  | 'BOOKING_DISPUTED'
  | 'BOOKING_REFUNDED'
  | 'STATUS_CHANGED'
  | 'PAYMENT_AUTHORIZED'
  | 'PAYMENT_CAPTURED'
  | 'PAYMENT_REFUNDED'
  | 'PAYOUT_RELEASED'
  | 'PAYOUT_REVERSED'

export type TimelineSource = 'booking' | 'booking_event' | 'ledger' | 'payout'

export interface TimelineEntry {
  id:          string
  timestamp:   string
  eventType:   TimelineEventType
  title:       string
  description: string
  source:      TimelineSource
  metadata:    Record<string, unknown>
}

// ─── Status label helpers ─────────────────────────────────────────────────────

const BOOKING_STATUS_TITLES: Record<string, string> = {
  pending_request:             'Booking Requested',
  accepted:                    'Booking Accepted',
  paid:                        'Payment Received',
  payment_authorized:          'Payment Authorized',
  in_progress:                 'Cleaning Started',
  completed:                   'Cleaning Completed',
  completion_pending_customer: 'Awaiting Customer Confirmation',
  cancelled:                   'Booking Cancelled',
  cleaner_cancelled:           'Cleaner Cancelled',
  cleaner_no_show:             'Cleaner Did Not Attend',
  declined:                    'Booking Declined',
  cleaner_declined:            'Cleaner Declined',
  disputed:                    'Dispute Opened',
  refunded:                    'Refund Issued',
  estimate_proposed:           'Estimate Proposed',
  awaiting_customer_payment:   'Awaiting Payment',
}

function statusToEventType(status: string): TimelineEventType {
  const map: Record<string, TimelineEventType> = {
    accepted:    'BOOKING_ACCEPTED',
    in_progress: 'BOOKING_STARTED',
    completed:   'BOOKING_COMPLETED',
    cancelled:   'BOOKING_CANCELLED',
    declined:    'BOOKING_DECLINED',
    disputed:    'BOOKING_DISPUTED',
    refunded:    'BOOKING_REFUNDED',
  }
  return map[status] ?? 'STATUS_CHANGED'
}

function ledgerEventType(type: LedgerEvent['eventType']): TimelineEventType {
  const map: Record<string, TimelineEventType> = {
    PAYMENT_AUTHORIZED: 'PAYMENT_AUTHORIZED',
    PAYMENT_CAPTURED:   'PAYMENT_CAPTURED',
    PAYMENT_REFUNDED:   'PAYMENT_REFUNDED',
    PAYOUT_RELEASED:    'PAYOUT_RELEASED',
    PAYOUT_REVERSED:    'PAYOUT_REVERSED',
  }
  return map[type] ?? 'STATUS_CHANGED'
}

function ledgerTitle(type: LedgerEvent['eventType']): string {
  const map: Record<string, string> = {
    PAYMENT_AUTHORIZED: 'Payment Authorized',
    PAYMENT_CAPTURED:   'Payment Captured',
    PAYMENT_REFUNDED:   'Refund Issued',
    PAYOUT_RELEASED:    'Payout Released to Cleaner',
    PAYOUT_REVERSED:    'Payout Reversed',
  }
  return map[type] ?? type
}

// ─── Data fetching ────────────────────────────────────────────────────────────

interface RawBookingStatusEvent {
  id: string
  from_status: string | null
  to_status: string | null
  actor_role: string | null
  notes: string | null
  created_at: string
}

interface RawBooking {
  id: string
  created_at: string
  status: string
}

interface RawPayout {
  id: string
  status: string
  released_at: string | null
  created_at: string
  amount_cents: number
  stripe_transfer_id: string | null
}

async function fetchBookingStatusEvents(bookingId: string): Promise<RawBookingStatusEvent[]> {
  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('booking_status_events')
    .select('id, from_status, to_status, actor_role, notes, created_at')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true })
  return (data ?? []) as RawBookingStatusEvent[]
}

async function fetchBooking(bookingId: string): Promise<RawBooking | null> {
  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('bookings')
    .select('id, created_at, status')
    .eq('id', bookingId)
    .maybeSingle()
  return data as RawBooking | null
}

async function fetchPayout(bookingId: string): Promise<RawPayout | null> {
  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('payouts')
    .select('id, status, released_at, created_at, amount_cents, stripe_transfer_id')
    .eq('booking_id', bookingId)
    .maybeSingle()
  return data as RawPayout | null
}

// ─── Builder ─────────────────────────────────────────────────────────────────

/**
 * Builds a single deterministic chronological timeline for a booking.
 *
 * Sources merged:
 *   - bookings.created_at (booking creation event)
 *   - booking_status_events (all status transitions)
 *   - payment_ledger_events (all financial events)
 *   - payouts (payout lifecycle)
 *
 * Determinism: ties broken by (timestamp ASC, source priority ASC, id ASC)
 * Source priority: booking < booking_event < ledger < payout
 */
export async function buildPaymentTimeline(bookingId: string): Promise<TimelineEntry[]> {
  const [booking, statusEvents, ledgerEvents, payout] = await Promise.all([
    fetchBooking(bookingId),
    fetchBookingStatusEvents(bookingId),
    getLedgerEvents(bookingId),
    fetchPayout(bookingId),
  ])

  const entries: TimelineEntry[] = []

  // ── Booking created ────────────────────────────────────────────────────────
  if (booking) {
    entries.push({
      id:          `booking-created-${booking.id}`,
      timestamp:   booking.created_at,
      eventType:   'BOOKING_CREATED',
      title:       'Booking Created',
      description: 'Customer submitted a booking request',
      source:      'booking',
      metadata:    { bookingId },
    })
  }

  // ── Booking status events ──────────────────────────────────────────────────
  for (const ev of statusEvents) {
    const toStatus = ev.to_status ?? ''
    entries.push({
      id:          `bse-${ev.id}`,
      timestamp:   ev.created_at,
      eventType:   statusToEventType(toStatus),
      title:       BOOKING_STATUS_TITLES[toStatus] ?? `Status → ${toStatus}`,
      description: ev.notes
        ? `${ev.actor_role ?? 'system'}: ${ev.notes}`
        : `Transitioned from ${ev.from_status ?? '?'} to ${toStatus} by ${ev.actor_role ?? 'system'}`,
      source:      'booking_event',
      metadata:    {
        fromStatus: ev.from_status,
        toStatus,
        actorRole:  ev.actor_role,
        notes:      ev.notes,
      },
    })
  }

  // ── Ledger events ──────────────────────────────────────────────────────────
  for (const ev of ledgerEvents) {
    entries.push({
      id:          `ledger-${ev.id}`,
      timestamp:   ev.createdAt,
      eventType:   ledgerEventType(ev.eventType),
      title:       ledgerTitle(ev.eventType),
      description: ev.amountCents
        ? `£${(ev.amountCents / 100).toFixed(2)} — stripe_event: ${ev.stripeEventId}`
        : `stripe_event: ${ev.stripeEventId}`,
      source:      'ledger',
      metadata:    {
        ledgerEventId:         ev.id,
        eventType:             ev.eventType,
        amountCents:           ev.amountCents,
        currency:              ev.currency,
        stripeEventId:         ev.stripeEventId,
        stripePaymentIntentId: ev.stripePaymentIntentId,
        stripeTransferId:      ev.stripeTransferId,
      },
    })
  }

  // ── Payout ────────────────────────────────────────────────────────────────
  if (payout && payout.released_at) {
    entries.push({
      id:          `payout-${payout.id}`,
      timestamp:   payout.released_at,
      eventType:   'PAYOUT_RELEASED',
      title:       'Payout Released to Cleaner',
      description: `£${(payout.amount_cents / 100).toFixed(2)} transferred via Stripe Connect`,
      source:      'payout',
      metadata:    {
        payoutId:         payout.id,
        amountCents:      payout.amount_cents,
        stripeTransferId: payout.stripe_transfer_id,
        status:           payout.status,
      },
    })
  }

  // ── Sort: timestamp ASC, source priority ASC, id ASC ─────────────────────
  const sourcePriority: Record<TimelineSource, number> = {
    booking:       0,
    booking_event: 1,
    ledger:        2,
    payout:        3,
  }

  entries.sort((a, b) => {
    const timeDiff = a.timestamp.localeCompare(b.timestamp)
    if (timeDiff !== 0) return timeDiff
    const srcDiff = sourcePriority[a.source] - sourcePriority[b.source]
    if (srcDiff !== 0) return srcDiff
    return a.id.localeCompare(b.id)
  })

  return entries
}
