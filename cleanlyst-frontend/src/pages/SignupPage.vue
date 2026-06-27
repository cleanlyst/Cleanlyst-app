<template>
  <div
    class="sign-up-page-public-page bg-background font-body text-on-background min-h-screen flex flex-col"
  >
    <!-- TopNavBar Suppression: Page intent is Transactional/Sign-up. Manual simplified header instead -->

    <main class="flex-grow flex items-center justify-center pt-16 pb-12">
      <div
        class="max-w-7xl w-full px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center"
      >
        <!-- Left Side: Visual/Branding Shell -->
        <div class="hidden lg:block">
          <div class="space-y-8">
            <h1 class="font-h1 text-h1 text-primary">
              Join the marketplace for professional cleaning services.
            </h1>
            <p class="font-body text-body text-on-surface-variant max-w-md">
              Sign up to book trusted local cleaners or apply to offer your services on Cleanlyst..
            </p>
            <div
              class="relative aspect-square w-full max-w-md bg-surface-container overflow-hidden"
            >
              <img
                class="absolute inset-0 w-full h-full object-cover grayscale opacity-80"
                alt=""
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAi9WKMyTocpt1FaHZWUn3zCSEGI_KAdvsTmAoMFZqojEAHiWEMbDspaX-m_JUdl4vebaL6SZZyCyB0eABNOmYRpMGYoRFFHoYTs5lndSCdcDoPHQ0igq8dS7TWPXW8nxxeAYlhnBzHjf662bqLi1XGuigviye5he8ceRQVnDHf2bKaM-G6u1NBL6Hu2ZRmKdSdhFkcmKSq1KxVh_NPcZZNMYbryhBeIdJmijbVCuUc54hYJp1_vPaC2kNcfeUh8LpsyttiGaz00Q"
              />
            </div>
          </div>
        </div>
        <!-- Right Side: Sign-Up Form Shell -->
        <div class="w-full max-w-md mx-auto">
          <div class="bg-surface-container-lowest p-8 border border-outline-variant">
            <div class="mb-8">
              <h2 class="font-h2 text-h2 mb-2">Create Account</h2>
              <p class="font-label-md text-label-md text-secondary">
                Start your journey with Cleanlyst today.
              </p>
            </div>
            <form class="space-y-6" @submit.prevent="handleSignup">
              <!-- Role Selection -->
              <fieldset class="space-y-3 border-0 p-0 m-0">
                <legend class="font-label-md text-label-md text-on-surface-variant">
                  Choose your role
                </legend>
                <div class="grid grid-cols-2 gap-4">
                  <label
                    class="relative flex flex-col items-center justify-center p-4 border border-outline-variant cursor-pointer hover:bg-surface-container transition-colors active:scale-[0.98]"
                  >
                    <input
                      class="sr-only peer"
                      name="role"
                      type="radio"
                      value="customer"
                      v-model="selectedRole"
                    />
                    <span
                      class="material-symbols-outlined mb-2 text-zinc-400 peer-checked:text-primary"
                      >person</span
                    >
                    <span class="font-label-md text-label-md">Customer</span>
                    <div
                      class="absolute inset-0 border-2 border-transparent peer-checked:border-primary"
                    ></div>
                  </label>
                  <label
                    class="relative flex flex-col items-center justify-center p-4 border border-outline-variant cursor-pointer hover:bg-surface-container transition-colors active:scale-[0.98]"
                  >
                    <input
                      class="sr-only peer"
                      name="role"
                      type="radio"
                      value="cleaner"
                      v-model="selectedRole"
                    />
                    <span
                      class="material-symbols-outlined mb-2 text-zinc-400 peer-checked:text-primary"
                      >cleaning_services</span
                    >
                    <span class="font-label-md text-label-md">Cleaner</span>
                    <div
                      class="absolute inset-0 border-2 border-transparent peer-checked:border-primary"
                    ></div>
                  </label>
                </div>
              </fieldset>
              <!-- Email Input -->
              <div class="space-y-2">
                <label class="font-label-md text-label-md text-on-surface-variant" for="email"
                  >Email Address</label
                >
                <input
                  class="w-full px-3 py-3 border border-outline-variant focus:border-primary focus:ring-0 transition-colors bg-white"
                  id="email"
                  placeholder="name@example.com"
                  required
                  type="email"
                  v-model="email"
                />
              </div>
              <!-- Password Input -->
              <div class="space-y-2">
                <label class="font-label-md text-label-md text-on-surface-variant" for="password"
                  >Password</label
                >
                <input
                  class="w-full px-3 py-3 border border-outline-variant focus:border-primary focus:ring-0 transition-colors bg-white"
                  id="password"
                  placeholder="••••••••"
                  required
                  minlength="8"
                  type="password"
                  v-model="password"
                />
                <p class="font-caption text-caption text-zinc-500">
                  Must be at least 8 characters.
                </p>
              </div>
              <!-- Business Name -->
              <div v-if="selectedRole === 'cleaner'" class="space-y-2">
                <label
                  class="font-label-md text-label-md text-on-surface-variant"
                  for="businessName"
                  >Business Name</label
                >
                <input
                  class="w-full px-3 py-3 border border-outline-variant focus:border-primary focus:ring-0 transition-colors bg-white"
                  id="businessName"
                  placeholder="Your business name"
                  required
                  type="text"
                  v-model="businessName"
                />
              </div>
              <p v-if="errorMessage" class="font-caption text-caption text-error">
                {{ errorMessage }}
              </p>
              <p v-if="successMessage" class="font-caption text-caption text-secondary">
                {{ successMessage }}
              </p>
              <!-- Primary CTA -->
              <button
                class="w-full bg-primary text-white py-4 font-label-md text-label-md transition-opacity hover:opacity-90 active:scale-[0.98]"
                :disabled="submitting"
                type="submit"
              >
                {{ submitting ? 'Creating account...' : 'Create account' }}
              </button>
              <div class="relative flex items-center py-2">
                <div class="flex-grow border-t border-outline-variant"></div>
                <span class="flex-shrink mx-4 font-caption text-caption text-zinc-400">OR</span>
                <div class="flex-grow border-t border-outline-variant"></div>
              </div>
              <!-- Google Sign-In -->
              <button
                class="w-full flex items-center justify-center gap-3 border border-outline-variant py-4 font-label-md text-label-md hover:bg-surface-container transition-colors active:scale-[0.98]"
                :disabled="submitting"
                @click="handleGoogleSignup"
                type="button"
              >
                <svg class="w-5 h-5" viewbox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  ></path>
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  ></path>
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  ></path>
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  ></path>
                </svg>
                Sign up with Google
              </button>
            </form>
            <div class="mt-8 text-center">
              <p class="font-caption text-caption text-zinc-500">
                By creating an account, you agree to our
                <router-link class="underline hover:text-primary" :to="{ name: 'TermsOfService' }">
                  Terms of Service
                </router-link>
                and
                <router-link class="underline hover:text-primary" :to="{ name: 'PrivacyPolicy' }">
                  Privacy Policy
                </router-link>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>

    <div
      v-if="errorMessage"
      class="fixed bottom-8 left-8 z-[100] bg-primary text-white p-4 flex items-center justify-between gap-6 min-w-[300px] shadow-lg"
    >
      <span class="font-label-md text-label-md">{{ errorMessage }}</span>
      <button class="material-symbols-outlined text-sm hover:opacity-70" @click="errorMessage = ''">
        close
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

type SignupRole = 'customer' | 'cleaner'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const selectedRole = ref<SignupRole>(route.name === 'SignupCleaner' ? 'cleaner' : 'customer')
const email = ref('')
const password = ref('')
const businessName = ref('')
const submitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const redirectTarget = computed(() => {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && isSafeRedirectPath(redirect) ? redirect : undefined
})

function isSafeRedirectPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//')
}

watch(
  () => route.name,
  (routeName) => {
    selectedRole.value = routeName === 'SignupCleaner' ? 'cleaner' : 'customer'
  },
  { immediate: true },
)

async function handleSignup() {
  errorMessage.value = ''
  successMessage.value = ''

  if (selectedRole.value === 'cleaner' && !businessName.value.trim()) {
    errorMessage.value = 'Please enter your business name.'
    return
  }

  submitting.value = true

  try {
    const publicRole = selectedRole.value === 'cleaner' ? 'cleaner_pending' : 'customer'
    const profileName =
      selectedRole.value === 'cleaner'
        ? businessName.value.trim()
        : email.value.split('@')[0] || 'New User'

    await auth.signUp(
      email.value,
      password.value,
      profileName,
      publicRole,
      selectedRole.value === 'cleaner' ? businessName.value.trim() : undefined,
    )
    await auth.init()

    if (auth.isAuthenticated) {
      await redirectAfterAuth()
      return
    }

    // Email confirmation required — Supabase did not create a session yet.
    await router.replace({ name: 'VerifyEmail', query: { email: email.value } })
    password.value = ''
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Something went wrong.'
  } finally {
    submitting.value = false
  }
}

async function handleGoogleSignup() {
  errorMessage.value = ''
  successMessage.value = ''

  if (selectedRole.value === 'cleaner' && !businessName.value.trim()) {
    errorMessage.value = 'Please enter your business name.'
    return
  }

  submitting.value = true

  try {
    const publicRole = selectedRole.value === 'cleaner' ? 'cleaner_pending' : 'customer'
    await auth.signInWithGoogle(
      redirectTarget.value,
      publicRole,
      selectedRole.value === 'cleaner' ? businessName.value.trim() : undefined,
    )
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Google sign-in could not be started.'
    submitting.value = false
  }
}

async function redirectAfterAuth() {
  if (redirectTarget.value && auth.hasRole('customer')) {
    await router.replace(redirectTarget.value)
    return
  }

  if (auth.hasRole('customer')) {
    await router.replace({ name: 'CustomerDashboard' })
    return
  }

  await router.replace({ name: auth.dashboardRouteName })
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
.space-y-6 > :not([hidden]) ~ :not([hidden]) {
  --tw-space-y-reverse: 0;
  margin-top: calc(1.5rem * calc(1 - var(--tw-space-y-reverse)));
  margin-bottom: calc(1.5rem * var(--tw-space-y-reverse));
}
.transition-opacity {
  transition-property: opacity;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}
</style>
