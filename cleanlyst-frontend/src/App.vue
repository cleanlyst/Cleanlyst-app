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
        <router-link v-if="!auth.isAuthenticated" :to="{ name: 'Home' }" class="navLink"
          >Home</router-link
        >
        <router-link :to="{ name: 'Services' }" class="navLink">Services</router-link>
        <router-link :to="{ name: 'About' }" class="navLink">About</router-link>
      </div>

      <div class="navGroup navActions hide-mobile">
        <router-link v-if="!auth.isAuthenticated" :to="{ name: 'Login' }" class="blueButton">
          Log in
        </router-link>
        <router-link
          v-if="!auth.isAuthenticated"
          :to="{ name: 'SignupCustomer' }"
          class="greenButton"
        >
          Sign up
        </router-link>
        <!-- User Avatar Dropdown -->
        <div v-if="auth.isAuthenticated" class="userDropdown">
          <button
            type="button"
            class="userAvatarButton"
            @click="toggleUserMenu"
            aria-label="User menu"
          >
            <img :src="peopleImage" alt="User" class="userAvatar" />
          </button>
          <div v-if="showUserMenu" class="userMenu">
            <button type="button" class="userMenuItem" @click="handleSignOut">Logout</button>
          </div>
        </div>
      </div>

      <div class="breadcrumb hide-desktop">
        <div class="mobileNavLinks hide-desktop">
          <!-- User Avatar Dropdown (Mobile) -->
          <div v-if="auth.isAuthenticated" class="userDropdown mobileUserDropdown">
            <button
              type="button"
              class="userAvatarButton"
              @click.stop="toggleUserMenu"
              aria-label="User menu"
            >
              <img :src="peopleImage" alt="User" class="userAvatar" />
            </button>
            <div v-if="showUserMenu" class="userMenu">
              <button type="button" class="userMenuItem" @click="handleSignOut">Logout</button>
            </div>
          </div>

          <template v-if="!auth.isAuthenticated">
            <router-link
              v-for="item in mobileActionItems"
              :key="`${item.name}-${item.label}`"
              :to="{ name: item.name }"
              :class="{ active: route.name === item.name }"
            >
              <span class="blue-text">{{ item.label }}</span>
            </router-link>
          </template>
        </div>

        <div class="bars" @click.stop="toggleNav">
          <div class="bar1"></div>
          <div class="bar2"></div>
          <div class="bar3"></div>
        </div>
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
          <span>{{ item.label }}</span>
        </router-link>
      </div>
    </div>
  </div>

  <router-view />
  <FooterPage />
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import FooterPage from '@/components/FooterPage.vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import peopleImage from '@/assets/people.png'

const route = useRoute()
const auth = useAuthStore()
const open = ref(false)
const showUserMenu = ref(false)

function toggleNav() {
  open.value = !open.value
  document.body.classList.toggle('open', open.value)
}

function toggleUserMenu() {
  showUserMenu.value = !showUserMenu.value
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('.userDropdown')) {
    showUserMenu.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

const mobileNavItems = computed(() => {
  const items: Array<{ name: string; label: string }> = []

  if (!auth.isAuthenticated) {
    items.push({ name: 'Home', label: 'Home' })
  }
  items.push({ name: 'Services', label: 'Services' })
  items.push({ name: 'About', label: 'About' })

  return items
})

const mobileActionItems = computed(() => {
  const items: Array<{ name: string; label: string }> = []

  if (!auth.isAuthenticated) {
    items.push({ name: 'Login', label: 'Log in' })
    items.push({ name: 'SignupCustomer', label: 'Register' })
  }

  return items
})

async function handleSignOut() {
  // Clear local state first to prevent race conditions
  showUserMenu.value = false

  try {
    await auth.signOut()
  } catch {
    // Ignore signOut errors - session may already be invalid
  }

  // Full page reload to clear all state and redirect to landing
  window.location.href = '/'
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
  display: flex;
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
    justify-content: center;
    align-items: center;
    margin-right: 10px;
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

/* User Dropdown Styles */
.userDropdown {
  position: relative;
}

.userAvatarButton {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  border-radius: 50%;
  transition: opacity 0.2s ease;
}

.userAvatarButton:hover {
  opacity: 0.8;
}

.userAvatar {
  width: 30px;
  height: 30px;
  object-fit: cover;
}

.userMenu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: var(--white);
  border: 1px solid rgba(35, 45, 63, 0.12);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(16, 35, 61, 0.12);
  min-width: 120px;
  z-index: 100;
  overflow: hidden;
}

.userMenuItem {
  display: block;
  width: 100%;
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  text-align: left;
  color: var(--blue);
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.userMenuItem:hover {
  background-color: rgba(64, 138, 113, 0.08);
}
</style>
