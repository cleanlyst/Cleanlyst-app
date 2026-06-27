<template>
  <main class="verify-page">
    <section class="verify-card">
      <div class="verify-icon-wrap">
        <span class="material-symbols-outlined verify-icon">forward_to_inbox</span>
      </div>

      <p class="verify-eyebrow">Almost there</p>
      <h1 class="verify-heading">Verify your email</h1>

      <p class="verify-body">
        We've sent a confirmation link to
        <strong class="verify-email">{{ email || 'your email address' }}</strong>. Click the link in your email to activate
        your account.
      </p>

      <div class="verify-steps">
        <div class="step">
          <span class="step-num">1</span>
          <span class="step-label">Open the email from Cleanlyst</span>
        </div>
        <div class="step">
          <span class="step-num">2</span>
          <span class="step-label">Click the confirmation link</span>
        </div>
        <div class="step">
          <span class="step-num">3</span>
          <span class="step-label">You'll be taken straight to your dashboard</span>
        </div>
      </div>

      <div class="verify-actions" aria-live="polite">
        <p class="verify-hint">
          Didn't receive it? Check your spam folder, then
          <button
            class="resend-btn"
            :disabled="resending || resent || !email"
            type="button"
            @click="handleResend"
          >
            {{ resent ? 'Email sent!' : resending ? 'Sending…' : 'resend the email' }}
          </button>
          .
        </p>
        <p v-if="resendError" class="resend-error" role="alert">{{ resendError }}</p>
      </div>

      <router-link :to="{ name: 'Login' }" class="back-link"> ← Back to login </router-link>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { toUserMessage } from '@/utils/format'
import { useRoute } from 'vue-router'
import { requireSupabase } from '@/lib/supabase'

const route = useRoute()
const email = ref(typeof route.query.email === 'string' ? route.query.email : '')
const resending = ref(false)
const resent = ref(false)
const resendError = ref('')

async function handleResend() {
  if (!email.value) return
  resending.value = true
  resendError.value = ''
  try {
    const supabase = requireSupabase()
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.value })
    if (error) throw error
    resent.value = true
    setTimeout(() => {
      resent.value = false
    }, 30_000)
  } catch (e) {
    resendError.value = toUserMessage(e, 'Failed to resend verification email. Please try again.')
  } finally {
    resending.value = false
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
  display: inline-block;
  line-height: 1;
}

.verify-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 2rem 1rem 4rem;
  background-color: var(--background);
}

.verify-card {
  width: min(520px, 100%);
  padding: 2.5rem 2rem;
  background-color: var(--surface-container-lowest);
  border: 1px solid var(--outline-variant);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
}

.verify-icon-wrap {
  width: 4rem;
  height: 4rem;
  background-color: var(--surface-container);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.verify-icon {
  font-size: 2rem;
  color: var(--primary);
}

.verify-eyebrow {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--on-surface-variant);
  margin: 0 0 0.5rem;
}

.verify-heading {
  font-family: var(--font-h1);
  font-size: 28px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.01em;
  color: var(--on-surface);
  margin: 0 0 1rem;
}

.verify-body {
  font-family: var(--font-body);
  font-size: 16px;
  line-height: 1.6;
  color: var(--on-surface-variant);
  margin: 0 0 2rem;
}

.verify-email {
  color: var(--on-surface);
}

.verify-steps {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.25rem;
  background-color: var(--surface-container);
  margin-bottom: 2rem;
}

.step {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.step-num {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background-color: var(--primary);
  color: var(--on-primary);
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.step-label {
  font-family: var(--font-body);
  font-size: 14px;
  color: var(--on-surface);
}

.verify-actions {
  margin-bottom: 2rem;
}

.verify-hint {
  font-family: var(--font-caption);
  font-size: 13px;
  color: var(--on-surface-variant);
  margin: 0;
}

.resend-btn {
  background: none;
  border: none;
  padding: 0;
  font-family: var(--font-label-md);
  font-size: 13px;
  color: var(--primary);
  cursor: pointer;
  text-decoration: underline;
}

.resend-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.resend-error {
  font-family: var(--font-caption);
  font-size: 12px;
  color: var(--error);
  margin: 0.5rem 0 0;
}

.back-link {
  display: inline-block;
  font-family: var(--font-caption);
  font-size: 13px;
  color: var(--on-surface-variant);
  text-decoration: none;
  border-top: 1px solid var(--outline-variant);
  padding-top: 1.5rem;
  width: 100%;
}

.back-link:hover {
  color: var(--primary);
}
</style>
