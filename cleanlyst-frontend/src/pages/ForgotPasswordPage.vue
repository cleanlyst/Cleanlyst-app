<template>
  <div class="log-in-page-public-page font-body text-body text-on-background">
    <main class="min-h-screen flex items-center justify-center px-gutter py-20">
      <div
        class="grid lg:grid-cols-2 max-w-container-max w-full bg-surface-container-lowest border border-outline-variant shadow-sm overflow-hidden"
      >
        <!-- Left: branding panel -->
        <div class="hidden lg:flex flex-col justify-between p-12 bg-primary text-on-primary">
          <div>
            <router-link :to="{ name: 'Home' }">
              <h1 class="font-h1 text-h1 tracking-tighter mb-4">Cleanlyst</h1>
            </router-link>
            <p class="font-body text-body opacity-80 max-w-sm">
              Enter your email address and we'll send you a secure link to reset your password.
            </p>
          </div>
          <div class="space-y-stack-gap">
            <div class="h-px bg-on-primary opacity-20 w-full"></div>
            <p class="font-caption text-caption opacity-60">
              The link expires in 60 minutes. Check your spam folder if you don't see it.
            </p>
          </div>
        </div>

        <!-- Right: form panel -->
        <div class="flex flex-col justify-center p-8 lg:p-24 bg-surface-container-lowest">
          <div class="max-w-md mx-auto w-full">

            <!-- Success state -->
            <div v-if="sent" class="text-center">
              <div
                class="w-16 h-16 mx-auto mb-6 bg-surface-container flex items-center justify-center"
              >
                <span class="material-symbols-outlined text-3xl text-primary">mark_email_read</span>
              </div>
              <h2 class="font-h1 text-h1 text-on-surface mb-3">Check your inbox</h2>
              <p class="font-body text-body text-secondary mb-8">
                We've sent a password reset link to
                <strong class="text-on-surface">{{ email }}</strong>. It expires in 60 minutes.
              </p>
              <p class="font-caption text-caption text-secondary mb-6">
                Didn't receive it?
                <button
                  class="text-primary hover:underline font-label-md ml-1"
                  :disabled="resending"
                  type="button"
                  @click="resendReset"
                >
                  {{ resending ? 'Sending…' : 'Resend link' }}
                </button>
              </p>
              <router-link
                :to="{ name: 'Login' }"
                class="font-label-md text-label-md text-secondary hover:text-primary underline"
              >
                ← Back to login
              </router-link>
            </div>

            <!-- Email form -->
            <template v-else>
              <div class="mb-10">
                <h2 class="font-h1 text-h1 text-on-surface mb-2">Forgot password?</h2>
                <p class="font-body text-body text-secondary">
                  We'll send a reset link to your registered email address.
                </p>
              </div>

              <form class="space-y-6" @submit.prevent="handleSubmit">
                <div>
                  <label class="block font-label-md text-label-md text-on-surface mb-2" for="email">
                    Email Address
                  </label>
                  <input
                    id="email"
                    v-model="email"
                    class="w-full px-4 py-3 border border-outline-variant focus:border-primary focus:ring-0 transition-colors outline-none font-body text-body bg-transparent"
                    name="email"
                    placeholder="name@company.com"
                    required
                    type="email"
                    autocomplete="email"
                  />
                </div>

                <p v-if="errorMessage" class="font-caption text-caption text-error" role="alert">
                  {{ errorMessage }}
                </p>

                <button
                  class="w-full bg-primary text-on-primary py-4 px-6 font-label-md text-label-md hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  :disabled="submitting"
                  type="submit"
                >
                  {{ submitting ? 'Sending…' : 'Send reset link' }}
                  <span class="material-symbols-outlined text-sm" aria-hidden="true">arrow_forward</span>
                </button>
              </form>

              <div class="mt-10 pt-8 border-t border-outline-variant text-center">
                <p class="font-caption text-caption text-secondary">
                  Remembered your password?
                  <router-link
                    class="text-primary font-label-md hover:underline ml-1"
                    :to="{ name: 'Login' }"
                  >
                    Log in
                  </router-link>
                </p>
              </div>
            </template>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { toUserMessage } from '@/utils/format'
import { requireSupabase } from '@/lib/supabase'

const email = ref('')
const submitting = ref(false)
const resending = ref(false)
const sent = ref(false)
const errorMessage = ref('')

async function sendReset() {
  const supabase = requireSupabase()
  const redirectTo = `${window.location.origin}/reset-password`
  const { error } = await supabase.auth.resetPasswordForEmail(email.value, { redirectTo })
  if (error) throw error
}

async function handleSubmit() {
  errorMessage.value = ''
  submitting.value = true
  try {
    await sendReset()
    sent.value = true
  } catch (e) {
    errorMessage.value = toUserMessage(e, 'Failed to send reset link. Please try again.')
  } finally {
    submitting.value = false
  }
}

async function resendReset() {
  resending.value = true
  try {
    await sendReset()
  } catch (e) {
    errorMessage.value = toUserMessage(e, 'Failed to resend link. Please try again.')
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
}
</style>
