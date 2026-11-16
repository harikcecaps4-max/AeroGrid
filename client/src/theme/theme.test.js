import test from 'node:test'
import assert from 'node:assert/strict'
import {
  THEME_KEY,
  readStoredTheme,
  persistTheme,
  systemTheme,
  resolveInitialTheme,
  applyTheme,
  nextTheme,
} from './theme.js'

const memoryStorage = (initial = {}) => {
  const data = { ...initial }
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => void (data[k] = v), data }
}
const throwingStorage = {
  getItem() {
    throw new Error('blocked')
  },
  setItem() {
    throw new Error('quota')
  },
}
const win = (dark) => ({ matchMedia: () => ({ matches: dark }) })

test('saved choice wins over OS preference', () => {
  const storage = memoryStorage({ [THEME_KEY]: 'light' })
  assert.equal(resolveInitialTheme({ storage, win: win(true) }), 'light')
})

test('falls back to prefers-color-scheme when nothing is saved', () => {
  assert.equal(resolveInitialTheme({ storage: memoryStorage(), win: win(true) }), 'dark')
  assert.equal(resolveInitialTheme({ storage: memoryStorage(), win: win(false) }), 'light')
})

test('ignores garbage values in storage', () => {
  assert.equal(readStoredTheme(memoryStorage({ [THEME_KEY]: 'purple' })), null)
})

test('storage that throws never breaks resolution or persistence', () => {
  assert.equal(readStoredTheme(throwingStorage), null)
  assert.equal(persistTheme('dark', throwingStorage), false)
  assert.equal(resolveInitialTheme({ storage: throwingStorage, win: win(true) }), 'dark')
})

test('missing matchMedia defaults to light', () => {
  assert.equal(systemTheme({}), 'light')
  assert.equal(systemTheme(undefined), 'light')
})

test('persistTheme writes the key and applyTheme sets data-theme', () => {
  const storage = memoryStorage()
  assert.equal(persistTheme('dark', storage), true)
  assert.equal(storage.data[THEME_KEY], 'dark')
  const attrs = {}
  applyTheme('dark', { setAttribute: (k, v) => (attrs[k] = v) })
  assert.deepEqual(attrs, { 'data-theme': 'dark' })
  applyTheme('bogus', { setAttribute: (k, v) => (attrs[k] = v) })
  assert.equal(attrs['data-theme'], 'dark')
})

test('nextTheme toggles', () => {
  assert.equal(nextTheme('light'), 'dark')
  assert.equal(nextTheme('dark'), 'light')
})
