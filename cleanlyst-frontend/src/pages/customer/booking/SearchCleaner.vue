<template>
  <main class="pt-24 pb-20 px-6 lg:px-12 max-w-7xl mx-auto">
    <div class="flex flex-col lg:flex-row gap-gutter">
      <!-- Left Sidebar Filters -->
      <aside class="w-full lg:w-72 shrink-0">
        <div class="sticky top-24 space-y-8">
          <div>
            <h2 class="font-h2 text-h2 mb-4">Filters</h2>
            <div class="h-px bg-outline-variant w-full mb-6"></div>
          </div>

          <!-- City filter -->
          <div class="space-y-4">
            <label
              for="city-filter"
              class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider"
              >City</label
            >
            <select
              id="city-filter"
              v-model="filters.city"
              class="w-full h-12 px-3 border border-outline-variant bg-surface-container-lowest font-body focus:border-primary focus:ring-0 outline-none"
            >
              <option value="">All Cities</option>
              <option v-for="city in UK_CITIES" :key="city" :value="city">{{ city }}</option>
            </select>
          </div>

          <!-- Booking Date filter -->
          <div class="space-y-4">
            <label
              for="booking-date"
              class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider"
              >Booking Date</label
            >
            <input
              id="booking-date"
              v-model="filters.bookingDate"
              type="date"
              :min="minDate"
              class="w-full h-12 px-3 border border-outline-variant bg-surface-container-lowest font-body focus:border-primary focus:ring-0 outline-none"
            />
            <p v-if="filters.bookingDate" class="text-xs text-on-surface-variant">
              {{ formatDateDisplay(filters.bookingDate) }}
            </p>
          </div>

          <!-- Booking Time filter (only meaningful when a date is set) -->
          <div v-if="filters.bookingDate" class="space-y-4">
            <label
              for="booking-time"
              class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider"
              >Start Time <span class="normal-case text-xs">(optional)</span></label
            >
            <input
              id="booking-time"
              v-model="filters.bookingTime"
              type="time"
              class="w-full h-12 px-3 border border-outline-variant bg-surface-container-lowest font-body focus:border-primary focus:ring-0 outline-none"
            />
            <p class="text-xs text-on-surface-variant">
              Only show cleaners available at this time.
            </p>
          </div>

          <button
            class="w-full py-4 bg-primary text-on-primary font-label-md hover:bg-zinc-800 transition-colors"
            @click="applyFilters"
          >
            Apply Filters
          </button>
          <button
            class="w-full py-4 bg-transparent border border-outline-variant text-primary font-label-md hover:bg-surface-container transition-colors"
            @click="clearFilters"
          >
            Clear All
          </button>
        </div>
      </aside>

      <!-- Main Content: Cleaner List Cards -->
      <section class="flex-1 space-y-gutter">
        <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 class="font-h1 text-h1">Available Cleaners</h1>
            <p class="text-secondary font-body mt-2">
              <span v-if="loading">Searching…</span>
              <span v-else-if="errorMessage" class="text-red-600">{{ errorMessage }}</span>
              <span v-else
                >Showing {{ cleaners.length }} professional{{
                  cleaners.length !== 1 ? 's' : ''
                }}</span
              >
            </p>
          </div>
          <div class="flex items-center gap-4 border-b border-outline-variant pb-2">
            <span class="font-label-md text-label-md text-secondary">Sort by:</span>
            <select
              v-model="sortBy"
              class="bg-transparent border-none font-label-md focus:ring-0 p-0 cursor-pointer"
              @change="applyFilters"
            >
              <option value="rating">Highest Rated</option>
              <option value="price_asc">Lowest Price</option>
            </select>
          </div>
        </div>

        <!-- Loading skeleton -->
        <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 gap-gutter">
          <div
            v-for="n in 4"
            :key="n"
            class="bg-surface-container-lowest border border-outline-variant overflow-hidden animate-pulse"
          >
            <div class="aspect-[16/9] w-full bg-surface-container"></div>
            <div class="p-padding-card space-y-3">
              <div class="h-5 bg-surface-container rounded w-2/3"></div>
              <div class="h-4 bg-surface-container rounded w-1/2"></div>
              <div class="h-4 bg-surface-container rounded w-1/3"></div>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div
          v-else-if="cleaners.length === 0 && !errorMessage"
          class="border border-dashed border-outline-variant p-16 text-center"
        >
          <span class="material-symbols-outlined text-outline-variant text-5xl block mb-4"
            >search_off</span
          >
          <p class="font-label-md text-label-md text-on-surface">No cleaners found</p>
          <p class="text-caption text-on-surface-variant mt-1">Try adjusting your filters.</p>
        </div>

        <!-- Results Grid -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-gutter">
          <div
            v-for="c in cleaners"
            :key="c.user_id"
            class="bg-surface-container-lowest border border-outline-variant overflow-hidden group hover:border-primary transition-colors"
          >
            <div class="aspect-[16/9] w-full relative overflow-hidden bg-surface-variant">
              <img
                v-if="c.profiles?.avatar_url"
                :alt="displayName(c)"
                :src="c.profiles.avatar_url"
                class="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
              />
              <div
                v-else
                class="w-full h-full flex items-center justify-center bg-surface-container"
              >
                <span class="material-symbols-outlined text-5xl text-on-surface-variant"
                  >person</span
                >
              </div>
              <div
                v-if="c.average_rating >= 4.9"
                class="absolute top-4 left-4 bg-primary text-on-primary px-3 py-1 text-[10px] font-bold tracking-widest uppercase"
              >
                Top Rated
              </div>
            </div>
            <div class="p-padding-card space-y-4">
              <div class="flex justify-between items-start">
                <div>
                  <h2 class="font-h2 text-h2 text-primary">{{ displayName(c) }}</h2>
                  <div class="flex items-center gap-1 mt-1">
                    <span class="material-symbols-outlined text-[18px] text-zinc-900 star-filled"
                      >star</span
                    >
                    <span class="font-label-md text-label-md">{{
                      c.average_rating.toFixed(1)
                    }}</span>
                    <span class="text-secondary font-caption text-caption"
                      >({{ c.review_count }} reviews)</span
                    >
                  </div>
                </div>
                <div class="text-right">
                  <div class="font-h2 text-h2">
                    {{ c.hourly_rate_cents ? formatPence(c.hourly_rate_cents) : '—' }}
                  </div>
                  <div class="text-secondary font-caption text-caption">per hour</div>
                </div>
              </div>
              <p
                v-if="c.bio"
                class="font-body text-body text-on-surface-variant text-sm line-clamp-2"
              >
                {{ c.bio }}
              </p>
              <div v-if="c.profiles?.city" class="flex items-center gap-1 text-secondary text-sm">
                <span class="material-symbols-outlined text-[16px]">location_on</span>
                {{ c.profiles.city }}
              </div>
              <div class="pt-4 border-t border-outline-variant space-y-3">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-secondary text-sm">verified</span>
                  <span class="font-caption text-caption text-secondary">Verified cleaner</span>
                </div>
                <div class="flex gap-2">
                  <button
                    class="flex-1 py-2 bg-primary text-on-primary font-label-md active:scale-95 transition-all text-sm"
                    @click="bookInstant(c.user_id)"
                  >
                    Instant Book
                  </button>
                  <button
                    class="flex-1 py-2 border border-outline-variant text-primary font-label-md active:scale-95 transition-all text-sm hover:bg-surface-container"
                    @click="bookCustom(c.user_id)"
                  >
                    Custom Request
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="cleaners.length > 0" class="flex justify-center items-center gap-4 pt-12">
          <button
            class="w-10 h-10 flex items-center justify-center border border-outline-variant hover:border-primary transition-colors disabled:opacity-40"
            :disabled="page === 1 || loading"
            @click="goToPage(page - 1)"
          >
            <span class="material-symbols-outlined">chevron_left</span>
          </button>
          <span class="font-label-md text-label-md text-on-surface">Page {{ page }}</span>
          <button
            class="w-10 h-10 flex items-center justify-center border border-outline-variant hover:border-primary transition-colors disabled:opacity-40"
            :disabled="cleaners.length < pageSize || loading"
            @click="goToPage(page + 1)"
          >
            <span class="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { searchCleaners, type CleanerSearchResult } from '@/services/cleanerService'
import { formatPence } from '@/utils/format'
import { UK_CITIES } from '@/utils/ukCities'

const router = useRouter()

const pageSize = 12
const page = ref(1)
const loading = ref(false)
const errorMessage = ref('')
const cleaners = ref<CleanerSearchResult[]>([])
const sortBy = ref<'rating' | 'price_asc'>('rating')

const filters = reactive({
  city: '',
  service: '',
  bookingDate: '',
  bookingTime: '',
  minRating: 0,
})

// Calculate min date as tomorrow
const minDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]

onMounted(() => loadCleaners())

async function loadCleaners() {
  loading.value = true
  errorMessage.value = ''
  try {
    const params: Parameters<typeof searchCleaners>[0] = {
      limit: pageSize,
      offset: (page.value - 1) * pageSize,
    }
    if (filters.city.trim()) params.city = filters.city.trim()
    if (filters.service) params.serviceCategory = filters.service
    if (filters.bookingDate) params.availabilityDate = filters.bookingDate
    if (filters.bookingDate && filters.bookingTime) params.availabilityTime = filters.bookingTime
    if (filters.minRating > 0) params.minRating = filters.minRating

    const results = await searchCleaners(params)

    if (sortBy.value === 'price_asc') {
      results.sort((a, b) => (a.hourly_rate_cents ?? 0) - (b.hourly_rate_cents ?? 0))
    }

    cleaners.value = results
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to load cleaners.'
    cleaners.value = []
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  page.value = 1
  loadCleaners()
}

function clearFilters() {
  filters.city = ''
  filters.service = ''
  filters.bookingDate = ''
  filters.bookingTime = ''
  filters.minRating = 0
  sortBy.value = 'rating'
  page.value = 1
  loadCleaners()
}

function goToPage(n: number) {
  page.value = n
  loadCleaners()
}

function displayName(c: CleanerSearchResult): string {
  return c.business_name ?? c.profiles?.full_name ?? 'Cleaner'
}

function formatDateDisplay(date: string): string {
  if (!date) return ''
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function bookInstant(userId: string) {
  router.push({ name: 'InstantBooking', query: { cleanerId: userId } })
}

function bookCustom(userId: string) {
  router.push({ name: 'RequestBooking', query: { cleanerId: userId } })
}
</script>

<style scoped>
.material-symbols-outlined {
  font-variation-settings:
    'FILL' 0,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
  vertical-align: middle;
}

.star-filled {
  font-variation-settings:
    'FILL' 1,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
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

@media (min-width: 1024px) {
  .lg\:w-72 {
    width: 18rem;
  }
}
</style>
