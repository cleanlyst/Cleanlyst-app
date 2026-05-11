import { computed, reactive, ref } from 'vue'
import { type FieldRules, type FormErrors, hasErrors, validateForm } from '@/utils/validation'

export function useFormValidation<T extends Record<string, unknown>>(
  initialValues: T,
  rules: FieldRules<T>,
) {
  const values = reactive({ ...initialValues }) as T
  const errors = reactive({} as FormErrors<T>)
  const submitted = ref(false)

  function validate(): boolean {
    const result = validateForm(values, rules)
    Object.assign(errors, result)
    return !hasErrors(result)
  }

  function validateField(field: keyof T): void {
    const fieldRules = rules[field]
    if (!fieldRules) return

    let fieldError: string | null = null
    for (const rule of fieldRules) {
      const msg = rule(values[field])
      if (msg) { fieldError = msg; break }
    }
    errors[field] = fieldError
  }

  function handleSubmit(onValid: (values: T) => void | Promise<void>) {
    return async (e?: Event) => {
      e?.preventDefault()
      submitted.value = true
      if (validate()) {
        await onValid(values)
      }
    }
  }

  function reset() {
    Object.assign(values, initialValues)
    Object.keys(errors).forEach((k) => { errors[k as keyof T] = null })
    submitted.value = false
  }

  const isValid = computed(() => !hasErrors(errors as FormErrors<T>))

  return { values, errors, submitted, isValid, validate, validateField, handleSubmit, reset }
}
