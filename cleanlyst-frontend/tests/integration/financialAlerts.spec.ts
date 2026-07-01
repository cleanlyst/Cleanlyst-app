/**
 * Integration tests for financialAlerts.detectBookingAlerts().
 * Mocks Supabase and ledger resolver.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { detectBookingAlerts, filterAlertsBySeverity, type AlertType } from '@/services/payments/financialAlerts'
import {
  makeAuthorized,
  makeCaptured,
  makeRefunded,
  makePayoutReleased,
  BOOKING_ID,
  resetSeq,
} from '../fixtures/ledgerFactory'

const mockGetLedgerEvents = vi.fn()

vi.mock('@/services/payments/paymentLedgerResolver', () => ({
  getLedgerEvents:       (...args: unknown[]) => mockGetLedgerEvents(...args),
  deriveStateFromEvents: (events: { eventType: string }[]) => {
    if (events.some((e) => e.eventType === 'PAYMENT_REFUNDED')) return 'refunded'
    if (events.some((e) => e.eventType === 'PAYMENT_CAPTURED')) return 'captured'
    if (events.some((e) => e.eventType === 'PAYMENT_AUTHORIZED')) return 'authorized'
    return 'unpaid'
  },
}))

// Supabase mock: returns booking and payment rows based on call order
let supabaseCallIndex = 0
const supabaseMocks: (() => unknown)[] = []

vi.mock('@/services/supabaseClient', () => ({
  getSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => {
            const fn = supabaseMocks[supabaseCallIndex++ % supabaseMocks.length]
            return fn ? fn() : Promise.resolve({ data: null })
          },
        }),
      }),
    }),
  }),
}))

function mockBookingAndPayment(
  bookingData: Record<string, unknown>,
  paymentData: Record<string, unknown> | null,
) {
  supabaseCallIndex = 0
  supabaseMocks.length = 0
  supabaseMocks.push(() => Promise.resolve({ data: bookingData }))
  supabaseMocks.push(() => Promise.resolve({ data: paymentData }))
}

describe('detectBookingAlerts()', () => {
  beforeEach(() => {
    resetSeq()
    vi.clearAllMocks()
    supabaseCallIndex = 0
    supabaseMocks.length = 0
  })

  it('returns empty array for a healthy completed booking with payout', async () => {
    mockGetLedgerEvents.mockResolvedValue([makeAuthorized(), makeCaptured(), makePayoutReleased()])
    mockBookingAndPayment(
      { status: 'completed', completed_at: new Date().toISOString(), payment_status: 'captured' },
      { status: 'captured' },
    )
    const alerts = await detectBookingAlerts(BOOKING_ID)
    expect(alerts).toHaveLength(0)
  })

  it('generates CAPTURE_MISSING alert when auth is over 24h old with no capture', async () => {
    const oldAuth = makeAuthorized({
      createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(), // 30h ago
    })
    mockGetLedgerEvents.mockResolvedValue([oldAuth])
    mockBookingAndPayment(
      { status: 'payment_authorized', completed_at: null, payment_status: 'authorized' },
      { status: 'authorized' },
    )
    const alerts = await detectBookingAlerts(BOOKING_ID)
    expect(alerts.some((a) => a.alertType === 'CAPTURE_MISSING')).toBe(true)
  })

  it('generates PAYOUT_OVERDUE alert when booking completed 4+ days ago without payout', async () => {
    const oldCompletion = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    mockGetLedgerEvents.mockResolvedValue([makeAuthorized(), makeCaptured()])
    mockBookingAndPayment(
      { status: 'completed', completed_at: oldCompletion, payment_status: 'captured' },
      { status: 'captured' },
    )
    const alerts = await detectBookingAlerts(BOOKING_ID)
    expect(alerts.some((a) => a.alertType === 'PAYOUT_OVERDUE')).toBe(true)
  })

  it('generates LEDGER_MISMATCH alert when ledger and cache diverge', async () => {
    resetSeq()
    mockGetLedgerEvents.mockResolvedValue([makeAuthorized(), makeCaptured()])
    mockBookingAndPayment(
      { status: 'paid', completed_at: null, payment_status: 'authorized' }, // stale cache
      { status: 'authorized' },
    )
    const alerts = await detectBookingAlerts(BOOKING_ID)
    expect(alerts.some((a) => a.alertType === 'LEDGER_MISMATCH')).toBe(true)
  })

  it('generates DUPLICATE_STRIPE_EVENT alert for duplicate stripe_event_ids', async () => {
    resetSeq()
    const auth = makeAuthorized({ stripeEventId: 'evt_dup' })
    const dup  = { ...makeCaptured(), stripeEventId: 'evt_dup' }
    mockGetLedgerEvents.mockResolvedValue([auth, dup])
    mockBookingAndPayment(
      { status: 'paid', completed_at: null, payment_status: 'captured' },
      { status: 'captured' },
    )
    const alerts = await detectBookingAlerts(BOOKING_ID)
    expect(alerts.some((a) => a.alertType === 'DUPLICATE_STRIPE_EVENT')).toBe(true)
  })

  it('generates MULTIPLE_PAYOUTS alert for multiple PAYOUT_RELEASED events', async () => {
    resetSeq()
    mockGetLedgerEvents.mockResolvedValue([
      makeAuthorized(), makeCaptured(), makePayoutReleased(), makePayoutReleased(),
    ])
    mockBookingAndPayment(
      { status: 'completed', completed_at: new Date().toISOString(), payment_status: 'captured' },
      { status: 'captured' },
    )
    const alerts = await detectBookingAlerts(BOOKING_ID)
    expect(alerts.some((a) => a.alertType === 'MULTIPLE_PAYOUTS')).toBe(true)
  })
})

describe('filterAlertsBySeverity()', () => {
  const makeAlert = (alertType: string, severity: 'info' | 'warning' | 'critical') => ({
    id: 'a-1', bookingId: BOOKING_ID, alertType: alertType as AlertType,
    severity, title: alertType, description: alertType, detectedAt: '', metadata: {},
  })

  it('returns only warning and critical when minSeverity is warning', () => {
    const alerts = [
      makeAlert('INFO_ALERT', 'info'),
      makeAlert('CAPTURE_MISSING', 'warning'),
      makeAlert('MULTIPLE_PAYOUTS', 'critical'),
    ]
    const filtered = filterAlertsBySeverity(alerts, 'warning')
    expect(filtered).toHaveLength(2)
    expect(filtered.every((a) => a.severity !== 'info')).toBe(true)
  })

  it('returns only critical when minSeverity is critical', () => {
    const alerts = [
      makeAlert('CAPTURE_MISSING', 'warning'),
      makeAlert('MULTIPLE_PAYOUTS', 'critical'),
    ]
    const filtered = filterAlertsBySeverity(alerts, 'critical')
    expect(filtered).toHaveLength(1)
    expect(filtered[0].alertType).toBe('MULTIPLE_PAYOUTS')
  })
})
