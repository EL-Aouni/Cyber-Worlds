import * as THREE from 'three'

type Particle = { life: number; max: number; pos: THREE.Vector3; vel: THREE.Vector3; size: number; color: THREE.Color; gravity: number }

const MAX = 400

/**
 * Pooled particle bursts on one InstancedMesh (a single draw call for every effect).
 * Use `burst()` for pickups/hits and `puff()` for dust.
 */
export class Effects {
  readonly mesh: THREE.InstancedMesh
  private particles: Particle[] = []
  private readonly dummy = new THREE.Object3D()

  constructor() {
    const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false })
    this.mesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.12, 0), mat, MAX)
    this.mesh.frustumCulled = false
    this.mesh.count = 0
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.setColorAt(0, new THREE.Color())
  }

  burst(at: THREE.Vector3, color: THREE.ColorRepresentation, count = 24, speed = 6): void {
    const c = new THREE.Color(color)
    for (let i = 0; i < count; i += 1) {
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.1, Math.random() - 0.5).normalize()
      this.spawn({ life: 0, max: 0.5 + Math.random() * 0.4, pos: at.clone(), vel: dir.multiplyScalar(speed * (0.4 + Math.random() * 0.6)), size: 0.8 + Math.random() * 0.8, color: c, gravity: -12 })
    }
  }

  puff(at: THREE.Vector3, strength = 1): void {
    const c = new THREE.Color('#f3e6cf')
    const n = Math.round(8 + strength * 10)
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2
      const vel = new THREE.Vector3(Math.cos(a), 0.25 + Math.random() * 0.3, Math.sin(a)).multiplyScalar(2 + strength * 3)
      this.spawn({ life: 0, max: 0.35 + Math.random() * 0.25, pos: at.clone(), vel, size: 1.2 + Math.random(), color: c, gravity: -2 })
    }
  }

  private spawn(p: Particle): void {
    if (this.particles.length >= MAX) this.particles.shift()
    this.particles.push(p)
  }

  update(dt: number): void {
    this.particles = this.particles.filter(p => (p.life += dt) < p.max)
    this.particles.forEach((p, i) => {
      p.vel.y += p.gravity * dt
      p.vel.multiplyScalar(1 - 2.2 * dt)
      p.pos.addScaledVector(p.vel, dt)
      const k = 1 - p.life / p.max
      this.dummy.position.copy(p.pos)
      this.dummy.scale.setScalar(p.size * k)
      this.dummy.rotation.set(p.life * 6, p.life * 4, 0)
      this.dummy.updateMatrix()
      this.mesh.setMatrixAt(i, this.dummy.matrix)
      this.mesh.setColorAt(i, p.color)
    })
    this.mesh.count = this.particles.length
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }

  clear(): void {
    this.particles = []
    this.mesh.count = 0
  }
}

const AMBIENT_MAX = 140
type AmbientParticle = {
  pos: THREE.Vector3
  vel: THREE.Vector3
  size: number
  color: THREE.Color
  life: number
  max: number
  sway: number
}

/**
 * Continuous ambient particle atmosphere (embers, snow, stardust, golden motes) per world.
 */
export class AmbientEffects {
  readonly mesh: THREE.InstancedMesh
  private particles: AmbientParticle[] = []
  private readonly dummy = new THREE.Object3D()
  private time = 0

  constructor() {
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.82, depthWrite: false, toneMapped: false })
    this.mesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.11, 0), mat, AMBIENT_MAX)
    this.mesh.frustumCulled = false
    this.mesh.count = 0
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  }

  update(dt: number, worldId: string, playerPos: THREE.Vector3): void {
    this.time += dt
    this.particles = this.particles.filter(p => {
      p.life += dt
      return p.life < p.max && p.pos.distanceToSquared(playerPos) < 45 * 45
    })

    const spawnCount = Math.min(3, AMBIENT_MAX - this.particles.length)
    for (let i = 0; i < spawnCount; i += 1) {
      this.spawnParticle(worldId, playerPos)
    }

    this.particles.forEach((p, i) => {
      p.pos.x += Math.sin(this.time * 2 + p.sway) * 0.35 * dt
      p.pos.addScaledVector(p.vel, dt)
      const k = Math.sin((p.life / p.max) * Math.PI)
      this.dummy.position.copy(p.pos)
      this.dummy.scale.setScalar(p.size * Math.max(0.01, k))
      this.dummy.rotation.set(this.time + p.sway, this.time * 0.8, 0)
      this.dummy.updateMatrix()
      this.mesh.setMatrixAt(i, this.dummy.matrix)
      this.mesh.setColorAt(i, p.color)
    })
    this.mesh.count = this.particles.length
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }

  clear(): void {
    this.particles = []
    this.mesh.count = 0
  }

  private spawnParticle(worldId: string, player: THREE.Vector3): void {
    const rx = (Math.random() - 0.5) * 32
    const rz = (Math.random() - 0.5) * 32
    const sway = Math.random() * Math.PI * 2
    let pos = new THREE.Vector3()
    let vel = new THREE.Vector3()
    let color = new THREE.Color()
    let size = 0.8 + Math.random() * 0.7
    let max = 3 + Math.random() * 2

    switch (worldId) {
      case 'redteam':
        // Rising fiery embers
        pos.set(player.x + rx, 0.2 + Math.random() * 0.8, player.z + rz)
        vel.set((Math.random() - 0.5) * 1.2, 2.2 + Math.random() * 2.2, (Math.random() - 0.5) * 1.2)
        color.set(Math.random() > 0.4 ? '#ff5722' : Math.random() > 0.5 ? '#ff9800' : '#ffd54f')
        size = 0.9 + Math.random() * 0.9
        max = 2.4 + Math.random() * 1.6
        break
      case 'blueteam':
        // Falling frost snow
        pos.set(player.x + rx, 14 + Math.random() * 4, player.z + rz)
        vel.set((Math.random() - 0.5) * 0.8, -(1.8 + Math.random() * 1.4), (Math.random() - 0.5) * 0.8)
        color.set(Math.random() > 0.3 ? '#e0f7fa' : '#80deea')
        size = 0.7 + Math.random() * 0.6
        max = 4.2 + Math.random() * 2
        break
      case 'research':
        // Zero-G cosmic stardust
        pos.set(player.x + rx, player.y + (Math.random() - 0.3) * 18, player.z + rz)
        vel.set((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6)
        color.set(Math.random() > 0.5 ? '#ce93d8' : Math.random() > 0.5 ? '#80d8ff' : '#ffffff')
        size = 0.8 + Math.random() * 0.8
        max = 4.5 + Math.random() * 2
        break
      case 'grc':
        // Rising golden aura motes
        pos.set(player.x + rx, 0.3 + Math.random() * 1.5, player.z + rz)
        vel.set((Math.random() - 0.5) * 0.8, 1.2 + Math.random() * 1.4, (Math.random() - 0.5) * 0.8)
        color.set(Math.random() > 0.4 ? '#ffd54f' : '#ffb300')
        size = 0.8 + Math.random() * 0.7
        max = 3.2 + Math.random() * 1.8
        break
      default:
        // Hub: gentle drifting leaves / pollen
        pos.set(player.x + rx, 2 + Math.random() * 8, player.z + rz)
        vel.set((Math.random() - 0.5) * 1.1, -0.4 + (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 1.1)
        color.set(Math.random() > 0.5 ? '#a5d6a7' : '#fff59d')
        size = 0.7 + Math.random() * 0.6
        max = 4 + Math.random() * 2
        break
    }
    this.particles.push({ pos, vel, color, size, life: 0, max, sway })
  }
}
