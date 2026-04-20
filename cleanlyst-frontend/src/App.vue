<template>
  <div class="navbar">
    <nav class="headerNav">
      <div class="navGroup">
        <router-link :to="{ name: 'Home' }" class="brandLink">
          <img src="/logo.svg" alt="Cleanlyst logo" class="brandLogo" />
        </router-link>
      </div>

      <!-- Desktop Navigation -->
      <div class="navGroup hide-mobile">
        <router-link :to="{ name: 'Home' }" class="navLink">Home</router-link>
        <router-link :to="{ name: 'Contact' }" class="navLink">Contact Us</router-link>
        <router-link :to="{ name: 'Services' }" class="navLink">Services</router-link>
      </div>

      <div class="navGroup navActions hide-mobile">
        <router-link v-if="auth.hasRole('customer')" :to="{ name: 'BookCleaner' }" class="navLink">
          Book
        </router-link>
        <router-link
          v-if="auth.hasRole('cleaner')"
          :to="{ name: 'CleanerDashboard' }"
          class="navLink"
        >
          Dashboard
        </router-link>
        <router-link v-if="!auth.isAuthenticated" :to="{ name: 'Auth' }" class="blueButton">
          Log in
        </router-link>
        <router-link v-if="!auth.isAuthenticated" :to="{ name: 'Auth' }" class="greenButton">
          Register
        </router-link>
        <button v-else class="navLink navButton ghostButton" type="button" @click="handleSignOut">
          Sign out
        </button>
      </div>

      <div class="mobileNavLinks hide-desktop">
        <router-link
          v-for="item in mobileActionItems"
          :key="`${item.name}-${item.label}`"
          :to="{ name: item.name }"
          :class="{ active: route.name === item.name }"
        >
          <span class="blue-text">{{ item.label }}</span>
        </router-link>

        <button
          v-if="auth.isAuthenticated"
          class="breadcrumbLink breadcrumbAction ghostButton"
          type="button"
          @click="handleSignOut"
        >
          Sign out
        </button>
      </div>

      <div class="breadcrumb hide-desktop" @click.stop="toggleNav">
        <div class="bar1"></div>
        <div class="bar2"></div>
        <div class="bar3"></div>
      </div>
    </nav>

    <!-- Mobile Navigation -->
    <div class="mobileBreadcrumb hide-desktop text-center" :class="{ open: open }">
      <div class="close-container">
        <span class="close white-text pointer" @click="toggleNav">&times;</span>
      </div>

      <div class="breadCrumbLinks">
        <router-link
          v-for="item in mobileNavItems"
          :key="item.name"
          :to="{ name: item.name }"
          class="breadcrumbLink white-text"
          @click="toggleNav"
          :class="{ active: route.name === item.name }"
        >
          {{ item.label }}
        </router-link>
      </div>
    </div>
  </div>

  <router-view />
  <FooterPage />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import FooterPage from '@/components/FooterPage.vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const open = ref(false)

function toggleNav() {
  open.value = !open.value
  document.body.classList.toggle('open', open.value)
}

const mobileNavItems = [
  { name: 'Home', label: 'Home' },
  { name: 'Contact', label: 'Contact' },
  { name: 'Services', label: 'Services' },
] as const

const mobileActionItems = computed(() => {
  const items: Array<{ name: string; label: string }> = []

  if (auth.hasRole('customer')) {
    items.push({ name: 'BookCleaner', label: 'Book' })
  }

  if (auth.hasRole('cleaner')) {
    items.push({ name: 'CleanerDashboard', label: 'Dashboard' })
  }

  if (!auth.isAuthenticated) {
    items.push({ name: 'Auth', label: 'Log in' })
    items.push({ name: 'Auth', label: 'Register' })
  }

  return items
})

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
  background: var(--white);
  border-bottom: 1px solid rgba(35, 45, 63, 0.08);
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
  color: var(--blue);
}

.brandLogo {
  height: 80px;
  object-fit: contain;
}

.brandName {
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.breadcrumb {
  margin: auto 0;
  cursor: pointer;
}
.bar1,
.bar2,
.bar3 {
  width: 25px;
  height: 3px;
  background-color: var(--blue);
  margin: 6px 0;
}

.navLink {
  color: var(--blue);
  font-weight: 600;
}

.ghostButton {
  border: 0;
  cursor: pointer;
}

.mobileBreadcrumb {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  height: 200px;
  padding: 1.5rem;
  background-color: var(--green);
  z-index: 99999;
  overflow-y: auto;
  flex-direction: column;
  justify-content: space-between;

  transform: translateX(100%);
  transition: transform 0.5s ease-in-out;
}

.open .mobileBreadcrumb {
  transform: translate(0%);
}

@media (min-width: 720px) {
  .headerNav {
    width: min(1120px, calc(100% - 2rem));
    min-height: 82px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
}
@media (max-width: 720px) {
  .headerNav {
    padding: 0.75rem 0.5rem;
    align-items: center;
    flex-direction: row;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 10px 15px;
  }

  .navActions {
    width: 100%;
    justify-content: flex-start;
  }

  .breadCrumbLinks {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2rem;
    overflow-x: auto;
    padding-bottom: 0.2rem;
  }

  .mobileNavLinks.hide-desktop {
    display: flex;
    gap: 0.1rem;
    flex-direction: row;
  }
  .mobileNavLinks.hide-desktop a {
    margin-right: 5px;
  }

  .close-container {
    display: flex;
    justify-content: end;
  }

  .brandLogo {
    height: 60px;
  }
}
</style>
