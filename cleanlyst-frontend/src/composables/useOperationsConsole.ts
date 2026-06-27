/**
 * useOperationsConsole — search, load, and subscribe to a booking investigation bundle.
 *
 * Supports search by: booking UUID, customer email, cleaner email,
 * Stripe payment intent ID, checkout session ID, transfer ID.
 *
 * Realtime: subscribes to bookings, payment_ledger_events, and payouts channels
 * for the selected booking and reloads the bundle on changes.
 */

import { ref, watch, onUnmounted } from 'vue'
import { useRouter }               from 'vue-router'
import { getSupabaseClient }       from '@/services/supabaseClient'
import { investigateBooking }      from '@/services/payments/paymentInvestigation'
import type { InvestigationBundle } from '@/services/payments/paymentInvestigation'

export interface SearchResult {
  bookingId: string
  hint:      string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PI_RE   = /^pi_/
const CS_RE   = /^cs_/
const TR_RE   = /^tr_/

export function useOperationsConsole() {
  const router   = useRouter()
  const supabase = getSupabaseClient()

  const query          = ref('')
  const searching      = ref(false)
  const searchError    = ref<string | null>(null)
  const searchResults  = ref<SearchResult[]>([])

  const selectedBookingId = ref<string | null>(null)
  const bundle            = ref<InvestigationBundle | null>(null)
  const loading           = ref(false)
  const loadError         = ref<string | null>(null)
  const refreshedAt       = ref<Date | null>(null)

  let realtimeChannel: ReturnType<typeof supabase.channel> | null = null

  // ── Search ─────────────────────────────────────────────────────────────────

  async function search(q: string): Promise<void> {
    const trimmed = q.trim()
    if (!trimmed) { searchResults.value = []; return }

    searching.value  = true
    searchError.value = null
    searchResults.value = []

    try {
      const results: SearchResult[] = []

      if (UUID_RE.test(trimmed)) {
        // Direct booking ID lookup
        const { data } = await supabase
          .from('bookings')
          .select('id, status, created_at')
          .eq('id', trimmed)
          .maybeSingle()
        if (data) results.push({ bookingId: data.id, hint: `Booking · ${data.status} · ${data.created_at?.slice(0, 10)}` })
      } else if (PI_RE.test(trimmed)) {
        // Stripe PaymentIntent ID
        const { data } = await supabase
          .from('payments')
          .select('booking_id')
          .eq('stripe_payment_intent_id', trimmed)
          .limit(5)
        for (const r of data ?? []) results.push({ bookingId: r.booking_id, hint: `Payment Intent ${trimmed}` })
      } else if (CS_RE.test(trimmed)) {
        // Stripe Checkout Session ID
        const { data } = await supabase
          .from('payments')
          .select('booking_id')
          .eq('stripe_checkout_session_id', trimmed)
          .limit(5)
        for (const r of data ?? []) results.push({ bookingId: r.booking_id, hint: `Checkout Session ${trimmed}` })
      } else if (TR_RE.test(trimmed)) {
        // Stripe Transfer / Payout ID
        const { data } = await supabase
          .from('payouts')
          .select('booking_id')
          .eq('stripe_transfer_id', trimmed)
          .limit(5)
        for (const r of data ?? []) results.push({ bookingId: r.booking_id, hint: `Transfer ${trimmed}` })
      } else if (trimmed.includes('@')) {
        // Email — search both customer and cleaner profiles
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .ilike('email', trimmed)
          .limit(10)
        const profileIds = (profiles ?? []).map((p: { id: string }) => p.id)
        if (profileIds.length) {
          const [custRows, cleanerRows] = await Promise.all([
            supabase.from('bookings').select('id, status, customer_id').in('customer_id', profileIds).limit(20),
            supabase.from('bookings').select('id, status, cleaner_id').in('cleaner_id', profileIds).limit(20),
          ])
          const profileMap = new Map((profiles ?? []).map((p: { id: string; email: string; full_name: string }) => [p.id, p]))
          for (const r of custRows.data ?? []) {
            const p = profileMap.get(r.customer_id)
            results.push({ bookingId: r.id, hint: `Customer: ${p?.full_name ?? p?.email ?? r.customer_id} · ${r.status}` })
          }
          for (const r of cleanerRows.data ?? []) {
            const p = profileMap.get(r.cleaner_id)
            results.push({ bookingId: r.id, hint: `Cleaner: ${p?.full_name ?? p?.email ?? r.cleaner_id} · ${r.status}` })
          }
        }
      } else {
        // Name search fallback
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .ilike('full_name', `%${trimmed}%`)
          .limit(10)
        const profileIds = (profiles ?? []).map((p: { id: string }) => p.id)
        if (profileIds.length) {
          const profileMap = new Map((profiles ?? []).map((p: { id: string; email: string; full_name: string }) => [p.id, p]))
          const [custRows, cleanerRows] = await Promise.all([
            supabase.from('bookings').select('id, status, customer_id').in('customer_id', profileIds).limit(20),
            supabase.from('bookings').select('id, status, cleaner_id').in('cleaner_id', profileIds).limit(20),
          ])
          for (const r of custRows.data ?? []) {
            const p = profileMap.get(r.customer_id)
            results.push({ bookingId: r.id, hint: `Customer: ${p?.full_name ?? p?.email ?? r.customer_id} · ${r.status}` })
          }
          for (const r of cleanerRows.data ?? []) {
            const p = profileMap.get(r.cleaner_id)
            results.push({ bookingId: r.id, hint: `Cleaner: ${p?.full_name ?? p?.email ?? r.cleaner_id} · ${r.status}` })
          }
        }
      }

      // Deduplicate by bookingId
      const seen = new Set<string>()
      searchResults.value = results.filter((r) => {
        if (seen.has(r.bookingId)) return false
        seen.add(r.bookingId)
        return true
      })
    } catch (e) {
      searchError.value = e instanceof Error ? e.message : String(e)
    } finally {
      searching.value = false
    }
  }

  // ── Bundle Loading ─────────────────────────────────────────────────────────

  async function loadBundle(bookingId: string): Promise<void> {
    loading.value   = true
    loadError.value = null
    bundle.value    = null

    try {
      bundle.value    = await investigateBooking(bookingId)
      refreshedAt.value = new Date()
      subscribeRealtime(bookingId)
    } catch (e) {
      loadError.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  async function refresh(): Promise<void> {
    if (selectedBookingId.value) await loadBundle(selectedBookingId.value)
  }

  function select(bookingId: string): void {
    selectedBookingId.value = bookingId
    searchResults.value     = []
    query.value             = ''
    router.replace({ params: { bookingId } })
    loadBundle(bookingId)
  }

  function clear(): void {
    unsubscribeRealtime()
    bundle.value            = null
    selectedBookingId.value = null
    loadError.value         = null
    router.replace({ params: {} })
  }

  // ── Realtime ───────────────────────────────────────────────────────────────

  function subscribeRealtime(bookingId: string): void {
    unsubscribeRealtime()
    realtimeChannel = supabase
      .channel(`ops-console:${bookingId}`)
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'bookings',
        filter: `id=eq.${bookingId}`,
      }, () => { refresh() })
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'payment_ledger_events',
        filter: `booking_id=eq.${bookingId}`,
      }, () => { refresh() })
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'payouts',
        filter: `booking_id=eq.${bookingId}`,
      }, () => { refresh() })
      .subscribe()
  }

  function unsubscribeRealtime(): void {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel)
      realtimeChannel = null
    }
  }

  onUnmounted(unsubscribeRealtime)

  // ── Watch route param change ───────────────────────────────────────────────

  watch(
    () => selectedBookingId.value,
    (id) => { if (id && !bundle.value && !loading.value) loadBundle(id) },
  )

  return {
    // Search
    query,
    searching,
    searchError,
    searchResults,
    search,
    // Bundle
    selectedBookingId,
    bundle,
    loading,
    loadError,
    refreshedAt,
    // Actions
    select,
    clear,
    refresh,
  }
}
