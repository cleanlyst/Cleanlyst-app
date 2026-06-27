<template>
  <div class="bg-background text-on-background antialiased">
    <main class="flex-grow p-6 lg:p-12 overflow-x-hidden max-w-7xl">
      <!-- Header -->
      <section class="space-y-2 mb-8">
        <h1 class="font-h1 text-h1 text-primary">Booking Audit</h1>
        <p class="font-body text-body text-secondary">
          Full audit trail of every booking state transition.
        </p>
      </section>

      <!-- Search -->
      <div class="search-row mb-6">
        <input
          v-model="searchTerm"
          type="text"
          class="search-input"
          placeholder="Search by booking ID (paste full or partial UUID)…"
          @input="onSearchInput"
        />
        <button v-if="searchTerm" type="button" class="search-clear" @click="clearSearch">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <p v-if="error" class="mb-6 text-caption text-red-600">{{ error }}</p>

      <!-- Table -->
      <section class="mb-4">
        <div class="overflow-x-auto border border-outline-variant bg-surface-container-lowest">
          <table class="w-full text-left text-sm">
            <thead>
              <tr class="bg-surface-container border-b border-outline-variant text-secondary">
                <th class="px-4 py-3 font-label-md text-label-md whitespace-nowrap">Booking ID</th>
                <th class="px-4 py-3 font-label-md text-label-md whitespace-nowrap">From</th>
                <th class="px-4 py-3 font-label-md text-label-md whitespace-nowrap">To</th>
                <th class="px-4 py-3 font-label-md text-label-md whitespace-nowrap">Actor</th>
                <th class="px-4 py-3 font-label-md text-label-md whitespace-nowrap">Role</th>
                <th class="px-4 py-3 font-label-md text-label-md whitespace-nowrap">Notes</th>
                <th class="px-4 py-3 font-label-md text-label-md whitespace-nowrap">Timestamp</th>
              </tr>
            </thead>

            <tbody class="divide-y divide-outline-variant">
              <tr v-if="loading">
                <td colspan="7" class="px-4 py-12 text-center text-caption text-secondary">Loading…</td>
              </tr>
              <tr v-else-if="visibleRows.length === 0">
                <td colspan="7" class="px-4 py-12 text-center text-caption text-secondary">
                  No audit events found.
                </td>
              </tr>
              <tr
                v-else
                v-for="row in visibleRows"
                :key="row.id"
                class="hover:bg-surface-container-low transition-colors"
              >
                <td class="px-4 py-3 font-mono text-xs text-secondary whitespace-nowrap">
                  <router-link
                    :to="{ name: 'AdminBookingDetails', params: { bookingId: row.booking_id } }"
                    class="hover:underline text-primary"
                  >
                    {{ row.booking_id.slice(0, 8) }}…
                  </router-link>
                </td>
                <td class="px-4 py-3 text-body text-secondary whitespace-nowrap">
                  <span v-if="row.from_status" :class="['status-chip', pillClass(row.from_status)]">
                    {{ statusLabel(row.from_status) }}
                  </span>
                  <span v-else class="text-secondary">—</span>
                </td>
                <td class="px-4 py-3 text-body text-primary whitespace-nowrap">
                  <span :class="['status-chip', pillClass(row.to_status)]">
                    {{ statusLabel(row.to_status) }}
                  </span>
                </td>
                <td class="px-4 py-3 text-body text-secondary whitespace-nowrap">
                  {{ row.actor_name ?? '—' }}
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <span v-if="row.actor_role" :class="['role-chip', `role-chip--${row.actor_role}`]">
                    {{ row.actor_role }}
                  </span>
                  <span v-else class="text-secondary">—</span>
                </td>
                <td class="px-4 py-3 text-body text-secondary max-w-[220px] truncate" :title="row.notes ?? ''">
                  {{ row.notes ?? '—' }}
                </td>
                <td class="px-4 py-3 font-mono text-xs text-secondary whitespace-nowrap">
                  {{ formatDateTime(row.created_at) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Pagination -->
      <div class="pagination-row">
        <span class="pagination-info">
          {{ paginationInfo }}
        </span>
        <div class="pagination-btns">
          <button
            type="button"
            class="pagination-btn"
            :disabled="page === 1"
            @click="prevPage"
          >
            <span class="material-symbols-outlined">chevron_left</span>
          </button>
          <button
            type="button"
            class="pagination-btn"
            :disabled="!hasNextPage"
            @click="nextPage"
          >
            <span class="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { getSupabaseClient } from '@/services/supabaseClient'
import { formatDateTime, toUserMessage } from '@/utils/format'
import { getBookingStatusLabel, getStatusPillClass } from '@/utils/bookingStatusLabel'

interface AuditEvent {
  id: string
  booking_id: string
  from_status: string | null
  to_status: string
  actor_id: string | null
  actor_role: string | null
  actor_name: string | null
  notes: string | null
  created_at: string
}

const PAGE_SIZE = 50

const rows = ref<AuditEvent[]>([])
const loading = ref(true)
const error = ref('')
const page = ref(1)
const totalCount = ref(0)
const searchTerm = ref('')
let searchTimeout: ReturnType<typeof setTimeout> | null = null

const hasNextPage = computed(() => page.value * PAGE_SIZE < totalCount.value)

const visibleRows = computed(() => {
  if (!searchTerm.value.trim()) return rows.value
  const term = searchTerm.value.trim().toLowerCase()
  return rows.value.filter((r) => r.booking_id.toLowerCase().startsWith(term))
})

const paginationInfo = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE + 1
  const end = Math.min(page.value * PAGE_SIZE, totalCount.value)
  return totalCount.value > 0 ? `${start}–${end} of ${totalCount.value}` : '0 records'
})

function statusLabel(status: string): string {
  return getBookingStatusLabel({ status }, 'admin')
}

function pillClass(status: string): string {
  return getStatusPillClass(status)
}

function onSearchInput() {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    if (!searchTerm.value.trim()) {
      loadEvents()
    }
  }, 400)
}

function clearSearch() {
  searchTerm.value = ''
  loadEvents()
}

async function loadEvents() {
  loading.value = true
  error.value = ''
  try {
    const supabase = getSupabaseClient()
    const offset = (page.value - 1) * PAGE_SIZE

    const query = supabase
      .from('booking_status_events')
      .select(
        'id, booking_id, from_status, to_status, actor_id, actor_role, notes, created_at, actor:profiles!actor_id(full_name)',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    const { data, error: err, count } = await query

    if (err) throw err

    totalCount.value = count ?? 0

    rows.value = ((data ?? []) as unknown[]).map((raw): AuditEvent => {
      const row = raw as Record<string, unknown>
      const actorRaw = row.actor
      const actor = (Array.isArray(actorRaw) ? actorRaw[0] : actorRaw) as Record<string, unknown> | null
      return {
        id: String(row.id ?? ''),
        booking_id: String(row.booking_id ?? ''),
        from_status: row.from_status ? String(row.from_status) : null,
        to_status: String(row.to_status ?? ''),
        actor_id: row.actor_id ? String(row.actor_id) : null,
        actor_role: row.actor_role ? String(row.actor_role) : null,
        actor_name: actor?.full_name ? String(actor.full_name) : null,
        notes: row.notes ? String(row.notes) : null,
        created_at: String(row.created_at ?? ''),
      }
    })
  } catch (e) {
    error.value = toUserMessage(e, 'Failed to load audit events. Please refresh.')
  } finally {
    loading.value = false
  }
}

function prevPage() {
  if (page.value > 1) {
    page.value--
  }
}

function nextPage() {
  if (hasNextPage.value) {
    page.value++
  }
}

watch(page, loadEvents)
onMounted(loadEvents)
</script>

<style scoped>
.search-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  max-width: 36rem;
}

.search-input {
  flex: 1;
  border: 1px solid var(--outline-variant, #c4c7c7);
  padding: 0.625rem 0.875rem;
  font-size: 14px;
  color: var(--primary, #000000);
  background: #ffffff;
}

.search-input:focus {
  outline: none;
  border-color: var(--primary, #000000);
}

.search-clear {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--secondary, #5e5e5e);
  display: flex;
  padding: 0.25rem;
}

.search-clear .material-symbols-outlined {
  font-size: 1.125rem;
}

.status-chip {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  text-transform: uppercase;
  white-space: nowrap;
}

.status-chip.status-pill--pending {
  background: #fff8e1;
  color: #e65100;
  border: 1px solid #ffcc02;
}

.status-chip.status-pill--active {
  background: #e3f2fd;
  color: #1565c0;
  border: 1px solid #90caf9;
}

.status-chip.status-pill--completed {
  background: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #a5d6a7;
}

.status-chip.status-pill--cancelled {
  background: #ffebee;
  color: #c62828;
  border: 1px solid #ef9a9a;
}

.role-chip {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  text-transform: capitalize;
  white-space: nowrap;
  background: var(--surface-container, #eeeeee);
  color: var(--secondary, #5e5e5e);
}

.role-chip--admin {
  background: #ede7f6;
  color: #4527a0;
}

.role-chip--system {
  background: #e8eaf6;
  color: #283593;
}

.role-chip--cleaner {
  background: #e0f2f1;
  color: #00695c;
}

.role-chip--customer {
  background: #fff3e0;
  color: #bf360c;
}

.pagination-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 1rem;
}

.pagination-info {
  font-size: 13px;
  color: var(--secondary, #5e5e5e);
}

.pagination-btns {
  display: flex;
  gap: 0.25rem;
}

.pagination-btn {
  background: transparent;
  border: 1px solid var(--outline-variant, #c4c7c7);
  padding: 0.375rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  color: var(--primary, #000000);
}

.pagination-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pagination-btn .material-symbols-outlined {
  font-size: 1.125rem;
}
</style>
