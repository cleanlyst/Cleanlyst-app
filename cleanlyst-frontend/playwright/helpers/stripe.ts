import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

// Stripe test card numbers
export const STRIPE_CARDS = {
  visa:            '4242424242424242',
  visaDeclined:    '4000000000000002',
  threeDSecure:    '4000002500003155',
  insufficient:    '4000000000009995',
  expired:         '4000000000000069',
}

export const TEST_EXPIRY  = '12/30'
export const TEST_CVC     = '123'
export const TEST_POSTCODE = 'SW1A 1AA'

/**
 * Fills in a Stripe-hosted checkout page (checkout.stripe.com redirect).
 *
 * Stripe's new Checkout renders payment method radios and card fields inside
 * cross-origin iframes (js.stripe.com). We search all frames to locate them.
 */
export async function completeStripeHostedCheckout(
  page: Page,
  card = STRIPE_CARDS.visa,
): Promise<void> {
  await expect(page).toHaveURL(/checkout\.stripe\.com/, { timeout: 30_000 })
  await page.waitForLoadState('domcontentloaded')

  // Give Stripe's JS time to mount its iframes
  await page.waitForTimeout(2_000)

  // 1. Fill email — Stripe uses type="text" with name="email" (not type="email")
  const emailInput = page.locator('input[name="email"], input[id="email"]').first()
  if (await emailInput.isVisible({ timeout: 5_000 }).catch(() => false) && await emailInput.isEnabled()) {
    const current = await emailInput.inputValue().catch(() => '')
    if (!current) await emailInput.fill('test@cleanlyst.test')
  }

  // 2. Select "Card" payment method.  Radio buttons can be on the main page
  //    or inside a Stripe iframe — search all frames.
  await selectCardPaymentMethod(page)

  // Give Stripe time to mount the card iframe after the accordion opens
  await page.waitForTimeout(3_000)

  // 3. Fill card fields — also search all frames
  await fillCardFields(page, card)

  // 4. Fill cardholder name if required (Stripe sometimes requests this)
  const cardholderInput = page.locator('input[name="billingName"], input[placeholder*="Full name"], input[placeholder*="Name on card"]').first()
  if (await cardholderInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await cardholderInput.fill('Test User')
  }

  // 5. Submit — use JS .click() to bypass viewport constraints (same as accordion)
  await page.evaluate(() => {
    const btn = document.querySelector<HTMLElement>(
      '[data-testid="hosted-payment-submit-button"], button[type="submit"]',
    ) ?? Array.from(document.querySelectorAll('button')).find((b) =>
      /pay/i.test(b.textContent ?? ''),
    ) ?? null
    if (btn) btn.click()
  })
  // Wait for Stripe to process and redirect
  await page.waitForURL(/checkout\.stripe\.com|\/checkout\/success|\/checkout\/cancel/, { timeout: 5_000 })
    .catch(() => { /* page may already be navigating */ })
}

async function selectCardPaymentMethod(page: Page): Promise<void> {
  // Stripe Checkout uses an accordion for payment methods (Card / Klarna / Revolut Pay).
  // The Card section button is present but MAY be off-screen, so Playwright's normal
  // click (including force:true) fails with "Element is outside of the viewport".
  // We use native DOM .click() via page.evaluate() which ignores viewport constraints.
  const clicked = await page.evaluate(() => {
    const btn = document.querySelector<HTMLElement>('[data-testid="card-accordion-item-button"]')
    if (btn) { btn.click(); return true }
    return false
  })
  if (!clicked) {
    // Fallback: Stripe without accordion — card fields should already be visible
  }
}

async function fillCardFields(page: Page, card: string): Promise<void> {
  const cardPlaceholder = '1234 1234 1234 1234'
  const deadline = Date.now() + 30_000

  while (Date.now() < deadline) {
    // Try main page first
    const mainCard = page.locator(`[placeholder="${cardPlaceholder}"]`).first()
    if (await mainCard.isVisible({ timeout: 500 }).catch(() => false)) {
      await mainCard.fill(card)
      await page.locator('[placeholder="MM / YY"]').first().fill(TEST_EXPIRY)
      await page.locator('[placeholder="CVC"]').first().fill(TEST_CVC)
      const zipMain = page.locator('[placeholder="ZIP"], [placeholder="Postcode"]').first()
      if (await zipMain.isVisible({ timeout: 1_000 }).catch(() => false)) await zipMain.fill(TEST_POSTCODE)
      return
    }

    // Search all frames
    for (const frame of page.frames()) {
      try {
        const cardInput = frame.locator(`[placeholder="${cardPlaceholder}"]`).first()
        if (!(await cardInput.isVisible({ timeout: 300 }).catch(() => false))) continue

        await cardInput.fill(card)
        await frame.locator('[placeholder="MM / YY"]').first().fill(TEST_EXPIRY)
        await frame.locator('[placeholder="CVC"]').first().fill(TEST_CVC)

        const zipFrame = frame.locator('[placeholder="ZIP"], [placeholder="Postcode"]').first()
        if (await zipFrame.isVisible({ timeout: 1_000 }).catch(() => false)) {
          await zipFrame.fill(TEST_POSTCODE)
        } else {
          const zipMain = page.locator('[placeholder="ZIP"], [placeholder="Postcode"]').first()
          if (await zipMain.isVisible({ timeout: 1_000 }).catch(() => false)) await zipMain.fill(TEST_POSTCODE)
        }
        return
      } catch { /* skip inaccessible frames */ }
    }

    await page.waitForTimeout(500)
  }

  throw new Error('Could not locate Stripe card number field in any frame after 30s')
}

/**
 * Fills Stripe's embedded payment element (on-page iframe).
 * Used when the app uses Stripe Elements rather than hosted checkout.
 */
export async function completeStripeEmbedded(page: Page, card = STRIPE_CARDS.visa): Promise<void> {
  const stripeFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]')
    .or(page.frameLocator('iframe[src*="stripe.com"]'))
    .first()

  await stripeFrame.locator('[placeholder="Card number"]').fill(card)
  await stripeFrame.locator('[placeholder="MM / YY"]').fill(TEST_EXPIRY)
  await stripeFrame.locator('[placeholder="CVC"]').fill(TEST_CVC)

  await page.getByRole('button', { name: /pay|confirm/i }).click()
}

/**
 * Handles whichever checkout mode the app uses:
 * – If the page URL is already on Stripe's domain, use hosted flow.
 * – Otherwise try embedded elements.
 * Falls back gracefully if neither is present (e.g. sandbox auto-pay).
 */
export async function completeCheckout(page: Page, card = STRIPE_CARDS.visa): Promise<void> {
  const currentUrl = page.url()
  if (currentUrl.includes('checkout.stripe.com')) {
    await completeStripeHostedCheckout(page, card)
    return
  }

  // Sandbox/test mode: the app may auto-confirm without card input.
  const confirmBtn = page.getByTestId('confirm-pay-btn').or(page.getByRole('button', { name: /confirm and pay/i }))
  if (await confirmBtn.isVisible()) {
    await confirmBtn.click()
    return
  }

  // Embedded elements
  await completeStripeEmbedded(page, card)
}
