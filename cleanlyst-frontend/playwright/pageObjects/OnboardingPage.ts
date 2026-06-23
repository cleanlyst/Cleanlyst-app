import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export class OnboardingPage {
  constructor(private page: Page) {}

  // ── Customer onboarding ───────────────────────────────────────────────────────

  async completeCustomerOnboarding(data: {
    phone?: string
    address?: string
    postcode?: string
  } = {}): Promise<void> {
    const isOnboarding = this.page.url().includes('onboarding')
    if (!isOnboarding) {
      const onboardingLink = this.page.getByRole('link', { name: /complete profile|onboarding/i })
      if (await onboardingLink.isVisible({ timeout: 3000 })) {
        await onboardingLink.click()
      } else {
        return  // onboarding already complete
      }
    }

    // Phone number
    const phoneInput = this.page.getByLabel(/phone/i)
    if (await phoneInput.isVisible({ timeout: 5000 })) {
      await phoneInput.fill(data.phone ?? '07700900000')
      const nextBtn = this.page.getByRole('button', { name: /next|continue/i })
      if (await nextBtn.isVisible()) await nextBtn.click()
    }

    // Address
    const addressInput = this.page.getByPlaceholder(/address line 1/i).or(this.page.getByLabel(/address/i))
    if (await addressInput.isVisible({ timeout: 5000 })) {
      await addressInput.fill(data.address ?? '12 Test Street')
      const postcodeInput = this.page.getByPlaceholder(/postcode/i).or(this.page.getByLabel(/postcode/i))
      if (await postcodeInput.isVisible()) await postcodeInput.fill(data.postcode ?? 'M1 1AA')
      const nextBtn = this.page.getByRole('button', { name: /next|continue|finish/i })
      if (await nextBtn.isVisible()) await nextBtn.click()
    }

    await expect(this.page).toHaveURL(/customer\/dashboard/, { timeout: 20_000 })
  }

  // ── Cleaner onboarding ────────────────────────────────────────────────────────

  async completeCleanerOnboarding(data: {
    phone?: string
    bio?: string
    hourlyRate?: string
  } = {}): Promise<void> {
    const isOnboarding = this.page.url().includes('onboarding')
    if (!isOnboarding) {
      const onboardingLink = this.page.getByRole('link', { name: /complete profile|onboarding/i })
      if (await onboardingLink.isVisible({ timeout: 3000 })) await onboardingLink.click()
      else return
    }

    // Each onboarding step loops until we reach the final state
    const steps = [
      async () => {
        const phoneInput = this.page.getByLabel(/phone/i)
        if (await phoneInput.isVisible({ timeout: 3000 })) {
          await phoneInput.fill(data.phone ?? '07700900001')
        }
      },
      async () => {
        const bioInput = this.page.getByLabel(/bio|about/i).or(this.page.getByPlaceholder(/tell us about/i))
        if (await bioInput.isVisible({ timeout: 3000 })) {
          await bioInput.fill(data.bio ?? 'Experienced professional cleaner. Test account.')
        }
      },
      async () => {
        const rateInput = this.page.getByLabel(/hourly rate|rate/i)
        if (await rateInput.isVisible({ timeout: 3000 })) {
          await rateInput.fill(data.hourlyRate ?? '15')
        }
      },
    ]

    for (const step of steps) {
      await step()
      const nextBtn = this.page.getByRole('button', { name: /next|continue/i })
      if (await nextBtn.isVisible({ timeout: 3000 })) await nextBtn.click()
    }

    // Final submit / finish
    const finishBtn = this.page.getByRole('button', { name: /finish|submit|complete/i })
    if (await finishBtn.isVisible({ timeout: 5000 })) await finishBtn.click()

    // Cleaner ends up on pending approval screen
    await expect(this.page).toHaveURL(/cleaner\/dashboard/, { timeout: 20_000 })
  }
}
