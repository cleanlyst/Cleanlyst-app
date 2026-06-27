<template>
  <main class="checkout-return-page">
    <div class="checkout-return-card" data-testid="checkout-cancel">
      <span class="material-symbols-outlined checkout-icon" aria-hidden="true">cancel</span>
      <h1 class="checkout-heading">Payment Cancelled</h1>
      <p class="checkout-body">
        Your payment was not completed. Your booking is saved and you can try again at any time.
      </p>

      <p v-if="retryError" class="checkout-error" role="alert">{{ retryError }}</p>

      <div class="checkout-actions">
        <button
          class="btn-primary"
          :disabled="retrying"
          data-testid="retry-payment-btn"
          @click="retryPayment"
        >
          <span
            v-if="retrying"
            class="btn-spinner"
            aria-hidden="true"
          ></span>
          {{ retrying ? 'Redirecting…' : 'Try Payment Again' }}
        </button>

        <router-link
          v-if="bookingId"
          class="checkout-link"
          :to="{ name: 'CustomerBookingDetails', params: { bookingId } }"
        >
          View Booking
        </router-link>

        <router-link class="checkout-link" :to="{ name: 'CustomerDashboard' }">
          Go to Dashboard
        </router-link>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { startInitialPayment } from '@/services/payments/paymentOrchestrator'
import { toUserMessage } from '@/utils/format'

const route = useRoute()
const bookingId = typeof route.query.booking_id === 'string' ? route.query.booking_id : null

const retrying   = ref(false)
const retryError = ref('')

async function retryPayment() {
  if (!bookingId || retrying.value) return
  retrying.value   = true
  retryError.value = ''
  try {
    const result = await startInitialPayment(bookingId)
    if (result.redirectUrl) {
      window.location.href = result.redirectUrl
    }
  } catch (e) {
    retryError.value = toUserMessage(e, 'Unable to restart payment. Please try again or contact support.')
    retrying.value = false
  }
}
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

.checkout-icon {
  font-size: 48px;
  color: var(--secondary, #5e5e5e);
}

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
  max-width: 38ch;
  line-height: 1.6;
}

.checkout-error {
  font-size: 0.875rem;
  color: #dc2626;
  margin: 0;
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
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: opacity 0.15s;
}
.btn-primary:hover:not(:disabled) { opacity: 0.88; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

.checkout-link {
  font-size: 0.875rem;
  color: var(--secondary, #5e5e5e);
  text-decoration: underline;
}
</style>
