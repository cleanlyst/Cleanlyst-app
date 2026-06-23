import { describe, expect, it } from 'vitest'
import {
  buildScenario,
  getAllScenarios,
  runScenarioAssertion,
  makeMockIntegrityReport,
} from '@/services/payments/financialSimulation'
import { deriveStateFromEvents } from '@/services/payments/paymentLedgerResolver'

describe('buildScenario()', () => {
  it('normal_payment produces captured state with no violations', () => {
    const s = buildScenario('normal_payment')
    expect(s.expectedState).toBe('captured')
    expect(s.expectedViolations).toHaveLength(0)
    expect(s.events.length).toBeGreaterThan(0)
  })

  it('full_refund produces refunded state', () => {
    const s = buildScenario('full_refund')
    expect(s.expectedState).toBe('refunded')
    expect(deriveStateFromEvents(s.events)).toBe('refunded')
  })

  it('partial_refund produces refunded state', () => {
    const s = buildScenario('partial_refund')
    expect(s.expectedState).toBe('refunded')
    const refundEvent = s.events.find((e) => e.eventType === 'PAYMENT_REFUNDED')
    expect(refundEvent?.amountCents).toBe(5_000)
  })

  it('double_webhook flags expected violations', () => {
    const s = buildScenario('double_webhook')
    expect(s.expectedViolations.length).toBeGreaterThan(0)
    expect(s.expectedAnomalies).toContain('DUPLICATE_STRIPE_EVENT')
  })

  it('missing_capture produces authorized state', () => {
    const s = buildScenario('missing_capture')
    expect(s.expectedState).toBe('authorized')
    expect(deriveStateFromEvents(s.events)).toBe('authorized')
  })

  it('cancelled_authorization produces refunded state', () => {
    const s = buildScenario('cancelled_authorization')
    expect(s.expectedState).toBe('refunded')
  })

  it('duplicate_payout_attempt flags MULTIPLE_PAYOUTS anomaly', () => {
    const s = buildScenario('duplicate_payout_attempt')
    expect(s.expectedAnomalies).toContain('MULTIPLE_PAYOUTS')
    const payoutEvents = s.events.filter((e) => e.eventType === 'PAYOUT_RELEASED')
    expect(payoutEvents).toHaveLength(2)
  })
})

describe('getAllScenarios()', () => {
  it('returns all 8 scenario types', () => {
    const scenarios = getAllScenarios()
    expect(scenarios).toHaveLength(8)
  })

  it('all scenarios have non-empty events', () => {
    for (const s of getAllScenarios()) {
      expect(s.events.length).toBeGreaterThan(0)
    }
  })

  it('all scenarios have a name and description', () => {
    for (const s of getAllScenarios()) {
      expect(s.name).toBeTruthy()
      expect(s.description).toBeTruthy()
    }
  })
})

describe('runScenarioAssertion()', () => {
  it('validates normal payment scenario against deriveStateFromEvents', () => {
    const result = runScenarioAssertion(
      'normal_payment',
      deriveStateFromEvents,
      (actual, scenario) => actual === scenario.expectedState,
    )
    expect(result.passed).toBe(true)
    expect(result.result).toBe('captured')
  })

  it('validates full_refund scenario', () => {
    const result = runScenarioAssertion(
      'full_refund',
      deriveStateFromEvents,
      (actual, scenario) => actual === scenario.expectedState,
    )
    expect(result.passed).toBe(true)
  })
})

describe('makeMockIntegrityReport()', () => {
  it('returns a passing report by default', () => {
    const r = makeMockIntegrityReport()
    expect(r.passed).toBe(true)
    expect(r.violations).toHaveLength(0)
    expect(r.warnings).toHaveLength(0)
  })

  it('respects overrides', () => {
    const r = makeMockIntegrityReport({ passed: false, violations: ['test violation'] })
    expect(r.passed).toBe(false)
    expect(r.violations).toContain('test violation')
  })
})
