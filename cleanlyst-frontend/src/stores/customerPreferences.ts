import { defineStore } from 'pinia'
import { getSupabaseClient } from '@/services/supabaseClient'
import type { CustomerPreferences } from '@/types/domain'

export const useCustomerPreferencesStore = defineStore('customerPreferences', {
  state: () => ({
    preferences: null as CustomerPreferences | null,
    loading: false,
  }),
  actions: {
    async load() {
      this.loading = true
      try {
        const supabase = getSupabaseClient()
        const { data: userData, error: userError } = await supabase.auth.getUser()
        if (userError) throw userError
        if (!userData.user) return

        const { data, error } = await supabase
          .from('customer_preferences')
          .select('*')
          .eq('customer_id', userData.user.id)
          .maybeSingle()
        if (error) throw error
        this.preferences = data as CustomerPreferences | null
      } finally {
        this.loading = false
      }
    },
    async save(payload: Partial<CustomerPreferences>) {
      const supabase = getSupabaseClient()
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!userData.user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('customer_preferences')
        .upsert(
          {
            customer_id: userData.user.id,
            ...payload,
          },
          { onConflict: 'customer_id' },
        )
        .select('*')
        .single()

      if (error) throw error
      this.preferences = data as CustomerPreferences
    },
  },
})
