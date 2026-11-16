#!/usr/bin/env node
/**
 * WCAG 2.1 AA contrast gate for the AeroGrid design tokens.
 * Reads client/src/styles/tokens.css, resolves var() aliases per theme,
 * and checks every text/background pair the UI uses. Exit code 1 on any failure.
 *
 *   node client/scripts/check-contrast.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(join(here, '../src/styles/tokens.css'), 'utf8')

function block(selectorRegex) {
  const m = css.match(selectorRegex)
  if (!m) throw new Error(`block not found: ${selectorRegex}`)
  const vars = {}
  for (const [, k, v] of m[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars[k] = v.trim()
  return vars
}

const base = {
  ...block(/:root\s*\{([\s\S]*?)\n\}\n\n\/\* ── LIGHT/),
}
const light = block(/:root,\s*:root\[data-theme='light'\]\s*\{([\s\S]*?)\n\}\n\n\/\* ── DARK/)
const dark = block(/:root\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}\n\n\/\* =/)
const aliasMatch = css.match(/Compatibility aliases[\s\S]*?:root\s*\{([\s\S]*)\}\s*$/)
const aliases = {}
for (const [, k, v] of aliasMatch[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) aliases[k] = v.trim()

function resolver(theme) {
  const all = { ...base, ...aliases, ...theme }
  const get = (name, depth = 0) => {
    if (depth > 8) throw new Error(`alias loop at ${name}`)
    const raw = all[name]
    if (raw === undefined) throw new Error(`undefined token ${name}`)
    const ref = raw.match(/^var\((--[\w-]+)\)$/)
    return ref ? get(ref[1], depth + 1) : raw
  }
  return get
}

function parse(c) {
  const hex = c.match(/^#([0-9a-f]{6})$/i)
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16))
  throw new Error(`cannot parse colour "${c}" (use solid hex for checked pairs)`)
}
const lin = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
const ratio = (a, b) => {
  const [x, y] = [lum(parse(a)), lum(parse(b))]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

// [foreground token, background token, usage]
const PAIRS = [
  ['--text', '--bg', 'body text on page'],
  ['--text', '--surface', 'titles on cards'],
  ['--text', '--surface-raised', 'text on raised strips / table headers'],
  ['--text', '--surface-hover', 'text on hover'],
  ['--text', '--surface-active', 'text on selected row'],
  ['--text-muted', '--bg', 'muted text on page'],
  ['--text-muted', '--surface', 'muted text on cards'],
  ['--text-muted', '--surface-raised', 'muted labels / table headers'],
  ['--text-muted', '--surface-hover', 'muted on hover'],
  ['--text-muted', '--surface-active', 'muted on selected row'],
  ['--accent-text', '--bg', 'links on page'],
  ['--accent-text', '--surface', 'links on cards'],
  ['--accent-text', '--surface-raised', 'links on raised'],
  ['--accent-text', '--accent-tint', 'active nav / chips'],
  ['--accent-text', '--accent-tint-hover', 'chip hover'],
  ['--accent-text', '--surface-active', 'link on selected row'],
  ['--on-accent', '--accent', 'primary button / active pill'],
  ['--on-cta', '--cta', 'orange CTA'],
  ['--on-cta', '--cta-hover', 'orange CTA hover'],
  ['--inverse-text', '--inverse-bg', 'avatar / inverse chip'],
  ['--viable-text', '--viable-bg', 'VIABLE badge'],
  ['--viable-text', '--surface', 'viable text on card'],
  ['--viable-text', '--surface-raised', 'viable text on raised'],
  ['--viable-text', '--bg', 'viable text on page'],
  ['--conditional-text', '--conditional-bg', 'CONDITIONAL badge'],
  ['--conditional-text', '--surface', 'conditional text on card'],
  ['--conditional-text', '--surface-raised', 'conditional text on raised'],
  ['--conditional-text', '--bg', 'conditional text on page'],
  ['--not-viable-text', '--not-viable-bg', 'NOT VIABLE badge'],
  ['--not-viable-text', '--surface', 'not-viable text on card'],
  ['--not-viable-text', '--surface-raised', 'not-viable text on raised'],
  ['--not-viable-text', '--bg', 'not-viable text on page'],
  ['--on-accent', '--viable-solid', 'tier marker (viable)'],
  ['--on-accent', '--conditional-solid', 'tier marker (conditional)'],
  ['--on-accent', '--not-viable-solid', 'tier marker (not viable)'],
  ['--map-popup-text', '--map-popup-bg', 'map popup'],
]
// Markers always carry white text regardless of theme
const FORCE_WHITE = new Set(['tier marker (viable)', 'tier marker (conditional)', 'tier marker (not viable)'])

let failures = 0
for (const [name, theme] of [['light', light], ['dark', dark]]) {
  const get = resolver(theme)
  console.log(`\n=== ${name.toUpperCase()} theme (AA ≥ 4.5:1) ===`)
  for (const [fg, bg, usage] of PAIRS) {
    const fgv = FORCE_WHITE.has(usage) ? '#ffffff' : get(fg)
    const r = ratio(fgv, get(bg))
    const ok = r >= 4.5
    if (!ok) failures += 1
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${r.toFixed(2).padStart(5)}:1  ${usage.padEnd(38)} ${fgv} on ${get(bg)}`)
  }
}
console.log(failures ? `\n${failures} pair(s) below 4.5:1` : '\nAll checked pairs meet WCAG AA (≥ 4.5:1) in both themes.')
process.exit(failures ? 1 : 0)
