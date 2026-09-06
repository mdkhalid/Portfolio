import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import api, { setAuthToken, setTokenUpdateHandler, fetchCsrfToken } from '../lib/api'

const AuthContext = createContext()

const STORAGE_KEY = 'auth'

const loadAuth = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { token: null, user: null }
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return { token: parsed.token || null, user: parsed.user || null }
    }
  } catch {
    // ignore parse errors
  }
  return { token: null, user: null }
}

const saveAuth = (data) => {
  try {
    if (data && data.token) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // localStorage may be unavailable
  }
}

const initial = loadAuth()

export function AuthProvider({ children }) {
  const [token, setToken] = useState(initial.token)
  const [user, setUser] = useState(initial.user)

  // Sync token to api module on mount/login
  useEffect(() => {
    setAuthToken(token)
    if (token) {
      fetchCsrfToken()
    }
  }, [token])

  // Register a handler so the axios 401 interceptor can persist a
  // silently-refreshed JWT back into localStorage + React state.
  useEffect(() => {
    setTokenUpdateHandler((newToken) => {
      if (newToken && user) {
        saveAuth({ token: newToken, user })
        setToken(newToken)
      }
    })
    return () => setTokenUpdateHandler(null)
  }, [user])

  const login = useCallback(async (username, password) => {
    const { data } = await api.post('/api/auth/login', { username, password })
    const next = { token: data.token, user: { username: data.username } }
    saveAuth(next)
    setToken(next.token)
    setUser(next.user)
    await fetchCsrfToken()
  }, [])

  const logout = useCallback(async () => {
    saveAuth(null)
    setToken(null)
    setUser(null)
    // Best-effort: invalidate the server-side refresh cookie so a stolen
    // token can't be silently renewed. Never block on this.
    try { await api.post('/api/auth/logout') } catch { /* ignore */ }
  }, [])

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAdmin: !!token }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
