import { CONFIG, DEFAULT_CONFIG } from './config'

type Mode = 'LIVE' | 'NEXT_ACTION'
type Boundary = 'jump' | 'dash'
type Section = 'player' | 'camera'
type Control = {
  id: string
  type: 'number'
  category: string
  label: string
  description: string
  unit: string
  default: number
  min: number
  max: number
  step: number
  applyMode: Mode
  integrity: 'COSMETIC' | 'GAMEPLAY'
}
type Binding = { control: Control; boundary?: Boundary; read(): number; write(value: number): void }

const bindings: Binding[] = []
function number(section: Section, key: string, label: string, min: number, max: number, step: number, unit: string, boundary?: Boundary, cosmetic = false): void {
  const values = CONFIG[section] as unknown as Record<string, number>
  const defaults = DEFAULT_CONFIG[section] as unknown as Record<string, number>
  const descriptions: Record<Boundary, string> = {
    jump: 'Applies when the next jump begins.',
    dash: 'Applies when the next dash begins.',
  }
  bindings.push({
    control: Object.freeze({
      id: `${section}.${key}`,
      type: 'number',
      category: section === 'player' ? 'Explorer' : 'Camera',
      label,
      description: boundary ? descriptions[boundary] : 'Updates this preview immediately.',
      unit,
      default: defaults[key],
      min,
      max,
      step,
      applyMode: boundary ? 'NEXT_ACTION' : 'LIVE',
      integrity: cosmetic || section === 'camera' ? 'COSMETIC' : 'GAMEPLAY',
    }),
    boundary,
    read: () => values[key],
    write: value => { values[key] = value },
  })
}

number('player', 'walkSpeed', 'Walk speed', 3, 12, 0.5, 'm/s')
number('player', 'sprintSpeed', 'Sprint speed', 6, 18, 0.5, 'm/s')
number('player', 'acceleration', 'Movement response', 20, 100, 5, '')
number('player', 'jumpSpeed', 'Jump strength', 7, 16, 0.5, 'm/s', 'jump')
number('player', 'dashSpeed', 'Dash strength', 12, 32, 1, 'm/s', 'dash')
number('player', 'dashTime', 'Dash duration', 0.08, 0.3, 0.02, 's', 'dash')
number('camera', 'fov', 'Field of view', 40, 100, 1, '°', undefined, true)
number('camera', 'distance', 'Follow distance', 3, 14, 0.1, 'm', undefined, true)
number('camera', 'follow', 'Follow speed', 2, 20, 1, '', undefined, true)

const byId = new Map(bindings.map(binding => [binding.control.id, binding]))
let requested = Object.fromEntries(bindings.map(({ control }) => [control.id, control.default]))
const valid = (values: Record<string, number>) => values['player.walkSpeed'] <= values['player.sprintSpeed']

export const tuning = {
  controls: Object.freeze(bindings.map(binding => binding.control)),
  read() {
    return { requested: { ...requested }, active: Object.fromEntries(bindings.map(binding => [binding.control.id, binding.read()])) }
  },
  apply(patch: unknown): void {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('Invalid patch')
    const entries = Object.entries(patch)
    if (entries.length > bindings.length) throw new Error('Invalid patch')
    for (const [id, value] of entries) {
      const control = byId.get(id)?.control
      if (!control || typeof value !== 'number' || !Number.isFinite(value) || value < control.min || value > control.max) throw new Error('Invalid value')
      const steps = (value - control.min) / control.step
      if (value !== control.default && Math.abs(steps - Math.round(steps)) > 1e-7) throw new Error('Invalid increment')
    }
    const candidate = { ...requested, ...patch } as Record<string, number>
    const nextActive = this.read().active
    for (const [id, value] of entries) if (byId.get(id)!.control.applyMode === 'LIVE') nextActive[id] = value
    if (!valid(candidate) || !valid(nextActive)) throw new Error('Walk speed must not exceed sprint speed')
    requested = candidate
    for (const [id, value] of entries) {
      const binding = byId.get(id)!
      if (binding.control.applyMode === 'LIVE') binding.write(value)
    }
  },
  activate(boundary: Boundary): void {
    for (const binding of bindings) if (binding.boundary === boundary) binding.write(requested[binding.control.id])
  },
}
