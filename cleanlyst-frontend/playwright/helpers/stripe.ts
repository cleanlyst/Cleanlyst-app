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
 * Only used when the app redirects to Stripe's domain.
 */
export async function completeStripeHostedCheckout(
  page: Page,
  card = STRIPE_CARDS.visa,
): Promise<void> {
  await expect(page).toHaveURL(/checkout\.stripe\.com/, { timeout: 30_000 })

  // Email field may be pre-filled; skip if disabled
  const emailInput = page.locator('input[type="email"]')
  if (await emailInput.isVisible() && await emailInput.isEnabled()) {
    await emailInput.fill('test@cleanlyst.test')
  }

  await page.locator('[placeholder="1234 1234 1234 1234"]').fill(card)
  await page.locator('[placeholder="MM / YY"]').fill(TEST_EXPIRY)
  await page.locator('[placeholder="CVC"]').fill(TEST_CVC)

  const postcodeInput = page.locator('[placeholder="ZIP"]').or(page.locator('[placeholder="Postcode"]'))
  if (await postcodeInput.isVisible()) {
    await postcodeInput.fill(TEST_POSTCODE)
  }

  await page.getByRole('button', { name: /pay/i }).click()
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
