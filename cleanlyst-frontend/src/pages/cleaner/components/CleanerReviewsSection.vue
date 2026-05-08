<template>
  <main class="page-main">
    <section class="page-header">
      <div>
        <h1 class="header-title">Reviews</h1>
        <p class="header-copy">Customer feedback from your completed jobs.</p>
      </div>
    </section>

    <!-- Overall Rating -->
    <section class="rating-card">
      <div class="rating-overview">
        <div class="rating-score-block">
          <p class="rating-score">{{ avgRating.toFixed(1) }}</p>
          <div class="star-row">
            <span
              v-for="n in 5"
              :key="n"
              class="material-symbols-outlined star-icon"
              :class="n <= Math.round(avgRating) ? 'star-icon--filled' : 'star-icon--empty'"
              >star</span
            >
          </div>
          <p class="rating-count">
            {{ reviewCount }} {{ reviewCount === 1 ? 'review' : 'reviews' }}
          </p>
        </div>
        <div class="rating-bars">
          <div v-for="n in [5, 4, 3, 2, 1]" :key="n" class="bar-row">
            <span class="bar-label">{{ n }}</span>
            <span class="material-symbols-outlined bar-star">star</span>
            <div class="bar-track">
              <div class="bar-fill" :style="{ width: barWidth(n) }"></div>
            </div>
            <span class="bar-count">{{ ratingBuckets[n] ?? 0 }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Review List -->
    <section class="reviews-section">
      <h2 class="section-title">All Reviews</h2>

      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p class="loading-text">Loading reviews…</p>
      </div>

      <div v-else-if="reviews.length === 0" class="empty-state">
        <span class="material-symbols-outlined empty-icon">rate_review</span>
        <p class="empty-label">No reviews yet</p>
        <p class="empty-desc">
          Once customers leave feedback on completed jobs, their reviews will appear here.
        </p>
      </div>

      <div v-else class="review-list">
        <article v-for="r in reviews" :key="r.id" class="review-card">
          <div class="review-card-top">
            <div class="reviewer-info">
              <div class="reviewer-avatar">
                <span class="material-symbols-outlined avatar-icon">person</span>
              </div>
              <div>
                <p class="reviewer-name">{{ r.reviewer_name ?? 'Anonymous' }}</p>
                <p class="review-date">{{ formatDate(r.created_at) }}</p>
              </div>
            </div>
            <div class="review-stars">
              <span
                v-for="n in 5"
                :key="n"
                class="material-symbols-outlined review-star"
                :class="n <= r.rating ? 'review-star--filled' : 'review-star--empty'"
                >star</span
              >
            </div>
          </div>
          <p v-if="r.comment" class="review-comment">{{ r.comment }}</p>
          <p v-else class="review-comment review-comment--empty">No written review provided.</p>
        </article>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { requireSupabase } from '@/lib/supabase'

interface Review {
  id: string
  rating: number
  comment: string | null
  created_at: string
  reviewer_name: string | null
}

const auth = useAuthStore()
const loading = ref(true)
const reviews = ref<Review[]>([])

const avgRating = computed(() => auth.cleanerProfile?.average_rating ?? 0)
const reviewCount = computed(() => auth.cleanerProfile?.review_count ?? 0)

const ratingBuckets = computed<Record<number, number>>(() => {
  const buckets: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const r of reviews.value) {
    const key = Math.round(r.rating)
    if (key >= 1 && key <= 5) buckets[key] = (buckets[key] ?? 0) + 1
  }
  return buckets
})

function barWidth(star: number): string {
  const total = reviews.value.length
  if (total === 0) return '0%'
  return `${((ratingBuckets.value[star] ?? 0) / total) * 100}%`
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return '—'
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(date)
}

onMounted(async () => {
  await auth.init()

  if (!auth.userId) {
    loading.value = false
    return
  }

  const supabase = requireSupabase()
  const { data } = await supabase
    .from('reviews')
    .select('id, rating, comment, created_at, reviewer_name')
    .eq('cleaner_id', auth.userId)
    .order('created_at', { ascending: false })

  reviews.value = (data ?? []) as Review[]
  loading.value = false
})
</script>

<style scoped>
/* ── Material Symbols ─────────────────────────────────────────── */
.material-symbols-outlined {
  font-variation-settings:
    'FILL' 0,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
  display: inline-block;
  line-height: 1;
  text-transform: none;
  letter-spacing: normal;
  word-wrap: normal;
  white-space: nowrap;
  direction: ltr;
}

/* ── Page shell ───────────────────────────────────────────────── */
.page-main {
  padding-top: 2rem;
  padding-bottom: 5rem;
  padding-left: 1.5rem;
  padding-right: 1.5rem;
  max-width: 80rem;
  margin-left: auto;
  margin-right: auto;
}

@media (min-width: 1024px) {
  .page-main {
    padding-left: 3rem;
    padding-right: 3rem;
  }
}

/* ── Page header ──────────────────────────────────────────────── */
.page-header {
  margin-bottom: 3rem;
}

.header-title {
  font-size: 32px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--primary, #000000);
  margin-bottom: 0.5rem;
}

.header-copy {
  font-size: 16px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--secondary, #5e5e5e);
}

/* ── Rating card ──────────────────────────────────────────────── */
.rating-card {
  padding: 2rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  background-color: var(--surface-container-lowest, #ffffff);
  margin-bottom: 4rem;
}

.rating-overview {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

@media (min-width: 640px) {
  .rating-overview {
    flex-direction: row;
    align-items: center;
  }
}

/* ── Score block ──────────────────────────────────────────────── */
.rating-score-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
  padding-right: 2rem;
  border-right: 1px solid var(--surface-variant, #e2e2e2);
  min-width: 9rem;
}

@media (max-width: 639px) {
  .rating-score-block {
    border-right: none;
    padding-right: 0;
    padding-bottom: 2rem;
    border-bottom: 1px solid var(--surface-variant, #e2e2e2);
    width: 100%;
  }
}

.rating-score {
  font-size: 64px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--primary, #000000);
  margin: 0;
}

.star-row {
  display: flex;
  gap: 0.25rem;
}

.star-icon {
  font-size: 1.25rem;
}

.star-icon--filled {
  color: #f59e0b;
  font-variation-settings:
    'FILL' 1,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
}

.star-icon--empty {
  color: var(--outline-variant, #c4c7c7);
}

.rating-count {
  font-size: 13px;
  color: var(--secondary, #5e5e5e);
  margin: 0;
}

/* ── Rating bars ──────────────────────────────────────────────── */
.rating-bars {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-left: 2rem;
}

@media (max-width: 639px) {
  .rating-bars {
    padding-left: 0;
  }
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.bar-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--secondary, #5e5e5e);
  width: 0.75rem;
  text-align: right;
  flex-shrink: 0;
}

.bar-star {
  font-size: 0.875rem;
  color: #f59e0b;
  flex-shrink: 0;
  font-variation-settings:
    'FILL' 1,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
}

.bar-track {
  flex: 1;
  height: 0.5rem;
  background-color: var(--surface-container, #eeeeee);
  border-radius: 999px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background-color: var(--primary, #000000);
  border-radius: 999px;
  transition: width 0.4s ease;
}

.bar-count {
  font-size: 12px;
  color: var(--secondary, #5e5e5e);
  width: 1.5rem;
  text-align: right;
  flex-shrink: 0;
}

/* ── Reviews section ──────────────────────────────────────────── */
.reviews-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section-title {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--primary, #000000);
}

/* ── Loading ──────────────────────────────────────────────────── */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem 0;
}

.loading-spinner {
  width: 2rem;
  height: 2rem;
  border: 2px solid var(--outline-variant, #c4c7c7);
  border-top-color: var(--primary, #000000);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 16px;
  color: var(--secondary, #5e5e5e);
}

/* ── Empty state ──────────────────────────────────────────────── */
.empty-state {
  border: 1px dashed var(--outline-variant, #c4c7c7);
  border-radius: 0.25rem;
  padding: 3rem 2rem;
  text-align: center;
}

.empty-icon {
  font-size: 3rem;
  color: var(--outline-variant, #c4c7c7);
  display: block;
  margin: 0 auto 1rem;
}

.empty-label {
  font-size: 18px;
  font-weight: 500;
  color: var(--primary, #000000);
  margin: 0 0 0.5rem;
}

.empty-desc {
  font-size: 14px;
  color: var(--secondary, #5e5e5e);
  margin: 0;
  max-width: 32rem;
  margin-left: auto;
  margin-right: auto;
}

/* ── Review list ──────────────────────────────────────────────── */
.review-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* ── Review card ──────────────────────────────────────────────── */
.review-card {
  padding: 1.5rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  background-color: var(--surface-container-lowest, #ffffff);
  transition: border-color 0.15s;
}

.review-card:hover {
  border-color: var(--primary, #000000);
}

.review-card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.reviewer-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.reviewer-avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  border: 1px solid var(--outline-variant, #c4c7c7);
  background-color: var(--surface-container, #eeeeee);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-icon {
  font-size: 1.25rem;
  color: var(--secondary, #5e5e5e);
}

.reviewer-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--primary, #000000);
  margin: 0 0 0.125rem;
  line-height: 1.3;
}

.review-date {
  font-size: 12px;
  color: var(--secondary, #5e5e5e);
  margin: 0;
}

/* ── Review stars ─────────────────────────────────────────────── */
.review-stars {
  display: flex;
  gap: 0.125rem;
  flex-shrink: 0;
}

.review-star {
  font-size: 1rem;
}

.review-star--filled {
  color: #f59e0b;
  font-variation-settings:
    'FILL' 1,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
}

.review-star--empty {
  color: var(--outline-variant, #c4c7c7);
}

/* ── Review comment ───────────────────────────────────────────── */
.review-comment {
  font-size: 14px;
  font-weight: 400;
  line-height: 1.7;
  color: var(--primary, #000000);
  margin: 0;
}

.review-comment--empty {
  color: var(--secondary, #5e5e5e);
  font-style: italic;
}
</style>
