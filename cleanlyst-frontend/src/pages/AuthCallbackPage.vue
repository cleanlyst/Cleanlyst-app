<template>
  <main class="callbackPage">
    <section class="callbackCard">
      <p class="eyebrow">Cleanlyst sign-in</p>
      <h1>{{ errorMessage ? 'We could not finish sign-in.' : 'Finalising your session...' }}</h1>
      <p>
        {{
          errorMessage
            ? errorMessage
            : 'Hold tight while we complete your authentication and take you to the right dashboard.'
        }}
      </p>
      <router-link v-if="errorMessage" :to="{ name: 'Login' }" class="blueButton">
        Back to login
      </router-link>
    </section>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const errorMessage = ref('')

onMounted(async () => {
  try {
    await auth.init()

    if (!auth.isAuthenticated) {
      errorMessage.value = 'Your session could not be verified. Please try signing in again.'
      return
    }

    const signupRole = route.query.signupRole
    if (signupRole === 'customer' || signupRole === 'cleaner_pending') {
      const businessName = route.query.businessName
      await auth.provisionOAuthSignup(
        signupRole,
        typeof businessName === 'string' ? businessName : undefined,
      )
    }

    const redirect = route.query.redirect
    if (typeof redirect === 'string' && isSafeRedirectPath(redirect) && auth.hasRole('customer')) {
      await router.replace(redirect)
      return
    }

    await router.replace({ name: auth.dashboardRouteName })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Something went wrong.'
  }
})

function isSafeRedirectPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//')
}
</script>

<style scoped>
.callbackPage {
  min-height: calc(100vh - 82px);
  display: grid;
  place-items: center;
  padding: 2rem 1rem 4rem;
  background:
    radial-gradient(circle at top, rgba(64, 138, 113, 0.18), transparent 28%),
    linear-gradient(180deg, #f7f2e9 0%, #efe7da 100%);
}

.callbackCard {
  width: min(560px, 100%);
  padding: 2rem;
  border-radius: 28px;
  background: rgba(255, 252, 246, 0.94);
  border: 1px solid rgba(16, 35, 61, 0.08);
  box-shadow: 0 24px 60px rgba(16, 35, 61, 0.08);
}

.eyebrow {
  margin: 0 0 1rem;
  color: rgba(16, 35, 61, 0.58);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.85rem;
}

h1 {
  margin: 0 0 0.75rem;
  color: #10233d;
}

p {
  color: #425168;
}
</style>
