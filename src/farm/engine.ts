import {
  CROPS,
  MATERIAL_PRICES,
  PRODUCTS,
  QUESTS,
  RECIPES,
  UPGRADES,
  WORKERS,
  type CropId,
  type ItemId,
  type ProductId,
  type QuestDefinition,
  type UpgradeId,
  type WorkerId,
} from './data';

export { QUESTS } from './data';

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
const BOARD_PERIOD = 6 * 60 * 60 * 1000;
const MAX_WORKER_CATCHUP = 5 * 60 * 1000;
const ITEM_IDS = [...Object.keys(CROPS), ...Object.keys(PRODUCTS)] as ItemId[];
const CROP_IDS = Object.keys(CROPS) as CropId[];
const PRODUCT_IDS = Object.keys(PRODUCTS) as ProductId[];
const UPGRADE_IDS = Object.keys(UPGRADES) as UpgradeId[];
const WORKER_IDS = Object.keys(WORKERS) as WorkerId[];

export type WeatherKind = 'sunny' | 'cloudy' | 'rain' | 'windy';
export type ContractStatus = 'available' | 'active' | 'delivered' | 'expired' | 'rejected' | 'shipping';

export interface Plot {
  crop: CropId;
  plantedAt: number;
  watered: boolean;
  growthMs: number;
  growthUpdatedAt: number;
  durationMs: number;
  waterCost: number;
  fertilized: boolean;
}

export interface FactoryJob {
  id: string;
  product: ProductId;
  finishAt: number;
  output: number;
}

export interface FarmContract {
  id: string;
  client: string;
  requirements: Record<string, number>;
  reward: number;
  duration: number;
  level: number;
  status: ContractStatus;
  deadline: number;
  acceptedAt: number;
  boardAt: number;
}

export interface Shipment {
  id: string;
  contractId: string;
  finishAt: number;
  cost: number;
}

type Metric = 'revenue' | 'expenses' | 'planted' | 'harvested' | 'sold' | 'contracts' | 'crafted' | 'earned' | 'watered' | 'workerWages';

interface PeriodStats {
  bucket: number;
  revenue: number;
  expenses: number;
  planted: number;
  harvested: number;
  sold: number;
  contracts: number;
  crafted: number;
  earned: number;
  watered: number;
  workerWages: number;
}

export interface FarmStats {
  revenue: number;
  expenses: number;
  planted: number;
  harvested: number;
  sold: number;
  contracts: number;
  crafted: number;
  earned: number;
  watered: number;
  workerWages: number;
  waterRemainder: number;
  workerRemainder: number;
  periods: { daily: PeriodStats; weekly: PeriodStats };
}

/** الحالة العامة الوحيدة التي تحتاجها الواجهة أو الحفظ. */
export interface FarmState {
  version: 1;
  coins: number;
  xp: number;
  water: number;
  seeds: Record<string, number>;
  inventory: Record<string, number>;
  materials: { boxes: number; fertilizer: number };
  plots: Array<null | Plot>;
  upgrades: Record<string, number>;
  workers: Record<string, boolean>;
  workerActive: Record<string, boolean>;
  jobs: FactoryJob[];
  contracts: FarmContract[];
  shipments: Shipment[];
  brand: { name: string; logo: string };
  reputation: number;
  stats: FarmStats;
  ledger: Array<{ id: string; time: number; label: string; amount: number }>;
  claimed: string[];
  createdAt: number;
  lastTick: number;
  settings: { muted: boolean; reducedMotion: boolean };
  started: boolean;
}

export interface ActionResult {
  ok: boolean;
  message: string;
}

export type Quest = QuestDefinition;

const CONTRACT_TEMPLATES: Array<Omit<FarmContract, 'id' | 'status' | 'deadline' | 'acceptedAt' | 'boardAt'>> = [
  { client: 'بقالة الحي', requirements: { cucumber: 10 }, reward: 78, duration: 180, level: 1 },
  { client: 'مطاعم الواحة', requirements: { cucumber: 30, garlic: 10 }, reward: 285, duration: 420, level: 2 },
  { client: 'تعاونية المزارعين', requirements: { tomato: 80 }, reward: 980, duration: 900, level: 4 },
  { client: 'سلسلة الخضر الكبرى', requirements: { cucumber: 100 }, reward: 870, duration: 900, level: 5 },
  { client: 'فندق السهل', requirements: { cucumber: 100, tomato: 80 }, reward: 2150, duration: 1500, level: 7 },
];

function emptyNumberRecord<T extends string>(keys: readonly T[]): Record<T, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;
}

function emptyBooleanRecord<T extends string>(keys: readonly T[]): Record<T, boolean> {
  return Object.fromEntries(keys.map((key) => [key, false])) as Record<T, boolean>;
}

function period(bucket: number): PeriodStats {
  return { bucket, revenue: 0, expenses: 0, planted: 0, harvested: 0, sold: 0, contracts: 0, crafted: 0, earned: 0, watered: 0, workerWages: 0 };
}

function cleanNow(now: number): number {
  return Number.isFinite(now) && now >= 0 ? Math.floor(now) : Date.now();
}

function dayBucket(now: number): number {
  return Math.floor(now / DAY);
}

function weekBucket(now: number): number {
  return Math.floor(now / WEEK);
}

function createBoard(now: number, serial: number): FarmContract[] {
  const bucket = Math.floor(now / BOARD_PERIOD);
  return CONTRACT_TEMPLATES.map((template, index) => ({
    ...template,
    requirements: { ...template.requirements },
    id: `contract-${bucket}-${serial}-${index}`,
    status: 'available' as const,
    deadline: now + BOARD_PERIOD,
    acceptedAt: 0,
    boardAt: now,
  }));
}

export function createState(now = Date.now()): FarmState {
  const time = cleanNow(now);
  const seeds = emptyNumberRecord(CROP_IDS);
  seeds.cucumber = 12;
  seeds.garlic = 4;
  return {
    version: 1,
    coins: 150,
    xp: 0,
    water: 100,
    seeds,
    inventory: emptyNumberRecord(ITEM_IDS),
    materials: { boxes: 0, fertilizer: 0 },
    plots: Array.from({ length: 12 }, () => null),
    upgrades: emptyNumberRecord(UPGRADE_IDS),
    workers: emptyBooleanRecord(WORKER_IDS),
    workerActive: emptyBooleanRecord(WORKER_IDS),
    jobs: [],
    contracts: createBoard(time, 0),
    shipments: [],
    brand: { name: 'مزرعتي', logo: '🌱' },
    reputation: 0,
    stats: {
      revenue: 0, expenses: 0, planted: 0, harvested: 0, sold: 0, contracts: 0,
      crafted: 0, earned: 0, watered: 0, workerWages: 0, waterRemainder: 0,
      workerRemainder: 0, periods: { daily: period(dayBucket(time)), weekly: period(weekBucket(time)) },
    },
    ledger: [],
    claimed: [],
    createdAt: time,
    lastTick: time,
    settings: { muted: false, reducedMotion: false },
    started: false,
  };
}

/** إجمالي الخبرة اللازمة للوصول إلى مستوى معين، وليس خبرة المستوى وحده. */
function thresholdForLevel(targetLevel: number): number {
  const n = Math.max(0, targetLevel - 1);
  return 25 * n * n + 20 * n;
}

export function level(state: FarmState): number {
  let current = 1;
  while (state.xp >= thresholdForLevel(current + 1)) current += 1;
  return current;
}

export function xpTarget(state: FarmState): number {
  return thresholdForLevel(level(state) + 1);
}

export function weather(_state: FarmState, now = Date.now()): { name: string; kind: WeatherKind; description: string; season: string; day: number; endsAt: number } {
  const time = cleanNow(now);
  const day = dayBucket(time);
  const block = Math.floor(time / (6 * 60 * 60 * 1000));
  const kinds: WeatherKind[] = ['sunny', 'cloudy', 'rain', 'windy'];
  const kind = kinds[(block * 7 + day * 3) % kinds.length];
  const season = ['الربيع', 'الصيف', 'الخريف', 'الشتاء'][Math.floor(day / 21) % 4];
  const details: Record<WeatherKind, { name: string; description: string }> = {
    sunny: { name: 'مشمس', description: 'الجو مستقر؛ النمو بالسرعة المعتادة.' },
    cloudy: { name: 'غائم', description: 'سحب خفيفة تبطئ الدفعات المزروعة قليلاً.' },
    rain: { name: 'ممطر', description: 'المطر يسقي القطع العطشى مجاناً ويُسرّع الزراعة الجديدة.' },
    windy: { name: 'عاصف', description: 'الرياح تطيل زمن الزراعة الجديدة قليلاً.' },
  };
  return { ...details[kind], kind, season, day, endsAt: (block + 1) * 6 * 60 * 60 * 1000 };
}

function isCrop(value: unknown): value is CropId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CROPS, value);
}

function isProduct(value: unknown): value is ProductId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PRODUCTS, value);
}

function isItem(value: unknown): value is ItemId {
  return isCrop(value) || isProduct(value);
}

function isUpgrade(value: unknown): value is UpgradeId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(UPGRADES, value);
}

function isWorker(value: unknown): value is WorkerId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(WORKERS, value);
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function payloadObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function marketMultiplier(id: ItemId, now: number): number {
  const index = ITEM_IDS.indexOf(id) + 1;
  const cycle = Math.floor(now / 90000);
  const wave = (((cycle + index * 3) % 7) - 3) * 0.045;
  const seasonWave = ((Math.floor(now / DAY / 21) + index) % 3 - 1) * 0.035;
  return Math.max(0.78, Math.min(1.24, 1 + wave + seasonWave));
}

/** سعر السوق المحلي دوري، معلن ضمنياً من الوقت، ولا يخرج عن ±24% تقريباً. */
export function price(state: FarmState, id: string, now = Date.now()): number {
  if (!isItem(id)) return 0;
  const base = isCrop(id) ? CROPS[id].basePrice : PRODUCTS[id].basePrice;
  const trust = 1 + Math.min(100, state.reputation) * 0.001;
  return Math.max(1, Math.round(base * Math.min(1.25, marketMultiplier(id, cleanNow(now)) * trust)));
}

/**
 * سعر الوحدة المطابق للبيع. سعر المتجر مشروط بالتغليف والسمعة، ثم يجمع علاوة
 * ملموسة ومحدودة من السمعة، مستوى التغليف، وعدد فروع المتجر.
 */
export function salePrice(state: FarmState, id: string, channel = 'market', now = Date.now()): number {
  if (!isItem(id) || (channel !== 'market' && channel !== 'shop')) return 0;
  const market = price(state, id, now);
  if (channel === 'market') return market;
  if (state.upgrades.shop < 1 || state.upgrades.packaging < 1 || state.reputation < 10) return 0;
  const reputationPremium = Math.min(0.18, state.reputation * 0.003);
  const packagingPremium = Math.min(0.12, state.upgrades.packaging * 0.06);
  const branchPremium = Math.min(0.15, state.upgrades.shop * 0.05);
  return Math.max(1, Math.round(market * (1.15 + reputationPremium + packagingPremium + branchPremium)));
}

export function capacity(state: FarmState): number {
  return 120 + state.upgrades.storage * 60 + (state.workers.warehouse ? 30 : 0);
}

/** يتضمن الحجز الافتراضي لمخرجات المصنع حتى لا تتجاوز الدفعات سعة المخزن. */
export function usedStorage(state: FarmState): number {
  const seeds = CROP_IDS.reduce((sum, id) => sum + state.seeds[id], 0);
  const inventory = ITEM_IDS.reduce((sum, id) => sum + state.inventory[id], 0);
  const materials = state.materials.boxes + state.materials.fertilizer;
  const reserved = state.jobs.reduce((sum, job) => sum + job.output, 0);
  return seeds + inventory + materials + reserved;
}

export function upgradeCost(state: FarmState, id: string): number {
  if (!isUpgrade(id)) return 0;
  const definition = UPGRADES[id];
  if (state.upgrades[id] >= definition.max) return 0;
  return Math.ceil(definition.baseCost * Math.pow(1.62, state.upgrades[id]));
}

function resetPeriodIfNeeded(state: FarmState, now: number, which: 'daily' | 'weekly'): PeriodStats {
  const bucket = which === 'daily' ? dayBucket(now) : weekBucket(now);
  const current = state.stats.periods[which];
  if (current.bucket !== bucket) state.stats.periods[which] = period(bucket);
  return state.stats.periods[which];
}

function addMetric(state: FarmState, metric: Metric, amount: number, now: number): void {
  state.stats[metric] += amount;
  resetPeriodIfNeeded(state, now, 'daily')[metric] += amount;
  resetPeriodIfNeeded(state, now, 'weekly')[metric] += amount;
}

function addXp(state: FarmState, amount: number): void {
  state.xp = Math.max(0, state.xp + Math.max(0, Math.floor(amount)));
}

function makeId(prefix: string, state: FarmState, now: number): string {
  const nonce = state.ledger.length + state.jobs.length + state.shipments.length + state.contracts.length;
  return `${prefix}-${now}-${nonce}-${Math.random().toString(36).slice(2, 8)}`;
}

function ledger(state: FarmState, time: number, label: string, amount: number): void {
  state.ledger.push({ id: makeId('ledger', state, time), time, label, amount });
  if (state.ledger.length > 500) state.ledger.splice(0, state.ledger.length - 500);
}

function spend(state: FarmState, amount: number, label: string, now: number): void {
  state.coins -= amount;
  addMetric(state, 'expenses', amount, now);
  ledger(state, now, label, -amount);
}

function receiveRevenue(state: FarmState, amount: number, label: string, now: number): void {
  state.coins += amount;
  addMetric(state, 'revenue', amount, now);
  ledger(state, now, label, amount);
}

function receiveQuest(state: FarmState, amount: number, label: string, now: number): void {
  state.coins += amount;
  addMetric(state, 'earned', amount, now);
  ledger(state, now, label, amount);
}

function weatherDurationFactor(kind: WeatherKind): number {
  return kind === 'rain' ? 0.9 : kind === 'cloudy' ? 1.05 : kind === 'windy' ? 1.12 : 1;
}

function waterNeed(state: FarmState, crop: CropId, now: number): number {
  const rainReduction = weather(state, now).kind === 'rain' ? 2 : 0;
  return Math.max(1, Math.ceil(CROPS[crop].water * (1 - state.upgrades.irrigation * 0.15)) - rainReduction);
}

function durationForPlant(state: FarmState, crop: CropId, now: number): number {
  const base = CROPS[crop].growSeconds * 1000;
  const adjusted = base * weatherDurationFactor(weather(state, now).kind) * Math.pow(0.92, state.upgrades.greenhouse);
  return Math.max(1000, Math.round(adjusted));
}

function advancePlot(state: FarmState, plot: Plot, now: number): void {
  if (!plot.watered && weather(state, now).kind === 'rain') {
    plot.watered = true;
    plot.growthUpdatedAt = now;
    return;
  }
  if (plot.watered) {
    plot.growthMs = Math.min(plot.durationMs, plot.growthMs + Math.max(0, now - plot.growthUpdatedAt));
  }
  plot.growthUpdatedAt = now;
}

function garlicAdjacent(state: FarmState, index: number): boolean {
  const row = Math.floor(index / 4);
  const column = index % 4;
  const candidates = [
    index - 1,
    index + 1,
    index - 4,
    index + 4,
  ];
  return candidates.some((candidate) => {
    if (candidate < 0 || candidate >= state.plots.length) return false;
    if ((candidate === index - 1 || candidate === index + 1) && Math.floor(candidate / 4) !== row) return false;
    const candidateColumn = candidate % 4;
    if (Math.abs(candidateColumn - column) > 1 && (candidate === index - 1 || candidate === index + 1)) return false;
    return state.plots[candidate]?.crop === 'garlic';
  });
}

function plotYield(state: FarmState, index: number, plot: Plot): { yield: number; bonus: number } {
  const garlicBonus = plot.crop === 'cucumber' && garlicAdjacent(state, index) ? 10 : 0;
  const fertiliserBonus = plot.fertilized ? 20 : 0;
  const toolsBonus = state.upgrades.tools * 5;
  const totalBonus = garlicBonus + fertiliserBonus + toolsBonus;
  return { yield: Math.max(1, Math.round(CROPS[plot.crop].yield * (1 + totalBonus / 100))), bonus: garlicBonus };
}

export function plotInfo(state: FarmState, index: number, now = Date.now()): { progress: number; ready: boolean; needsWater: boolean; remaining: number; yield: number; bonus: number } {
  const plot = Number.isInteger(index) ? state.plots[index] : null;
  if (!plot) return { progress: 0, ready: false, needsWater: false, remaining: 0, yield: 0, bonus: 0 };
  const time = Math.max(cleanNow(now), plot.growthUpdatedAt);
  const rain = weather(state, time).kind === 'rain';
  const grown = Math.min(plot.durationMs, plot.growthMs + (plot.watered ? Math.max(0, time - plot.growthUpdatedAt) : 0));
  const ready = grown >= plot.durationMs;
  const output = plotYield(state, index, plot);
  return {
    progress: Math.max(0, Math.min(1, grown / plot.durationMs)),
    ready,
    needsWater: !ready && !plot.watered && !rain,
    remaining: ready ? 0 : Math.ceil((plot.durationMs - grown) / 1000),
    yield: output.yield,
    bonus: output.bonus,
  };
}

function refreshContracts(state: FarmState, now: number): void {
  for (const contract of state.contracts) {
    if (contract.status === 'available' && now > contract.boardAt + BOARD_PERIOD) contract.status = 'expired';
    if (contract.status === 'active' && now > contract.deadline) contract.status = 'expired';
  }
  // Keep open work and a compact recent terminal history; otherwise a board refresh
  // every six hours eventually exceeds persistence's bounded contract list.
  const terminal = state.contracts
    .filter((contract) => contract.status === 'delivered' || contract.status === 'expired' || contract.status === 'rejected')
    .sort((left, right) => Math.max(right.deadline, right.boardAt) - Math.max(left.deadline, left.boardAt));
  const retainedTerminal = new Set(terminal.slice(0, 100).map((contract) => contract.id));
  state.contracts = state.contracts.filter((contract) => !['delivered', 'expired', 'rejected'].includes(contract.status) || retainedTerminal.has(contract.id));
  if (!state.contracts.some((contract) => contract.status === 'available')) {
    state.contracts.push(...createBoard(now, state.contracts.length));
  }
}

function finishJobs(state: FarmState, now: number): void {
  const remaining: FactoryJob[] = [];
  for (const job of state.jobs) {
    if (job.finishAt > now) {
      remaining.push(job);
      continue;
    }
    state.inventory[job.product] += job.output;
    addMetric(state, 'crafted', job.output, now);
    addXp(state, job.output * 5);
  }
  state.jobs = remaining;
}

function finishShipments(state: FarmState, now: number): void {
  const remaining: Shipment[] = [];
  for (const shipment of state.shipments) {
    if (shipment.finishAt > now) {
      remaining.push(shipment);
      continue;
    }
    const contract = state.contracts.find((candidate) => candidate.id === shipment.contractId);
    if (contract?.status === 'shipping') {
      const reward = contractReward(state, contract, shipment.finishAt);
      if (reward > 0) {
        contract.status = 'delivered';
        receiveRevenue(state, reward, `مكافأة شحن: ${contract.client}`, now);
        addMetric(state, 'contracts', 1, now);
        state.reputation = Math.min(100, state.reputation + 6);
        addXp(state, Math.ceil(reward / 9));
      } else {
        contract.status = 'expired';
      }
    }
  }
  state.shipments = remaining;
}

function plantInternal(state: FarmState, index: number, crop: CropId, now: number): boolean {
  if (!state.plots[index] || state.plots[index] === null) {
    if (state.seeds[crop] < 1) return false;
    state.seeds[crop] -= 1;
    const rain = weather(state, now).kind === 'rain';
    state.plots[index] = {
      crop,
      plantedAt: now,
      watered: rain,
      growthMs: 0,
      growthUpdatedAt: now,
      durationMs: durationForPlant(state, crop, now),
      waterCost: waterNeed(state, crop, now),
      fertilized: false,
    };
    addMetric(state, 'planted', 1, now);
    addXp(state, 2);
    return true;
  }
  return false;
}

function waterInternal(state: FarmState, index: number, now: number): boolean {
  const plot = state.plots[index];
  if (!plot || plot.watered) return false;
  const cost = weather(state, now).kind === 'rain' ? 0 : plot.waterCost;
  if (state.water < cost) return false;
  state.water -= cost;
  plot.watered = true;
  plot.growthUpdatedAt = now;
  addMetric(state, 'watered', 1, now);
  return true;
}

function harvestInternal(state: FarmState, index: number, now: number, knownYield?: number): boolean {
  const plot = state.plots[index];
  if (!plot || plot.growthMs < plot.durationMs) return false;
  const output = knownYield ?? plotYield(state, index, plot).yield;
  if (usedStorage(state) + output > capacity(state)) return false;
  state.inventory[plot.crop] += output;
  state.plots[index] = null;
  addMetric(state, 'harvested', output, now);
  addXp(state, output * 3);
  return true;
}

function startProduction(state: FarmState, product: ProductId, now: number): boolean {
  const recipe = RECIPES[product];
  if (state.upgrades.factory < 1 || level(state) < recipe.level) return false;
  if (state.jobs.length >= state.upgrades.factory * 2) return false;
  if (state.inventory[recipe.crop] < recipe.input || state.materials.boxes < recipe.boxes || state.coins < recipe.cost) return false;
  if (usedStorage(state) - recipe.input - recipe.boxes + recipe.output > capacity(state)) return false;
  state.inventory[recipe.crop] -= recipe.input;
  state.materials.boxes -= recipe.boxes;
  spend(state, recipe.cost, `تشغيل ${recipe.name}`, now);
  const seconds = Math.max(2, Math.round(recipe.seconds * (1 - state.upgrades.factory * 0.1)));
  state.jobs.push({ id: makeId('job', state, now), product, finishAt: now + seconds * 1000, output: recipe.output });
  return true;
}

export interface ShippingQuote {
  capacity: number;
  total: number;
  cost: number;
  seconds: number;
  eligible: boolean;
  reason: string | null;
}

/** اقتباس الشحن هو المصدر نفسه للسعة والكلفة والوقت الذي تستعمله الشحنة الفعلية. */
export function shippingQuote(state: FarmState, contract: FarmContract, now = Date.now()): ShippingQuote {
  const time = cleanNow(now);
  const truck = state.upgrades.truck > 0;
  const capacityForTrip = truck ? 200 : state.upgrades.vehicle > 0 ? 60 : 0;
  const total = Object.values(contract.requirements).reduce((sum, quantity) => sum + quantity, 0);
  const seconds = truck ? 20 : 45;
  const cost = Math.max(5, Math.ceil(contract.reward * (truck ? 0.05 : 0.08)));
  let reason: string | null = null;
  if (contract.status !== 'active') reason = 'العقد ليس نشطاً للشحن.';
  else if (!state.workers.driver) reason = 'تحتاج إلى توظيف سائق للشحن.';
  else if (capacityForTrip < total) reason = 'تحتاج مركبة بسعة كافية لهذه الشحنة.';
  else if (time + seconds * 1000 > contract.deadline) reason = 'لن تصل الشحنة قبل مهلة العقد.';
  else if (Object.entries(contract.requirements).some(([id, quantity]) => !isItem(id) || state.inventory[id] < quantity)) reason = 'متطلبات العقد غير مكتملة للشحن.';
  else if (state.coins < cost) reason = 'العملات غير كافية لتكلفة الشحن.';
  return { capacity: capacityForTrip, total, cost, seconds, eligible: reason === null, reason };
}

/** المكافأة الفعلية: +5% عند التسليم في النصف الأول؛ الصفر يعني وصولاً متأخراً. */
export function contractReward(_state: FarmState, contract: FarmContract, now = Date.now()): number {
  const time = cleanNow(now);
  if (time > contract.deadline) return 0;
  const halfway = contract.acceptedAt + (contract.deadline - contract.acceptedAt) / 2;
  return Math.round(contract.reward * (time <= halfway ? 1.05 : 1));
}

function shipInternal(state: FarmState, contract: FarmContract, now: number): boolean {
  const quote = shippingQuote(state, contract, now);
  if (!quote.eligible) return false;
  for (const [id, quantity] of Object.entries(contract.requirements)) state.inventory[id as ItemId] -= quantity;
  spend(state, quote.cost, `شحن عقد: ${contract.client}`, now);
  contract.status = 'shipping';
  state.shipments.push({ id: makeId('shipment', state, now), contractId: contract.id, finishAt: now + quote.seconds * 1000, cost: quote.cost });
  return true;
}

function runWorkers(state: FarmState, now: number, elapsed: number): void {
  const active = WORKER_IDS.filter((id) => state.workers[id] && state.workerActive[id]);
  if (active.length === 0) {
    state.stats.workerRemainder = 0;
    return;
  }
  const availableMs = Math.min(MAX_WORKER_CATCHUP, elapsed) + state.stats.workerRemainder;
  const rounds = Math.min(10, Math.floor(availableMs / 30000));
  state.stats.workerRemainder = availableMs % 30000;
  if (rounds < 1) return;
  const rawWage = active.reduce((sum, id) => sum + WORKERS[id].wage, 0) * rounds / 2;
  const wage = Math.max(1, Math.ceil(rawWage * (state.workers.manager && state.workerActive.manager ? 0.85 : 1)));
  if (state.coins < wage) {
    for (const id of active) state.workerActive[id] = false;
    return;
  }
  spend(state, wage, 'أجور فريق العمل', now);
  addMetric(state, 'workerWages', wage, now);
  for (let cycle = 0; cycle < rounds; cycle += 1) {
    if (state.workers.planter && state.workerActive.planter) {
      const crop = CROP_IDS.find((id) => state.seeds[id] > 0 && level(state) >= CROPS[id].level);
      const index = state.plots.findIndex((plot) => plot === null);
      if (crop && index >= 0) plantInternal(state, index, crop, now);
    }
    if (state.workers.waterer && state.workerActive.waterer) {
      const index = state.plots.findIndex((plot) => plot !== null && !plot.watered);
      if (index >= 0) waterInternal(state, index, now);
    }
    if (state.workers.harvester && state.workerActive.harvester) {
      const index = state.plots.findIndex((plot) => plot !== null && plot.growthMs >= plot.durationMs);
      if (index >= 0) harvestInternal(state, index, now);
    }
    if (state.workers.factory && state.workerActive.factory && state.upgrades.factory > 0) {
      const recipe = PRODUCT_IDS.find((id) => startProduction(state, id, now));
      void recipe;
    }
    if (state.workers.driver && state.workerActive.driver) {
      const contract = state.contracts.find((candidate) => candidate.status === 'active' && candidate.deadline >= now);
      if (contract) shipInternal(state, contract, now);
    }
  }
}

/** تقدم الوقت فقط للأمام: نمو المحاصيل والعقود يستمران أثناء الغياب، لكن العمال محددون بخمس دقائق. */
export function tick(state: FarmState, now = Date.now()): void {
  const requested = cleanNow(now);
  const time = Math.max(state.lastTick, requested);
  const elapsed = Math.max(0, time - state.lastTick);
  const waterMs = state.stats.waterRemainder + elapsed;
  if (state.water < 100) state.water = Math.min(100, state.water + Math.floor(waterMs / 10000));
  state.stats.waterRemainder = waterMs % 10000;
  for (const plot of state.plots) if (plot) advancePlot(state, plot, time);
  finishJobs(state, time);
  finishShipments(state, time);
  refreshContracts(state, time);
  runWorkers(state, time, elapsed);
  state.lastTick = time;
}

function fail(message: string): ActionResult {
  return { ok: false, message };
}

function success(message: string): ActionResult {
  return { ok: true, message };
}

function contractFromPayload(state: FarmState, payload: Record<string, unknown>): FarmContract | undefined {
  return typeof payload.id === 'string' ? state.contracts.find((contract) => contract.id === payload.id) : undefined;
}

/**
 * مفتاح المطالبة الدورية مرتبط بكتلة UTC: اليوم floor(now / 86400000)
 * والأسبوع floor(now / 604800000). الإنجازات الدائمة تستعمل معرفها فقط.
 */
export function questClaimKey(quest: Quest, now = Date.now()): string {
  const time = cleanNow(now);
  return quest.period === 'daily' ? `${quest.id}:${dayBucket(time)}` : quest.period === 'weekly' ? `${quest.id}:${weekBucket(time)}` : quest.id;
}

export function questProgress(state: FarmState, quest: Quest, now = Date.now()): number {
  const time = cleanNow(now);
  if (!quest.period) {
    if (quest.metric === 'land') return state.upgrades.land;
    if (quest.metric === 'hired') return WORKER_IDS.filter((id) => state.workers[id]).length;
    if (quest.metric === 'reputation') return state.reputation;
    return state.stats[quest.metric];
  }
  const current = state.stats.periods[quest.period];
  const expected = quest.period === 'daily' ? dayBucket(time) : weekBucket(time);
  return current.bucket === expected ? current[quest.metric as Metric] : 0;
}

export function canClaim(state: FarmState, quest: Quest, now = Date.now()): boolean {
  const time = cleanNow(now);
  return questProgress(state, quest, time) >= quest.target && !state.claimed.includes(questClaimKey(quest, time));
}

/** كل إجراء يتحقق كاملاً قبل خصم الموارد الخاصة به؛ رسائل النتيجة عربية ومناسبة للواجهة. */
export function action(state: FarmState, type: string, payload: any = {}, now = Date.now()): ActionResult {
  tick(state, now);
  const time = state.lastTick;
  const data = payloadObject(payload);

  if (type === 'start') {
    if (state.started) return fail('بدأت المزرعة بالفعل.');
    state.started = true;
    return success('أهلاً بك في مزرعتك!');
  }

  if (type === 'plant') {
    const indexValue = data.index;
    const crop = data.crop;
    if (typeof indexValue !== 'number' || !Number.isInteger(indexValue) || indexValue < 0 || indexValue >= state.plots.length || !isCrop(crop)) return fail('بيانات الزراعة غير صحيحة.');
    const index = indexValue as number;
    if (state.plots[index] !== null) return fail('هذه القطعة مشغولة بالفعل.');
    if (level(state) < CROPS[crop].level) return fail('مستواك لا يفتح هذا المحصول بعد.');
    if (state.seeds[crop] < 1) return fail('لا توجد بذور كافية.');
    plantInternal(state, index, crop, time);
    return success(`تمت زراعة ${CROPS[crop].name}.`);
  }

  if (type === 'water') {
    const indexValue = data.index;
    if (typeof indexValue !== 'number' || !Number.isInteger(indexValue) || indexValue < 0 || indexValue >= state.plots.length) return fail('اختر قطعة مزروعة صالحة.');
    const index = indexValue as number;
    if (!state.plots[index]) return fail('اختر قطعة مزروعة صالحة.');
    if (state.plots[index]?.watered) return fail('هذه القطعة سُقيت بالفعل.');
    const cost = weather(state, time).kind === 'rain' ? 0 : state.plots[index]!.waterCost;
    if (state.water < cost) return fail('لا يوجد ماء كافٍ؛ استخدم إعادة التعبئة المجانية.');
    waterInternal(state, index, time);
    return success(cost === 0 ? 'تكفل المطر بالسقي.' : 'تم سقي القطعة.');
  }

  if (type === 'waterAll') {
    const indices = state.plots.map((plot, index) => plot && !plot.watered ? index : -1).filter((index) => index >= 0);
    if (indices.length === 0) return fail('لا توجد قطع تحتاج إلى السقي.');
    const total = weather(state, time).kind === 'rain' ? 0 : indices.reduce((sum, index) => sum + state.plots[index]!.waterCost, 0);
    if (state.water < total) return fail('لا يوجد ماء كافٍ لسقي جميع القطع دفعة واحدة.');
    for (const index of indices) waterInternal(state, index, time);
    return success(`تم سقي ${indices.length} قطع.`);
  }

  if (type === 'harvest' || type === 'harvestAll') {
    const indices = type === 'harvest'
      ? (Number.isInteger(data.index) ? [data.index as number] : [])
      : state.plots.map((plot, index) => plot && plot.growthMs >= plot.durationMs ? index : -1).filter((index) => index >= 0);
    if (indices.length === 0 || indices.some((index) => index < 0 || index >= state.plots.length || !state.plots[index] || state.plots[index]!.growthMs < state.plots[index]!.durationMs)) return fail('لا توجد محاصيل ناضجة للحصاد.');
    const yields = indices.map((index) => plotYield(state, index, state.plots[index]!).yield);
    if (usedStorage(state) + yields.reduce((sum, value) => sum + value, 0) > capacity(state)) return fail('المخزن ممتلئ؛ بع بعض المخزون أولاً.');
    indices.forEach((index, position) => harvestInternal(state, index, time, yields[position]));
    return success(`تم حصاد ${indices.length} قطع.`);
  }

  if (type === 'refill') {
    state.water = 100;
    return success('أعيد ملء خزان الماء مجاناً.');
  }

  if (type === 'buySeeds') {
    const crop = data.crop;
    const quantity = data.quantity;
    if (!isCrop(crop) || !positiveInteger(quantity)) return fail('حدد محصولاً وكمية صحيحة.');
    if (level(state) < CROPS[crop].level) return fail('هذا المحصول غير مفتوح لمستواك.');
    const cost = CROPS[crop].seedPrice * quantity;
    if (state.coins < cost) return fail('العملات غير كافية لشراء البذور.');
    if (usedStorage(state) + quantity > capacity(state)) return fail('لا توجد سعة كافية للبذور.');
    spend(state, cost, `بذور ${CROPS[crop].name}`, time);
    state.seeds[crop] += quantity;
    return success('تم شراء البذور.');
  }

  if (type === 'buyMaterial') {
    const material = data.material;
    const quantity = data.quantity;
    if ((material !== 'boxes' && material !== 'fertilizer') || !positiveInteger(quantity)) return fail('المادة أو الكمية غير صحيحة.');
    const cost = MATERIAL_PRICES[material] * quantity;
    if (state.coins < cost) return fail('العملات غير كافية لشراء هذه المادة.');
    if (usedStorage(state) + quantity > capacity(state)) return fail('المخزن ممتلئ.');
    spend(state, cost, material === 'boxes' ? 'شراء صناديق' : 'شراء سماد', time);
    state.materials[material] += quantity;
    return success('تم شراء المواد.');
  }

  if (type === 'fertilize') {
    const indexValue = data.index;
    if (typeof indexValue !== 'number' || !Number.isInteger(indexValue) || indexValue < 0 || indexValue >= state.plots.length) return fail('اختر قطعة مزروعة صالحة.');
    const index = indexValue as number;
    if (!state.plots[index]) return fail('اختر قطعة مزروعة صالحة.');
    const plot = state.plots[index]!;
    if (plot.fertilized) return fail('استخدم السماد لهذه القطعة بالفعل.');
    if (state.materials.fertilizer < 1) return fail('لا يوجد سماد كافٍ.');
    state.materials.fertilizer -= 1;
    plot.fertilized = true;
    plot.durationMs = Math.max(plot.growthMs + 1000, Math.round(plot.durationMs * 0.8));
    return success('تم تسميد القطعة وتسريع نموها.');
  }

  if (type === 'sell') {
    const product = data.product;
    const quantity = data.quantity;
    const channel = data.channel === undefined ? 'market' : data.channel;
    if (!isItem(product) || !positiveInteger(quantity) || (channel !== 'market' && channel !== 'shop')) return fail('بيانات البيع غير صحيحة.');
    const unit = salePrice(state, product, channel, time);
    if (data.expectedUnit !== undefined && data.expectedUnit !== unit) return fail('تغير سعر البيع؛ راجع التأكيد قبل البيع.');
    if (state.inventory[product] < quantity) return fail('لا توجد كمية كافية للبيع.');
    if (channel === 'shop') {
      if (state.upgrades.shop < 1 || state.upgrades.packaging < 1 || state.reputation < 10) return fail('بيع المتجر يحتاج متجراً وتغليفاً وسمعة 10.');
      if (state.materials.boxes < quantity) return fail('بيع المتجر يحتاج صندوق تغليف لكل وحدة.');
    }
    const revenue = unit * quantity;
    state.inventory[product] -= quantity;
    if (channel === 'shop') state.materials.boxes -= quantity;
    receiveRevenue(state, revenue, channel === 'shop' ? `بيع متجر: ${product}` : `بيع سوق: ${product}`, time);
    addMetric(state, 'sold', quantity, time);
    state.reputation = Math.min(100, state.reputation + Math.max(1, Math.floor(quantity / 5)));
    addXp(state, Math.ceil(revenue / 5));
    return success(`تم بيع ${quantity} مقابل ${revenue} عملة.`);
  }

  if (type === 'upgrade') {
    const id = data.id;
    if (!isUpgrade(id)) return fail('الترقية غير معروفة.');
    if (level(state) < UPGRADES[id].level) return fail('مستواك لا يفتح هذه الترقية.');
    const cost = upgradeCost(state, id);
    if (cost === 0) return fail('هذه الترقية بلغت حدها الأقصى.');
    if (state.coins < cost) return fail('العملات غير كافية للترقية.');
    spend(state, cost, `ترقية ${UPGRADES[id].name}`, time);
    state.upgrades[id] += 1;
    if (id === 'land') state.plots.push(...Array.from({ length: 4 }, () => null));
    return success(`تمت ترقية ${UPGRADES[id].name}.`);
  }

  if (type === 'hire') {
    const id = data.id;
    if (!isWorker(id)) return fail('العامل غير معروف.');
    if (state.workers[id]) return fail('هذا العامل ضمن فريقك بالفعل.');
    if (level(state) < WORKERS[id].level) return fail('مستواك لا يفتح هذا العامل.');
    if (state.coins < WORKERS[id].cost) return fail('العملات غير كافية للتوظيف.');
    spend(state, WORKERS[id].cost, `توظيف ${WORKERS[id].name}`, time);
    state.workers[id] = true;
    state.workerActive[id] = true;
    return success(`تم توظيف ${WORKERS[id].name}.`);
  }

  if (type === 'toggleWorker') {
    const id = data.id;
    if (!isWorker(id) || !state.workers[id]) return fail('العامل غير موظف.');
    state.workerActive[id] = !state.workerActive[id];
    return success(state.workerActive[id] ? 'تم تشغيل العامل.' : 'تم إيقاف العامل.');
  }

  if (type === 'acceptContract' || type === 'rejectContract' || type === 'deliverContract' || type === 'shipContract') {
    const contract = contractFromPayload(state, data);
    if (!contract) return fail('العقد غير موجود.');
    if (type === 'acceptContract') {
      if (contract.status !== 'available') return fail('لا يمكن قبول هذا العقد الآن.');
      if (level(state) < contract.level) return fail('مستواك لا يفتح هذا العقد.');
      contract.status = 'active';
      contract.acceptedAt = time;
      contract.deadline = time + contract.duration * 1000;
      return success('تم قبول العقد.');
    }
    if (type === 'rejectContract') {
      if (contract.status !== 'available') return fail('لا يمكن رفض عقد غير متاح.');
      contract.status = 'rejected';
      return success('تم رفض العقد.');
    }
    if (contract.status !== 'active') return fail('العقد ليس نشطاً للتسليم.');
    if (time > contract.deadline) {
      contract.status = 'expired';
      return fail('انتهت مهلة هذا العقد.');
    }
    if (type === 'deliverContract') {
      if (Object.entries(contract.requirements).some(([id, quantity]) => !isItem(id) || state.inventory[id] < quantity)) return fail('متطلبات العقد غير مكتملة.');
      const reward = contractReward(state, contract, time);
      for (const [id, quantity] of Object.entries(contract.requirements)) state.inventory[id as ItemId] -= quantity;
      contract.status = 'delivered';
      receiveRevenue(state, reward, `تسليم عقد: ${contract.client}`, time);
      addMetric(state, 'contracts', 1, time);
      state.reputation = Math.min(100, state.reputation + 5);
      addXp(state, Math.ceil(reward / 10));
      return success(`تم تسليم العقد وربح ${reward} عملة.`);
    }
    const quote = shippingQuote(state, contract, time);
    if (!quote.eligible) return fail(quote.reason!);
    if (!shipInternal(state, contract, time)) return fail('تعذر إرسال الشحنة.');
    return success('انطلقت الشحنة، والمكافأة عند الوصول.');
  }

  if (type === 'produce') {
    const product = data.product;
    if (!isProduct(product)) return fail('الوصفة غير معروفة.');
    const recipe = RECIPES[product];
    if (state.upgrades.factory < 1) return fail('ابنِ المصنع أولاً.');
    if (level(state) < recipe.level) return fail('مستواك لا يفتح هذه الوصفة.');
    if (state.inventory[recipe.crop] < recipe.input || state.materials.boxes < recipe.boxes) return fail('المكونات أو الصناديق غير كافية.');
    if (state.coins < recipe.cost) return fail('العملات غير كافية لتشغيل المصنع.');
    if (state.jobs.length >= state.upgrades.factory * 2) return fail('خطوط المصنع مشغولة؛ كل مستوى يتيح خطين متوازيين.');
    if (usedStorage(state) - recipe.input - recipe.boxes + recipe.output > capacity(state)) return fail('لا تكفي السعة بعد تحويل المدخلات إلى مخرج المصنع.');
    if (!startProduction(state, product, time)) return fail('تعذر بدء الإنتاج.');
    return success(`بدأ إنتاج ${recipe.name}.`);
  }

  if (type === 'claim') {
    const quest = typeof data.id === 'string' ? QUESTS.find((candidate) => candidate.id === data.id) : undefined;
    if (!quest) return fail('الإنجاز غير معروف.');
    if (!canClaim(state, quest, time)) return fail('لم يكتمل الإنجاز أو تم استلامه بالفعل.');
    state.claimed.push(questClaimKey(quest, time));
    if (state.claimed.length > 200) state.claimed.splice(0, state.claimed.length - 200);
    receiveQuest(state, quest.reward, `مكافأة إنجاز: ${quest.name}`, time);
    addXp(state, quest.xp);
    return success(`تم استلام مكافأة ${quest.name}.`);
  }

  if (type === 'brand') {
    const name = data.name;
    const logo = data.logo;
    if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 24 || (logo !== undefined && (typeof logo !== 'string' || logo.trim().length > 16))) return fail('اسم العلامة أو شعارها غير صالح.');
    state.brand.name = name.trim();
    if (typeof logo === 'string') state.brand.logo = logo.trim();
    return success('تم تحديث العلامة التجارية.');
  }

  if (type === 'settings') {
    if ((data.muted !== undefined && typeof data.muted !== 'boolean') || (data.reducedMotion !== undefined && typeof data.reducedMotion !== 'boolean')) return fail('إعدادات العرض غير صحيحة.');
    if (typeof data.muted === 'boolean') state.settings.muted = data.muted;
    if (typeof data.reducedMotion === 'boolean') state.settings.reducedMotion = data.reducedMotion;
    return success('تم حفظ الإعدادات.');
  }

  return fail('الإجراء غير معروف.');
}
