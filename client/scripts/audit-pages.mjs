#!/usr/bin/env node
/**
 * Page/theme audit: drives a throw-away headless Chrome over CDP (no extra deps).
 *  - screenshots every route in light + dark
 *  - runs a computed-style WCAG contrast audit on all visible text (strict 4.5:1)
 *  - verifies the LIGHT/DARK toggle, localStorage persistence and no-flash first paint
 *
 *   node scripts/audit-pages.mjs --out ./shots [--base http://localhost:5173] [--only map,reports] [--no-shots]
 * Exit code 1 if any contrast failure or toggle check fails.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const BASE = opt('base', 'http://localhost:5173')
const OUT = opt('out', './shots')
const ONLY = opt('only', '')
const SHOTS = !args.includes('--no-shots')
const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9333 + Math.floor(Math.random() * 500)

const ROUTES = [
  { id: 'overview', hash: '#/', label: 'Overview' },
  { id: 'map', hash: '#/map', label: 'Aeronautical Map' },
  { id: 'map-detail', hash: '#/map?strip=13', label: 'Aeronautical Map (airstrip selected)' },
  { id: 'fleet-deployments', hash: '#/analytics', label: 'Fleet Deployments / Analytics' },
  { id: 'airstrip-directory', hash: '#/regions', label: 'Airstrip Directory / Regions' },
  { id: 'simulation-dossier', hash: '#/reports', label: 'Simulation Dossier / Reports' },
  { id: 'global-grid', hash: '#/world-map', label: 'Global Grid' },
  { id: 'login', hash: '#/login', label: 'Login' },
].filter((r) => !ONLY || ONLY.split(',').includes(r.id))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function launch() {
  const dir = mkdtempSync(join(tmpdir(), 'aerogrid-audit-'))
  const proc = spawn(
    CHROME,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${dir}`,
      '--hide-scrollbars',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ],
    { stdio: 'ignore' },
  )
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const list = await res.json()
      const page = list.find((t) => t.type === 'page')
      if (page) return { proc, dir, wsUrl: page.webSocketDebuggerUrl }
    } catch {
      /* not ready */
    }
    await sleep(250)
  }
  proc.kill()
  throw new Error('Chrome did not expose a debugging endpoint')
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl)
  let id = 0
  const pending = new Map()
  const listeners = []
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
    } else if (msg.method) listeners.forEach((l) => l(msg))
  }
  const ready = new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = reject
  })
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const myId = ++id
      pending.set(myId, { resolve, reject })
      ws.send(JSON.stringify({ id: myId, method, params }))
    })
  return { ready, send, on: (fn) => listeners.push(fn), close: () => ws.close() }
}

// Runs inside the page: strict contrast audit of every visible text node / placeholder.
const AUDIT_FN = `(() => {
  const parse = (s) => { const m = s.match(/rgba?\\(([^)]+)\\)/); if (!m) return null;
    const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }; };
  const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bgOf = (el) => { const chain = []; for (let n = el; n; n = n.parentElement) chain.push(n);
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = chain.length - 1; i >= 0; i--) { const c = parse(getComputedStyle(chain[i]).backgroundColor);
      if (c && c.a > 0) base = c.a >= 1 ? c : over(c, base); }
    return base; };
  const opacityOf = (el) => { let o = 1; for (let n = el; n; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return o; };
  const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const label = (el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '');
  const out = [];
  const seen = new Set();
  const check = (el, text, fgStr, kind) => {
    if (!visible(el)) return;
    const fg0 = parse(fgStr); if (!fg0) return;
    const o = opacityOf(el); const bg = bgOf(el);
    const fg = over({ ...fg0, a: fg0.a * o }, bg);
    const r = ratio(fg, bg);
    if (r < 4.5) { const key = label(el) + '|' + text.slice(0, 20); if (seen.has(key)) return; seen.add(key);
      out.push({ ratio: +r.toFixed(2), text: text.trim().slice(0, 48), el: label(el), kind }); }
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.nodeValue; if (!text || !text.trim()) continue;
    const el = n.parentElement; if (!el || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) continue;
    const cs = getComputedStyle(el);
    const fgStr = el instanceof SVGElement ? cs.fill : cs.color;
    check(el, text, fgStr, 'text');
  }
  document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach((el) => {
    check(el, el.getAttribute('placeholder'), getComputedStyle(el, '::placeholder').color, 'placeholder'); });
  return out;
})()`

async function main() {
  mkdirSync(OUT, { recursive: true })
  const { proc, dir, wsUrl } = await launch()
  const cdp = connect(wsUrl)
  await cdp.ready
  const { send } = cdp
  await send('Page.enable')
  await send('Runtime.enable')

  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'evaluate failed')
    return r.result.value
  }
  const goto = async (url, settle = 2800) => {
    await send('Page.navigate', { url })
    for (let i = 0; i < 40; i++) {
      if ((await evaluate('document.readyState')) === 'complete') break
      await sleep(150)
    }
    await sleep(settle)
  }
  const viewport = (width, height) =>
    send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })

  const report = { contrast: {}, checks: [] }
  let failed = false
  const check = (name, ok, detail = '') => {
    report.checks.push({ name, ok, detail })
    if (!ok) failed = true
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
  }

  await viewport(1440, 900)

  // ── Toggle / persistence / no-flash ──
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(() => { window.__themeAtFirstSet = null;
      // <html> may not exist yet at document start, so observe the document itself.
      new MutationObserver(() => { const r = document.documentElement;
        if (window.__themeAtFirstSet === null && r && r.getAttribute('data-theme'))
          window.__themeAtFirstSet = { theme: r.getAttribute('data-theme'), bodyExisted: !!document.body, readyState: document.readyState }; })
        .observe(document, { attributes: true, subtree: true, attributeFilter: ['data-theme'] }); })()`,
  })
  await goto(`${BASE}/`, 300)
  await evaluate(`localStorage.removeItem('aerogrid_theme')`)
  await goto(`${BASE}/#/`, 1500)
  const initial = await evaluate(`document.documentElement.getAttribute('data-theme')`)
  check('default theme resolves (no saved choice)', ['light', 'dark'].includes(initial), `data-theme=${initial}`)
  const flash = await evaluate('JSON.stringify(window.__themeAtFirstSet)')
  const flashObj = JSON.parse(flash || 'null')
  check(
    'data-theme set before first paint (no flash)',
    !!flashObj && flashObj.bodyExisted === false,
    flash,
  )
  await evaluate(`[...document.querySelectorAll('.stitch-theme-opt')].find(b => b.textContent.trim() === 'DARK').click()`)
  await sleep(300)
  check('clicking DARK sets data-theme="dark"', (await evaluate(`document.documentElement.dataset.theme`)) === 'dark')
  check('choice persisted in localStorage', (await evaluate(`localStorage.getItem('aerogrid_theme')`)) === 'dark')
  const bodyBgDark = await evaluate(`getComputedStyle(document.body).backgroundColor`)
  await goto(`${BASE}/#/`, 800)
  check('dark choice survives reload', (await evaluate(`document.documentElement.dataset.theme`)) === 'dark')
  await evaluate(`[...document.querySelectorAll('.stitch-theme-opt')].find(b => b.textContent.trim() === 'LIGHT').click()`)
  await sleep(300)
  const bodyBgLight = await evaluate(`getComputedStyle(document.body).backgroundColor`)
  check('clicking LIGHT restores light and repaints', (await evaluate(`document.documentElement.dataset.theme`)) === 'light' && bodyBgLight !== bodyBgDark, `${bodyBgDark} -> ${bodyBgLight}`)
  const roleLabel = await evaluate(`document.body.innerText.toLowerCase().includes('demo mode')`)
  check('role switch is labelled "Demo mode"', roleLabel)

  // ── Per page, per theme ──
  for (const theme of ['light', 'dark']) {
    await goto(`${BASE}/#/`, 500)
    await evaluate(`[...document.querySelectorAll('.stitch-theme-opt')].find(b => b.textContent.trim().toLowerCase() === '${theme}')?.click()`)
    await sleep(400)
    for (const route of ROUTES) {
      await viewport(1440, 900)
      await goto(`${BASE}/${route.hash}`, route.id.startsWith('map') || route.id === 'global-grid' ? 4200 : 2200)
      // Ensure attribute and react match intended theme
      await evaluate(`document.documentElement.setAttribute('data-theme', '${theme}')`)
      await sleep(300)
      const applied = await evaluate(`document.documentElement.dataset.theme`)
      const failures = await evaluate(AUDIT_FN)
      report.contrast[`${route.id}:${theme}`] = failures
      console.log(`${failures.length === 0 ? 'PASS' : 'FAIL'}  contrast ${route.label} [${theme}] (data-theme=${applied}) — ${failures.length} text item(s) below 4.5:1`)
      failures.slice(0, 12).forEach((f) => console.log(`        ${f.ratio}:1  ${f.kind}  ${f.el}  "${f.text}"`))
      if (failures.length) failed = true
      if (SHOTS) {
        const h = await evaluate(`Math.min(3400, Math.max(900, (document.querySelector('.stitch-main-content')?.scrollHeight ?? 840) + 64))`)
        const isMap = route.id.startsWith('map') || route.id === 'global-grid'
        await viewport(1440, isMap ? 900 : h)
        await sleep(500)
        const shot = await send('Page.captureScreenshot', { format: 'png' })
        writeFileSync(join(OUT, `${route.id}-${theme}.png`), Buffer.from(shot.data, 'base64'))
      }
    }
  }

  writeFileSync(join(OUT, 'audit-report.json'), JSON.stringify(report, null, 2))
  cdp.close()
  proc.kill()
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch {
    /* ignore */
  }
  console.log(failed ? '\nAUDIT FAILED' : '\nAUDIT PASSED')
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
