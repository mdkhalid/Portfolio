import { createContext, useContext, useState, useCallback } from 'react'
import api from '../lib/api'

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

  const login = useCallback(async (username, password) => {
    const { data } = await api.post('/api/auth/login', { username, password })
    const next = { token: data.token, user: { username: data.username } }
    saveAuth(next)
    setToken(next.token)
    setUser(next.user)
  }, [])

  const logout = useCallback(() => {
    saveAuth(null)
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAdmin: !!token }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
