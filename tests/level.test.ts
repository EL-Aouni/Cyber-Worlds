import { describe, expect, it, vi } from 'vitest'
import manifest from '../assets.lock.json'
import { Worlds } from '../src/game/worlds'

const makePhysics = () => ({ addStaticBox: vi.fn(), addSensorSphere: vi.fn() })

describe('Cyber Worlds hub and registered assets', () => {
  it('places all five source-grounded portfolio kiosks in the present-day hub', () => {
    const worlds = new Worlds(makePhysics())
    const hub = worlds.getSegment('hub')
    expect(hub.stations.map(station => station.id).sort()).toEqual(['contact', 'profile', 'redteam', 'research', 'soc'])
    expect(new Set(hub.stations.map(station => station.position.toArray().join(','))).size).toBe(hub.stations.length)
    for (const station of hub.stations) {
      expect(station.object.name).toBe(`portfolio-${station.id}`)
      expect(station.object.parent).toBe(hub.scene)
      expect(worlds.findNearestStation('hub', station.position, 0)).toBe(station)
      expect(worlds.findNearestStation('redteam', station.position, 1000)).toBeUndefined()
    }
  })

  it('registers the verified CC0 casual human as the explorer and distinct share assets', () => {
    const groups = manifest.groups as Record<string, { name: string; order: number }>
    const assets = manifest.assets as Record<string, { path: string; sha256: string; size: number; assetType: string; groupId: string }>
    const avatar = assets['assets/models/quaternius/Individual Characters__glTF__Casual_Hoodie.gltf']
    expect(avatar).toBeDefined()
    expect(avatar.path).toMatch(/^\/manus-storage\/game\/sha256\/[a-f0-9]+\.gltf$/)
    expect(avatar.sha256).toMatch(/^sha256:[a-f0-9]+$/)
    expect(avatar.assetType).toBe('model')
    expect(avatar.groupId).toBe('player-character')
    expect(groups['player-character']).toEqual({ name: 'Explorer Character', order: 15 })

    const og = assets['assets/share/cyberworlds-og.png']
    const favicon = assets['assets/share/cyberworlds-favicon.png']
    for (const asset of [og, favicon]) {
      expect(asset).toBeDefined()
      expect(asset.path).toMatch(/^\/manus-storage\/game\/sha256\/[a-f0-9]+\.png$/)
      expect(asset.sha256).toMatch(/^sha256:[a-f0-9]+$/)
      expect(asset.assetType).toBe('image')
      expect(asset.groupId).toBe('share')
      expect(asset.size).toBeGreaterThan(0)
      expect(asset.size).toBeLessThan(8 * 1024 * 1024)
    }
    expect(groups.share?.name).toBe('Share')
    // The original CC0 car/tower stay credited and registered as historical prototype assets,
    // but no active Cyber Worlds loader refers to them.
    expect(assets['assets/models/cyber-ops-sports-car.glb']?.groupId).toBe('vehicle')
    expect(assets['assets/models/cyber-ops-skyscraper.glb']?.groupId).toBe('world-environment')
  })
})
