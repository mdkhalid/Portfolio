import axios from 'axios'
import { useAuth } from '../context/AuthContext'

const api = axios.create({
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
  if (csrfToken && !config.headers['X-CSRF-Token']) {
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
  setAuthToken(token)
  setLogoutHandler(() => logout())
  return api
}

export default api
