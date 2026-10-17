import { afterEach, describe, expect, it, vi } from 'vitest'
import { CROPS, MATERIAL_PRICES, RECIPES } from '../src/farm/data'
import {
  QUESTS,
  action,
  canClaim,
  capacity,
  contractReward,
  createState,
  level,
  plotInfo,
  price,
  questClaimKey,
  questProgress,
  salePrice,
  shippingQuote,
  tick,
  usedStorage,
} from '../src/farm/engine'
import { SAVE_KEY, exportSave, importSave, loadState, recoverSave, saveState, validateState } from '../src/farm/storage'

describe('Pocket Farm Tycoon engine', () => {
  it('starts with the promised tutorial resources and a 3x4 field', () => {
    const state = createState(0)
    expect(state.coins).toBe(150)
    expect(state.seeds.cucumber).toBe(12)
    expect(state.seeds.garlic).toBe(4)
    expect(state.water).toBe(100)
    expect(state.plots).toHaveLength(12)
    expect(capacity(state)).toBe(120)
    expect(usedStorage(state)).toBe(16)
    expect(action(state, 'start', {}, 0).ok).toBe(true)
    expect(action(state, 'start', {}, 0).ok).toBe(false)
  })

  it('enforces crop unlocks, integer purchases, money and free refill', () => {
    const state = createState(0)
    expect(action(state, 'buySeeds', { crop: 'tomato', quantity: 1 }, 0).ok).toBe(false)
    expect(action(state, 'buySeeds', { crop: 'cucumber', quantity: 1.5 }, 0).ok).toBe(false)
    state.coins = 0
    expect(action(state, 'buySeeds', { crop: 'cucumber', quantity: 1 }, 0).ok).toBe(false)
    state.xp = 45
    state.coins = 20
    expect(level(state)).toBe(2)
    expect(action(state, 'buySeeds', { crop: 'tomato', quantity: 2 }, 0).ok).toBe(true)
    state.water = 0
    expect(action(state, 'refill', {}, 0).ok).toBe(true)
    expect(state.water).toBe(100)
  })

  it('pauses crop growth until watered, grows while away, and harvests once', () => {
    const state = createState(0)
    expect(action(state, 'plant', { index: 0, crop: 'cucumber' }, 0).ok).toBe(true)
    expect(action(state, 'plant', { index: 0, crop: 'cucumber' }, 0).ok).toBe(false)
    tick(state, CROPS.cucumber.growSeconds * 1000)
    expect(plotInfo(state, 0, CROPS.cucumber.growSeconds * 1000).ready).toBe(false)
    expect(action(state, 'water', { index: 0 }, CROPS.cucumber.growSeconds * 1000).ok).toBe(true)
    const finish = CROPS.cucumber.growSeconds * 2000
    tick(state, finish)
    expect(plotInfo(state, 0, finish).ready).toBe(true)
    const prior = state.inventory.cucumber
    expect(action(state, 'harvest', { index: 0 }, finish).ok).toBe(true)
    expect(state.inventory.cucumber).toBeGreaterThan(prior)
    expect(action(state, 'harvest', { index: 0 }, finish).ok).toBe(false)
  })

  it('applies the limited garlic-neighbour bonus to a cucumber plot', () => {
    const state = createState(0)
    action(state, 'plant', { index: 0, crop: 'cucumber' }, 0)
    action(state, 'plant', { index: 1, crop: 'garlic' }, 0)
    action(state, 'waterAll', {}, 0)
    tick(state, CROPS.cucumber.growSeconds * 1000)
    expect(plotInfo(state, 0, CROPS.cucumber.growSeconds * 1000).bonus).toBe(10)
  })

  it('uses storage atomically for seeds, materials, fertiliser and harvests', () => {
    const state = createState(0)
    state.inventory.cucumber = capacity(state) - usedStorage(state)
    expect(usedStorage(state)).toBe(capacity(state))
    expect(action(state, 'buySeeds', { crop: 'cucumber', quantity: 1 }, 0).ok).toBe(false)

    const materials = createState(0)
    expect(action(materials, 'buyMaterial', { material: 'fertilizer', quantity: 1 }, 0).ok).toBe(true)
    expect(action(materials, 'plant', { index: 0, crop: 'cucumber' }, 0).ok).toBe(true)
    const initialDuration = materials.plots[0]!.durationMs
    expect(action(materials, 'fertilize', { index: 0 }, 0).ok).toBe(true)
    expect(materials.plots[0]!.durationMs).toBeLessThan(initialDuration)
    expect(action(materials, 'fertilize', { index: 0 }, 0).ok).toBe(false)
  })

  it('sells only owned quantities and separates revenue from expense and quest earnings', () => {
    const state = createState(0)
    state.inventory.cucumber = 5
    const coinBefore = state.coins
    const unit = price(state, 'cucumber', 0)
    expect(action(state, 'sell', { product: 'cucumber', quantity: 6 }, 0).ok).toBe(false)
    expect(action(state, 'sell', { product: 'cucumber', quantity: 5 }, 0).ok).toBe(true)
    expect(state.coins).toBe(coinBefore + unit * 5)
    expect(state.stats.revenue).toBe(unit * 5)
    expect(state.stats.sold).toBe(5)
    expect(state.ledger.at(-1)?.amount).toBe(unit * 5)
    expect(action(state, 'buyMaterial', { material: 'boxes', quantity: 1 }, 0).ok).toBe(true)
    expect(state.stats.expenses).toBe(3)
    expect(state.stats.revenue - state.stats.expenses).toBe(unit * 5 - 3)
    state.inventory.cucumber = 1
    state.upgrades.shop = 1
    state.upgrades.packaging = 1
    state.reputation = 10
    expect(action(state, 'sell', { product: 'cucumber', quantity: 1, channel: 'shop' }, 0).ok).toBe(true)
    expect(state.materials.boxes).toBe(0)

    const questState = createState(0)
    for (let index = 0; index < 3; index += 1) expect(action(questState, 'plant', { index, crop: 'cucumber' }, 0).ok).toBe(true)
    const quest = QUESTS.find((entry) => entry.id === 'daily-plant')!
    expect(questProgress(questState, quest, 0)).toBe(3)
    expect(canClaim(questState, quest, 0)).toBe(true)
    expect(action(questState, 'claim', { id: quest.id }, 0).ok).toBe(true)
    expect(questState.stats.earned).toBe(quest.reward)
    expect(questState.stats.revenue).toBe(0)
    expect(action(questState, 'claim', { id: quest.id }, 0).ok).toBe(false)
  })

  it('validates contracts, blocks duplicate delivery, and expires accepted contracts', () => {
    const state = createState(0)
    const contract = state.contracts[0]
    expect(contract.requirements).toEqual({ cucumber: 10 })
    expect(action(state, 'acceptContract', { id: contract.id }, 0).ok).toBe(true)
    expect(action(state, 'acceptContract', { id: contract.id }, 0).ok).toBe(false)
    state.inventory.cucumber = 10
    const before = state.coins
    expect(action(state, 'deliverContract', { id: contract.id }, 1).ok).toBe(true)
    expect(state.coins).toBe(before + contractReward(state, contract, 1))
    expect(state.stats.contracts).toBe(1)
    expect(action(state, 'deliverContract', { id: contract.id }, 1).ok).toBe(false)

    const expired = createState(0)
    const late = expired.contracts[0]
    action(expired, 'acceptContract', { id: late.id }, 0)
    expired.inventory.cucumber = 10
    action(expired, 'deliverContract', { id: late.id }, late.duration * 1000 + 1)
    expect(late.status).toBe('expired')
  })

  it('reserves factory output capacity and completes a real manufacturing job', () => {
    const state = createState(0)
    state.xp = 1000
    state.upgrades.factory = 1
    state.inventory.cucumber = RECIPES.pickle.input
    state.materials.boxes = RECIPES.pickle.boxes
    const beforeStorage = usedStorage(state)
    expect(action(state, 'produce', { product: 'pickle' }, 0).ok).toBe(true)
    expect(state.jobs).toHaveLength(1)
    expect(usedStorage(state)).toBe(beforeStorage - RECIPES.pickle.input - RECIPES.pickle.boxes + RECIPES.pickle.output)
    const job = state.jobs[0]
    tick(state, job.finishAt)
    expect(state.jobs).toHaveLength(0)
    expect(state.inventory.pickle).toBe(RECIPES.pickle.output)
    expect(state.stats.crafted).toBe(RECIPES.pickle.output)
  })

  it('locks contract requirements during shipping and pays exactly once on arrival', () => {
    const state = createState(0)
    state.workers.driver = true
    state.upgrades.vehicle = 1
    const contract = state.contracts[0]
    action(state, 'acceptContract', { id: contract.id }, 0)
    state.inventory.cucumber = 10
    const before = state.coins
    expect(action(state, 'shipContract', { id: contract.id }, 0).ok).toBe(true)
    expect(contract.status).toBe('shipping')
    expect(state.inventory.cucumber).toBe(0)
    expect(action(state, 'shipContract', { id: contract.id }, 0).ok).toBe(false)
    const shipment = state.shipments[0]
    tick(state, shipment.finishAt)
    expect(contract.status).toBe('delivered')
    expect(state.shipments).toHaveLength(0)
    expect(state.coins).toBeGreaterThan(before)
    const paid = state.coins
    tick(state, shipment.finishAt + 1000)
    expect(state.coins).toBe(paid)
  })

  it('charges active workers only for bounded online time and pauses them without funds', () => {
    const state = createState(0)
    state.workers.planter = true
    state.workerActive.planter = true
    tick(state, 10 * 60 * 1000)
    expect(state.stats.workerWages).toBeGreaterThan(0)
    expect(state.stats.workerWages).toBeLessThanOrEqual(10)
    expect(state.stats.planted).toBeGreaterThan(0)

    const broke = createState(0)
    broke.coins = 0
    broke.workers.waterer = true
    broke.workerActive.waterer = true
    tick(broke, 30_000)
    expect(broke.workerActive.waterer).toBe(false)
    expect(broke.coins).toBe(0)
  })

  it('uses predictable bounded market prices and rejects clock rollback progress', () => {
    const state = createState(0)
    const first = price(state, 'tomato', 0)
    const later = price(state, 'tomato', 90_000)
    expect(first).toBeGreaterThanOrEqual(Math.floor(CROPS.tomato.basePrice * 0.75))
    expect(first).toBeLessThanOrEqual(Math.ceil(CROPS.tomato.basePrice * 1.3))
    expect(later).toBeGreaterThan(0)
    tick(state, 1000)
    const lastTick = state.lastTick
    tick(state, 100)
    expect(state.lastTick).toBe(lastTick)
  })

  it('exports the one source of truth for material prices', () => {
    expect(MATERIAL_PRICES).toEqual({ boxes: 3, fertilizer: 8 })
    const state = createState(0)
    expect(action(state, 'buyMaterial', { material: 'boxes', quantity: 2 }, 0).ok).toBe(true)
    expect(state.coins).toBe(150 - MATERIAL_PRICES.boxes * 2)
  })

  it('uses bounded shop premiums from reputation, packaging, and shop branches', () => {
    const state = createState(0)
    state.reputation = 100
    state.upgrades.shop = 3
    state.upgrades.packaging = 2
    const market = salePrice(state, 'tomato', 'market', 0)
    const shop = salePrice(state, 'tomato', 'shop', 0)
    expect(shop).toBeGreaterThan(market)
    expect(shop).toBeLessThanOrEqual(Math.round(market * 1.6))
    state.reputation = 9
    expect(salePrice(state, 'tomato', 'shop', 0)).toBe(0)
  })

  it('rejects a stale expected unit price without changing inventory or coins', () => {
    const state = createState(0)
    state.inventory.tomato = 1
    const expectedUnit = salePrice(state, 'tomato', 'market', 0)
    const current = salePrice(state, 'tomato', 'market', 90_000)
    expect(current).not.toBe(expectedUnit)
    const before = { coins: state.coins, inventory: state.inventory.tomato }
    expect(action(state, 'sell', { product: 'tomato', quantity: 1, expectedUnit }, 90_000).ok).toBe(false)
    expect(state.coins).toBe(before.coins)
    expect(state.inventory.tomato).toBe(before.inventory)
    expect(action(state, 'sell', { product: 'tomato', quantity: 1, expectedUnit: current }, 90_000).ok).toBe(true)
    expect(state.coins).toBe(before.coins + current)
  })

  it('pays the same exact early contract reward on direct delivery', () => {
    const state = createState(0)
    const contract = state.contracts[0]
    expect(action(state, 'acceptContract', { id: contract.id }, 0).ok).toBe(true)
    state.inventory.cucumber = 10
    const reward = contractReward(state, contract, 1)
    expect(reward).toBe(Math.round(contract.reward * 1.05))
    const before = state.coins
    expect(action(state, 'deliverContract', { id: contract.id }, 1).ok).toBe(true)
    expect(state.coins).toBe(before + reward)
  })

  it('quotes shipping exactly, locks a shipment once, and awards the early arrival reward once', () => {
    const state = createState(0)
    state.workers.driver = true
    state.upgrades.vehicle = 1
    const contract = state.contracts[0]
    action(state, 'acceptContract', { id: contract.id }, 0)
    state.inventory.cucumber = 10
    const quote = shippingQuote(state, contract, 0)
    expect(quote).toMatchObject({ capacity: 60, total: 10, cost: Math.ceil(contract.reward * 0.08), seconds: 45, eligible: true })
    const before = state.coins
    expect(action(state, 'shipContract', { id: contract.id }, 0).ok).toBe(true)
    expect(action(state, 'shipContract', { id: contract.id }, 0).ok).toBe(false)
    const shipment = state.shipments[0]
    tick(state, shipment.finishAt)
    expect(state.coins).toBe(before - quote.cost + contractReward(state, contract, shipment.finishAt))
    const paid = state.coins
    tick(state, shipment.finishAt + 1)
    expect(state.coins).toBe(paid)
  })

  it('rejects a shipment which cannot arrive by its deadline before charging or locking products', () => {
    const state = createState(0)
    state.workers.driver = true
    state.upgrades.vehicle = 1
    const contract = state.contracts[0]
    action(state, 'acceptContract', { id: contract.id }, 0)
    contract.deadline = 30_000
    state.inventory.cucumber = 10
    const before = { coins: state.coins, inventory: state.inventory.cucumber }
    expect(shippingQuote(state, contract, 0)).toMatchObject({ eligible: false, reason: 'لن تصل الشحنة قبل مهلة العقد.' })
    expect(action(state, 'shipContract', { id: contract.id }, 0).ok).toBe(false)
    expect(state.coins).toBe(before.coins)
    expect(state.inventory.cucumber).toBe(before.inventory)
    expect(state.shipments).toHaveLength(0)
  })

  it('never pays a malformed late shipment that reaches the engine after its deadline', () => {
    const state = createState(0)
    const contract = state.contracts[0]
    action(state, 'acceptContract', { id: contract.id }, 0)
    contract.status = 'shipping'
    contract.deadline = 30_000
    state.shipments.push({ id: 'late-shipment', contractId: contract.id, finishAt: 45_000, cost: 5 })
    const before = state.coins
    tick(state, 45_000)
    expect(contract.status).toBe('expired')
    expect(state.coins).toBe(before)
  })

  it('allows production at full output capacity when consumed inputs free enough net storage', () => {
    const state = createState(0)
    state.xp = 1000
    state.upgrades.factory = 1
    state.inventory.cucumber = RECIPES.pickle.input
    state.materials.boxes = RECIPES.pickle.boxes
    state.inventory.garlic += capacity(state) - usedStorage(state)
    expect(usedStorage(state)).toBe(capacity(state))
    expect(action(state, 'produce', { product: 'pickle' }, 0).ok).toBe(true)
    expect(usedStorage(state)).toBe(capacity(state) - RECIPES.pickle.input - RECIPES.pickle.boxes + RECIPES.pickle.output)
  })

  it('enforces two factory slots per factory level before deducting inputs, boxes, or coins', () => {
    const state = createState(0)
    state.xp = 1000
    state.upgrades.factory = 1
    state.inventory.cucumber = RECIPES.pickle.input * 3
    state.materials.boxes = RECIPES.pickle.boxes * 3
    expect(action(state, 'produce', { product: 'pickle' }, 0).ok).toBe(true)
    expect(action(state, 'produce', { product: 'pickle' }, 0).ok).toBe(true)
    const before = { coins: state.coins, input: state.inventory.cucumber, boxes: state.materials.boxes }
    expect(action(state, 'produce', { product: 'pickle' }, 0).ok).toBe(false)
    expect(state.jobs).toHaveLength(2)
    expect(state.coins).toBe(before.coins)
    expect(state.inventory.cucumber).toBe(before.input)
    expect(state.materials.boxes).toBe(before.boxes)
  })

  it('keeps a ripe crop planted when a full storage blocks harvesting', () => {
    const state = createState(0)
    action(state, 'plant', { index: 0, crop: 'cucumber' }, 0)
    action(state, 'water', { index: 0 }, 0)
    tick(state, CROPS.cucumber.growSeconds * 1000)
    state.inventory.garlic += capacity(state) - usedStorage(state)
    expect(action(state, 'harvest', { index: 0 }, CROPS.cucumber.growSeconds * 1000).ok).toBe(false)
    expect(state.plots[0]).not.toBeNull()
    expect(plotInfo(state, 0, CROPS.cucumber.growSeconds * 1000).ready).toBe(true)
  })

  it('retains planted plots during a land upgrade and exposes permanent special quest progress', () => {
    const state = createState(0)
    action(state, 'plant', { index: 0, crop: 'cucumber' }, 0)
    const planted = state.plots[0]
    state.xp = 1000
    state.coins = 1000
    expect(action(state, 'upgrade', { id: 'land' }, 0).ok).toBe(true)
    expect(state.plots).toHaveLength(16)
    expect(state.plots[0]).toEqual(planted)
    const landQuest = QUESTS.find((quest) => quest.id === 'first-land')!
    expect(questProgress(state, landQuest, 0)).toBe(1)
    expect(canClaim(state, landQuest, 0)).toBe(true)
  })

  it('claims permanent achievements only once and uses real UTC day/week claim keys', () => {
    const state = createState(0)
    state.stats.harvested = 3
    const quest = QUESTS.find((entry) => entry.id === 'first-harvest')!
    expect(questClaimKey(quest, 0)).toBe('first-harvest')
    expect(canClaim(state, quest, 0)).toBe(true)
    expect(action(state, 'claim', { id: quest.id }, 0).ok).toBe(true)
    expect(action(state, 'claim', { id: quest.id }, 86_400_000).ok).toBe(false)
    const daily = QUESTS.find((entry) => entry.id === 'daily-plant')!
    expect(questClaimKey(daily, 0)).toBe('daily-plant:0')
    expect(questClaimKey(daily, 86_400_000)).toBe('daily-plant:1')
  })

  it('bounds terminal contract history through sixty days of board refreshes', () => {
    const state = createState(0)
    const sixtyDays = 60 * 86_400_000
    for (let now = 6 * 60 * 60 * 1000; now <= sixtyDays; now += 6 * 60 * 60 * 1000) tick(state, now)
    expect(state.contracts.length).toBeLessThanOrEqual(105)
    expect(validateState(state, sixtyDays)).not.toBeNull()
  })
})

describe('verified local save', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('round-trips valid saves, preserves a backup, and rejects malformed or injected data', () => {
    const records = new Map<string, string>()
    const storage: Storage = {
      get length() { return records.size },
      clear: () => records.clear(),
      getItem: (key) => records.get(key) ?? null,
      key: (index) => [...records.keys()][index] ?? null,
      removeItem: (key) => { records.delete(key) },
      setItem: (key, value) => { records.set(key, value) },
    }
    vi.stubGlobal('localStorage', storage)
    const first = createState(0)
    expect(saveState(first).ok).toBe(true)
    const second = createState(0)
    second.coins = 77
    expect(saveState(second).ok).toBe(true)
    expect(records.has(`${SAVE_KEY}.backup`)).toBe(true)
    records.set(SAVE_KEY, '{bad json')
    const recovered = loadState(0)
    expect(recovered.warning).toContain('الاحتياطية')
    expect(recovered.state.coins).toBe(150)

    const malformed = JSON.parse(exportSave(createState(0))) as Record<string, any>
    malformed.inventory.cucumber = -2
    expect(validateState(malformed, 0)).toBeNull()
    expect(importSave('{"__proto__":{"polluted":true}}', 0)).toBeNull()
  })

  it('requires explicit recovery after backup loading, preserving the corrupt primary before repair', () => {
    const records = new Map<string, string>()
    const storage: Storage = {
      get length() { return records.size },
      clear: () => records.clear(),
      getItem: (key) => records.get(key) ?? null,
      key: (index) => [...records.keys()][index] ?? null,
      removeItem: (key) => { records.delete(key) },
      setItem: (key, value) => { records.set(key, value) },
    }
    vi.stubGlobal('localStorage', storage)
    expect(saveState(createState(0)).ok).toBe(true)
    const latest = createState(0)
    latest.coins = 77
    expect(saveState(latest).ok).toBe(true)
    records.set(SAVE_KEY, '{bad json')
    const loaded = loadState(0)
    expect(loaded.warning).toContain('الاحتياطية')
    expect(saveState(loaded.state).ok).toBe(false)
    expect(recoverSave(loaded.state).ok).toBe(true)
    expect(records.get(`${SAVE_KEY}.corrupt`)).toBe('{bad json')
    expect(importSave(records.get(SAVE_KEY)!, 0)?.coins).toBe(150)
    expect(saveState(loaded.state).ok).toBe(true)
  })

  it('caps future ticks during validation and keeps exported format importable', () => {
    const state = createState(0)
    state.lastTick = 99_999
    const safe = validateState(state, 0)
    expect(safe?.lastTick).toBe(0)
    expect(importSave(exportSave(createState(0)), 0)?.version).toBe(1)
  })
})
