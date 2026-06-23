/**
 * fixtures/index.ts — Playwright custom fixtures.
 *
 * Usage: import { test, expect } from '../fixtures'
 *
 * Provides:
 *  - customerPage   — Page already authenticated as the E2E customer
 *  - cleanerPage    — Page already authenticated as the E2E cleaner
 *  - adminPage      — Page already authenticated as the E2E admin
 *  - customerCtx    — Full BrowserContext for the customer (for multi-tab tests)
 */
import { test as base } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { loginAs } from '../helpers/auth'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env.playwright') })

interface CleanlyxtFixtures {
  customerPage: import('@playwright/test').Page
  cleanerPage:  import('@playwright/test').Page
  adminPage:    import('@playwright/test').Page
}

export const test = base.extend<CleanlyxtFixtures>({
  customerPage: async ({ browser }, use) => {
    const ctx  = await browser.newContext()
    const page = await ctx.newPage()
    await loginAs(page, process.env.E2E_CUSTOMER_EMAIL!, process.env.E2E_CUSTOMER_PASSWORD!)
    await use(page)
    await ctx.close()
  },

  cleanerPage: async ({ browser }, use) => {
    const ctx  = await browser.newContext()
    const page = await ctx.newPage()
    await loginAs(page, process.env.E2E_CLEANER_EMAIL!, process.env.E2E_CLEANER_PASSWORD!)
    await use(page)
    await ctx.close()
  },

  adminPage: async ({ browser }, use) => {
    const ctx  = await browser.newContext()
    const page = await ctx.newPage()
    await loginAs(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!)
    await use(page)
    await ctx.close()
  },
})

export { expect } from '@playwright/test'
