/**
 * financialSimulation — deterministic test scenario generator.
 *
 * Produces synthetic ledger event sequences and expected outputs for
 * regression testing of all financial analysis services.
 *
 * No DB calls. No side effects. Pure TypeScript.
 *
 * Usage:
 *   const { events, expectedState } = buildScenario('normal_payment')
 *   const state = deriveStateFromEvents(events)
 *   assert(state === expectedState)
 */

import type { LedgerEvent, DerivedPaymentState } from './paymentLedgerResolver'
import type { FinancialIntegrityReport } from './financialIntegrityScanner'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScenarioType =
  | 'normal_payment'
  | 'full_refund'
  | 'partial_refund'
  | 'double_webhook'
  | 'late_webhook'
  | 'duplicate_payout_attempt'
  | 'missing_capture'
  | 'cancelled_authorization'

export interface SimulationScenario {
  name:               string
  description:        string
  events:             LedgerEvent[]
  expectedState:      DerivedPaymentState
  expectedViolations: string[]
  expectedAnomalies:  string[]
}

// ─── Factories ────────────────────────────────────────────────────────────────

const BOOKING_ID = '00000000-0000-0000-0000-000000000001'
let seq = 0

function makeEvent(
  overrides: Partial<LedgerEvent> & Pick<LedgerEvent, 'eventType'>,
): LedgerEvent {
  seq++
  return {
    id:                    `sim-event-${String(seq).padStart(4, '0')}`,
    bookingId:             BOOKING_ID,
    amountCents:           null,
    currency:              'gbp',
    stripeEventId:         `evt_sim_${seq}`,
    stripePaymentIntentId: null,
    stripeTransferId:      null,
    metadata:              {},
    createdAt:             new Date(Date.UTC(2026, 0, 1, 12, seq, 0)).toISOString(),
    ...overrides,
  }
}

function authorized(overrides?: Partial<LedgerEvent>): LedgerEvent {
  return makeEvent({ eventType: 'PAYMENT_AUTHORIZED', amountCents: 10000, stripePaymentIntentId: 'pi_sim', stripeEventId: `evt_auth_${seq}`, ...overrides })
}

function captured(overrides?: Partial<LedgerEvent>): LedgerEvent {
  return makeEvent({ eventType: 'PAYMENT_CAPTURED', amountCents: 10000, stripePaymentIntentId: 'pi_sim', stripeEventId: `evt_cap_${seq}`, ...overrides })
}

function refunded(amountCents = 10000, overrides?: Partial<LedgerEvent>): LedgerEvent {
  return makeEvent({ eventType: 'PAYMENT_REFUNDED', amountCents, stripeEventId: `evt_ref_${seq}`, ...overrides })
}

function payoutReleased(overrides?: Partial<LedgerEvent>): LedgerEvent {
  return makeEvent({ eventType: 'PAYOUT_RELEASED', amountCents: 8500, stripeTransferId: 'tr_sim', stripeEventId: `evt_pay_${seq}`, ...overrides })
}

// ─── Scenarios ────────────────────────────────────────────────────────────────

const SCENARIOS: Record<ScenarioType, () => SimulationScenario> = {
  normal_payment: () => {
    seq = 0
    return {
      name:        'Normal Payment',
      description: 'Customer authorizes → capture → job completed → payout',
      events:      [authorized(), captured(), payoutReleased()],
      expectedState:      'captured',
      expectedViolations: [],
      expectedAnomalies:  [],
    }
  },

  full_refund: () => {
    seq = 0
    return {
      name:        'Full Refund',
      description: 'Payment authorized and captured, then fully refunded',
      events:      [authorized(), captured(), refunded(10000)],
      expectedState:      'refunded',
      expectedViolations: [],
      expectedAnomalies:  [],
    }
  },

  partial_refund: () => {
    seq = 0
    return {
      name:        'Partial Refund',
      description: 'Payment captured, then partially refunded (e.g. 50%)',
      events:      [authorized(), captured(), refunded(5000)],
      expectedState:      'refunded',
      expectedViolations: [],
      expectedAnomalies:  [],
    }
  },

  double_webhook: () => {
    seq = 0
    // Same stripe_event_id duplicated — idempotency should have blocked this
    const authEvent = authorized()
    const capEvent  = captured()
    const dupCap    = { ...captured(), stripeEventId: capEvent.stripeEventId, id: `sim-event-dup-${seq}` }
    return {
      name:        'Double Webhook',
      description: 'Stripe sends payment_intent.succeeded twice with the same event ID',
      events:      [authEvent, capEvent, dupCap],
      expectedState:      'captured',
      expectedViolations: ['Duplicate stripe_event_id in ledger'],
      expectedAnomalies:  ['DUPLICATE_STRIPE_EVENT'],
    }
  },

  late_webhook: () => {
    seq = 0
    // Capture arrives after payout — out-of-order delivery
    const authEvent  = authorized()
    const payoutEvent = payoutReleased()
    const capEvent   = captured({
      createdAt: new Date(new Date(payoutEvent.createdAt).getTime() - 60_000).toISOString(),
    })
    return {
      name:        'Late Webhook',
      description: 'Capture event arrives out of order (payout released before capture recorded)',
      events:      [authEvent, payoutEvent, capEvent],
      expectedState:      'captured',
      expectedViolations: ['PAYMENT_CAPTURED timestamp precedes PAYMENT_AUTHORIZED'],
      expectedAnomalies:  [],
    }
  },

  duplicate_payout_attempt: () => {
    seq = 0
    const p1 = payoutReleased()
    const p2 = payoutReleased({ stripeTransferId: 'tr_sim_2', stripeEventId: `evt_pay2_${seq}` })
    return {
      name:        'Duplicate Payout Attempt',
      description: 'transfer.paid fires twice for the same booking — double payment to cleaner',
      events:      [authorized(), captured(), p1, p2],
      expectedState:      'captured',
      expectedViolations: ['Multiple PAYOUT_RELEASED events (2) — expected at most one'],
      expectedAnomalies:  ['MULTIPLE_PAYOUTS'],
    }
  },

  missing_capture: () => {
    seq = 0
    return {
      name:        'Missing Capture',
      description: 'Payment authorized but never captured — Stripe hold may expire',
      events:      [authorized()],
      expectedState:      'authorized',
      expectedViolations: [],
      expectedAnomalies:  [], // AUTHORIZATION_EXPIRED only fires after 7 days
    }
  },

  cancelled_authorization: () => {
    seq = 0
    return {
      name:        'Cancelled Authorization',
      description: 'Customer cancels before job starts — authorization voided via payment_intent.canceled',
      events:      [authorized(), refunded(0)],
      expectedState:      'refunded',
      expectedViolations: [],
      expectedAnomalies:  [],
    }
  },
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Returns a deterministic scenario by type. */
export function buildScenario(type: ScenarioType): SimulationScenario {
  return SCENARIOS[type]()
}

/** Returns all available scenarios. */
export function getAllScenarios(): SimulationScenario[] {
  return (Object.keys(SCENARIOS) as ScenarioType[]).map((t) => buildScenario(t))
}

/**
 * Runs a scenario through the provided analysis function and returns
 * whether the result matches the expected outputs.
 *
 * Usage:
 *   const result = runScenarioAssertion(
 *     'normal_payment',
 *     (events) => deriveStateFromEvents(events),
 *     (actual, scenario) => actual === scenario.expectedState,
 *   )
 */
export function runScenarioAssertion<T>(
  type: ScenarioType,
  analyse: (events: LedgerEvent[]) => T,
  assert: (result: T, scenario: SimulationScenario) => boolean,
): { scenario: SimulationScenario; result: T; passed: boolean } {
  const scenario = buildScenario(type)
  const result   = analyse(scenario.events)
  const passed   = assert(result, scenario)
  return { scenario, result, passed }
}

/**
 * Generates a synthetic FinancialIntegrityReport for testing UI components
 * without requiring DB access.
 */
export function makeMockIntegrityReport(
  overrides: Partial<FinancialIntegrityReport> = {},
): FinancialIntegrityReport {
  return {
    bookingId:  BOOKING_ID,
    passed:     true,
    violations: [],
    warnings:   [],
    checkedAt:  new Date().toISOString(),
    eventCount: 0,
    ...overrides,
  }
}
