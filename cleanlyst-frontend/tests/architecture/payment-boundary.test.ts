/**
 * Payment Boundary Architectural Tests
 *
 * PURPOSE
 * ───────
 * These tests enforce the payment system's dependency rules at the source-code
 * level. They read actual .ts/.vue files and assert that forbidden import
 * patterns do not exist, catching violations before they reach review.
 *
 * This is the PRIMARY enforcement mechanism for the PAYMENT_BOUNDARY_CONTRACT.
 * Runtime guards in paymentGuards.ts are a secondary line of defence.
 *
 * RULES ENFORCED
 * ──────────────
 * R1. Payment RPCs (record_initial_payment, record_additional_payment) must
 *     ONLY appear in src/services/payments/paymentOrchestrator.ts
 *
 * R2. UI layers (pages/, components/, stores/) must NOT import @stripe/stripe-js
 *     directly — they must use the useStripe composable or paymentOrchestrator
 *
 * R3. bookingService.ts must NOT import @stripe/stripe-js
 *
 * R4. paymentOrchestrator.ts must NOT import from bookingService (circular dep)
 *
 * R5. UI layers must NOT import src/services/stripe/ modules directly —
 *     the stripe service layer is internal to the payments domain
 *
 * R6. No process_booking_payment RPC call outside bookingService.ts
 *     (deprecated there, must not spread to new files)
 *
 * ADDING A NEW RULE
 * ─────────────────
 * 1. Add the pattern to PAYMENT_BOUNDARY_CONTRACT in paymentGuards.ts if it is
 *    a domain-level rule
 * 2. Add a new `it()` block below
 * 3. Keep violation messages descriptive — they replace code review comments
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// ─────────────────────────────────────────────────────────────────
// FILE WALKER
// ─────────────────────────────────────────────────────────────────

const SRC_DIR = resolve(fileURLToPath(import.meta.url), '..', '..', '..', 'src')

function walk(dir: string, extensions: string[] = ['.ts', '.vue']): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walk(full, extensions))
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(full)
    }
  }
  return results
}

function readSrc(relPath: string): string {
  return readFileSync(join(SRC_DIR, relPath), 'utf8')
}

/** Returns all source files under src/<dir>/ */
function filesIn(subdir: string): string[] {
  const abs = join(SRC_DIR, subdir)
  try {
    statSync(abs)
  } catch {
    return []
  }
  return walk(abs)
}

function relativeToSrc(absPath: string): string {
  return relative(SRC_DIR, absPath)
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

/**
 * Scans a set of files for a forbidden pattern and returns violation messages.
 * Reports all violations in one pass so a failing test shows everything at once.
 */
function collectViolations(
  files: string[],
  pattern: RegExp,
  ruleName: string,
): string[] {
  const violations: string[] = []
  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    if (pattern.test(content)) {
      violations.push(`${ruleName}: ${relativeToSrc(file)}`)
    }
  }
  return violations
}

// ─────────────────────────────────────────────────────────────────
// FILE SETS
// ─────────────────────────────────────────────────────────────────

const UI_FILES = [
  ...filesIn('pages'),
  ...filesIn('components'),
  ...filesIn('stores'),
]

const ALL_SRC_FILES = walk(SRC_DIR)

// ─────────────────────────────────────────────────────────────────
// R1 — Payment RPCs confined to paymentOrchestrator.ts
// ─────────────────────────────────────────────────────────────────

describe('R1: Payment RPCs are isolated to paymentOrchestrator', () => {
  const ORCHESTRATOR_PATH = join(SRC_DIR, 'services', 'payments', 'paymentOrchestrator.ts')

  const forbiddenRpcPattern = /record_initial_payment|record_additional_payment/

  it('record_initial_payment / record_additional_payment appear only in paymentOrchestrator.ts', () => {
    const violations = ALL_SRC_FILES
      .filter((f) => f !== ORCHESTRATOR_PATH)
      .filter((f) => {
        const content = readFileSync(f, 'utf8')
        // Allow comment references (e.g. @deprecated docs) but not actual .rpc() calls
        return /\.rpc\(\s*['"]record_(?:initial|additional)_payment['"]/.test(content)
      })
      .map((f) => relativeToSrc(f))

    expect(violations, [
      'The following files call record_initial_payment or record_additional_payment directly.',
      'These RPCs must ONLY be called from src/services/payments/paymentOrchestrator.ts.',
      'Route payment operations through the orchestrator instead.',
      ...violations,
    ].join('\n')).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────
// R2 — Stripe SDK not imported directly by UI
// ─────────────────────────────────────────────────────────────────

describe('R2: UI layers do not import @stripe/stripe-js directly', () => {
  it('No page, component, or store imports @stripe/stripe-js', () => {
    const violations = collectViolations(
      UI_FILES,
      /from\s+['"]@stripe\/stripe-js['"]/,
      'Direct @stripe/stripe-js import in UI layer',
    )

    expect(violations, [
      'The following files import @stripe/stripe-js directly.',
      'Use the useStripe composable (src/composables/useStripe.ts) instead.',
      'If you need raw Stripe, add the operation to src/services/stripe/ and expose it',
      'through the composable or paymentOrchestrator.',
      ...violations,
    ].join('\n')).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────
// R3 — bookingService.ts does not touch Stripe SDK
// ─────────────────────────────────────────────────────────────────

describe('R3: bookingService.ts does not import Stripe SDK', () => {
  it('bookingService does not import @stripe/stripe-js', () => {
    const content = readSrc('services/bookingService.ts')
    expect(
      /from\s+['"]@stripe\/stripe-js['"]/.test(content),
      'bookingService.ts must not import @stripe/stripe-js.\n' +
        'bookingService is a domain coordinator — Stripe is isolated behind the stripe service layer.\n' +
        'Use paymentOrchestrator for payment initiation.',
    ).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────
// R4 — paymentOrchestrator does not import bookingService (circular dep)
// ─────────────────────────────────────────────────────────────────

describe('R4: paymentOrchestrator does not import bookingService', () => {
  it('No circular dependency: orchestrator → bookingService is forbidden', () => {
    const content = readSrc('services/payments/paymentOrchestrator.ts')
    expect(
      /from\s+['"].*bookingService['"]/.test(content),
      'paymentOrchestrator.ts must not import from bookingService.ts.\n' +
        'The permitted direction is: bookingService → paymentOrchestrator.\n' +
        'If the orchestrator needs booking data, the caller (bookingService) must pass it as a parameter.',
    ).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────
// R5 — UI layers do not bypass orchestrator to call stripe services directly
// ─────────────────────────────────────────────────────────────────

describe('R5: UI layers do not import src/services/stripe directly', () => {
  const STRIPE_SERVICE_IMPORT = /from\s+['"]@\/services\/stripe['"]/
  const ALLOWED_FILES = [
    'services/payments/paymentOrchestrator.ts',
  ]

  it('pages/, components/, stores/ do not import @/services/stripe', () => {
    const violations = UI_FILES
      .filter((f) => {
        const rel = relativeToSrc(f)
        if (ALLOWED_FILES.some((a) => rel.includes(a))) return false
        const content = readFileSync(f, 'utf8')
        return STRIPE_SERVICE_IMPORT.test(content)
      })
      .map(relativeToSrc)

    expect(violations, [
      'The following UI files import from @/services/stripe directly.',
      'Stripe services are internal to the payments domain.',
      'Use paymentOrchestrator or useStripe composable instead.',
      ...violations,
    ].join('\n')).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────
// R6 — process_booking_payment RPC not spreading to new files
// ─────────────────────────────────────────────────────────────────

describe('R6: process_booking_payment RPC confined to bookingService.ts', () => {
  const BOOKING_SERVICE_PATH = join(SRC_DIR, 'services', 'bookingService.ts')

  it('No new file calls process_booking_payment RPC', () => {
    const violations = ALL_SRC_FILES
      .filter((f) => f !== BOOKING_SERVICE_PATH)
      .filter((f) => {
        const content = readFileSync(f, 'utf8')
        return /\.rpc\(\s*['"]process_booking_payment['"]/.test(content)
      })
      .map(relativeToSrc)

    expect(violations, [
      'The following files call process_booking_payment RPC directly.',
      'This is a payment RPC deprecated in bookingService.ts.',
      'Route through paymentOrchestrator.startInitialPayment() instead.',
      ...violations,
    ].join('\n')).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────
// R7 — Supabase payment tables not written directly from UI
// ─────────────────────────────────────────────────────────────────

describe('R7: UI does not write to payments or booking_financials tables directly', () => {
  const WRITE_PATTERN =
    /\.from\(\s*['"](?:payments|booking_financials)['"]\s*\)\s*\.\s*(?:insert|update|upsert|delete)/

  it('No page or component writes to payments or booking_financials', () => {
    const violations = collectViolations(
      [...filesIn('pages'), ...filesIn('components')],
      WRITE_PATTERN,
      'Direct write to payments/booking_financials from UI',
    )

    expect(violations, [
      'The following UI files write directly to the payments or booking_financials tables.',
      'Financial mutations must go through the webhook (for Stripe flows) or the orchestrator',
      '(which calls the appropriate RPC/Edge Function). UI components are read-only for',
      'financial tables.',
      ...violations,
    ].join('\n')).toEqual([])
  })
})
