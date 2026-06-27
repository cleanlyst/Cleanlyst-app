/**
 * Customer Registration Journey
 *
 * Covers:
 *  - Successful registration as a customer
 *  - Duplicate email is rejected
 *  - Invalid credentials rejected at login
 *  - Password field masking
 *  - Unauthenticated redirect to login
 *  - Customer cannot access cleaner or admin pages
 */
import { test, expect } from '../../fixtures'
import { LoginPage }    from '../../pageObjects/LoginPage'
import { RegisterPage } from '../../pageObjects/RegisterPage'
import { makeCustomerProfile } from '../../helpers/dataFactory'
import { db, deleteUser }      from '../../helpers/db'

test.describe('Customer registration', () => {
  test.describe.configure({ mode: 'serial' })

  let createdUserId: string | null = null

  test.afterAll(async () => {
    if (createdUserId) await deleteUser(createdUserId)
  })

  // ── 1.1  Happy path ─────────────────────────────────────────────────────────

  test('1.1 — new customer registers, lands on dashboard', async ({ page }) => {
    const profile = makeCustomerProfile()
    const register = new RegisterPage(page)

    await register.goto()
    await expect(page.getByRole('heading', { name: /register|create account|sign up/i })).toBeVisible()

    await register.registerAndWait({
      fullName: profile.fullName,
      email:    profile.email,
      password: profile.password,
      role:     'customer',
    })

    await expect(page).toHaveURL(/customer\/dashboard/)
    await expect(page.getByText(/my bookings|dashboard/i).first()).toBeVisible()

    // Capture created user id for cleanup
    const { data } = await db.auth.admin.listUsers({ query: profile.email, page: 1, perPage: 10 })
    const user = data.users.find((u) => u.email === profile.email)
    expect(user).toBeTruthy()
    createdUserId = user?.id ?? null
  })

  // ── 1.2  Duplicate email ────────────────────────────────────────────────────

  test('1.2 — duplicate email is rejected with error', async ({ page }) => {
    const register = new RegisterPage(page)
    await register.goto()

    // Use the standing test account — guaranteed to already exist
    await register.fill({
      fullName: 'Duplicate User',
      email:    process.env.E2E_CUSTOMER_EMAIL!,
      password: process.env.E2E_CUSTOMER_PASSWORD!,
      role:     'customer',
    })
    await register.submit()

    // Should stay on register or show an error — NOT navigate to dashboard
    await page.waitForTimeout(3000)
    const isStillOnRegister = page.url().includes('register') || page.url().includes('auth')
    const errorShown = await page.getByText(/already|exists|taken|in use/i).first().isVisible()
    expect(isStillOnRegister || errorShown).toBe(true)
  })

  // ── 1.3  Invalid login ──────────────────────────────────────────────────────

  test('1.3 — invalid credentials show error, stay on login', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.attemptLogin('nobody@test.cleanlyst.local', 'WrongPassword!')

    await expect(page).toHaveURL(/auth\/login/, { timeout: 10_000 })
    await expect(loginPage.errorMessage).toBeVisible({ timeout: 10_000 })
  })

  // ── 1.4  Unauthenticated redirect ───────────────────────────────────────────

  test('1.4 — unauthenticated access to protected route redirects to /auth/login', async ({ page }) => {
    await page.goto('/customer/dashboard')
    await expect(page).toHaveURL(/auth\/login/, { timeout: 10_000 })
  })

  // ── 1.5  Password masking ───────────────────────────────────────────────────

  test('1.5 — password fields are masked', async ({ page }) => {
    const register = new RegisterPage(page)
    await register.goto()
    const type = await register.passwordInput.getAttribute('type')
    expect(type).toBe('password')
  })
})

// ── Cross-role access control ─────────────────────────────────────────────────

test.describe('Customer role access control', () => {
  test('customer cannot access /admin/dashboard', async ({ customerPage: page }) => {
    await page.goto('/admin/dashboard')
    await expect(page).not.toHaveURL(/admin\/dashboard/, { timeout: 10_000 })
  })

  test('customer cannot access /cleaner/dashboard', async ({ customerPage: page }) => {
    await page.goto('/cleaner/dashboard')
    await expect(page).not.toHaveURL(/cleaner\/dashboard/, { timeout: 10_000 })
  })
})
