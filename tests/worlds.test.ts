import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import {
  CareerWorldId,
  getWorldOffset,
  isWithinRadius,
  nearestWithinRadius,
  WORLD_CATALOG,
  WorldId,
  Worlds,
} from '../src/game/worlds'

const WORLD_IDS: WorldId[] = ['hub', 'redteam', 'blueteam', 'grc', 'research']
const CAREER_IDS: CareerWorldId[] = ['redteam', 'blueteam', 'grc', 'research']

function makePhysics() {
  return {
    addStaticBox: vi.fn(),
    addSensorSphere: vi.fn(),
  }
}

describe('Cyber Worlds scenes and interactions', () => {
  it('builds five separate scenes with safe floors, offset spawns and exactly three career targets', () => {
    const physics = makePhysics()
    const worlds = new Worlds(physics)
    const segments = WORLD_IDS.map(id => worlds.getSegment(id))

    expect(segments.map(segment => segment.id)).toEqual(WORLD_IDS)
    expect(new Set(segments.map(segment => segment.scene)).size).toBe(WORLD_IDS.length)
    expect(physics.addStaticBox).toHaveBeenCalledTimes(WORLD_IDS.length)
    expect(physics.addSensorSphere).toHaveBeenCalledTimes(20)
    for (const segment of segments) {
      expect(segment.floor.name).toBe(`${segment.id}-safe-floor`)
      expect(segment.spawn.toArray()).toEqual(getWorldOffset(segment.id).add(new THREE.Vector3(0, 1.2, 0)).toArray())
      expect(segment.floor.position.x).toBe(segment.origin.x)
      expect(segment.floor.position.z).toBe(segment.origin.z)
      expect(segment.targets).toHaveLength(segment.id === 'hub' ? 0 : 3)
      for (const target of segment.targets) {
        expect(target.position.distanceTo(segment.origin)).toBeGreaterThan(0)
        expect(target.object.position.toArray()).toEqual(target.position.toArray())
        expect(target.object.parent).toBe(segment.scene)
        expect(target.id).toMatch(new RegExp(`^${segment.id}-challenge-[1-3]$`))
      }
    }
    for (let i = 0; i < segments.length; i += 1) {
      for (let j = i + 1; j < segments.length; j += 1) {
        expect(segments[i].origin.distanceTo(segments[j].origin)).toBeGreaterThanOrEqual(100)
      }
    }
  })

  it('keeps portal destinations unique and provides hub access and return portals', () => {
    const worlds = new Worlds(makePhysics())
    const hub = worlds.getSegment('hub')
    expect(hub.portals).toHaveLength(4)
    expect(new Set(hub.portals.map(portal => portal.destination)).size).toBe(4)
    expect(hub.portals.map(portal => portal.destination).sort()).toEqual([...CAREER_IDS].sort())
    expect(hub.portals.every(portal => portal.position.z < 0)).toBe(true)
    expect(hub.portals.map(portal => portal.position.x).sort((a, b) => a - b)).toEqual([-12, -4, 4, 12])
    expect(hub.stations).toHaveLength(5)
    expect(hub.stations.every(station => station.position.z < 0 && Math.abs(station.position.z) < 7)).toBe(true)
    for (const id of CAREER_IDS) {
      const portals = worlds.getSegment(id).portals
      expect(portals).toHaveLength(1)
      expect(portals[0].destination).toBe('hub')
      expect(portals[0].worldId).toBe(id)
      expect(portals[0].object.position.toArray()).toEqual(portals[0].position.toArray())
    }
    for (const portal of hub.portals) {
      expect(portal.worldId).toBe('hub')
      expect(portal.object.position.toArray()).toEqual(portal.position.toArray())
    }
  })

  it('uses a complete localized-key catalog that discloses offline fictional practice only', () => {
    expect(Object.keys(WORLD_CATALOG).sort()).toEqual([...WORLD_IDS].sort())
    for (const id of WORLD_IDS) {
      const metadata = WORLD_CATALOG[id]
      expect(metadata.nameKey).toMatch(/^worlds\..+\.name$/)
      expect(metadata.powerDescriptionKey).toMatch(/^worlds\..+\.power\.description$/)
      expect(metadata.safeSceneDisclosureKey).toBe('worlds.safeScene.disclosure')
      expect(metadata.fictionalOnly).toBe(true)
      expect(metadata.networked).toBe(false)
      if (id === 'hub') {
        expect(metadata.careerPathLabelKey).toBeNull()
        expect(metadata.challengeNameKeys).toHaveLength(0)
        expect(metadata.challengeDescriptionKeys).toHaveLength(0)
      } else {
        expect(metadata.careerPathLabelKey).toMatch(/^worlds\..+\.careerPath$/)
        expect(metadata.challengeNameKeys).toHaveLength(3)
        expect(metadata.challengeDescriptionKeys).toHaveLength(3)
        expect(metadata.challengeNameKeys.every(key => key.startsWith(`worlds.${id}.`))).toBe(true)
        expect(metadata.challengeDescriptionKeys.every(key => key.startsWith(`worlds.${id}.`))).toBe(true)
      }
    }
    expect(new Set(CAREER_IDS.map(id => getWorldOffset(id).toArray().join(','))).size).toBe(4)
  })

  it('selects the nearest available portal or incomplete target only within the requested radius', () => {
    const worlds = new Worlds(makePhysics())
    const red = worlds.getSegment('redteam')
    const target = red.targets[0]
    const near = target.position.clone().add(new THREE.Vector3(0.2, 0, 0))
    expect(worlds.findNearestTarget('redteam', near, 0.5)).toBe(target)
    expect(worlds.findNearestTarget('redteam', near, 0.19)).toBeUndefined()
    expect(worlds.findNearestTarget('hub', near, 100)).toBeUndefined()

    const portal = red.portals[0]
    expect(worlds.findNearestPortal('redteam', portal.position, 0)).toBe(portal)
    expect(worlds.findNearestPortal('redteam', portal.position.clone().add(new THREE.Vector3(0, 2, 0)), 1.99)).toBeUndefined()
    portal.available = false
    expect(worlds.findNearestPortal('redteam', portal.position, 2)).toBeUndefined()

    const candidates = [
      { position: new THREE.Vector3(3, 0, 0), id: 'far' },
      { position: new THREE.Vector3(1, 0, 0), id: 'near' },
    ]
    expect(nearestWithinRadius(candidates, new THREE.Vector3(), 2)?.id).toBe('near')
    expect(isWithinRadius(new THREE.Vector3(3, 4, 0), new THREE.Vector3(), 5)).toBe(true)
    expect(isWithinRadius(new THREE.Vector3(3, 4, 0), new THREE.Vector3(), 4.99)).toBe(false)
    expect(isWithinRadius(new THREE.Vector3(), new THREE.Vector3(), -1)).toBe(false)
  })

  it('completes targets idempotently without leaking state between career worlds', () => {
    const worlds = new Worlds(makePhysics())
    const red = worlds.getSegment('redteam')
    const blue = worlds.getSegment('blueteam')
    const redTarget = red.targets[0]
    const blueTarget = blue.targets[0]

    expect(worlds.markTargetComplete('redteam', redTarget.id)).toBe(true)
    expect(worlds.markTargetComplete('redteam', redTarget.id)).toBe(false)
    expect(worlds.markTargetComplete('redteam', 'not-a-target')).toBe(false)
    expect(worlds.markTargetComplete('hub', redTarget.id)).toBe(false)
    expect(redTarget.completed).toBe(true)
    expect(blueTarget.completed).toBe(false)
    expect(red.scene).not.toBe(blue.scene)
    expect(worlds.findNearestTarget('redteam', redTarget.position, 0)).toBeUndefined()
    expect(worlds.findNearestTarget('blueteam', blueTarget.position, 0)).toBe(blueTarget)
  })

  it('activates a short theme-colored highlight and restores it after expiry', () => {
    const worlds = new Worlds(makePhysics())
    const target = worlds.getSegment('grc').targets[0]
    expect(worlds.activateTargetHighlight('grc', target.id, 500, 1000)).toBe(true)
    expect(target.highlightUntil).toBe(1500)
    expect(target.object.userData.highlighted).toBe(true)
    worlds.update(1499)
    expect(target.object.userData.highlighted).toBe(true)
    worlds.update(1500)
    expect(target.highlightUntil).toBe(0)
    expect(target.object.userData.highlighted).toBe(false)
    expect(worlds.markTargetComplete('grc', target.id)).toBe(true)
    expect(worlds.activateTargetHighlight('grc', target.id)).toBe(false)
  })
})
