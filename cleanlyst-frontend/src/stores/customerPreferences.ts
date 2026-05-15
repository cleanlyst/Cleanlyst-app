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

      const body = {
        customer_id: userData.user.id,
        ...payload,
      }

      console.debug('[customerPreferences] save payload', body)

      let data = null
      let error = null

      if (this.preferences) {
        const result = await supabase
          .from('customer_preferences')
          .update(payload)
          .eq('customer_id', userData.user.id)
          .select('*')
          .single()

        data = result.data
        error = result.error
      } else {
        const result = await supabase.from('customer_preferences').insert(body).select('*').single()

        data = result.data
        error = result.error

        if (error && error.code === '23505') {
          const fallback = await supabase
            .from('customer_preferences')
            .update(payload)
            .eq('customer_id', userData.user.id)
            .select('*')
            .single()
          data = fallback.data
          error = fallback.error
        }
      }

      console.debug('[customerPreferences] save response', { data, error })

      if (error) throw error
      if (!data) throw new Error('Failed to persist customer preferences.')
      this.preferences = data as CustomerPreferences
    },
  },
})
