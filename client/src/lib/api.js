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

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && logoutHandler) {
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
