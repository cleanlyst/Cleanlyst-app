/**
 * First-party error reporter — no external SaaS required.
 *
 * Captures:
 *   1. Vue component errors via app.config.errorHandler
 *   2. Unhandled JS errors via window.onerror
 *   3. Unhandled promise rejections via window.addEventListener('unhandledrejection')
 *
 * All errors are:
 *   - Logged to console in development
 *   - Written to the `error_events` Supabase table in production (and dev)
 *   - Visible in the admin monitoring dashboard under "Recent Errors"
 *
 * Context enrichment:
 *   Call setErrorContext({ userId, role, bookingId }) when these values
 *   become known (after auth, when opening a booking, etc.)
 *
 * Future Sentry integration:
 *   Install @sentry/vue, init in main.ts, then remove/adapt this file.
 *   The table-based approach remains useful as a secondary sink.
 */

import type { App } from 'vue'
import { logger } from '@/utils/logger'
import { correlationId } from '@/utils/correlationId'

interface ErrorContext {
  userId?: string
  role?: string
  bookingId?: string
}

let _ctx: ErrorContext = {}

export function setErrorContext(ctx: Partial<ErrorContext>) {
  _ctx = { ..._ctx, ...ctx }
}

export function clearErrorContext() {
  _ctx = {}
}

function report(message: string, error: unknown, extra?: Record<string, unknown>) {
  logger.critical(message, {
    component: 'ErrorReporter',
    error,
    userId: _ctx.userId,
    role: _ctx.role,
    bookingId: _ctx.bookingId,
    extra: { correlation_id: correlationId, ...extra },
  })
}

export function installErrorReporter(app: App) {
  // 1. Vue component errors
  app.config.errorHandler = (err, instance, info) => {
    const componentName =
      instance?.$.type && typeof (instance.$.type as { __name?: string }).__name === 'string'
        ? (instance.$.type as { __name: string }).__name
        : 'unknown'

    report('Vue component error', err, {
      vue_info: info,
      component_name: componentName,
    })
  }

  // 2. Unhandled synchronous JS errors
  const prevOnError = window.onerror
  window.onerror = (message, source, lineno, colno, error) => {
    report(String(message), error ?? new Error(String(message)), {
      source,
      lineno: lineno ?? undefined,
      colno: colno ?? undefined,
    })
    return prevOnError
      ? (prevOnError as typeof window.onerror)?.(message, source, lineno, colno, error) ?? false
      : false
  }

  // 3. Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    report('Unhandled promise rejection', event.reason, {
      promise: String(event.promise),
    })
  })
}
