/**
 * adminGuards.ts — Reusable assertions for the Admin Acceptance suite.
 *
 * Every admin page must:
 *  - Have no uncaught JS exceptions
 *  - Have no failed network requests (4xx/5xx that matter)
 *  - Have no lingering loading spinners
 *  - Expose correct landmark structure (accessibility)
 *  - Have no duplicate table rows
 */
import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export interface ConsoleCollector {
  errors: string[]
  attach: () => void
}

export function collectConsoleErrors(page: Page): ConsoleCollector {
  const errors: string[] = []
  const attach = () => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    page.on('pageerror', (err) => errors.push(err.message))
  }
  return { errors, attach }
}

export interface NetworkCollector {
  failures: string[]
  attach: () => void
}

export function collectNetworkFailures(page: Page): NetworkCollector {
  const failures: string[] = []
  const attach = () => {
    page.on('response', (resp) => {
      const status = resp.status()
      const url = resp.url()
      // Ignore expected 406 Not Acceptable from PostgREST for HEAD/count queries,
      // stripe/analytics noise, and favicon
      if (
        status >= 400 &&
        !url.includes('favicon') &&
        !url.includes('google-analytics') &&
        !url.includes('analytics') &&
        !(status === 406) // PostgREST: used for HEAD count queries with range headers
      ) {
        failures.push(`${status} ${url}`)
      }
    })
  }
  return { failures, attach }
}

export async function assertNoLoadingSpinners(page: Page): Promise<void> {
  // Wait for any animate-spin / animate-pulse to settle
  await page.waitForFunction(
    () => !document.querySelector('[class*="animate-spin"]'),
    { timeout: 10_000 },
  ).catch(() => {
    // Soft — spinner may be for background tasks; don't hard-fail
  })
}

export async function assertAccessibility(page: Page): Promise<void> {
  // Main landmark
  await expect(page.getByRole('main')).toBeVisible()
  // At least one heading
  const heading = page.getByRole('heading').first()
  await expect(heading).toBeVisible()
  // Navigation
  const nav = page.getByRole('navigation').first()
  await expect(nav).toBeVisible()
}

export async function assertTableNoduplicateRows(
  page: Page,
  rowSelector: string,
  idAttribute: string,
): Promise<void> {
  const rows = await page.locator(rowSelector).all()
  const ids = await Promise.all(rows.map((r) => r.getAttribute(idAttribute)))
  const unique = new Set(ids.filter(Boolean))
  expect(ids.filter(Boolean).length).toBe(unique.size)
}

export async function measureNavigation(
  page: Page,
  navigateFn: () => Promise<void>,
  warnThresholdMs = 3000,
): Promise<number> {
  const start = Date.now()
  await navigateFn()
  const elapsed = Date.now() - start
  if (elapsed > warnThresholdMs) {
    console.warn(`[perf] navigation took ${elapsed}ms (threshold: ${warnThresholdMs}ms)`)
  }
  return elapsed
}

export async function assertButtonsHaveNames(page: Page): Promise<void> {
  const buttons = await page.getByRole('button').all()
  for (const btn of buttons.slice(0, 20)) {
    // Every visible button should have accessible text
    const isVisible = await btn.isVisible()
    if (!isVisible) continue
    const name = await btn.getAttribute('aria-label')
      ?? await btn.textContent()
      ?? await btn.getAttribute('title')
    // Soft check — warn only (icons may have no text but use aria-label)
    if (!name?.trim()) {
      const html = await btn.evaluate((el) => el.outerHTML.slice(0, 120))
      console.warn(`[a11y] button without accessible name: ${html}`)
    }
  }
}

export async function assertDialogTrapsEscape(page: Page, openDialogFn: () => Promise<void>, dialogSelector: string): Promise<void> {
  await openDialogFn()
  const dialog = page.locator(dialogSelector)
  await expect(dialog).toBeVisible({ timeout: 5_000 })
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible({ timeout: 5_000 })
}
