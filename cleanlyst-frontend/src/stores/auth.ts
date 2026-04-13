import type { AuthChangeEvent, Subscription } from '@supabase/supabase-js'
import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'

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

export const useAuthStore = defineStore('auth', {
  state: () => ({
    userId: null as string | null,
    profile: null as Profile | null,
    loading: true,
    initialized: false,
    authSubscription: null as Subscription | null,
  }),

  getters: {
    isAuthenticated: (state) => !!state.userId,
    userRole: (state) => state.profile?.role ?? null,
  },

  actions: {
    async init() {
      this.loading = true

      const { data, error } = await supabase.auth.getUser()
      if (error) {
        console.error('Failed to get current user', error)
        this.userId = null
        this.profile = null
        this.loading = false
        this.initialized = true
        return
      }

      this.userId = data.user?.id ?? null
      this.profile = null

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
      }

      this.loading = false
      this.initialized = true
    },

    async signIn(email: string, password: string) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error;

      await this.init()
    },

    async signUp(email: string, password: string, fullName: string, role: Role) {
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

    async signOut() {
      const { error } = await supabase.auth.signOut()
      if (error) throw error

      this.userId = null
      this.profile = null
    },

    hasRole(role: Role) {
      return this.profile?.role === role
    },

    bindAuthListener() {
      if (this.authSubscription) return

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
