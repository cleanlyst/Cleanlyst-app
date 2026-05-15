export type Validator<T = string> = (value: T) => string | null

// ── Primitive validators ───────────────────────────────────────────────────

export const required =
  (message = 'This field is required'): Validator =>
  (value) =>
    value === null || value === undefined || String(value).trim() === '' ? message : null

export const minLength =
  (min: number, message?: string): Validator =>
  (value) =>
    String(value).trim().length < min
      ? (message ?? `Must be at least ${min} characters`)
      : null

export const maxLength =
  (max: number, message?: string): Validator =>
  (value) =>
    String(value).trim().length > max
      ? (message ?? `Must be no more than ${max} characters`)
      : null

export const email =
  (message = 'Enter a valid email address'): Validator =>
  (value) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim()) ? null : message

export const phone =
  (message = 'Enter a valid UK phone number'): Validator =>
  (value) =>
    /^(\+44|0)[1-9]\d{8,9}$/.test(String(value).replace(/\s/g, '')) ? null : message

export const postcode =
  (message = 'Enter a valid UK postcode'): Validator =>
  (value) =>
    /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i.test(String(value).trim()) ? null : message

export const minValue =
  (min: number, message?: string): Validator<number> =>
  (value) =>
    value < min ? (message ?? `Must be at least ${min}`) : null

export const maxValue =
  (max: number, message?: string): Validator<number> =>
  (value) =>
    value > max ? (message ?? `Must be no more than ${max}`) : null

export const pattern =
  (regex: RegExp, message = 'Invalid format'): Validator =>
  (value) =>
    regex.test(String(value)) ? null : message

// ── Compose multiple validators ────────────────────────────────────────────

export function compose<T = string>(...validators: Validator<T>[]): Validator<T> {
  return (value: T) => {
    for (const validate of validators) {
      const error = validate(value)
      if (error) return error
    }
    return null
  }
}

// ── Validate a whole form object ───────────────────────────────────────────

export type FieldRules<T extends object> = {
  [K in keyof T]?: Validator<T[K]>
}

export type FormErrors<T extends object> = {
  [K in keyof T]?: string | null
}

export function validateForm<T extends object>(
  values: T,
  rules: FieldRules<T>,
): FormErrors<T> {
  const errors: FormErrors<T> = {}
  for (const key in rules) {
    const rule = rules[key as keyof T]
    if (rule) {
      const error = rule(values[key as keyof T])
      if (error) {
        errors[key as keyof T] = error
      }
    }
  }
  return errors
}

export function hasErrors<T extends object>(errors: FormErrors<T>): boolean {
  return Object.values(errors).some(Boolean)
}
