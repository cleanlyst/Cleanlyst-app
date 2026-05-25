import { computed, ref } from 'vue'
import { requireSupabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

const PAGE_SIZE = 10

export type BookingTab = 'all' | 'pending' | 'active' | 'completed' | 'cancelled'

export const BOOKING_TABS: { key: BookingTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
]

const TAB_STATUSES: Record<BookingTab, string[] | null> = {
  all: null,
  pending: [
    'pending_request',
    'awaiting_customer_payment',
    'payment_authorized',
    'estimate_proposed',
  ],
  active: ['accepted', 'paid_pending_start', 'scheduled', 'in_progress', 'completion_pending_customer'],
  completed: ['completed'],
  cancelled: ['cancelled', 'declined', 'cleaner_declined', 'disputed', 'refunded'],
}

export interface BookingListItem {
  id: string
  service_title_snapshot: string | null
  location_text: string
  scheduled_start: string
  status: string
  payment_status: string | null
  quote_cents: number | null
  requires_additional_payment: boolean
  additional_payment_cents: number | null
  cleaner_name: string | null
  customer_name: string | null
}

interface BookingQueryRow {
  id: string
  status: string
  scheduled_start: string | null
  location_text: string | null
  service_title_snapshot: string | null
  payment_status: string | null
  quote_cents: number | null
  requires_additional_payment: boolean | null
  additional_payment_cents: number | null
  cleaner?: { full_name?: string | null } | null
  customer?: { full_name?: string | null } | null
}

interface ProfileRow {
  id: string
}

export function useBookingList(role: 'customer' | 'cleaner') {
  const auth = useAuthStore()
  const bookings = ref<BookingListItem[]>([])
  const loading = ref(false)
  const error = ref('')
  const page = ref(1)
  const totalCount = ref(0)
  const currentTab = ref<BookingTab>('all')
  const search = ref('')

  const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / PAGE_SIZE)))

  async function fetch() {
    if (!auth.userId) return
    loading.value = true
    error.value = ''
    try {
      const supabase = requireSupabase()
      const start = (page.value - 1) * PAGE_SIZE
      const end = start + PAGE_SIZE - 1
      const term = search.value.trim()

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

      const ownerCol = role === 'customer' ? 'customer_id' : 'cleaner_id'
      const partnerFkCol = role === 'customer' ? 'cleaner_id' : 'customer_id'
      const nameJoin =
        role === 'customer'
          ? 'cleaner:cleaner_id(full_name)'
          : 'customer:customer_id(full_name)'

      let q = supabase
        .from('bookings')
        .select(
          `id, status, scheduled_start, location_text, service_title_snapshot, payment_status, quote_cents, requires_additional_payment, additional_payment_cents, ${nameJoin}`,
          { count: 'exact' },
        )
        .eq(ownerCol, auth.userId)
        .order('scheduled_start', { ascending: false })
        .range(start, end)

      const tabStatuses = TAB_STATUSES[currentTab.value]
      if (tabStatuses) {
        q = q.in('status', tabStatuses)
      }

      if (term) {
        const parts: string[] = [
          `service_title_snapshot.ilike.%${term}%`,
          `status.ilike.%${term}%`,
        ]
        if (matchingProfileIds && matchingProfileIds.length > 0) {
          parts.push(`${partnerFkCol}.in.(${matchingProfileIds.join(',')})`)
        }
        q = q.or(parts.join(','))
      }

      const { data, error: qError, count } = await q
      if (qError) throw qError

      totalCount.value = count ?? 0
      const rows = (data ?? []) as BookingQueryRow[]
      bookings.value = rows.map((row) => ({
        id: row.id,
        service_title_snapshot: row.service_title_snapshot ?? null,
        location_text: row.location_text ?? '',
        scheduled_start: row.scheduled_start ?? '',
        status: row.status,
        payment_status: row.payment_status ?? null,
        quote_cents: row.quote_cents ?? null,
        requires_additional_payment: row.requires_additional_payment ?? false,
        additional_payment_cents: row.additional_payment_cents ?? null,
        cleaner_name: row.cleaner?.full_name ?? null,
        customer_name: row.customer?.full_name ?? null,
      }))
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load bookings.'
    } finally {
      loading.value = false
    }
  }

  function setTab(tab: BookingTab) {
    currentTab.value = tab
    page.value = 1
    fetch()
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

  return {
    bookings,
    loading,
    error,
    page,
    totalPages,
    totalCount,
    currentTab,
    setTab,
    nextPage,
    previousPage,
    setSearch,
    fetch,
  }
}
