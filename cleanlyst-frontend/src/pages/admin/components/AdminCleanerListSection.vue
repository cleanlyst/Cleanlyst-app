<template>
  <div class="bg-background text-on-surface antialiased mt-16">
    <header class="mb-8">
      <h2 class="font-h1 text-h1 text-on-surface mb-2">All Cleaners</h2>
      <p class="font-body text-body text-on-surface-variant max-w-2xl">
        Manage every approved, suspended, and deactivated cleaner on the platform.
      </p>
    </header>

    <!-- Search + Filters -->
    <section class="mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
      <div class="relative w-full md:w-96">
        <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
        <input
          v-model="searchQuery"
          data-testid="cleaner-search-input"
          class="w-full pl-10 pr-4 h-12 bg-surface-container-lowest border border-outline-variant rounded font-body text-body focus:border-primary focus:ring-0 outline-none"
          placeholder="Name, email, city…"
          type="text"
          @input="onSearchInput"
        />
      </div>

      <div class="flex gap-2 w-full md:w-auto">
        <select
          v-model="statusFilter"
          data-testid="cleaner-status-filter"
          class="px-4 h-12 bg-surface-container-lowest border border-outline-variant font-label-md text-on-surface rounded hover:bg-surface-variant outline-none"
          @change="loadCleaners"
        >
          <option value="">All Statuses</option>
          <option value="approved">Approved</option>
          <option value="suspended">Suspended</option>
          <option value="deactivated">Deactivated</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
    </section>

    <p v-if="errorMessage" class="mb-4 text-caption text-red-600">{{ errorMessage }}</p>

    <!-- Table -->
    <div class="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
      <div v-if="loading" class="p-12 flex justify-center">
        <div class="w-8 h-8 border-2 border-outline-variant border-t-primary rounded-full animate-spin"></div>
      </div>

      <div v-else-if="cleaners.length === 0" class="p-12 text-center text-on-surface-variant font-body text-body">
        No cleaners found.
      </div>

      <div v-else class="overflow-x-auto">
      <table class="w-full text-left border-collapse min-w-[600px]">
        <thead class="bg-surface-container-low border-b border-outline-variant">
          <tr>
            <th class="px-4 py-4 font-label-md text-label-md text-on-surface-variant">Cleaner</th>
            <th class="px-4 py-4 font-label-md text-label-md text-on-surface-variant hidden md:table-cell">Location</th>
            <th class="px-4 py-4 font-label-md text-label-md text-on-surface-variant hidden lg:table-cell">Status</th>
            <th class="px-4 py-4 font-label-md text-label-md text-on-surface-variant hidden lg:table-cell">Availability</th>
            <th class="px-4 py-4 font-label-md text-label-md text-on-surface-variant hidden xl:table-cell">Bookings</th>
            <th class="px-4 py-4 font-label-md text-label-md text-on-surface-variant hidden xl:table-cell">Earnings</th>
            <th class="px-4 py-4 font-label-md text-label-md text-on-surface-variant text-right w-48">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-outline-variant">
          <tr
            v-for="cleaner in cleaners"
            :key="cleaner.user_id"
            :data-testid="`cleaner-row-${cleaner.user_id}`"
            class="hover:bg-surface-container-low transition-colors"
          >
            <!-- Avatar + name + email -->
            <td class="px-4 py-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full overflow-hidden bg-surface-container flex-shrink-0 flex items-center justify-center">
                  <img v-if="cleaner.avatar_url" :src="cleaner.avatar_url" :alt="cleaner.full_name" class="w-full h-full object-cover" />
                  <span v-else class="material-symbols-outlined text-on-surface-variant text-xl">person</span>
                </div>
                <div>
                  <p class="font-label-md text-label-md text-on-surface">
                    {{ cleaner.business_name ?? cleaner.full_name }}
                  </p>
                  <p class="text-caption font-caption text-on-surface-variant">{{ cleaner.email }}</p>
                  <div class="flex items-center gap-1 mt-0.5">
                    <span class="material-symbols-outlined text-amber-500" style="font-size:13px;font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 20">star</span>
                    <span class="text-caption font-caption text-on-surface-variant">{{ cleaner.average_rating.toFixed(1) }} ({{ cleaner.review_count }})</span>
                  </div>
                </div>
              </div>
            </td>

            <!-- City -->
            <td class="px-4 py-4 hidden md:table-cell">
              <span class="font-body text-body text-on-surface">{{ cleaner.city ?? '—' }}</span>
            </td>

            <!-- Status chips -->
            <td class="px-4 py-4 hidden lg:table-cell">
              <div class="flex flex-col gap-1">
                <span :class="statusPillClass(cleaner.cleaner_status)" class="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full w-fit">
                  {{ cleaner.cleaner_status }}
                </span>
                <span :class="cleaner.documents_verified ? 'text-green-700 bg-green-50' : 'text-amber-700 bg-amber-50'" class="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full w-fit">
                  {{ cleaner.documents_verified ? 'Docs verified' : 'Docs pending' }}
                </span>
                <span :class="cleaner.is_active ? 'text-blue-700 bg-blue-50' : 'text-red-700 bg-red-50'" class="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full w-fit">
                  {{ cleaner.is_active ? 'Active' : 'Inactive' }}
                </span>
              </div>
            </td>

            <!-- Availability -->
            <td class="px-4 py-4 hidden lg:table-cell">
              <span :class="cleaner.has_availability ? 'text-green-700' : 'text-on-surface-variant'" class="font-caption text-caption">
                {{ cleaner.has_availability ? 'Configured' : 'Not set' }}
              </span>
            </td>

            <!-- Bookings -->
            <td class="px-4 py-4 hidden xl:table-cell">
              <p class="font-label-md text-label-md text-on-surface">{{ cleaner.total_bookings }}</p>
              <p class="text-caption font-caption text-on-surface-variant">{{ cleaner.completed_bookings }} completed</p>
            </td>

            <!-- Earnings -->
            <td class="px-4 py-4 hidden xl:table-cell">
              <span class="font-label-md text-label-md text-on-surface">
                {{ formatPence(cleaner.total_earnings_cents) }}
              </span>
            </td>

            <!-- Actions -->
            <td class="px-4 py-4 text-right w-48">
              <div class="flex flex-col items-end gap-2">
                <button
                  class="px-3 py-1.5 text-xs font-medium border border-outline-variant text-on-surface hover:bg-surface-container transition-colors whitespace-nowrap"
                  :data-testid="`view-profile-${cleaner.user_id}`"
                  @click="openProfile(cleaner)"
                >
                  View
                </button>
                <button
                  v-if="cleaner.cleaner_status === 'suspended'"
                  class="px-3 py-1.5 text-xs font-medium border border-green-600 text-green-700 hover:bg-green-50 transition-colors whitespace-nowrap"
                  :data-testid="`reactivate-${cleaner.user_id}`"
                  @click="openReactivate(cleaner)"
                >
                  Reactivate
                </button>
                <button
                  v-if="cleaner.cleaner_status !== 'suspended' && cleaner.cleaner_status !== 'deactivated'"
                  class="px-3 py-1.5 text-xs font-medium border border-amber-600 text-amber-700 hover:bg-amber-50 transition-colors whitespace-nowrap"
                  :data-testid="`suspend-${cleaner.user_id}`"
                  @click="openSuspend(cleaner)"
                >
                  Suspend
                </button>
                <button
                  v-if="cleaner.cleaner_status !== 'deactivated'"
                  class="px-3 py-1.5 text-xs font-medium border border-red-600 text-red-700 hover:bg-red-50 transition-colors whitespace-nowrap"
                  :data-testid="`deactivate-${cleaner.user_id}`"
                  @click="openDeactivate(cleaner)"
                >
                  Deactivate
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="mt-4 flex items-center justify-between">
      <p class="text-caption font-caption text-on-surface-variant">
        Showing {{ (page - 1) * PAGE_SIZE + 1 }}–{{ Math.min(page * PAGE_SIZE, total) }} of {{ total }}
      </p>
      <div class="flex gap-2">
        <button
          class="px-4 py-2 border border-outline-variant text-label-md disabled:opacity-40 hover:bg-surface-container transition-colors"
          :disabled="page <= 1 || loading"
          @click="goToPage(page - 1)"
        >
          Previous
        </button>
        <button
          class="px-4 py-2 border border-outline-variant text-label-md disabled:opacity-40 hover:bg-surface-container transition-colors"
          :disabled="page >= totalPages || loading"
          @click="goToPage(page + 1)"
        >
          Next
        </button>
      </div>
    </div>
  </div>

  <!-- ── Suspend Modal ─────────────────────────────────── -->
  <div v-if="suspendModal.open" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="closeSuspend">
    <div class="bg-white rounded-lg w-full max-w-md shadow-2xl">
      <div class="flex items-center justify-between p-6 border-b border-outline-variant">
        <h3 class="font-h2 text-h2 text-on-surface">Suspend Cleaner</h3>
        <button class="text-on-surface-variant hover:text-on-surface" :disabled="suspendModal.loading" @click="closeSuspend">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="p-6 space-y-4">
        <p class="font-body text-body text-on-surface">
          You are about to suspend <strong>{{ suspendModal.cleaner?.business_name ?? suspendModal.cleaner?.full_name }}</strong>.
          They will be removed from customer search and cannot receive new bookings. This action can be reversed.
        </p>
        <div>
          <label class="block font-label-md text-label-md text-on-surface mb-2">Reason (optional)</label>
          <textarea
            v-model="suspendModal.reason"
            class="w-full p-3 border border-outline-variant font-body text-body focus:border-primary focus:ring-0 outline-none resize-none"
            rows="3"
            placeholder="Provide a reason visible to the cleaner…"
          />
        </div>
        <p v-if="suspendModal.error" class="text-caption text-red-600">{{ suspendModal.error }}</p>
      </div>
      <div class="flex justify-end gap-3 p-6 border-t border-outline-variant">
        <button class="px-4 py-2 border border-outline-variant font-label-md hover:bg-surface-container" :disabled="suspendModal.loading" @click="closeSuspend">Cancel</button>
        <button
          class="px-4 py-2 bg-amber-600 text-white font-label-md disabled:opacity-50 hover:bg-amber-700"
          data-testid="confirm-suspend-btn"
          :disabled="suspendModal.loading"
          @click="confirmSuspend"
        >
          {{ suspendModal.loading ? 'Suspending…' : 'Confirm Suspend' }}
        </button>
      </div>
    </div>
  </div>

  <!-- ── Reactivate Modal ──────────────────────────────── -->
  <div v-if="reactivateModal.open" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="closeReactivate">
    <div class="bg-white rounded-lg w-full max-w-md shadow-2xl">
      <div class="flex items-center justify-between p-6 border-b border-outline-variant">
        <h3 class="font-h2 text-h2 text-on-surface">Reactivate Cleaner</h3>
        <button class="text-on-surface-variant hover:text-on-surface" :disabled="reactivateModal.loading" @click="closeReactivate">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="p-6">
        <p class="font-body text-body text-on-surface">
          Reactivate <strong>{{ reactivateModal.cleaner?.business_name ?? reactivateModal.cleaner?.full_name }}</strong>?
          They will be able to appear in customer search and receive bookings again.
        </p>
        <p v-if="reactivateModal.error" class="mt-4 text-caption text-red-600">{{ reactivateModal.error }}</p>
      </div>
      <div class="flex justify-end gap-3 p-6 border-t border-outline-variant">
        <button class="px-4 py-2 border border-outline-variant font-label-md hover:bg-surface-container" :disabled="reactivateModal.loading" @click="closeReactivate">Cancel</button>
        <button
          class="px-4 py-2 bg-green-600 text-white font-label-md disabled:opacity-50 hover:bg-green-700"
          data-testid="confirm-reactivate-btn"
          :disabled="reactivateModal.loading"
          @click="confirmReactivate"
        >
          {{ reactivateModal.loading ? 'Reactivating…' : 'Confirm Reactivate' }}
        </button>
      </div>
    </div>
  </div>

  <!-- ── Deactivate Modal ──────────────────────────────── -->
  <div v-if="deactivateModal.open" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="closeDeactivate">
    <div class="bg-white rounded-lg w-full max-w-md shadow-2xl">
      <div class="flex items-center justify-between p-6 border-b border-outline-variant">
        <h3 class="font-h2 text-h2 text-on-surface">Deactivate Cleaner</h3>
        <button class="text-on-surface-variant hover:text-on-surface" :disabled="deactivateModal.loading" @click="closeDeactivate">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="p-6 space-y-4">
        <div class="flex gap-3 p-4 bg-red-50 border border-red-200">
          <span class="material-symbols-outlined text-red-600 flex-shrink-0">warning</span>
          <div>
            <p class="font-label-md text-label-md text-red-800">Warning</p>
            <p class="text-caption font-caption text-red-700 mt-1">
              This will remove the cleaner from the marketplace but retain all historical booking data. This action cannot be undone through the admin panel.
            </p>
          </div>
        </div>
        <p class="font-body text-body text-on-surface">
          Deactivate <strong>{{ deactivateModal.cleaner?.business_name ?? deactivateModal.cleaner?.full_name }}</strong>?
        </p>
        <p v-if="deactivateModal.error" class="text-caption text-red-600">{{ deactivateModal.error }}</p>
      </div>
      <div class="flex justify-end gap-3 p-6 border-t border-outline-variant">
        <button class="px-4 py-2 border border-outline-variant font-label-md hover:bg-surface-container" :disabled="deactivateModal.loading" @click="closeDeactivate">Cancel</button>
        <button
          class="px-4 py-2 bg-red-700 text-white font-label-md disabled:opacity-50 hover:bg-red-800"
          data-testid="confirm-deactivate-btn"
          :disabled="deactivateModal.loading"
          @click="confirmDeactivate"
        >
          {{ deactivateModal.loading ? 'Deactivating…' : 'Confirm Deactivate' }}
        </button>
      </div>
    </div>
  </div>

  <!-- ── View Profile Modal ────────────────────────────── -->
  <div v-if="profileModal.open" class="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto" @click.self="closeProfile">
    <div class="bg-white rounded-lg w-full max-w-3xl shadow-2xl my-8">
      <div class="flex items-center justify-between p-6 border-b border-outline-variant sticky top-0 bg-white rounded-t-lg">
        <h3 class="font-h2 text-h2 text-on-surface">Cleaner Profile</h3>
        <button class="text-on-surface-variant hover:text-on-surface" @click="closeProfile">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <div v-if="profileModal.loading" class="p-12 flex justify-center">
        <div class="w-8 h-8 border-2 border-outline-variant border-t-primary rounded-full animate-spin"></div>
      </div>

      <div v-else-if="profileModal.error" class="p-6 text-caption text-red-600">{{ profileModal.error }}</div>

      <div v-else-if="profileModal.data" class="p-6 space-y-6">
        <!-- Basic Info -->
        <section class="flex gap-4">
          <div class="w-16 h-16 rounded-full overflow-hidden bg-surface-container flex-shrink-0 flex items-center justify-center">
            <img v-if="profileModal.data.avatar_url" :src="profileModal.data.avatar_url" :alt="profileModal.data.full_name" class="w-full h-full object-cover" />
            <span v-else class="material-symbols-outlined text-on-surface-variant text-3xl">person</span>
          </div>
          <div>
            <h4 class="font-h2 text-h2 text-on-surface">{{ profileModal.data.business_name ?? profileModal.data.full_name }}</h4>
            <p class="text-caption font-caption text-on-surface-variant">{{ profileModal.data.email }}</p>
            <p v-if="profileModal.data.city" class="text-caption font-caption text-on-surface-variant">{{ profileModal.data.city }}, {{ profileModal.data.country }}</p>
            <div class="flex gap-2 mt-2">
              <span :class="statusPillClass(profileModal.data.status)" class="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full">
                {{ profileModal.data.status }}
              </span>
              <span :class="profileModal.data.is_active ? 'text-blue-700 bg-blue-50' : 'text-red-700 bg-red-50'" class="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full">
                {{ profileModal.data.is_active ? 'Active' : 'Inactive' }}
              </span>
            </div>
          </div>
        </section>

        <div v-if="profileModal.data.bio" class="bg-surface-container-low p-4 rounded">
          <p class="text-caption font-caption text-on-surface-variant mb-1 uppercase tracking-wide font-bold text-[10px]">Bio</p>
          <p class="font-body text-body text-on-surface">{{ profileModal.data.bio }}</p>
        </div>

        <!-- Stats grid -->
        <section class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="border border-outline-variant p-4 text-center">
            <p class="font-h2 text-h2 text-on-surface">{{ profileModal.data.review_count }}</p>
            <p class="text-caption font-caption text-on-surface-variant">Completed</p>
          </div>
          <div class="border border-outline-variant p-4 text-center">
            <p class="font-h2 text-h2 text-on-surface">{{ profileModal.data.average_rating.toFixed(1) }}</p>
            <p class="text-caption font-caption text-on-surface-variant">Avg Rating</p>
          </div>
          <div class="border border-outline-variant p-4 text-center">
            <p class="font-h2 text-h2 text-on-surface">{{ formatPence(profileModal.data.total_earnings_cents) }}</p>
            <p class="text-caption font-caption text-on-surface-variant">Earnings</p>
          </div>
          <div class="border border-outline-variant p-4 text-center">
            <p class="font-h2 text-h2 text-on-surface">{{ profileModal.data.upcoming_bookings.length }}</p>
            <p class="text-caption font-caption text-on-surface-variant">Upcoming</p>
          </div>
        </section>

        <!-- Services -->
        <section>
          <h5 class="font-label-md text-label-md text-on-surface mb-3">Services &amp; Pricing</h5>
          <div v-if="profileModal.data.services.length === 0" class="text-caption text-on-surface-variant">No active services.</div>
          <div v-else class="space-y-2">
            <div v-for="svc in profileModal.data.services" :key="svc.id" class="flex justify-between items-center p-3 border border-outline-variant">
              <div>
                <p class="font-label-md text-label-md text-on-surface">{{ svc.title }}</p>
                <p class="text-caption font-caption text-on-surface-variant">{{ svc.category }} · {{ svc.duration_minutes ? `${svc.duration_minutes}min` : 'TBC' }}</p>
              </div>
              <span class="font-label-md text-label-md text-on-surface">{{ formatPence(svc.base_price_cents) }}</span>
            </div>
          </div>
        </section>

        <!-- Upcoming Bookings -->
        <section>
          <h5 class="font-label-md text-label-md text-on-surface mb-3">Upcoming Bookings</h5>
          <div v-if="profileModal.data.upcoming_bookings.length === 0" class="text-caption text-on-surface-variant">No upcoming bookings.</div>
          <div v-else class="space-y-2">
            <div v-for="b in profileModal.data.upcoming_bookings" :key="b.id" class="flex justify-between items-center p-3 border border-outline-variant">
              <div>
                <p class="font-label-md text-label-md text-on-surface">{{ b.service_title ?? 'Booking' }}</p>
                <p class="text-caption font-caption text-on-surface-variant">{{ formatDate(b.scheduled_start) }} · {{ b.customer_name }}</p>
              </div>
              <div class="text-right">
                <p class="font-label-md text-label-md text-on-surface">{{ formatPence(b.quote_cents) }}</p>
                <span class="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{{ b.status }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Documents -->
        <section>
          <h5 class="font-label-md text-label-md text-on-surface mb-3">Documents</h5>
          <div v-if="profileModal.data.documents.length === 0" class="text-caption text-on-surface-variant">No documents uploaded.</div>
          <div v-else class="space-y-2">
            <div v-for="doc in profileModal.data.documents" :key="doc.id" class="flex justify-between items-center p-3 border border-outline-variant">
              <div>
                <p class="font-label-md text-label-md text-on-surface capitalize">{{ doc.document_type.replace(/_/g, ' ') }}</p>
                <p class="text-caption font-caption text-on-surface-variant">{{ doc.uploaded_at ? formatDate(doc.uploaded_at) : 'Date unknown' }}</p>
              </div>
              <span :class="doc.admin_verified ? 'text-green-700 bg-green-50' : 'text-amber-700 bg-amber-50'" class="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full">
                {{ doc.admin_verified ? 'Verified' : 'Pending' }}
              </span>
            </div>
          </div>
        </section>

        <!-- Reviews -->
        <section>
          <h5 class="font-label-md text-label-md text-on-surface mb-3">Reviews ({{ profileModal.data.reviews.length }})</h5>
          <div v-if="profileModal.data.reviews.length === 0" class="text-caption text-on-surface-variant">No reviews yet.</div>
          <div v-else class="space-y-2">
            <div v-for="rev in profileModal.data.reviews.slice(0, 5)" :key="rev.id" class="p-3 border border-outline-variant">
              <div class="flex items-center gap-2 mb-1">
                <div class="flex">
                  <span v-for="i in 5" :key="i" class="material-symbols-outlined text-amber-400" style="font-size:14px;font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 20">{{ i <= rev.rating ? 'star' : 'star_border' }}</span>
                </div>
                <span class="text-caption font-caption text-on-surface-variant">{{ rev.customer_name }} · {{ formatDate(rev.created_at) }}</span>
              </div>
              <p class="font-body text-body text-on-surface">{{ rev.comment ?? 'No comment.' }}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  getAllCleaners,
  getCleanerProfile,
  suspendCleaner,
  reactivateCleaner,
  deactivateCleaner,
  type AdminCleanerRow,
  type AdminCleanerProfile,
  type CleanerStatusFilter,
} from '@/services/adminService'
import { formatPence, formatDate, toUserMessage } from '@/utils/format'

const PAGE_SIZE = 10

// ── State ──────────────────────────────────────────────────────
const cleaners = ref<AdminCleanerRow[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const errorMessage = ref('')

const searchQuery = ref('')
const statusFilter = ref<CleanerStatusFilter | ''>('')

let searchDebounce: ReturnType<typeof setTimeout> | null = null

const totalPages = computed(() => Math.ceil(total.value / PAGE_SIZE))

// ── Suspend modal ───────────────────────────────────────────────
const suspendModal = reactive({
  open: false,
  loading: false,
  error: '',
  reason: '',
  cleaner: null as AdminCleanerRow | null,
})

// ── Reactivate modal ────────────────────────────────────────────
const reactivateModal = reactive({
  open: false,
  loading: false,
  error: '',
  cleaner: null as AdminCleanerRow | null,
})

// ── Deactivate modal ────────────────────────────────────────────
const deactivateModal = reactive({
  open: false,
  loading: false,
  error: '',
  cleaner: null as AdminCleanerRow | null,
})

// ── Profile modal ───────────────────────────────────────────────
const profileModal = reactive({
  open: false,
  loading: false,
  error: '',
  data: null as AdminCleanerProfile | null,
})

// ── Data loading ────────────────────────────────────────────────
async function loadCleaners() {
  loading.value = true
  errorMessage.value = ''
  try {
    const { cleaners: rows, total: count } = await getAllCleaners(
      searchQuery.value.trim() || null,
      (statusFilter.value as CleanerStatusFilter) || null,
      page.value,
      PAGE_SIZE,
    )
    cleaners.value = rows
    total.value = count
  } catch (e) {
    errorMessage.value = toUserMessage(e, 'Failed to load cleaners. Please refresh.')
  } finally {
    loading.value = false
  }
}

function onSearchInput() {
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => {
    page.value = 1
    loadCleaners()
  }, 350)
}

function goToPage(n: number) {
  page.value = n
  loadCleaners()
}

// ── Suspend ─────────────────────────────────────────────────────
function openSuspend(cleaner: AdminCleanerRow) {
  suspendModal.open = true
  suspendModal.cleaner = cleaner
  suspendModal.reason = ''
  suspendModal.error = ''
  suspendModal.loading = false
}

function closeSuspend() {
  if (suspendModal.loading) return
  suspendModal.open = false
  suspendModal.cleaner = null
}

async function confirmSuspend() {
  if (!suspendModal.cleaner || suspendModal.loading) return
  suspendModal.loading = true
  suspendModal.error = ''
  try {
    await suspendCleaner(suspendModal.cleaner.user_id, suspendModal.reason.trim() || undefined)
    closeSuspend()
    await loadCleaners()
  } catch (e) {
    suspendModal.error = toUserMessage(e, 'Failed to suspend cleaner. Please try again.')
  } finally {
    suspendModal.loading = false
  }
}

// ── Reactivate ──────────────────────────────────────────────────
function openReactivate(cleaner: AdminCleanerRow) {
  reactivateModal.open = true
  reactivateModal.cleaner = cleaner
  reactivateModal.error = ''
  reactivateModal.loading = false
}

function closeReactivate() {
  if (reactivateModal.loading) return
  reactivateModal.open = false
  reactivateModal.cleaner = null
}

async function confirmReactivate() {
  if (!reactivateModal.cleaner || reactivateModal.loading) return
  reactivateModal.loading = true
  reactivateModal.error = ''
  try {
    await reactivateCleaner(reactivateModal.cleaner.user_id)
    closeReactivate()
    await loadCleaners()
  } catch (e) {
    reactivateModal.error = toUserMessage(e, 'Failed to reactivate cleaner. Please try again.')
  } finally {
    reactivateModal.loading = false
  }
}

// ── Deactivate ──────────────────────────────────────────────────
function openDeactivate(cleaner: AdminCleanerRow) {
  deactivateModal.open = true
  deactivateModal.cleaner = cleaner
  deactivateModal.error = ''
  deactivateModal.loading = false
}

function closeDeactivate() {
  if (deactivateModal.loading) return
  deactivateModal.open = false
  deactivateModal.cleaner = null
}

async function confirmDeactivate() {
  if (!deactivateModal.cleaner || deactivateModal.loading) return
  deactivateModal.loading = true
  deactivateModal.error = ''
  try {
    await deactivateCleaner(deactivateModal.cleaner.user_id)
    closeDeactivate()
    await loadCleaners()
  } catch (e) {
    deactivateModal.error = toUserMessage(e, 'Failed to deactivate cleaner. Please try again.')
  } finally {
    deactivateModal.loading = false
  }
}

// ── View Profile ────────────────────────────────────────────────
async function openProfile(cleaner: AdminCleanerRow) {
  profileModal.open = true
  profileModal.loading = true
  profileModal.error = ''
  profileModal.data = null
  try {
    profileModal.data = await getCleanerProfile(cleaner.user_id)
  } catch (e) {
    profileModal.error = toUserMessage(e, 'Failed to load cleaner profile. Please try again.')
  } finally {
    profileModal.loading = false
  }
}

function closeProfile() {
  profileModal.open = false
  profileModal.data = null
  profileModal.error = ''
}

// ── Helpers ─────────────────────────────────────────────────────
function statusPillClass(status: string): string {
  const map: Record<string, string> = {
    approved:    'text-green-700 bg-green-50',
    suspended:   'text-amber-700 bg-amber-50',
    deactivated: 'text-red-700 bg-red-50',
    rejected:    'text-red-700 bg-red-50',
    pending:     'text-blue-700 bg-blue-50',
  }
  return map[status] ?? 'text-on-surface-variant bg-surface-container'
}

onMounted(loadCleaners)
</script>
