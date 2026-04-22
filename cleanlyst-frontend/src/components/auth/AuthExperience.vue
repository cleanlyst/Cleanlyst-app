<template>
  <div class="row no-gutter">
    <section class="col-lg-7 logo-container hide-mobile">
      <img :src="logoImage" alt="" class="logo-image" />
    </section>
    <section class="col-lg-5 form-container">
      <h2 class="h6">
        {{ isSignup ? 'Create your account' : 'Welcome back' }}
      </h2>
      <form class="authCard" @submit.prevent="handleSubmit">
        <label v-if="isSignup" class="field">
          <span class="visually-hidden">Full name</span>
          <input
            class="addressInput"
            v-model.trim="fullName"
            type="text"
            placeholder="Jane Doe"
            required
          />
        </label>

        <label class="field">
          <span class="visually-hidden">Email</span>
          <input
            class="addressInput"
            v-model.trim="email"
            type="email"
            placeholder="please enter a valid email address"
            required
          />
        </label>

        <label class="field">
          <span class="visually-hidden">Password</span>
          <input
            class="addressInput"
            v-model="password"
            type="password"
            placeholder="At least 6 characters"
            required
          />
        </label>

        <p v-if="errorMessage" class="message error">{{ errorMessage }}</p>
        <p v-if="successMessage" class="message success">{{ successMessage }}</p>

        <button class="greenButton" type="submit" :disabled="submitting">
          {{ submitting ? 'Please wait...' : submitLabel }}
        </button>

        <div class="divider"><span>or continue with</span></div>

        <button class="googleButton" type="button" :disabled="submitting" @click="handleGoogleAuth">
          Google
        </button>

        <div class="footnoteGroup">
          <p class="footnote">
            <span>{{ primaryLinkPrompt }}</span>
            <router-link class="textLink" :to="primaryLinkTo">{{ primaryLinkLabel }}</router-link>
          </p>

          <p v-if="secondaryLinkLabel" class="footnote">
            <span>{{ secondaryLinkPrompt }}</span>
            <router-link class="textLink" :to="secondaryLinkTo">{{
              secondaryLinkLabel
            }}</router-link>
          </p>
        </div>
      </form>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import logoImage from '@/assets/home.jpg'

type AuthVariant = 'login' | 'customer-signup' | 'cleaner-signup'

const props = withDefaults(
  defineProps<{
    variant?: AuthVariant
  }>(),
  {
    variant: 'login',
  },
)

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const fullName = ref('')
const email = ref('')
const password = ref('')
const submitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const isSignup = computed(() => props.variant !== 'login')
const signupRole = computed<'customer' | 'cleaner' | null>(() => {
  if (props.variant === 'customer-signup') return 'customer'
  if (props.variant === 'cleaner-signup') return 'cleaner'
  return null
})
const redirectTarget = computed(() => {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && redirect.startsWith('/') ? redirect : undefined
})

const submitLabel = computed(() =>
  props.variant === 'login'
    ? 'Sign in'
    : props.variant === 'cleaner-signup'
      ? 'Create cleaner account'
      : 'Create customer account',
)

const primaryLinkPrompt = computed(() => {
  switch (props.variant) {
    case 'customer-signup':
      return 'Already have an account?'
    case 'cleaner-signup':
      return 'Already have an account?'
    default:
      return 'Need a customer account?'
  }
})

const primaryLinkLabel = computed(() => {
  switch (props.variant) {
    case 'customer-signup':
    case 'cleaner-signup':
      return 'Log in'
    default:
      return 'Register as a customer'
  }
})

const primaryLinkTo = computed<RouteLocationRaw>(() => {
  switch (props.variant) {
    case 'customer-signup':
    case 'cleaner-signup':
      return { name: 'Login' }
    default:
      return { name: 'SignupCustomer' }
  }
})

const secondaryLinkPrompt = computed(() => {
  switch (props.variant) {
    case 'customer-signup':
      return 'Join Cleanlyst trusted cleaners?'
    case 'cleaner-signup':
      return 'Looking for a customer account instead?'
    default:
      return 'Want to join as a cleaner?'
  }
})

const secondaryLinkLabel = computed(() => {
  switch (props.variant) {
    case 'customer-signup':
      return 'Create a cleaner account'
    case 'cleaner-signup':
      return 'Create a customer account'
    default:
      return 'Register as a cleaner'
  }
})

const secondaryLinkTo = computed<RouteLocationRaw>(() => {
  switch (props.variant) {
    case 'customer-signup':
    default:
      return { name: 'SignupCleaner' }
    case 'cleaner-signup':
      return { name: 'SignupCustomer' }
  }
})

async function handleSubmit() {
  errorMessage.value = ''
  successMessage.value = ''
  submitting.value = true

  try {
    if (!isSignup.value) {
      await auth.signIn(email.value, password.value)
      await redirectAfterAuth()
      return
    }

    await auth.signUp(email.value, password.value, fullName.value, signupRole.value ?? 'customer')
    await auth.init()

    if (auth.isAuthenticated) {
      await redirectAfterAuth()
      return
    }

    successMessage.value =
      'Account created. Check your inbox if email verification is enabled, then sign in.'
    password.value = ''
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Something went wrong.'
  } finally {
    submitting.value = false
  }
}

async function handleGoogleAuth() {
  errorMessage.value = ''
  successMessage.value = ''
  submitting.value = true

  try {
    await auth.signInWithGoogle(redirectTarget.value, signupRole.value ?? undefined)
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

<style scoped>
.logo-container,
.form-container {
  max-height: calc(90vh - 90px);
}

.logo-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.form-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}
.authCard input {
  margin: 10px 0;
}
form.authCard {
  display: flex;
  flex-direction: column;
}

.submitButton:disabled {
  opacity: 0.7;
  cursor: progress;
}

.googleButton {
  width: 100%;
  min-height: 48px;
  margin-top: 1rem;
  border: 1px solid var(--black);
  border-radius: 999px;
  background: var(--white);
  color: var(--black);
  font-weight: 600;
  cursor: pointer;
}

.divider {
  display: flex;
  align-items: center;
  margin: 1.5rem 0;
  color: var(--black);
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--black);
}

.message {
  margin: 0.5rem 0 0;
  padding: 0.8rem 1rem;
  border-radius: 14px;
  font-weight: 600;
}

.error {
  background: rgba(204, 63, 70, 0.1);
  color: var(--red);
}

.success {
  background: rgba(36, 124, 85, 0.12);
  color: var(--green);
}

.footnoteGroup {
  margin-top: 1.5rem;
  text-align: center;
}

.footnote {
  margin: 0.5rem 0;
  color: #56657b;
}

.textLink {
  color: #cf5d34;
  font-weight: 700;
  text-decoration: none;
}

.textLink:hover {
  text-decoration: underline;
}
@media (max-width: 768px) {
  .form-container {
    height: calc(100vh - 90px);
    padding: 0.5rem;
  }
}
</style>
