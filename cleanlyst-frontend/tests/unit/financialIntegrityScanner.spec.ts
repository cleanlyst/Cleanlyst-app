import { describe, expect, it, vi, beforeEach } from 'vitest'
import { scanBookingIntegrity } from '@/services/payments/financialIntegrityScanner'
import {
  makeAuthorized,
  makeCaptured,
  makeRefunded,
  makePayoutReleased,
  BOOKING_ID,
  resetSeq,
} from '../fixtures/ledgerFactory'

// ─── Mock supabaseClient (booking snapshot) and paymentLedgerResolver ────────

const mockGetLedgerEvents = vi.fn()
const mockFetchBooking    = vi.fn()

vi.mock('@/services/payments/paymentLedgerResolver', () => ({
  getLedgerEvents: (...args: unknown[]) => mockGetLedgerEvents(...args),
}))

vi.mock('@/services/supabaseClient', () => ({
  getSupabaseClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq:          () => ({
          maybeSingle: () => mockFetchBooking(),
        }),
      }),
    }),
  }),
}))

const COMPLETED_BOOKING = {
  data: {
    status:       'completed',
    completed_at: '2026-01-15T11:00:00.000Z',
    payments:     { amount_cents: 10_000 },
  },
}

const ACTIVE_BOOKING = {
  data: {
    status:       'paid',
    completed_at: null,
    payments:     { amount_cents: 10_000 },
  },
}

describe('scanBookingIntegrity()', () => {
  beforeEach(() => {
    resetSeq()
    vi.clearAllMocks()
    mockFetchBooking.mockResolvedValue(COMPLETED_BOOKING)
  })

  it('passes a healthy normal-payment sequence', async () => {
    mockGetLedgerEvents.mockResolvedValue([makeAuthorized(), makeCaptured(), makePayoutReleased()])
    const report = await scanBookingIntegrity(BOOKING_ID)
    expect(report.passed).toBe(true)
    expect(report.violations).toHaveLength(0)
    expect(report.bookingId).toBe(BOOKING_ID)
  })

  it('flags multiple PAYMENT_AUTHORIZED events as violation', async () => {
    mockGetLedgerEvents.mockResolvedValue([makeAuthorized(), makeAuthorized(), makeCaptured()])
    const report = await scanBookingIntegrity(BOOKING_ID)
    expect(report.passed).toBe(false)
    expect(report.violations.some((v) => v.includes('Multiple PAYMENT_AUTHORIZED'))).toBe(true)
  })

  it('flags multiple PAYMENT_CAPTURED events as violation', async () => {
    mockGetLedgerEvents.mockResolvedValue([makeAuthorized(), makeCaptured(), makeCaptured()])
    const report = await scanBookingIntegrity(BOOKING_ID)
    expect(report.passed).toBe(false)
    expect(report.violations.some((v) => v.includes('Multiple PAYMENT_CAPTURED'))).toBe(true)
  })

  it('flags refund exceeding capture as violation', async () => {
    resetSeq()
    mockGetLedgerEvents.mockResolvedValue([makeAuthorized(), makeCaptured(), makeRefunded(15_000)])
    const report = await scanBookingIntegrity(BOOKING_ID)
    expect(report.passed).toBe(false)
    expect(report.violations.some((v) => v.includes('Refund total'))).toBe(true)
  })

  it('flags payout without capture as violation', async () => {
    resetSeq()
    mockGetLedgerEvents.mockResolvedValue([makeAuthorized(), makePayoutReleased()])
    const report = await scanBookingIntegrity(BOOKING_ID)
    expect(report.passed).toBe(false)
    expect(report.violations.some((v) => v.includes('payout without capture'))).toBe(true)
  })

  it('flags multiple PAYOUT_RELEASED events as violation', async () => {
    resetSeq()
    mockGetLedgerEvents.mockResolvedValue([makeAuthorized(), makeCaptured(), makePayoutReleased(), makePayoutReleased()])
    const report = await scanBookingIntegrity(BOOKING_ID)
    expect(report.passed).toBe(false)
    expect(report.violations.some((v) => v.includes('Multiple PAYOUT_RELEASED'))).toBe(true)
  })

  it('flags duplicate stripe_event_ids in ledger', async () => {
    resetSeq()
    const auth = makeAuthorized()
    const dup  = { ...auth, id: 'dup-id' } // same stripeEventId
    mockGetLedgerEvents.mockResolvedValue([auth, dup])
    const report = await scanBookingIntegrity(BOOKING_ID)
    expect(report.passed).toBe(false)
    expect(report.violations.some((v) => v.includes('Duplicate stripe_event_id'))).toBe(true)
  })

  it('passes with zero events (no financial activity yet)', async () => {
    mockGetLedgerEvents.mockResolvedValue([])
    const report = await scanBookingIntegrity(BOOKING_ID)
    // No events → nothing to violate, but also no authorization warning
    expect(report.eventCount).toBe(0)
  })

  it('warns when payout released before booking completion', async () => {
    resetSeq()
    const auth   = makeAuthorized({ createdAt: '2026-01-15T08:00:00.000Z' })
    const cap    = makeCaptured({ createdAt: '2026-01-15T09:00:00.000Z' })
    const payout = makePayoutReleased({ createdAt: '2026-01-15T10:00:00.000Z' })
    mockFetchBooking.mockResolvedValue({
      data: { status: 'in_progress', completed_at: '2026-01-15T11:30:00.000Z', payments: { amount_cents: 10_000 } },
    })
    mockGetLedgerEvents.mockResolvedValue([auth, cap, payout])
    const report = await scanBookingIntegrity(BOOKING_ID)
    expect(report.warnings.some((w) => w.includes('PAYOUT_RELEASED occurred before booking.completed_at'))).toBe(true)
  })
})
