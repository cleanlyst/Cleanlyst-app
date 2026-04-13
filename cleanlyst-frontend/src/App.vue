<template>
  <div class="navbar">
    <nav class="headerNav">
      <div class="navGroup">
        <router-link :to="{ name: 'Home' }" class="brandLink">
          <img src="/logo.png" alt="Cleanlyst logo" class="brandLogo" />
          <span class="brandName">Cleanlyst</span>
        </router-link>
      </div>

      <div class="navGroup navActions">
        <router-link :to="{ name: 'Home' }" class="navLink">Home</router-link>
        <router-link v-if="auth.hasRole('customer')" :to="{ name: 'BookCleaner' }" class="navLink">
          Book
        </router-link>
        <router-link v-if="auth.hasRole('cleaner')" :to="{ name: 'CleanerDashboard' }" class="navLink">
          Dashboard
        </router-link>
        <router-link v-if="!auth.isAuthenticated" :to="{ name: 'Auth' }" class="navLink navButton">
          Sign in
        </router-link>
        <button v-else class="navLink navButton ghostButton" type="button" @click="handleSignOut">
          Sign out
        </button>
      </div>
    </nav>
  </div>

  <router-view />
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

async function handleSignOut() {
  await auth.signOut()
  await router.push({ name: 'Home' })
}
</script>

<style scoped>
.navbar {
  position: sticky;
  top: 0;
  z-index: 20;
  background: rgba(246, 241, 233, 0.92);
  backdrop-filter: blur(18px);
  border-bottom: 1px solid rgba(35, 45, 63, 0.08);
}

.headerNav {
  width: min(1120px, calc(100% - 2rem));
  min-height: 82px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.navGroup {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.navActions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.brandLink {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  color: #10233d;
}

.brandLogo {
  width: 42px;
  height: 42px;
  object-fit: contain;
}

.brandName {
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.navLink {
  color: #20314d;
  font-weight: 600;
}

.navButton {
  padding: 0.75rem 1rem;
  border-radius: 999px;
  background: #10233d;
  color: #f7f3eb;
}

.ghostButton {
  border: 0;
  cursor: pointer;
}

@media (max-width: 720px) {
  .headerNav {
    padding: 0.75rem 0;
    align-items: flex-start;
    flex-direction: column;
  }

  .navActions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
