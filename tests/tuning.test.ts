import { afterEach, describe, expect, it } from 'vitest'
import { CONFIG, DEFAULT_CONFIG } from '../src/game/config'
import { tuning } from '../src/game/tuning'
const defaults = Object.fromEntries(tuning.controls.map(control => [control.id, control.default]))
afterEach(() => { tuning.apply(defaults); tuning.activate('run') })
describe('Farm preview tuning', () => {
  it('exposes only actual cosmetic farm consumers', () => {
    expect(tuning.controls.map(c => c.id)).toEqual(['camera.distance','camera.follow'])
    expect(tuning.controls.every(c => c.integrity === 'COSMETIC' && c.applyMode === 'LIVE')).toBe(true)
  })
  it('validates an entire patch atomically', () => {
    const before = tuning.read()
    for (const p of [{ 'camera.distance': 8, 'camera.follow': 999 }, { unknown: 4 }, { 'camera.distance': 7.13 }, { 'camera.distance': Infinity }]) {
      expect(() => tuning.apply(p)).toThrow(); expect(tuning.read()).toEqual(before)
    }
  })
  it('applies to existing source configuration without mutating defaults or eligibility', () => {
    tuning.apply({ 'camera.distance': 9, 'camera.follow': 14 })
    expect(CONFIG.camera.distance).toBe(9); expect(CONFIG.camera.follow).toBe(14)
    expect(DEFAULT_CONFIG.camera.distance).toBe(6.4)
    expect(tuning.unranked).toBe(false)
  })
})
