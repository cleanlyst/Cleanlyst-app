/**
 * /functions/v1/health
 *
 * Machine-readable health check for all critical subsystems.
 * Returns HTTP 200 with JSON body always (so load-balancers / uptime
 * monitors get a valid response); the `status` field in the body is
 * either "ok" or "degraded".
 *
 * Auth: none required — this endpoint is intentionally public so
 * external uptime monitors (UptimeRobot, BetterStack, etc.) can call
 * it without credentials. It does NOT return any sensitive data.
 *
 * Admin callers receive additional detail fields (cron, stripe_latency,
 * recent_errors) when they pass a valid admin JWT.
 */

import { corsHeaders, makeAdminClient } from '../_shared/utils.ts'

interface SubsystemResult {
  ok: boolean
  latency_ms?: number
  detail?: string
}

interface HealthResponse {
  status: 'ok' | 'degraded'
  generated_at: string
  subsystems: {
    database: SubsystemResult
    auth: SubsystemResult
    realtime: SubsystemResult
    stripe?: SubsystemResult
    cron?: SubsystemResult & { last_ran?: string; rows_affected?: number }
    recent_errors?: { count_last_hour: number }
  }
}

async function checkDatabase(admin: ReturnType<typeof makeAdminClient>): Promise<SubsystemResult> {
  const t0 = Date.now()
  try {
    const { error } = await admin.rpc('pg_advisory_unlock_all').maybeSingle()
    if (error && !error.message.includes('Does not exist')) {
      // pg_advisory_unlock_all may not exist — fall back to a safe read
      const { error: e2 } = await admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .limit(0)
      if (e2) return { ok: false, latency_ms: Date.now() - t0, detail: e2.message }
    }
    return { ok: true, latency_ms: Date.now() - t0 }
  } catch (e) {
    return { ok: false, latency_ms: Date.now() - t0, detail: String(e) }
  }
}

async function checkAuth(admin: ReturnType<typeof makeAdminClient>): Promise<SubsystemResult> {
  const t0 = Date.now()
  try {
    const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 })
    if (error) return { ok: false, latency_ms: Date.now() - t0, detail: error.message }
    return { ok: true, latency_ms: Date.now() - t0 }
  } catch (e) {
    return { ok: false, latency_ms: Date.now() - t0, detail: String(e) }
  }
}

async function checkStripe(): Promise<SubsystemResult> {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!stripeKey) return { ok: false, detail: 'STRIPE_SECRET_KEY not configured' }

  const t0 = Date.now()
  try {
    const res = await fetch('https://api.stripe.com/v1/balance', {
      headers: { Authorization: `Bearer ${stripeKey}` },
      signal: AbortSignal.timeout(5000),
    })
    const latency = Date.now() - t0
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return {
        ok: false,
        latency_ms: latency,
        detail: (body as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`,
      }
    }
    return { ok: true, latency_ms: latency }
  } catch (e) {
    return { ok: false, latency_ms: Date.now() - t0, detail: String(e) }
  }
}

async function checkCron(
  admin: ReturnType<typeof makeAdminClient>,
): Promise<SubsystemResult & { last_ran?: string; rows_affected?: number }> {
  try {
    const { data, error } = await admin
      .from('cron_execution_log')
      .select('created_at, status, rows_affected, error_detail')
      .eq('job_name', 'mark-overdue-bookings')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) return { ok: false, detail: error.message }
    if (!data) return { ok: false, detail: 'No executions recorded yet' }

    const lastRan = new Date(data.created_at as string)
    const minutesSince = (Date.now() - lastRan.getTime()) / 60_000

    return {
      ok: (data.status as string) === 'success' && minutesSince < 90,
      last_ran: data.created_at as string,
      rows_affected: data.rows_affected as number,
      detail:
        minutesSince >= 90 ? `Last ran ${Math.round(minutesSince)} minutes ago (expected < 90)` : undefined,
    }
  } catch (e) {
    return { ok: false, detail: String(e) }
  }
}

async function checkRecentErrors(
  admin: ReturnType<typeof makeAdminClient>,
): Promise<{ count_last_hour: number }> {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await admin
      .from('error_events')
      .select('id', { count: 'exact', head: true })
      .in('level', ['error', 'critical'])
      .gte('created_at', oneHourAgo)
    return { count_last_hour: count ?? 0 }
  } catch {
    return { count_last_hour: -1 }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const admin = makeAdminClient()

  // Detect admin caller for extra detail
  let isAdmin = false
  const authHeader = req.headers.get('Authorization')
  if (authHeader) {
    try {
      const { data } = await admin.auth.getUser(authHeader.replace('Bearer ', ''))
      if (data.user) {
        const { data: profile } = await admin
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single()
        isAdmin = profile?.role === 'admin'
      }
    } catch {
      // Not authenticated — continue without admin detail
    }
  }

  // Run checks in parallel; stripe and cron are admin-only detail
  const [db, auth, stripe, cron, recentErrors] = await Promise.all([
    checkDatabase(admin),
    checkAuth(admin),
    isAdmin ? checkStripe() : Promise.resolve(undefined),
    isAdmin ? checkCron(admin) : Promise.resolve(undefined),
    isAdmin ? checkRecentErrors(admin) : Promise.resolve(undefined),
  ])

  const allOk = db.ok && auth.ok && (stripe === undefined || stripe.ok)
  const status: 'ok' | 'degraded' = allOk ? 'ok' : 'degraded'

  const body: HealthResponse = {
    status,
    generated_at: new Date().toISOString(),
    subsystems: {
      database: db,
      auth,
      realtime: { ok: true, detail: 'Managed by Supabase infrastructure' },
      ...(stripe !== undefined && { stripe }),
      ...(cron !== undefined && { cron }),
      ...(recentErrors !== undefined && { recent_errors: recentErrors }),
    },
  }

  return new Response(JSON.stringify(body, null, 2), {
    status: allOk ? 200 : 503,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
})
