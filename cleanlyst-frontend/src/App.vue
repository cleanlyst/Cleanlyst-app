<template>
  <div v-if="!isComingSoonRoute" class="app-shell-spacer">
    <header class="app-header">
      <div class="app-header__inner">
        <div class="text-xl font-bold tracking-tighter text-zinc-900 dark:text-zinc-50">
          <router-link :to="{ name: 'Home' }" :class="navLinkClass('Home')">
            <img :src="companyLogo" alt="" width="50" height="50" />
          </router-link>
        </div>
        <nav class="app-nav" aria-label="Primary site navigation">
          <router-link
            :to="dashboardRoute"
            :class="['app-nav__link', { 'app-nav__link--active': isDashboardRoute }]"
          >
            Dashboard
          </router-link>
          <router-link :to="{ name: 'Services' }" :class="navLinkClass('Services')">
            Services
          </router-link>
          <router-link :to="{ name: 'About' }" :class="navLinkClass('About')">
            About Us
          </router-link>
        </nav>

        <div class="app-actions">
          <router-link v-if="!auth.isAuthenticated" :to="{ name: 'Login' }" class="app-action-link">
            Log in
          </router-link>
          <router-link
            v-if="!auth.isAuthenticated"
            :to="{ name: 'SignupCustomer' }"
            class="app-action-link app-action-link--primary"
          >
            Sign up
          </router-link>

          <button
            v-if="auth.isAuthenticated"
            type="button"
            class="app-action-link"
            @click="handleSignOut"
          >
            Logout
          </button>
        </div>

        <button class="app-menu-button" type="button" @click="toggleNav" aria-label="Open menu">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>

      <div v-if="open" class="app-mobile-menu">
        <nav class="app-mobile-menu__nav" aria-label="Mobile navigation">
          <router-link
            :to="dashboardRoute"
            :class="['app-nav__link', { 'app-nav__link--active': isDashboardRoute }]"
          >
            Dashboard
          </router-link>
          <router-link :to="{ name: 'Services' }" :class="navLinkClass('Services')">
            Services
          </router-link>
          <router-link :to="{ name: 'About' }" :class="navLinkClass('About')">
            About Us
          </router-link>
          <router-link v-if="!auth.isAuthenticated" :to="{ name: 'Login' }" :class="navLinkClass()">
            Log in
          </router-link>
          <router-link
            v-if="!auth.isAuthenticated"
            :to="{ name: 'SignupCustomer' }"
            :class="navLinkClass()"
          >
            Sign up
          </router-link>
          <button
            v-if="auth.isAuthenticated"
            type="button"
            class="app-mobile-menu__button"
            @click="handleSignOut"
          >
            Logout
          </button>
        </nav>
      </div>
    </header>
  </div>

  <router-view />
  <FooterPage :compact="isComingSoonRoute" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import FooterPage from '@/components/FooterPage.vue'
import { useRoute, type RouteLocationRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import companyLogo from '/logo.svg'

const route = useRoute()
const auth = useAuthStore()
const open = ref(false)
const isComingSoonRoute = computed(() => route.name === 'ComingSoon')
const dashboardRoute = computed<RouteLocationRaw>(() =>
  auth.isAuthenticated ? { name: auth.dashboardRouteName } : { name: 'Login' },
)
const isDashboardRoute = computed(
  () => typeof route.name === 'string' && route.name.includes('Dashboard'),
)

function navLinkClass(routeName?: string) {
  const isActive = routeName ? route.name === routeName : false
  return [
    'app-nav__link',
    {
      'app-nav__link--active': isActive,
      'app-nav__link--inactive': !isActive,
    },
  ]
}

function toggleNav() {
  open.value = !open.value
  document.body.classList.toggle('mobile-nav-open', open.value)
}

async function handleSignOut() {
  try {
    await auth.signOut()
  } catch {
    // ignore sign out errors
  }
  window.location.href = '/'
}
</script>

<style scoped>
.app-shell-spacer {
  height: 4rem;
}

.app-header {
  position: fixed;
  top: 0;
  z-index: 50;
  width: 100%;
  height: 4rem;
  font-family: 'Inter', sans-serif;
  background: #ffffff;
  border-bottom: 1px solid #e4e4e7;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.app-header__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 80rem;
  height: 100%;
  padding: 0 1.5rem;
  margin: 0 auto;
}

.app-nav {
  display: none;
  align-items: center;
  height: 100%;
  gap: 2rem;
}

.app-nav__link {
  font-weight: 500;
  color: #71717a;
  transition: color 200ms ease;
}

.app-nav__link:hover,
.app-nav__link--active {
  color: #18181b;
}

.app-nav__link--active {
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 4px;
}

.app-nav > .app-nav__link--active:first-child {
  display: flex;
  align-items: center;
  height: 100%;
  padding-top: 1.25rem;
  padding-bottom: 1.25rem;
  text-decoration: none;
  border-bottom: 2px solid #18181b;
}

.app-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.app-account-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.app-account-button__icon {
  padding: 0.5rem;
  color: #52525b;
  cursor: pointer;
  border-radius: 9999px;
  transition: background-color 200ms ease;
}

.app-account-button__icon:hover {
  background: #fafafa;
}

.app-action-link {
  display: none;
  padding: 0.5rem 1rem;
  font-weight: 500;
  color: #18181b;
  border-radius: 0.25rem;
  transition:
    background-color 200ms ease,
    transform 150ms ease;
}

.app-action-link:hover {
  background: #fafafa;
}

.app-action-link:active {
  transform: scale(0.95);
}

.app-action-link--primary {
  color: #ffffff;
  background: #18181b;
}

.app-action-link--primary:hover {
  background: #18181b;
}

.app-menu-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  gap: 0.375rem;
  color: #18181b;
  border-radius: 0.25rem;
  transition: background-color 200ms ease;
}

.app-menu-button:hover {
  background: #fafafa;
}

.app-menu-button span {
  width: 1.25rem;
  height: 0.125rem;
  background: currentColor;
}

.app-mobile-menu {
  padding: 1rem 1.5rem;
  background: #ffffff;
  border-top: 1px solid #e4e4e7;
}

.app-mobile-menu__nav {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.app-mobile-menu__button {
  font-weight: 500;
  color: #71717a;
  text-align: left;
  transition: color 200ms ease;
}

.app-mobile-menu__button:hover {
  color: #18181b;
}

:global(.dark) .app-header {
  background: #09090b;
  border-bottom-color: #27272a;
  box-shadow: none;
}

:global(.dark) .app-nav__link,
:global(.dark) .app-mobile-menu__button {
  color: #a1a1aa;
}

:global(.dark) .app-nav__link:hover,
:global(.dark) .app-nav__link--active,
:global(.dark) .app-mobile-menu__button:hover {
  color: #fafafa;
}

:global(.dark) .app-nav > .app-nav__link--active:first-child {
  border-bottom-color: #fafafa;
}

:global(.dark) .app-account-button__icon {
  color: #d4d4d8;
}

:global(.dark) .app-account-button__icon:hover,
:global(.dark) .app-action-link:hover,
:global(.dark) .app-menu-button:hover {
  background: #18181b;
}

:global(.dark) .app-action-link {
  color: #fafafa;
}

:global(.dark) .app-action-link--primary {
  color: #09090b;
  background: #fafafa;
}

:global(.dark) .app-mobile-menu {
  background: #09090b;
  border-top-color: #27272a;
}

@media (min-width: 768px) {
  .app-nav,
  .app-action-link {
    display: flex;
  }

  .app-menu-button,
  .app-mobile-menu {
    display: none;
  }
}

@media (min-width: 1024px) {
  .app-header__inner {
    padding-right: 3rem;
    padding-left: 3rem;
  }
}
</style>
