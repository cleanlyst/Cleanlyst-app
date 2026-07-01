<template>
  <a href="#main-content" class="skip-to-main">Skip to main content</a>

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
            v-if="showDashboardLink"
            :to="dashboardRoute"
            :class="['app-nav__link', { 'app-nav__link--active': isDashboardRoute }]"
          >
            Dashboard
          </router-link>
          <router-link
            v-if="auth.isAuthenticated && auth.hasRole('customer') && route.name !== 'BookCleaner'"
            :to="{ name: 'BookCleaner' }"
            :class="navLinkClass('BookCleaner')"
          >
            Book Cleaner
          </router-link>
          
          <router-link :to="{ name: 'About' }" :class="navLinkClass('About')">
            About Us
          </router-link>
        </nav>

        <div class="app-actions">
          <div v-if="auth.isAuthenticated" ref="notificationMenuRef" class="notification-menu">
            <button
              type="button"
              class="notification-button"
              :aria-label="unreadCount ? `Notifications (${unreadCount} unread)` : 'Notifications'"
              :aria-expanded="notificationsOpen"
              aria-haspopup="listbox"
              @click="notificationsOpen = !notificationsOpen"
            >
              <span class="material-symbols-outlined" aria-hidden="true">notifications</span>
              <span v-if="unreadCount" class="notification-count" aria-hidden="true">{{ unreadCount }}</span>
            </button>
            <div v-if="notificationsOpen" class="notification-popover" role="listbox" aria-label="Notifications">
              <div class="notification-popover__header">
                <span>Notifications</span>
                <button v-if="unreadCount" type="button" @click="markAllRead">Mark all read</button>
              </div>
              <p v-if="notificationsLoading" class="notification-empty">Loading…</p>
              <p v-else-if="notificationsError" class="notification-empty">
                {{ notificationsError }}
              </p>
              <p v-else-if="notifications.length === 0" class="notification-empty">
                No notifications yet.
              </p>
              <template v-else>
                <button
                  v-for="notification in notifications.slice(0, 6)"
                  :key="notification.id"
                  type="button"
                  class="notification-item"
                  :class="{ 'notification-item--unread': !notification.read_at }"
                  @click="handleNotificationClick(notification)"
                >
                  <span>{{ notification.title }}</span>
                  <small v-if="notification.body">{{ notification.body }}</small>
                </button>
              </template>
            </div>
          </div>

          <router-link v-if="!auth.isAuthenticated" :to="{ name: 'Login' }" class="app-action-link">
            <button
              class="flex-1 md:flex-none px-4 py-2 border border-outline-variant text-label-md font-label-md hover:bg-surface-container transition-colors"
            >
              Log in
            </button>
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
            class="flex-1 md:flex-none px-4 py-2 border border-outline-variant text-label-md font-label-md hover:bg-surface-container transition-colors hide-mobile"
            @click="handleSignOut"
          >
            Log out
          </button>
        </div>

        <button class="app-menu-button" type="button" @click="toggleNav" :aria-label="open ? 'Close menu' : 'Open menu'" :aria-expanded="open">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>

      <div v-if="open" class="app-mobile-menu">
        <nav class="app-mobile-menu__nav" aria-label="Mobile navigation">
          <router-link :to="{ name: 'Home' }" :class="navLinkClass('Home')">
            Home
          </router-link>
          <router-link
            v-if="auth.isAuthenticated && auth.hasRole('customer') && route.name !== 'BookCleaner'"
            :to="{ name: 'BookCleaner' }"
            :class="navLinkClass('BookCleaner')"
          >
            Book Cleaner
          </router-link>
          
          <router-link
            v-if="showDashboardLink"
            :to="dashboardRoute"
            :class="['app-nav__link', { 'app-nav__link--active': isDashboardRoute }]"
          >
            Dashboard
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
            Log out
          </button>
        </nav>
      </div>
    </header>
  </div>

  <router-view />
  <FooterPage :compact="isComingSoonRoute" />

  <ToastContainer />

  <p v-if="notificationRouteError" class="notification-route-error">
    {{ notificationRouteError }}
  </p>

  <div v-if="signingOut" class="logout-overlay">
    <div class="logout-spinner"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import FooterPage from '@/components/FooterPage.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useNotifications } from '@/composables/useNotifications'
import type { Notification } from '@/services/notificationService'
import companyLogo from '/logo.svg'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const open = ref(false)
const signingOut = ref(false)
const notificationsOpen = ref(false)
const notificationMenuRef = ref<HTMLElement | null>(null)
const {
  notifications,
  loading: notificationsLoading,
  error: notificationsError,
  unreadCount,
  load: loadNotifications,
  subscribe: subscribeToNotificationUpdates,
  unsubscribe: unsubscribeFromNotificationUpdates,
  markRead,
  markAllRead,
} = useNotifications()
const isComingSoonRoute = computed(() => route.name === 'ComingSoon')
const dashboardRoute = computed<RouteLocationRaw>(() =>
  auth.isAuthenticated ? { name: auth.dashboardRouteName } : { name: 'Login' },
)
const isDashboardRoute = computed(
  () => typeof route.name === 'string' && route.name.includes('Dashboard'),
)
// Hide the Dashboard link for cleaners who are still pending approval.
// Customers and admins always see it; a cleaner only sees it once approved.
const showDashboardLink = computed(() => {
  if (!auth.isAuthenticated) return false
  const isCleanerRole = auth.hasRole('cleaner_pending') || auth.hasRole('cleaner_active')
  if (!isCleanerRole) return true
  return auth.cleanerProfile?.onboarding_complete === true
})
const notificationRouteError = ref('')
let notificationRouteErrorTimeout: ReturnType<typeof setTimeout> | null = null

function handleClickOutsideNotifications(event: MouseEvent) {
  if (notificationsOpen.value && notificationMenuRef.value && !notificationMenuRef.value.contains(event.target as Node)) {
    notificationsOpen.value = false
  }
}

onMounted(async () => {
  if (!auth.initialized) await auth.init()
  if (auth.isAuthenticated) {
    await loadNotifications()
    subscribeToNotificationUpdates()
  }
  document.addEventListener('click', handleClickOutsideNotifications)
})

watch(
  () => route.fullPath,
  () => {
    notificationRouteError.value = ''
    if (open.value) {
      open.value = false
      document.body.classList.remove('mobile-nav-open')
    }
  },
)

watch(
  () => auth.userId,
  async (userId) => {
    notificationsOpen.value = false
    unsubscribeFromNotificationUpdates()
    if (userId) {
      await loadNotifications()
      subscribeToNotificationUpdates()
    }
  },
)

onBeforeUnmount(() => {
  if (notificationRouteErrorTimeout) clearTimeout(notificationRouteErrorTimeout)
  document.removeEventListener('click', handleClickOutsideNotifications)
})

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

async function handleNotificationClick(notification: Notification) {
  notificationRouteError.value = ''
  try {
    await markRead(notification.id)
  } catch {
    // Navigation should still work even if the read receipt update fails.
  } finally {
    notificationsOpen.value = false
  }

  const bookingId = getNotificationBookingId(notification)
  if (!bookingId) {
    showNotificationRouteError()
    return
  }

  const role = auth.userRole
  if (role === 'customer') {
    await router.push({ name: 'CustomerBookingDetails', params: { bookingId } })
  } else if (role === 'cleaner_active' || role === 'cleaner_pending') {
    await router.push({ name: 'CleanerBookingDetails', params: { bookingId } })
  } else if (role === 'admin') {
    await router.push({ name: 'AdminBookingDetails', params: { bookingId } })
  }
}

function getNotificationBookingId(notification: Notification): string | null {
  if (notification.booking_id) return notification.booking_id

  const metadataBookingId = notification.metadata?.booking_id
  return typeof metadataBookingId === 'string' && metadataBookingId ? metadataBookingId : null
}

function showNotificationRouteError() {
  notificationRouteError.value = 'Booking no longer available'
  if (notificationRouteErrorTimeout) clearTimeout(notificationRouteErrorTimeout)
  notificationRouteErrorTimeout = setTimeout(() => {
    notificationRouteError.value = ''
    notificationRouteErrorTimeout = null
  }, 4000)
}

async function handleSignOut() {
  signingOut.value = true
  try {
    await auth.signOut()
    notificationsOpen.value = false
    unsubscribeFromNotificationUpdates()
    await router.replace({ name: 'Login' })
  } catch {
    // ignore — state is already cleared by signOut()
  } finally {
    signingOut.value = false
  }
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
  margin-left: auto;
}

.notification-menu {
  position: relative;
}

.notification-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  color: #18181b;
  border: 1px solid #e4e4e7;
  border-radius: 0.25rem;
  background: #ffffff;
}

.notification-button .material-symbols-outlined {
  font-size: 1.25rem;
}

.notification-count {
  position: absolute;
  top: -0.35rem;
  right: -0.35rem;
  min-width: 1.1rem;
  height: 1.1rem;
  padding: 0 0.25rem;
  border-radius: 999px;
  color: #ffffff;
  background: #ba1a1a;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1.1rem;
}

.notification-popover {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  z-index: 60;
  width: min(22rem, calc(100vw - 2rem));
  max-height: 28rem;
  overflow-y: auto;
  border: 1px solid #e4e4e7;
  border-radius: 0.5rem;
  background: #ffffff;
  box-shadow: 0 16px 32px rgba(0, 0, 0, 0.12);
}

.notification-popover__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e4e4e7;
  font-size: 0.875rem;
  font-weight: 700;
}

.notification-popover__header button {
  color: #52525b;
  font-size: 0.75rem;
}

.notification-empty {
  padding: 1rem;
  color: #71717a;
  font-size: 0.875rem;
}

.notification-item {
  display: block;
  width: 100%;
  padding: 0.85rem 1rem;
  text-align: left;
  border-bottom: 1px solid #f4f4f5;
}

.notification-item span {
  display: block;
  color: #18181b;
  font-size: 0.875rem;
  font-weight: 600;
}

.notification-item small {
  display: block;
  margin-top: 0.25rem;
  color: #71717a;
  font-size: 0.75rem;
  line-height: 1.4;
}

.notification-item--unread {
  background: #f8fafc;
}

.notification-route-error {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 70;
  max-width: min(22rem, calc(100vw - 2rem));
  padding: 0.75rem 1rem;
  color: #93000a;
  background: #ffdad6;
  border: 1px solid #ba1a1a;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
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

.logout-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.logout-spinner {
  width: 3rem;
  height: 3rem;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
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
  .text-xl.font-bold.tracking-tighter.text-zinc-900.dark\:text-zinc-50 {
    margin-right: 4rem;
  }
}

@media (min-width: 1024px) {
  .app-header__inner {
    padding-right: 3rem;
    padding-left: 3rem;
  }
}
</style>
