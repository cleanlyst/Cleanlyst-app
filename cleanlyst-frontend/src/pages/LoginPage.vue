<template>
  <main class="row no-gutter">
    <div class="col-lg-7 login-img-container hide-mobile">
      <img :src="loginImage" alt="" class="login-image" />
    </div>
    <div class="col-lg-5 login-form-container">
      <div class="authContainer">
        <h1 class="authTitle">Welcome back!</h1>
        <p class="authSubtitle">
          Log in to your account to book a cleaner or manage your dashboard.
        </p>
      </div>
      <form class="authCard" @submit.prevent="handleSubmit">
        <label class="field">
          <span class="visually-hidden">Email</span>
          <input
            class="addressInput"
            v-model.trim="email"
            type="email"
            placeholder="you@example.com"
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
      </form>
      <div class="login-CTAs">
        <p v-if="errorMessage" class="message error">{{ errorMessage }}</p>

        <button class="submitButton greenButton" type="submit" :disabled="submitting">
          {{ submitting ? 'Please wait...' : 'Log in' }}
        </button>

        <p class="footnote">
          Don't have an account?
          <span class="text-underline">
            <router-link :to="{ name: 'Signup' }">Sign up</router-link>
          </span>
        </p>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import loginImage from '@/assets/landingpage.png'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const submitting = ref(false)
const errorMessage = ref('')

const redirectTarget = computed(() => {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/book'
})

async function handleSubmit() {
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

async function redirectAfterAuth() {
  if (auth.hasRole('cleaner')) {
    await router.replace({ name: 'CleanerDashboard' })
    return
  }

  await router.replace(redirectTarget.value)
}
</script>

<style scoped>
img.login-image {
  width: 100%;
  object-fit: cover;
  display: block;
}
form.authCard {
  display: grid;
  gap: 0.85rem;
  margin-top: 1.25rem;
  width: 75%;
  margin-bottom: 1rem;
}
.col-lg-5.login-form-container {
  padding: 10px 20px;
  margin: auto;
}

@media (max-width: 820px) {
}
</style>
