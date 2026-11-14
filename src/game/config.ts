/** All Cyber Worlds movement and camera defaults live here and are consumed by the real gameplay controllers. */
export const DEFAULT_CONFIG = {
  player: {
    radius: 0.42,
    halfHeight: 0.5,
    walkSpeed: 7,
    sprintSpeed: 11,
    acceleration: 60,
    airControl: 0.45,
    jumpSpeed: 10.5,
    gravity: -30,
    /** Extra gravity when the jump button is released early, for variable jump height. */
    lowJumpGravity: -58,
    maxFall: -40,
    coyoteTime: 0.12,
    jumpBuffer: 0.14,
    dashSpeed: 22,
    dashTime: 0.16,
    dashCooldown: 0.9,
    turnSpeed: 14,
  },
  camera: {
    distance: 8.8,
    height: 4.1,
    minPitch: -0.35,
    maxPitch: 1.1,
    follow: 6.5,
    fov: 64,
  },
} as const

// Gameplay reads live values here. Source defaults remain immutable for Tweak Reset and Apply never writes source or local storage.
type MutableConfig<T> = { -readonly [K in keyof T]: T[K] extends number ? number : T[K] extends object ? MutableConfig<T[K]> : T[K] }
export const CONFIG: MutableConfig<typeof DEFAULT_CONFIG> = structuredClone(DEFAULT_CONFIG)
