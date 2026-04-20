<template>
  <main class="row no-gutter">
    <div class="col-lg-7 login-img-container hide-mobile">
      <img :src="signUpImage" alt="" class="sign-up-image" />
    </div>
    <div class="col-lg-5 signup-form-container">
      <div class="authContainer">
        <h1>Create your account.</h1>
        <p>Choose the account type that matches how you will use Cleanlyst.</p>
      </div>

      <form class="authCard" @submit.prevent="handleSubmit">
        <label class="field">
          <span>Full name</span>
          <input
            class="addressInput"
            v-model.trim="fullName"
            type="text"
            placeholder="Jane Doe"
            required
          />
        </label>

        <label class="field">
          <span>Email</span>
          <input
            class="addressInput"
            v-model.trim="email"
            type="email"
            placeholder="you@example.com"
            required
          />
        </label>

        <label class="field">
          <span>Password</span>
          <input
            class="addressInput"
            v-model="password"
            type="password"
            placeholder="At least 6 characters"
            required
          />
        </label>

        <label class="field">
          <span>I am joining as</span>
          <select v-model="role" class="selectInput" required>
            <option value="customer">Customer</option>
            <option value="cleaner">Cleaner</option>
          </select>
        </label>
      </form>

      <div class="signup-CTAs">
        <p v-if="errorMessage" class="message error">{{ errorMessage }}</p>
        <p v-if="successMessage" class="message success">{{ successMessage }}</p>

        <button class="submitButton greenButton" type="submit" :disabled="submitting">
          {{ submitting ? 'Please wait...' : 'Sign up' }}
        </button>

        <p class="footnote">
          Already have an account?
          <router-link class="textButton" :to="{ name: 'Login' }">Log in</router-link>
        </p>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore, type Role } from '@/stores/auth'
import signUpImage from '@/assets/landingpage.png'

const router = useRouter()
const auth = useAuthStore()

const fullName = ref('')
const email = ref('')
const password = ref('')
const role = ref<Role>('customer')
const submitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

async function handleSubmit() {
  errorMessage.value = ''
  successMessage.value = ''
  submitting.value = true

  try {
    await auth.signUp(email.value, password.value, fullName.value, role.value)
    await auth.init()

    if (auth.isAuthenticated) {
      if (auth.hasRole('cleaner')) {
        await router.replace({ name: 'CleanerDashboard' })
        return
      }
      await router.replace('/book')
      return
    }

    successMessage.value = 'Account created. You can log in now.'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Something went wrong.'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
img.sign-up-image {
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
.col-lg-5.signup-form-container {
  padding: 10px 20px;
  margin: auto;
}
.selectInput {
  padding: 0.4rem;
  border: 1px solid var(--green);
  border-radius: 18px;
  background: var(--white);
  color: var(--black);
  margin-left: 0.5rem;
}

@media (max-width: 820px) {
  .authShell {
    grid-template-columns: 1fr;
  }
}
</style>
