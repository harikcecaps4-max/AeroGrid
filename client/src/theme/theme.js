/**
 * Theme helpers (pure + DOM-safe). The same resolution order is inlined in index.html
 * so the correct data-theme is on <html> before first paint (no flash).
 *
 * Order: saved choice (localStorage) → OS preference (prefers-color-scheme) → light.
 */

export const THEME_KEY = 'aerogrid_theme'
export const THEMES = ['light', 'dark']

export function isTheme(value) {
  return THEMES.includes(value)
}

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null // access itself can throw (blocked cookies / privacy mode)
  }
}

export function readStoredTheme(storage = defaultStorage()) {
  try {
    const value = storage?.getItem(THEME_KEY)
    return isTheme(value) ? value : null
  } catch {
    return null
  }
}

export function persistTheme(theme, storage = defaultStorage()) {
  try {
    storage?.setItem(THEME_KEY, theme)
    return true
  } catch {
    return false // quota / disabled storage: theme still applies for this session
  }
}

export function systemTheme(win = globalThis.window) {
  try {
    return win?.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function resolveInitialTheme({ storage, win } = {}) {
  return readStoredTheme(storage) ?? systemTheme(win)
}

export function applyTheme(theme, root = globalThis.document?.documentElement) {
  if (!root || !isTheme(theme)) return
  root.setAttribute('data-theme', theme)
}

export function nextTheme(theme) {
  return theme === 'dark' ? 'light' : 'dark'
}
