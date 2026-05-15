<template>
  <div class="bg-background text-on-surface antialiased">
    <main class="flex-grow p-6 lg:p-12 overflow-x-hidden max-w-7xl">
      <header class="mb-12">
        <h1 class="font-h1 text-h1 text-on-surface mb-2">Pending Cleaner Applications</h1>
        <p class="font-body text-body text-on-surface-variant max-w-2xl">
          Review and manage onboarding applications for new service providers.
        </p>
      </header>

      <!-- Search + Filters -->
      <section class="mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div class="relative w-full md:w-96">
          <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
          <input
            v-model="searchQuery"
            class="w-full pl-10 pr-4 h-12 bg-surface-container-lowest border border-outline-variant rounded font-body text-body focus:border-primary focus:ring-0 outline-none"
            placeholder="Search by name or city..."
            type="text"
            @input="onSearchInput"
          />
        </div>

        <div class="flex gap-2 w-full md:w-auto">
          <select
            v-model="statusFilter"
            class="px-4 h-12 bg-surface-container-lowest border border-outline-variant font-label-md text-on-surface rounded hover:bg-surface-variant outline-none"
            @change="loadApplications"
          >
            <option value="">All Statuses</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="needs_info">Needs Info</option>
          </select>

          <select
            v-model="sortOrder"
            class="px-4 h-12 bg-surface-container-lowest border border-outline-variant font-label-md text-on-surface rounded hover:bg-surface-variant outline-none"
            @change="loadApplications"
          >
            <option value="desc">Latest First</option>
            <option value="asc">Oldest First</option>
          </select>
        </div>
      </section>

      <!-- Error -->
      <p v-if="errorMessage" class="mb-4 text-caption text-red-600">{{ errorMessage }}</p>

      <!-- Table -->
      <div class="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
        <table class="w-full text-left border-collapse">
          <thead class="bg-surface-container-low border-b border-outline-variant">
            <tr>
              <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant">Cleaner Profile</th>
              <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant">Location & Date</th>
              <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant hidden md:table-cell">Status</th>
              <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant text-right">Actions</th>
            </tr>
          </thead>

          <tbody class="divide-y divide-outline-variant">
            <tr v-if="loading">
              <td colspan="4" class="px-6 py-12 text-center text-caption text-on-surface-variant">
                Loading applications…
              </td>
            </tr>
            <tr v-else-if="applications.length === 0">
              <td colspan="4" class="px-6 py-12 text-center text-caption text-on-surface-variant">
                No applications found.
              </td>
            </tr>
            <tr
              v-else
              v-for="app in applications"
              :key="app.id"
              class="hover:bg-surface-container-low transition-colors"
            >
              <td class="px-6 py-6">
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 rounded-full overflow-hidden bg-surface-container-high border border-outline-variant flex items-center justify-center">
                    <img
                      v-if="app.avatar_url"
                      :src="app.avatar_url"
                      :alt="app.full_name ?? ''"
                      class="w-full h-full object-cover"
                    />
                    <span v-else class="material-symbols-outlined text-on-surface-variant">person</span>
                  </div>
                  <div>
                    <div class="font-body text-body text-on-surface">{{ app.full_name ?? '—' }}</div>
                    <div class="font-caption text-caption text-on-surface-variant">{{ app.email ?? '—' }}</div>
                  </div>
                </div>
              </td>

              <td class="px-6 py-6">
                <div class="font-body text-body text-on-surface">{{ app.city ?? '—' }}</div>
                <div class="font-caption text-caption text-on-surface-variant">
                  Applied: {{ formatDate(app.submitted_at ?? app.updated_at) }}
                </div>
              </td>

              <td class="px-6 py-6 hidden md:table-cell">
                <span :class="['status-pill', statusPillClass(app.status)]">
                  {{ formatStatus(app.status) }}
                </span>
              </td>

              <td class="px-6 py-6 text-right">
                <div class="flex items-center justify-end gap-2">
                  <button
                    class="px-3 py-1.5 font-label-md text-on-surface bg-surface-container-lowest border border-outline-variant rounded hover:bg-surface-variant transition-colors"
                    @click="openReview(app)"
                  >
                    Review
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Pagination -->
        <div class="px-6 py-4 bg-surface-container-low border-t border-outline-variant flex items-center justify-between">
          <span class="font-caption text-caption text-on-surface-variant">
            Showing {{ applications.length }} of {{ totalCount }} applications
          </span>

          <div class="flex gap-2">
            <button
              class="p-1 border border-outline-variant bg-surface-container-lowest text-on-surface-variant disabled:opacity-40"
              :disabled="page === 1 || loading"
              @click="goToPage(page - 1)"
            >
              <span class="material-symbols-outlined">chevron_left</span>
            </button>

            <button
              class="p-1 border border-outline-variant bg-surface-container-lowest text-on-surface disabled:opacity-40"
              :disabled="applications.length < pageSize || loading"
              @click="goToPage(page + 1)"
            >
              <span class="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Summary Insights -->
      <section class="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="p-padding-card bg-surface-container-lowest border border-outline-variant rounded-lg">
          <div class="font-caption text-caption text-on-surface-variant mb-2">Pending Total</div>
          <div class="font-h1 text-h1 text-on-surface">
            <span v-if="loading" class="animate-pulse">—</span>
            <span v-else>{{ totalCount }}</span>
          </div>
        </div>

        <div class="p-padding-card bg-surface-container-lowest border border-outline-variant rounded-lg">
          <div class="font-caption text-caption text-on-surface-variant mb-2">Submitted</div>
          <div class="font-h1 text-h1 text-on-surface">{{ submittedCount }}</div>
        </div>

        <div class="p-padding-card bg-surface-container-lowest border border-outline-variant rounded-lg">
          <div class="font-caption text-caption text-on-surface-variant mb-2">Under Review</div>
          <div class="font-h1 text-h1 text-on-surface">{{ underReviewCount }}</div>
        </div>
      </section>
    </main>

    <!-- Review Modal -->
    <div v-if="reviewModal" class="modal-backdrop" @click.self="closeReview">
      <div class="modal-box">
        <div class="modal-header">
          <h2 class="font-h2 text-h2">Review Application</h2>
          <button class="modal-close" @click="closeReview">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <div class="modal-body">
          <div class="mb-4">
            <p class="font-label-md text-label-md">{{ reviewModal.full_name }}</p>
            <p class="text-caption text-on-surface-variant">{{ reviewModal.city ?? '—' }}</p>
            <p class="text-caption text-on-surface-variant mt-1">
              Applied: {{ formatDate(reviewModal.submitted_at ?? reviewModal.updated_at) }}
            </p>
          </div>

          <div class="mb-4">
            <label for="review-notes" class="block font-label-md text-label-md mb-1">
              Notes
              <span class="font-caption text-on-surface-variant ml-1">(required for rejection — min 10 chars)</span>
            </label>
            <textarea
              id="review-notes"
              v-model="reviewNotes"
              rows="3"
              class="w-full p-3 border border-outline-variant rounded font-body text-body focus:border-primary focus:ring-0 outline-none"
              placeholder="Optional for approve/needs-info. Required reason for rejection..."
            ></textarea>
          </div>

          <p v-if="reviewError" class="text-caption text-red-600 mb-3">{{ reviewError }}</p>

          <div class="flex gap-3">
            <button
              class="flex-1 py-3 bg-primary text-on-primary font-label-md hover:opacity-90 transition-opacity disabled:opacity-50"
              :disabled="!!reviewLoading"
              @click="submitReview('approved')"
            >
              {{ reviewLoading === 'approved' ? 'Approving…' : 'Approve' }}
            </button>
            <button
              class="flex-1 py-3 border border-red-600 text-red-600 font-label-md hover:bg-red-50 transition-colors disabled:opacity-50"
              :disabled="!!reviewLoading"
              @click="submitReview('rejected')"
            >
              {{ reviewLoading === 'rejected' ? 'Rejecting…' : 'Reject' }}
            </button>
            <button
              class="flex-1 py-3 border border-outline-variant font-label-md hover:bg-surface-container transition-colors disabled:opacity-50"
              :disabled="!!reviewLoading"
              @click="submitReview('needs_info')"
            >
              {{ reviewLoading === 'needs_info' ? '…' : 'Needs Info' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { requireSupabase } from '@/lib/supabase'
import { reviewCleanerApplication } from '@/services/adminService'
import { formatDate, formatStatus } from '@/utils/format'

interface ApplicationRow {
  id: string
  status: string
  submitted_at: string | null
  updated_at: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
  city: string | null
}

const loading = ref(false)
const errorMessage = ref('')
const searchQuery = ref('')
const statusFilter = ref('')
const sortOrder = ref<'asc' | 'desc'>('desc')
const page = ref(1)
const pageSize = 20
const totalCount = ref(0)
const submittedCount = ref(0)
const underReviewCount = ref(0)
const applications = ref<ApplicationRow[]>([])

const reviewModal = ref<ApplicationRow | null>(null)
const reviewNotes = ref('')
const reviewLoading = ref<string | null>(null)
const reviewError = ref('')

let searchTimeout: ReturnType<typeof setTimeout>

onMounted(() => loadApplications())

function onSearchInput() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => { page.value = 1; loadApplications() }, 350)
}

async function loadApplications() {
  loading.value = true
  errorMessage.value = ''
  try {
    const supabase = requireSupabase()

    const statuses = statusFilter.value
      ? [statusFilter.value]
      : ['submitted', 'under_review', 'needs_info']

    let q = supabase
      .from('cleaner_applications')
      .select(`
        id,
        status,
        submitted_at,
        updated_at,
        profiles!cleaner_applications_cleaner_id_fkey (
          full_name,
          avatar_url,
          city
        )
      `, { count: 'exact' })
      .in('status', statuses)
      .order('updated_at', { ascending: sortOrder.value === 'asc' })
      .range((page.value - 1) * pageSize, page.value * pageSize - 1)

    const { data, error, count } = await q
    if (error) throw error

    applications.value = (data ?? []).map((row: any) => ({
      id: row.id,
      status: row.status,
      submitted_at: row.submitted_at ?? null,
      updated_at: row.updated_at,
      full_name: row.profiles?.full_name ?? null,
      email: null,
      avatar_url: row.profiles?.avatar_url ?? null,
      city: row.profiles?.city ?? null,
    })).filter((app: ApplicationRow) => {
      if (!searchQuery.value) return true
      const q = searchQuery.value.toLowerCase()
      return (
        app.full_name?.toLowerCase().includes(q) ||
        app.city?.toLowerCase().includes(q)
      )
    })

    totalCount.value = count ?? 0

    const [sCount, urCount] = await Promise.all([
      supabase.from('cleaner_applications').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
      supabase.from('cleaner_applications').select('id', { count: 'exact', head: true }).eq('status', 'under_review'),
    ])
    submittedCount.value = sCount.count ?? 0
    underReviewCount.value = urCount.count ?? 0
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to load applications.'
  } finally {
    loading.value = false
  }
}

function goToPage(n: number) {
  page.value = n
  loadApplications()
}

function statusPillClass(status: string): string {
  const map: Record<string, string> = {
    submitted: 'pill--pending',
    under_review: 'pill--active',
    needs_info: 'pill--warning',
    approved: 'pill--completed',
    rejected: 'pill--cancelled',
  }
  return map[status] ?? ''
}

function openReview(app: ApplicationRow) {
  reviewModal.value = app
  reviewNotes.value = ''
  reviewError.value = ''
}

function closeReview() {
  reviewModal.value = null
}

async function submitReview(action: 'approved' | 'rejected' | 'needs_info') {
  if (!reviewModal.value) return
  reviewLoading.value = action
  reviewError.value = ''
  try {
    await reviewCleanerApplication(reviewModal.value.id, action, reviewNotes.value || undefined)
    applications.value = applications.value.filter((a) => a.id !== reviewModal.value!.id)
    totalCount.value = Math.max(0, totalCount.value - 1)
    closeReview()
  } catch (e) {
    reviewError.value = e instanceof Error ? e.message : 'Action failed.'
  } finally {
    reviewLoading.value = null
  }
}
</script>

<style scoped>
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

.animate-pulse { animation: pulse 1.5s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

/* Status pills */
.status-pill {
  display: inline-block;
  border-radius: 999px;
  padding: 0.2rem 0.6rem;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}

.pill--pending { background: #fff8e1; color: #e65100; border: 1px solid #ffcc80; }
.pill--active { background: #e3f2fd; color: #1565c0; border: 1px solid #90caf9; }
.pill--warning { background: #fff3e0; color: #bf360c; border: 1px solid #ffcc02; }
.pill--completed { background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7; }
.pill--cancelled { background: #ffebee; color: #c62828; border: 1px solid #ef9a9a; }

/* Modal */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 1rem;
}

.modal-box {
  background: #ffffff;
  border-radius: 0.5rem;
  width: 100%;
  max-width: 28rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--outline-variant, #c4c7c7);
}

.modal-close {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--secondary, #5e5e5e);
  display: flex;
}

.modal-body { padding: 1.5rem; }
</style>
