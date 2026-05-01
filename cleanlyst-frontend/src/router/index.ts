import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { pinia } from '@/stores'
import type { Role } from '@/stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    requiresAuth?: boolean
    requiresRole?: Role | Role[]
    redirectIfAuthenticated?: boolean
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'Home',
      meta: { title: 'Home' },
      component: () => import('../components/IndexPage.vue'),
    },
    {
      path: '/coming-soon',
      name: 'ComingSoon',
      meta: { title: 'Coming Soon' },
      component: () => import('../pages/ComingSoonPage.vue'),
    },
    {
      path: '/about',
      name: 'About',
      meta: { title: 'About Us' },
      component: () => import('../pages/AboutUs.vue'),
    },
    {
      path: '/services',
      name: 'Services',
      meta: { title: 'Services' },
      component: () => import('../pages/ServicesPage.vue'),
    },
    {
      path: '/auth',
      name: 'Auth',
      meta: { title: 'Sign In', redirectIfAuthenticated: true },
      redirect: (to) => ({ name: 'Login', query: to.query }),
    },
    {
      path: '/auth/callback',
      name: 'AuthCallback',
      meta: { title: 'Completing Sign In' },
      component: () => import('../pages/AuthCallbackPage.vue'),
    },
    {
      path: '/login',
      name: 'Login',
      meta: { title: 'Log in', redirectIfAuthenticated: true },
      component: () => import('../pages/LoginPage.vue'),
    },
    {
      path: '/signup',
      name: 'Signup',
      meta: { title: 'Sign up', redirectIfAuthenticated: true },
      component: () => import('../pages/SignupPage.vue'),
    },
    {
      path: '/signup/customer',
      name: 'SignupCustomer',
      meta: { title: 'Customer Sign up', redirectIfAuthenticated: true },
      component: () => import('../pages/SignupPage.vue'),
    },
    {
      path: '/signup/cleaner',
      name: 'SignupCleaner',
      meta: { title: 'Cleaner Sign up', redirectIfAuthenticated: true },
      component: () => import('../pages/SignupCleanerPage.vue'),
    },
    {
      path: '/book',
      name: 'BookCleaner',
      meta: { title: 'Book a Cleaner', requiresAuth: true, requiresRole: 'customer' },
      component: () => import('../pages/LandingPage.vue'),
    },
    {
      path: '/customer/dashboard',
      name: 'CustomerDashboard',
      meta: { title: 'Customer Dashboard', requiresAuth: true, requiresRole: 'customer' },
      component: () => import('../pages/customer/CustomerDashboard.vue'),
    },
    {
      path: '/customer/dashboard/bookings',
      name: 'CustomerBookings',
      meta: { title: 'My Bookings', requiresAuth: true, requiresRole: 'customer' },
      component: () => import('../pages/customer/CustomerDashboard.vue'),
    },
    {
      path: '/customer/dashboard/preferences',
      name: 'CustomerPreferences',
      meta: { title: 'Preferences', requiresAuth: true, requiresRole: 'customer' },
      component: () => import('../pages/customer/CustomerDashboard.vue'),
    },
    {
      path: '/customer/dashboard/settings',
      name: 'CustomerSettings',
      meta: { title: 'Settings', requiresAuth: true, requiresRole: 'customer' },
      component: () => import('../pages/customer/CustomerDashboard.vue'),
    },
    {
      path: '/cleaner/dashboard',
      name: 'CleanerDashboard',
      meta: {
        title: 'Cleaner Dashboard',
        requiresAuth: true,
        requiresRole: ['cleaner_pending', 'cleaner_active'],
      },
      component: () => import('../pages/cleaner/CleanerDashboard.vue'),
    },
    {
      path: '/cleaner/dashboard/bookings',
      name: 'CleanerBookings',
      meta: {
        title: 'Cleaner Bookings',
        requiresAuth: true,
        requiresRole: ['cleaner_pending', 'cleaner_active'],
      },
      component: () => import('../pages/cleaner/CleanerDashboard.vue'),
    },
    {
      path: '/cleaner/dashboard/availability',
      name: 'CleanerAvailability',
      meta: {
        title: 'Availability',
        requiresAuth: true,
        requiresRole: ['cleaner_pending', 'cleaner_active'],
      },
      component: () => import('../pages/cleaner/CleanerDashboard.vue'),
    },
    {
      path: '/cleaner/dashboard/services-pricing',
      name: 'CleanerServicesPricing',
      meta: {
        title: 'Services & Pricing',
        requiresAuth: true,
        requiresRole: ['cleaner_pending', 'cleaner_active'],
      },
      component: () => import('../pages/cleaner/CleanerDashboard.vue'),
    },
    {
      path: '/cleaner/dashboard/financials',
      name: 'CleanerFinancials',
      meta: {
        title: 'Financials',
        requiresAuth: true,
        requiresRole: ['cleaner_pending', 'cleaner_active'],
      },
      component: () => import('../pages/cleaner/CleanerDashboard.vue'),
    },
    {
      path: '/cleaner/dashboard/reviews',
      name: 'CleanerReviews',
      meta: {
        title: 'Reviews',
        requiresAuth: true,
        requiresRole: ['cleaner_pending', 'cleaner_active'],
      },
      component: () => import('../pages/cleaner/CleanerDashboard.vue'),
    },
    {
      path: '/admin/dashboard',
      name: 'AdminDashboard',
      meta: { title: 'Admin Dashboard', requiresAuth: true, requiresRole: 'admin' },
      component: () => import('../pages/admin/AdminDashboard.vue'),
    },
    {
      path: '/admin/dashboard/approvals',
      name: 'AdminApprovals',
      meta: { title: 'Approvals', requiresAuth: true, requiresRole: 'admin' },
      component: () => import('../pages/admin/AdminDashboard.vue'),
    },
    {
      path: '/admin/dashboard/subscription',
      name: 'AdminSubscription',
      meta: { title: 'Subscription', requiresAuth: true, requiresRole: 'admin' },
      component: () => import('../pages/admin/AdminDashboard.vue'),
    },
    {
      path: '/admin/dashboard/financials',
      name: 'AdminFinancials',
      meta: { title: 'Admin Financials', requiresAuth: true, requiresRole: 'admin' },
      component: () => import('../pages/admin/AdminDashboard.vue'),
    },
  ],
  scrollBehavior(to) {
    if (to.hash) {
      return {
        el: to.hash,
        behavior: 'smooth',
      }
    }
    return { top: 0 }
  },
})

router.beforeEach(async (to) => {
  const auth = useAuthStore(pinia)
  const hostname = window.location.hostname.toLowerCase()
  const isLiveDomain = hostname === 'cleanlyst.co.uk' || hostname === 'www.cleanlyst.co.uk'
  const canonicalComingSoonUrl = 'https://www.cleanlyst.co.uk/coming-soon'

  if (isLiveDomain && to.path !== '/coming-soon') {
    window.location.replace(canonicalComingSoonUrl)
    return false
  }

  if (!auth.initialized) {
    await auth.init()
  }

  if (to.meta.title) {
    document.title = `${to.meta.title} | Cleanlyst`
  }

  if (to.meta.redirectIfAuthenticated && auth.isAuthenticated) {
    return { name: auth.dashboardRouteName }
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'Login', query: { redirect: to.fullPath } }
  }

  if (to.meta.requiresRole) {
    const allowedRoles = Array.isArray(to.meta.requiresRole)
      ? to.meta.requiresRole
      : [to.meta.requiresRole]

    if (allowedRoles.some((role) => auth.hasRole(role))) {
      return
    }

    if (auth.isAuthenticated) {
      return { name: auth.dashboardRouteName }
    }

    return { name: 'Home' }
  }
})

export default router
