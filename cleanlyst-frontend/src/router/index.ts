import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { pinia } from '@/stores'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    requiresAuth?: boolean
    requiresRole?: 'customer' | 'cleaner' | 'admin'
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
      path: '/contact',
      name: 'Contact',
      meta: { title: 'Contact Us' },
      component: () => import('../pages/ContactPage.vue'),
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
      component: () => import('../pages/AuthPage.vue'),
    },
    {
      path: '/book',
      name: 'BookCleaner',
      meta: { title: 'Book a Cleaner', requiresAuth: true, requiresRole: 'customer' },
      component: () => import('../pages/LandingPage.vue'),
    },
    {
      path: '/cleaner/dashboard',
      name: 'CleanerDashboard',
      meta: { title: 'Cleaner Dashboard', requiresAuth: true, requiresRole: 'cleaner' },
      component: () => import('../pages/cleaner/CleanerDashboard.vue'),
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

  if (!auth.initialized) {
    await auth.init()
  }

  if (to.meta.title) {
    document.title = `${to.meta.title} | Cleanlyst`
  }

  if (to.meta.redirectIfAuthenticated && auth.isAuthenticated) {
    return auth.hasRole('cleaner') ? { name: 'CleanerDashboard' } : { name: 'BookCleaner' }
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'Auth', query: { redirect: to.fullPath } }
  }

  if (to.meta.requiresRole && !auth.hasRole(to.meta.requiresRole)) {
    if (auth.hasRole('cleaner')) {
      return { name: 'CleanerDashboard' }
    }

    if (auth.hasRole('customer')) {
      return { name: 'BookCleaner' }
    }

    return { name: 'Home' }
  }
})

export default router
