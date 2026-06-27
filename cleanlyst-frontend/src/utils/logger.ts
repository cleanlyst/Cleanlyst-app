/**
 * Structured logger for Cleanlyst frontend.
 *
 * In development: pretty-prints to console.
 * In production: debug/info are suppressed; warn/error/critical are written
 * to the `error_events` Supabase table so they appear in the admin
 * monitoring dashboard without requiring an external SaaS tool.
 *
 * Context fields are never populated with raw secrets or payment card data.
 * Use `bookingId`, `userId`, `role`, `correlationId` for traceability.
 *
 * To add Sentry in future:
 *   npm install @sentry/vue
 *   import * as Sentry from '@sentry/vue'
 *   Sentry.captureException(ctx.error, { extra: logRecord })
 */

import { correlationId } from './correlationId'
import { getSupabaseClientSafe } from '@/services/supabaseClient'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical'

export interface LogContext {
  component?: string
  bookingId?: string
  userId?: string
  cleanerId?: string
  customerId?: string
  paymentIntentId?: string
  role?: string
  extra?: Record<string, unknown>
  error?: unknown
}

interface LogRecord {
  timestamp: string
  level: LogLevel
  component: string
  message: string
  correlation_id: string
  booking_id: string | null
  user_id: string | null
  role: string | null
  extra: Record<string, unknown> | null
  error_message: string | null
  error_stack: string | null
}

const IS_DEV = import.meta.env.DEV

function buildRecord(level: LogLevel, message: string, ctx: LogContext = {}): LogRecord {
  const err = ctx.error
  return {
    timestamp: new Date().toISOString(),
    level,
    component: ctx.component ?? 'unknown',
    message,
    correlation_id: correlationId,
    booking_id: ctx.bookingId ?? null,
    user_id: ctx.userId ?? ctx.customerId ?? ctx.cleanerId ?? null,
    role: ctx.role ?? null,
    extra: ctx.extra ?? null,
    error_message: err instanceof Error ? err.message : err != null ? String(err) : null,
    error_stack: err instanceof Error ? (err.stack ?? null) : null,
  }
}

const CONSOLE_METHODS: Record<LogLevel, keyof Console> = {
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error',
  critical: 'error',
}

function consoleLog(record: LogRecord) {
  const fn = console[CONSOLE_METHODS[record.level]] as (...args: unknown[]) => void
  const prefix = `[${record.timestamp}] [${record.level.toUpperCase()}] [${record.component}]`
  if (record.error_message) {
    fn(prefix, record.message, { ...record, error_message: record.error_message })
  } else {
    fn(prefix, record.message, record.extra ?? '')
  }
}

async function persistRecord(record: LogRecord): Promise<void> {
  try {
    const supabase = getSupabaseClientSafe()
    if (!supabase) return
    await supabase.from('error_events').insert({
      level: record.level,
      component: record.component,
      message: record.message,
      correlation_id: record.correlation_id,
      booking_id: record.booking_id,
      user_id: record.user_id,
      role: record.role,
      extra: record.extra,
      error_message: record.error_message,
      error_stack: record.error_stack ? record.error_stack.slice(0, 4000) : null,
    })
  } catch {
    // Never throw from logger
  }
}

function log(level: LogLevel, message: string, ctx: LogContext = {}) {
  const record = buildRecord(level, message, ctx)

  if (IS_DEV) {
    consoleLog(record)
    return
  }

  // Production: only persist warn and above
  if (level === 'warn' || level === 'error' || level === 'critical') {
    void persistRecord(record)
  }
}

export const logger = {
  debug: (message: string, ctx?: LogContext) => log('debug', message, ctx),
  info: (message: string, ctx?: LogContext) => log('info', message, ctx),
  warn: (message: string, ctx?: LogContext) => log('warn', message, ctx),
  error: (message: string, ctx?: LogContext) => log('error', message, ctx),
  critical: (message: string, ctx?: LogContext) => log('critical', message, ctx),
}
