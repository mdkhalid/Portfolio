import axios from 'axios'
import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

// VITE_API_URL set for split FE/BE deploys (e.g. https://api.example.com).
// Empty string = same-origin relative URLs: works with Vite dev proxy
// and with express serving client/dist in production.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 30000,
})

let logoutHandler = null

export const setLogoutHandler = (fn) => {
  logoutHandler = fn
}

let authToken = null
export const setAuthToken = (token) => {
  authToken = token || null
}

let csrfToken = null
export const setCsrfToken = (token) => {
  csrfToken = token || null
}

export const fetchCsrfToken = async () => {
  try {
    const { data } = await api.get('/api/csrf-token')
    setCsrfToken(data.csrfToken)
  } catch {
    // CSRF token fetch is non-critical; write ops will 403 if missing
  }
}

// Token-update handler lets AuthContext persist a refreshed JWT to
// localStorage / React state when it silently renews after a 401.
let tokenUpdateHandler = null
export const setTokenUpdateHandler = (fn) => {
  tokenUpdateHandler = fn
}

// Refresh-on-401 bookkeeping: a single in-flight refresh serves all
// requests that fail while it's running.
let isRefreshing = false
let refreshQueue = []

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${authToken}`
  }
  if (csrfToken && !config.headers['x-csrf-token']) {
    config.headers = config.headers || {}
    config.headers['x-csrf-token'] = csrfToken
  }
  return config
})

/**
 * Attempt a silent JWT refresh via the httpOnly refresh-token cookie.
 * Returns the new access token on success, or null on failure.
 */
async function attemptRefresh() {
  if (isRefreshing) {
    // Another refresh is already in flight — queue behind it.
    return new Promise((resolve) => {
      refreshQueue.push((token) => resolve(token))
    })
  }

  isRefreshing = true
  try {
    // The refresh endpoint is authenticated by the httpOnly cookie only — no
    // bearer needed. (The request interceptor may attach a stale one, which
    // the server ignores on this route.)
    const { data } = await api.post('/api/auth/refresh')
    if (data?.token) {
      setAuthToken(data.token)
      if (tokenUpdateHandler) tokenUpdateHandler(data.token)
      // Serve all queued waiters with the new token.
      refreshQueue.forEach((cb) => cb(data.token))
      refreshQueue = []
      return data.token
    }
    throw new Error('Refresh did not return a token')
  } catch {
    // Refresh failed (expired/invalid cookie) — everyone queued gets null.
    refreshQueue.forEach((cb) => cb(null))
    refreshQueue = []
    return null
  } finally {
    isRefreshing = false
  }
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const { config, response } = err

    // Only retry on auth failure, and never retry the refresh/logout
    // endpoints themselves (would cause an infinite loop).
    if (response?.status === 401 && !config._retry &&
        config.url !== '/api/auth/refresh' && config.url !== '/api/auth/logout') {
      config._retry = true
      const newToken = await attemptRefresh()
      if (newToken) {
        config.headers = config.headers || {}
        config.headers.Authorization = `Bearer ${newToken}`
        return api(config)
      }
      // Refresh failed — force logout.
      if (logoutHandler) logoutHandler()
      return Promise.reject(err)
    }

    // Any other 401 (e.g. refresh endpoint returned 401) → log out.
    if (response?.status === 401 && logoutHandler) {
      logoutHandler()
    }
    return Promise.reject(err)
  }
)

export const useApiAuth = () => {
  const { token, logout } = useAuth()
  useEffect(() => {
    setAuthToken(token)
  }, [token])
  useEffect(() => {
    setLogoutHandler(logout)
    return () => setLogoutHandler(null)
  }, [logout])
  return api
}

/**
 * Centralized error-message extraction for every API call in the app.
 * Returns a human-safe string; never leaks raw provider/stack details.
 */
export const getApiErrorMessage = (err, fallback = 'Something went wrong. Please try again.') => {
  if (!err) return fallback
  if (err.code === 'ECONNABORTED' || err.message === 'Network Error') {
    return 'Cannot reach the server. Check your connection and retry.'
  }
  return err.response?.data?.error || err.message || fallback
}

export default api
