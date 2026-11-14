// End-to-end smoke test: run after pnpm build. It exercises the production Three.js build in Chromium.
// Registered Storage files are served from the exact local bytes referenced by assets.lock.json.
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const port = 4300 + Math.floor(Math.random() * 500)
const url = `http://127.0.0.1:${port}/`
const out = process.env.SHOTS_DIR ?? 'shots'
mkdirSync(out, { recursive: true })
const manifest = JSON.parse(readFileSync('assets.lock.json', 'utf8'))
const projectAssets = new Map(Object.entries(manifest.assets).map(([key, asset]) => [asset.path, key]))
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore', detached: false })
let browser
const guard = setTimeout(() => { console.error('smoke: FAIL — timed out'); server.kill('SIGTERM'); process.exit(1) }, 120_000)

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function cleanup() {
  clearTimeout(guard)
  try { server.kill('SIGTERM') } catch {}
}

async function waitForServer() {
  for (let i = 0; i < 80; i += 1) {
    try {
      if ((await fetch(url)).ok) return
    } catch {}
    await new Promise(r => setTimeout(r, 250))
  }
  throw new Error('production preview server did not start')
}

async function installProjectAssetRoutes(page, errors) {
  await page.route('**/manus-storage/game/sha256/**', async route => {
    const path = new URL(route.request().url()).pathname
    const local = projectAssets.get(path)
    if (!local) {
      errors.push(`unregistered Storage asset requested: ${path}`)
      return route.fulfill({ status: 404, body: 'Unregistered test asset' })
    }
    return route.fulfill({ path: resolve(local) })
  })
}

async function openGame(context, errors) {
  const page = await context.newPage()
  page.on('console', message => message.type() === 'error' && errors.push(message.text()))
  page.on('pageerror', error => errors.push(String(error)))
  page.on('response', response => response.status() >= 400 && errors.push(`HTTP ${response.status()} ${response.url()}`))
  await installProjectAssetRoutes(page, errors)
  await page.goto(url)
  await page.waitForSelector('[data-screen="title"].is-active', { timeout: 30_000 })
  await page.evaluate(async () => {
    await document.fonts.ready
    const expected = document.documentElement.lang === 'zh-CN' ? 'ManusCC0 Sans CJK SC' : 'ManusCC0'
    for (const selector of ['.logo-text', '.tagline']) {
      const family = getComputedStyle(document.querySelector(selector)).fontFamily
      if (!family.startsWith(`"${expected}"`) && !family.startsWith(expected + ',')) throw new Error(`Unexpected game font: ${family}`)
    }
    if (![...document.fonts].some(face => face.family.replaceAll('"', '').replaceAll("'", '') === expected && face.status === 'loaded')) {
      throw new Error(`Bundled font did not load: ${expected}`)
    }
    const icon = document.querySelector('[data-screen="boot"] .boot-favicon')
    if (!icon || !icon.complete || icon.naturalWidth < 1) throw new Error('Game-specific loader icon did not load')
    if (!document.querySelector('meta[property="og:image"]')?.content.includes('/share/')) throw new Error('Game-specific Open Graph artwork is missing')
    if (!document.querySelector('meta[property="og:title"]')?.content.includes('Cyber Worlds')) throw new Error('Game-specific sharing title is stale')
  })
  return page
}

const state = page => page.evaluate(() => {
  const { game, ui } = window.__game
  const p = game.player.position
  const modelMeshes = []
  game.player.root.traverse(node => { if (node.isMesh) modelMeshes.push(node) })
  return {
    mode: game.mode,
    world: game.currentWorld,
    cameraYaw: game.cam.yaw,
    pos: { x: p.x, y: p.y, z: p.z },
    interactable: ui.worldState.interactable,
    progress: ui.worldState.progress,
    total: ui.worldState.total,
    powerActive: ui.worldState.powerActive,
    modelMeshes: modelMeshes.length,
    targets: game.worlds.getSegment(game.currentWorld).targets.map(target => ({ id: target.id, completed: target.completed })),
  }
})

async function walkToward(page, destination, limit = 35) {
  for (let step = 0; step < limit; step += 1) {
    const current = await state(page)
    if (Math.hypot(current.pos.x - destination.x, current.pos.z - destination.z) <= 2.35) return
    const dx = destination.x - current.pos.x
    const dz = destination.z - current.pos.z
    const moveX = dx * Math.cos(current.cameraYaw) - dz * Math.sin(current.cameraYaw)
    const moveY = -dx * Math.sin(current.cameraYaw) - dz * Math.cos(current.cameraYaw)
    const keys = []
    if (Math.abs(moveX) > 0.12) keys.push(moveX > 0 ? 'd' : 'a')
    if (Math.abs(moveY) > 0.12) keys.push(moveY > 0 ? 'w' : 's')
    for (const key of keys) await page.keyboard.down(key)
    await page.waitForTimeout(220)
    for (const key of keys) await page.keyboard.up(key)
    await page.waitForTimeout(30)
  }
  const current = await state(page)
  throw new Error(`character did not reach interaction radius: position=${JSON.stringify(current.pos)}, destination=${JSON.stringify(destination)}`)
}

async function worldPoint(page, worldId, collection, property, value) {
  return page.evaluate(({ worldId, collection, property, value }) => {
    const items = window.__game.game.worlds.getSegment(worldId)[collection]
    const item = items.find(candidate => candidate[property] === value)
    if (!item) throw new Error(`Missing ${collection} entry ${property}=${value} in ${worldId}`)
    return { x: item.position.x, z: item.position.z }
  }, { worldId, collection, property, value })
}

async function nearestChallengePoint(page, worldId) {
  return page.evaluate(worldId => {
    const game = window.__game.game
    const position = game.player.position
    const target = game.worlds.getSegment(worldId).targets
      .filter(candidate => !candidate.completed)
      .sort((a, b) => a.position.distanceToSquared(position) - b.position.distanceToSquared(position))[0]
    if (!target) throw new Error(`No incomplete challenge target in ${worldId}`)
    return { x: target.position.x, z: target.position.z }
  }, worldId)
}

try {
  await waitForServer()
  const args = ['--ignore-gpu-blocklist', '--no-sandbox']
  browser = await chromium.launch({ args }).catch(() => chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args }))
  const errors = []
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'en-US' })
  const page = await openGame(desktop, errors)
  assert((await page.title()).toLowerCase().includes('cyber worlds'), 'browser title does not match Cyber Worlds')
  await page.screenshot({ path: `${out}/01-title-en.png` })

  // The portfolio remains accessible before play and all claims/links are source-grounded.
  await page.click('[data-screen="title"] [data-action="portfolio"]')
  await page.waitForSelector('[data-screen="portfolio"].is-active')
  let dossier = await page.locator('[data-screen="portfolio"] .portfolio-card').innerText()
  assert(dossier.includes('Mohammed El-Aouni') && dossier.includes('ENSA Oujda'), 'operator/profile facts missing')
  await page.click('[data-portfolio-tab="soc"]')
  dossier = await page.locator('[data-screen="portfolio"] .portfolio-copy').innerText()
  assert(dossier.includes('Wazuh') && dossier.includes('Splunk') && dossier.includes('TheHive'), 'SOC/SIEM evidence missing')
  await page.click('[data-portfolio-tab="redteam"]')
  dossier = await page.locator('[data-screen="portfolio"] .portfolio-copy').innerText()
  assert(dossier.includes('Nmap') && dossier.includes('Subfinder'), 'red-team lab summary missing')
  await page.click('[data-portfolio-tab="research"]')
  dossier = await page.locator('[data-screen="portfolio"] .portfolio-copy').innerText()
  assert(dossier.includes('Group Policy') && dossier.includes('LAPS'), 'research summary missing')
  await page.click('[data-portfolio-tab="contact"]')
  dossier = await page.locator('[data-screen="portfolio"] .portfolio-copy').innerText()
  assert(dossier.includes('PFE') && dossier.includes('current availability'), 'source-accurate PFE wording missing')
  const hrefs = await page.locator('[data-screen="portfolio"] .portfolio-links a').evaluateAll(links => links.map(a => a.href))
  assert(hrefs.includes('https://github.com/EL-Aouni/Cyber-ops-portfolio'), 'original portfolio source link missing')
  assert(hrefs.includes('https://www.linkedin.com/in/mohammed-el-aouni/'), 'LinkedIn profile link missing')
  await page.screenshot({ path: `${out}/02-portfolio.png` })
  await page.click('[data-action="portfolio-close"]')
  await page.waitForSelector('[data-screen="title"].is-active')

  // Start the human explorer; verify the normal avatar is actually rendered and the hub is the present world.
  await page.click('[data-screen="title"] [data-action="play"]')
  await page.waitForSelector('[data-screen="hud"].is-active')
  await page.waitForFunction(() => window.__game.game.mode === 'playing')
  let current = await state(page)
  assert(current.world === 'hub' && current.total === 4 && current.progress === 0, 'game did not start in the present-day hub with four future paths')
  assert(current.modelMeshes > 0, 'CC0 human explorer avatar did not load into the 3D scene')
  assert((await page.locator('.world-tag').innerText()).includes('PRESENT'), 'hub does not distinguish present-day status')
  await page.screenshot({ path: `${out}/03-hub-start.png` })

  // Walk into the Red Team port and enter its independent future-career scene.
  await walkToward(page, await worldPoint(page, 'hub', 'portals', 'destination', 'redteam'))
  current = await state(page)
  assert(current.interactable?.kind === 'portal' && current.interactable.destination === 'redteam', 'Red Team port prompt did not appear')
  await page.keyboard.press('e')
  await page.waitForFunction(() => window.__game.game.currentWorld === 'redteam')
  current = await state(page)
  assert(current.total === 3 && current.targets.length === 3, 'Red Team career world did not expose three local challenges')
  assert((await page.locator('.world-tag').innerText()).includes('FUTURE'), 'future career world is not identified as simulated potential')
  assert(!(await page.locator('[data-screen="hud"]').innerText()).includes('worlds.redteam.summary'), 'Red Team summary key was not translated')

  // Use the Red Team power and complete a nearby local fictional step.
  await walkToward(page, await nearestChallengePoint(page, 'redteam'))
  await page.waitForFunction(() => window.__game.ui.worldState.interactable?.kind === 'target')
  await page.keyboard.press('q')
  await page.waitForFunction(() => window.__game.ui.worldState.powerActive === true)
  await page.keyboard.press('e')
  await page.waitForFunction(() => window.__game.ui.worldState.progress === 1)
  current = await state(page)
  assert(current.progress === 1 && current.targets.filter(target => target.completed).length === 1, 'fictional challenge did not complete locally')
  assert((await page.locator('.safety-note').innerText()).includes('Fictional local practice only'), 'fictional local-practice safety disclosure missing')
  await page.screenshot({ path: `${out}/04-redteam-challenge.png` })

  // Return to the hub and use a physical portfolio kiosk to open the matching dossier tab.
  await walkToward(page, await worldPoint(page, 'redteam', 'portals', 'destination', 'hub'))
  current = await state(page)
  assert(current.interactable?.kind === 'portal' && current.interactable.destination === 'hub', 'Red Team return port did not appear')
  await page.keyboard.press('e')
  await page.waitForFunction(() => window.__game.game.currentWorld === 'hub')
  await walkToward(page, await worldPoint(page, 'hub', 'stations', 'id', 'redteam'))
  current = await state(page)
  assert(current.interactable?.kind === 'profile', 'hub portfolio kiosk did not produce an interaction prompt')
  await page.keyboard.press('e')
  await page.waitForSelector('[data-screen="portfolio"].is-active')
  assert((await state(page)).mode === 'paused', 'opening a physical kiosk did not pause exploration safely')
  assert(await page.locator('[data-portfolio-tab="redteam"]').getAttribute('aria-pressed') === 'true', 'hub kiosk opened the wrong portfolio dossier section')
  await page.screenshot({ path: `${out}/05-hub-kiosk.png` })
  await page.click('[data-action="portfolio-close"]')
  await page.waitForFunction(() => window.__game.game.mode === 'playing')

  // Check the four doors, target catalogs and unique offline future paths directly in the live world model.
  const worldSummary = await page.evaluate(() => {
    const { game } = window.__game
    return ['redteam', 'blueteam', 'grc', 'research'].map(id => {
      const segment = game.worlds.getSegment(id)
      return { id, targets: segment.targets.length, entryDoors: game.worlds.getSegment('hub').portals.filter(portal => portal.destination === id).length,
        returnDoors: segment.portals.filter(portal => portal.destination === 'hub').length }
    })
  })
  assert(worldSummary.every(world => world.targets === 3 && world.entryDoors === 1 && world.returnDoors === 1), 'one or more career ports/worlds are incomplete')

  // Traverse every remaining port and complete one fictional, local practice step in each world.
  for (const id of ['blueteam', 'grc', 'research']) {
    await walkToward(page, await worldPoint(page, 'hub', 'portals', 'destination', id))
    current = await state(page)
    assert(current.interactable?.kind === 'portal' && current.interactable.destination === id, `${id} port prompt did not appear`)
    await page.keyboard.press('e')
    await page.waitForFunction(worldId => window.__game.game.currentWorld === worldId, id)
    current = await state(page)
    assert(current.total === 3 && current.targets.length === 3, `${id} world does not expose three local practice targets`)
    await walkToward(page, await nearestChallengePoint(page, id))
    await page.waitForFunction(() => window.__game.ui.worldState.interactable?.kind === 'target')
    await page.keyboard.press('q')
    await page.waitForFunction(() => window.__game.ui.worldState.powerActive === true)
    await page.keyboard.press('e')
    await page.waitForFunction(() => window.__game.ui.worldState.progress === 1)
    await page.screenshot({ path: `${out}/08-${id}.png` })
    await walkToward(page, await worldPoint(page, id, 'portals', 'destination', 'hub'))
    await page.keyboard.press('e')
    await page.waitForFunction(() => window.__game.game.currentWorld === 'hub')
  }

  // A second locale verifies the complete Simplified Chinese title and dossier rendering.
  const zh = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'zh-CN' })
  const zhPage = await openGame(zh, errors)
  assert(await zhPage.evaluate(() => document.documentElement.lang === 'zh-CN'), 'Simplified Chinese locale was not selected')
  assert((await zhPage.locator('.logo-text').innerText()).includes('网络安全'), 'Simplified Chinese title is missing')
  await zhPage.click('[data-screen="title"] [data-action="portfolio"]')
  await zhPage.waitForSelector('[data-screen="portfolio"].is-active')
  assert((await zhPage.locator('[data-screen="portfolio"] .portfolio-card').innerText()).includes('Mohammed El-Aouni'), 'Simplified Chinese dossier did not retain profile identity')
  await zhPage.screenshot({ path: `${out}/06-title-zh.png` })
  await zh.close()

  // Check that mobile visitors have a usable joystick and all four game actions without horizontal overflow.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'en-US' })
  const phonePage = await openGame(phone, errors)
  const viewport = await phonePage.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
  assert(viewport.scroll <= viewport.width + 1, 'mobile title layout has horizontal overflow')
  await phonePage.tap('[data-screen="title"] [data-action="play"]')
  await phonePage.waitForSelector('[data-screen="hud"].is-active')
  const touchControls = await phonePage.evaluate(() => ['.touch-stick', '[data-touch="jump"]', '[data-touch="dash"]', '[data-touch="power"]', '[data-touch="interact"]'].map(selector => {
    const element = document.querySelector(selector)
    const rect = element.getBoundingClientRect()
    return { selector, visible: getComputedStyle(element).display !== 'none' && rect.width > 44 && rect.height > 44 }
  }))
  assert(touchControls.every(control => control.visible), 'one or more mobile movement/power/action controls are missing or too small')
  await phonePage.screenshot({ path: `${out}/07-phone-hub.png` })
  await phonePage.tap('[data-screen="hud"] [data-action="portfolio"]')
  await phonePage.waitForSelector('[data-screen="portfolio"].is-active')
  assert((await phonePage.locator('[data-screen="portfolio"] .portfolio-card').innerText()).includes('Mohammed El-Aouni'), 'mobile dossier did not open')
  await phonePage.close()

  if (errors.length) throw new Error(`browser errors:\n  ${errors.join('\n  ')}`)
  await browser.close()
  cleanup()
  console.log(`smoke: OK — present hub, CC0 character, Red Team port/power/challenge/return, dossier kiosk, EN/zh-CN, touch HUD; screenshots in ${out}/`)
} catch (error) {
  console.error(`smoke: FAIL — ${error?.stack ?? String(error)}`)
  await browser?.close().catch(() => {})
  cleanup()
  process.exitCode = 1
}
