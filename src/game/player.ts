import * as THREE from 'three'
import { RAPIER, type Physics } from '../engine/physics'
import { CONFIG } from './config'
import { tuning } from './tuning'
import type { MovingPlatform } from './world'

export type PlayerIntent = { moveX: number; moveY: number; sprint: boolean; jumpPressed: boolean; jumpHeld: boolean; dashPressed: boolean }
export type PlayerEvent = { type: 'jump' } | { type: 'land'; impact: number } | { type: 'dash' }

const P = CONFIG.player
const UP = new THREE.Vector3(0, 1, 0)

/**
 * Third-person character on Rapier's KinematicCharacterController: the controller resolves
 * collisions, slopes, steps and ground snapping; this class owns the "game feel" (acceleration,
 * coyote time, jump buffering, variable jump height, dash, moving-platform carry).
 */
export class Player {
  readonly root = new THREE.Group()
  readonly body: RAPIER.RigidBody
  readonly collider: RAPIER.Collider
  readonly velocity = new THREE.Vector3()
  grounded = false
  facing = 0
  private readonly controller: RAPIER.KinematicCharacterController
  private readonly model = new THREE.Group()
  private readonly shadow: THREE.Mesh
  private readonly mixer?: THREE.AnimationMixer
  private readonly locomotion: Partial<Record<'idle' | 'walk' | 'run', THREE.AnimationAction>> = {}
  private activeAction?: THREE.AnimationAction
  private coyote = 0
  private jumpBuffer = 0
  private jumping = false
  private dashTime = 0
  private dashCooldown = 0
  private squash = 0
  private runCycle = 0
  private platform?: MovingPlatform
  /** Last position where the player stood on solid, static ground (respawn point after a fall). */
  readonly safe = new THREE.Vector3()
  private safeTimer = 0
  gravityMult = 1
  frictionMult = 1
  private doubleJumpAvailable = true

  constructor(
    private readonly physics: Physics,
    spawn: THREE.Vector3,
    private readonly movers: MovingPlatform[],
    avatar?: { scene: THREE.Object3D; animations: readonly THREE.AnimationClip[] },
  ) {
    const world = physics.world
    this.body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y, spawn.z))
    this.collider = world.createCollider(RAPIER.ColliderDesc.capsule(P.halfHeight, P.radius).setFriction(0), this.body)
    this.controller = world.createCharacterController(0.02)
    this.controller.enableAutostep(0.4, 0.25, false)
    this.controller.enableSnapToGround(0.35)
    this.controller.setMaxSlopeClimbAngle(THREE.MathUtils.degToRad(50))
    this.controller.setMinSlopeSlideAngle(THREE.MathUtils.degToRad(35))
    this.controller.setApplyImpulsesToDynamicBodies(true)
    this.safe.copy(spawn)

    this.root.position.copy(spawn)
    this.model.rotation.order = 'YXZ'
    if (avatar) {
      const avatarRoot = new THREE.Group()
      avatarRoot.add(avatar.scene)
      avatarRoot.updateMatrixWorld(true)
      const bounds = new THREE.Box3().setFromObject(avatarRoot)
      const size = bounds.getSize(new THREE.Vector3())
      const targetHeight = 2 * (P.halfHeight + P.radius)
      const scale = size.y > 1e-5 ? targetHeight / size.y : 1
      avatarRoot.scale.setScalar(scale)
      avatarRoot.position.y = -targetHeight / 2 - bounds.min.y * scale
      avatarRoot.traverse(object => {
        if ((object as THREE.Mesh).isMesh) {
          const mesh = object as THREE.Mesh
          mesh.castShadow = true
          mesh.receiveShadow = true
        }
      })
      this.model.add(avatarRoot)
      if (avatar.animations.length > 0) {
        this.mixer = new THREE.AnimationMixer(avatar.scene)
        this.locomotion.idle = this.actionFor(avatar.animations, ['Idle_Neutral', 'Idle'], avatar.animations[0])
        this.locomotion.walk = this.actionFor(avatar.animations, ['Walk', 'Run'], avatar.animations[0])
        this.locomotion.run = this.actionFor(avatar.animations, ['Run', 'Walk'], avatar.animations[0])
        const idle = this.locomotion.idle
        if (idle) {
          idle.play()
          this.activeAction = idle
        }
      }
    } else {
      this.buildFallbackModel()
    }
    this.root.add(this.model)
    physics.bind(this.body, this.root)

    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(P.radius * 1.25, 24),
      new THREE.MeshBasicMaterial({ color: '#1d1a2a', transparent: true, opacity: 0.35, depthWrite: false }),
    )
    this.shadow.rotation.x = -Math.PI / 2
    this.shadow.renderOrder = 1
  }

  get shadowMesh(): THREE.Mesh {
    return this.shadow
  }

  get position(): THREE.Vector3 {
    const t = this.body.translation()
    return new THREE.Vector3(t.x, t.y, t.z)
  }

  get dashing(): boolean {
    return this.dashTime > 0
  }

  /** One fixed step. `cameraYaw` makes stick/WASD movement camera-relative. */
  step(dt: number, intent: PlayerIntent, cameraYaw: number, events: PlayerEvent[]): void {
    const forward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw))
    const right = new THREE.Vector3().crossVectors(forward, UP)
    const wish = new THREE.Vector3().addScaledVector(right, intent.moveX).addScaledVector(forward, intent.moveY)
    const wishLen = Math.min(1, wish.length())
    if (wishLen > 0.01) wish.normalize()

    this.coyote = this.grounded ? P.coyoteTime : Math.max(0, this.coyote - dt)
    this.jumpBuffer = intent.jumpPressed ? P.jumpBuffer : Math.max(0, this.jumpBuffer - dt)
    this.dashCooldown = Math.max(0, this.dashCooldown - dt)

    if (intent.dashPressed && this.dashCooldown <= 0) {
      tuning.activate('dash')
      const dir = wishLen > 0.01 ? wish : new THREE.Vector3(-Math.sin(this.facing), 0, -Math.cos(this.facing))
      this.facing = Math.atan2(-dir.x, -dir.z)
      this.velocity.set(dir.x * P.dashSpeed, Math.max(this.velocity.y, 0), dir.z * P.dashSpeed)
      this.dashTime = P.dashTime
      this.dashCooldown = P.dashCooldown
      events.push({ type: 'dash' })
    }

    if (this.dashTime > 0) {
      this.dashTime -= dt
      this.velocity.y = Math.max(this.velocity.y, 0)
    } else {
      const speed = (intent.sprint ? P.sprintSpeed : P.walkSpeed) * wishLen
      const control = this.grounded ? 1 : P.airControl
      const target = wish.clone().multiplyScalar(speed)
      const horizontal = new THREE.Vector3(this.velocity.x, 0, this.velocity.z)
      const accelRate = (P.acceleration / 6) * control * (this.grounded ? this.frictionMult : 1)
      horizontal.lerp(target, 1 - Math.exp(-accelRate * dt))
      this.velocity.x = horizontal.x
      this.velocity.z = horizontal.z

      if (this.jumpBuffer > 0 && this.coyote > 0) {
        tuning.activate('jump')
        this.velocity.y = P.jumpSpeed
        this.jumping = true
        this.jumpBuffer = 0
        this.coyote = 0
        this.grounded = false
        this.platform = undefined
        this.squash = -0.35
        events.push({ type: 'jump' })
      } else if (this.jumpBuffer > 0 && !this.grounded && this.doubleJumpAvailable) {
        this.doubleJumpAvailable = false
        this.velocity.y = P.jumpSpeed * 0.92
        this.jumping = true
        this.jumpBuffer = 0
        this.squash = -0.3
        events.push({ type: 'jump' })
      }
      const rising = this.velocity.y > 0
      const gravity = (rising && this.jumping && !intent.jumpHeld ? P.lowJumpGravity : P.gravity) * this.gravityMult
      this.velocity.y = Math.max(P.maxFall * Math.max(0.4, this.gravityMult), this.velocity.y + gravity * dt)
    }

    if (wishLen > 0.1 && this.dashTime <= 0) {
      const targetYaw = Math.atan2(-wish.x, -wish.z)
      this.facing = dampAngle(this.facing, targetYaw, P.turnSpeed, dt)
    }

    const desired = this.velocity.clone().multiplyScalar(dt)
    if (this.platform) desired.add(this.platform.delta)
    this.controller.computeColliderMovement(this.collider, desired)
    const moved = this.controller.computedMovement()
    const wasGrounded = this.grounded
    this.grounded = this.controller.computedGrounded()

    // Bumped a ceiling: stop rising. Hit a wall mid-dash: end the dash.
    if (this.velocity.y > 0 && moved.y < desired.y - 1e-3) this.velocity.y = 0
    if (this.grounded) {
      this.doubleJumpAvailable = true
      if (!wasGrounded && this.velocity.y < -6) {
        events.push({ type: 'land', impact: Math.min(1, -this.velocity.y / 30) })
        this.squash = Math.min(0.45, -this.velocity.y / 60)
      }
      if (this.velocity.y < 0) this.velocity.y = -1
      this.jumping = false
    }

    const cur = this.body.translation()
    const next = { x: cur.x + moved.x, y: cur.y + moved.y, z: cur.z + moved.z }
    this.body.setNextKinematicTranslation(next)
    this.platform = this.grounded ? this.findPlatform(next) : undefined

    if (this.grounded && !this.platform) {
      this.safeTimer += dt
      if (this.safeTimer > 0.4) this.safe.set(next.x, next.y + 0.2, next.z)
    } else {
      this.safeTimer = 0
    }
  }

  private findPlatform(pos: { x: number; y: number; z: number }): MovingPlatform | undefined {
    const feet = pos.y - P.halfHeight - P.radius
    return this.movers.find(m => {
      const c = m.body.translation()
      const top = c.y + m.half.y
      return Math.abs(feet - top) < 0.2 && Math.abs(pos.x - c.x) < m.half.x + P.radius * 0.6 && Math.abs(pos.z - c.z) < m.half.z + P.radius * 0.6
    })
  }

  /** Teleport (respawn). Clears velocity and interpolation so the camera does not streak. */
  teleport(to: THREE.Vector3): void {
    this.body.setTranslation(to, true)
    this.body.setNextKinematicTranslation(to)
    this.velocity.set(0, 0, 0)
    this.platform = undefined
    this.dashTime = 0
    this.root.position.copy(to)
    this.physics.snap(this.body)
  }

  /** Knock the player away from a hazard. */
  knockback(from: THREE.Vector3): void {
    const away = this.position.sub(from).setY(0)
    if (away.lengthSq() < 1e-4) away.set(1, 0, 0)
    away.normalize().multiplyScalar(9)
    this.velocity.set(away.x, 7, away.z)
    this.dashTime = 0
    this.grounded = false
    this.platform = undefined
  }

  /** Launch player upward (e.g., thermal vent). */
  launch(upwardVelocity = 21): void {
    this.velocity.y = upwardVelocity
    this.grounded = false
    this.jumping = true
    this.coyote = 0
    this.doubleJumpAvailable = true
    this.squash = -0.42
  }

  /** Give player a forward dash boost (e.g., speed pad). */
  boost(amount = 26): void {
    const dir = new THREE.Vector3(-Math.sin(this.facing), 0, -Math.cos(this.facing))
    this.velocity.x = dir.x * amount
    this.velocity.z = dir.z * amount
  }

  /** Visual-only animation, once per rendered frame after `physics.sync()`. */
  animate(frameSeconds: number, time: number, invulnerable: boolean, ground: number | null): void {
    const speed = Math.hypot(this.velocity.x, this.velocity.z)
    this.model.rotation.y = this.facing
    this.squash = THREE.MathUtils.damp(this.squash, 0, 10, frameSeconds)
    const stretch = this.grounded ? 0 : THREE.MathUtils.clamp(this.velocity.y / 60, -0.12, 0.18)
    const s = 1 - this.squash + stretch
    this.model.scale.set(1 / Math.sqrt(Math.max(s, 0.5)), s, 1 / Math.sqrt(Math.max(s, 0.5)))
    if (this.grounded && speed > 0.5) this.runCycle += frameSeconds * speed * 1.6
    const bob = !this.mixer && this.grounded ? Math.abs(Math.sin(this.runCycle)) * 0.08 * Math.min(1, speed / 6) : 0
    this.model.position.y = bob
    this.model.rotation.x = -Math.min(0.28, speed / 40) * (this.dashing ? 1.6 : 1)
    this.model.visible = !invulnerable || Math.floor(time * 16) % 2 === 0
    this.updateLocomotion(speed, frameSeconds)

    // Blob shadow: always-on depth cue for platforming, even with real shadows disabled.
    if (ground === null) {
      this.shadow.visible = false
    } else {
      const feet = this.root.position.y - P.halfHeight - P.radius
      const height = Math.max(0, feet - ground)
      this.shadow.visible = height < 14
      this.shadow.position.set(this.root.position.x, ground + 0.03, this.root.position.z)
      const k = THREE.MathUtils.clamp(1 - height / 14, 0.25, 1)
      this.shadow.scale.setScalar(k)
      ;(this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.38 * k
    }
  }

  private actionFor(
    clips: readonly THREE.AnimationClip[],
    preferred: string[],
    fallback?: THREE.AnimationClip,
  ): THREE.AnimationAction | undefined {
    const clip = preferred
      .map(name => clips.find(candidate => candidate.name === name))
      .find((candidate): candidate is THREE.AnimationClip => candidate !== undefined)
      ?? clips.find(candidate => preferred.some(name => candidate.name.toLowerCase().includes(name.toLowerCase())))
      ?? fallback
    if (!clip || !this.mixer) return undefined
    const action = this.mixer.clipAction(clip)
    action.setLoop(THREE.LoopRepeat, Infinity)
    action.clampWhenFinished = false
    return action
  }

  private updateLocomotion(speed: number, frameSeconds: number): void {
    if (!this.mixer) return
    const moving = this.grounded && speed > 0.55
    const key = !moving ? 'idle' : this.dashing || speed > (P.walkSpeed + P.sprintSpeed) * 0.5 ? 'run' : 'walk'
    const next = this.locomotion[key] ?? this.locomotion.idle ?? this.locomotion.walk ?? this.locomotion.run
    if (next && next !== this.activeAction) {
      next.reset().play()
      if (this.activeAction) this.activeAction.crossFadeTo(next, 0.18, true)
      this.activeAction = next
    }
    this.mixer.update(frameSeconds)
  }

  private buildFallbackModel(): void {
    const skin = new THREE.MeshStandardMaterial({ color: '#d7a17e', roughness: 0.82 })
    const hair = new THREE.MeshStandardMaterial({ color: '#392a25', roughness: 0.9 })
    const hoodie = new THREE.MeshStandardMaterial({ color: '#557b91', roughness: 0.9 })
    const hoodieTrim = new THREE.MeshStandardMaterial({ color: '#89a7b2', roughness: 0.9 })
    const trousers = new THREE.MeshStandardMaterial({ color: '#343744', roughness: 0.92 })
    const shoes = new THREE.MeshStandardMaterial({ color: '#e8e1d5', roughness: 0.85 })
    const eyes = new THREE.MeshStandardMaterial({ color: '#30251f', roughness: 0.8 })
    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, position: [number, number, number], scale?: [number, number, number], rotation?: [number, number, number]) => {
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(...position)
      if (scale) mesh.scale.set(...scale)
      if (rotation) mesh.rotation.set(...rotation)
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.model.add(mesh)
      return mesh
    }

    // Hoodie, hem and front pocket.
    add(new THREE.CapsuleGeometry(0.25, 0.36, 4, 10), hoodie, [0, -0.12, 0])
    add(new THREE.BoxGeometry(0.32, 0.16, 0.035), hoodieTrim, [0, -0.31, -0.235])
    // Relaxed sleeves and hands.
    add(new THREE.CapsuleGeometry(0.085, 0.35, 4, 8), hoodie, [-0.33, -0.08, 0], undefined, [0, 0, -0.12])
    add(new THREE.CapsuleGeometry(0.085, 0.35, 4, 8), hoodie, [0.33, -0.08, 0], undefined, [0, 0, 0.12])
    add(new THREE.SphereGeometry(0.085, 12, 10), skin, [-0.35, -0.38, 0])
    add(new THREE.SphereGeometry(0.085, 12, 10), skin, [0.35, -0.38, 0])
    // Jeans and everyday sneakers.
    add(new THREE.CapsuleGeometry(0.12, 0.38, 4, 8), trousers, [-0.14, -0.59, 0.015])
    add(new THREE.CapsuleGeometry(0.12, 0.38, 4, 8), trousers, [0.14, -0.59, 0.015])
    add(new THREE.BoxGeometry(0.22, 0.11, 0.34), shoes, [-0.14, -0.87, -0.055])
    add(new THREE.BoxGeometry(0.22, 0.11, 0.34), shoes, [0.14, -0.87, -0.055])
    // Neck, head, short hair and small natural facial features (front faces -Z).
    add(new THREE.CylinderGeometry(0.09, 0.1, 0.14, 12), skin, [0, 0.32, 0])
    add(new THREE.SphereGeometry(0.22, 16, 12), skin, [0, 0.59, 0])
    add(new THREE.SphereGeometry(0.218, 16, 10), hair, [0, 0.72, 0.015], [1, 0.48, 1])
    add(new THREE.SphereGeometry(0.022, 8, 6), eyes, [-0.07, 0.61, -0.202])
    add(new THREE.SphereGeometry(0.022, 8, 6), eyes, [0.07, 0.61, -0.202])
    add(new THREE.SphereGeometry(0.028, 8, 6), skin, [0, 0.55, -0.215])

    // Keep the primitive's height aligned to the same capsule used for gameplay collision.
    const bounds = new THREE.Box3().setFromObject(this.model)
    const size = bounds.getSize(new THREE.Vector3())
    const targetHeight = 2 * (P.halfHeight + P.radius)
    const scale = size.y > 1e-5 ? targetHeight / size.y : 1
    this.model.scale.setScalar(scale)
    this.model.position.y = -targetHeight / 2 - bounds.min.y * scale
  }
}

function dampAngle(from: number, to: number, lambda: number, dt: number): number {
  let delta = (to - from) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2
  return from + delta * (1 - Math.exp(-lambda * dt))
}
