<template>
  <main class="checkout-return-page">
    <!-- Loading: waiting for webhook to update booking -->
    <div v-if="state === 'loading'" class="checkout-return-card" data-testid="checkout-loading">
      <div class="checkout-spinner" aria-hidden="true"></div>
      <h1 class="checkout-heading">Processing your payment…</h1>
      <p class="checkout-body">Please wait while we confirm your booking with Stripe.</p>
    </div>

    <!-- Success: booking is now payment_authorized or paid -->
    <div v-else-if="state === 'success'" class="checkout-return-card" data-testid="checkout-success">
      <span class="material-symbols-outlined checkout-icon checkout-icon--success" aria-hidden="true">
        check_circle
      </span>
      <h1 class="checkout-heading" data-testid="checkout-success-heading">Payment Successful</h1>
      <p class="checkout-body">Your booking has been successfully placed.</p>
      <div class="checkout-actions">
        <button class="btn-primary" @click="viewBooking">View Booking</button>
        <router-link class="checkout-link" :to="{ name: 'CustomerDashboard' }">
          Go to Dashboard
        </router-link>
      </div>
    </div>

    <!-- Timeout: webhook hasn't arrived in 30s -->
    <div v-else-if="state === 'timeout'" class="checkout-return-card" data-testid="checkout-timeout">
      <span class="material-symbols-outlined checkout-icon checkout-icon--warn" aria-hidden="true">
        schedule
      </span>
      <h1 class="checkout-heading">Payment is being processed</h1>
      <p class="checkout-body">
        Your payment was submitted successfully. It may take a moment to confirm —
        check your email for a receipt, or view your booking below.
      </p>
      <div class="checkout-actions">
        <button class="btn-primary" @click="viewBooking">View Booking</button>
        <router-link class="checkout-link" :to="{ name: 'CustomerDashboard' }">
          Go to Dashboard
        </router-link>
      </div>
    </div>

    <!-- Error: no booking_id in URL -->
    <div v-else class="checkout-return-card" data-testid="checkout-error">
      <span class="material-symbols-outlined checkout-icon checkout-icon--error" aria-hidden="true">
        error
      </span>
      <h1 class="checkout-heading">Something went wrong</h1>
      <p class="checkout-body">We couldn't confirm your booking. Please check your bookings or contact support.</p>
      <router-link class="btn-primary" :to="{ name: 'CustomerDashboard' }">
        Go to Dashboard
      </router-link>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { requireSupabase } from '@/lib/supabase'
import { track } from '@/utils/analytics'
import { useAuthStore } from '@/stores/auth'

type PageState = 'loading' | 'success' | 'timeout' | 'error'

const POLL_INTERVAL_MS = 2_000
const POLL_TIMEOUT_MS  = 30_000

// Statuses that confirm payment was received (webhook has fired)
const PAID_STATUSES = new Set([
  'payment_authorized', 'accepted', 'paid',
  'in_progress', 'pending_start', 'completed',
])

const route  = useRoute()
const router = useRouter()
const auth   = useAuthStore()

const bookingId = typeof route.query.booking_id === 'string' ? route.query.booking_id : null
const state = ref<PageState>(bookingId ? 'loading' : 'error')

let pollTimer: ReturnType<typeof setTimeout> | null = null
let timeoutTimer: ReturnType<typeof setTimeout> | null = null

function viewBooking() {
  if (bookingId) {
    void router.push({ name: 'CustomerBookingDetails', params: { bookingId } })
  } else {
    void router.push({ name: 'CustomerDashboard' })
  }
}

function stopPolling() {
  if (pollTimer)   { clearTimeout(pollTimer);   pollTimer   = null }
  if (timeoutTimer){ clearTimeout(timeoutTimer); timeoutTimer = null }
}

async function checkStatus(): Promise<boolean> {
  if (!bookingId) return false
  try {
    const supabase = requireSupabase()
    const { data } = await supabase
      .from('bookings')
      .select('status, payment_status')
      .eq('id', bookingId)
      .maybeSingle()
    const row = data as { status: string; payment_status: string } | null
    if (!row) return false
    return PAID_STATUSES.has(row.status) ||
           row.payment_status === 'authorized' ||
           row.payment_status === 'captured'
  } catch {
    return false
  }
}

async function poll() {
  if (await checkStatus()) {
    stopPolling()
    state.value = 'success'
    void track('CHECKOUT_COMPLETED', {
      booking_id: bookingId ?? undefined,
      user_id:    auth.userId ?? undefined,
    })
    return
  }
  pollTimer = setTimeout(() => void poll(), POLL_INTERVAL_MS)
}

onMounted(() => {
  if (!bookingId) return

  // Start polling
  void poll()

  // Hard timeout: if webhook never arrives, show the timeout state
  timeoutTimer = setTimeout(() => {
    stopPolling()
    if (state.value === 'loading') state.value = 'timeout'
  }, POLL_TIMEOUT_MS)
})

onUnmounted(() => {
  stopPolling()
})
</script>

<style scoped>
.checkout-return-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  background: var(--background, #f9f9f9);
}

.checkout-return-card {
  background: var(--surface-container-lowest, #fff);
  border: 1px solid var(--outline-variant, #d4d4d4);
  padding: 3rem 2.5rem;
  max-width: 480px;
  width: 100%;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.checkout-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid var(--outline-variant, #d4d4d4);
  border-top-color: var(--primary, #1a1a1a);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.checkout-icon {
  font-size: 48px;
}

.checkout-icon--success { color: #16a34a; }
.checkout-icon--warn    { color: #ca8a04; }
.checkout-icon--error   { color: #dc2626; }

.checkout-heading {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--on-surface, #1a1a1a);
  margin: 0;
}

.checkout-body {
  font-size: 0.9375rem;
  color: var(--secondary, #5e5e5e);
  margin: 0;
  max-width: 36ch;
  line-height: 1.6;
}

.checkout-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
  width: 100%;
}

.btn-primary {
  background: var(--primary, #1a1a1a);
  color: var(--on-primary, #fff);
  border: none;
  padding: 0.875rem 2rem;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  transition: opacity 0.15s;
}
.btn-primary:hover { opacity: 0.88; }

.checkout-link {
  font-size: 0.875rem;
  color: var(--secondary, #5e5e5e);
  text-decoration: underline;
}
</style>
