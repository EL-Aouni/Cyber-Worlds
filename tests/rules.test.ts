import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { getWorldOffset, WORLD_CATALOG, type CareerWorldId, Worlds } from '../src/game/worlds'

const CAREERS: readonly CareerWorldId[] = ['redteam', 'blueteam', 'grc', 'research']
const makePhysics = () => ({ addStaticBox: vi.fn(), addSensorSphere: vi.fn() })

describe('future career practice rules', () => {
  it('keeps every career world fictional, offline and separate from the current-work hub', () => {
    for (const id of CAREERS) {
      const metadata = WORLD_CATALOG[id]
      expect(metadata.fictionalOnly).toBe(true)
      expect(metadata.networked).toBe(false)
      expect(metadata.careerPathLabelKey).toMatch(/^worlds\..+\.careerPath$/)
      expect(metadata.challengeNameKeys).toHaveLength(3)
      expect(metadata.challengeDescriptionKeys).toHaveLength(3)
      expect(new Set(metadata.challengeNameKeys).size).toBe(3)
      expect(metadata.challengeNameKeys.every(key => key.startsWith(`worlds.${id}.`))).toBe(true)
      expect(getWorldOffset(id).distanceTo(getWorldOffset('hub'))).toBeGreaterThanOrEqual(100)
    }
    expect(WORLD_CATALOG.hub.careerPathLabelKey).toBeNull()
    expect(WORLD_CATALOG.hub.challengeNameKeys).toHaveLength(0)
  })

  it('keeps challenge completion local, idempotent and isolated between career worlds', () => {
    const worlds = new Worlds(makePhysics())
    for (const career of CAREERS) {
      const segment = worlds.getSegment(career)
      expect(segment.targets).toHaveLength(3)
      const first = segment.targets[0]
      expect(worlds.markTargetComplete(career, first.id)).toBe(true)
      expect(worlds.markTargetComplete(career, first.id)).toBe(false)
      expect(worlds.findNearestTarget(career, first.position, 0)).toBeUndefined()
      expect(worlds.findNearestTarget(career, segment.targets[1].position, 0)).toBe(segment.targets[1])
      expect(worlds.markTargetComplete(career, 'not-a-local-target')).toBe(false)
      expect(worlds.getSegment(career).targets.filter(target => target.completed)).toHaveLength(1)
      expect(worlds.getSegment('hub').targets).toHaveLength(0)
    }
  })

  it('makes each world power highlight only its own nearby scenario cues for a bounded time', () => {
    const worlds = new Worlds(makePhysics())
    for (const career of CAREERS) {
      const segment = worlds.getSegment(career)
      const target = segment.targets[0]
      expect(worlds.activateTargetHighlight(career, target.id, 500, 1000)).toBe(true)
      expect(target.highlightUntil).toBe(1500)
      expect(target.object.userData.highlighted).toBe(true)
      worlds.update(1499)
      expect(target.object.userData.highlighted).toBe(true)
      worlds.update(1500)
      expect(target.highlightUntil).toBe(0)
      expect(target.object.userData.highlighted).toBe(false)
    }
    expect(worlds.activateTargetHighlight('hub', 'none')).toBe(false)
    expect(worlds.activateTargetHighlight('research', 'not-a-local-target')).toBe(false)
    const grcTarget = worlds.getSegment('grc').targets[1]
    expect(worlds.activateTargetHighlight('grc', grcTarget.id, 100_000, 1000)).toBe(true)
    expect(grcTarget.highlightUntil).toBe(11_000)
    expect(worlds.getSegment('research').targets[1].highlightUntil).toBe(0)
  })

  it('does not treat the local world geometry as a real external target or service', () => {
    const worlds = new Worlds(makePhysics())
    for (const career of CAREERS) {
      const segment = worlds.getSegment(career)
      expect(segment.scene.name).toBe(`world-${career}`)
      expect(segment.portals).toHaveLength(1)
      expect(segment.portals[0].destination).toBe('hub')
      expect(segment.portals[0].available).toBe(true)
      expect(segment.targets.every(target => target.object.userData.challengeTarget === true)).toBe(true)
    }
    expect(CAREERS.map(id => getWorldOffset(id).toArray().join(',')).filter(Boolean)).toHaveLength(4)
    expect(new THREE.Vector3().distanceTo(getWorldOffset('redteam'))).toBe(180)
  })
})
