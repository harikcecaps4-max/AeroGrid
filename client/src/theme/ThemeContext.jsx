import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  applyTheme,
  nextTheme,
  persistTheme,
  readStoredTheme,
  resolveInitialTheme,
  systemTheme,
} from './theme'

const ThemeContext = createContext({ theme: 'light', setTheme: () => {}, toggleTheme: () => {} })

export function ThemeProvider({ children }) {
  // index.html already set data-theme before paint; read it back so React and DOM agree.
  const [theme, setThemeState] = useState(
    () => document.documentElement.getAttribute('data-theme') || resolveInitialTheme(),
  )

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // While the user has not chosen explicitly, follow OS changes live.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq?.addEventListener) return undefined
    const onChange = () => {
      if (!readStoredTheme()) setThemeState(systemTheme())
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const setTheme = useCallback((next) => {
    setThemeState(next)
    persistTheme(next)
  }, [])

  const toggleTheme = useCallback(() => setTheme(nextTheme(theme)), [theme, setTheme])

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  return useContext(ThemeContext)
}
