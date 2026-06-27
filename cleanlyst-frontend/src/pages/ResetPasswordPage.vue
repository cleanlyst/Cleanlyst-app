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
              Create a strong password that you don't use for other websites.
            </p>
          </div>
          <div class="h-px bg-on-primary opacity-20 w-full"></div>
        </div>

        <!-- Right: form panel -->
        <div class="flex flex-col justify-center p-8 lg:p-24 bg-surface-container-lowest">
          <div class="max-w-md mx-auto w-full">

            <!-- Loading: establishing session from link -->
            <div v-if="initialising" class="text-center py-8">
              <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p class="font-body text-body text-secondary">Verifying your reset link…</p>
            </div>

            <!-- Invalid / expired link -->
            <div v-else-if="linkInvalid" class="text-center">
              <div
                class="w-16 h-16 mx-auto mb-6 bg-surface-container flex items-center justify-center"
              >
                <span class="material-symbols-outlined text-3xl text-error">link_off</span>
              </div>
              <h2 class="font-h1 text-h1 text-on-surface mb-3">Link expired</h2>
              <p class="font-body text-body text-secondary mb-8">
                This reset link is no longer valid. Password reset links expire after 60 minutes.
              </p>
              <router-link
                :to="{ name: 'ForgotPassword' }"
                class="inline-block w-full bg-primary text-on-primary py-4 px-6 font-label-md text-label-md hover:opacity-90 transition-opacity text-center"
              >
                Request a new link
              </router-link>
            </div>

            <!-- Success state -->
            <div v-else-if="done" class="text-center">
              <div
                class="w-16 h-16 mx-auto mb-6 bg-surface-container flex items-center justify-center"
              >
                <span class="material-symbols-outlined text-3xl text-primary">check_circle</span>
              </div>
              <h2 class="font-h1 text-h1 text-on-surface mb-3">Password updated</h2>
              <p class="font-body text-body text-secondary mb-8">
                Your password has been changed successfully. You can now log in with your new
                password.
              </p>
              <router-link
                :to="{ name: 'Login' }"
                class="inline-block w-full bg-primary text-on-primary py-4 px-6 font-label-md text-label-md hover:opacity-90 transition-opacity text-center"
              >
                Go to login
              </router-link>
            </div>

            <!-- New password form -->
            <template v-else>
              <div class="mb-10">
                <h2 class="font-h1 text-h1 text-on-surface mb-2">Set new password</h2>
                <p class="font-body text-body text-secondary">
                  Your new password must be at least 8 characters.
                </p>
              </div>

              <form class="space-y-6" @submit.prevent="handleSubmit">
                <div>
                  <label
                    class="block font-label-md text-label-md text-on-surface mb-2"
                    for="newPassword"
                  >
                    New Password
                  </label>
                  <input
                    id="newPassword"
                    v-model="newPassword"
                    class="w-full px-4 py-3 border border-outline-variant focus:border-primary focus:ring-0 transition-colors outline-none font-body text-body bg-transparent"
                    minlength="8"
                    name="newPassword"
                    placeholder="••••••••"
                    required
                    type="password"
                    autocomplete="new-password"
                  />
                </div>

                <div>
                  <label
                    class="block font-label-md text-label-md text-on-surface mb-2"
                    for="confirmPassword"
                  >
                    Confirm New Password
                  </label>
                  <input
                    id="confirmPassword"
                    v-model="confirmPassword"
                    class="w-full px-4 py-3 border border-outline-variant focus:border-primary focus:ring-0 transition-colors outline-none font-body text-body bg-transparent"
                    :class="{ 'border-error': mismatch }"
                    minlength="8"
                    name="confirmPassword"
                    placeholder="••••••••"
                    required
                    type="password"
                    autocomplete="new-password"
                    @blur="confirmTouched = true"
                  />
                  <p v-if="mismatch" class="font-caption text-caption text-error mt-1">
                    Passwords do not match.
                  </p>
                </div>

                <p v-if="errorMessage" class="font-caption text-caption text-error" role="alert">
                  {{ errorMessage }}
                </p>

                <button
                  class="w-full bg-primary text-on-primary py-4 px-6 font-label-md text-label-md hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  :disabled="submitting || !canSubmit"
                  type="submit"
                >
                  {{ submitting ? 'Updating…' : 'Update password' }}
                  <span class="material-symbols-outlined text-sm">lock_reset</span>
                </button>
              </form>
            </template>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { toUserMessage } from '@/utils/format'
import { requireSupabase } from '@/lib/supabase'

const newPassword = ref('')
const confirmPassword = ref('')
const confirmTouched = ref(false)
const submitting = ref(false)
const initialising = ref(true)
const linkInvalid = ref(false)
const done = ref(false)
const errorMessage = ref('')

const mismatch = computed(
  () => confirmTouched.value && confirmPassword.value.length > 0 && newPassword.value !== confirmPassword.value,
)

const canSubmit = computed(
  () =>
    newPassword.value.length >= 8 &&
    confirmPassword.value.length >= 8 &&
    newPassword.value === confirmPassword.value,
)

onMounted(async () => {
  try {
    const supabase = requireSupabase()
    const { data, error } = await supabase.auth.getSession()
    if (error || !data.session) {
      linkInvalid.value = true
    }
  } catch {
    linkInvalid.value = true
  } finally {
    initialising.value = false
  }
})

async function handleSubmit() {
  if (!canSubmit.value) return
  errorMessage.value = ''
  submitting.value = true
  try {
    const supabase = requireSupabase()
    const { error } = await supabase.auth.updateUser({ password: newPassword.value })
    if (error) throw error
    done.value = true
  } catch (e) {
    errorMessage.value = toUserMessage(e, 'Failed to update password. Please try again.')
  } finally {
    submitting.value = false
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
