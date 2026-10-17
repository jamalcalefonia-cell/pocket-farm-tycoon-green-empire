const paths: Record<string, string> = {
  leaf: '<path d="M20 4c-11-2-17 4-13 11 7 5 14-2 13-11Z"/><path d="m4 21 10-10"/>',
  farm: '<path d="m3 11 9-7 9 7v10H3Z"/><path d="M9 21v-8h6v8M12 4V1"/>',
  market: '<path d="M3 9h18l-2-5H5Zm1 0v12h16V9M9 21v-7h6v7"/><path d="M3 9c0 5 6 5 6 0 0 5 6 5 6 0 0 5 6 5 6 0"/>',
  box: '<path d="m3 7 9-4 9 4v11l-9 4-9-4Zm0 0 9 4 9-4M12 11v11M7 5l10 4"/>',
  contract: '<rect x="5" y="3" width="14" height="19" rx="2"/><path d="M9 2h6v4H9ZM9 11h6M9 15h6M9 19h3"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8l-5-5m13 5 5-5M8 16l-5 5m13-5 5 5"/>',
  workers: '<circle cx="9" cy="7" r="4"/><path d="M1 21v-3a7 7 0 0 1 14 0v3M16 3a4 4 0 0 1 0 8m3 3a6 6 0 0 1 4 6"/>',
  factory: '<path d="M3 21V10l6 4V8l6 4V3h4l2 18ZM7 17h1m4 0h1m4 0h1"/>',
  truck: '<path d="M1 5h13v13H1ZM14 10h5l4 5v3h-9"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/>',
  trophy: '<path d="M8 3h8v7a4 4 0 0 1-8 0ZM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4M12 14v6M8 21h8"/>',
  chart: '<path d="M3 3v18h18M7 17v-5m5 5V7m5 10V3"/>',
  settings: '<path d="m9 3 1-2h4l1 2 3 2 2 1 2 3-1 2v3l1 2-2 3-2 1-3 2H9l-3-2-2-1-2-3 1-2v-3L2 9l2-3 2-1Z"/><circle cx="12" cy="12" r="3"/>',
  water: '<path d="M12 2c3 5 8 9 8 13a8 8 0 0 1-16 0c0-4 5-8 8-13Z"/><path d="M8 15a4 4 0 0 0 4 4"/>',
  harvest: '<path d="M8 2c14 2 15 13 4 16l-4-4c7 0 9-6 0-12ZM3 22l8-9"/>',
  seed: '<path d="M12 22V11M12 13C4 13 2 8 3 4c6-1 9 4 9 9Zm0-3c0-6 4-9 9-8 1 5-3 9-9 8"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M15 8c-5-3-8 3-3 4s2 7-3 4M12 6v12"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/>',
  check: '<path d="m5 12 4 4L20 5"/>',
  arrow: '<path d="M20 12H4m6-6-6 6 6 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',
  save: '<path d="M3 3h15l3 3v15H3ZM7 3v7h10V3M7 21v-7h10v7"/>',
  sound: '<path d="M3 9h4l5-5v16l-5-5H3ZM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3v1"/>',
}
export const icon = (name: string, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.leaf}</svg>`
export const NAV = [
  ['farm', 'مزرعتي', 'farm'], ['market', 'السوق', 'market'], ['storage', 'المخزن', 'box'],
  ['contracts', 'العقود', 'contract'], ['upgrades', 'التطوير', 'expand'], ['workers', 'العمال', 'workers'],
  ['factory', 'المصانع', 'factory'], ['brand', 'متجري', 'market'], ['transport', 'النقل', 'truck'],
  ['quests', 'المهام', 'trophy'], ['finance', 'المالية', 'chart'], ['settings', 'الإعدادات', 'settings'],
]
export const money = (value: number) => new Intl.NumberFormat('ar', { maximumFractionDigits: 2 }).format(value)
export const count = (value: number) => new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(value)
export const time = (seconds: number) => seconds < 60 ? `${Math.ceil(Math.max(0, seconds))} ث` : `${Math.ceil(seconds / 60)} د`
export const escape = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
