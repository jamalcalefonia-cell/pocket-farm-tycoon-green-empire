import { CROPS, PRODUCTS, RECIPES, UPGRADES, WORKERS, QUESTS, MATERIAL_PRICES } from './data'
import { capacity, usedStorage, level, xpTarget, price, weather, plotInfo, upgradeCost, questProgress, canClaim, questClaimKey, salePrice, shippingQuote, contractReward } from './engine'
import type { FarmState } from './engine'
import { icon, NAV, money, count, time, escape } from './icons'
import logo from '../../assets/share/icon.png'
import cover from '../../assets/share/cover.webp'

type Handler = (type: string, payload?: Record<string, unknown>) => void
const crops = CROPS as Record<string, any>
const products = PRODUCTS as Record<string, any>
const upgrades = UPGRADES as Record<string, any>
const workers = WORKERS as Record<string, any>
const recipes = RECIPES as Record<string, any>
const productName = (id: string) => crops[id]?.name ?? products[id]?.name ?? id
const btn = (label: string, action: string, attrs = '', cls = '') => `<button class="btn ${cls}" data-action="${action}" ${attrs}>${label}</button>`
const pill = (text: string, cls = '') => `<span class="pill ${cls}">${text}</span>`

export class FarmInterface {
  page = 'farm'
  tool: 'plant' | 'water' | 'harvest' | 'inspect' = 'plant'
  selectedCrop = 'cucumber'
  selectedPlot: number | null = null
  state: FarmState
  onChangePage?: (page: string) => void
  private lastSignature = ''
  private dialog: HTMLDialogElement
  private toastTimer = 0
  private handler: Handler
  private marketTab = 'sell'
  private root: HTMLElement

  constructor(root: HTMLElement, state: FarmState, handler: Handler) {
    this.root = root
    this.state = state
    this.handler = handler
    root.innerHTML = `
      <aside class="sidebar">
        <a class="brandmark" href="#farm"><img src="${logo}" alt="شعار المزرعة"/><div><strong>الإمبراطورية الخضراء</strong><span>POCKET FARM TYCOON</span></div></a>
        <div class="nav-label">مساحة مزرعتك</div>
        <nav class="navigation">${NAV.map(([id, name, ic]) => `<button data-page="${id}" class="nav-item ${id === 'farm' ? 'active' : ''}">${icon(ic)}<span>${name}</span>${id === 'quests' ? '<i id="quest-dot"></i>' : ''}</button>`).join('')}</nav>
        <div class="sidebar-bottom"><div class="mini-sprout">${icon('leaf')}</div><strong>من بذرة… إلى إمبراطورية</strong><p>استثمارات صغيرة. حصاد كبير.</p><span class="local-label"><i></i> لعب فردي · حفظ محلي</span></div>
      </aside>
      <div class="workspace">
        <header class="topbar"><div class="breadcrumb">إمبراطوريتك <span>/</span> <b id="page-breadcrumb">مزرعتي</b></div><div class="top-actions"><span id="saved-status">${icon('check')} محفوظ محليًا</span><button class="icon-btn" data-action="save" aria-label="حفظ اللعبة">${icon('save')}</button><button class="icon-btn" data-action="help" aria-label="دليل اللعب">${icon('help')}</button><button class="avatar" data-page="brand" aria-label="العلامة التجارية">م</button></div></header>
        <main>
          <div class="page-heading"><div><div class="eyebrow">POCKET FARM TYCOON · GREEN EMPIRE</div><h1 id="page-title">مزرعتك، بداية حكاية كبيرة</h1><p id="page-description">كل بذرة تزرعها اليوم، تقرّبك من إمبراطوريتك غدًا.</p></div><div class="day-badge" id="weather-header"></div></div>
          <section class="stats-strip" id="stats-strip"></section>
          <section id="farm-section"><div class="farm-layout">
            <div class="farm-card">
              <div class="farm-card-header"><div><span class="live-dot"></span><strong id="farm-name">مزرعة البدايات</strong><small id="land-count">12 قطعة زراعية</small></div><div class="scene-control"><button data-action="zoomOut" aria-label="تصغير المشهد">−</button><button data-action="zoomIn" aria-label="تكبير المشهد">+</button><button data-action="cameraReset" aria-label="إعادة منظور المشهد">${icon('expand')}</button></div></div>
              <div id="scene-wrap"><canvas id="farm-canvas" aria-label="مزرعة ثلاثية الأبعاد، اختر قطعة أرض للزراعة" tabindex="0"></canvas><div id="scene-loader"><div class="loading-track"></div><span>تحميل مباني المزرعة…</span></div><div class="scene-label"><span class="pill">${icon('leaf')} أرض خصبة</span></div><div class="scene-weather" id="scene-weather"></div><div class="scene-hint" id="scene-hint">اختر بذورك، ثم المس قطعة أرض فارغة</div><div id="plot-labels"></div></div>
              <div class="tool-row">${[['plant', 'seed', 'زراعة'], ['water', 'water', 'ري'], ['harvest', 'harvest', 'حصاد'], ['inspect', 'help', 'تفقد']].map(([id, ic, label]) => `<button data-tool="${id}" class="tool ${id === 'plant' ? 'active' : ''}">${icon(ic)}<span>${label}</span></button>`).join('')}<div class="tool-separator"></div><button class="tool secondary" data-action="waterAll">${icon('water')}<span>ري الجميع</span></button><button class="tool secondary" data-action="harvestAll">${icon('harvest')}<span>حصاد الجاهز</span></button></div>
              <div class="field-summary" id="field-summary"></div>
            </div>
            <aside class="farm-widgets"><section class="widget seed-widget"><div class="widget-heading"><h2>${icon('seed')} ماذا ستزرع اليوم؟</h2><button data-page="market">شراء بذور ${icon('arrow')}</button></div><div class="seed-list" id="seed-list"></div><div id="seed-detail"></div></section><section class="widget daily-widget" id="daily-widget"></section><section class="tip-widget">${icon('leaf')}<div><strong>جيران جيدون، حصاد أفضل</strong><p>ازرع الثوم بجوار الخيار لمكافأة إنتاج محدودة. هذه قاعدة مبسطة في اللعبة، وليست ضمانًا علميًا للحماية من الآفات.</p></div></section></aside>
          </div><div class="farm-bottom"><section class="widget" id="contract-preview"></section><section class="widget" id="progress-widget"></section></div></section>
          <section id="content-section" hidden></section>
          <footer>ازرع على مهل. فكّر على المدى الطويل. <span>لا مشتريات مدفوعة · تقدمك محفوظ على هذا المتصفح فقط</span></footer>
        </main>
      </div>
      <nav class="mobile-nav">${[['farm', 'مزرعتي', 'farm'], ['market', 'السوق', 'market'], ['contracts', 'العقود', 'contract'], ['quests', 'المهام', 'trophy']].map(([id, label, ic]) => `<button data-page="${id}" class="${id === 'farm' ? 'active' : ''}">${icon(ic)}<span>${label}</span></button>`).join('')}<button data-action="more">${icon('plus')}<span>المزيد</span></button></nav>
      <dialog id="game-dialog"></dialog><div id="toast" role="status" aria-live="polite"></div><div id="welcome-layer" ${state.started ? 'hidden' : ''}></div>`
    this.dialog = root.querySelector('dialog')!
    this.events()
    if (!state.started) this.welcome()
    this.refresh(true)
  }

  setState(state: FarmState) { this.state = state; this.refresh(true) }
  toast(message: string, error = false) {
    const el = this.root.querySelector<HTMLElement>('#toast')!
    el.innerHTML = `${icon(error ? 'help' : 'check')}<span>${escape(message)}</span>`
    el.className = `visible ${error ? 'error' : ''}`
    clearTimeout(this.toastTimer)
    this.toastTimer = window.setTimeout(() => el.classList.remove('visible'), 3500)
  }
  saved(ok: boolean, message?: string) {
    this.root.querySelector('#saved-status')!.innerHTML = `${icon(ok ? 'check' : 'help')} ${ok ? 'محفوظ محليًا' : 'تعذر الحفظ'}`
    if (!ok && message) this.toast(message, true)
  }
  navigate(page: string) {
    if (!NAV.some(n => n[0] === page)) return
    this.page = page
    this.selectedPlot = null
    this.dialog.close()
    this.lastSignature = ''
    const data = NAV.find(n => n[0] === page)!
    this.root.querySelector('#page-breadcrumb')!.textContent = data[1]
    const titles: Record<string, [string, string]> = {
      farm: ['مزرعتك، بداية حكاية كبيرة', 'كل بذرة تزرعها اليوم، تقرّبك من إمبراطوريتك غدًا.'],
      market: ['حصاد اليوم، أرباح الغد', 'راقب الأسعار، بِع محصولك، واستثمر في الموسم القادم.'],
      storage: ['كل ما تملكه، في مكان واحد', 'بذور وثمار ومواد تصنيع. راقب السعة قبل الحصاد.'],
      contracts: ['علاقات تنمو مع مزرعتك', 'التزم بالكميات والمواعيد، وارفع سمعة علامتك.'],
      upgrades: ['مساحة أكبر لطموحك', 'استثمر أرباحك في أرض أوسع وإنتاج أفضل.'],
      workers: ['فريقك يزرع المستقبل', 'أتمتة تدريجية بأجور واضحة، دون رصيد سالب.'],
      factory: ['محصولك يستحق قيمة أكبر', 'حوّل المواد الخام إلى منتجات، واحسب تكلفة كل دفعة.'],
      brand: ['علامة من أرضك', 'اسم تتذكره الأسواق، وجودة تستحق ثقة العملاء.'],
      transport: ['من الحقل إلى العميل', 'أسطولك يربط إنتاجك بشركائك التجاريين.'],
      quests: ['إنجاز صغير، خطوة كبيرة', 'أهداف يومية وأسبوعية ومكافآت تُحصّل مرة واحدة.'],
      finance: ['اعرف أين تنمو أرباحك', 'الإيرادات ليست الربح. راقب التكاليف والاستثمارات.'],
      settings: ['مزرعتك، على طريقتك', 'حفظ محلي ونسخ احتياطية وإعدادات تجربة اللعب.'],
    }
    this.root.querySelector('#page-title')!.textContent = titles[page][0]
    this.root.querySelector('#page-description')!.textContent = titles[page][1]
    this.root.querySelector<HTMLElement>('#farm-section')!.hidden = page !== 'farm'
    this.root.querySelector<HTMLElement>('#content-section')!.hidden = page === 'farm'
    this.root.querySelectorAll('[data-page]').forEach(el => el.classList.toggle('active', el.getAttribute('data-page') === page))
    this.refresh(true)
    this.onChangePage?.(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  selectPlot(index: number) {
    this.selectedPlot = index
    const p = this.state.plots[index]
    if (!p && this.tool === 'plant') this.handler('plant', { index, crop: this.selectedCrop })
    else if (p && this.tool === 'water') this.handler('water', { index })
    else if (p && this.tool === 'harvest') this.handler('harvest', { index })
    else this.showPlot(index)
    this.refresh(true)
  }
  showPlot(index: number) {
    const p = this.state.plots[index]
    if (!p) {
      this.modal(`القطعة ${index + 1}`, `${icon('seed', 'large-icon')}<p>أرض فارغة، جاهزة لبذرة جديدة.</p><p>البذور المختارة: <b>${crops[this.selectedCrop].name}</b> · لديك ${this.state.seeds[this.selectedCrop] ?? 0}</p>${btn('ازرع الآن', 'plant', `data-index="${index}" data-crop="${this.selectedCrop}"`, 'primary wide')}`)
      return
    }
    const info = plotInfo(this.state, index)
    this.modal(`${crops[p.crop].name} · القطعة ${index + 1}`, `<div class="plot-inspect">${this.cropArt(p.crop)}<h3>${info.ready ? 'محصولك جاهز!' : info.needsWater ? 'ينتظر أول ري' : 'الجذور تعمل بهدوء'}</h3><div class="progress"><i style="width:${info.progress * 100}%"></i></div><p>${info.ready ? `الحصاد المتوقع: ${info.yield} وحدات` : info.needsWater ? 'النمو يتوقف حتى ري المحصول، ولا يتلف.' : `متبقٍ ${time(info.remaining)}`}</p>${info.bonus ? '<p class="green">مكافأة الجوار مع الثوم +10%</p>' : ''}${info.ready ? btn('احصد إلى المخزن', 'harvest', `data-index="${index}"`, 'primary wide') : info.needsWater ? btn('اسقِ المحصول', 'water', `data-index="${index}"`, 'primary wide') : btn('سماد · نمو أسرع 20% ومحصول إضافي', 'fertilize', `data-index="${index}"`, 'wide')}</div>`)
  }
  modal(title: string, content: string) {
    this.dialog.innerHTML = `<div class="dialog-header"><h2>${escape(title)}</h2><button class="icon-btn" data-action="close" aria-label="إغلاق">${icon('close')}</button></div><div class="dialog-content">${content}</div>`
    if (!this.dialog.open) this.dialog.showModal()
  }
  private welcome() {
    this.root.querySelector('#welcome-layer')!.innerHTML = `<div class="welcome-card"><div class="welcome-art" style="background-image:url('${cover}')"></div><div class="welcome-body"><img src="${logo}" alt="شعار المزرعة"/><span class="eyebrow">POCKET FARM TYCOON</span><h1>إمبراطوريتك تبدأ ببذرة</h1><p>قطعة أرض صغيرة، 150 عملة، وحلم كبير.<br>ازرع الخيار، اسقِه، واحصد أول أرباحك.</p><div class="welcome-steps"><span>${icon('seed')} ازرع</span><span>${icon('water')} اسقِ</span><span>${icon('harvest')} احصد</span><span>${icon('coin')} تاجر</span></div>${btn('ابدأ مزرعتي', 'start', '', 'primary wide')}<small>دون حساب، دون مشتريات مدفوعة. الحفظ على هذا الجهاز فقط.</small></div></div>`
  }
  private cropArt(id: string, small = false) {
    const c = crops[id] ?? products[id]
    const shape = ['garlic', 'onion'].includes(id) ? 'bulb' : ['cucumber', 'carrot', 'corn'].includes(id) ? 'long' : ['lettuce'].includes(id) ? 'lettuce' : products[id] ? 'jar' : 'round'
    return `<span class="crop-art ${shape} ${small ? 'small' : ''}" style="--crop-color:${c.color}"><i></i><b></b><em></em></span>`
  }
  refresh(force = false) {
    const s = this.state
    const w = weather(s)
    const lv = level(s)
    const ready = s.plots.filter((p, i) => p && plotInfo(s, i).ready).length
    const growing = s.plots.filter(Boolean).length
    const next = xpTarget(s)
    const previous = lv === 1 ? 0 : this.previousXp(lv)
    const xpPct = Math.max(0, Math.min(100, ((s.xp - previous) / Math.max(1, next - previous)) * 100))
    this.root.querySelector('#stats-strip')!.innerHTML = `
      <div class="stat-cell"><div class="stat-icon gold">${icon('coin')}</div><div><span>رصيدك الحالي</span><strong>${money(s.coins)} <small>عملة</small></strong><em>رأس مال ينمو معك</em></div></div>
      <div class="stat-cell"><div class="stat-icon green">${icon('leaf')}</div><div><span>المستوى ${count(lv)} · ${lv < 3 ? 'مزارع مبتدئ' : lv < 5 ? 'مزارع محترف' : lv < 7 ? 'مزرعة تجارية' : lv < 9 ? 'مستثمر زراعي' : 'الإمبراطورية الخضراء'}</span><strong>${count(s.xp)} <small>/ ${count(next)} خبرة</small></strong><div class="progress xp"><i style="width:${xpPct}%"></i></div></div></div>
      <button class="stat-cell" data-page="storage"><div class="stat-icon brown">${icon('box')}</div><div><span>المخزن</span><strong>${count(usedStorage(s))} <small>/ ${count(capacity(s))} وحدة</small></strong><em>${capacity(s) - usedStorage(s)} مساحة متاحة</em></div>${icon('arrow')}</button>
      <div class="stat-cell"><div class="stat-icon blue">${icon('water')}</div><div><span>خزان المياه</span><strong>${count(s.water)} <small>/ 100 لتر</small></strong><em>يتجدد من بئر المزرعة</em><button class="refill-btn" data-action="refill">تعبئة مجانية</button></div></div>`
    this.root.querySelector('#weather-header')!.innerHTML = `${icon('sun')}<div><strong>اليوم ${Math.floor((Date.now() - s.createdAt) / 86400000) + 1} · ${w.season}</strong><span>${w.name}</span></div>`
    this.root.querySelector('#scene-weather')!.innerHTML = `${icon(w.kind === 'rain' ? 'water' : 'sun')}<span>${w.name}</span>`
    this.root.querySelector('#farm-name')!.textContent = s.brand.name
    this.root.querySelector('#land-count')!.textContent = `${s.plots.length} قطعة زراعية`
    this.root.querySelector('#field-summary')!.innerHTML = `<span><i class="dot brown-dot"></i>${s.plots.length - growing} أرض فارغة</span><span><i class="dot green-dot"></i>${growing - ready} قيد النمو</span><span><i class="dot gold-dot"></i>${ready} جاهز للحصاد</span><small>${w.description}</small>`
    this.root.querySelector('#scene-hint')!.textContent = this.tool === 'plant' ? `اختر قطعة فارغة لزراعة ${crops[this.selectedCrop].name}` : this.tool === 'water' ? 'المس محصولًا يحتاج إلى الماء' : this.tool === 'harvest' ? 'المس محصولًا ناضجًا لجمعه في المخزن' : 'المس قطعة لمعرفة تفاصيلها'
    const signature = JSON.stringify([s.coins, s.xp, s.seeds, s.inventory, s.materials, s.upgrades, s.workers, s.workerActive, s.claimed, s.jobs.map(j => j.id), s.contracts.map(c => [c.id, c.status]), s.shipments.map(j => j.id), s.brand, s.settings, this.page, this.selectedCrop, this.marketTab, Math.floor(Date.now() / 90000)])
    if (force || signature !== this.lastSignature) {
      this.lastSignature = signature
      this.root.querySelector('#seed-list')!.innerHTML = Object.entries(crops).map(([id, c]) => `<button class="seed-item ${this.selectedCrop === id ? 'selected' : ''} ${lv < c.level ? 'locked' : ''}" data-crop-select="${id}" ${lv < c.level ? 'disabled' : ''}>${this.cropArt(id, true)}<span><strong>${c.name}</strong><small>${lv < c.level ? `المستوى ${c.level}` : `${s.seeds[id] ?? 0} بذرة`}</small></span>${this.selectedCrop === id ? icon('check') : lv < c.level ? icon('lock') : ''}</button>`).join('')
      const c = crops[this.selectedCrop]
      this.root.querySelector('#seed-detail')!.innerHTML = `<div class="seed-facts"><span>${icon('clock')}${c.growSeconds} ث نمو أساسي</span><span>${icon('water')}${c.water} لتر ماء</span><span>${icon('box')}${c.yield} وحدات</span></div><p class="seed-note">${(s.seeds[this.selectedCrop] ?? 0) > 0 ? `المس أرضًا فارغة لزراعة ${c.name}.` : 'نفدت البذور. اشترِ المزيد من السوق.'}</p>`
      this.root.querySelector('#daily-widget')!.innerHTML = `<div class="widget-heading"><h2>${icon('trophy')} هدفك القادم</h2><button data-page="quests">كل المهام ${icon('arrow')}</button></div>${this.questCompact()}`
      const ct = s.contracts.find(c => c.status === 'active') ?? s.contracts.find(c => c.status === 'available' && c.level <= lv)
      this.root.querySelector('#contract-preview')!.innerHTML = `<div class="widget-heading"><h2>${icon('contract')} من الحقل إلى الشركاء</h2><button data-page="contracts">العقود ${icon('arrow')}</button></div>${ct ? `<div class="contract-mini"><span class="client-avatar">${icon('market')}</span><div><strong>${escape(ct.client)}</strong><p>${this.requirements(ct.requirements)}</p></div><div><strong class="green">${money(ct.reward)} عملة</strong>${pill(ct.status === 'active' ? 'قيد التنفيذ' : 'فرصة جديدة')}</div></div>` : '<p>تظهر فرص جديدة مع نمو مزرعتك.</p>'}`
      this.root.querySelector('#progress-widget')!.innerHTML = `<div class="widget-heading"><h2>${icon('expand')} وسّع أفقك</h2>${pill(`المستوى ${lv}`)}</div><div class="next-upgrade"><div class="stat-icon green">${icon('expand')}</div><div><strong>أرض إضافية، حصاد أوفر</strong><p>افتح قطعًا جديدة وطوّر إنتاجك.</p></div>${btn('استكشف', 'navigateUpgrades', '', 'small-btn')}</div>`
      if (this.page !== 'farm') this.renderPage()
    }
    this.root.querySelectorAll<HTMLElement>('[data-countdown]').forEach(el => el.textContent = time((Number(el.dataset.countdown) - Date.now()) / 1000))
  }
  private previousXp(lv: number) { const fake = { ...this.state, xp: 0 }; let lo = 0; let hi = this.state.xp; while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (level({ ...fake, xp: mid } as FarmState) < lv) lo = mid + 1; else hi = mid } return lo }
  private requirements(req: Record<string, number>) { return Object.entries(req).map(([id, n]) => `${n} ${productName(id)}`).join(' + ') }
  private questCompact() {
    const s = this.state
    const q = (QUESTS as any[]).find(q => !s.claimed.includes(questClaimKey(q))) ?? (QUESTS as any[])[0]
    const p = questProgress(s, q)
    return `<h3>${escape(q.name)}</h3><p>${escape(q.description)}</p><div class="quest-meta"><span>${count(Math.min(p, q.target))} / ${q.target}</span><strong>+${q.reward} عملة</strong></div><div class="progress"><i style="width:${Math.min(100, p / q.target * 100)}%"></i></div>`
  }
  private renderPage() {
    const s = this.state
    const lv = level(s)
    let html = ''
    switch (this.page) {
      case 'market': html = this.market(); break
      case 'storage': html = `<div class="notice">${icon('box')} يشمل استخدام السعة البذور والمحاصيل والمواد والمنتجات. لا يفقد الحصاد عند امتلاء المخزن.</div><div class="warehouse-overview"><strong>${usedStorage(s)} <small>/ ${capacity(s)} وحدة</small></strong><div class="progress"><i style="width:${usedStorage(s) / capacity(s) * 100}%"></i></div>${btn('ترقية المخزن', 'navigateUpgrades')}</div><h2 class="section-title">المحاصيل والمنتجات</h2><div class="item-grid">${Object.entries({ ...crops, ...products }).map(([id, c]) => `<article class="item-card">${this.cropArt(id)}<h3>${c.name}</h3><strong class="inventory-count">${s.inventory[id] ?? 0}<small>وحدات</small></strong><p>القيمة السوقية ${money(price(s, id) * (s.inventory[id] ?? 0))} عملة</p>${btn('اذهب للبيع', 'navigateMarket', '', 'wide')}</article>`).join('')}</div><h2 class="section-title">البذور ومواد التصنيع</h2><div class="panel">${Object.entries(crops).map(([id, c]) => `<div class="resource-line"><span>${c.name}</span><b>${s.seeds[id] ?? 0} بذرة</b></div>`).join('')}<div class="resource-line"><span>صناديق التغليف</span><b>${s.materials.boxes}</b></div><div class="resource-line"><span>السماد</span><b>${s.materials.fertilizer}</b></div><div class="resource-line"><span>الأدوات والمعدات المثبتة</span><b>${Object.entries(s.upgrades).filter(([, n]) => n > 0).map(([id]) => upgrades[id]?.name).join('، ') || 'أدوات يدوية أساسية'}</b></div></div>`; break
      case 'contracts': html = `<div class="notice">${icon('clock')} تبدأ المهلة بعد القبول. التسليم المبكر يمنح مكافأة. انتهاء الوقت يلغي العقد دون غرامة نقدية.</div><div class="item-grid contracts-grid">${s.contracts.map(c => { const available = Object.entries(c.requirements).every(([id, n]) => (s.inventory[id] ?? 0) >= n); return `<article class="contract-card panel"><div class="contract-top"><span class="client-avatar">${icon('market')}</span>${pill(c.status === 'available' ? 'متاح' : c.status === 'active' ? 'نشط' : c.status === 'delivered' ? 'تم التسليم' : c.status === 'shipping' ? 'في الطريق' : c.status === 'expired' ? 'انتهى' : 'مرفوض', c.status === 'active' ? 'green-pill' : '')}</div><h3>${escape(c.client)}</h3><p>المستوى ${c.level} · ${c.reward > 500 ? 'متقدم' : 'سهل'} · مهلة ${time(c.duration)}</p><div class="contract-resources">${Object.entries(c.requirements).map(([id, n]) => `<div class="resource-line"><span>${productName(id)}</span><b class="${(s.inventory[id] ?? 0) >= n ? 'green' : ''}">${s.inventory[id] ?? 0} / ${n}</b></div>`).join('')}</div><div class="contract-reward"><span>مكافأة العقد</span><strong>${money(c.reward)} <small>عملة</small></strong></div>${c.status === 'available' ? `<div class="button-pair">${btn(lv < c.level ? `يفتح مستوى ${c.level}` : 'قبول العقد', 'acceptContract', `data-id="${c.id}" ${lv < c.level ? 'disabled' : ''}`, 'primary')}${btn('رفض', 'rejectContract', `data-id="${c.id}"`)}</div>` : c.status === 'active' ? `<p>المكافأة الآن: ${money(contractReward(s, c))} عملة · المتبقي: <b data-countdown="${c.deadline}"></b></p>${btn(available ? 'تسليم المنتجات' : 'أكمل الكميات أولًا', 'deliverContract', `data-id="${c.id}" ${available ? '' : 'disabled'}`, 'primary wide')}` : ''}</article>` }).join('')}</div>`; break
      case 'upgrades': html = `<div class="notice">${icon('expand')} التوسعات والترقيات استثمارات مدفوعة من رصيد اللعبة فقط. تظهر فوائد كل مستوى قبل الشراء.</div><div class="item-grid">${Object.entries(upgrades).map(([id, u]) => { const owned = s.upgrades[id] ?? 0; const cost = upgradeCost(s, id); const max = owned >= u.max; return `<article class="upgrade-card panel"><div class="upgrade-symbol">${icon(id === 'storage' ? 'box' : id === 'land' ? 'expand' : id === 'factory' ? 'factory' : id === 'shop' ? 'market' : id === 'vehicle' || id === 'truck' ? 'truck' : id === 'irrigation' ? 'water' : 'leaf')}</div>${pill(`ترقية ${owned} / ${u.max}`)}<h3>${u.name}</h3><p>${u.description}</p><div class="cost-line"><span>الاستثمار</span><strong>${money(cost)} عملة</strong></div>${btn(max ? 'مكتمل' : lv < u.level ? `يتطلب المستوى ${u.level}` : `ترقية · ${money(cost)}`, 'upgrade', `data-id="${id}" ${max || lv < u.level || s.coins < cost ? 'disabled' : ''}`, 'primary wide')}</article>` }).join('')}</div>`; break
      case 'workers': html = `<div class="notice">${icon('workers')} الأجور تُدفع عند تنفيذ العمل، ولا تُخصم ديون أثناء الغياب. يتوقف العامل تلقائيًا إذا لم يكفِ الرصيد.</div><div class="item-grid">${Object.entries(workers).map(([id, w]) => `<article class="worker-card panel"><div class="worker-avatar">${icon('workers')}</div>${pill(s.workers[id] ? s.workerActive[id] ? 'يعمل الآن' : 'متوقف' : `مستوى ${w.level}`)}<h3>${w.name}</h3><p>${w.description}</p><div class="resource-line"><span>توظيف لمرة واحدة</span><b>${w.cost} عملة</b></div><div class="resource-line"><span>أجر المهمة</span><b>${w.wage} عملة</b></div>${s.workers[id] ? btn(s.workerActive[id] ? 'إيقاف مؤقت' : 'تشغيل العامل', 'toggleWorker', `data-id="${id}"`, 'wide') : btn(lv < w.level ? `يفتح في المستوى ${w.level}` : 'توظيف', 'hire', `data-id="${id}" ${lv < w.level || s.coins < w.cost ? 'disabled' : ''}`, 'primary wide')}</article>`).join('')}</div>`; break
      case 'factory': html = `<div class="notice">${icon('factory')} ${s.upgrades.factory ? 'المصنع جاهز. المواد والتشغيل تُخصم عند بدء الدفعة وتُحجز سعة المنتج النهائي.' : 'ابنِ المصنع من شاشة التطوير أولًا. لا يمكن الإنتاج قبل امتلاكه.'}</div>${s.jobs.length ? `<h2 class="section-title">خطوط الإنتاج النشطة</h2><div class="panel">${s.jobs.map(j => `<div class="resource-line"><span>${productName(j.product)} · ${j.output} وحدات</span><b data-countdown="${j.finishAt}"></b></div>`).join('')}</div>` : ''}<div class="item-grid">${Object.entries(recipes).map(([id, r]) => `<article class="item-card panel">${this.cropArt(id)}<h3>${r.name}</h3><p>${r.input} ${productName(r.crop)} + ${r.boxes} صناديق → ${r.output} ${productName(id)}</p><div class="resource-line"><span>مدة أساسية</span><b>${r.seconds} ثانية</b></div><div class="resource-line"><span>تكلفة التشغيل</span><b>${r.cost} عملة</b></div><div class="resource-line"><span>قيمة المنتج الحالية</span><b>${money(price(s, id) * r.output)} عملة</b></div>${btn(lv < r.level ? `يفتح في المستوى ${r.level}` : 'إنتاج دفعة', 'produce', `data-product="${id}" ${!s.upgrades.factory || lv < r.level ? 'disabled' : ''}`, 'primary wide')}</article>`).join('')}</div>`; break
      case 'brand': html = `<div class="brand-banner"><div class="brand-symbol">${icon(s.brand.logo)}</div><div><span>علامتك الزراعية</span><h2>${escape(s.brand.name)}</h2><p>سمعتك ${s.reputation} نقطة · ${s.upgrades.shop ?? 0} فرع · تغليف مستوى ${s.upgrades.packaging ?? 0}</p></div></div><form id="brand-form" class="panel brand-form"><h3>هوية تتذكرها الأسواق</h3><label>اسم العلامة التجارية<input name="brandName" maxlength="32" value="${escape(s.brand.name)}" required /></label><label>رمز العلامة<select name="brandLogo"><option value="leaf" ${s.brand.logo === 'leaf' ? 'selected' : ''}>ورقة خضراء</option><option value="sun" ${s.brand.logo === 'sun' ? 'selected' : ''}>شمس الحصاد</option><option value="seed" ${s.brand.logo === 'seed' ? 'selected' : ''}>بذرة المستقبل</option></select></label><button class="btn primary" type="submit">حفظ الهوية</button></form><div class="notice">${icon('market')} ${s.upgrades.shop ? 'المتجر متاح. البيع المباشر يمنح سعرًا أفضل حسب السمعة والتغليف والفروع، ويستهلك صندوقًا لكل وحدة. يتطلب سمعة 10 وتغليفًا مستوى 1.' : 'يفتح المتجر في المراحل المتقدمة. ابنِ أول فرع من شاشة التطوير.'}</div><div class="item-grid">${Object.entries({ ...crops, ...products }).filter(([id]) => (s.inventory[id] ?? 0) > 0).map(([id, c]) => `<article class="item-card">${this.cropArt(id)}<h3>${c.name}</h3><p>${s.inventory[id]} وحدات في المخزن</p>${btn('بيع مباشر', 'saleDialog', `data-product="${id}" data-channel="shop" ${!s.upgrades.shop || !s.upgrades.packaging || s.reputation < 10 || !s.materials.boxes ? 'disabled' : ''}`, 'primary wide')}</article>`).join('') || '<div class="empty-state">احصد منتجاتك أولًا لتعرضها للعملاء.</div>'}</div>`; break
      case 'transport': html = `<div class="notice">${icon('truck')} شراء مركبة وتوظيف سائق مطلوبان قبل إرسال الشحنات. تُحجز المنتجات وتُخصم تكلفة التشغيل عند الانطلاق؛ مكافأة واحدة عند الوصول.</div><div class="transport-summary panel"><div>${icon('truck', 'large-icon')}<h3>أسطول التوزيع</h3><p>سيارة: ${s.upgrades.vehicle ?? 0} · شاحنة: ${s.upgrades.truck ?? 0}</p></div><div><strong>${s.upgrades.truck ? 200 : s.upgrades.vehicle ? 60 : 0}</strong><p>وحدة سعة الشحنة</p></div><div><strong>${s.workers.driver ? 'متاح' : 'غير موظف'}</strong><p>سائق التوصيل</p></div>${btn('تطوير الأسطول', 'navigateUpgrades')}</div><h2 class="section-title">شحنات في الطريق</h2><div class="panel">${s.shipments.length ? s.shipments.map(j => `<div class="resource-line"><span>شحنة ${escape(j.contractId)}</span><b data-countdown="${j.finishAt}"></b></div>`).join('') : '<p>لا شحنات نشطة.</p>'}</div><h2 class="section-title">عقود قابلة للشحن</h2><div class="item-grid">${s.contracts.filter(c => c.status === 'active').map(c => `<article class="panel"><h3>${escape(c.client)}</h3><p>${this.requirements(c.requirements)}</p><p>المكافأة الأساسية ${money(c.reward)} عملة · المبكرة حتى ${money(Math.round(c.reward * 1.05))}</p><div class="resource-line"><span>حمولة / سعة</span><b>${shippingQuote(s, c).total} / ${shippingQuote(s, c).capacity}</b></div><div class="resource-line"><span>التشغيل / الوصول</span><b>${shippingQuote(s, c).cost} عملة · ${shippingQuote(s, c).seconds} ث</b></div><p>${escape(shippingQuote(s, c).reason)}</p>${btn('إرسال الشحنة', 'shipContract', `data-id="${c.id}" ${!shippingQuote(s, c).eligible ? 'disabled' : ''}`, 'primary wide')}</article>`).join('') || '<p>اقبل عقدًا أولًا من لوحة العقود.</p>'}</div>`; break
      case 'quests': html = `<div class="notice">${icon('trophy')} المهام اليومية تتتجدد عند منتصف الليل UTC، والأسبوعية في دورات ثابتة من سبعة أيام UTC. الإنجازات تُحصّل مرة واحدة.</div><div class="item-grid">${(QUESTS as any[]).map(q => { const p = questProgress(s, q); const claimed = s.claimed.includes(questClaimKey(q)); return `<article class="quest-card panel">${pill(q.period === 'daily' ? 'يومية' : q.period === 'weekly' ? 'أسبوعية' : 'إنجاز')}<div class="upgrade-symbol">${icon('trophy')}</div><h3>${escape(q.name)}</h3><p>${escape(q.description)}</p><div class="quest-meta"><span>${Math.min(p, q.target)} / ${q.target}</span><b>${q.reward} عملة + ${q.xp} خبرة</b></div><div class="progress"><i style="width:${Math.min(100, p / q.target * 100)}%"></i></div>${btn(claimed ? 'تم الاستلام' : p >= q.target ? 'استلام المكافأة' : 'قيد الإنجاز', 'claim', `data-id="${q.id}" ${claimed || !canClaim(s, q) ? 'disabled' : ''}`, 'primary wide')}</article>` }).join('')}</div>`; break
      case 'finance': html = this.finance(); break
      case 'settings': html = `<div class="settings-grid"><section class="panel"><h2>${icon('save')} الحفظ والاستمرار</h2><p>يحفظ تلقائيًا بعد كل عملية وكل خمس ثوانٍ. ينمو المحصول المروي بعد الإغلاق، ولا يُحصد أو يباع تلقائيًا إلا وفق أنظمة العمال المفعلة.</p><p>التقدم محفوظ على هذا المتصفح، وليس بين الأجهزة. تصدير النسخة الاحتياطية يسمح بنقل الحفظ يدويًا.</p><div class="button-pair">${btn('حفظ الآن', 'save', '', 'primary')}${btn('تصدير نسخة', 'export')}</div><label class="btn wide import-label">استيراد نسخة احتياطية<input type="file" id="import-save" accept="application/json,.json" hidden /></label>${btn('إصلاح حفظ تالف بالنسخة الحالية', 'recoverDialog', '', 'wide')}<p class="muted">تبديل الموقع أو مسح بيانات المتصفح لا ينقل الحفظ. صدّر نسخة قبل ذلك.</p></section><section class="panel"><h2>${icon('settings')} تجربة اللعب</h2><label class="toggle-line"><span>كتم الصوت والمؤثرات</span><input type="checkbox" id="mute-toggle" ${s.settings.muted ? 'checked' : ''}/></label><label class="toggle-line"><span>تقليل الحركات</span><input type="checkbox" id="motion-toggle" ${s.settings.reducedMotion ? 'checked' : ''}/></label>${btn('دليل اللعب', 'help', '', 'wide')}<div class="notice">${icon('leaf')} اللعبة فردية. لا حسابات أو مزامنة أو سوق مشترك. لا جمع لبيانات شخصية.</div></section><section class="panel danger-panel"><h2>بداية جديدة</h2><p>يعيد المال والمخزون والأراضي والإنجازات إلى البداية. صدّر نسخة قبل المتابعة.</p>${btn('إعادة بدء اللعبة', 'resetDialog', '', 'danger')}</section></div>`; break
    }
    this.root.querySelector('#content-section')!.innerHTML = html
  }
  private market() {
    const s = this.state; const lv = level(s)
    return `<div class="market-top"><div class="tabs"><button data-market-tab="sell" class="${this.marketTab === 'sell' ? 'active' : ''}">بيع المنتجات</button><button data-market-tab="buy" class="${this.marketTab === 'buy' ? 'active' : ''}">شراء المستلزمات</button></div><span class="market-note">${icon('chart')} سوق دوري وعلاوة سمعة · حدود أساسية 75%–125% قبل التقريب</span></div>${this.marketTab === 'sell' ? `<div class="item-grid">${Object.entries({ ...crops, ...products }).map(([id, c]) => { const current = price(s, id); const diff = Math.round((current / c.basePrice - 1) * 100); return `<article class="market-item"><div class="market-item-top">${pill(products[id] ? 'مصنّع' : 'طازج')}${pill(`${diff >= 0 ? '+' : ''}${diff}%`, diff >= 0 ? 'green-pill' : '')}</div>${this.cropArt(id)}<h3>${c.name}</h3><div class="product-price">${money(current)} <small>عملة / وحدة</small></div><p>في المخزن <b>${s.inventory[id] ?? 0}</b> وحدات</p>${btn('بيع المنتج', 'saleDialog', `data-product="${id}" ${(s.inventory[id] ?? 0) <= 0 ? 'disabled' : ''}`, 'primary wide')}</article>` }).join('')}</div>` : `<div class="item-grid">${Object.entries(crops).map(([id, c]) => `<article class="market-item">${pill(`المستوى ${c.level}`)}${this.cropArt(id)}<h3>بذور ${c.name}</h3><div class="product-price">${money(c.seedPrice)} <small>عملة / بذرة</small></div><p>مدة النمو ${c.growSeconds} ث · إنتاج ${c.yield}</p>${btn(lv < c.level ? `يفتح مستوى ${c.level}` : 'شراء البذور', 'purchaseDialog', `data-crop="${id}" ${lv < c.level ? 'disabled' : ''}`, 'primary wide')}</article>`).join('')}<article class="market-item">${icon('box', 'large-icon')}<h3>صناديق تغليف</h3><div class="product-price">${MATERIAL_PRICES.boxes} <small>عملات / صندوق</small></div><p>للتصنيع والبيع المباشر</p>${btn('شراء 10 · ' + (MATERIAL_PRICES.boxes * 10) + ' عملة', 'buyMaterial', 'data-material="boxes" data-quantity="10"', 'primary wide')}</article><article class="market-item">${icon('leaf', 'large-icon')}<h3>سماد عضوي</h3><div class="product-price">${MATERIAL_PRICES.fertilizer} <small>عملات / وحدة</small></div><p>نمو أسرع 20% وإنتاج إضافي مع التقريب</p>${btn('شراء 5 · ' + (MATERIAL_PRICES.fertilizer * 5) + ' عملة', 'buyMaterial', 'data-material="fertilizer" data-quantity="5"', 'primary wide')}</article></div>`}`
  }
  private finance() {
    const s = this.state
    const inventoryValue = Object.entries(s.inventory).reduce((sum, [id, n]) => sum + n * price(s, id), 0)
    const recent = s.ledger.filter(l => l.time >= Date.now() - 600000)
    const period = recent.reduce((sum, l) => sum + l.amount, 0)
    return `<div class="finance-cards"><article class="panel"><span>إيرادات المبيعات والعقود</span><strong class="green">${money(s.stats.revenue)}</strong><small>لا تشمل رأس المال أو مكافآت المهام</small></article><article class="panel"><span>المصروفات والاستثمارات</span><strong>${money(s.stats.expenses)}</strong><small>بذور ومعدات وتشغيل وتوسع وأجور</small></article><article class="panel"><span>صافي النتيجة النقدية</span><strong class="${s.stats.revenue - s.stats.expenses >= 0 ? 'green' : ''}">${money(s.stats.revenue - s.stats.expenses)}</strong><small>الإيرادات − المصروفات، وليست أرباحًا محاسبية تراكمية</small></article><article class="panel"><span>قيمة المنتجات المخزنة</span><strong>${money(inventoryValue)}</strong><small>تقييم بسعر السوق الحالي</small></article></div><div class="notice">${icon('chart')} التدفق النقدي خلال آخر 10 دقائق: ${money(period)} عملة، يشمل المكافآت. الأصول المشتراة تُسجل نقديًا كمصروفات في هذه المحاكاة.</div><h2 class="section-title">اقتصاد محاصيلك الأساسي</h2><div class="panel table-wrap"><table><thead><tr><th>المحصول</th><th>تكلفة البذرة</th><th>إنتاج أساسي</th><th>قيمة الحصاد الحالية</th><th>هامش قبل التشغيل</th></tr></thead><tbody>${Object.entries(crops).map(([id, c]) => `<tr><td>${c.name}</td><td>${c.seedPrice}</td><td>${c.yield}</td><td>${money(c.yield * price(s, id))}</td><td class="green">${money(c.yield * price(s, id) - c.seedPrice)}</td></tr>`).join('')}</tbody></table></div><h2 class="section-title">سجل المعاملات</h2><div class="panel ledger">${s.ledger.length ? [...s.ledger].reverse().slice(0, 50).map(l => `<div class="ledger-row"><div>${icon(l.amount >= 0 ? 'coin' : 'box')}<span><strong>${escape(l.label)}</strong><small>${new Date(l.time).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}</small></span></div><b class="${l.amount >= 0 ? 'green' : ''}">${l.amount > 0 ? '+' : ''}${money(l.amount)}</b></div>`).join('') : '<p>ازرع واحصد ثم بِع أول منتج لبدء سجلك.</p>'}</div>`
  }
  private saleDialog(id: string, channel = 'market') {
    const n = this.state.inventory[id] ?? 0
    this.modal(`بيع ${productName(id)}`, `<form id="sale-form" data-product="${id}" data-channel="${channel}"><div class="sale-product">${this.cropArt(id)}<div><strong>${productName(id)}</strong><p>المتاح ${n} وحدات · ${channel === 'shop' ? 'بيع مباشر بالمتجر' : 'سوق المحاصيل'}</p></div></div><label>الكمية<div class="quantity-input"><button type="button" data-action="quantityMinus">−</button><input id="quantity" name="quantity" type="number" min="1" max="${n}" value="${n}" step="1" required/><button type="button" data-action="quantityPlus">+</button></div></label><div class="resource-line"><span>السعر لكل وحدة</span><b id="unit-price"></b></div><div class="sale-total"><span>ستحصل على</span><strong id="sale-total"></strong></div><p class="muted">${channel === 'shop' ? 'صناديق التغليف مطلوبة، والسعر يشمل مكافأة السمعة والتغليف.' : 'يُتحقق من هذا السعر عند التأكيد؛ إذا تغير السوق نطلب منك مراجعة المبلغ مجددًا.'}</p><button class="btn primary wide" type="submit">${icon('check')} تأكيد البيع</button></form>`)
    this.updateSaleTotal()
  }
  private saleUnit(id: string, channel: string) { return salePrice(this.state, id, channel as 'market' | 'shop') }
  private updateSaleTotal() { const f = this.dialog.querySelector<HTMLFormElement>('#sale-form'); if (!f) return; const n = Number((f.elements.namedItem('quantity') as HTMLInputElement).value); const unit = this.saleUnit(f.dataset.product!, f.dataset.channel!); f.dataset.expectedUnit = String(unit); this.dialog.querySelector('#unit-price')!.textContent = `${money(unit)} عملة`; this.dialog.querySelector('#sale-total')!.textContent = `${money(Math.max(0, n) * unit)} عملة` }
  private purchaseDialog(id: string) { const c = crops[id]; this.modal(`شراء بذور ${c.name}`, `<form id="purchase-form" data-crop="${id}"><div class="sale-product">${this.cropArt(id)}<div><strong>بذور ${c.name}</strong><p>${c.seedPrice} عملة لكل بذرة</p></div></div><label>عدد البذور<input name="quantity" id="buy-quantity" type="number" value="5" min="1" max="1000" step="1" required/></label><div class="sale-total"><span>الإجمالي</span><strong id="buy-total">${money(c.seedPrice * 5)} عملة</strong></div><button class="btn primary wide" type="submit">تأكيد الشراء</button></form>`) }
  private events() {
    this.root.addEventListener('click', e => {
      const target = (e.target as HTMLElement).closest<HTMLElement>('button,a')
      if (!target) return
      if (target.dataset.page) { e.preventDefault(); this.navigate(target.dataset.page); return }
      if (target.dataset.tool) { this.tool = target.dataset.tool as typeof this.tool; this.root.querySelectorAll('[data-tool]').forEach(el => el.classList.toggle('active', el === target)); this.refresh(true); return }
      if (target.dataset.cropSelect) { this.selectedCrop = target.dataset.cropSelect; this.tool = 'plant'; this.root.querySelectorAll('[data-tool]').forEach(el => el.classList.toggle('active', el.getAttribute('data-tool') === 'plant')); this.refresh(true); return }
      if (target.dataset.marketTab) { this.marketTab = target.dataset.marketTab; this.refresh(true); return }
      const a = target.dataset.action
      if (!a) return
      const payload: Record<string, unknown> = { ...target.dataset }; delete payload.action
      for (const k of ['index', 'quantity']) if (payload[k] !== undefined) payload[k] = Number(payload[k])
      if (a === 'close') this.dialog.close()
      else if (a === 'start') { this.handler('start'); this.root.querySelector<HTMLElement>('#welcome-layer')!.hidden = true }
      else if (a === 'saleDialog') this.saleDialog(String(payload.product), String(payload.channel ?? 'market'))
      else if (a === 'purchaseDialog') this.purchaseDialog(String(payload.crop))
      else if (a.startsWith('navigate')) this.navigate(({ navigateUpgrades: 'upgrades', navigateMarket: 'market' } as Record<string, string>)[a] ?? 'farm')
      else if (a === 'quantityMinus' || a === 'quantityPlus') { const input = this.dialog.querySelector<HTMLInputElement>('#quantity')!; input.value = String(Math.max(1, Math.min(Number(input.max), Number(input.value) + (a === 'quantityMinus' ? -1 : 1)))); this.updateSaleTotal() }
      else if (a === 'more') this.modal('إدارة إمبراطوريتك', `<div class="more-menu">${NAV.map(([id, name, ic]) => `<button data-page="${id}">${icon(ic)}${name}</button>`).join('')}</div>`)
      else if (a === 'help') this.modal('من بذرة إلى إمبراطورية', `<ol class="help-steps"><li><b>ازرع:</b> اختر بذور الخيار ثم المس قطعة أرض بنية فارغة في المزرعة.</li><li><b>اسقِ:</b> اختر أداة الري والمس القطعة. يبدأ مؤقت النمو بعد الري الأول.</li><li><b>احصد:</b> انتظر حتى تنضج ثم اختر أداة الحصاد أو «حصاد الجاهز».</li><li><b>تاجر:</b> افتح السوق، اختر المنتج والكمية، راجع الإجمالي وأكد البيع.</li><li><b>توسع:</b> اشترِ بذورًا وأرضًا، أنجز العقود، واستلم مكافآت المهام لترتفع بالمستوى.</li><li><b>استثمر:</b> توظيف العمال والمصنع والمتجر والنقل يفتح تدريجيًا. تابع تكاليف التشغيل في المالية.</li></ol><p>الماء مجاني من البئر، المحاصيل لا تتلف عند نسيانها، والحفظ محلي فقط. الثوم المجاور للخيار قاعدة لعب تمنح إنتاجًا محدودًا وليست ضمانًا علميًا.</p>`)
      else if (a === 'recoverDialog') this.modal('إصلاح الحفظ المحلي؟', `<p>سيُحفظ تقدمك الحالي بدل النص التالف بعد الاحتفاظ بنسخة منه للفحص. لا تستخدم هذا إلا إذا ظهرت رسالة تعذر الحفظ، ويمكنك تصدير النسخة الحالية أولًا.</p><div class="button-pair">${btn('إلغاء', 'close')}${btn('إصلاح بالحالة الحالية', 'recoverConfirm', '', 'primary')}</div>`)
      else if (a === 'resetDialog') this.modal('هل تريد بداية جديدة؟', `<p>سيُستبدل تقدمك الحالي بمزرعة جديدة. هذا يشمل المال والمخزون والمباني والعقود. يمكنك الإلغاء أو تصدير نسخة أولًا.</p><div class="button-pair">${btn('إلغاء', 'close')}${btn('نعم، ابدأ من جديد', 'resetConfirm', '', 'danger')}</div>`)
      else { this.handler(a, payload); if (['plant', 'water', 'harvest', 'fertilize', 'resetConfirm'].includes(a)) this.dialog.close() }
    })
    this.root.addEventListener('submit', e => {
      e.preventDefault(); const form = e.target as HTMLFormElement; const values = new FormData(form)
      if (form.id === 'sale-form') { this.handler('sell', { product: form.dataset.product, channel: form.dataset.channel, quantity: Number(values.get('quantity')), expectedUnit: Number(form.dataset.expectedUnit) }); this.dialog.close() }
      if (form.id === 'purchase-form') { this.handler('buySeeds', { crop: form.dataset.crop, quantity: Number(values.get('quantity')) }); this.dialog.close() }
      if (form.id === 'brand-form') this.handler('brand', { name: values.get('brandName'), logo: values.get('brandLogo') })
    })
    this.root.addEventListener('input', e => { const input = e.target as HTMLInputElement; if (input.id === 'quantity') this.updateSaleTotal(); if (input.id === 'buy-quantity') { const form = input.closest('form')!; this.dialog.querySelector('#buy-total')!.textContent = `${money(Number(input.value) * crops[form.dataset.crop!].seedPrice)} عملة` } })
    this.root.addEventListener('change', e => { const input = e.target as HTMLInputElement; if (input.id === 'mute-toggle') this.handler('settings', { muted: input.checked }); if (input.id === 'motion-toggle') this.handler('settings', { reducedMotion: input.checked }); if (input.id === 'import-save' && input.files?.[0]) input.files[0].text().then(text => this.handler('import', { text })).catch(() => this.toast('تعذرت قراءة ملف الحفظ.', true)) })
    this.dialog.addEventListener('click', e => { if (e.target === this.dialog) this.dialog.close() })
  }
}
