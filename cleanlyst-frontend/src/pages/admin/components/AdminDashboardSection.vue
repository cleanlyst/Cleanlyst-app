<template>
  <main class="flex-grow">
    <div class="max-w-6xl mx-auto">
      <header class="mb-12">
        <h1 class="font-h1 text-h1 text-on-background mb-2">Admin Dashboard</h1>
        <p class="text-secondary">Overview of marketplace performance and operations.</p>
      </header>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-16">
        <div class="bg-surface-container-lowest border border-outline-variant p-padding-card">
          <div class="flex justify-between items-start mb-4">
            <span class="material-symbols-outlined text-primary">group</span>
            <span class="text-caption font-caption bg-surface-container px-2 py-0.5">ACTIVE</span>
          </div>
          <h2 class="font-h2 text-h2 mb-1">
            <span v-if="statsLoading" class="animate-pulse">—</span>
            <span v-else>{{ stats.activeCleaners.toLocaleString() }}</span>
          </h2>
          <p class="text-label-md font-label-md text-secondary">Active Cleaners</p>
          <div class="mt-4 pt-4 border-t border-outline-variant flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-sm">group</span>
            <span class="text-caption font-caption"
              >{{ stats.pendingCleaners }} pending approval</span
            >
          </div>
        </div>

        <div class="bg-surface-container-lowest border border-outline-variant p-padding-card">
          <div class="flex justify-between items-start mb-4">
            <span class="material-symbols-outlined text-primary">group</span>
            <span class="text-caption font-caption bg-surface-container px-2 py-0.5">ACTIVE</span>
          </div>
          <h2 class="font-h2 text-h2 mb-1">
            <span v-if="statsLoading" class="animate-pulse">—</span>
            <span v-else>{{ stats.activeCustomers.toLocaleString() }}</span>
          </h2>
          <p class="text-label-md font-label-md text-secondary">Active Customers</p>
          <div class="mt-4 pt-4 border-t border-outline-variant flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-sm">group</span>
            <span class="text-caption font-caption"
              >{{ stats.pendingCustomers }} new this month</span
            >
          </div>
        </div>

        <div class="bg-surface-container-lowest border border-outline-variant p-padding-card">
          <div class="flex justify-between items-start mb-4">
            <span class="material-symbols-outlined text-primary">calendar_today</span>
            <span class="text-caption font-caption bg-surface-container px-2 py-0.5">ALL TIME</span>
          </div>
          <h2 class="font-h2 text-h2 mb-1">
            <span v-if="statsLoading" class="animate-pulse">—</span>
            <span v-else>{{ stats.totalBookings.toLocaleString() }}</span>
          </h2>
          <p class="text-label-md font-label-md text-secondary">Total Bookings</p>
          <div class="mt-4 pt-4 border-t border-outline-variant flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-sm">calendar_today</span>
            <span class="text-caption font-caption">{{ stats.activeBookings }} active now</span>
          </div>
        </div>

        <div class="bg-surface-container-lowest border border-outline-variant p-padding-card">
          <div class="flex justify-between items-start mb-4">
            <span class="material-symbols-outlined text-primary">payments</span>
            <span class="text-caption font-caption bg-surface-container px-2 py-0.5">GROSS</span>
          </div>
          <h2 class="font-h2 text-h2 mb-1">
            <span v-if="statsLoading" class="animate-pulse">—</span>
            <span v-else>{{ formatPence(stats.totalRevenuePence) }}</span>
          </h2>
          <p class="text-label-md font-label-md text-secondary">Total Revenue</p>
          <div class="mt-4 pt-4 border-t border-outline-variant flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-sm">payments</span>
            <span class="text-caption font-caption"
              >{{ formatPence(stats.pendingPayoutPence) }} pending payout</span
            >
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        <!-- Pending Cleaner Approvals -->
        <section class="lg:col-span-8">
          <div class="bg-surface-container-lowest border border-outline-variant">
            <div class="p-6 border-b border-outline-variant flex justify-between items-center">
              <h2 class="font-label-md text-label-md uppercase tracking-widest text-primary">
                Pending Cleaner Approvals
              </h2>
              <router-link
                :to="{ name: 'AdminApprovals' }"
                class="text-caption font-caption underline"
                >View All</router-link
              >
            </div>

            <div v-if="approvalsLoading" class="p-12 text-center text-secondary text-caption">
              Loading…
            </div>

            <div
              v-else-if="pendingApplications.length === 0"
              class="p-12 text-center text-secondary text-caption"
            >
              No pending applications.
            </div>

            <div v-else class="divide-y divide-outline-variant">
              <div
                v-for="app in pendingApplications.slice(0, 5)"
                :key="app.id"
                class="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 bg-surface-container flex items-center justify-center">
                    <span class="material-symbols-outlined text-secondary">person</span>
                  </div>
                  <div>
                    <h3 class="font-label-md text-label-md text-on-background">
                      {{ app.full_name ?? 'Applicant' }}
                    </h3>
                    <p class="text-caption text-secondary">
                      Applied: {{ formatRelative(app.submitted_at ?? app.updated_at) }}
                      <span v-if="app.city"> • {{ app.city }}</span>
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-2 w-full md:w-auto">
                  <router-link
                    :to="{ name: 'AdminApprovals' }"
                    class="flex-1 md:flex-none px-4 py-2 border border-outline-variant text-label-md font-label-md hover:bg-surface-container transition-colors text-center"
                  >
                    Details
                  </router-link>
                  <button
                    class="flex-1 md:flex-none px-4 py-2 bg-primary text-on-primary text-label-md font-label-md hover:opacity-90 transition-opacity"
                    :disabled="approveLoadingId === app.id"
                    @click="approveApplication(app.id)"
                  >
                    {{ approveLoadingId === app.id ? '…' : 'Approve' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Recent Activity -->
        <section class="lg:col-span-4">
          <div class="bg-surface-container-lowest border border-outline-variant h-full">
            <div class="p-6 border-b border-outline-variant">
              <h2 class="font-label-md text-label-md uppercase tracking-widest text-primary">
                Recent Bookings
              </h2>
            </div>
            <div v-if="recentLoading" class="p-6 text-center text-caption text-secondary">
              Loading…
            </div>
            <div
              v-else-if="recentBookings.length === 0"
              class="p-6 text-center text-caption text-secondary"
            >
              No recent bookings.
            </div>
            <div v-else class="p-6 space-y-6">
              <div v-for="b in recentBookings" :key="b.id" class="flex gap-4">
                <div class="relative">
                  <div class="w-2 h-2 rounded-full bg-primary mt-2"></div>
                </div>
                <div>
                  <p class="text-label-md font-label-md">
                    {{ b.service_title_snapshot ?? 'Booking' }}
                  </p>
                  <p class="text-caption text-secondary">Status: {{ formatStatus(b.status) }}</p>
                  <p class="text-[10px] text-outline mt-1 uppercase font-bold tracking-tighter">
                    {{ formatRelative(b.created_at) }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <p v-if="errorMessage" class="mt-4 text-caption text-red-600">{{ errorMessage }}</p>
    </div>
  </main>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { requireSupabase } from '@/lib/supabase'
import { formatPence, formatRelativeTime, formatStatus } from '@/utils/format'
import { reviewCleanerApplication } from '@/services/adminService'

interface PendingApplication {
  id: string
  full_name: string | null
  city: string | null
  submitted_at: string | null
  updated_at: string
}

interface RecentBooking {
  id: string
  service_title_snapshot: string | null
  status: string
  created_at: string
}

interface PlatformStats {
  activeCleaners: number
  activeCustomers: number
  pendingCustomers: number
  pendingCleaners: number
  totalBookings: number
  activeBookings: number
  totalRevenuePence: number
  pendingPayoutPence: number
}

interface AmountRow {
  amount_cents: number | null
}
interface PayoutRow {
  amount_cents: number | null
  cleaner_id: string | null
}

const statsLoading = ref(true)
const approvalsLoading = ref(true)
const recentLoading = ref(true)
const errorMessage = ref('')
const approveLoadingId = ref<string | null>(null)

const stats = ref<PlatformStats>({
  activeCleaners: 0,
  activeCustomers: 0,
  pendingCleaners: 0,
  pendingCustomers: 0,
  totalBookings: 0,
  activeBookings: 0,
  totalRevenuePence: 0,
  pendingPayoutPence: 0,
})

const pendingApplications = ref<PendingApplication[]>([])
const recentBookings = ref<RecentBooking[]>([])

function formatRelative(value: string | null): string {
  if (!value) return '—'
  return formatRelativeTime(value)
}

onMounted(async () => {
  await Promise.all([loadStats(), loadApprovals(), loadRecentBookings()])
})

async function loadStats() {
  statsLoading.value = true
  try {
    const supabase = requireSupabase()

    const thisMonthStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    ).toISOString()

    const [
      cleanersResult,
      pendingCleanerAppsResult,
      activeCustomersResult,
      newCustomersResult,
      bookingsResult,
      activeResult,
      revenueResult,
      payoutResult,
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'cleaner_active'),
      supabase
        .from('cleaner_applications')
        .select('id', { count: 'exact', head: true })
        .in('status', ['submitted', 'under_review', 'needs_info']),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'customer')
        .gte('created_at', thisMonthStart),
      supabase.from('bookings').select('id', { count: 'exact', head: true }),
      supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .in('status', ['payment_authorized', 'in_progress']),
      supabase.from('payments').select('amount_cents').eq('status', 'captured'),
      supabase
        .from('payouts')
        .select('amount_cents')
        .in('status', ['pending', 'processing', 'released']),
    ])

    stats.value = {
      activeCleaners: cleanersResult.count ?? 0,
      pendingCleaners: pendingCleanerAppsResult.count ?? 0,
      activeCustomers: activeCustomersResult.count ?? 0,
      pendingCustomers: newCustomersResult.count ?? 0,
      totalBookings: bookingsResult.count ?? 0,
      activeBookings: activeResult.count ?? 0,
      totalRevenuePence: ((revenueResult.data ?? []) as AmountRow[]).reduce(
        (s: number, r) => s + (r.amount_cents ?? 0),
        0,
      ),
      pendingPayoutPence: ((payoutResult.data ?? []) as PayoutRow[]).reduce(
        (s: number, r) => s + (r.amount_cents ?? 0),
        0,
      ),
    }
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to load stats.'
  } finally {
    statsLoading.value = false
  }
}

async function loadApprovals() {
  approvalsLoading.value = true
  try {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('cleaner_applications')
      .select(
        `
        id,
        submitted_at,
        updated_at,
        profiles!cleaner_applications_cleaner_id_fkey (
          full_name,
          city
        )
      `,
      )
      .in('status', ['submitted', 'under_review', 'needs_info'])
      .order('updated_at', { ascending: false })
      .limit(5)

    if (error) throw error

    const rows = (data ?? []) as Array<{
      id: string
      submitted_at: string | null
      updated_at: string
      profiles?: {
        full_name?: string | null
        city?: string | null
      } | null
    }>
    pendingApplications.value = rows.map((row) => ({
      id: row.id,
      full_name: row.profiles?.full_name ?? null,
      city: row.profiles?.city ?? null,
      submitted_at: row.submitted_at ?? null,
      updated_at: row.updated_at,
    }))
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to load applications.'
  } finally {
    approvalsLoading.value = false
  }
}

async function loadRecentBookings() {
  recentLoading.value = true
  try {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('bookings')
      .select('id, service_title_snapshot, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5)
    if (error) throw error
    recentBookings.value = (data ?? []) as RecentBooking[]
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to load recent bookings.'
  } finally {
    recentLoading.value = false
  }
}

async function approveApplication(applicationId: string) {
  approveLoadingId.value = applicationId
  try {
    await reviewCleanerApplication(applicationId, 'approved')
    pendingApplications.value = pendingApplications.value.filter((a) => a.id !== applicationId)
    stats.value.pendingCleaners = Math.max(0, stats.value.pendingCleaners - 1)
    stats.value.activeCleaners += 1
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to approve application.'
  } finally {
    approveLoadingId.value = null
  }
}
</script>

<style scoped>
.material-symbols-outlined {
  font-variation-settings:
    'FILL' 0,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
}

.animate-pulse {
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}
</style>
