import { describe, expect, it, vi, beforeEach } from 'vitest'
import { detectBookingAnomalies } from '@/services/payments/paymentAnomalyDetector'
import {
  makeAuthorized,
  makeCaptured,
  makeRefunded,
  makePayoutReleased,
  BOOKING_ID,
  resetSeq,
} from '../fixtures/ledgerFactory'

const mockGetLedgerEvents   = vi.fn()
const mockFetchBookingCtx   = vi.fn()

vi.mock('@/services/payments/paymentLedgerResolver', () => ({
  getLedgerEvents: (...args: unknown[]) => mockGetLedgerEvents(...args),
}))

vi.mock('@/services/supabaseClient', () => ({
  getSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => mockFetchBookingCtx(),
        }),
      }),
    }),
  }),
}))

const COMPLETED_CTX = { data: { status: 'completed', completed_at: '2026-01-15T11:00:00.000Z', cancelled_at: null } }

describe('detectBookingAnomalies()', () => {
  beforeEach(() => {
    resetSeq()
    vi.clearAllMocks()
    mockFetchBookingCtx.mockResolvedValue(COMPLETED_CTX)
  })

  it('returns empty array for a healthy normal-payment sequence', async () => {
    mockGetLedgerEvents.mockResolvedValue([makeAuthorized(), makeCaptured(), makePayoutReleased()])
    const anomalies = await detectBookingAnomalies(BOOKING_ID)
    // Completed + payout within 72h — no overdue anomaly
    expect(anomalies).toHaveLength(0)
  })

  it('detects MULTIPLE_CAPTURES', async () => {
    resetSeq()
    mockGetLedgerEvents.mockResolvedValue([makeAuthorized(), makeCaptured(), makeCaptured()])
    const anomalies = await detectBookingAnomalies(BOOKING_ID)
    const types = anomalies.map((a) => a.anomalyType)
    expect(types).toContain('MULTIPLE_CAPTURES')
  })

  it('detects MULTIPLE_PAYOUTS', async () => {
    resetSeq()
    mockGetLedgerEvents.mockResolvedValue([
      makeAuthorized(), makeCaptured(), makePayoutReleased(), makePayoutReleased(),
    ])
    const anomalies = await detectBookingAnomalies(BOOKING_ID)
    expect(anomalies.map((a) => a.anomalyType)).toContain('MULTIPLE_PAYOUTS')
  })

  it('detects REFUND_AFTER_PAYOUT when refund timestamp is after payout', async () => {
    resetSeq()
    const auth    = makeAuthorized({ createdAt: '2026-01-15T08:00:00.000Z' })
    const cap     = makeCaptured({ createdAt: '2026-01-15T09:00:00.000Z' })
    const payout  = makePayoutReleased({ createdAt: '2026-01-15T10:00:00.000Z' })
    const refund  = makeRefunded(10_000, { createdAt: '2026-01-15T11:00:00.000Z' })
    mockGetLedgerEvents.mockResolvedValue([auth, cap, payout, refund])
    const anomalies = await detectBookingAnomalies(BOOKING_ID)
    expect(anomalies.map((a) => a.anomalyType)).toContain('REFUND_AFTER_PAYOUT')
  })

  it('detects DUPLICATE_STRIPE_EVENT when same event ID appears twice', async () => {
    resetSeq()
    const auth = makeAuthorized({ stripeEventId: 'evt_dupe' })
    const dup  = { ...makeCaptured(), stripeEventId: 'evt_dupe' }
    mockGetLedgerEvents.mockResolvedValue([auth, dup])
    const anomalies = await detectBookingAnomalies(BOOKING_ID)
    expect(anomalies.map((a) => a.anomalyType)).toContain('DUPLICATE_STRIPE_EVENT')
  })

  it('detects UNEXPECTED_LEDGER_ORDER when capture precedes authorization', async () => {
    resetSeq()
    const cap  = makeCaptured({ createdAt: '2026-01-15T08:00:00.000Z' })
    const auth = makeAuthorized({ createdAt: '2026-01-15T09:00:00.000Z' })
    mockGetLedgerEvents.mockResolvedValue([cap, auth])
    const anomalies = await detectBookingAnomalies(BOOKING_ID)
    expect(anomalies.map((a) => a.anomalyType)).toContain('UNEXPECTED_LEDGER_ORDER')
  })

  it('does NOT flag AUTHORIZATION_EXPIRED for a fresh authorization', async () => {
    // Recent auth — should not expire
    const freshAuth = makeAuthorized({ createdAt: new Date().toISOString() })
    mockGetLedgerEvents.mockResolvedValue([freshAuth])
    const anomalies = await detectBookingAnomalies(BOOKING_ID)
    expect(anomalies.map((a) => a.anomalyType)).not.toContain('AUTHORIZATION_EXPIRED')
  })

  it('assigns correct severity levels', async () => {
    resetSeq()
    mockGetLedgerEvents.mockResolvedValue([
      makeAuthorized(), makeCaptured(), makePayoutReleased(), makePayoutReleased(),
    ])
    const anomalies = await detectBookingAnomalies(BOOKING_ID)
    const multiplePayout = anomalies.find((a) => a.anomalyType === 'MULTIPLE_PAYOUTS')
    expect(multiplePayout?.severity).toBe('critical')
  })
})
