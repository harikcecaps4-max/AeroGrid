import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { configureApiAuth, login as apiLogin, register as apiRegister } from '../api'

const AuthContext = createContext(null)

const DEMO_USERS = [
  { id: 1, email: 'admin@aerogrid.dev', role: 'admin', name: 'Chief Aviation Ops', station: 'BLR-OPS-01' },
  { id: 2, email: 'analyst@aerogrid.dev', role: 'analyst', name: 'Fleet Route Planner', station: 'PNQ-GIS-04' },
  { id: 3, email: 'viewer@aerogrid.dev', role: 'viewer', name: 'Sector Observer', station: 'OBS-READONLY' },
]

function buildUserSession(apiUser) {
  const matchedDemo = DEMO_USERS.find((u) => u.email === apiUser.email)
  return {
    ...apiUser,
    name: matchedDemo?.name || apiUser.name || (apiUser.email ? apiUser.email.split('@')[0] : 'Operator'),
    station: matchedDemo?.station || 'REMOTE-GIS',
  }
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('aerogrid_user')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('aerogrid_token') || null
    } catch {
      return null
    }
  })

  const tokenRef = useRef(token)
  tokenRef.current = token

  const logout = useCallback(() => {
    setCurrentUser(null)
    setToken(null)
    try {
      localStorage.removeItem('aerogrid_user')
      localStorage.removeItem('aerogrid_token')
    } catch {
      // ignore storage errors
    }
  }, [])

  useEffect(() => {
    configureApiAuth({
      getToken: () => tokenRef.current,
      onUnauthorized: logout,
    })
  }, [logout])

  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem('aerogrid_user', JSON.stringify(currentUser))
      } else {
        localStorage.removeItem('aerogrid_user')
      }
    } catch (e) {
      console.error('Failed to persist user session', e)
    }
  }, [currentUser])

  useEffect(() => {
    try {
      if (token) {
        localStorage.setItem('aerogrid_token', token)
      } else {
        localStorage.removeItem('aerogrid_token')
      }
    } catch (e) {
      console.error('Failed to persist auth token', e)
    }
  }, [token])

  function switchRole(roleName) {
    const match = DEMO_USERS.find((u) => u.role === roleName) || DEMO_USERS[0]
    setCurrentUser(match)
    setToken(null)
  }

  async function loginWithCredentials(email, password) {
    const normalizedEmail = (email || '').trim().toLowerCase()
    try {
      const data = await apiLogin({ email: normalizedEmail, password })
      if (!data?.user || !data?.token) {
        return { ok: false, error: 'Invalid authentication response from server.' }
      }
      const userSession = buildUserSession(data.user)
      setCurrentUser(userSession)
      setToken(data.token)
      return { ok: true, mode: 'api', user: userSession, token: data.token }
    } catch (err) {
      return {
        ok: false,
        error: err?.message || 'Sign-in failed.',
        status: err?.status || 0,
        isUnavailable: Boolean(err?.isUnavailable),
      }
    }
  }

  async function registerWithCredentials(email, password) {
    const normalizedEmail = (email || '').trim().toLowerCase()
    try {
      const data = await apiRegister({ email: normalizedEmail, password })
      if (!data?.user || !data?.token) {
        return { ok: false, error: 'Invalid registration response from server.' }
      }
      const userSession = buildUserSession(data.user)
      setCurrentUser(userSession)
      setToken(data.token)
      return { ok: true, mode: 'api', user: userSession, token: data.token }
    } catch (err) {
      return {
        ok: false,
        error: err?.message || 'Registration failed.',
        status: err?.status || 0,
        isUnavailable: Boolean(err?.isUnavailable),
      }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        token,
        isAuthenticated: Boolean(currentUser && token),
        switchRole,
        loginWithCredentials,
        registerWithCredentials,
        logout,
        availableUsers: DEMO_USERS,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
