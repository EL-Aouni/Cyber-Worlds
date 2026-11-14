import { afterEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { initPhysics, Physics } from '../src/engine/physics'
import { FollowCamera } from '../src/game/camera'
import { CONFIG, DEFAULT_CONFIG } from '../src/game/config'
import { Player } from '../src/game/player'
import { tuning } from '../src/game/tuning'

const defaults = Object.fromEntries(tuning.controls.map(control => [control.id, control.default]))
afterEach(() => {
  tuning.apply(defaults)
  tuning.activate('jump')
  tuning.activate('dash')
})

function makePlayer(physics: Physics): Player {
  physics.addStaticBox(new THREE.Vector3(0, -0.42, 0), new THREE.Vector3(60, 0.84, 60))
  return new Player(physics, new THREE.Vector3(0, 1.2, 0), [])
}

describe('Three.js Cyber Worlds tuning', () => {
  it('validates an entire patch before committing and preserves immutable defaults', () => {
    const before = tuning.read()
    for (const patch of [
      { 'player.walkSpeed': 18 },
      { 'player.walkSpeed': 3.1 },
      { 'player.walkSpeed': 15, 'player.sprintSpeed': 12 },
      { 'player.jumpSpeed': '12' },
      { 'camera.fov': Infinity },
      { unknown: 4 },
    ]) {
      expect(() => tuning.apply(patch)).toThrow()
      expect(tuning.read()).toEqual(before)
    }
    tuning.apply({ 'player.walkSpeed': 8, 'player.acceleration': 65 })
    expect(CONFIG.player.walkSpeed).toBe(8)
    expect(CONFIG.player.acceleration).toBe(65)
    expect(DEFAULT_CONFIG.player.walkSpeed).toBe(7)
  })

  it('keeps jump and dash values pending until the matching character action begins', () => {
    tuning.apply({ 'player.jumpSpeed': 12, 'player.dashSpeed': 28, 'player.dashTime': 0.2 })
    expect(CONFIG.player.jumpSpeed).toBe(DEFAULT_CONFIG.player.jumpSpeed)
    expect(CONFIG.player.dashSpeed).toBe(DEFAULT_CONFIG.player.dashSpeed)
    expect(CONFIG.player.dashTime).toBe(DEFAULT_CONFIG.player.dashTime)
    tuning.activate('jump')
    expect(CONFIG.player.jumpSpeed).toBe(12)
    expect(CONFIG.player.dashSpeed).toBe(DEFAULT_CONFIG.player.dashSpeed)
    tuning.activate('dash')
    expect(CONFIG.player.dashSpeed).toBe(28)
    expect(CONFIG.player.dashTime).toBe(0.2)
  })

  it('changes actual Rapier character movement and next dash without replacing physics', async () => {
    await initPhysics()
    const physics = new Physics(-30)
    const player = makePlayer(physics)
    const events: Parameters<Player['step']>[3] = []
    const intent = { moveX: 0, moveY: 1, sprint: false, jumpPressed: false, jumpHeld: false, dashPressed: false }
    try {
      for (let i = 0; i < 60; i += 1) {
        player.step(1 / 60, intent, 0, events)
        physics.step(1 / 60)
        physics.sync(1)
      }
      const walked = player.position.z
      expect(Math.abs(walked)).toBeGreaterThan(3)
      tuning.apply({ 'player.walkSpeed': 9, 'player.dashSpeed': 28 })
      for (let i = 0; i < 60; i += 1) {
        player.step(1 / 60, intent, 0, events)
        physics.step(1 / 60)
        physics.sync(1)
      }
      expect(Math.abs(player.position.z - walked)).toBeGreaterThan(Math.abs(walked) * 0.8)
      player.step(1 / 60, { ...intent, dashPressed: true }, 0, events)
      expect(player.dashing).toBe(true)
      expect(Math.hypot(player.velocity.x, player.velocity.z)).toBeGreaterThan(24)
    } finally {
      physics.dispose()
    }
  })

  it('updates the actual follow-camera projection without replacing the camera', async () => {
    await initPhysics()
    const physics = new Physics(-30)
    const player = makePlayer(physics)
    const camera = new FollowCamera(physics, player.collider)
    try {
      camera.reset(new THREE.Vector3(0, 1.2, 0))
      const before = camera.camera.projectionMatrix.clone()
      tuning.apply({ 'camera.fov': 90, 'camera.distance': 9 })
      camera.update(new THREE.Vector3(0, 1.2, 0), { x: 0, y: 0 }, 1, true)
      expect(camera.camera.fov).toBe(90)
      expect(camera.camera.projectionMatrix.equals(before)).toBe(false)
      expect(camera.camera.position.distanceTo(new THREE.Vector3(0, 1.2 + CONFIG.camera.height * 0.45, 0))).toBeCloseTo(9)
    } finally {
      physics.dispose()
    }
  })
})
