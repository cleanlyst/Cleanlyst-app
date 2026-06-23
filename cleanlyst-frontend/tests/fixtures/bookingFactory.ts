/**
 * bookingFactory — deterministic test data for bookings table rows.
 */

import type { BookingStatus } from '@/types/domain'

let idSeq = 0
export function resetIdSeq() { idSeq = 0 }

export interface MockBookingRow {
  id: string
  customer_id: string
  cleaner_id: string
  status: BookingStatus
  payment_status: string
  created_at: string
  updated_at: string
  scheduled_start: string
  scheduled_end: string
  accepted_at: string | null
  started_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  quote_cents: number
  cleaner_payout_cents: number
  address: string
  notes: string | null
}

export function makeBooking(overrides: Partial<MockBookingRow> = {}): MockBookingRow {
  const n = ++idSeq
  return {
    id:                  `bbbbbbbb-bbbb-bbbb-bbbb-${String(n).padStart(12, '0')}`,
    customer_id:         'cccccccc-cccc-cccc-cccc-cccccccccccc',
    cleaner_id:          'dddddddd-dddd-dddd-dddd-dddddddddddd',
    status:              'pending_request',
    payment_status:      'unpaid',
    created_at:          '2026-01-01T10:00:00.000Z',
    updated_at:          '2026-01-01T10:00:00.000Z',
    scheduled_start:     '2026-01-15T09:00:00.000Z',
    scheduled_end:       '2026-01-15T11:00:00.000Z',
    accepted_at:         null,
    started_at:          null,
    completed_at:        null,
    cancelled_at:        null,
    quote_cents:         10_000,
    cleaner_payout_cents: 8_500,
    address:             '12 Test Street, TE1 1ST',
    notes:               null,
    ...overrides,
  }
}

export function makePaidBooking(overrides?: Partial<MockBookingRow>): MockBookingRow {
  return makeBooking({
    status:         'paid',
    payment_status: 'captured',
    accepted_at:    '2026-01-02T10:00:00.000Z',
    ...overrides,
  })
}

export function makeCompletedBooking(overrides?: Partial<MockBookingRow>): MockBookingRow {
  return makeBooking({
    status:         'completed',
    payment_status: 'captured',
    accepted_at:    '2026-01-02T10:00:00.000Z',
    started_at:     '2026-01-15T09:00:00.000Z',
    completed_at:   '2026-01-15T11:00:00.000Z',
    ...overrides,
  })
}

export function makePaymentAuthorizedBooking(overrides?: Partial<MockBookingRow>): MockBookingRow {
  return makeBooking({
    status:         'payment_authorized',
    payment_status: 'authorized',
    ...overrides,
  })
}
