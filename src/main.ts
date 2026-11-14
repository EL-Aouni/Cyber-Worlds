import './styles/main.css'
import type * as THREE from 'three'
import { Audio } from './engine/audio'
import { I18n, resolveLocale } from './engine/i18n'
import { Input } from './engine/input'
import { GameLoop } from './engine/loop'
import { SAVE_KEY, SaveStore, type CompletedPath, type SaveData } from './engine/save'
import type { Game } from './game/game'
import { TouchControls } from './ui/touch'
import { Ui } from './ui/ui'

const AVATAR_URL = './assets/models/quaternius/Individual%20Characters__glTF__Casual_Hoodie.gltf'

let presentBootError = (error: unknown): void => {
  const root = document.getElementById('ui')
  if (!root) return
  root.replaceChildren()
  const card = document.createElement('div')
  card.className = 'fatal'
  const title = document.createElement('h1')
  title.textContent = 'Cyber Worlds could not start'
  const details = document.createElement('p')
  details.textContent = String((error as Error)?.message ?? error)
  const retry = document.createElement('button')
  retry.className = 'btn btn-primary'
  retry.textContent = 'Retry loading'
  retry.addEventListener('click', () => window.location.reload())
  card.append(title, details, retry)
  root.append(card)
}

async function boot(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#game')!
  const firstRun = safeGet(SAVE_KEY) === null
  const save = new SaveStore()
  const i18n = new I18n(resolveLocale(save.data.locale, navigator.languages))
  const input = new Input(canvas)
  const audio = new Audio()
  let game: Game | undefined
  let loop!: GameLoop
  let lockLostAt = 0

  const applySettings = (data: SaveData) => {
    input.sensitivity = data.sensitivity
    input.invertY = data.invertY
    audio.setVolumes(data.musicVolume, data.sfxVolume, data.muted)
    if (game) game.reducedMotion = data.reducedMotion
  }

  const startRun = () => {
    if (!game) return
    audio.unlock()
    audio.startMusic()
    game.start()
    ui.show('hud')
    loop.resetAccumulator()
  }
  const pause = () => {
    if (game?.mode !== 'playing') return
    game.pause()
    ui.show('pause')
    input.unlockPointer()
  }
  const resume = () => {
    if (game?.mode !== 'paused') return
    game.resume()
    ui.show('hud')
    loop.resetAccumulator()
  }

  const ui = new Ui(i18n, save, audio, input, {
    play: startRun,
    resume,
    quit: () => {
      game?.toTitle()
      ui.show('title')
      input.unlockPointer()
    },
    settings: patch => {
      const qualityChanged = patch.quality !== undefined && patch.quality !== save.data.quality
      save.update(patch)
      applySettings(save.data)
      if (patch.locale) {
        i18n.set(patch.locale)
        document.documentElement.lang = patch.locale
      }
      if (qualityChanged) game?.setQuality(save.data.quality)
    },
    pauseForPortfolio: () => {
      if (game?.mode === 'playing') game.pause()
      input.unlockPointer()
      loop.resetAccumulator()
    },
  })
  presentBootError = error => ui.showBootError(String((error as Error)?.message ?? error))
  ui.show('boot')
  applySettings(save.data)
  document.documentElement.lang = i18n.locale

  let loadedModules = 0
  const track = <T>(promise: Promise<T>): Promise<T> => promise.then(value => {
    loadedModules += 1
    ui.setBootProgress(0.1 + (loadedModules / 5) * 0.25)
    return value
  })
  ui.setBootProgress(0.08)
  const [{ Game }, { Renderer, suggestQuality }, physics, { Assets }] = await Promise.all([
    track(import('./game/game')),
    track(import('./engine/renderer')),
    track(import('./engine/physics')),
    track(import('./engine/assets')),
    track(document.fonts.ready),
  ])
  await physics.initPhysics()
  if (firstRun) {
    save.update({ quality: suggestQuality() })
    ui.refreshSettings()
  }

  const assets = new Assets()
  const stopProgress = assets.onProgress(progress => ui.setBootProgress(0.35 + progress * 0.65))
  let avatarData: { scene: THREE.Object3D; animations: readonly THREE.AnimationClip[] } | undefined
  try {
    const avatar = await assets.gltf(AVATAR_URL)
    avatarData = { scene: avatar.scene, animations: avatar.animations }
  } catch (err) {
    console.warn('Avatar model could not be loaded; using built-in procedural avatar:', err)
  }
  stopProgress()
  ui.setBootProgress(1)

  const renderer = new Renderer(canvas, save.data.quality)
  game = new Game(renderer, input, audio, {
    updateWorld: state => ui.updateWorld(state),
    completedPaths: paths => save.update({ completedPaths: [...paths] as CompletedPath[] }),
    portfolio: tab => ui.openPortfolio(tab),
  }, avatarData, save.data.completedPaths)
  game.reducedMotion = save.data.reducedMotion
  if (import.meta.env.DEV) {
    const [{ registerGameTuning }, { tuning }] = await Promise.all([
      import('../scripts/manus-tuning/adapter.js'), import('./game/tuning'),
    ])
    await registerGameTuning(tuning)
  }
  const g = game

  loop = new GameLoop({
    step: dt => {
      input.update()
      g.step(dt)
    },
    render: (alpha, frameSeconds) => {
      input.update()
      if (input.consume('pause') && performance.now() - lockLostAt > 300) {
        if (g.mode === 'playing') pause()
        else if (g.mode === 'paused' && ui.screen === 'pause') resume()
      }
      if (input.consume('portfolio') && ['playing', 'paused'].includes(g.mode)) ui.openPortfolio('profile')
      ui.frame(frameSeconds)
      loop.paused = g.mode === 'paused'
      g.render(alpha, frameSeconds)
      input.endFrame()
    },
  })
  loop.start()

  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && g.mode === 'playing' && input.method === 'keyboard') {
      lockLostAt = performance.now()
      pause()
    }
  })
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause()
  })
  window.addEventListener('game:pause', pause)
  canvas.addEventListener('click', () => {
    if (g.mode === 'playing') input.lockPointer()
  })
  new TouchControls(document.getElementById('ui')!, input, () => g.mode === 'playing')

  window.setTimeout(() => ui.show('title'), 250)
  ;(window as unknown as { __game: unknown }).__game = { game: g, ui, input, save }
}

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

boot().catch(error => {
  console.error(error)
  presentBootError(error)
})
