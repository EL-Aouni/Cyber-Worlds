import * as THREE from 'three'
import type { Audio } from '../engine/audio'
import type { Input } from '../engine/input'
import { Physics } from '../engine/physics'
import type { Renderer } from '../engine/renderer'
import type { CompletedPath, Quality } from '../engine/save'
import type { WorldUiState, PortfolioTab } from '../ui/ui'
import { FollowCamera } from './camera'
import { Collectibles } from './collectibles'
import { AmbientEffects, Effects } from './fx'
import { Player, type PlayerEvent } from './player'
import { COLLECTIBLE_SPOTS, Worlds, type CareerWorldId, type PortfolioStationId, type WorldId } from './worlds'

export type Mode = 'attract' | 'playing' | 'paused'
export type GameHooks = {
  updateWorld(state: WorldUiState): void
  completedPaths(paths: readonly CompletedPath[]): void
  portfolio(tab: PortfolioTab): void
}

/** Third-person exploration across one present-day portfolio hub and four offline career simulations. */
export class Game {
  mode: Mode = 'attract'
  reducedMotion = false
  readonly worlds: Worlds
  readonly player: Player
  readonly physics: Physics
  private readonly cam: FollowCamera
  private readonly fx = new Effects()
  private readonly ambientFx = new AmbientEffects()
  private readonly worldCollectibles = new Map<WorldId, Collectibles>()
  private readonly completed = new Set<CompletedPath>()
  private worldId: WorldId = 'hub'
  private time = 0
  private powerUntil = 0
  private cachedWorldState = ''
  private readonly events: PlayerEvent[] = []

  constructor(
    private readonly renderer: Renderer,
    private readonly input: Input,
    private readonly audio: Audio,
    private readonly hooks: GameHooks,
    avatar: { scene: THREE.Object3D; animations: readonly THREE.AnimationClip[] },
    completedPaths: readonly CompletedPath[] = [],
  ) {
    this.physics = new Physics(-30)
    this.worlds = new Worlds(this.physics)
    this.player = new Player(this.physics, this.worlds.getSegment('hub').spawn, [], avatar)
    this.cam = new FollowCamera(this.physics, this.player.collider)
    for (const path of completedPaths) {
      this.completed.add(path)
      const segment = this.worlds.getSegment(path)
      for (const target of segment.targets) this.worlds.markTargetComplete(path, target.id)
    }

    const worldIds: readonly WorldId[] = ['hub', 'redteam', 'blueteam', 'grc', 'research']
    for (const id of worldIds) {
      const seg = this.worlds.getSegment(id)
      const spots = COLLECTIBLE_SPOTS[id].map(p => seg.origin.clone().add(new THREE.Vector3(p.x, p.y, p.z)))
      const col = new Collectibles(spots)
      this.worldCollectibles.set(id, col)
      seg.scene.add(col.group)
    }

    this.attachPlayerToScene('hub')
    this.cam.reset(this.player.position, 0)
    this.emitWorld(true)
  }

  get camera(): THREE.PerspectiveCamera { return this.cam.camera }
  get currentWorld(): WorldId { return this.worldId }

  start(_showTutorial = true): void {
    this.switchWorld('hub', this.worlds.getSegment('hub').spawn)
    this.cam.yaw = 0
    this.cam.pitch = 0.28
    this.cam.reset(this.player.position, 0)
    this.mode = 'playing'
    this.input.endFrame()
    this.input.takeLook()
    this.emitWorld(true)
  }

  pause(): void {
    if (this.mode === 'playing') this.mode = 'paused'
  }

  resume(): void {
    if (this.mode !== 'paused') return
    this.mode = 'playing'
    this.input.endFrame()
    this.input.takeLook()
  }

  toTitle(): void {
    this.mode = 'attract'
    this.switchWorld('hub', this.worlds.getSegment('hub').spawn)
    this.cam.reset(this.player.position, 0)
    this.emitWorld(true)
  }

  setQuality(quality: Quality): void {
    this.renderer.applyQuality(quality)
    const size = this.renderer.shadowMapSize
    for (const id of ['hub', 'redteam', 'blueteam', 'grc', 'research'] as const) {
      const scene = this.worlds.getSegment(id).scene
      const shadow = scene.children.find(object => (object as THREE.DirectionalLight).isDirectionalLight) as THREE.DirectionalLight | undefined
      if (!shadow) continue
      shadow.shadow.map?.dispose()
      shadow.shadow.map = null
      shadow.shadow.mapSize.set(size, size)
      scene.traverse(object => {
        const material = (object as THREE.Mesh).material
        for (const item of Array.isArray(material) ? material : material ? [material] : []) item.needsUpdate = true
      })
    }
  }

  step(dt: number): void {
    this.time += dt
    const playing = this.mode === 'playing'
    if (playing) {
      this.events.length = 0
      const jumpPressed = this.input.consume('jump')
      const dashPressed = this.input.consume('dash')
      this.player.step(dt, {
        moveX: this.input.move.x,
        moveY: this.input.move.y,
        sprint: this.input.held('sprint'),
        jumpPressed,
        jumpHeld: this.input.held('jump'),
        dashPressed,
      }, this.cam.yaw, this.events)
      this.handlePlayerEvents()

      // Interactive biomes: Thermal bounce vents (Red Team) & Speed boost pads (GRC)
      if (this.worldId === 'redteam' && this.worlds.checkBounceVent(this.player.position) && this.player.velocity.y <= 1.5) {
        this.player.launch(22)
        this.audio.play('jump')
        this.fx.burst(this.player.position, '#ff5722', 24, 4.5)
        this.cam.addShake(this.reducedMotion ? 0 : 0.16)
      } else if (this.worldId === 'grc' && this.worlds.checkSpeedPad(this.player.position)) {
        this.player.boost(26)
        this.audio.play('dash')
        this.fx.burst(this.player.position, '#ffd700', 16, 3.5)
      }

      // Collectibles in every world
      const col = this.worldCollectibles.get(this.worldId)
      if (col) {
        const got = col.collect(this.player.position, 1.8)
        for (const spot of got) {
          this.audio.play('pickup')
          this.fx.burst(spot, '#ffd35c', 20, 3.5)
          this.cam.addShake(this.reducedMotion ? 0 : 0.08)
        }
      }

      if (this.input.consume('power')) this.activatePower()
      if (this.input.consume('interact')) this.interact()
    }
    this.physics.step(dt)
    this.worlds.update(Date.now())
    if (playing) this.emitWorld()
  }

  render(_alpha: number, frameSeconds: number): void {
    this.physics.sync(1)
    const segment = this.worlds.getSegment(this.worldId)
    if (this.mode === 'attract') {
      const angle = this.time * 0.075 + 0.35
      this.camera.position.set(Math.sin(angle) * 31, 12 + Math.sin(this.time * 0.2) * 1.2, Math.cos(angle) * 31)
      this.camera.lookAt(segment.origin.x, 2.2, segment.origin.z)
    } else {
      const look = this.mode === 'playing' ? this.input.takeLook() : { x: 0, y: 0 }
      this.cam.update(this.player.root.position, look, frameSeconds, false, this.reducedMotion)
    }
    const ground = segment.origin.y
    this.player.animate(frameSeconds, this.time, false, ground)
    this.fx.update(frameSeconds)
    this.worldCollectibles.get(this.worldId)?.animate(frameSeconds)
    this.ambientFx.update(frameSeconds, this.worldId, this.player.position)
    this.renderer.render(segment.scene, this.cam.camera)
  }

  private handlePlayerEvents(): void {
    for (const event of this.events) {
      if (event.type === 'jump') this.audio.play('jump')
      else if (event.type === 'land') this.audio.play('land')
      else if (event.type === 'dash') {
        this.audio.play('dash')
        const p = this.player.position
        this.fx.burst(p.add(new THREE.Vector3(0, 0.5, 0)), '#8df5ed', 12, 2.3)
      }
    }
  }

  private activatePower(): void {
    if (this.worldId === 'hub') {
      this.audio.play('ui')
      return
    }
    const target = this.worlds.findNearestTarget(this.worldId, this.player.position, 50)
    if (!target) return
    const now = Date.now()
    if (this.worlds.activateTargetHighlight(this.worldId, target.id, 4_500, now)) {
      this.powerUntil = this.time + 4.5
      this.audio.play('pickup')
      this.fx.burst(target.position.clone().add(new THREE.Vector3(0, 0.8, 0)), `#${this.worlds.getSegment(this.worldId).themeColor.getHexString()}`, 16, 3)
      this.emitWorld(true)
    }
  }

  private interact(): void {
    const position = this.player.position
    const portal = this.worlds.findNearestPortal(this.worldId, position, 3.25)
    if (portal) {
      this.audio.play('ui')
      this.switchWorld(portal.destination, portal.exitPosition)
      this.cam.reset(this.player.position, this.cam.yaw)
      this.emitWorld(true)
      return
    }
    if (this.worldId === 'hub') {
      const station = this.worlds.findNearestStation('hub', position, 2.9)
      if (station) this.hooks.portfolio(station.id as PortfolioStationId)
      return
    }
    const target = this.worlds.findNearestTarget(this.worldId, position, 2.75)
    if (!target) return
    if (this.powerUntil < this.time) {
      this.activatePower()
      this.emitWorld(true)
      return
    }
    if (!this.worlds.markTargetComplete(this.worldId, target.id)) return
    this.audio.play('win')
    this.cam.addShake(this.reducedMotion ? 0 : 0.22)
    this.fx.burst(target.position.clone().add(new THREE.Vector3(0, 0.8, 0)), '#f7d67a', 26, 4)
    const segment = this.worlds.getSegment(this.worldId)
    if (segment.targets.every(item => item.completed)) {
      this.completed.add(this.worldId as CareerWorldId)
      const paths = [...this.completed] as CompletedPath[]
      this.hooks.completedPaths(paths)
    }
    this.emitWorld(true)
  }

  private switchWorld(destination: WorldId, spawn: THREE.Vector3): void {
    const previous = this.worlds.getSegment(this.worldId)
    previous.scene.remove(this.player.root, this.player.shadowMesh, this.fx.mesh, this.ambientFx.mesh)
    this.worldId = destination
    const next = this.worlds.getSegment(destination)

    // Tailor physical properties to the biome
    if (destination === 'research') {
      this.player.gravityMult = 0.32 // Zero-G floaty cosmic space physics
      this.player.frictionMult = 1.0
    } else if (destination === 'blueteam') {
      this.player.gravityMult = 0.95
      this.player.frictionMult = 0.22 // Icy sliding drift!
    } else if (destination === 'redteam') {
      this.player.gravityMult = 1.05
      this.player.frictionMult = 1.0
    } else if (destination === 'grc') {
      this.player.gravityMult = 0.9
      this.player.frictionMult = 1.0
    } else {
      this.player.gravityMult = 1.0 // Hub Earth physics
      this.player.frictionMult = 1.0
    }

    this.ambientFx.clear()
    this.player.teleport(spawn)
    next.scene.add(this.player.root, this.player.shadowMesh, this.fx.mesh, this.ambientFx.mesh)
    this.powerUntil = 0
    this.input.endFrame()
    this.input.takeLook()
    this.emitWorld(true)
  }

  private attachPlayerToScene(id: WorldId): void {
    this.worlds.getSegment(id).scene.add(this.player.root, this.player.shadowMesh, this.fx.mesh, this.ambientFx.mesh)
  }

  private emitWorld(force = false): void {
    const segment = this.worlds.getSegment(this.worldId)
    const position = this.player.position
    const portal = this.worlds.findNearestPortal(this.worldId, position, 3.25)
    const station = this.worlds.findNearestStation(this.worldId, position, 2.9)
    const target = this.worlds.findNearestTarget(this.worldId, position, 2.75)
    let interactable: WorldUiState['interactable'] = null
    if (portal) interactable = { kind: 'portal', destination: portal.destination }
    else if (station) interactable = { kind: 'profile', tab: station.id }
    else if (target) interactable = { kind: 'target', titleKey: target.titleKey, descriptionKey: target.descriptionKey }
    const isHub = this.worldId === 'hub'
    const progress = isHub ? this.completed.size : segment.targets.filter(item => item.completed).length
    const state: WorldUiState = {
      worldId: this.worldId,
      interactable,
      progress,
      total: isHub ? segment.portals.length : segment.targets.length,
      completedPaths: [...this.completed],
      powerAvailable: this.worldId !== 'hub',
      powerActive: this.powerUntil > this.time,
    }
    const signature = JSON.stringify(state)
    if (force || signature !== this.cachedWorldState) {
      this.cachedWorldState = signature
      this.hooks.updateWorld(state)
    }
  }
}
