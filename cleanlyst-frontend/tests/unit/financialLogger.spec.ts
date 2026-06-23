import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { financialLog, log, type FinancialLogEntry } from '@/services/payments/financialLogger'

describe('financialLog()', () => {
  let spyInfo:  ReturnType<typeof vi.spyOn>
  let spyWarn:  ReturnType<typeof vi.spyOn>
  let spyError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    spyInfo  = vi.spyOn(console, 'info').mockImplementation(() => {})
    spyWarn  = vi.spyOn(console, 'warn').mockImplementation(() => {})
    spyError = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function lastEntry(spy: ReturnType<typeof vi.spyOn>): FinancialLogEntry {
    const calls = spy.mock.calls
    return calls[calls.length - 1]?.[1] as FinancialLogEntry
  }

  it('emits a structured entry with correct shape', () => {
    financialLog('PAYMENT_CAPTURED', { bookingId: 'b-1', amountCents: 10_000 })
    expect(spyInfo).toHaveBeenCalledTimes(1)
    const entry = lastEntry(spyInfo)
    expect(entry.event).toBe('PAYMENT_CAPTURED')
    expect(entry.level).toBe('info')
    expect(entry.payload).toMatchObject({ bookingId: 'b-1', amountCents: 10_000 })
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('uses warn level for warnings', () => {
    financialLog('LEDGER_MISMATCH', { bookingId: 'b-1', detail: 'drift' }, 'warn')
    expect(spyWarn).toHaveBeenCalledTimes(1)
    expect(lastEntry(spyWarn).level).toBe('warn')
  })

  it('uses error level for errors', () => {
    financialLog('RECONCILIATION_FAILURE', { detail: 'critical' }, 'error')
    expect(spyError).toHaveBeenCalledTimes(1)
    expect(lastEntry(spyError).level).toBe('error')
  })

  it('label prefix follows [financial:EVENT] format', () => {
    financialLog('PAYMENT_AUTHORIZED', {})
    const label = spyInfo.mock.calls[0]?.[0] as string
    expect(label).toBe('[financial:PAYMENT_AUTHORIZED]')
  })

  describe('pre-bound helpers', () => {
    it('log.paymentCaptured() emits PAYMENT_CAPTURED at info level', () => {
      log.paymentCaptured('b-1', 10_000)
      const entry = lastEntry(spyInfo)
      expect(entry.event).toBe('PAYMENT_CAPTURED')
      expect(entry.payload).toMatchObject({ bookingId: 'b-1', amountCents: 10_000 })
    })

    it('log.ledgerMismatch() emits LEDGER_MISMATCH at warn level', () => {
      log.ledgerMismatch('b-1', 'cache drift')
      const entry = lastEntry(spyWarn)
      expect(entry.event).toBe('LEDGER_MISMATCH')
      expect(entry.level).toBe('warn')
    })

    it('log.anomalyDetected() emits ANOMALY_DETECTED at warn level', () => {
      log.anomalyDetected('b-1', 'MULTIPLE_PAYOUTS')
      const entry = lastEntry(spyWarn)
      expect(entry.event).toBe('ANOMALY_DETECTED')
      expect(entry.level).toBe('warn')
    })

    it('log.integrityViolation() emits INTEGRITY_VIOLATION at error level', () => {
      log.integrityViolation('b-1', ['violation 1'])
      const entry = lastEntry(spyError)
      expect(entry.event).toBe('INTEGRITY_VIOLATION')
      expect(entry.level).toBe('error')
    })

    it('log.paymentAuthorized() emits PAYMENT_AUTHORIZED', () => {
      log.paymentAuthorized('b-1')
      expect(lastEntry(spyInfo).event).toBe('PAYMENT_AUTHORIZED')
    })

    it('log.refundCompleted() emits REFUND_COMPLETED', () => {
      log.refundCompleted('b-1', 5_000)
      expect(lastEntry(spyInfo).event).toBe('REFUND_COMPLETED')
    })

    it('log.webhookDuplicate() emits WEBHOOK_DUPLICATE at warn level', () => {
      log.webhookDuplicate('evt_test_001')
      expect(lastEntry(spyWarn).event).toBe('WEBHOOK_DUPLICATE')
    })
  })
})
