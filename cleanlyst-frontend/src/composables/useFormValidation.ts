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
    const rule = rules[field]
    if (!rule) return
    // FieldRules<T> maps each field to a single Validator — call it directly.
    // Cast through FormErrors<T> to sidestep Reactive<> mapped-type indexing limits.
    ;(errors as FormErrors<T>)[field] = rule(values[field])
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
    Object.keys(errors).forEach((k) => { ;(errors as FormErrors<T>)[k as keyof T] = null })
    submitted.value = false
  }

  const isValid = computed(() => !hasErrors(errors as FormErrors<T>))

  return { values, errors, submitted, isValid, validate, validateField, handleSubmit, reset }
}
