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

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${authToken}`
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
