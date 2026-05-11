import { ref } from 'vue'

export interface AsyncState<T> {
  data: ReturnType<typeof ref<T | null>>
  loading: ReturnType<typeof ref<boolean>>
  error: ReturnType<typeof ref<string | null>>
  execute: (...args: Parameters<() => Promise<T>>) => Promise<T | null>
  reset: () => void
}

export function useAsync<T, TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<T>,
  initialData: T | null = null,
) {
  const data = ref<T | null>(initialData) as ReturnType<typeof ref<T | null>>
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function execute(...args: TArgs): Promise<T | null> {
    loading.value = true
    error.value = null
    try {
      const result = await fn(...args)
      data.value = result
      return result
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'An unexpected error occurred'
      return null
    } finally {
      loading.value = false
    }
  }

  function reset() {
    data.value = initialData
    loading.value = false
    error.value = null
  }

  return { data, loading, error, execute, reset }
}
