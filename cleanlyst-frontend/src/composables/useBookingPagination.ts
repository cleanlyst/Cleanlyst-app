import { computed, ref } from 'vue'
import { requireSupabase } from '@/lib/supabase'

const PAGE_SIZE = 10

export interface PaginatedBooking {
  id: string
  status: string
  scheduled_start: string | null
  scheduled_end: string | null
  service_title_snapshot: string | null
  quote_cents: number
  customer_name: string | null
  cleaner_name: string | null
}

interface BookingQueryRow {
  id: string
  status: string
  scheduled_start: string | null
  scheduled_end: string | null
  service_title_snapshot: string | null
  quote_cents: number | null
  customer?: { full_name?: string | null } | null
  cleaner?: { full_name?: string | null } | null
}

interface ProfileRow {
  id: string
}

export function useBookingPagination() {
  const bookings = ref<PaginatedBooking[]>([])
  const loading = ref(false)
  const error = ref('')
  const page = ref(1)
  const totalCount = ref(0)
  const search = ref('')
  const statusFilter = ref('')

  const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / PAGE_SIZE)))

  async function fetch() {
    loading.value = true
    error.value = ''
    try {
      const supabase = requireSupabase()
      const term = search.value.trim()
      const start = (page.value - 1) * PAGE_SIZE
      const end = start + PAGE_SIZE - 1

      // Pre-query: resolve profile IDs matching the search term (for name search)
      let matchingProfileIds: string[] | null = null
      if (term) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id')
          .ilike('full_name', `%${term}%`)
        if (profiles && profiles.length > 0) {
          matchingProfileIds = (profiles as ProfileRow[]).map((p) => p.id)
        }
      }

      let q = supabase
        .from('bookings')
        .select(
          `id, status, scheduled_start, scheduled_end,
           service_title_snapshot, quote_cents,
           customer:customer_id(full_name),
           cleaner:cleaner_id(full_name)`,
          { count: 'exact' },
        )
        .order('created_at', { ascending: false })
        .range(start, end)

      // Status filter — 'pending_request' tab covers several statuses
      if (statusFilter.value === 'pending_request') {
        q = q.in('status', ['pending_request', 'awaiting_customer_payment', 'payment_authorized'])
      } else if (statusFilter.value) {
        q = q.eq('status', statusFilter.value)
      }

      // Search filter across direct columns + profile FK lookups
      if (term) {
        const parts: string[] = [
          `service_title_snapshot.ilike.%${term}%`,
          `id.ilike.%${term}%`,
          `status.ilike.%${term}%`,
        ]
        if (matchingProfileIds && matchingProfileIds.length > 0) {
          parts.push(`customer_id.in.(${matchingProfileIds.join(',')})`)
          parts.push(`cleaner_id.in.(${matchingProfileIds.join(',')})`)
        }
        q = q.or(parts.join(','))
      }

      const { data, error: qError, count } = await q
      if (qError) throw qError

      totalCount.value = count ?? 0
      const rows = (data ?? []) as BookingQueryRow[]
      bookings.value = rows.map((row) => ({
        id: row.id,
        status: row.status,
        scheduled_start: row.scheduled_start ?? null,
        scheduled_end: row.scheduled_end ?? null,
        service_title_snapshot: row.service_title_snapshot ?? null,
        quote_cents: row.quote_cents ?? 0,
        customer_name: row.customer?.full_name ?? null,
        cleaner_name: row.cleaner?.full_name ?? null,
      }))
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load bookings.'
    } finally {
      loading.value = false
    }
  }

  function nextPage() {
    if (page.value < totalPages.value) {
      page.value++
      fetch()
    }
  }

  function previousPage() {
    if (page.value > 1) {
      page.value--
      fetch()
    }
  }

  function setSearch(value: string) {
    search.value = value
    page.value = 1
    fetch()
  }

  function setStatus(value: string) {
    statusFilter.value = value
    page.value = 1
    fetch()
  }

  return {
    bookings,
    loading,
    error,
    page,
    totalPages,
    totalCount,
    nextPage,
    previousPage,
    setSearch,
    setStatus,
    fetch,
  }
}
