import {
  capacity,
  createState,
  type FarmContract,
  type FarmState,
  type FarmStats,
  type FactoryJob,
  type Plot,
  type Shipment,
  usedStorage,
} from './engine';
import { CROPS, PRODUCTS, UPGRADES, WORKERS, type CropId, type ItemId, type ProductId, type UpgradeId, type WorkerId } from './data';

export const SAVE_KEY = 'pocket-farm-tycoon.save.v1';
const BACKUP_KEY = `${SAVE_KEY}.backup`;
const CORRUPT_KEY = `${SAVE_KEY}.corrupt`;
const MAX_CORRUPT_TEXT = 250_000;
const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
const MAX_VALUE = 1_000_000_000_000;
const CROP_IDS = Object.keys(CROPS) as CropId[];
const PRODUCT_IDS = Object.keys(PRODUCTS) as ProductId[];
const ITEM_IDS = [...CROP_IDS, ...PRODUCT_IDS] as ItemId[];
const UPGRADE_IDS = Object.keys(UPGRADES) as UpgradeId[];
const WORKER_IDS = Object.keys(WORKERS) as WorkerId[];
const METRICS = ['revenue', 'expenses', 'planted', 'harvested', 'sold', 'contracts', 'crafted', 'earned', 'watered', 'workerWages'] as const;

function safeNow(now: number): number {
  return Number.isSafeInteger(now) && now >= 0 ? now : Date.now();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** يرفض مفاتيح تلويث الكائنات في أي عمق، حتى عند استدعاء validateState مباشرة. */
function isSafeTree(value: unknown, seen = new Set<unknown>()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.every((entry) => isSafeTree(entry, seen));
  if (!isRecord(value)) return false;
  return Object.entries(value).every(([key, entry]) => key !== '__proto__' && key !== 'prototype' && key !== 'constructor' && isSafeTree(entry, seen));
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const found = Object.keys(value);
  return found.length === keys.length && found.every((key) => keys.includes(key));
}

function numberIn(value: unknown, minimum: number, maximum = MAX_VALUE, integer = true): value is number {
  return typeof value === 'number' && Number.isFinite(value) && (integer ? Number.isSafeInteger(value) : true) && value >= minimum && value <= maximum;
}

function stringIn(value: unknown, maximum: number, minimum = 0): value is string {
  return typeof value === 'string' && value.length >= minimum && value.length <= maximum;
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

function recordNumbers<T extends string>(value: unknown, keys: readonly T[], maximum = MAX_VALUE): Record<T, number> | null {
  if (!isRecord(value) || !exactKeys(value, keys)) return null;
  const result = {} as Record<T, number>;
  for (const key of keys) {
    if (!numberIn(value[key], 0, maximum)) return null;
    result[key] = value[key] as number;
  }
  return result;
}

function recordBooleans<T extends string>(value: unknown, keys: readonly T[]): Record<T, boolean> | null {
  if (!isRecord(value) || !exactKeys(value, keys)) return null;
  const result = {} as Record<T, boolean>;
  for (const key of keys) {
    if (typeof value[key] !== 'boolean') return null;
    result[key] = value[key] as boolean;
  }
  return result;
}

function cappedTime(value: unknown, now: number, future: number): number | null {
  if (!numberIn(value, 0, Number.MAX_SAFE_INTEGER)) return null;
  return Math.min(value, now + future);
}

function pastTime(value: unknown, now: number): number | null {
  if (!numberIn(value, 0, Number.MAX_SAFE_INTEGER)) return null;
  return Math.min(value, now);
}

function parsePlot(value: unknown, now: number): Plot | null {
  if (!isRecord(value) || !exactKeys(value, ['crop', 'plantedAt', 'watered', 'growthMs', 'growthUpdatedAt', 'durationMs', 'waterCost', 'fertilized'])) return null;
  if (!isCrop(value.crop) || typeof value.watered !== 'boolean' || typeof value.fertilized !== 'boolean') return null;
  const plantedAt = pastTime(value.plantedAt, now);
  const growthUpdatedAt = pastTime(value.growthUpdatedAt, now);
  if (plantedAt === null || growthUpdatedAt === null || !numberIn(value.durationMs, 1000, 24 * 60 * 60 * 1000) || !numberIn(value.growthMs, 0, value.durationMs) || !numberIn(value.waterCost, 0, 100)) return null;
  return { crop: value.crop, plantedAt, watered: value.watered, growthMs: value.growthMs, growthUpdatedAt, durationMs: value.durationMs, waterCost: value.waterCost, fertilized: value.fertilized };
}

function parseJob(value: unknown, now: number): FactoryJob | null {
  if (!isRecord(value) || !exactKeys(value, ['id', 'product', 'finishAt', 'output'])) return null;
  const finishAt = cappedTime(value.finishAt, now, 7 * DAY);
  if (!stringIn(value.id, 100, 1) || !isProduct(value.product) || finishAt === null || !numberIn(value.output, 1, 1000)) return null;
  return { id: value.id, product: value.product, finishAt, output: value.output };
}

function parseRequirements(value: unknown): Record<string, number> | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  if (entries.length < 1 || entries.length > ITEM_IDS.length) return null;
  const result: Record<string, number> = {};
  for (const [id, quantity] of entries) {
    if (!isItem(id) || !numberIn(quantity, 1, 10000)) return null;
    result[id] = quantity;
  }
  return result;
}

function parseContract(value: unknown, now: number): FarmContract | null {
  const keys = ['id', 'client', 'requirements', 'reward', 'duration', 'level', 'status', 'deadline', 'acceptedAt', 'boardAt'];
  if (!isRecord(value) || !exactKeys(value, keys)) return null;
  const requirements = parseRequirements(value.requirements);
  const deadline = cappedTime(value.deadline, now, 21 * DAY);
  const acceptedAt = pastTime(value.acceptedAt, now);
  const boardAt = pastTime(value.boardAt, now);
  const statuses = ['available', 'active', 'delivered', 'expired', 'rejected', 'shipping'];
  if (!stringIn(value.id, 100, 1) || !stringIn(value.client, 100, 1) || !requirements || !numberIn(value.reward, 1) || !numberIn(value.duration, 1, 7 * DAY / 1000) || !numberIn(value.level, 1, 100) || typeof value.status !== 'string' || !statuses.includes(value.status) || deadline === null || acceptedAt === null || boardAt === null) return null;
  return { id: value.id, client: value.client, requirements, reward: value.reward, duration: value.duration, level: value.level, status: value.status as FarmContract['status'], deadline, acceptedAt, boardAt };
}

function parseShipment(value: unknown, now: number): Shipment | null {
  if (!isRecord(value) || !exactKeys(value, ['id', 'contractId', 'finishAt', 'cost'])) return null;
  const finishAt = cappedTime(value.finishAt, now, DAY);
  if (!stringIn(value.id, 100, 1) || !stringIn(value.contractId, 100, 1) || finishAt === null || !numberIn(value.cost, 0)) return null;
  return { id: value.id, contractId: value.contractId, finishAt, cost: value.cost };
}

function parsePeriod(value: unknown, now: number, unit: number): FarmStats['periods']['daily'] | null {
  const keys = ['bucket', ...METRICS];
  if (!isRecord(value) || !exactKeys(value, keys) || !numberIn(value.bucket, 0, Number.MAX_SAFE_INTEGER)) return null;
  const current = Math.floor(now / unit);
  if (value.bucket > current) return { bucket: current, revenue: 0, expenses: 0, planted: 0, harvested: 0, sold: 0, contracts: 0, crafted: 0, earned: 0, watered: 0, workerWages: 0 };
  const result = { bucket: value.bucket } as FarmStats['periods']['daily'];
  for (const metric of METRICS) {
    if (!numberIn(value[metric], 0)) return null;
    result[metric] = value[metric] as number;
  }
  return result;
}

function parseStats(value: unknown, now: number): FarmStats | null {
  const keys = [...METRICS, 'waterRemainder', 'workerRemainder', 'periods'];
  if (!isRecord(value) || !exactKeys(value, keys)) return null;
  const result = {} as FarmStats;
  for (const metric of METRICS) {
    if (!numberIn(value[metric], 0)) return null;
    result[metric] = value[metric] as number;
  }
  if (!numberIn(value.waterRemainder, 0, 9999) || !numberIn(value.workerRemainder, 0, 29999) || !isRecord(value.periods) || !exactKeys(value.periods, ['daily', 'weekly'])) return null;
  const daily = parsePeriod(value.periods.daily, now, DAY);
  const weekly = parsePeriod(value.periods.weekly, now, WEEK);
  if (!daily || !weekly) return null;
  result.waterRemainder = value.waterRemainder;
  result.workerRemainder = value.workerRemainder;
  result.periods = { daily, weekly };
  return result;
}

/**
 * يعيد نسخة آمنة ومقيدة من الحفظ، أو null عند أي حقل/معرف/عداد غير صالح.
 * الأوقات المستقبلية تقيد بدلاً من حجز التقدم عند رجوع ساعة الجهاز.
 */
export function validateState(raw: unknown, now = Date.now()): FarmState | null {
  const time = safeNow(now);
  const topKeys = ['version', 'coins', 'xp', 'water', 'seeds', 'inventory', 'materials', 'plots', 'upgrades', 'workers', 'workerActive', 'jobs', 'contracts', 'shipments', 'brand', 'reputation', 'stats', 'ledger', 'claimed', 'createdAt', 'lastTick', 'settings', 'started'];
  if (!isSafeTree(raw) || !isRecord(raw) || !exactKeys(raw, topKeys) || raw.version !== 1 || !numberIn(raw.coins, 0) || !numberIn(raw.xp, 0) || !numberIn(raw.water, 0, 100) || !numberIn(raw.reputation, 0, 100) || typeof raw.started !== 'boolean') return null;
  const seeds = recordNumbers(raw.seeds, CROP_IDS);
  const inventory = recordNumbers(raw.inventory, ITEM_IDS);
  const upgrades = recordNumbers(raw.upgrades, UPGRADE_IDS, 100);
  const workers = recordBooleans(raw.workers, WORKER_IDS);
  const workerActive = recordBooleans(raw.workerActive, WORKER_IDS);
  if (!seeds || !inventory || !upgrades || !workers || !workerActive || !isRecord(raw.materials) || !exactKeys(raw.materials, ['boxes', 'fertilizer']) || !numberIn(raw.materials.boxes, 0) || !numberIn(raw.materials.fertilizer, 0)) return null;
  for (const id of UPGRADE_IDS) if (upgrades[id] > UPGRADES[id].max) return null;
  for (const id of WORKER_IDS) if (workerActive[id] && !workers[id]) return null;
  if (!Array.isArray(raw.plots) || raw.plots.length !== 12 + upgrades.land * 4 || raw.plots.length > 48) return null;
  const plots: Array<Plot | null> = [];
  for (const rawPlot of raw.plots) {
    if (rawPlot === null) plots.push(null);
    else {
      const plot = parsePlot(rawPlot, time);
      if (!plot) return null;
      plots.push(plot);
    }
  }
  if (!Array.isArray(raw.jobs) || raw.jobs.length > 100 || !Array.isArray(raw.contracts) || raw.contracts.length > 300 || !Array.isArray(raw.shipments) || raw.shipments.length > 100) return null;
  const jobs: FactoryJob[] = [];
  const jobIds = new Set<string>();
  for (const rawJob of raw.jobs) {
    const job = parseJob(rawJob, time);
    if (!job || jobIds.has(job.id)) return null;
    jobIds.add(job.id);
    jobs.push(job);
  }
  const contracts: FarmContract[] = [];
  const contractIds = new Set<string>();
  for (const rawContract of raw.contracts) {
    const contract = parseContract(rawContract, time);
    if (!contract || contractIds.has(contract.id)) return null;
    contractIds.add(contract.id);
    contracts.push(contract);
  }
  const shipments: Shipment[] = [];
  const shipmentIds = new Set<string>();
  const shippingContracts = new Set<string>();
  for (const rawShipment of raw.shipments) {
    const shipment = parseShipment(rawShipment, time);
    const contract = shipment ? contracts.find((candidate) => candidate.id === shipment.contractId) : undefined;
    if (!shipment || shipmentIds.has(shipment.id) || shippingContracts.has(shipment.contractId) || contract?.status !== 'shipping') return null;
    shipmentIds.add(shipment.id);
    shippingContracts.add(shipment.contractId);
    shipments.push(shipment);
  }
  if (!isRecord(raw.brand) || !exactKeys(raw.brand, ['name', 'logo']) || !stringIn(raw.brand.name, 24, 1) || !stringIn(raw.brand.logo, 16) || !isRecord(raw.settings) || !exactKeys(raw.settings, ['muted', 'reducedMotion']) || typeof raw.settings.muted !== 'boolean' || typeof raw.settings.reducedMotion !== 'boolean') return null;
  const stats = parseStats(raw.stats, time);
  const createdAt = pastTime(raw.createdAt, time);
  const lastTick = pastTime(raw.lastTick, time);
  if (!stats || createdAt === null || lastTick === null || !Array.isArray(raw.ledger) || raw.ledger.length > 500 || !Array.isArray(raw.claimed) || raw.claimed.length > 200) return null;
  const ledger: FarmState['ledger'] = [];
  const ledgerIds = new Set<string>();
  for (const row of raw.ledger) {
    if (!isRecord(row) || !exactKeys(row, ['id', 'time', 'label', 'amount']) || !stringIn(row.id, 100, 1) || !stringIn(row.label, 160, 1) || !numberIn(row.amount, -MAX_VALUE, MAX_VALUE) || ledgerIds.has(row.id)) return null;
    const rowTime = pastTime(row.time, time);
    if (rowTime === null) return null;
    ledgerIds.add(row.id);
    ledger.push({ id: row.id, time: rowTime, label: row.label, amount: row.amount });
  }
  const claimed: string[] = [];
  const claimIds = new Set<string>();
  for (const claim of raw.claimed) {
    if (!stringIn(claim, 120, 1) || claimIds.has(claim)) return null;
    claimIds.add(claim);
    claimed.push(claim);
  }
  const state: FarmState = {
    version: 1,
    coins: raw.coins,
    xp: raw.xp,
    water: raw.water,
    seeds,
    inventory,
    materials: { boxes: raw.materials.boxes as number, fertilizer: raw.materials.fertilizer as number },
    plots,
    upgrades,
    workers,
    workerActive,
    jobs,
    contracts,
    shipments,
    brand: { name: raw.brand.name, logo: raw.brand.logo },
    reputation: raw.reputation,
    stats,
    ledger,
    claimed,
    createdAt,
    lastTick,
    settings: { muted: raw.settings.muted, reducedMotion: raw.settings.reducedMotion },
    started: raw.started,
  };
  return usedStorage(state) <= capacity(state) ? state : null;
}

export function exportSave(state: FarmState): string {
  return JSON.stringify(state);
}

export function importSave(text: string, now = Date.now()): FarmState | null {
  if (typeof text !== 'string' || text.length > 2_000_000) return null;
  try {
    return validateState(JSON.parse(text) as unknown, now);
  } catch {
    return null;
  }
}

function getLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** يحفظ النسخة السابقة السليمة كنسخة احتياطية ثم يتحقق من النص المكتوب. */
export function saveState(state: FarmState): { ok: boolean; message: string } {
  const storage = getLocalStorage();
  if (!storage) return { ok: false, message: 'الحفظ المحلي غير متاح في هذا المتصفح.' };
  const now = Date.now();
  const valid = validateState(state, now);
  if (!valid) return { ok: false, message: 'تم رفض حالة غير صالحة ولم يُكتب فوق الحفظ.' };
  const serialised = exportSave(valid);
  try {
    const existing = storage.getItem(SAVE_KEY);
    if (existing !== null && !importSave(existing, now)) return { ok: false, message: 'الحفظ الحالي تالف؛ لم يُستبدل بصمت. استعد النسخة الاحتياطية أولاً.' };
    if (existing !== null) storage.setItem(BACKUP_KEY, existing);
    storage.setItem(SAVE_KEY, serialised);
    const verified = storage.getItem(SAVE_KEY);
    if (verified !== serialised || !importSave(verified, now)) {
      if (existing !== null) storage.setItem(SAVE_KEY, existing);
      return { ok: false, message: 'تعذر التحقق من الحفظ؛ أعيدت النسخة السابقة.' };
    }
    if (existing === null) storage.setItem(BACKUP_KEY, serialised);
    const backup = storage.getItem(BACKUP_KEY);
    if (backup === null || !importSave(backup, now)) return { ok: false, message: 'حُفظت اللعبة لكن تعذر التحقق من النسخة الاحتياطية.' };
    return { ok: true, message: 'تم الحفظ والتحقق منه محلياً.' };
  } catch {
    return { ok: false, message: 'تعذر الوصول إلى الحفظ المحلي.' };
  }
}

/**
 * إصلاح صريح لا يُستدعى إلا بعد موافقة اللاعب: يحتفظ بالنص التالف (بحد 250KB)
 * ثم يكتب فقط حالة حالية اجتازت validateState. لا تستبدل loadState أو saveState
 * هذه الخطوة تلقائياً.
 */
export function recoverSave(state: FarmState): { ok: boolean; message: string } {
  const storage = getLocalStorage();
  if (!storage) return { ok: false, message: 'الحفظ المحلي غير متاح في هذا المتصفح.' };
  const now = Date.now();
  const valid = validateState(state, now);
  if (!valid) return { ok: false, message: 'تم رفض الحالة الحالية غير الصالحة؛ لم يُصلح الحفظ.' };
  try {
    const primary = storage.getItem(SAVE_KEY);
    if (primary === null) return { ok: false, message: 'لا يوجد حفظ تالف لإصلاحه.' };
    if (importSave(primary, now)) return { ok: false, message: 'الحفظ الأساسي سليم؛ استخدم الحفظ العادي بدلاً من الإصلاح.' };
    const serialised = exportSave(valid);
    storage.setItem(CORRUPT_KEY, primary.slice(0, MAX_CORRUPT_TEXT));
    storage.setItem(SAVE_KEY, serialised);
    const verified = storage.getItem(SAVE_KEY);
    if (verified !== serialised || !importSave(verified, now)) {
      storage.setItem(SAVE_KEY, primary);
      return { ok: false, message: 'تعذر التحقق من الإصلاح؛ أعيد النص التالف كما كان.' };
    }
    const backup = storage.getItem(BACKUP_KEY);
    if (backup === null || !importSave(backup, now)) storage.setItem(BACKUP_KEY, serialised);
    return { ok: true, message: 'تم إصلاح الحفظ بعد تأكيدك، وحُفظ النص التالف للفحص.' };
  } catch {
    return { ok: false, message: 'تعذر الوصول إلى الحفظ المحلي لإصلاحه.' };
  }
}

/** لا يكتب فوق الملف التالف عند الاسترداد؛ يتركه للفحص ويعيد النسخة الآمنة فقط. */
export function loadState(now = Date.now()): { state: FarmState; warning: string | null } {
  const time = safeNow(now);
  const storage = getLocalStorage();
  if (!storage) return { state: createState(time), warning: 'الحفظ المحلي غير متاح؛ بدأت مزرعة مؤقتة.' };
  try {
    const primary = storage.getItem(SAVE_KEY);
    if (primary !== null) {
      const state = importSave(primary, time);
      if (state) return { state, warning: null };
      const backupText = storage.getItem(BACKUP_KEY);
      const backup = backupText === null ? null : importSave(backupText, time);
      if (backup) return { state: backup, warning: 'الحفظ الأساسي غير صالح؛ استُعيدت النسخة الاحتياطية دون الكتابة فوق الملف التالف.' };
      return { state: createState(time), warning: 'تعذر قراءة الحفظ والنسخة الاحتياطية؛ بدأت مزرعة جديدة دون حذف الملفات التالفة.' };
    }
    const backupText = storage.getItem(BACKUP_KEY);
    const backup = backupText === null ? null : importSave(backupText, time);
    if (backup) return { state: backup, warning: 'لم يوجد حفظ أساسي؛ استُعيدت النسخة الاحتياطية.' };
    return { state: createState(time), warning: null };
  } catch {
    return { state: createState(time), warning: 'تعذر الوصول إلى الحفظ المحلي؛ بدأت مزرعة مؤقتة.' };
  }
}
