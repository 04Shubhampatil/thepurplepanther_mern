import axios from 'axios'

/**
 * API client.
 *
 * `withCredentials` is essential, not optional: authentication and the guest cart both
 * ride on HTTP-only cookies. Without it every request is anonymous and the cart empties on
 * navigation.
 *
 * In development VITE_API_BASE_URL is blank and Vite proxies /api to the server, so the
 * browser sees one origin and the cookies stay first-party.
 */
const api = axios.create({
  baseURL: `${(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')}/api/v1`,
  withCredentials: true,
  headers: { Accept: 'application/json' },
  timeout: 30_000,
})

/** Normalised error shape, so no component has to unwrap an Axios error itself. */
export class ApiError extends Error {
  constructor(message, { status = 0, errors = null, original = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
    this.original = original
  }

  /** First message for a field, for inline form errors. */
  fieldError(field) {
    return this.errors?.[field]?.[0] ?? null
  }
}

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      const { status, data } = error.response
      return Promise.reject(
        new ApiError(data?.message ?? 'Something went wrong. Please try again.', {
          status,
          errors: data?.errors ?? null,
          original: error,
        }),
      )
    }

    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new ApiError('The request timed out. Please try again.', { original: error }))
    }

    return Promise.reject(
      new ApiError('Could not reach the server. Please check your connection.', { original: error }),
    )
  },
)

/**
 * Unwrap the { success, data, message } envelope.
 *
 * `message` is carried through on a non-enumerable `$message` so the admin can show it.
 * Laravel's panel toasted `session('success')` — the string the CONTROLLER wrote, never one
 * the page invented — and keeping that property here is what lets the React panel do the
 * same without every call site repeating the wording and drifting from the server's.
 *
 * Non-enumerable so it survives neither `JSON.stringify` nor a spread, and cannot be
 * mistaken for part of the payload.
 */
const unwrap = (promise) =>
  promise.then((body) => {
    const data = body?.data ?? body
    if (data && typeof data === 'object' && body?.message) {
      Object.defineProperty(data, '$message', { value: body.message, enumerable: false })
    }
    return data
  })

export const get = (url, config) => unwrap(api.get(url, config))
export const post = (url, body, config) => unwrap(api.post(url, body, config))
export const patch = (url, body, config) => unwrap(api.patch(url, body, config))
export const put = (url, body, config) => unwrap(api.put(url, body, config))
export const del = (url, config) => unwrap(api.delete(url, config))

/** Full envelope, when the `message` is needed as well as the data. */
export const raw = {
  get: (url, config) => api.get(url, config),
  post: (url, body, config) => api.post(url, body, config),
}

/** Multipart helper for admin forms. Arrays and objects are encoded as the API expects. */
export function toFormData(values, files = {}) {
  const form = new FormData()

  for (const [key, value] of Object.entries(values ?? {})) {
    if (value === undefined || value === null) continue
    if (typeof value === 'boolean') {
      form.append(key, value ? '1' : '0')
    } else if (Array.isArray(value) || typeof value === 'object') {
      form.append(key, JSON.stringify(value))
    } else {
      form.append(key, value)
    }
  }

  // `files ?? {}` — the default parameter only covers `undefined`, and callers pass an
  // explicit `null` when nothing was picked (`image ? { image } : null`). Object.entries(null)
  // throws, which surfaced as "Cannot convert undefined or null to object" in the toast.
  for (const [key, value] of Object.entries(files ?? {})) {
    if (!value) continue
    if (value instanceof FileList || Array.isArray(value)) {
      Array.from(value).forEach((file) => form.append(key, file))
    } else {
      form.append(key, value)
    }
  }

  return form
}

export default api
