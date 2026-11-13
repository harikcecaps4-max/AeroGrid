import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

const DEMO_USERS = [
  { id: 1, email: 'admin@aerogrid.dev', role: 'admin', name: 'Chief Aviation Ops', station: 'BLR-OPS-01' },
  { id: 2, email: 'analyst@aerogrid.dev', role: 'analyst', name: 'Fleet Route Planner', station: 'PNQ-GIS-04' },
  { id: 3, email: 'viewer@aerogrid.dev', role: 'viewer', name: 'Sector Observer', station: 'OBS-READONLY' },
]

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('aerogrid_user')
      return saved ? JSON.parse(saved) : DEMO_USERS[0]
    } catch {
      return DEMO_USERS[0]
    }
  })

  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('aerogrid_token') || null
    } catch {
      return null
    }
  })

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
  }

  async function loginWithCredentials(email, password, fallbackRole = 'analyst') {
    const normalizedEmail = (email || '').trim().toLowerCase()
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data?.user) {
          const matchedDemo = DEMO_USERS.find((u) => u.email === data.user.email)
          const userSession = {
            ...data.user,
            name: matchedDemo?.name || data.user.email.split('@')[0],
            station: matchedDemo?.station || 'REMOTE-GIS',
          }
          setCurrentUser(userSession)
          setToken(data.token || null)
          return { ok: true, mode: 'api', user: userSession }
        }
      }
    } catch {
      // Fallback to local workstation session when offline
    }

    const demoMatch = DEMO_USERS.find((u) => u.email === normalizedEmail)
    if (demoMatch) {
      setCurrentUser(demoMatch)
      setToken(null)
      return { ok: true, mode: 'local', user: demoMatch }
    }

    const customUser = {
      id: Date.now(),
      email: normalizedEmail || `${fallbackRole}@aerogrid.dev`,
      role: fallbackRole,
      name: (normalizedEmail.split('@')[0] || fallbackRole).replace(/[^a-zA-Z0-9_-]/g, ' '),
      station: 'LOCAL-WORKSTATION',
    }
    setCurrentUser(customUser)
    setToken(null)
    return { ok: true, mode: 'local', user: customUser }
  }

  function logout() {
    setCurrentUser(null)
    setToken(null)
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        token,
        isAuthenticated: Boolean(currentUser),
        switchRole,
        loginWithCredentials,
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
