/**
 * Integration tests for ledgerReconciliationService.
 * Mocks Supabase so no real DB connection is needed.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { reconcileBooking } from '@/services/payments/ledgerReconciliationService'
import {
  makeAuthorized,
  makeCaptured,
  makeRefunded,
  BOOKING_ID,
  resetSeq,
} from '../fixtures/ledgerFactory'

const mockGetLedgerEvents = vi.fn()
const mockBookingQuery    = vi.fn()

vi.mock('@/services/payments/paymentLedgerResolver', () => ({
  getLedgerEvents:        (...args: unknown[]) => mockGetLedgerEvents(...args),
  deriveStateFromEvents:  (events: unknown[]) => {
    // Inline derivation — mirrors the real implementation
    const evts = events as { eventType: string }[]
    if (evts.some((e) => e.eventType === 'PAYMENT_REFUNDED')) return 'refunded'
    if (evts.some((e) => e.eventType === 'PAYMENT_CAPTURED')) return 'captured'
    if (evts.some((e) => e.eventType === 'PAYMENT_AUTHORIZED')) return 'authorized'
    return 'unpaid'
  },
}))

vi.mock('@/services/supabaseClient', () => ({
  getSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => mockBookingQuery(),
        }),
      }),
    }),
  }),
}))

describe('reconcileBooking()', () => {
  beforeEach(() => {
    resetSeq()
    vi.clearAllMocks()
  })

  it('returns no mismatches when ledger and cache are aligned', async () => {
    mockGetLedgerEvents.mockResolvedValue([makeAuthorized(), makeCaptured()])
    mockBookingQuery.mockResolvedValue({
      data: { id: BOOKING_ID, payment_status: 'captured', status: 'paid', updated_at: '2026-01-01' },
    })

    const report = await reconcileBooking(BOOKING_ID)
    expect(report.hasMismatch).toBe(false)
    expect(report.mismatches).toHaveLength(0)
    expect(report.ledgerState).toBe('captured')
    expect(report.cachedPaymentStatus).toBe('captured')
  })

  it('flags mismatch when ledger says captured but cache says authorized', async () => {
    mockGetLedgerEvents.mockResolvedValue([makeAuthorized(), makeCaptured()])
    mockBookingQuery.mockResolvedValue({
      data: { id: BOOKING_ID, payment_status: 'authorized', status: 'payment_authorized', updated_at: '2026-01-01' },
    })

    const report = await reconcileBooking(BOOKING_ID)
    expect(report.hasMismatch).toBe(true)
    expect(report.mismatches.some((m) => m.includes('payment_status mismatch'))).toBe(true)
  })

  it('flags booking.status still payment_authorized when ledger has CAPTURED', async () => {
    mockGetLedgerEvents.mockResolvedValue([makeAuthorized(), makeCaptured()])
    mockBookingQuery.mockResolvedValue({
      data: { id: BOOKING_ID, payment_status: 'captured', status: 'payment_authorized', updated_at: '2026-01-01' },
    })

    const report = await reconcileBooking(BOOKING_ID)
    expect(report.hasMismatch).toBe(true)
    expect(report.mismatches.some((m) => m.includes('trigger may have failed'))).toBe(true)
  })

  it('flags mismatch when ledger has REFUNDED but cache shows captured', async () => {
    mockGetLedgerEvents.mockResolvedValue([makeAuthorized(), makeCaptured(), makeRefunded()])
    mockBookingQuery.mockResolvedValue({
      data: { id: BOOKING_ID, payment_status: 'captured', status: 'completed', updated_at: '2026-01-01' },
    })

    const report = await reconcileBooking(BOOKING_ID)
    expect(report.hasMismatch).toBe(true)
    expect(report.mismatches.some((m) => m.includes('PAYMENT_REFUNDED'))).toBe(true)
  })

  it('returns correct ledgerEventCount', async () => {
    const events = [makeAuthorized(), makeCaptured()]
    mockGetLedgerEvents.mockResolvedValue(events)
    mockBookingQuery.mockResolvedValue({ data: { payment_status: 'captured', status: 'paid' } })
    const report = await reconcileBooking(BOOKING_ID)
    expect(report.ledgerEventCount).toBe(2)
  })

  it('handles null booking gracefully', async () => {
    mockGetLedgerEvents.mockResolvedValue([])
    mockBookingQuery.mockResolvedValue({ data: null })
    const report = await reconcileBooking(BOOKING_ID)
    expect(report.cachedPaymentStatus).toBeNull()
  })
})
