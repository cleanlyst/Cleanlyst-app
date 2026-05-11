import { readonly, ref } from 'vue'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  message: string
  duration: number
}

const toasts = ref<Toast[]>([])

export function useToast() {
  function add(message: string, type: ToastType = 'info', duration = 4000): string {
    const id = Math.random().toString(36).slice(2, 10)
    toasts.value.push({ id, type, message, duration })
    if (duration > 0) {
      setTimeout(() => remove(id), duration)
    }
    return id
  }

  function remove(id: string) {
    const idx = toasts.value.findIndex((t) => t.id === id)
    if (idx !== -1) toasts.value.splice(idx, 1)
  }

  function success(message: string, duration?: number) {
    return add(message, 'success', duration)
  }

  function error(message: string, duration?: number) {
    return add(message, 'error', duration)
  }

  function warning(message: string, duration?: number) {
    return add(message, 'warning', duration)
  }

  function info(message: string, duration?: number) {
    return add(message, 'info', duration)
  }

  function clear() {
    toasts.value = []
  }

  return {
    toasts: readonly(toasts),
    add,
    remove,
    success,
    error,
    warning,
    info,
    clear,
  }
}
