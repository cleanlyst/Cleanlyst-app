export type Validator<T = string> = (value: T) => string | null

// ── Primitive validators ───────────────────────────────────────────────────

export const required =
  (message = 'This field is required'): Validator =>
  (value) =>
    value === null || value === undefined || String(value).trim() === '' ? message : null

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

export const pattern =
  (regex: RegExp, message = 'Invalid format'): Validator =>
  (value) =>
    regex.test(String(value)) ? null : message
