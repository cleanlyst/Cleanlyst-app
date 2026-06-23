/**
 * Payment Domain Guards
 *
 * Runtime enforcement for payment system boundaries. Three layers:
 *
 *   1. assertSimulationNotInProduction — hard throw if simulation path reached in prod
 *   2. warnIfCalledOutsideServiceLayer — DEV-only stack hint when orchestrator bypassed
 *   3. PAYMENT_BOUNDARY_CONTRACT — source-of-truth for architectural test rules
 *
 * IMPORTANT: Layer 2 relies on Vite's unminified dev-mode source maps. It is
 * ineffective in production builds and intentionally so — the architectural test
 * (tests/architecture/payment-boundary.test.ts) is the compile-time enforcement.
 */

// ─────────────────────────────────────────────────────────────────
// LAYER 1 — PRODUCTION SAFETY GUARD
// ─────────────────────────────────────────────────────────────────

/**
 * Throws in production if a simulation (legacy RPC) payment path is reached.
 *
 * Simulation paths exist ONLY as a local-dev fallback when no Stripe key is
 * configured. They MUST NEVER run in production because:
 *   - They bypass Stripe and record fake payments
 *   - They short-circuit the webhook (source of truth for payment confirmation)
 *   - They violate financial integrity guarantees
 *
 * Call this at the top of every function tagged LEGACY SIMULATION PATH.
 */
export function assertSimulationNotInProduction(operationName: string): void {
  if (import.meta.env.PROD) {
    throw new Error(
      `[PaymentGuard] Simulation payment path reached in production environment. ` +
        `Operation: ${operationName}. ` +
        `Ensure VITE_STRIPE_LIVE_KEY is set on all production domains (cleanlyst.co.uk, cleanlyst.app). ` +
        `The simulation path is a dev-only fallback and must never execute in production. ` +
        `This is a P0 financial integrity violation.`,
    )
  }
}

// ─────────────────────────────────────────────────────────────────
// LAYER 2 — DEV-ONLY CALL DEPTH HINT
// ─────────────────────────────────────────────────────────────────

/**
 * Logs a console.warn in DEV when the orchestrator appears to have been called
 * directly from a Vue component or Pinia store, bypassing bookingService.
 *
 * LIMITATIONS (read before relying on this):
 *   - Uses Error().stack which is only readable in unminified builds
 *   - Does not throw — it is a non-blocking development hint only
 *   - Will not catch violations in production or CI minified builds
 *   - The architectural test (payment-boundary.test.ts) is the authoritative check
 *
 * The preferred call graph is:
 *   Vue component/store → bookingService → paymentOrchestrator
 *
 * Direct component → orchestrator calls are permitted when the component is the
 * natural booking-flow owner (e.g. SearchCleaner.vue), but this hint helps spot
 * unexpected direct calls during feature development.
 */
export function warnIfCalledOutsideServiceLayer(methodName: string): void {
  if (!import.meta.env.DEV) return
  try {
    const stack = new Error().stack ?? ''
    // Skip: Error line, this function, the orchestrator method itself
    const callerLines = stack.split('\n').slice(3, 7).join(' ')
    const isComponentOrStoreCaller =
      /pages\/|components\/|stores\//.test(callerLines) && !/bookingService/.test(callerLines)
    if (isComponentOrStoreCaller) {
      console.warn(
        `[PaymentGuard] paymentOrchestrator.${methodName}() called directly from a component or store. ` +
          `If this is a new call site, prefer routing through bookingService. ` +
          `If this call site is intentional (e.g. booking flow owner), disregard. ` +
          `Stack hint: ${callerLines.trim().slice(0, 300)}`,
      )
    }
  } catch {
    // Stack inspection is best-effort; ignore any failures silently
  }
}

// ─────────────────────────────────────────────────────────────────
// LAYER 3 — ARCHITECTURAL CONTRACT (used by payment-boundary.test.ts)
// ─────────────────────────────────────────────────────────────────

/**
 * Source-of-truth for payment boundary rules.
 *
 * The architectural test imports this object to avoid hardcoding rule strings
 * in two places. Changing a rule here changes what the test enforces.
 *
 * Rules are intentionally conservative: they target the highest-risk violations
 * (direct RPC calls, Stripe SDK exposure) rather than every possible import path.
 */
export const PAYMENT_BOUNDARY_CONTRACT = {
  /**
   * Payment RPCs that are only permitted inside paymentOrchestrator.ts.
   * Any other file containing these strings is a violation.
   */
  forbiddenRpcPatterns: [
    'record_initial_payment',
    'record_additional_payment',
  ],

  /**
   * Files allowed to call payment RPCs (the allowlist).
   * Must be relative paths from src/.
   */
  paymentRpcAllowlist: ['services/payments/paymentOrchestrator.ts'],

  /**
   * Stripe SDK must not be imported outside the Stripe service layer.
   * UI components must use useStripe composable or orchestrator instead.
   */
  forbiddenStripeImportInUi: "@stripe/stripe-js",

  /**
   * Directories whose files must not import the Stripe SDK directly.
   */
  uiDirectories: ['pages', 'components', 'stores'],

  /**
   * The orchestrator must not import bookingService (would create a circular dep).
   * bookingService → orchestrator is the permitted direction only.
   */
  orchestratorForbiddenImport: 'bookingService',

  /**
   * bookingService must not import the Stripe SDK.
   * Stripe is isolated behind the stripe service layer.
   */
  bookingServiceForbiddenImport: '@stripe/stripe-js',
} as const
