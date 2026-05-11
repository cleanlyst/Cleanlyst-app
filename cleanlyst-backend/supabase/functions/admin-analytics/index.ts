/**
 * admin-analytics
 *
 * Admin-only. Returns aggregated platform KPIs for the admin dashboard.
 *
 * All queries run in parallel for performance. Results are cached at the
 * application layer — do not call this on every page render.
 *
 * Metrics returned:
 *   - revenue: total captured + breakdown by period (MTD, last 30d)
 *   - bookings: counts by status, completed this month
 *   - cleaners: total active, pending applications, top earners
 *   - customers: total, new this month
 *   - payouts: total released, pending
 *   - platform: average booking value, average rating
 */

import { corsHeaders, err, makeAdminClient, ok, requireRole } from '../_shared/utils.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const admin = makeAdminClient()

  try {
    const auth = await requireRole(req.headers.get('Authorization'), admin, 'admin')
    if (auth instanceof Response) return auth

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // ── Run all aggregation queries in parallel ────────────────────────────
    const [
      bookingCounts,
      revenueResult,
      payoutsResult,
      activeCleaners,
      pendingApplications,
      totalCustomers,
      newCustomersThisMonth,
      completedBookingsThisMonth,
      recentBookings,
      avgRatingResult,
      topCleaners,
    ] = await Promise.all([
      // Booking counts by status
      admin.from('bookings').select('status').then(({ data }) => {
        const counts: Record<string, number> = {}
        for (const row of data ?? []) {
          counts[row.status] = (counts[row.status] ?? 0) + 1
        }
        return counts
      }),

      // Revenue: sum of captured payments (total + MTD + last 30 days)
      admin.from('payments').select('amount_cents, currency, captured_at').eq('status', 'captured'),

      // Payouts
      admin.from('payouts').select('amount_cents, status, released_at'),

      // Active cleaner count
      admin
        .from('cleaner_profiles')
        .select('user_id', { count: 'exact', head: true })
        .eq('status', 'approved'),

      // Pending applications count
      admin
        .from('cleaner_applications')
        .select('id', { count: 'exact', head: true })
        .in('status', ['submitted', 'under_review']),

      // Total customers
      admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'customer'),

      // New customers this month
      admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'customer')
        .gte('created_at', startOfMonth),

      // Completed bookings this month
      admin
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('created_at', startOfMonth),

      // Recent 10 bookings for activity feed
      admin
        .from('bookings')
        .select(
          'id, status, quote_cents, currency, created_at, customer_id, cleaner_id, service_title_snapshot',
        )
        .order('created_at', { ascending: false })
        .limit(10),

      // Average cleaner rating across all reviews
      admin.from('reviews').select('rating'),

      // Top 5 cleaners by total earnings
      admin
        .from('payouts')
        .select('cleaner_id, amount_cents')
        .eq('status', 'released')
        .order('amount_cents', { ascending: false }),
    ])

    // ── Aggregate revenue ─────────────────────────────────────────────────
    const allPayments = revenueResult.data ?? []
    const totalRevenuePence = allPayments.reduce((s, p) => s + Number(p.amount_cents ?? 0), 0)
    const mtdRevenuePence = allPayments
      .filter((p) => p.captured_at && p.captured_at >= startOfMonth)
      .reduce((s, p) => s + Number(p.amount_cents ?? 0), 0)
    const last30dRevenuePence = allPayments
      .filter((p) => p.captured_at && p.captured_at >= thirtyDaysAgo)
      .reduce((s, p) => s + Number(p.amount_cents ?? 0), 0)

    // ── Aggregate payouts ─────────────────────────────────────────────────
    const allPayouts = payoutsResult.data ?? []
    const releasedPayoutsPence = allPayouts
      .filter((p) => p.status === 'released' || p.status === 'paid')
      .reduce((s, p) => s + Number(p.amount_cents ?? 0), 0)
    const pendingPayoutsPence = allPayouts
      .filter((p) => p.status === 'pending')
      .reduce((s, p) => s + Number(p.amount_cents ?? 0), 0)

    // ── Aggregate ratings ─────────────────────────────────────────────────
    const ratings = (avgRatingResult.data ?? []).map((r: { rating: number }) => Number(r.rating))
    const avgRating =
      ratings.length > 0
        ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10
        : null

    // ── Aggregate top cleaners ────────────────────────────────────────────
    const cleanerEarnings: Record<string, number> = {}
    for (const row of topCleaners.data ?? []) {
      cleanerEarnings[row.cleaner_id] = (cleanerEarnings[row.cleaner_id] ?? 0) + Number(row.amount_cents ?? 0)
    }
    const top5Cleaners = Object.entries(cleanerEarnings)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cleaner_id, total_pence]) => ({ cleaner_id, total_pence }))

    // ── Avg booking value ─────────────────────────────────────────────────
    const completedTotal = allPayments.length
    const avgBookingValuePence = completedTotal > 0 ? Math.round(totalRevenuePence / completedTotal) : 0

    return ok({
      generated_at: now.toISOString(),
      revenue: {
        total_pence: totalRevenuePence,
        mtd_pence: mtdRevenuePence,
        last_30d_pence: last30dRevenuePence,
      },
      bookings: {
        by_status: bookingCounts,
        completed_mtd: completedBookingsThisMonth.count ?? 0,
        avg_value_pence: avgBookingValuePence,
      },
      cleaners: {
        active: activeCleaners.count ?? 0,
        pending_applications: pendingApplications.count ?? 0,
        top_earners: top5Cleaners,
      },
      customers: {
        total: totalCustomers.count ?? 0,
        new_mtd: newCustomersThisMonth.count ?? 0,
      },
      payouts: {
        released_pence: releasedPayoutsPence,
        pending_pence: pendingPayoutsPence,
      },
      platform: {
        avg_cleaner_rating: avgRating,
        total_reviews: ratings.length,
      },
      recent_bookings: recentBookings.data ?? [],
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error'
    return err(500, message)
  }
})
