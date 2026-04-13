<template>
  <main class="authPage">
    <section class="authShell">
      <div class="authIntro">
        <p class="eyebrow">Cleanlyst account access</p>
        <h1>{{ mode === 'signin' ? 'Welcome back.' : 'Create your account.' }}</h1>
        <p>
          {{ mode === 'signin'
            ? 'Sign in to request a cleaner or manage your bookings.'
            : 'Choose the account type that matches how you will use Cleanlyst.' }}
        </p>

        <div class="switchRow">
          <button
            class="switchButton"
            :class="{ active: mode === 'signin' }"
            type="button"
            @click="setMode('signin')"
          >
            Sign in
          </button>
          <button
            class="switchButton"
            :class="{ active: mode === 'signup' }"
            type="button"
            @click="setMode('signup')"
          >
            Sign up
          </button>
        </div>
      </div>

      <form class="authCard" @submit.prevent="handleSubmit">
        <label v-if="mode === 'signup'" class="field">
          <span>Full name</span>
          <input v-model.trim="fullName" type="text" placeholder="Jane Doe" required />
        </label>

        <label class="field">
          <span>Email</span>
          <input v-model.trim="email" type="email" placeholder="you@example.com" required />
        </label>

        <label class="field">
          <span>Password</span>
          <input v-model="password" type="password" placeholder="At least 6 characters" required />
        </label>

        <label v-if="mode === 'signup'" class="field">
          <span>I am joining as</span>
          <select v-model="role">
            <option value="customer">Customer</option>
            <option value="cleaner">Cleaner</option>
          </select>
        </label>

        <p v-if="errorMessage" class="message error">{{ errorMessage }}</p>
        <p v-if="successMessage" class="message success">{{ successMessage }}</p>

        <button class="submitButton" type="submit" :disabled="submitting">
          {{ submitting ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account' }}
        </button>

        <p class="footnote">
          {{ mode === 'signin' ? 'Need an account?' : 'Already registered?' }}
          <button class="textButton" type="button" @click="setMode(mode === 'signin' ? 'signup' : 'signin')">
            {{ mode === 'signin' ? 'Create one here' : 'Sign in instead' }}
          </button>
        </p>
      </form>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore, type Role } from '@/stores/auth'

type AuthMode = 'signin' | 'signup'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const mode = ref<AuthMode>((route.query.mode as AuthMode) === 'signup' ? 'signup' : 'signin')
const fullName = ref('')
const email = ref('')
const password = ref('')
const role = ref<Role>('customer')
const submitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const redirectTarget = computed(() => {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/book'
})

function setMode(nextMode: AuthMode) {
  mode.value = nextMode
  errorMessage.value = ''
  successMessage.value = ''
}

async function handleSubmit() {
  errorMessage.value = ''
  successMessage.value = ''
  submitting.value = true

  try {
    if (mode.value === 'signin') {
      await auth.signIn(email.value, password.value)
      await redirectAfterAuth()
      return
    }

    await auth.signUp(email.value, password.value, fullName.value, role.value)
    await auth.init()

    if (auth.isAuthenticated) {
      await redirectAfterAuth()
      return
    }

    successMessage.value = 'Account created. You can sign in now.'
    mode.value = 'signin'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Something went wrong.'
  } finally {
    submitting.value = false
  }
}

async function redirectAfterAuth() {
  if (auth.hasRole('cleaner')) {
    await router.replace({ name: 'CleanerDashboard' })
    return
  }

  await router.replace(redirectTarget.value)
}
</script>

<style scoped>
.authPage {
  min-height: calc(100vh - 82px);
  padding: 2rem 1rem 4rem;
  background:
    radial-gradient(circle at top, rgba(230, 117, 71, 0.18), transparent 28%),
    linear-gradient(180deg, #f7f2e9 0%, #efe7da 100%);
}

.authShell {
  width: min(980px, 100%);
  margin: 0 auto;
  display: grid;
  grid-template-columns: 0.9fr 1.1fr;
  gap: 1.5rem;
}

.authIntro,
.authCard {
  padding: 2rem;
  border-radius: 28px;
  border: 1px solid rgba(16, 35, 61, 0.08);
  box-shadow: 0 24px 60px rgba(16, 35, 61, 0.08);
}

.authIntro {
  background: linear-gradient(180deg, #10233d 0%, #1b3558 100%);
  color: #f7f2e9;
}

.authCard {
  background: rgba(255, 252, 246, 0.92);
}

.eyebrow {
  margin: 0 0 1rem;
  color: rgba(247, 242, 233, 0.72);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.85rem;
}

h1 {
  margin: 0;
  font-size: clamp(2.1rem, 4vw, 3.4rem);
  line-height: 1;
}

.authIntro p:last-of-type {
  line-height: 1.7;
  color: rgba(247, 242, 233, 0.84);
}

.switchRow {
  display: inline-flex;
  gap: 0.75rem;
  margin-top: 1.5rem;
  padding: 0.4rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
}

.switchButton {
  border: 0;
  padding: 0.7rem 1rem;
  border-radius: 999px;
  background: transparent;
  color: rgba(247, 242, 233, 0.82);
  font-weight: 700;
  cursor: pointer;
}

.switchButton.active {
  background: #f7f2e9;
  color: #10233d;
}

.field {
  display: grid;
  gap: 0.45rem;
  margin-bottom: 1rem;
  color: #20314d;
  font-weight: 600;
}

.field input,
.field select {
  width: 100%;
  min-height: 50px;
  padding: 0.85rem 1rem;
  border: 1px solid rgba(32, 49, 77, 0.12);
  border-radius: 16px;
  background: #fffdf8;
}

.submitButton {
  width: 100%;
  min-height: 52px;
  margin-top: 0.5rem;
  border: 0;
  border-radius: 999px;
  background: #10233d;
  color: #f7f2e9;
  font-weight: 700;
  cursor: pointer;
}

.submitButton:disabled {
  opacity: 0.7;
  cursor: progress;
}

.message {
  margin: 0.5rem 0 0;
  padding: 0.8rem 1rem;
  border-radius: 14px;
  font-weight: 600;
}

.error {
  background: rgba(204, 63, 70, 0.1);
  color: #a32a30;
}

.success {
  background: rgba(36, 124, 85, 0.12);
  color: #1f6f4b;
}

.footnote {
  margin: 1rem 0 0;
  color: #56657b;
}

.textButton {
  border: 0;
  padding: 0;
  background: transparent;
  color: #cf5d34;
  font-weight: 700;
  cursor: pointer;
}

@media (max-width: 820px) {
  .authShell {
    grid-template-columns: 1fr;
  }
}
</style>
