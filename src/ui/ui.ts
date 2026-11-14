import type { Audio } from '../engine/audio'
import type { I18n } from '../engine/i18n'
import type { Input } from '../engine/input'
import { type Locale, type Quality, type SaveData, type SaveStore } from '../engine/save'
import type { CareerWorldId, WorldId } from '../game/worlds'

export type Screen = 'boot' | 'title' | 'hud' | 'pause' | 'settings' | 'portfolio'
export type PortfolioTab = 'profile' | 'soc' | 'redteam' | 'research' | 'contact'
export type WorldUiState = {
  worldId: WorldId
  interactable: null
    | { kind: 'portal'; destination: WorldId }
    | { kind: 'profile'; tab: PortfolioTab }
    | { kind: 'target'; titleKey: string; descriptionKey: string }
  progress: number
  total: number
  completedPaths: readonly string[]
  powerAvailable: boolean
  powerActive: boolean
}

export type UiActions = {
  play(): void
  resume(): void
  quit(): void
  settings(patch: Partial<SaveData>): void
  pauseForPortfolio(): void
}

const CAREER_IDS: readonly CareerWorldId[] = ['redteam', 'blueteam', 'grc', 'research']
const TABS: readonly PortfolioTab[] = ['profile', 'soc', 'redteam', 'research', 'contact']
const LOADING_ICON_URL = './assets/share/cyberworlds-favicon.png'

/** DOM overlays for the explorable present-day hub and four fictional future-career simulations. */
export class Ui {
  screen: Screen = 'boot'
  private readonly root: HTMLElement
  private readonly stack: Screen[] = []
  private readonly cache = new Map<string, string>()
  private portfolioTab: PortfolioTab = 'profile'
  private portfolioFromGame = false
  private navRepeat = 0
  private lastMethod = ''
  private worldState: WorldUiState = {
    worldId: 'hub', interactable: null, progress: 0, total: 0,
    completedPaths: [], powerAvailable: false, powerActive: false,
  }

  constructor(
    private readonly i18n: I18n,
    private readonly save: SaveStore,
    private readonly audio: Audio,
    private readonly input: Input,
    private readonly actions: UiActions,
  ) {
    this.root = document.getElementById('ui')!
    this.root.innerHTML = this.template()
    this.root.addEventListener('click', event => this.onClick(event))
    this.root.addEventListener('input', event => this.onInput(event))
    this.root.addEventListener('focusin', event => {
      if ((event.target as HTMLElement).matches('.btn, .seg button, .toggle, [data-portfolio-tab]')) this.audio.play('ui')
    })
    window.addEventListener('keydown', event => this.onKey(event))
    i18n.onChange(() => this.translate())
    this.translate()
    this.refreshSettings()
    this.updateWorld(this.worldState)
  }

  show(screen: Screen): void {
    this.stack.length = 0
    this.setScreen(screen)
  }

  push(screen: Screen): void {
    this.stack.push(this.screen)
    this.setScreen(screen)
  }

  back(): void {
    const previous = this.stack.pop()
    if (previous) this.setScreen(previous)
    else if (this.screen === 'pause') this.actions.resume()
  }

  openPortfolio(tab: PortfolioTab = 'profile'): void {
    if (!TABS.includes(tab)) tab = 'profile'
    if (this.screen === 'portfolio') {
      this.selectPortfolioTab(tab)
      return
    }
    this.portfolioFromGame = this.screen === 'hud'
    if (this.portfolioFromGame) this.actions.pauseForPortfolio()
    this.portfolioTab = tab
    this.push('portfolio')
  }

  private closePortfolio(): void {
    const shouldResume = this.portfolioFromGame
    this.portfolioFromGame = false
    this.back()
    if (shouldResume) this.actions.resume()
  }

  private setScreen(screen: Screen): void {
    this.screen = screen
    for (const element of this.root.querySelectorAll<HTMLElement>('[data-screen]')) {
      const id = element.dataset.screen
      const active = id === screen || (id === 'hud' && ['pause', 'settings', 'portfolio'].includes(screen) && this.stack.includes('hud'))
      element.classList.toggle('is-active', active)
      element.setAttribute('aria-hidden', String(!active))
    }
    this.root.dataset.activeScreen = screen
    if (screen === 'portfolio') this.renderPortfolio()
    requestAnimationFrame(() => {
      const first = this.navItems()[0]
      if (first && this.input.method !== 'touch') first.focus({ preventScroll: true })
      else (document.activeElement as HTMLElement | null)?.blur?.()
    })
  }

  setBootProgress(progress: number): void {
    const bar = this.q<HTMLElement>('.boot-bar i')
    bar.style.transform = `scaleX(${Math.max(0.04, Math.min(1, progress))})`
  }

  showBootError(details: string): void {
    this.show('boot')
    const screen = this.q('[data-screen="boot"]')
    screen.classList.add('has-error')
    this.q('.boot-label').textContent = this.i18n.t('boot.error')
    this.q('.boot-bar').classList.add('is-hidden')
    this.qa('.boot-error-details, .boot-retry').forEach(node => node.remove())
    const message = document.createElement('p')
    message.className = 'boot-error-details'
    message.setAttribute('role', 'status')
    message.textContent = details.slice(0, 280)
    const retry = document.createElement('button')
    retry.className = 'btn btn-primary boot-retry'
    retry.dataset.nav = ''
    retry.textContent = this.i18n.t('boot.retry')
    retry.addEventListener('click', () => window.location.reload(), { once: true })
    screen.append(message, retry)
  }

  refreshSettings(): void {
    const data = this.save.data
    this.q<HTMLInputElement>('[name="musicVolume"]').value = String(data.musicVolume)
    this.q<HTMLInputElement>('[name="sfxVolume"]').value = String(data.sfxVolume)
    this.q<HTMLInputElement>('[name="sensitivity"]').value = String(data.sensitivity)
    for (const toggle of this.qa<HTMLButtonElement>('.toggle')) {
      const enabled = data[toggle.dataset.setting as 'muted' | 'invertY' | 'reducedMotion'] === true
      toggle.setAttribute('aria-pressed', String(enabled))
      toggle.querySelector('span')!.dataset.i18n = enabled ? 'settings.on' : 'settings.off'
    }
    for (const button of this.qa<HTMLButtonElement>('.seg button')) {
      const setting = button.parentElement!.dataset.setting as 'quality' | 'locale'
      const current = setting === 'locale' ? this.i18n.locale : data.quality
      button.setAttribute('aria-pressed', String(button.dataset.value === current))
    }
    for (const range of this.qa<HTMLInputElement>('input[type="range"]')) this.updateRange(range)
    this.translate()
  }

  updateWorld(state: WorldUiState): void {
    this.worldState = state
    const name = this.i18n.t(`worlds.${state.worldId}.name`)
    this.q('.world-name').textContent = name
    this.q('.world-tag').textContent = this.i18n.t(state.worldId === 'hub' ? 'worlds.status.present' : 'worlds.status.future')
    this.q('.world-summary').textContent = this.i18n.t(`worlds.${state.worldId}.summary`)
    this.q('.world-progress').textContent = `${Math.max(0, state.progress)} / ${Math.max(0, state.total)}`
    const isCareer = state.worldId !== 'hub'
    const powerName = this.q('.power-name')
    const powerDescription = this.q('.power-description')
    const powerPanel = this.q('.power-panel')
    powerPanel.classList.toggle('is-hidden', !isCareer)
    powerName.textContent = isCareer ? this.i18n.t(`worlds.${state.worldId}.power.name`) : this.i18n.t('worlds.hub.power.name')
    powerDescription.textContent = isCareer ? this.i18n.t(`worlds.${state.worldId}.power.description`) : this.i18n.t('worlds.hub.power.description')
    this.q('.power-state').textContent = state.powerActive ? this.i18n.t('worlds.power.active') : this.i18n.t('worlds.power.ready')
    this.q('.power-panel').classList.toggle('is-active', state.powerActive)

    const prompt = this.q<HTMLElement>('.interaction-prompt')
    const promptTitle = this.q('.interaction-title')
    const promptBody = this.q('.interaction-body')
    const interaction = state.interactable
    prompt.classList.toggle('is-hidden', !interaction)
    if (interaction?.kind === 'portal') {
      promptTitle.textContent = this.i18n.t('worlds.prompt.portal.title', { world: this.i18n.t(`worlds.${interaction.destination}.name`) })
      promptBody.textContent = this.i18n.t('worlds.prompt.portal.body')
    } else if (interaction?.kind === 'profile') {
      promptTitle.textContent = this.i18n.t('worlds.prompt.profile.title', { tab: this.i18n.t(`portfolio.tab.${interaction.tab}`) })
      promptBody.textContent = this.i18n.t('worlds.prompt.profile.body')
    } else if (interaction?.kind === 'target') {
      promptTitle.textContent = this.i18n.t(interaction.titleKey)
      promptBody.textContent = this.i18n.t(interaction.descriptionKey)
    }
    const interactionHint = this.q('.interaction-hint')
    interactionHint.textContent = interaction?.kind === 'target'
      ? this.i18n.t(state.powerActive ? 'worlds.hud.target.complete' : 'worlds.hud.target.power')
      : this.i18n.t('worlds.hud.interact')

    const completion = this.q('.career-completions')
    completion.replaceChildren(...CAREER_IDS.map(id => {
      const item = document.createElement('span')
      item.className = `career-chip${state.completedPaths.includes(id) ? ' is-complete' : ''}`
      item.textContent = this.i18n.t(`worlds.${id}.short`)
      item.title = this.i18n.t(state.completedPaths.includes(id) ? 'worlds.path.complete' : 'worlds.path.future')
      return item
    }))
    this.root.dataset.world = state.worldId
  }

  /** Per-frame menu focus and locale-sensitive control prompts. */
  frame(frameSeconds: number): void {
    if (this.input.method !== this.lastMethod) {
      this.lastMethod = this.input.method
      this.renderPrompts()
    }
    if (this.screen === 'hud' || this.screen === 'boot') {
      this.input.consume('confirm')
      this.input.consume('back')
      return
    }
    if (this.input.method !== 'gamepad') {
      this.input.consume('confirm')
      this.input.consume('back')
      return
    }
    this.navRepeat = Math.max(0, this.navRepeat - frameSeconds)
    const active = document.activeElement as HTMLElement | null
    const x = this.input.move.x, y = this.input.move.y
    if (Math.abs(y) > 0.6 && this.navRepeat <= 0) {
      this.moveFocus(y < 0 ? 1 : -1)
      this.navRepeat = 0.22
    } else if (Math.abs(x) > 0.6 && this.navRepeat <= 0 && active?.matches('input[type="range"]')) {
      const range = active as HTMLInputElement
      range.value = String(Number(range.value) + Math.sign(x) * Number(range.step || 0.1))
      range.dispatchEvent(new Event('input', { bubbles: true }))
      this.navRepeat = 0.12
    } else if (Math.abs(x) > 0.6 && this.navRepeat <= 0 && active?.parentElement?.matches('.seg')) {
      const sibling = (Math.sign(x) > 0 ? active.nextElementSibling : active.previousElementSibling) as HTMLElement | null
      sibling?.focus()
      this.navRepeat = 0.22
    } else if (Math.abs(y) < 0.3 && Math.abs(x) < 0.3) this.navRepeat = 0
    if (this.input.consume('confirm')) active?.click()
    if (this.input.consume('back') && this.screen !== 'title') {
      if (this.screen === 'portfolio') this.closePortfolio()
      else this.back()
    }
  }

  private onClick(event: MouseEvent): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action], [data-portfolio-tab], .toggle, .seg button')
    if (!target) return
    this.audio.unlock()
    if (target.matches('[data-portfolio-tab]')) {
      this.selectPortfolioTab(target.dataset.portfolioTab as PortfolioTab)
      this.audio.play('ui')
      return
    }
    if (target.matches('.toggle')) {
      const key = target.dataset.setting as 'muted' | 'invertY' | 'reducedMotion'
      this.actions.settings({ [key]: !this.save.data[key] })
      this.refreshSettings()
      this.audio.play('ui')
      return
    }
    if (target.matches('.seg button')) {
      const key = target.parentElement!.dataset.setting
      if (key === 'quality') this.actions.settings({ quality: target.dataset.value as Quality })
      if (key === 'locale') this.actions.settings({ locale: target.dataset.value as Locale })
      this.refreshSettings()
      this.audio.play('ui')
      return
    }
    switch (target.dataset.action) {
      case 'play': this.actions.play(); break
      case 'resume': this.actions.resume(); break
      case 'quit': this.actions.quit(); break
      case 'settings': this.push('settings'); break
      case 'portfolio': this.openPortfolio(); break
      case 'portfolio-profile': this.openPortfolio('profile'); break
      case 'portfolio-close': this.closePortfolio(); break
      case 'back': this.back(); break
      case 'pause': window.dispatchEvent(new CustomEvent('game:pause')); break
    }
  }

  private onInput(event: Event): void {
    const element = event.target as HTMLInputElement
    if (element.type !== 'range') return
    this.updateRange(element)
    this.actions.settings({ [element.name]: Number(element.value) } as Partial<SaveData>)
  }

  private updateRange(element: HTMLInputElement): void {
    const percent = (Number(element.value) - Number(element.min)) / (Number(element.max) - Number(element.min)) * 100
    element.style.setProperty('--fill', `${percent}%`)
  }

  private onKey(event: KeyboardEvent): void {
    if (this.screen === 'hud' || this.screen === 'boot') return
    const typing = (event.target as HTMLElement).matches?.('input, textarea')
    if ((event.code === 'Escape' || (event.code === 'Backspace' && !typing)) && this.screen !== 'title') {
      if (this.screen !== 'pause') {
        event.preventDefault()
        this.input.consume('pause')
        if (this.screen === 'portfolio') this.closePortfolio()
        else this.back()
      }
      return
    }
    if (event.code === 'ArrowDown' || event.code === 'ArrowUp') {
      event.preventDefault()
      this.moveFocus(event.code === 'ArrowDown' ? 1 : -1)
    }
  }

  private navItems(): HTMLElement[] {
    const screen = this.q(`[data-screen="${this.screen}"]`)
    return [...screen.querySelectorAll<HTMLElement>('[data-nav]')].filter(element => element.offsetParent !== null && !element.closest('.is-hidden'))
  }

  private moveFocus(direction: 1 | -1): void {
    const items = this.navItems()
    if (!items.length) return
    const rows: HTMLElement[][] = []
    for (const item of items) {
      const segment = item.parentElement?.matches('.seg, .portfolio-tabs') ? item.parentElement : null
      const last = rows.at(-1)
      if (segment && last && last[0].parentElement === segment) last.push(item)
      else rows.push([item])
    }
    const current = rows.findIndex(row => row.includes(document.activeElement as HTMLElement))
    const next = rows[(current + direction + rows.length) % rows.length]
    ;(next.find(item => item.getAttribute('aria-pressed') === 'true') ?? next[0]).focus()
  }

  private translate(): void {
    for (const element of this.root.querySelectorAll<HTMLElement>('[data-i18n]')) element.textContent = this.i18n.t(element.dataset.i18n!)
    for (const element of this.root.querySelectorAll<HTMLElement>('[data-i18n-label]')) element.setAttribute('aria-label', this.i18n.t(element.dataset.i18nLabel!))
    for (const element of this.root.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]')) element.placeholder = this.i18n.t(element.dataset.i18nPlaceholder!)
    this.renderPortfolio()
    this.updateWorld(this.worldState)
    this.cache.clear()
    document.title = this.i18n.t('game.title')
  }

  private renderPrompts(): void {
    for (const prompts of this.root.querySelectorAll<HTMLElement>('.prompts')) {
      prompts.textContent = this.input.method === 'touch' ? '' : this.i18n.t('prompt.menu')
    }
  }

  private selectPortfolioTab(tab: PortfolioTab): void {
    if (!TABS.includes(tab)) return
    this.portfolioTab = tab
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-portfolio-tab]')) {
      const selected = button.dataset.portfolioTab === tab
      button.setAttribute('aria-pressed', String(selected))
      button.classList.toggle('is-selected', selected)
    }
    this.q('.portfolio-card-title').textContent = this.i18n.t(`portfolio.${tab}.title`)
    this.q('.portfolio-card-body').textContent = this.i18n.t(`portfolio.${tab}.body`)
    this.q('.portfolio-card-detail').textContent = this.i18n.t(`portfolio.${tab}.detail`)
  }

  private renderPortfolio(): void {
    this.selectPortfolioTab(this.portfolioTab)
  }

  private q<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector)
    if (!element) throw new Error(`Missing UI element: ${selector}`)
    return element
  }

  private qa<T extends HTMLElement = HTMLElement>(selector: string): T[] {
    return [...this.root.querySelectorAll<T>(selector)]
  }

  private template(): string {
    const range = (name: string, label: string, min: number, max: number, step: number) =>
      `<label class="row"><span data-i18n="${label}"></span><input data-nav type="range" name="${name}" min="${min}" max="${max}" step="${step}"></label>`
    const toggle = (setting: string, label: string) =>
      `<div class="row"><span data-i18n="${label}"></span><button data-nav class="toggle" data-setting="${setting}" aria-pressed="false"><i></i><span></span></button></div>`
    return /* html */ `
<section class="screen screen-boot is-active" data-screen="boot">
  <img class="boot-favicon" src="${LOADING_ICON_URL}" alt="" aria-hidden="true">
  <div class="boot-logo" data-i18n="game.title"></div>
  <div class="boot-bar"><i></i></div><div class="boot-label" data-i18n="boot.loading"></div>
</section>
<section class="screen screen-title" data-screen="title">
  <div class="title-vignette"></div><div class="title-block">
    <div class="logo"><span class="logo-gem" aria-hidden="true">◇</span><h1 class="logo-text" data-i18n="game.title"></h1></div>
    <p class="tagline" data-i18n="game.tagline"></p>
    <p class="title-subline" data-i18n="game.identity"></p>
    <p class="controls-guide" data-i18n="controls.guide"></p>
    <p class="controls-gamepad" data-i18n="controls.gamepad"></p>
    <p class="controls-touch" data-i18n="controls.touch"></p>
    <nav class="menu"><button data-nav class="btn btn-primary" data-action="play"><span data-i18n="menu.play"></span></button>
      <button data-nav class="btn" data-action="portfolio"><span data-i18n="menu.portfolio"></span></button>
      <button data-nav class="btn" data-action="settings"><span data-i18n="menu.settings"></span></button></nav>
  </div><footer class="bottom-bar"><div class="prompts"></div><small data-i18n="credits.fonts"></small></footer>
</section>
<section class="screen screen-hud" data-screen="hud">
  <div class="hud-top-left world-card" aria-live="polite"><span class="world-tag"></span><h2 class="world-name"></h2><p class="world-summary"></p>
    <div class="world-progress-row"><span data-i18n="worlds.hud.progress"></span><b class="world-progress">0 / 0</b></div>
    <div class="career-completions" aria-label="Career path progress"></div>
  </div>
  <div class="hud-top-right"><button class="hud-portfolio" data-action="portfolio" data-i18n="menu.dossier"></button>
    <button class="hud-pause" data-action="pause" data-i18n-label="touch.pause" aria-label="Pause">Ⅱ</button></div>
  <div class="power-panel"><span class="power-eyebrow" data-i18n="worlds.hud.power"></span><b class="power-name"></b><span class="power-state"></span><p class="power-description"></p></div>
  <div class="interaction-prompt is-hidden" role="status" aria-live="polite"><b class="interaction-title"></b><span class="interaction-body"></span><small class="interaction-hint"></small></div>
  <p class="safety-note" data-i18n="worlds.safeScene.disclosure"></p>
  <div class="touch" aria-label="Touch movement and game controls">
    <div class="touch-stick" aria-label="Move"><i></i></div>
    <div class="touch-actions">
      <button class="touch-btn touch-dash" data-touch="dash"><span data-i18n="touch.dash"></span></button>
      <button class="touch-btn touch-power" data-touch="power"><span data-i18n="touch.power"></span></button>
      <button class="touch-btn touch-interact" data-touch="interact"><span data-i18n="touch.interact"></span></button>
      <button class="touch-btn touch-jump" data-touch="jump"><span data-i18n="touch.jump"></span></button>
    </div>
  </div>
</section>
<section class="screen screen-portfolio" data-screen="portfolio" aria-label="Operator portfolio">
  <div class="portfolio-scrim"></div><div class="modal modal-wide portfolio-card">
    <header class="portfolio-header"><div><span class="portfolio-eyebrow" data-i18n="portfolio.eyebrow"></span><h2 class="modal-title" data-i18n="portfolio.heading"></h2></div>
      <button data-nav class="portfolio-close" data-action="portfolio-close" data-i18n-label="portfolio.close" aria-label="Close">×</button></header>
    <nav class="portfolio-tabs" aria-label="Portfolio sections">
      <button data-nav data-portfolio-tab="profile" aria-pressed="false" data-i18n="portfolio.tab.profile"></button>
      <button data-nav data-portfolio-tab="soc" aria-pressed="false" data-i18n="portfolio.tab.soc"></button>
      <button data-nav data-portfolio-tab="redteam" aria-pressed="false" data-i18n="portfolio.tab.redteam"></button>
      <button data-nav data-portfolio-tab="research" aria-pressed="false" data-i18n="portfolio.tab.research"></button>
      <button data-nav data-portfolio-tab="contact" aria-pressed="false" data-i18n="portfolio.tab.contact"></button>
    </nav>
    <article class="portfolio-copy"><h3 class="portfolio-card-title"></h3><p class="portfolio-card-body"></p><p class="portfolio-card-detail"></p></article>
    <nav class="portfolio-links" aria-label="Profile links"><a href="https://github.com/EL-Aouni/Cyber-ops-portfolio" target="_blank" rel="noopener noreferrer" data-i18n="portfolio.link.repo"></a>
      <a href="https://github.com/Spinoza-ao" target="_blank" rel="noopener noreferrer" data-i18n="portfolio.link.github"></a>
      <a href="https://www.linkedin.com/in/mohammed-el-aouni/" target="_blank" rel="noopener noreferrer" data-i18n="portfolio.link.linkedin"></a></nav>
    <footer class="portfolio-footer"><span data-i18n="portfolio.footer"></span><button data-nav class="btn btn-small" data-action="portfolio-close"><span data-i18n="menu.back"></span></button></footer>
  </div>
</section>
<section class="screen screen-pause screen-modal" data-screen="pause"><div class="modal"><h2 class="modal-title" data-i18n="pause.title"></h2>
  <nav class="menu"><button data-nav class="btn btn-primary" data-action="resume"><span data-i18n="menu.continue"></span></button>
  <button data-nav class="btn" data-action="portfolio-profile"><span data-i18n="menu.portfolio"></span></button>
  <button data-nav class="btn" data-action="settings"><span data-i18n="menu.settings"></span></button>
  <button data-nav class="btn" data-action="quit"><span data-i18n="menu.quit"></span></button></nav></div><footer class="bottom-bar"><div class="prompts"></div></footer></section>
<section class="screen screen-settings screen-modal" data-screen="settings"><div class="modal modal-wide"><h2 class="modal-title" data-i18n="settings.title"></h2>
  <div class="settings-grid"><fieldset><legend data-i18n="settings.audio"></legend>${range('musicVolume', 'settings.music', 0, 1, 0.05)}${range('sfxVolume', 'settings.sfx', 0, 1, 0.05)}${toggle('muted', 'settings.mute')}</fieldset>
  <fieldset><legend data-i18n="settings.controls"></legend>${range('sensitivity', 'settings.sensitivity', 0.2, 3, 0.1)}${toggle('invertY', 'settings.invertY')}</fieldset>
  <fieldset><legend data-i18n="settings.display"></legend><div class="row"><span data-i18n="settings.quality"></span><div class="seg" data-setting="quality">
    <button data-nav data-value="low" data-i18n="settings.quality.low"></button><button data-nav data-value="medium" data-i18n="settings.quality.medium"></button><button data-nav data-value="high" data-i18n="settings.quality.high"></button></div></div>
    ${toggle('reducedMotion', 'settings.reducedMotion')}<div class="row"><span data-i18n="settings.language"></span><div class="seg" data-setting="locale">
    <button data-nav data-value="en" lang="en">English</button><button data-nav data-value="zh-CN" lang="zh-CN">简体中文</button></div></div></fieldset></div>
  <nav class="menu menu-row"><button data-nav class="btn" data-action="back"><span data-i18n="menu.back"></span></button></nav></div><footer class="bottom-bar"><div class="prompts"></div></footer></section>`
  }
}
