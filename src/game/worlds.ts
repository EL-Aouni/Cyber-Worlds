import * as THREE from 'three'
import type { Physics } from '../engine/physics'

type VectorLike = { x: number; y: number; z: number }
export type WorldId = 'hub' | 'redteam' | 'blueteam' | 'grc' | 'research'
export type CareerWorldId = Exclude<WorldId, 'hub'>
export type PortfolioStationId = 'profile' | 'soc' | 'redteam' | 'research' | 'contact'

export type PortfolioStation = {
  id: PortfolioStationId
  position: THREE.Vector3
  object: THREE.Group
}

export type Portal = {
  id: string
  worldId: WorldId
  destination: WorldId
  position: THREE.Vector3
  exitPosition: THREE.Vector3
  object: THREE.Group
  available: boolean
}

export type ChallengeTarget = {
  id: string
  worldId: CareerWorldId
  titleKey: string
  descriptionKey: string
  position: THREE.Vector3
  object: THREE.Group
  completed: boolean
  highlightUntil: number
}

export type WorldSegment = {
  id: WorldId
  scene: THREE.Scene
  origin: THREE.Vector3
  spawn: THREE.Vector3
  portals: Portal[]
  stations: PortfolioStation[]
  targets: ChallengeTarget[]
  themeColor: THREE.Color
  safeSceneDisclosureKey: string
  floor: THREE.Mesh
}

export type WorldMetadata = {
  nameKey: string
  careerPathLabelKey: string | null
  challengeNameKeys: readonly string[]
  challengeDescriptionKeys: readonly string[]
  powerDescriptionKey: string
  safeSceneDisclosureKey: string
  fictionalOnly: true
  networked: false
}

const CAREER_IDS: readonly CareerWorldId[] = ['redteam', 'blueteam', 'grc', 'research']
const STATION_IDS: readonly PortfolioStationId[] = ['profile', 'soc', 'redteam', 'research', 'contact']
const ORIGINS: Readonly<Record<WorldId, VectorLike>> = {
  hub: { x: 0, y: 0, z: 0 },
  redteam: { x: 180, y: 0, z: 0 },
  blueteam: { x: -180, y: 0, z: 0 },
  grc: { x: 0, y: 0, z: 180 },
  research: { x: 0, y: 0, z: -180 },
}
const THEMES: Readonly<Record<WorldId, string>> = {
  hub: '#aab8c5', redteam: '#f15b64', blueteam: '#42c8db', grc: '#e9b34b', research: '#a989f5',
}
const FLOOR_SIZE = new THREE.Vector3(58, 0.84, 58)
const TARGET_OFFSETS: readonly VectorLike[] = [
  { x: -10, y: 1.1, z: -8 },
  { x: 10, y: 1.1, z: -8 },
  { x: 0, y: 1.1, z: 12 },
]
const HIGHLIGHT_DURATION_MS = 1800
const MAX_HIGHLIGHT_DURATION_MS = 10_000

export const BOUNCE_VENTS: readonly VectorLike[] = [
  { x: -14, y: 0.1, z: 6 },
  { x: 14, y: 0.1, z: 6 },
  { x: 0, y: 0.1, z: -16 },
]

export const SPEED_PADS: readonly VectorLike[] = [
  { x: -8, y: 0.05, z: 0 },
  { x: 8, y: 0.05, z: 0 },
  { x: 0, y: 0.05, z: -2 },
]

export const COLLECTIBLE_SPOTS: Readonly<Record<WorldId, readonly VectorLike[]>> = {
  hub: [
    { x: 0, y: 2.8, z: 0 },
    { x: -16, y: 1.2, z: 10 },
    { x: 16, y: 1.2, z: 10 },
    { x: -18, y: 1.2, z: -14 },
    { x: 18, y: 1.2, z: -14 },
  ],
  redteam: [
    { x: -14, y: 7.5, z: 6 },
    { x: 14, y: 7.5, z: 6 },
    { x: 0, y: 7.5, z: -16 },
    { x: -18, y: 2.2, z: -4 },
    { x: 18, y: 2.2, z: -4 },
  ],
  blueteam: [
    { x: 0, y: 1.6, z: 0 },
    { x: -15, y: 2.8, z: -8 },
    { x: 15, y: 2.8, z: -8 },
    { x: -12, y: 1.5, z: 12 },
    { x: 12, y: 1.5, z: 12 },
  ],
  grc: [
    { x: 0, y: 1.6, z: 4 },
    { x: -8, y: 1.6, z: -12 },
    { x: 8, y: 1.6, z: -12 },
    { x: -16, y: 2.4, z: 8 },
    { x: 16, y: 2.4, z: 8 },
  ],
  research: [
    { x: 0, y: 10.5, z: 0 },
    { x: -12, y: 8.0, z: -10 },
    { x: 12, y: 8.0, z: -10 },
    { x: -14, y: 6.5, z: 8 },
    { x: 14, y: 6.5, z: 8 },
  ],
}

export const WORLD_CATALOG: Readonly<Record<WorldId, WorldMetadata>> = {
  hub: {
    nameKey: 'worlds.hub.name', careerPathLabelKey: null, challengeNameKeys: [], challengeDescriptionKeys: [],
    powerDescriptionKey: 'worlds.hub.power.description', safeSceneDisclosureKey: 'worlds.safeScene.disclosure',
    fictionalOnly: true, networked: false,
  },
  redteam: {
    nameKey: 'worlds.redteam.name', careerPathLabelKey: 'worlds.redteam.careerPath',
    challengeNameKeys: ['worlds.redteam.challenge1.name', 'worlds.redteam.challenge2.name', 'worlds.redteam.challenge3.name'],
    challengeDescriptionKeys: ['worlds.redteam.challenge1.description', 'worlds.redteam.challenge2.description', 'worlds.redteam.challenge3.description'],
    powerDescriptionKey: 'worlds.redteam.power.description', safeSceneDisclosureKey: 'worlds.safeScene.disclosure', fictionalOnly: true, networked: false,
  },
  blueteam: {
    nameKey: 'worlds.blueteam.name', careerPathLabelKey: 'worlds.blueteam.careerPath',
    challengeNameKeys: ['worlds.blueteam.challenge1.name', 'worlds.blueteam.challenge2.name', 'worlds.blueteam.challenge3.name'],
    challengeDescriptionKeys: ['worlds.blueteam.challenge1.description', 'worlds.blueteam.challenge2.description', 'worlds.blueteam.challenge3.description'],
    powerDescriptionKey: 'worlds.blueteam.power.description', safeSceneDisclosureKey: 'worlds.safeScene.disclosure', fictionalOnly: true, networked: false,
  },
  grc: {
    nameKey: 'worlds.grc.name', careerPathLabelKey: 'worlds.grc.careerPath',
    challengeNameKeys: ['worlds.grc.challenge1.name', 'worlds.grc.challenge2.name', 'worlds.grc.challenge3.name'],
    challengeDescriptionKeys: ['worlds.grc.challenge1.description', 'worlds.grc.challenge2.description', 'worlds.grc.challenge3.description'],
    powerDescriptionKey: 'worlds.grc.power.description', safeSceneDisclosureKey: 'worlds.safeScene.disclosure', fictionalOnly: true, networked: false,
  },
  research: {
    nameKey: 'worlds.research.name', careerPathLabelKey: 'worlds.research.careerPath',
    challengeNameKeys: ['worlds.research.challenge1.name', 'worlds.research.challenge2.name', 'worlds.research.challenge3.name'],
    challengeDescriptionKeys: ['worlds.research.challenge1.description', 'worlds.research.challenge2.description', 'worlds.research.challenge3.description'],
    powerDescriptionKey: 'worlds.research.power.description', safeSceneDisclosureKey: 'worlds.safeScene.disclosure', fictionalOnly: true, networked: false,
  },
}

export function getWorldOffset(worldId: WorldId): THREE.Vector3 {
  const point = ORIGINS[worldId]
  return new THREE.Vector3(point.x, point.y, point.z)
}

export function isWithinRadius(a: VectorLike, b: VectorLike, radius: number): boolean {
  if (!Number.isFinite(radius) || radius < 0) return false
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z
  return dx * dx + dy * dy + dz * dz <= radius * radius
}

export function nearestWithinRadius<T extends { position: THREE.Vector3 }>(
  items: readonly T[], position: VectorLike, radius: number, isAvailable: (item: T) => boolean = () => true,
): T | undefined {
  if (!Number.isFinite(radius) || radius < 0) return undefined
  let nearest: T | undefined
  let nearestDistance = radius * radius
  for (const item of items) {
    if (!isAvailable(item)) continue
    const dx = item.position.x - position.x, dy = item.position.y - position.y, dz = item.position.z - position.z
    const distance = dx * dx + dy * dy + dz * dz
    if (distance <= nearestDistance) {
      if (nearest === undefined || distance < nearestDistance) nearest = item
      nearestDistance = distance
    }
  }
  return nearest
}

/** Builds five separate, fictional, offline worlds from local procedural geometry. */
export class Worlds {
  private readonly segments = new Map<WorldId, WorldSegment>()

  constructor(private readonly physics: Pick<Physics, 'addStaticBox' | 'addSensorSphere'>) {
    for (const id of ['hub', ...CAREER_IDS] as const) this.segments.set(id, this.buildSegment(id))
  }

  getSegment(worldId: WorldId): WorldSegment {
    const segment = this.segments.get(worldId)
    if (!segment) throw new Error(`Unknown world: ${worldId}`)
    return segment
  }

  findNearestPortal(worldId: WorldId, position: VectorLike, radius: number): Portal | undefined {
    return nearestWithinRadius(this.getSegment(worldId).portals, position, radius, portal => portal.available)
  }

  findNearestTarget(worldId: WorldId, position: VectorLike, radius: number): ChallengeTarget | undefined {
    if (worldId === 'hub') return undefined
    return nearestWithinRadius(this.getSegment(worldId).targets, position, radius, target => !target.completed)
  }

  findNearestStation(worldId: WorldId, position: VectorLike, radius: number): PortfolioStation | undefined {
    if (worldId !== 'hub') return undefined
    return nearestWithinRadius(this.getSegment(worldId).stations, position, radius)
  }

  markTargetComplete(worldId: WorldId, targetId: string): boolean {
    if (worldId === 'hub') return false
    const target = this.getSegment(worldId).targets.find(candidate => candidate.id === targetId)
    if (!target || target.completed) return false
    target.completed = true
    target.highlightUntil = 0
    target.object.userData.completed = true
    target.object.userData.highlighted = false
    this.setTargetEmissive(target, new THREE.Color('#26313c'), 0.12)
    return true
  }

  activateTargetHighlight(worldId: WorldId, targetId: string, durationMs = HIGHLIGHT_DURATION_MS, now = Date.now()): boolean {
    if (worldId === 'hub') return false
    const target = this.getSegment(worldId).targets.find(candidate => candidate.id === targetId)
    if (!target || target.completed) return false
    const duration = THREE.MathUtils.clamp(Number.isFinite(durationMs) ? durationMs : HIGHLIGHT_DURATION_MS, 100, MAX_HIGHLIGHT_DURATION_MS)
    target.highlightUntil = now + duration
    target.object.userData.highlighted = true
    target.object.userData.highlightUntil = target.highlightUntil
    this.setTargetEmissive(target, this.getSegment(worldId).themeColor, 2.4)
    return true
  }

  update(now = Date.now()): void {
    for (const worldId of CAREER_IDS) {
      const segment = this.getSegment(worldId)
      for (const target of segment.targets) {
        if (target.highlightUntil === 0 || now < target.highlightUntil) continue
        target.highlightUntil = 0
        target.object.userData.highlighted = false
        target.object.userData.highlightUntil = 0
        this.setTargetEmissive(target, segment.themeColor, 0.25)
      }
    }
  }

  checkBounceVent(position: VectorLike): boolean {
    const origin = ORIGINS.redteam
    for (const v of BOUNCE_VENTS) {
      const dx = position.x - (origin.x + v.x)
      const dz = position.z - (origin.z + v.z)
      if (dx * dx + dz * dz < 2.4 * 2.4 && Math.abs(position.y - (origin.y + v.y)) < 2.2) {
        return true
      }
    }
    return false
  }

  checkSpeedPad(position: VectorLike): boolean {
    const origin = ORIGINS.grc
    for (const p of SPEED_PADS) {
      const dx = position.x - (origin.x + p.x)
      const dz = position.z - (origin.z + p.z)
      if (dx * dx + dz * dz < 2.4 * 2.4 && Math.abs(position.y - (origin.y + p.y)) < 2.2) {
        return true
      }
    }
    return false
  }

  private buildSegment(id: WorldId): WorldSegment {
    const origin = getWorldOffset(id)
    const themeColor = new THREE.Color(THEMES[id])
    const scene = new THREE.Scene()
    scene.name = `world-${id}`

    const bgColors: Record<WorldId, string> = {
      hub: '#5ba4e5',
      redteam: '#140606',
      blueteam: '#061324',
      grc: '#221520',
      research: '#020108',
    }
    const fogColors: Record<WorldId, string> = {
      hub: '#8ec4ec',
      redteam: '#2d0909',
      blueteam: '#0d2238',
      grc: '#38222b',
      research: '#080315',
    }
    const lightColors: Record<WorldId, string> = {
      hub: '#fffbf0',
      redteam: '#ff7043',
      blueteam: '#b2ebf2',
      grc: '#ffe082',
      research: '#d1c4e9',
    }
    const floorColors: Record<WorldId, string> = {
      hub: '#b2c2c5',
      redteam: '#181213',
      blueteam: '#162d42',
      grc: '#2c2227',
      research: '#110b1c',
    }
    const floorRoughness: Record<WorldId, number> = {
      hub: 0.85,
      redteam: 0.92,
      blueteam: 0.16,
      grc: 0.35,
      research: 0.38,
    }
    const floorMetalness: Record<WorldId, number> = {
      hub: 0.05,
      redteam: 0.25,
      blueteam: 0.45,
      grc: 0.3,
      research: 0.5,
    }

    scene.background = new THREE.Color(bgColors[id])
    scene.fog = new THREE.Fog(fogColors[id], id === 'research' ? 70 : 60, id === 'research' ? 210 : 180)
    scene.add(new THREE.HemisphereLight('#f2f7ff', id === 'hub' ? '#627065' : '#1b1d28', 1.3))
    const keyLight = new THREE.DirectionalLight(lightColors[id], 2.2)
    keyLight.position.copy(origin).add(new THREE.Vector3(18, 32, 12))
    keyLight.castShadow = true
    scene.add(keyLight, keyLight.target)

    const floorSize = FLOOR_SIZE.clone()
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: floorColors[id],
      roughness: floorRoughness[id],
      metalness: floorMetalness[id],
    })
    const floor = new THREE.Mesh(new THREE.BoxGeometry(floorSize.x, floorSize.y, floorSize.z), floorMaterial)
    floor.position.copy(origin).add(new THREE.Vector3(0, -floorSize.y / 2, 0))
    floor.name = `${id}-safe-floor`
    floor.receiveShadow = true
    scene.add(floor)
    this.physics.addStaticBox(floor.position, floorSize)

    const segment: WorldSegment = {
      id, scene, origin, spawn: origin.clone().add(new THREE.Vector3(0, 1.2, 0)),
      portals: [], stations: [], targets: [], themeColor,
      safeSceneDisclosureKey: WORLD_CATALOG[id].safeSceneDisclosureKey, floor,
    }
    this.addEnvironment(segment)
    for (const spec of portalSpecs(id)) {
      const portal = this.addPortal(segment, spec)
      segment.portals.push(portal)
      this.physics.addSensorSphere(portal.position, 1.5)
    }
    if (id === 'hub') segment.stations.push(...this.addStations(segment))
    else {
      const metadata = WORLD_CATALOG[id]
      for (let index = 0; index < TARGET_OFFSETS.length; index += 1) {
        const position = origin.clone().add(new THREE.Vector3(TARGET_OFFSETS[index].x, TARGET_OFFSETS[index].y, TARGET_OFFSETS[index].z))
        const target = this.addTarget(segment, id, index, position, metadata.challengeNameKeys[index], metadata.challengeDescriptionKeys[index])
        segment.targets.push(target)
        this.physics.addSensorSphere(target.position, 1.1)
      }
    }
    return segment
  }

  private addEnvironment(segment: WorldSegment): void {
    const { scene, id, origin, themeColor } = segment
    const accent = new THREE.MeshStandardMaterial({ color: themeColor, emissive: themeColor, emissiveIntensity: 0.3, metalness: 0.2, roughness: 0.45 })
    const pale = new THREE.MeshStandardMaterial({ color: id === 'hub' ? '#edf0ec' : '#303746', roughness: 0.72, metalness: 0.12 })
    const dark = new THREE.MeshStandardMaterial({ color: '#171d27', roughness: 0.7, metalness: 0.35 })
    const addBox = (name: string, size: [number, number, number], offset: [number, number, number], material: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material)
      mesh.name = name
      mesh.position.copy(origin).add(new THREE.Vector3(...offset))
      mesh.castShadow = true
      mesh.receiveShadow = true
      scene.add(mesh)
      return mesh
    }

    if (id === 'hub') {
      // A calm courtyard and clear radial paths: present-day campus, not a combat arena.
      const plaza = new THREE.Mesh(new THREE.CylinderGeometry(9.2, 9.2, 0.12, 48), new THREE.MeshStandardMaterial({ color: '#c5cfca', roughness: 0.9 }))
      plaza.name = 'hub-central-courtyard'
      plaza.position.copy(origin).add(new THREE.Vector3(0, 0.035, 0))
      plaza.receiveShadow = true
      scene.add(plaza)
      const landmark = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.22, 10, 48), accent)
      landmark.name = 'hub-learning-ring'
      landmark.position.copy(origin).add(new THREE.Vector3(0, 5.25, -23.4))
      scene.add(landmark)

      // Courtyard central fountain
      const fountainBase = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.8, 0.45, 32), pale)
      fountainBase.position.copy(origin).add(new THREE.Vector3(0, 0.22, 0))
      fountainBase.receiveShadow = true
      const fountainWater = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.46, 32), new THREE.MeshStandardMaterial({
        color: '#26c6da', roughness: 0.1, metalness: 0.8, emissive: '#00838f', emissiveIntensity: 0.35,
      }))
      fountainWater.position.copy(origin).add(new THREE.Vector3(0, 0.23, 0))
      const fountainTier2 = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.7, 24), pale)
      fountainTier2.position.copy(origin).add(new THREE.Vector3(0, 0.6, 0))
      const fountainSpire = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), accent)
      fountainSpire.position.copy(origin).add(new THREE.Vector3(0, 1.45, 0))
      scene.add(fountainBase, fountainWater, fountainTier2, fountainSpire)

      // 3D Holographic Earth Globe near profile kiosk
      const globeGroup = new THREE.Group()
      globeGroup.position.copy(origin).add(new THREE.Vector3(-7.2, 0, -5.5))
      const globePedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 0.8, 16), dark)
      globePedestal.position.y = 0.4
      const globeSphere = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 12), new THREE.MeshBasicMaterial({
        color: '#4fc3f7', wireframe: true, transparent: true, opacity: 0.75,
      }))
      globeSphere.position.y = 1.6
      const globeRing = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.025, 6, 32), new THREE.MeshBasicMaterial({
        color: '#81d4fa', transparent: true, opacity: 0.85,
      }))
      globeRing.position.y = 1.6
      globeRing.rotation.x = Math.PI * 0.38
      const sat = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.15), accent)
      sat.position.set(1.2, 1.6, 0)
      globeGroup.add(globePedestal, globeSphere, globeRing, sat)
      scene.add(globeGroup)

      // Park benches
      const benchMat = new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.85 })
      for (const [bx, bz, ry] of [[-6.5, 4, 0], [6.5, 4, 0], [-13, -1, Math.PI / 2], [13, -1, -Math.PI / 2]]) {
        const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.35, 0.7), benchMat)
        bench.position.copy(origin).add(new THREE.Vector3(bx, 0.35, bz))
        bench.rotation.y = ry
        bench.castShadow = true
        scene.add(bench)
      }

      // Campus trees
      for (const [tx, tz] of [[-18, 14], [18, 14], [-21, -16], [21, -16], [-19, 3], [19, 3]]) {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 2.8, 8), dark)
        trunk.position.copy(origin).add(new THREE.Vector3(tx, 1.4, tz))
        const leaves1 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1), new THREE.MeshStandardMaterial({ color: '#4caf50', roughness: 0.9 }))
        leaves1.position.copy(origin).add(new THREE.Vector3(tx, 3.2, tz))
        const leaves2 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), new THREE.MeshStandardMaterial({ color: '#81c784', roughness: 0.9 }))
        leaves2.position.copy(origin).add(new THREE.Vector3(tx, 4.4, tz))
        scene.add(trunk, leaves1, leaves2)
      }

      // Drifting clouds overhead
      for (const [cx, cy, cz, cs] of [[-25, 32, -10, 3.5], [15, 36, -20, 4.2], [0, 40, 20, 5], [-18, 35, 25, 3.8], [28, 38, 10, 4.5]]) {
        const cloud = new THREE.Mesh(new THREE.DodecahedronGeometry(cs, 1), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 }))
        cloud.position.copy(origin).add(new THREE.Vector3(cx, cy, cz))
        scene.add(cloud)
      }

      // A simple campus pavilion anchors the present-day hub without overpowering the portals.
      addBox('hub-campus-pavilion', [38, 7, 4], [0, 3.5, -26], pale)
      addBox('hub-campus-pavilion-roof', [40, 0.42, 5], [0, 7.2, -26], dark)
      for (const x of [-14, -10, -6, -2, 2, 6, 10, 14]) {
        addBox('hub-campus-window', [2.65, 2.6, 0.09], [x, 4.05, -23.94], dark)
        addBox('hub-campus-window-light', [0.09, 2.5, 0.04], [x, 4.05, -23.86], accent)
      }
      addBox('hub-campus-sign-band', [17, 0.48, 0.12], [0, 6.25, -23.88], accent)

      // Four approach lanes align with the color-coded doors, making every path legible from spawn.
      const gateXs = [-12, -4, 4, 12]
      const gateColors = ['#f15b64', '#42c8db', '#e9b34b', '#a989f5']
      const lane = new THREE.MeshStandardMaterial({ color: '#c4cfca', roughness: 0.94 })
      for (let i = 0; i < gateXs.length; i += 1) {
        const x = gateXs[i]
        addBox('hub-portal-walkway', [2.8, 0.045, 11.2], [x, 0.035, -14.7], lane)
        const color = new THREE.Color(gateColors[i])
        const guide = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.035, 11.2), new THREE.MeshStandardMaterial({
          color, emissive: color, emissiveIntensity: 0.38, roughness: 0.42, metalness: 0.14,
        }))
        guide.name = 'hub-portal-guide-light'
        guide.position.copy(origin).add(new THREE.Vector3(x, 0.085, -14.7))
        scene.add(guide)
      }

      for (const x of [-24, 24]) {
        for (const z of [-23, 23]) {
          const column = addBox('hub-courtyard-column', [1.2, 6, 1.2], [x, 3, z], pale)
          const cap = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 1.8), accent)
          cap.position.copy(column.position).add(new THREE.Vector3(0, 3.12, 0))
          scene.add(cap)
        }
      }
      for (const x of [-22, 22]) {
        const planter = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.9, 0.72, 14), pale)
        planter.name = 'hub-planter'
        planter.position.copy(origin).add(new THREE.Vector3(x, 0.36, -7))
        scene.add(planter)
        const foliage = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, 1), new THREE.MeshStandardMaterial({ color: '#668b72', roughness: 1 }))
        foliage.name = 'hub-tree-canopy'
        foliage.position.copy(planter.position).add(new THREE.Vector3(0, 1.3, 0))
        scene.add(foliage)
      }
      return
    }

    if (id === 'redteam') {
      // Glowing lava fissures across the floor
      const lavaMat = new THREE.MeshStandardMaterial({ color: '#ff3d00', emissive: '#ff5722', emissiveIntensity: 2.5, roughness: 0.25 })
      for (const [lx, lz, sx, sz] of [[0, 0, 42, 1.8], [-12, 8, 2.2, 24], [12, -8, 2.2, 24], [-6, -14, 22, 1.6], [8, 14, 22, 1.6]]) {
        const lavaStrip = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.06, sz), lavaMat)
        lavaStrip.position.copy(origin).add(new THREE.Vector3(lx, 0.02, lz))
        scene.add(lavaStrip)
      }
      // Hexagonal basalt rock pillars
      for (const [px, pz, ph] of [[-24, -10, 6], [24, -10, 5], [-24, 12, 7.5], [24, 12, 6.5], [-18, -24, 4.5], [18, -24, 5.2], [0, -25, 7]]) {
        const basalt = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, ph, 6), dark)
        basalt.position.copy(origin).add(new THREE.Vector3(px, ph / 2, pz))
        basalt.castShadow = true
        scene.add(basalt)
      }
      // Floating rock chunks hovering over the arena
      for (const [rx, ry, rz, rs] of [[-8, 4.5, -6, 1.4], [8, 5.2, -6, 1.6], [0, 6, 8, 2], [-14, 4.2, 14, 1.3], [14, 4.8, 14, 1.5]]) {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rs, 0), dark)
        rock.position.copy(origin).add(new THREE.Vector3(rx, ry, rz))
        rock.rotation.set(rx, ry, rz)
        scene.add(rock)
      }
      // 3 Thermal Bounce Vents (Lava Geysers)
      for (const vent of BOUNCE_VENTS) {
        const ventRim = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.28, 8, 24), dark)
        ventRim.rotation.x = Math.PI / 2
        ventRim.position.copy(origin).add(new THREE.Vector3(vent.x, 0.1, vent.z))
        const ventCore = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.14, 18), new THREE.MeshStandardMaterial({
          color: '#ff1744', emissive: '#ff3d00', emissiveIntensity: 3.2, roughness: 0.1,
        }))
        ventCore.position.copy(origin).add(new THREE.Vector3(vent.x, 0.08, vent.z))
        const ventCone = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.8, 12), new THREE.MeshBasicMaterial({
          color: '#ff9100', transparent: true, opacity: 0.5,
        }))
        ventCone.position.copy(origin).add(new THREE.Vector3(vent.x, 0.9, vent.z))
        scene.add(ventRim, ventCore, ventCone)
      }

      // Mock-service racks and isolated training lanes; all markers are fictional geometry.
      for (const x of [-21, -14, -7, 7, 14, 21]) {
        addBox('redteam-mock-service-rack', [3.1, 5.4, 1.7], [x, 2.7, -23], dark)
        for (let row = 0; row < 4; row += 1) addBox('redteam-rack-status-light', [1.75, 0.08, 0.08], [x, 1.1 + row * 0.85, -22.1], accent)
      }
      for (const x of [-16, 16]) addBox('redteam-segment-wall', [0.38, 3.6, 16], [x, 1.8, 0], pale)
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.24, 10, 48), accent)
      ring.name = 'redteam-recon-ring'
      ring.position.copy(origin).add(new THREE.Vector3(0, 6, -12))
      ring.rotation.x = Math.PI / 2
      scene.add(ring)
      return
    }

    if (id === 'blueteam') {
      // Aurora Borealis Arches overhead
      const auroraMat = new THREE.MeshBasicMaterial({ color: '#40c4ff', transparent: true, opacity: 0.45, side: THREE.DoubleSide })
      const arch1 = new THREE.Mesh(new THREE.TorusGeometry(32, 0.6, 6, 48, Math.PI * 0.8), auroraMat)
      arch1.position.copy(origin).add(new THREE.Vector3(0, 18, -10))
      arch1.rotation.set(0.6, 0.2, 0.3)
      const arch2 = new THREE.Mesh(new THREE.TorusGeometry(28, 0.5, 6, 48, Math.PI * 0.8), auroraMat)
      arch2.position.copy(origin).add(new THREE.Vector3(0, 22, 10))
      arch2.rotation.set(-0.5, -0.3, -0.4)
      scene.add(arch1, arch2)

      // Crystalline ice spires and quartz prisms
      const iceMat = new THREE.MeshStandardMaterial({
        color: '#b2ebf2', emissive: '#00bcd4', emissiveIntensity: 0.35, roughness: 0.12, metalness: 0.6, transparent: true, opacity: 0.8,
      })
      for (const [ix, iz, ih] of [[-22, -10, 9], [22, -10, 8], [-22, 12, 10], [22, 12, 8.5], [-12, -22, 7], [12, -22, 7.5], [0, 24, 9]]) {
        const spire = new THREE.Mesh(new THREE.ConeGeometry(1.8, ih, 5), iceMat)
        spire.position.copy(origin).add(new THREE.Vector3(ix, ih / 2, iz))
        spire.rotation.y = (ix + iz) * 0.5
        spire.castShadow = true
        scene.add(spire)
      }
      // Floating cryo-data crystal shards
      for (const [fx, fy, fz] of [[-12, 3.5, 4], [12, 3.5, 4], [0, 4.2, -6], [-6, 3, 16], [6, 3, 16]]) {
        const cryo = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), accent)
        cryo.position.copy(origin).add(new THREE.Vector3(fx, fy, fz))
        scene.add(cryo)
      }
      // Holographic hexagonal forcefield shields
      const shieldMat = new THREE.MeshBasicMaterial({ color: '#00e5ff', wireframe: true, transparent: true, opacity: 0.35 })
      for (const [sx, sz] of [[-14, -14], [14, -14], [0, 16]]) {
        const shield = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 3.2, 6, 1, true), shieldMat)
        shield.position.copy(origin).add(new THREE.Vector3(sx, 1.6, sz))
        scene.add(shield)
      }

      // A bright monitoring room with distinct consoles and monitor silhouettes.
      for (const x of [-9, 0, 9]) {
        addBox('blueteam-monitor-console', [5.2, 1.1, 1.8], [x, 0.55, -16], dark)
        for (let screen = 0; screen < 2; screen += 1) {
          const panel = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.45, 0.13), accent)
          panel.name = 'blueteam-alert-monitor'
          panel.position.copy(origin).add(new THREE.Vector3(x - 1.1 + screen * 2.2, 1.9, -16.65))
          panel.castShadow = true
          scene.add(panel)
        }
      }
      for (const x of [-22, 22]) addBox('blueteam-soc-pillar', [1.2, 7, 1.2], [x, 3.5, -13], pale)
      const signal = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.18, 8, 48), accent)
      signal.name = 'blueteam-signal-arc'
      signal.position.copy(origin).add(new THREE.Vector3(0, 7, 10))
      signal.rotation.x = Math.PI / 2
      scene.add(signal)
      return
    }

    if (id === 'grc') {
      // Polished marble with gold trim strips
      const goldTrim = new THREE.MeshStandardMaterial({ color: '#ffd54f', emissive: '#ffb300', emissiveIntensity: 0.85, metalness: 0.85, roughness: 0.2 })
      for (const [gx, gz, sx, sz] of [[0, 0, 36, 0.12], [-14, 0, 0.12, 36], [14, 0, 0.12, 36], [0, -14, 36, 0.12], [0, 14, 36, 0.12]]) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.06, sz), goldTrim)
        strip.position.copy(origin).add(new THREE.Vector3(gx, 0.02, gz))
        scene.add(strip)
      }
      // Levitating golden obelisks
      for (const [ox, oz, oy] of [[-22, -12, 4], [22, -12, 4.5], [-22, 14, 5], [22, 14, 4.2], [0, -24, 5.5], [0, 24, 5]]) {
        const obelisk = new THREE.Mesh(new THREE.BoxGeometry(1.3, 6, 1.3), pale)
        obelisk.position.copy(origin).add(new THREE.Vector3(ox, oy, oz))
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.4, 4), goldTrim)
        cap.position.copy(origin).add(new THREE.Vector3(ox, oy + 3.7, oz))
        cap.rotation.y = Math.PI / 4
        scene.add(obelisk, cap)
      }
      // 3 Golden Chevron Speed Boost Pads
      for (const pad of SPEED_PADS) {
        const boostPad = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 3.2), dark)
        boostPad.position.copy(origin).add(new THREE.Vector3(pad.x, 0.03, pad.z))
        for (let c = 0; c < 3; c += 1) {
          const chevron = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.8, 3), goldTrim)
          chevron.rotation.x = -Math.PI / 2
          chevron.position.copy(origin).add(new THREE.Vector3(pad.x, 0.08, pad.z - 0.8 + c * 0.8))
          scene.add(chevron)
        }
        scene.add(boostPad)
      }

      // Repeated evidence shelves and audit plinths form an orderly compliance archive.
      for (const x of [-21, -14, 14, 21]) {
        addBox('grc-evidence-archive', [4.2, 5.8, 1.4], [x, 2.9, -18], pale)
        for (let row = 0; row < 5; row += 1) addBox('grc-record-spine', [2.8, 0.12, 0.08], [x, 0.9 + row * 0.92, -17.2], accent)
      }
      for (const x of [-9, 0, 9]) {
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.3, 3.2), dark)
        plinth.name = 'grc-control-plinth'
        plinth.position.copy(origin).add(new THREE.Vector3(x, 0.65, 9))
        scene.add(plinth)
        const seal = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.12, 8, 24), accent)
        seal.name = 'grc-evidence-seal'
        seal.position.copy(plinth.position).add(new THREE.Vector3(0, 1, 0))
        scene.add(seal)
      }
      return
    }

    // Research observatory: orbital signal rings, starfield, planet and asteroid belt.
    const starCount = 500
    const starGeo = new THREE.BufferGeometry()
    const starPositions = new Float32Array(starCount * 3)
    for (let s = 0; s < starCount; s += 1) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(Math.random() * 2 - 1)
      const r = 70 + Math.random() * 50
      starPositions[s * 3] = origin.x + r * Math.sin(phi) * Math.cos(theta)
      starPositions[s * 3 + 1] = origin.y + r * Math.sin(phi) * Math.sin(theta)
      starPositions[s * 3 + 2] = origin.z + r * Math.cos(phi)
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
    const starMat = new THREE.PointsMaterial({ color: '#ffffff', size: 0.9, transparent: true, opacity: 0.85 })
    const stars = new THREE.Points(starGeo, starMat)
    scene.add(stars)

    // Celestial ringed planet
    const planet = new THREE.Mesh(new THREE.SphereGeometry(14, 24, 24), new THREE.MeshStandardMaterial({
      color: '#3949ab', emissive: '#1a237e', emissiveIntensity: 0.4, roughness: 0.7,
    }))
    planet.position.copy(origin).add(new THREE.Vector3(65, 42, -90))
    const planetRing = new THREE.Mesh(new THREE.RingGeometry(18, 28, 48), new THREE.MeshBasicMaterial({
      color: '#7986cb', side: THREE.DoubleSide, transparent: true, opacity: 0.7,
    }))
    planetRing.position.copy(planet.position)
    planetRing.rotation.set(1.1, 0.4, 0.2)
    scene.add(planet, planetRing)

    // Floating asteroid belt rocks
    for (let a = 0; a < 16; a += 1) {
      const ang = (a / 16) * Math.PI * 2
      const dist = 32 + (a % 3) * 6
      const ax = Math.cos(ang) * dist
      const az = Math.sin(ang) * dist
      const ay = -2 + (a % 5) * 3
      const asteroid = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2 + (a % 3) * 0.6, 0), dark)
      asteroid.position.copy(origin).add(new THREE.Vector3(ax, ay, az))
      asteroid.rotation.set(a * 0.7, a * 1.1, a * 0.3)
      scene.add(asteroid)
    }

    for (let i = 0; i < 3; i += 1) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(5.2 + i * 1.5, 0.13, 8, 56), accent)
      ring.name = 'research-signal-orbit'
      ring.position.copy(origin).add(new THREE.Vector3(0, 5 + i * 0.6, -17))
      ring.rotation.set(0.4 + i * 0.25, 0.2 * i, 0.55 * i)
      scene.add(ring)
    }
    for (const [x, y, z] of [[-10, 2.3, -14], [10, 3.1, -18], [0, 6.7, -12], [-6, 4.5, -22], [7, 2, -25]]) {
      const node = new THREE.Mesh(new THREE.IcosahedronGeometry(0.64, 1), accent)
      node.name = 'research-synthetic-signal-node'
      node.position.copy(origin).add(new THREE.Vector3(x, y, z))
      scene.add(node)
    }
  }

  private addStations(segment: WorldSegment): PortfolioStation[] {
    const colors = ['#69c7d3', '#36d8c7', '#f15b64', '#a989f5', '#e9b34b']
    return STATION_IDS.map((id, index) => {
      const color = new THREE.Color(colors[index])
      const object = new THREE.Group()
      object.name = `portfolio-${id}`
      object.userData.portfolioStation = id
      object.position.copy(segment.origin).add(new THREE.Vector3((index - 2) * 3.6, 0, -5.5))
      const stone = new THREE.MeshStandardMaterial({ color: '#e5e9eb', roughness: 0.72, metalness: 0.08 })
      const accent = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.28, roughness: 0.38, metalness: 0.25 })
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.18, 0.42, 16), stone)
      base.position.y = 0.21
      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.62, 0.72, 12), accent)
      pedestal.position.y = 0.78
      const display = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.8, 0.18), stone)
      display.position.set(0, 1.48, -0.12)
      display.rotation.x = -0.12
      const sigil = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.075, 8, 20), accent)
      sigil.position.set(0, 1.52, -0.015)
      object.add(base, pedestal, display, sigil)
      object.traverse(child => { if (child instanceof THREE.Mesh) child.castShadow = true })
      segment.scene.add(object)
      return { id, position: object.position.clone().add(new THREE.Vector3(0, 1.2, 0)), object }
    })
  }

  private addPortal(segment: WorldSegment, spec: PortalSpec): Portal {
    const position = segment.origin.clone().add(new THREE.Vector3(spec.offset.x, spec.offset.y, spec.offset.z))
    const color = new THREE.Color(spec.color ?? THEMES[spec.destination])
    const object = new THREE.Group()
    object.name = `portal-${spec.id}`
    object.position.copy(position)
    object.rotation.y = spec.yaw ?? 0
    const frame = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.65, metalness: 0.32, roughness: 0.35 })
    const pane = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
    const dark = new THREE.MeshStandardMaterial({ color: '#171d27', roughness: 0.7, metalness: 0.35 })
    const postGeometry = new THREE.BoxGeometry(0.32, 3.3, 0.34)
    const left = new THREE.Mesh(postGeometry, frame); left.position.set(-1.25, 0, 0)
    const right = new THREE.Mesh(postGeometry, frame); right.position.set(1.25, 0, 0)
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.82, 0.34, 0.34), frame); lintel.position.y = 1.48
    const threshold = new THREE.Mesh(new THREE.BoxGeometry(2.82, 0.22, 0.48), frame); threshold.position.y = -1.58
    const veil = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.85), pane); veil.position.y = -0.02
    const portalBase = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.2, 0.12, 24), dark)
    portalBase.name = `portal-${spec.id}-base`
    portalBase.position.y = -1.58
    const baseHalo = new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.055, 6, 32), frame)
    baseHalo.name = `portal-${spec.id}-halo`
    baseHalo.rotation.x = Math.PI / 2
    baseHalo.position.y = -1.48
    const emblemGeometry = spec.destination === 'redteam'
      ? new THREE.TorusKnotGeometry(0.28, 0.085, 48, 7, 2, 3)
      : spec.destination === 'blueteam'
        ? new THREE.IcosahedronGeometry(0.4, 1)
        : spec.destination === 'grc'
          ? new THREE.OctahedronGeometry(0.43, 0)
          : new THREE.TorusGeometry(0.38, 0.12, 8, 24)
    const emblem = new THREE.Mesh(emblemGeometry, frame)
    emblem.name = `portal-${spec.id}-emblem`
    emblem.position.y = 2.12
    object.add(left, right, lintel, threshold, veil, portalBase, baseHalo, emblem)
    object.traverse(child => { if (child instanceof THREE.Mesh) child.castShadow = true })
    segment.scene.add(object)
    return {
      id: spec.id, worldId: segment.id, destination: spec.destination, position,
      exitPosition: getWorldOffset(spec.destination).add(new THREE.Vector3(0, 1.2, 0)), object, available: true,
    }
  }

  private addTarget(segment: WorldSegment, worldId: CareerWorldId, index: number, position: THREE.Vector3, titleKey: string, descriptionKey: string): ChallengeTarget {
    const object = new THREE.Group()
    object.name = `challenge-${worldId}-${index + 1}`
    object.position.copy(position)
    object.userData.challengeTarget = true
    object.userData.challengeId = `${worldId}-challenge-${index + 1}`
    object.userData.titleKey = titleKey
    object.userData.descriptionKey = descriptionKey
    const baseMaterial = new THREE.MeshStandardMaterial({ color: '#3b4652', metalness: 0.26, roughness: 0.68 })
    const glowMaterial = new THREE.MeshStandardMaterial({ color: segment.themeColor, emissive: segment.themeColor, emissiveIntensity: 0.25, metalness: 0.18, roughness: 0.48 })
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.82, 0.44, 12), baseMaterial)
    base.name = `target-base-${worldId}`
    base.position.y = -0.8
    object.add(base)
    if (worldId === 'redteam') {
      const service = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.05, 0.55), glowMaterial)
      service.name = 'mock-service-target'
      service.position.y = 0.22
      const status = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: '#f7d67a' }))
      status.position.set(0, 0.35, -0.3)
      object.add(service, status)
    } else if (worldId === 'blueteam') {
      const alert = new THREE.Mesh(new THREE.OctahedronGeometry(0.62, 0), glowMaterial)
      alert.name = 'synthetic-alert-target'
      alert.position.y = 0.72
      alert.rotation.set(0.2, index * 0.7, 0.28)
      object.add(alert)
    } else if (worldId === 'grc') {
      const record = new THREE.Mesh(new THREE.CylinderGeometry(0.53, 0.53, 0.7, 8), glowMaterial)
      record.name = 'evidence-record-target'
      record.position.y = 0.2
      const seal = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.075, 8, 16), new THREE.MeshStandardMaterial({ color: '#fff0b4', emissive: '#e9b34b', emissiveIntensity: 0.55 }))
      seal.position.y = 0.7
      object.add(record, seal)
    } else {
      const signal = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.16, 8, 18), glowMaterial)
      signal.name = 'research-signal-target'
      signal.position.y = 0.55
      signal.rotation.x = Math.PI / 2
      const node = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 1), glowMaterial)
      node.position.y = 0.55
      object.add(signal, node)
    }
    object.traverse(child => { if (child instanceof THREE.Mesh) child.castShadow = true })
    segment.scene.add(object)
    return { id: `${worldId}-challenge-${index + 1}`, worldId, titleKey, descriptionKey, position, object, completed: false, highlightUntil: 0 }
  }

  private setTargetEmissive(target: ChallengeTarget, color: THREE.Color, intensity: number): void {
    target.object.traverse(child => {
      const mesh = child as THREE.Mesh
      const material = mesh.material
      for (const item of Array.isArray(material) ? material : material ? [material] : []) {
        if (item instanceof THREE.MeshStandardMaterial && item.emissive) {
          item.emissive.copy(color)
          item.emissiveIntensity = intensity
        }
      }
    })
  }
}

type PortalSpec = { id: string; destination: WorldId; offset: VectorLike; yaw?: number; color?: string }

function portalSpecs(worldId: WorldId): PortalSpec[] {
  if (worldId === 'hub') {
    return [
      { id: 'hub-to-redteam', destination: 'redteam', offset: { x: -12, y: 1.65, z: -20.5 }, color: THEMES.redteam },
      { id: 'hub-to-blueteam', destination: 'blueteam', offset: { x: -4, y: 1.65, z: -20.5 }, color: THEMES.blueteam },
      { id: 'hub-to-grc', destination: 'grc', offset: { x: 4, y: 1.65, z: -20.5 }, color: THEMES.grc },
      { id: 'hub-to-research', destination: 'research', offset: { x: 12, y: 1.65, z: -20.5 }, color: THEMES.research },
    ]
  }
  const returnOffsets: Readonly<Record<CareerWorldId, VectorLike>> = {
    redteam: { x: 0, y: 1.65, z: 19 }, blueteam: { x: 0, y: 1.65, z: -19 },
    grc: { x: -19, y: 1.65, z: 0 }, research: { x: 19, y: 1.65, z: 0 },
  }
  return [{ id: `${worldId}-to-hub`, destination: 'hub', offset: returnOffsets[worldId], color: THEMES[worldId] }]
}
