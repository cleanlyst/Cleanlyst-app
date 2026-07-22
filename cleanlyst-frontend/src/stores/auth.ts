import type { AuthChangeEvent, Session, Subscription } from '@supabase/supabase-js'
import { defineStore } from 'pinia'
import { hasSupabaseConfig, requireSupabase, supabaseConfigError } from '@/lib/supabase'
import type { MembershipStatus } from '@cleanlyst-backend/types/database.types'

export type Role = 'customer' | 'cleaner_pending' | 'cleaner_active' | 'admin'

export interface Profile {
  id: string
  role: Role
  full_name: string
  phone: string | null
  avatar_url: string | null
  city: string | null
  country: string | null
  is_active: boolean
  is_verified: boolean
}

export interface CleanerProfile {
  user_id: string
  business_name: string | null
  bio: string | null
  service_radius_km: number | null
  currency: string
  status: 'pending' | 'approved' | 'rejected' | 'suspended'
  onboarding_complete: boolean
  is_available: boolean
  average_rating: number
  review_count: number
  accepted_payment_methods: string[]
}

type PublicSignupRole = 'customer' | 'cleaner_pending'
const AUTH_SESSION_MISSING_ERROR = 'AuthSessionMissingError'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    userId: null as string | null,
    profile: null as Profile | null,
    cleanerProfile: null as CleanerProfile | null,
    cleanerApplicationStatus: null as string | null,
    membershipStatus: null as MembershipStatus | null,
    loading: true,
    initialized: false,
    authSubscription: null as Subscription | null,
  }),

  getters: {
    isAuthenticated: (state) => !!state.userId,
    userRole: (state) => state.profile?.role ?? null,
    /** True when the customer has an active or complimentary membership. */
    isMember: (state): boolean =>
      state.membershipStatus === 'active' || state.membershipStatus === 'complimentary',
    dashboardRouteName(): 'CustomerDashboard' | 'CleanerDashboard' | 'AdminDashboard' | 'Home' {
      switch (this.userRole) {
        case 'customer':
          return 'CustomerDashboard'
        case 'cleaner_active':
        case 'cleaner_pending':
          return 'CleanerDashboard'
        case 'admin':
          return 'AdminDashboard'
        default:
          return 'Home'
      }
    },
  },

  actions: {
    isExpectedMissingSessionError(error: unknown) {
      if (!error || typeof error !== 'object') return false

      const name = 'name' in error ? (error.name as string | undefined) : undefined
      return name === AUTH_SESSION_MISSING_ERROR
    },

    async init() {
      this.loading = true

      if (!hasSupabaseConfig) {
        console.warn(supabaseConfigError)
        this.userId = null
        this.profile = null
        this.cleanerProfile = null
        this.cleanerApplicationStatus = null
        this.loading = false
        this.initialized = true
        return
      }

      const supabase = requireSupabase()

      const { data, error } = await supabase.auth.getUser()
      if (error) {
        // A missing auth session means the user is logged out, which is expected on first load.
        if (!this.isExpectedMissingSessionError(error)) {
          console.error('Failed to get current user', error)
        }
        this.userId = null
        this.profile = null
        this.cleanerProfile = null
        this.cleanerApplicationStatus = null
        this.loading = false
        this.initialized = true
        return
      }

      this.userId = data.user?.id ?? null
      this.profile = null
      this.cleanerProfile = null
      this.cleanerApplicationStatus = null
      this.membershipStatus = null

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

        if (this.profile?.role === 'cleaner_pending' || this.profile?.role === 'cleaner_active') {
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

          const { data: appRow } = await supabase
            .from('cleaner_applications')
            .select('status')
            .eq('cleaner_id', this.userId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          this.cleanerApplicationStatus = appRow?.status ?? null
        }

        if (this.profile?.role === 'customer') {
          const { data: membership } = await supabase
            .from('customer_memberships')
            .select('status')
            .eq('customer_id', this.userId)
            .maybeSingle()
          this.membershipStatus = (membership?.status as MembershipStatus | undefined) ?? 'free'
        }
      }

      this.loading = false
      this.initialized = true
    },

    async signIn(email: string, password: string) {
      const supabase = requireSupabase()
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      // Use the user returned by signInWithPassword directly — avoids a redundant
      // getUser() round-trip that init() would make for a session we just established.
      this.userId = data.user.id
      this.cleanerApplicationStatus = null
      this.membershipStatus = null
      this.loading = true
      try {
        await this._loadProfileData(data.user.id)
      } finally {
        this.loading = false
        this.initialized = true
      }
    },

    async signUp(
      email: string,
      password: string,
      fullName: string,
      role: PublicSignupRole,
      businessName?: string,
    ) {
      const supabase = requireSupabase()
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role,
            business_name: businessName,
          },
        },
      })

      if (error) throw error

      if (role === 'cleaner_pending' && businessName && data.session?.user) {
        const { error: cleanerProfileError } = await supabase.from('cleaner_profiles').upsert({
          user_id: data.session.user.id,
          business_name: businessName,
        })

        if (cleanerProfileError) throw cleanerProfileError
      }
    },

    async signInWithGoogle(
      redirectPath?: string,
      signupRole?: PublicSignupRole,
      businessName?: string,
    ) {
      const supabase = requireSupabase()
      const redirectTo = new URL('/auth/callback', window.location.origin)

      if (redirectPath) {
        redirectTo.searchParams.set('redirect', redirectPath)
      }

      if (signupRole) {
        redirectTo.searchParams.set('signupRole', signupRole)
      }

      if (businessName) {
        redirectTo.searchParams.set('businessName', businessName)
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo.toString(),
        },
      })

      if (error) throw error
    },

    async provisionOAuthSignup(role?: PublicSignupRole, businessName?: string) {
      if (!role || !this.userId) return

      if (role === 'customer') {
        if (!this.profile) {
          await this.init()
        }
        return
      }

      const supabase = requireSupabase()

      if (this.profile?.role !== 'cleaner_pending' && this.profile?.role !== 'cleaner_active') {
        const { error } = await supabase
          .from('profiles')
          .update({ role: 'cleaner_pending' })
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
          business_name: businessName,
        })

        if (error) throw error
      } else if (businessName) {
        const { error } = await supabase
          .from('cleaner_profiles')
          .update({ business_name: businessName })
          .eq('user_id', this.userId)

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
      this.cleanerApplicationStatus = null
      this.membershipStatus = null
    },

    hasRole(role: Role) {
      return this.profile?.role === role
    },

    async _loadProfileData(userId: string) {
      const supabase = requireSupabase()

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (profileError) throw profileError
      this.profile = profile as Profile

      if (this.profile.role === 'cleaner_pending' || this.profile.role === 'cleaner_active') {
        const { data: cleanerProfile, error: cleanerError } = await supabase
          .from('cleaner_profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle()

        if (cleanerError) throw cleanerError
        this.cleanerProfile = cleanerProfile as CleanerProfile | null

        const { data: appRow } = await supabase
          .from('cleaner_applications')
          .select('status')
          .eq('cleaner_id', userId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        this.cleanerApplicationStatus = appRow?.status ?? null
      } else {
        this.cleanerProfile = null
        this.cleanerApplicationStatus = null
      }

      if (this.profile.role === 'customer') {
        const { data: membership } = await supabase
          .from('customer_memberships')
          .select('status')
          .eq('customer_id', userId)
          .maybeSingle()
        this.membershipStatus = (membership?.status as MembershipStatus | undefined) ?? 'free'
      } else {
        this.membershipStatus = null
      }
    },

    bindAuthListener() {
      if (this.authSubscription || !hasSupabaseConfig) return

      const supabase = requireSupabase()

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, _session: Session | null) => {
        // Handled by main.ts before mount — skip to avoid double-init on page load.
        if (event === 'INITIAL_SESSION') return

        // signIn() loads profile directly from the response it already has.
        // AuthCallbackPage calls init() explicitly for OAuth sign-ins.
        // Handling it here too would start a concurrent init() race.
        if (event === 'SIGNED_IN') return

        // Supabase silently refreshes the token in the background. The user
        // identity hasn't changed — no profile reload needed.
        if (event === 'TOKEN_REFRESHED') return

        if (event === 'SIGNED_OUT') {
          // Clear state directly — no network call needed. The session is already
          // gone; this handles multi-tab sign-outs where another tab cleared it.
          this.userId = null
          this.profile = null
          this.cleanerProfile = null
          this.cleanerApplicationStatus = null
          this.membershipStatus = null
          return
        }

        // USER_UPDATED, PASSWORD_RECOVERY, MFA_CHALLENGE_VERIFIED, etc.
        await this.init()
      })

      this.authSubscription = subscription
    },
  },
})
