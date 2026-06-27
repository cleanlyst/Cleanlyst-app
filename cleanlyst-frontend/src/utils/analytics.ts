/**
 * Privacy-safe analytics event tracker.
 *
 * Events are written to the `analytics_events` Supabase table (RLS:
 * authenticated users insert their own rows; anon inserts are allowed
 * for pre-auth events like PAGE_VIEW on public routes).
 *
 * Rules:
 *   - Never include financial amounts, card details, or PII beyond user_id.
 *   - All amounts must be omitted (use counts, not values).
 *   - user_id is the Supabase auth UID — not email or name.
 *
 * To route events to PostHog / Mixpanel / Plausible in future:
 *   Call the respective SDK after the Supabase insert.
 */

import { correlationId } from './correlationId'
import { getSupabaseClientSafe } from '@/services/supabaseClient'

export type AnalyticsEvent =
  | 'PAGE_VIEW'
  | 'REGISTRATION_STARTED'
  | 'REGISTRATION_COMPLETED'
  | 'CLEANER_ONBOARDING_STARTED'
  | 'CLEANER_ONBOARDING_COMPLETED'
  | 'LOGIN'
  | 'LOGOUT'
  | 'BOOKING_STARTED'
  | 'BOOKING_CLEANER_SELECTED'
  | 'CHECKOUT_STARTED'
  | 'CHECKOUT_COMPLETED'
  | 'BOOKING_CANCELLED'
  | 'REVIEW_SUBMITTED'
  | 'NO_SHOW_REPORTED'
  | 'SEARCH_PERFORMED'
  | 'DASHBOARD_VIEWED'
  | 'PROFILE_UPDATED'
  | 'PASSWORD_CHANGED'

export interface AnalyticsProperties {
  user_id?: string
  role?: string
  page?: string
  booking_id?: string
  search_query_length?: number
  search_results_count?: number
  step?: number
  [key: string]: string | number | boolean | undefined
}

let _userId: string | null = null

export function setAnalyticsUser(userId: string | null) {
  _userId = userId
}

export async function track(
  event: AnalyticsEvent,
  properties: AnalyticsProperties = {},
): Promise<void> {
  try {
    const supabase = getSupabaseClientSafe()
    if (!supabase) return

    // Sanitise — drop undefined values and anything that looks like a secret
    const safeProps: Record<string, string | number | boolean> = {}
    for (const [k, v] of Object.entries(properties)) {
      if (v === undefined) continue
      if (/secret|key|token|password|card|cvv|stripe_sk/i.test(k)) continue
      safeProps[k] = v
    }

    await supabase.from('analytics_events').insert({
      event,
      user_id: _userId ?? properties.user_id ?? null,
      correlation_id: correlationId,
      properties: Object.keys(safeProps).length > 0 ? safeProps : null,
    })
  } catch {
    // Analytics must never break the UI
  }
}

export function trackPageView(page: string, userId?: string) {
  void track('PAGE_VIEW', { page, user_id: userId })
}
