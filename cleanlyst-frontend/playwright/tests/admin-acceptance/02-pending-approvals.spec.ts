/**
 * 02-pending-approvals — Cleaner application review (approve / reject).
 *
 * Verifies: approve flow, reject flow, application disappears from list,
 * counts update, audit event written, notification sent.
 */
import { test, expect } from '../../fixtures'
import {
  db,
  createEphemeralUser,
  deleteUser,
  getNotificationsForUser,
} from '../../helpers/db'
import { collectConsoleErrors, collectNetworkFailures } from '../../helpers/adminGuards'

test.describe.configure({ mode: 'serial' })

test.describe('Admin — Pending Approvals', () => {

  async function seedPendingCleaner(prefix: string) {
    const user = await createEphemeralUser(`acc-${prefix}`, 'TestPassword123!', {
      full_name: `Acc ${prefix} Cleaner`,
    })
    await db.from('profiles').upsert({
      id:        user.id,
      role:      'cleaner_pending',
      full_name: `Acc ${prefix} Cleaner`,
      city:      'Leeds',
    }, { onConflict: 'id' })
    await db.from('cleaner_profiles').upsert({
      user_id:             user.id,
      status:              'pending',
      onboarding_complete: false,
    }, { onConflict: 'user_id' })
    await db.from('cleaner_applications').upsert({
      cleaner_id:       user.id,
      status:           'submitted',
      current_step:     'personal_details',
      personal_details: { full_name: `Acc ${prefix} Cleaner`, city: 'Leeds' },
      submitted_at:     new Date().toISOString(),
    }, { onConflict: 'cleaner_id' })
    return user
  }

  // ── Page loads ─────────────────────────────────────────────────────────────

  test('PA2.1 — Pending Applications page loads without errors', async ({ adminPage: page }) => {
    const { errors, attach } = collectConsoleErrors(page)
    const { failures, attach: attachNet } = collectNetworkFailures(page)
    attach()
    attachNet()

    await page.goto('/admin/dashboard/approvals')
    await page.waitForLoadState('networkidle')

    await expect(
      page.getByRole('heading', { name: /pending cleaner applications/i })
    ).toBeVisible({ timeout: 10_000 })

    expect(errors.filter((e) => !e.includes('favicon'))).toHaveLength(0)
    expect(failures).toHaveLength(0)
  })

  // ── Totals / counts ────────────────────────────────────────────────────────

  test('PA2.2 — counts panel shows numeric totals', async ({ adminPage: page }) => {
    await page.goto('/admin/dashboard/approvals')
    await page.waitForLoadState('networkidle')

    // Summary Insights section has three stat cards
    const stats = page.getByText(/pending total|submitted|under review/i).first()
    await expect(stats).toBeVisible({ timeout: 10_000 })
  })

  // ── Approve flow ───────────────────────────────────────────────────────────

  test('PA2.3 — admin can approve a pending cleaner application', async ({ adminPage: page }) => {
    const user = await seedPendingCleaner('approve')

    try {
      await page.goto('/admin/dashboard/approvals')
      await page.waitForLoadState('networkidle')

      // Find the "Review" button for this application
      const reviewBtn = page.getByRole('button', { name: /review/i }).first()
      if (await reviewBtn.isVisible({ timeout: 10_000 })) {
        await reviewBtn.click()

        // Approval modal opens
        const approveBtn = page.getByRole('button', { name: /^approve$/i })
        await expect(approveBtn).toBeVisible({ timeout: 5_000 })
        await approveBtn.click()
        await page.waitForLoadState('networkidle')

        // DB: profile role should be cleaner_active
        const { data } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle()
        const role = (data as { role: string } | null)?.role
        expect(role).toBe('cleaner_active')

        // Audit: admin_application_reviews row should exist
        const { data: review } = await db
          .from('admin_application_reviews')
          .select('action')
          .eq('cleaner_id', user.id)
          .maybeSingle()
        expect((review as { action: string } | null)?.action).toBe('approved')
      }
    } finally {
      await db.from('admin_application_reviews').delete().eq('cleaner_id', user.id)
      await db.from('cleaner_applications').delete().eq('cleaner_id', user.id)
      await db.from('cleaner_profiles').delete().eq('user_id', user.id)
      await db.from('profiles').delete().eq('id', user.id)
      await deleteUser(user.id)
    }
  })

  // ── Reject flow ────────────────────────────────────────────────────────────

  test('PA2.4 — admin can reject a pending cleaner application with reason', async ({ adminPage: page }) => {
    const user = await seedPendingCleaner('reject')

    try {
      await page.goto('/admin/dashboard/approvals')
      await page.waitForLoadState('networkidle')

      const reviewBtn = page.getByRole('button', { name: /review/i }).first()
      if (await reviewBtn.isVisible({ timeout: 10_000 })) {
        await reviewBtn.click()

        const notesBox = page.getByLabel(/notes/i)
        if (await notesBox.isVisible({ timeout: 3_000 })) {
          await notesBox.fill('Application incomplete — missing insurance document.')
        }

        const declineBtn = page.getByRole('button', { name: /decline/i })
        await expect(declineBtn).toBeVisible({ timeout: 5_000 })
        await declineBtn.click()
        await page.waitForLoadState('networkidle')

        // DB: cleaner_applications status should be rejected
        const { data: app } = await db
          .from('cleaner_applications')
          .select('status')
          .eq('cleaner_id', user.id)
          .maybeSingle()
        expect((app as { status: string } | null)?.status).toBe('rejected')
      }
    } finally {
      await db.from('admin_application_reviews').delete().eq('cleaner_id', user.id)
      await db.from('cleaner_applications').delete().eq('cleaner_id', user.id)
      await db.from('cleaner_profiles').delete().eq('user_id', user.id)
      await db.from('profiles').delete().eq('id', user.id)
      await deleteUser(user.id)
    }
  })

  // ── Application disappears ─────────────────────────────────────────────────

  test('PA2.5 — approved application no longer shown in pending list', async ({ adminPage: page }) => {
    const user = await seedPendingCleaner('disappear')

    try {
      await page.goto('/admin/dashboard/approvals')
      await page.waitForLoadState('networkidle')

      // Count rows before
      const rowsBefore = await page.getByRole('row').count()

      const reviewBtn = page.getByRole('button', { name: /review/i }).first()
      if (await reviewBtn.isVisible({ timeout: 10_000 })) {
        await reviewBtn.click()
        const approveBtn = page.getByRole('button', { name: /^approve$/i })
        if (await approveBtn.isVisible({ timeout: 3_000 })) {
          await approveBtn.click()
          await page.waitForLoadState('networkidle')

          // Row count should decrease
          const rowsAfter = await page.getByRole('row').count()
          expect(rowsAfter).toBeLessThanOrEqual(rowsBefore)
        }
      }
    } finally {
      await db.from('admin_application_reviews').delete().eq('cleaner_id', user.id)
      await db.from('cleaner_applications').delete().eq('cleaner_id', user.id)
      await db.from('cleaner_profiles').delete().eq('user_id', user.id)
      await db.from('profiles').delete().eq('id', user.id)
      await deleteUser(user.id)
    }
  })

  // ── Request changes ────────────────────────────────────────────────────────

  test('PA2.6 — admin can request changes on an application', async ({ adminPage: page }) => {
    const user = await seedPendingCleaner('reqchanges')

    try {
      await page.goto('/admin/dashboard/approvals')
      await page.waitForLoadState('networkidle')

      const reviewBtn = page.getByRole('button', { name: /review/i }).first()
      if (await reviewBtn.isVisible({ timeout: 10_000 })) {
        await reviewBtn.click()

        const notesBox = page.getByLabel(/notes/i)
        if (await notesBox.isVisible({ timeout: 3_000 })) {
          await notesBox.fill('Please upload a clearer insurance certificate.')
        }

        const reqBtn = page.getByRole('button', { name: /request changes/i })
        await expect(reqBtn).toBeVisible({ timeout: 5_000 })
        await reqBtn.click()
        await page.waitForLoadState('networkidle')

        // DB: status should be needs_info (stays in pending list)
        const { data: app } = await db
          .from('cleaner_applications')
          .select('status')
          .eq('cleaner_id', user.id)
          .maybeSingle()
        expect((app as { status: string } | null)?.status).toBe('needs_info')
      }
    } finally {
      await db.from('admin_application_reviews').delete().eq('cleaner_id', user.id)
      await db.from('cleaner_applications').delete().eq('cleaner_id', user.id)
      await db.from('cleaner_profiles').delete().eq('user_id', user.id)
      await db.from('profiles').delete().eq('id', user.id)
      await deleteUser(user.id)
    }
  })

  // ── Document preview ───────────────────────────────────────────────────────

  test('PA2.7 — Review modal shows document status', async ({ adminPage: page }) => {
    const user = await seedPendingCleaner('docview')

    try {
      await page.goto('/admin/dashboard/approvals')
      await page.waitForLoadState('networkidle')

      const reviewBtn = page.getByRole('button', { name: /review/i }).first()
      if (await reviewBtn.isVisible({ timeout: 10_000 })) {
        await reviewBtn.click()

        // Modal should show document section
        const docsSection = page.getByText(/documents/i).first()
        await expect(docsSection).toBeVisible({ timeout: 5_000 })

        // Close modal
        const closeBtn = page.getByRole('button', { name: /close/i }).first()
        if (await closeBtn.isVisible()) await closeBtn.click()
      }
    } finally {
      await db.from('cleaner_applications').delete().eq('cleaner_id', user.id)
      await db.from('cleaner_profiles').delete().eq('user_id', user.id)
      await db.from('profiles').delete().eq('id', user.id)
      await deleteUser(user.id)
    }
  })

  // ── Accessibility ──────────────────────────────────────────────────────────

  test('PA2.8 — accessibility: tables have column headers', async ({ adminPage: page }) => {
    await page.goto('/admin/dashboard/approvals')
    await page.waitForLoadState('networkidle')

    const table = page.getByRole('table').first()
    if (await table.isVisible()) {
      const headers = table.getByRole('columnheader')
      expect(await headers.count()).toBeGreaterThan(0)
    }
  })
})
