import { CONFIG, DEFAULT_CONFIG } from './config'

const controls = [
  { id: 'camera.distance', type: 'number', category: 'منظور المزرعة', label: 'مسافة عرض المزرعة', description: 'تغير تكبير المنظور الإيزومتري مباشرة، دون تغيير الحفظ أو الاقتصاد.', unit: '', default: DEFAULT_CONFIG.camera.distance, min: 3, max: 12, step: .1, applyMode: 'LIVE', integrity: 'COSMETIC' },
  { id: 'camera.follow', type: 'number', category: 'منظور المزرعة', label: 'حركة أوراق النبات', description: 'شدة التمايل البصري؛ لا تؤثر في نمو المحاصيل.', unit: '', default: DEFAULT_CONFIG.camera.follow, min: 2, max: 20, step: 1, applyMode: 'LIVE', integrity: 'COSMETIC' },
] as const
const byId = new Map(controls.map(c => [c.id, c]))
let requested: Record<string, number> = Object.fromEntries(controls.map(c => [c.id, c.default]))
let unranked = false
const active = () => ({ 'camera.distance': CONFIG.camera.distance, 'camera.follow': CONFIG.camera.follow })
export const tuning = {
  controls: Object.freeze(controls),
  get unranked() { return unranked },
  read() { return { requested: { ...requested }, active: active() } },
  apply(patch: unknown) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('Invalid patch')
    const entries = Object.entries(patch)
    for (const [id, value] of entries) {
      const c = byId.get(id as typeof controls[number]['id'])
      if (!c || typeof value !== 'number' || !Number.isFinite(value) || value < c.min || value > c.max) throw new Error('Invalid value')
      if (Math.abs((value - c.min) / c.step - Math.round((value - c.min) / c.step)) > 1e-7) throw new Error('Invalid increment')
    }
    requested = { ...requested, ...patch }
    CONFIG.camera.distance = requested['camera.distance']
    CONFIG.camera.follow = requested['camera.follow']
  },
  activate(boundary: 'run' | 'jump' | 'dash') { if (boundary === 'run') unranked = false },
}
