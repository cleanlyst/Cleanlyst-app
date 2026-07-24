import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2'

// ── CORS ──────────────────────────────────────────────────────────────────────
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── RESPONSE HELPERS ──────────────────────────────────────────────────────────
export const ok = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

export const err = (status: number, message: string): Response =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

// ── ENV ───────────────────────────────────────────────────────────────────────
export function env(name: string): string {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

// ── SUPABASE CLIENTS ──────────────────────────────────────────────────────────
// Admin client: bypasses RLS — use for writes triggered by Edge Functions.
export function makeAdminClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))
}

// User client: respects RLS and populates auth.uid() from the caller's JWT.
// Required when calling security-definer RPCs that check auth.uid() internally.
export function makeUserClient(authHeader: string): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authHeader } },
  })
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
export type UserRole = 'customer' | 'cleaner_pending' | 'cleaner_active' | 'admin'

export interface AuthCtx {
  userId: string
  role: UserRole
  uc: SupabaseClient // user-scoped client (auth.uid() populated)
}

/**
 * Validates the Bearer token, loads the profile row, and returns an AuthCtx.
 * Returns an error Response on failure so callers can do:
 *   const auth = await getAuthCtx(...)
 *   if (auth instanceof Response) return auth
 */
export async function getAuthCtx(
  authHeader: string | null,
  admin: SupabaseClient,
): Promise<AuthCtx | Response> {
  if (!authHeader) return err(401, 'Missing authorization header')

  const uc = makeUserClient(authHeader)
  const { data, error } = await uc.auth.getUser()
  if (error || !data.user) return err(401, 'Unauthorized')

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single()

  if (profileError || !profile) return err(401, 'Profile not found')

  return { userId: data.user.id, role: profile.role as UserRole, uc }
}

/**
 * Like getAuthCtx but additionally enforces the caller has one of the given roles.
 */
export async function requireRole(
  authHeader: string | null,
  admin: SupabaseClient,
  ...roles: UserRole[]
): Promise<AuthCtx | Response> {
  const ctx = await getAuthCtx(authHeader, admin)
  if (ctx instanceof Response) return ctx
  if (!roles.includes(ctx.role)) {
    return err(403, `Access denied — requires role: ${roles.join(' or ')}`)
  }
  return ctx
}

// ── STRIPE ────────────────────────────────────────────────────────────────────
export async function stripePost(
  path: string,
  params: URLSearchParams,
  idempotencyKey?: string,
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${env('STRIPE_SECRET_KEY')}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  }
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey

  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers,
    body: params.toString(),
  })
  if (!res.ok) throw new Error(`Stripe [${res.status}]: ${await res.text()}`)
  return res.json()
}

export async function stripeGet(path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${env('STRIPE_SECRET_KEY')}` },
  })
  if (!res.ok) throw new Error(`Stripe [${res.status}]: ${await res.text()}`)
  return res.json()
}
