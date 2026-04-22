import type { AuthChangeEvent, Subscription } from '@supabase/supabase-js'
import { defineStore } from 'pinia'
import { hasSupabaseConfig, requireSupabase, supabaseConfigError } from '@/lib/supabase'

export type Role = 'customer' | 'cleaner' | 'admin'

export interface Profile {
  id: string
  role: Role
  full_name: string
  phone: string | null
  avatar_url: string | null
  city: string | null
  country: string | null
  is_active: boolean
}

export interface CleanerProfile {
  user_id: string
  business_name: string | null
  bio: string | null
  service_radius_km: number | null
  hourly_rate_cents: number | null
  currency: string
  status: 'pending' | 'approved' | 'rejected' | 'suspended'
  onboarding_complete: boolean
  average_rating: number
  review_count: number
}

type PublicSignupRole = Exclude<Role, 'admin'>

export const useAuthStore = defineStore('auth', {
  state: () => ({
    userId: null as string | null,
    profile: null as Profile | null,
    cleanerProfile: null as CleanerProfile | null,
    loading: true,
    initialized: false,
    authSubscription: null as Subscription | null,
  }),

  getters: {
    isAuthenticated: (state) => !!state.userId,
    userRole: (state) => state.profile?.role ?? null,
    dashboardRouteName(): 'CustomerDashboard' | 'CleanerDashboard' | 'AdminDashboard' | 'Home' {
      switch (this.userRole) {
        case 'customer':
          return 'CustomerDashboard'
        case 'cleaner':
          return 'CleanerDashboard'
        case 'admin':
          return 'AdminDashboard'
        default:
          return 'Home'
      }
    },
  },

  actions: {
    async init() {
      this.loading = true

      if (!hasSupabaseConfig) {
        console.warn(supabaseConfigError)
        this.userId = null
        this.profile = null
        this.cleanerProfile = null
        this.loading = false
        this.initialized = true
        return
      }

      const supabase = requireSupabase()

      const { data, error } = await supabase.auth.getUser()
      if (error) {
        console.error('Failed to get current user', error)
        this.userId = null
        this.profile = null
        this.cleanerProfile = null
        this.loading = false
        this.initialized = true
        return
      }

      this.userId = data.user?.id ?? null
      this.profile = null
      this.cleanerProfile = null

      if (this.userId) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', this.userId)
          .single()

        if (profileError) {
          console.error('Failed to load profile', profileError)
        } else {
          this.profile = profile as Profile
        }

        if (this.profile?.role === 'cleaner') {
          const { data: cleanerProfile, error: cleanerProfileError } = await supabase
            .from('cleaner_profiles')
            .select('*')
            .eq('user_id', this.userId)
            .maybeSingle()

          if (cleanerProfileError) {
            console.error('Failed to load cleaner profile', cleanerProfileError)
          } else {
            this.cleanerProfile = cleanerProfile as CleanerProfile | null
          }
        }
      }

      this.loading = false
      this.initialized = true
    },

    async signIn(email: string, password: string) {
      const supabase = requireSupabase()
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error;

      await this.init()
    },

    async signUp(email: string, password: string, fullName: string, role: PublicSignupRole) {
      const supabase = requireSupabase()
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role,
          },
        },
      })

      if (error) throw error
    },

    async signInWithGoogle(redirectPath?: string, signupRole?: PublicSignupRole) {
      const supabase = requireSupabase()
      const redirectTo = new URL('/auth/callback', window.location.origin)

      if (redirectPath) {
        redirectTo.searchParams.set('redirect', redirectPath)
      }

      if (signupRole) {
        redirectTo.searchParams.set('signupRole', signupRole)
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo.toString(),
        },
      })

      if (error) throw error
    },

    async provisionOAuthSignup(role?: PublicSignupRole) {
      if (!role || !this.userId) return

      if (role === 'customer') {
        if (!this.profile) {
          await this.init()
        }
        return
      }

      const supabase = requireSupabase()

      if (this.profile?.role !== 'cleaner') {
        const { error } = await supabase
          .from('profiles')
          .update({ role: 'cleaner' })
          .eq('id', this.userId)

        if (error) throw error
      }

      const { data: cleanerProfile, error: cleanerProfileError } = await supabase
        .from('cleaner_profiles')
        .select('user_id')
        .eq('user_id', this.userId)
        .maybeSingle()

      if (cleanerProfileError) throw cleanerProfileError

      if (!cleanerProfile) {
        const { error } = await supabase.from('cleaner_profiles').insert({
          user_id: this.userId,
        })

        if (error) throw error
      }

      await this.init()
    },

    async signOut() {
      const supabase = requireSupabase()
      const { error } = await supabase.auth.signOut()
      if (error) throw error

      this.userId = null
      this.profile = null
      this.cleanerProfile = null
    },

    hasRole(role: Role) {
      return this.profile?.role === role
    },

    bindAuthListener() {
      if (this.authSubscription || !hasSupabaseConfig) return

      const supabase = requireSupabase()

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent) => {
        if (event === 'INITIAL_SESSION') return
        await this.init()
      })

      this.authSubscription = subscription
    },
  },
})
