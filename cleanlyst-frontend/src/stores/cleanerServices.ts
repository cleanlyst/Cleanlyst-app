import { defineStore } from 'pinia'
import { ref } from 'vue'
import { requireSupabase } from '@/lib/supabase'

export interface CleanerService {
  id: string
  cleaner_id: string
  title: string
  category: string
  description: string | null
  base_price_cents: number
  duration_minutes: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface ServiceDraft {
  title: string
  category: string
  description?: string
  base_price_cents: number
  duration_minutes: number
}

const SELECT_COLS =
  'id, cleaner_id, title, category, description, base_price_cents, duration_minutes, active, created_at, updated_at'

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) {
    const msg = (e as { message: unknown }).message
    if (typeof msg === 'string' && msg) return msg
  }
  return fallback
}

export const useCleanerServicesStore = defineStore('cleanerServices', () => {
  const services = ref<CleanerService[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  function _sort() {
    services.value.sort(
      (a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title),
    )
  }

  async function load(cleanerId: string) {
    loading.value = true
    error.value = null
    try {
      const supabase = requireSupabase()
      const { data, error: err } = await supabase
        .from('services')
        .select(SELECT_COLS)
        .eq('cleaner_id', cleanerId)
        .eq('active', true)
        .order('category')
        .order('title')
      if (err) throw err
      services.value = (data ?? []) as CleanerService[]
    } catch (e) {
      error.value = errorMessage(e, 'Failed to load services.')
    } finally {
      loading.value = false
    }
  }

  async function addMany(cleanerId: string, drafts: ServiceDraft[]): Promise<void> {
    saving.value = true
    error.value = null
    try {
      const supabase = requireSupabase()
      const rows = drafts.map((d) => ({
        cleaner_id: cleanerId,
        title: d.title,
        category: d.category,
        description: d.description?.trim() || null,
        base_price_cents: d.base_price_cents,
        duration_minutes: d.duration_minutes,
        pricing_model: 'fixed' as const,
        active: true,
      }))
      const { data, error: err } = await supabase
        .from('services')
        .insert(rows)
        .select(SELECT_COLS)
      if (err) throw err
      services.value.push(...((data ?? []) as CleanerService[]))
      _sort()
    } catch (e) {
      error.value = errorMessage(e, 'Failed to save services.')
      throw e
    } finally {
      saving.value = false
    }
  }

  async function update(
    id: string,
    patch: Partial<Pick<CleanerService, 'base_price_cents' | 'duration_minutes' | 'description'>>,
  ): Promise<void> {
    saving.value = true
    error.value = null
    try {
      const supabase = requireSupabase()
      const { data, error: err } = await supabase
        .from('services')
        .update(patch)
        .eq('id', id)
        .select(SELECT_COLS)
        .single()
      if (err) throw err
      const idx = services.value.findIndex((s) => s.id === id)
      if (idx !== -1) services.value[idx] = data as CleanerService
    } catch (e) {
      error.value = errorMessage(e, 'Failed to update service.')
      throw e
    } finally {
      saving.value = false
    }
  }

  async function remove(id: string): Promise<void> {
    saving.value = true
    error.value = null
    try {
      const supabase = requireSupabase()
      const { error: err } = await supabase.from('services').delete().eq('id', id)
      if (err) throw err
      services.value = services.value.filter((s) => s.id !== id)
    } catch (e) {
      error.value = errorMessage(e, 'Failed to remove service.')
      throw e
    } finally {
      saving.value = false
    }
  }

  function reset() {
    services.value = []
    error.value = null
    loading.value = false
    saving.value = false
  }

  return { services, loading, saving, error, load, addMany, update, remove, reset }
})
