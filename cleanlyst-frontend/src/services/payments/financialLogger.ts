/**
 * financialLogger — structured logging for all financial events.
 *
 * Replaces scattered console.log calls across payment services.
 * All log calls produce a consistent JSON-serialisable structure so they
 * can be piped to Sentry, Datadog, Logtail, or any structured log sink.
 *
 * Usage:
 *   financialLog('PAYMENT_CAPTURED', { bookingId, amountCents })
 *   financialLog('LEDGER_MISMATCH', { bookingId, detail: '...' }, 'warn')
 */

export type FinancialLogEvent =
  | 'PAYMENT_AUTHORIZED'
  | 'PAYMENT_CAPTURED'
  | 'REFUND_COMPLETED'
  | 'PAYOUT_RELEASED'
  | 'LEDGER_MISMATCH'
  | 'RECONCILIATION_FAILURE'
  | 'ANOMALY_DETECTED'
  | 'IDEMPOTENCY_VIOLATION'
  | 'INTEGRITY_VIOLATION'
  | 'WEBHOOK_DUPLICATE'
  | 'BOOKING_STATE_DRIFT'

export type LogLevel = 'info' | 'warn' | 'error'

export interface FinancialLogEntry {
  event:     FinancialLogEvent
  level:     LogLevel
  timestamp: string
  payload:   Record<string, unknown>
}

/**
 * Emits a structured financial log entry.
 * In production, swap the console calls for your log-shipping transport.
 *
 * Reads console at call time (not at import time) so test spies work correctly.
 */
export function financialLog(
  event: FinancialLogEvent,
  payload: Record<string, unknown>,
  level: LogLevel = 'info',
): void {
  const entry: FinancialLogEntry = {
    event,
    level,
    timestamp: new Date().toISOString(),
    payload,
  }
  console[level](`[financial:${event}]`, entry)
}

/** Pre-bound helpers so call sites stay clean. */
export const log = {
  paymentAuthorized: (bookingId: string, extra?: Record<string, unknown>) =>
    financialLog('PAYMENT_AUTHORIZED', { bookingId, ...extra }),

  paymentCaptured: (bookingId: string, amountCents: number, extra?: Record<string, unknown>) =>
    financialLog('PAYMENT_CAPTURED', { bookingId, amountCents, ...extra }),

  refundCompleted: (bookingId: string, amountCents: number, extra?: Record<string, unknown>) =>
    financialLog('REFUND_COMPLETED', { bookingId, amountCents, ...extra }),

  payoutReleased: (bookingId: string, amountCents: number, extra?: Record<string, unknown>) =>
    financialLog('PAYOUT_RELEASED', { bookingId, amountCents, ...extra }),

  ledgerMismatch: (bookingId: string, detail: string, extra?: Record<string, unknown>) =>
    financialLog('LEDGER_MISMATCH', { bookingId, detail, ...extra }, 'warn'),

  reconciliationFailure: (detail: string, extra?: Record<string, unknown>) =>
    financialLog('RECONCILIATION_FAILURE', { detail, ...extra }, 'error'),

  anomalyDetected: (bookingId: string, anomalyType: string, extra?: Record<string, unknown>) =>
    financialLog('ANOMALY_DETECTED', { bookingId, anomalyType, ...extra }, 'warn'),

  idempotencyViolation: (stripeEventId: string, extra?: Record<string, unknown>) =>
    financialLog('IDEMPOTENCY_VIOLATION', { stripeEventId, ...extra }, 'error'),

  integrityViolation: (bookingId: string, violations: string[], extra?: Record<string, unknown>) =>
    financialLog('INTEGRITY_VIOLATION', { bookingId, violations, ...extra }, 'error'),

  webhookDuplicate: (stripeEventId: string, extra?: Record<string, unknown>) =>
    financialLog('WEBHOOK_DUPLICATE', { stripeEventId, ...extra }, 'warn'),

  bookingStateDrift: (bookingId: string, detail: string, extra?: Record<string, unknown>) =>
    financialLog('BOOKING_STATE_DRIFT', { bookingId, detail, ...extra }, 'warn'),
}
