import './styles/main.css'
import './styles/pwa-improvements.css'
import { Audio as GameAudio } from './engine/audio'
import { GameLoop } from './engine/loop'
import { action, tick, createState } from './farm/engine'
import { loadState, saveState, exportSave, importSave, recoverSave } from './farm/storage'
import { FarmInterface } from './farm/interface'
import { FarmScene } from './farm/scene'

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
let installPrompt: InstallPrompt | null = null
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault()
  installPrompt = event as InstallPrompt
  document.dispatchEvent(new CustomEvent('pwa-install-available'))
})
window.addEventListener('appinstalled', () => { installPrompt = null; document.dispatchEvent(new CustomEvent('pwa-installed')) })
;(window as any).__installPwa = async () => {
  if (!installPrompt) return false
  await installPrompt.prompt()
  const choice = await installPrompt.userChoice
  installPrompt = null
  return choice.outcome === 'accepted'
}

const bootStarted = performance.now()
const bootLoader = document.querySelector<HTMLElement>('#boot-loader')
const bootBar = document.querySelector<HTMLElement>('#boot-progress-bar')
const bootStatus = document.querySelector<HTMLElement>('#boot-status')
const bootTime = document.querySelector<HTMLElement>('#boot-time')
const bootTimer = window.setInterval(() => {
  if (bootTime) bootTime.textContent = `الوقت المنقضي: ${((performance.now() - bootStarted) / 1000).toFixed(1)} ث`
}, 100)
const bootStep = (percent: number, status: string) => {
  if (bootBar) bootBar.style.width = `${percent}%`
  if (bootStatus) bootStatus.textContent = status
}

async function boot() {
  const loaded = loadState()
  bootStep(18, 'نقرأ مزرعتك المحفوظة بأمان…')
  let state = loaded.state
  let scene: FarmScene | undefined
  let audio: GameAudio | undefined
  let lastSave = 0
  let lastRefresh = 0
  let lastError = ''
  let pendingImport: typeof state | null = null
  const save = (manual = false) => {
    const result = saveState(state)
    ui.saved(result.ok, result.ok ? undefined : result.message)
    if (manual) ui.toast(result.ok ? 'تم حفظ مزرعتك على هذا المتصفح.' : result.message, !result.ok)
    else if (!result.ok && lastError !== result.message) ui.toast(result.message, true)
    lastError = result.ok ? '' : result.message
    lastSave = Date.now()
  }
  const sound = (type: string) => {
    try {
      audio ??= new GameAudio()
      audio.unlock()
      audio.setVolumes(0, .22, state.settings.muted)
      if (type === 'harvest' || type === 'harvestAll') audio.play('pickup')
      else if (type === 'sell' || type === 'deliverContract' || type === 'claim') audio.play('win')
      else if (type === 'water' || type === 'waterAll') audio.play('land')
      else audio.play('ui')
    } catch { /* Sound is optional, never block gameplay. */ }
  }
  const ui = new FarmInterface(document.querySelector('#app')!, state, (type, payload = {}) => {
    try {
      if (type === 'save') { save(true); return }
      if (type === 'zoomIn') { scene?.zoom(-1); return }
      if (type === 'zoomOut') { scene?.zoom(1); return }
      if (type === 'cameraReset') { scene?.resetCamera(); return }
      if (type === 'export') {
        const blob = new Blob([exportSave(state)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = `green-empire-${new Date().toISOString().slice(0, 10)}.json`; a.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
        ui.toast('تم تصدير نسخة احتياطية. احتفظ بها في مكان آمن.'); return
      }
      if (type === 'import') {
        pendingImport = importSave(String(payload.text))
        if (!pendingImport) { ui.toast('ملف الحفظ غير صالح، لم يتغير تقدمك.', true); return }
        ui.modal('استبدال تقدمك الحالي؟', '<p>النسخة صالحة. استيرادها سيستبدل مزرعتك الحالية. صدّر تقدمك أولًا إذا أردت الاحتفاظ به.</p><div class="button-pair"><button class="btn" data-action="close">إلغاء</button><button class="btn primary" data-action="importConfirm">نعم، استيراد النسخة</button></div>'); return
      }
      if (type === 'recoverConfirm') { const result = recoverSave(state); ui.saved(result.ok); ui.toast(result.message, !result.ok); document.querySelector<HTMLDialogElement>('#game-dialog')!.close(); return }
      if (type === 'importConfirm') {
        if (!pendingImport) return
        state = pendingImport; pendingImport = null; tick(state)
        ui.setState(state); document.querySelector<HTMLDialogElement>('#game-dialog')!.close(); scene?.setState(state); save(); ui.toast('تم استيراد مزرعتك بنجاح.'); return
      }
      if (type === 'resetConfirm') {
        state = createState(); action(state, 'start'); ui.setState(state); scene?.setState(state); save(); ui.navigate('farm'); ui.toast('مزرعة جديدة، فرصة جديدة.'); return
      }
      const result = action(state, type, payload)
      if (!result.ok) { ui.toast(result.message, true); return }
      sound(type)
      document.body.classList.toggle('reduced-motion', state.settings.reducedMotion)
      ui.refresh(true); scene?.sync(); save()
      ui.toast(result.message)
    } catch (err) {
      ui.toast('لم تكتمل العملية. تقدمك السابق محفوظ؛ حاول مجددًا.', true)
      console.error(err)
    }
  })
  if (loaded.warning) ui.toast(loaded.warning, true)
  bootStep(42, 'نرتب الشاشات والمخزن…')
  document.body.classList.toggle('reduced-motion', state.settings.reducedMotion)
  scene = new FarmScene(document.querySelector('#farm-canvas')!, state, index => ui.selectPlot(index))
  ui.onChangePage = page => { scene!.visible = page === 'farm'; if (page === 'farm') scene!.resize() }
  bootStep(58, 'نحمّل مشهد المزرعة ثلاثي الأبعاد…')
  await scene.load()
  bootStep(92, 'نجهّز أدوات اللعب والحفظ المحلي…')
  let tickAccumulator = 0
  const loop = new GameLoop({
    step: dt => {
      tickAccumulator += dt
      if (tickAccumulator >= .5) { tick(state); tickAccumulator = 0 }
    },
    render: (_alpha, frameSeconds) => {
      scene!.render(frameSeconds)
      const now = Date.now()
      if (now - lastRefresh > 800) { ui.refresh(); scene!.sync(); lastRefresh = now }
      if (now - lastSave > 5000) save()
    },
  })
  loop.start()
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); else { tick(state); ui.refresh(true); scene?.sync() } })
  window.addEventListener('pagehide', () => save())
  window.addEventListener('beforeunload', () => save())
  if ('serviceWorker' in navigator && !import.meta.env.DEV) {
    navigator.serviceWorker.register('./sw.js').catch(() => ui.toast('اللعب متاح؛ تعذر تجهيز وضع عدم الاتصال على هذا المتصفح.', true))
  }
  bootStep(100, 'اكتملت الجاهزية — مزرعتك تنتظرك.')
  window.clearInterval(bootTimer)
  if (bootLoader) { bootLoader.style.opacity = '0'; bootLoader.style.pointerEvents = 'none' }
  window.setTimeout(() => bootLoader?.remove(), 320)
  ;(window as any).__farm = { get state() { return state }, ui, scene, action: (type: string, payload: any, now?: number) => { const result = action(state, type, payload, now); ui.refresh(true); scene?.sync(); return result }, save: () => save() }
  if (import.meta.env.DEV) {
    const [{ registerGameTuning }, { tuning }] = await Promise.all([import('../scripts/manus-tuning/adapter.js'), import('./game/tuning')])
    await registerGameTuning(tuning)
  }
}
boot().catch(err => {
  console.error(err)
  document.querySelector('#app')!.innerHTML = '<div class="initial-loader"><h1>تعذر فتح المزرعة</h1><p>لم نحذف بيانات الحفظ. أعد المحاولة أو تحقق من دعم WebGL في المتصفح.</p><button class="btn primary" onclick="location.reload()">إعادة المحاولة</button></div>'
})
