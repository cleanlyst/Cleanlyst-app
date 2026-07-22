/**
 * Membership Service — customer membership lifecycle for Cleanlyst.
 *
 * ARCHITECTURE
 * ────────────
 * Cleanlyst moved from a per-transaction marketplace to a membership-based
 * trusted network (Phase M). Customers pay a recurring membership fee to
 * access fully vetted cleaners. Booking permissions require membership_status
 * in ('active', 'complimentary').
 *
 * MEMBERSHIP TIERS
 * ────────────────
 * FREE        — can browse cleaners, see approximate pricing, overall rating
 * MEMBER      — full profile, reviews, availability, booking, recurring bookings
 * COMPLIMENTARY — admin-granted full access, no payment required
 *
 * PAYMENT
 * ───────
 * Membership billing is handled by Stripe Subscriptions (future phase).
 * Admin can grant complimentary memberships immediately via admin_grant_membership RPC.
 */

import { getSupabaseClient } from '@/services/supabaseClient'
import type { CustomerMembership, MembershipPlan, MembershipStatus } from '@cleanlyst-backend/types/database.types'

// ── Customer-facing functions ─────────────────────────────────────────────────

/**
 * Returns the calling customer's membership record, or null if none exists.
 * Call ensure_customer_membership() first if you need a guaranteed row.
 */
export async function getMyMembership(): Promise<CustomerMembership | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('get_my_membership')
  if (error) throw new Error(error.message)
  return data ?? null
}

/**
 * Creates a free membership record if one doesn't exist, then returns it.
 * Call on first customer dashboard load to ensure the row is always present.
 */
export async function ensureCustomerMembership(): Promise<CustomerMembership> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('ensure_customer_membership')
  if (error) throw new Error(error.message)
  return data as CustomerMembership
}

/**
 * Returns true if the calling user's membership is active or complimentary.
 * Lightweight — uses the is_member() DB function.
 */
export async function checkIsMember(): Promise<boolean> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('is_member')
  if (error) throw new Error(error.message)
  return data ?? false
}

/**
 * Returns all active membership plans, ordered by sort_order.
 */
export async function getMembershipPlans(): Promise<MembershipPlan[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('membership_plans')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as MembershipPlan[]
}

// ── Admin functions ───────────────────────────────────────────────────────────

export interface AdminMemberRow {
  membership_id: string
  customer_id: string
  customer_name: string | null
  customer_email: string
  plan_name: string | null
  status: MembershipStatus
  current_period_end: string | null
  created_at: string
}

/**
 * Admin: returns paginated list of members, optionally filtered by status.
 */
export async function adminListMembers(
  status?: MembershipStatus | null,
  limit = 50,
  offset = 0,
): Promise<AdminMemberRow[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('admin_list_members', {
    p_status: status ?? null,
    p_limit:  limit,
    p_offset: offset,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as AdminMemberRow[]
}

/**
 * Admin: grants a complimentary membership to a customer.
 */
export async function adminGrantMembership(
  customerId: string,
  planId: string | null,
  reason?: string,
  notes?: string,
): Promise<CustomerMembership> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('admin_grant_membership', {
    p_customer_id: customerId,
    p_plan_id:     planId,
    p_reason:      reason ?? null,
    p_notes:       notes ?? null,
  })
  if (error) throw new Error(error.message)
  return data as CustomerMembership
}

/**
 * Admin: cancels a customer's membership.
 */
export async function adminCancelMembership(
  customerId: string,
  reason?: string,
): Promise<CustomerMembership> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('admin_cancel_membership', {
    p_customer_id: customerId,
    p_reason:      reason ?? null,
  })
  if (error) throw new Error(error.message)
  return data as CustomerMembership
}

/**
 * Admin: pauses a customer's membership.
 */
export async function adminPauseMembership(
  customerId: string,
  reason?: string,
): Promise<CustomerMembership> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('admin_pause_membership', {
    p_customer_id: customerId,
    p_reason:      reason ?? null,
  })
  if (error) throw new Error(error.message)
  return data as CustomerMembership
}

/**
 * Admin: reactivates a paused or cancelled membership.
 */
export async function adminReactivateMembership(
  customerId: string,
  planId?: string | null,
  notes?: string,
): Promise<CustomerMembership> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('admin_reactivate_membership', {
    p_customer_id: customerId,
    p_plan_id:     planId ?? null,
    p_notes:       notes ?? null,
  })
  if (error) throw new Error(error.message)
  return data as CustomerMembership
}

/**
 * Admin: creates or updates a membership plan.
 * Pass p_id to update an existing plan; omit to create a new one.
 */
export async function adminUpsertMembershipPlan(params: {
  id?: string | null
  name?: string
  description?: string | null
  pricePence?: number
  billingInterval?: 'monthly' | 'annual'
  stripePriceId?: string | null
  active?: boolean
  sortOrder?: number
}): Promise<MembershipPlan> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('admin_upsert_membership_plan', {
    p_id:               params.id ?? null,
    p_name:             params.name ?? null,
    p_description:      params.description ?? null,
    p_price_pence:      params.pricePence ?? null,
    p_billing_interval: params.billingInterval ?? null,
    p_stripe_price_id:  params.stripePriceId ?? null,
    p_active:           params.active ?? null,
    p_sort_order:       params.sortOrder ?? null,
  })
  if (error) throw new Error(error.message)
  return data as MembershipPlan
}

/**
 * Admin: loads all membership plans (including inactive).
 */
export async function adminGetAllPlans(): Promise<MembershipPlan[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('membership_plans')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as MembershipPlan[]
}
