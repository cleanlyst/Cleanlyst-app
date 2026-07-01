/**
 * Integration tests for idempotencyValidator.
 * All Supabase calls are mocked.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  validateBookingIdempotency,
  validateWebhookIdempotency,
  validateGlobalWebhookIdempotency,
} from '@/services/payments/idempotencyValidator'
import {
  makeAuthorized,
  makeCaptured,
  makeRefunded,
  makePayoutReleased,
  BOOKING_ID,
  resetSeq,
} from '../fixtures/ledgerFactory'

const mockGetLedgerEvents   = vi.fn()
const mockPayoutQuery        = vi.fn()
const mockWebhookQuery       = vi.fn()
const mockLedgerQuery        = vi.fn()

vi.mock('@/services/payments/paymentLedgerResolver', () => ({
  getLedgerEvents: (...args: unknown[]) => mockGetLedgerEvents(...args),
}))

vi.mock('@/services/supabaseClient', () => ({
  getSupabaseClient: () => ({
    from: (table: string) => {
      if (table === 'payouts') return { select: () => ({ eq: () => ({ data: mockPayoutQuery(), error: null }) }) }
      if (table === 'payment_webhook_events') return {
        select: () => ({
          eq:    () => ({ data: mockWebhookQuery() }),
          order: () => ({ limit: () => ({ data: mockWebhookQuery() }) }),
        }),
      }
      if (table === 'payment_ledger_events') return {
        select: () => ({
          eq:    () => ({ data: mockLedgerQuery() }),
          order: () => ({ limit: () => ({ data: mockLedgerQuery() }) }),
        }),
      }
      return { select: () => ({ eq: () => ({ data: [] }) }) }
    },
  }),
}))

describe('validateBookingIdempotency()', () => {
  beforeEach(() => {
    resetSeq()
    vi.clearAllMocks()
    mockPayoutQuery.mockReturnValue([])
  })

  it('returns valid for a clean happy-path sequence', async () => {
    mockGetLedgerEvents.mockResolvedValue([makeAuthorized(), makeCaptured(), makePayoutReleased()])
    const report = await validateBookingIdempotency(BOOKING_ID)
    expect(report.valid).toBe(true)
    expect(report.violations).toHaveLength(0)
  })

  it('detects DUPLICATE_CAPTURE when two PAYMENT_CAPTURED events exist', async () => {
    resetSeq()
    mockGetLedgerEvents.mockResolvedValue([makeAuthorized(), makeCaptured(), makeCaptured()])
    const report = await validateBookingIdempotency(BOOKING_ID)
    expect(report.valid).toBe(false)
    expect(report.violations.some((v) => v.type === 'DUPLICATE_CAPTURE')).toBe(true)
  })

  it('detects DUPLICATE_REFUND when two PAYMENT_REFUNDED events exist', async () => {
    resetSeq()
    mockGetLedgerEvents.mockResolvedValue([makeAuthorized(), makeCaptured(), makeRefunded(), makeRefunded()])
    const report = await validateBookingIdempotency(BOOKING_ID)
    expect(report.valid).toBe(false)
    expect(report.violations.some((v) => v.type === 'DUPLICATE_REFUND')).toBe(true)
  })

  it('detects DUPLICATE_PAYOUT when two PAYOUT_RELEASED events exist', async () => {
    resetSeq()
    mockGetLedgerEvents.mockResolvedValue([makeAuthorized(), makeCaptured(), makePayoutReleased(), makePayoutReleased()])
    const report = await validateBookingIdempotency(BOOKING_ID)
    expect(report.valid).toBe(false)
    expect(report.violations.some((v) => v.type === 'DUPLICATE_PAYOUT')).toBe(true)
  })

  it('detects DUPLICATE_LEDGER_EVENT when same stripe_event_id appears twice', async () => {
    resetSeq()
    const auth = makeAuthorized({ stripeEventId: 'evt_dupe' })
    const dup  = { ...makeCaptured(), stripeEventId: 'evt_dupe' }
    mockGetLedgerEvents.mockResolvedValue([auth, dup])
    const report = await validateBookingIdempotency(BOOKING_ID)
    expect(report.valid).toBe(false)
    expect(report.violations.some((v) => v.type === 'DUPLICATE_LEDGER_EVENT')).toBe(true)
  })
})

describe('validateWebhookIdempotency()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLedgerQuery.mockReturnValue([{ id: 'led-1', event_type: 'PAYMENT_AUTHORIZED' }])
  })

  it('returns valid when webhook event appears exactly once', async () => {
    mockWebhookQuery.mockReturnValue([{ id: 'wh-1', stripe_event_id: 'evt_test_001', processed_at: new Date().toISOString() }])
    const report = await validateWebhookIdempotency('evt_test_001')
    expect(report.valid).toBe(true)
  })

  it('detects DUPLICATE_WEBHOOK when event appears more than once', async () => {
    mockWebhookQuery.mockReturnValue([
      { id: 'wh-1', stripe_event_id: 'evt_dupe', processed_at: new Date().toISOString() },
      { id: 'wh-2', stripe_event_id: 'evt_dupe', processed_at: new Date().toISOString() },
    ])
    const report = await validateWebhookIdempotency('evt_dupe')
    expect(report.valid).toBe(false)
    expect(report.violations.some((v) => v.type === 'DUPLICATE_WEBHOOK')).toBe(true)
  })
})
