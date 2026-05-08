<template>
  <div class="log-in-page-public-page font-body text-body text-on-background">
    <main class="min-h-screen flex items-center justify-center px-gutter py-20">
      <div
        class="grid lg:grid-cols-2 max-w-container-max w-full bg-surface-container-lowest border border-outline-variant shadow-sm overflow-hidden"
      >
        <div class="hidden lg:flex flex-col justify-between p-12 bg-primary text-on-primary">
          <div>
            <h1 class="font-h1 text-h1 tracking-tighter mb-4">Cleanlyst</h1>
            <p class="font-body text-body opacity-80 max-w-sm">
              The most reliable marketplace for professional cleaning services. Simple booking,
              vetted experts, and a spotless home guaranteed.
            </p>
          </div>
          <div class="space-y-stack-gap">
            <div class="h-px bg-on-primary opacity-20 w-full"></div>
          </div>
          <div class="relative w-full aspect-square mt-8">
            <img
              alt="Abstract minimalist architecture"
              class="object-cover w-full h-full grayscale opacity-40 mix-blend-luminosity"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuA_gSxOjujQ8C5yjVzojJVtGIM8jIxivH5aFvvLt9Gt2cJosIwafpI-4fUmf-MDmIiRHDWc021XCjGRlMBLi1nkEW70gx8fkFsKSm-RG8pvcHIH9Fyk15qcPn-9zunSHzmov_mNpAT07efEXRPzrxxpNyDTZNagm4wureS9y_oDM6kzctSnN4Vk6P3vo1IN67DdHLMQb1hoP3kdQ947pTVj0UtyhdA-vFHjTR-jpRnS9dpOk_d56m69HtAMV256h2dIsfpHuh9GRw"
            />
          </div>
        </div>
        <!-- Login Form Section -->
        <div class="flex flex-col justify-center p-8 lg:p-24 bg-surface-container-lowest">
          <div class="max-w-md mx-auto w-full">
            <div class="mb-12">
              <h2 class="font-h1 text-h1 text-on-surface mb-2">Welcome Back</h2>
              <p class="font-body text-body text-secondary">
                Log in to manage your bookings, messages, and account details.
              </p>
            </div>
            <!-- Social Login -->
            <button
              class="w-full flex items-center justify-center gap-3 py-3 px-4 border border-outline-variant hover:bg-surface-container transition-colors duration-200 group active:scale-[0.98]"
              :disabled="submitting"
              @click="handleGoogleAuth"
              type="button"
            >
              <img
                alt="Google"
                class="w-5 h-5 grayscale group-hover:grayscale-0 transition-all"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDpxCpiABLfB7lHiTFKBPTl2kUV5_7RgY6k99XfGLdyfCNUu47txGEYYp5CH0EyRFqMS7D9u36rUwwS9fE-ncvweBs-aUXmw7wloCg49czGM8iFXS6dAGzOxedNQDMOSV5B-dlXhBxC6jwH_QLvG8Gsmqhz90exSyNVBdNlRd8SR-56TySl3atEe6ltyYr7HfkcLQB_Al1OS_mZrhDAP-chqRqiA3xw97b3V5maYJmZpkUgBY17THKPB4NrIfEIA5lwNcnVH1--1g"
              />
              <span class="font-label-md text-label-md text-on-surface">Continue with Google</span>
            </button>
            <div class="relative my-8">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-outline-variant"></div>
              </div>
              <div class="relative flex justify-center text-caption uppercase tracking-widest">
                <span class="bg-surface-container-lowest px-4 text-secondary">or use email</span>
              </div>
            </div>
            <!-- Standard Form -->
            <form class="space-y-6" @submit.prevent="handleLogin">
              <div>
                <label class="block font-label-md text-label-md text-on-surface mb-2" for="email"
                  >Email Address</label
                >
                <input
                  class="w-full px-4 py-3 border border-outline-variant focus:border-primary focus:ring-0 transition-colors outline-none font-body text-body bg-transparent"
                  id="email"
                  name="email"
                  placeholder="name@company.com"
                  required
                  type="email"
                  v-model="email"
                />
              </div>
              <div>
                <div class="flex justify-between items-center mb-2">
                  <label class="block font-label-md text-label-md text-on-surface" for="password"
                    >Password</label
                  >
                  <a
                    class="font-caption text-caption text-secondary hover:text-primary underline"
                    href="mailto:support@cleanlyst.app?subject=Password%20reset"
                    >Forgot password?</a
                  >
                </div>
                <input
                  class="w-full px-4 py-3 border border-outline-variant focus:border-primary focus:ring-0 transition-colors outline-none font-body text-body bg-transparent"
                  id="password"
                  name="password"
                  placeholder="••••••••"
                  required
                  type="password"
                  v-model="password"
                />
              </div>
              <p v-if="errorMessage" class="font-caption text-caption text-error">
                {{ errorMessage }}
              </p>
              <button
                class="w-full bg-primary text-on-primary py-4 px-6 font-label-md text-label-md hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                :disabled="submitting"
                type="submit"
              >
                {{ submitting ? 'Logging in...' : 'Log In' }}
                <span class="material-symbols-outlined text-sm" data-icon="arrow_forward"
                  >arrow_forward</span
                >
              </button>
            </form>
            <div class="mt-12 pt-8 border-t border-outline-variant text-center">
              <p class="font-caption text-caption text-secondary">
                Don't have an account?
                <router-link
                  class="text-primary font-label-md hover:underline ml-1"
                  :to="{ name: 'SignupCustomer' }"
                  >Create an account</router-link
                >
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
    <!-- Contextual Toast Notification (Design System Element) -->
    <div
      v-if="errorMessage"
      class="fixed bottom-gutter left-gutter bg-primary text-on-primary px-6 py-4 flex items-center gap-4 shadow-lg transition-all duration-300"
      id="toast"
    >
      <span class="material-symbols-outlined" data-icon="info">info</span>
      <p class="font-label-md text-label-md">{{ errorMessage }}</p>
      <button class="ml-4 opacity-50 hover:opacity-100" @click="errorMessage = ''">
        <span class="material-symbols-outlined text-sm" data-icon="close">close</span>
      </button>
    </div>
    <!-- Script to show toast for wireframe demo purposes -->
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const submitting = ref(false)
const errorMessage = ref('')

const redirectTarget = computed(() => {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && isSafeRedirectPath(redirect) ? redirect : undefined
})

function isSafeRedirectPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//')
}

async function handleLogin() {
  errorMessage.value = ''
  submitting.value = true

  try {
    await auth.signIn(email.value, password.value)
    await redirectAfterAuth()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Something went wrong.'
  } finally {
    submitting.value = false
  }
}

async function handleGoogleAuth() {
  errorMessage.value = ''
  submitting.value = true

  try {
    await auth.signInWithGoogle(redirectTarget.value)
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

  await router.replace({ name: auth.dashboardRouteName })
}
</script>
