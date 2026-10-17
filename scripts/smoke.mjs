import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
const port = 4400 + Math.floor(Math.random() * 500)
const url = `http://127.0.0.1:${port}/`
const out = process.env.SHOTS_DIR ?? 'shots'
mkdirSync(out, { recursive: true })
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' })
let browser
const checks = []
const errors = []
const assert = (test, msg) => { if (!test) throw new Error(msg); checks.push(msg); console.log(`PASS: ${msg}`) }
const guard = setTimeout(() => { server.kill(); process.exit(1) }, 180000)
async function open(context) {
  const page = await context.newPage()
  page.on('console', m => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', e => errors.push(String(e)))
  page.on('response', r => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`))
  await page.goto(url)
  await page.waitForFunction(() => !!window.__farm, { timeout: 45000 })
  return page
}
const state = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__farm.state)))
const nav = async (page, id) => page.locator(`.navigation [data-page="${id}"]`).click()
async function clickPlot(page, index) {
  const p = await page.evaluate(i => window.__farm.scene.screenPosition(i), index)
  const rect = await page.locator('#farm-canvas').boundingBox()
  await page.mouse.click(rect.x + p.x, rect.y + p.y)
}
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break } catch {} await new Promise(r => setTimeout(r, 250)) }
  browser = await chromium.launch({ args: ['--ignore-gpu-blocklist'] }).catch(() => chromium.launch({ channel: 'chrome', args: ['--ignore-gpu-blocklist'] }))
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'en-US' })
  const page = await open(desktop)
  await page.screenshot({ path: `${out}/01-start.png` })
  await page.click('[data-action="start"]')
  assert((await state(page)).started, 'بدء لعبة جديدة فعليًا')
  assert(await page.evaluate(() => document.documentElement.lang === 'ar' && document.documentElement.dir === 'rtl'), 'لغة عربية RTL ثابتة رغم لغة المتصفح الإنجليزية')
  await clickPlot(page, 0)
  assert((await state(page)).plots[0]?.crop === 'cucumber', 'النقر على مشهد Three.js يزرع الخيار ويخصم البذرة')
  await page.click('[data-tool="water"]')
  await clickPlot(page, 0)
  assert((await state(page)).plots[0]?.watered, 'ري حقيقي يبدأ النمو')
  // Save, close page, let real time elapse, then reopen the same browser storage.
  await page.evaluate(() => window.__farm.save())
  const before = await state(page)
  await page.close()
  await new Promise(r => setTimeout(r, 23000))
  const reopened = await open(desktop)
  const after = await state(reopened)
  assert(after.coins === before.coins && after.seeds.cucumber === before.seeds.cucumber, 'إغلاق الصفحة وإعادة فتحها يحافظ على المال والمخزون')
  await reopened.click('[data-tool="harvest"]')
  await clickPlot(reopened, 0)
  const harvested = await state(reopened)
  assert(harvested.inventory.cucumber > 0 && harvested.plots[0] === null, 'نمو حقيقي أثناء الغياب ثم حصاد إلى المخزن')
  await reopened.click('[data-tool="plant"]')
  await clickPlot(reopened, 1)
  await reopened.click('[data-tool="water"]')
  await clickPlot(reopened, 1)
  await reopened.screenshot({ path: `${out}/02-farm-desktop.png` })
  await nav(reopened, 'market')
  await reopened.click('[data-action="saleDialog"][data-product="cucumber"]')
  await reopened.locator('#quantity').fill('1')
  const totalText = await reopened.locator('#sale-total').textContent()
  const quotedUnit = await reopened.locator('#sale-form').evaluate(form => Number(form.dataset.expectedUnit))
  const oldCoins = (await state(reopened)).coins
  await reopened.click('#sale-form button[type="submit"]')
  const sold = await state(reopened)
  assert(sold.coins === oldCoins + quotedUnit && sold.inventory.cucumber === harvested.inventory.cucumber - 1, 'بيع كمية محددة يضيف المبلغ المعروض بدقة ويخصم المخزون')
  assert(totalText?.includes('عملة'), 'إظهار الإجمالي قبل تأكيد البيع')
  assert(await reopened.evaluate(() => !window.__farm.action('sell', { product: 'cucumber', quantity: 99999 }).ok), 'رفض بيع أكبر من المخزون')
  assert(await reopened.evaluate(() => !window.__farm.action('buySeeds', { crop: 'cucumber', quantity: 99999 }).ok), 'رفض شراء يتجاوز الرصيد')
  await reopened.click('[data-market-tab="buy"]')
  await reopened.click('[data-action="purchaseDialog"][data-crop="cucumber"]')
  await reopened.locator('#buy-quantity').fill('2')
  const seedsBefore = (await state(reopened)).seeds.cucumber
  await reopened.click('#purchase-form button[type="submit"]')
  assert((await state(reopened)).seeds.cucumber === seedsBefore + 2, 'شراء بذور بالواجهة يضيفها إلى المخزن')
  await reopened.screenshot({ path: `${out}/03-market.png` })
  await nav(reopened, 'farm')
  await reopened.click('[data-tool="plant"]')
  for (const index of [2, 3, 4]) await clickPlot(reopened, index)
  await reopened.click('[data-action="waterAll"]')
  await reopened.waitForTimeout(23000)
  await reopened.click('[data-action="harvestAll"]')
  await nav(reopened, 'contracts')
  const contractId = (await state(reopened)).contracts[0].id
  await reopened.click(`[data-action="acceptContract"][data-id="${contractId}"]`)
  assert((await state(reopened)).contracts[0].status === 'active', 'قبول عقد فعلي عبر الواجهة')
  await reopened.click(`[data-action="deliverContract"][data-id="${contractId}"]`)
  assert((await state(reopened)).contracts[0].status === 'delivered', 'تسليم عقد من حصاد حقيقي والحصول على المكافأة')
  assert(await reopened.evaluate(id => !window.__farm.action('deliverContract', { id }).ok, contractId), 'منع تسليم العقد مرتين في المتصفح')
  await nav(reopened, 'upgrades')
  const plotsBefore = (await state(reopened)).plots.length
  await reopened.click('[data-action="upgrade"][data-id="land"]')
  assert((await state(reopened)).plots.length === plotsBefore + 4, 'شراء توسعة أرض يضيف حقولًا فعلية')
  for (const id of ['storage','contracts','upgrades','workers','factory','brand','transport','quests','finance','settings']) {
    await nav(reopened, id)
    assert(await reopened.locator('#content-section').isVisible(), `تنقل شاشة ${id}`)
  }
  const seedsBeforeReset = (await state(reopened)).seeds.cucumber
  await reopened.click('[data-action="resetDialog"]')
  await reopened.click('dialog [data-action="close"]')
  assert((await state(reopened)).seeds.cucumber === seedsBeforeReset, 'إلغاء إعادة البدء لا يمس التقدم')
  await nav(reopened, 'farm')
  await reopened.evaluate(() => window.__farm.save())
  // The acceptance of contracts/factory/shipping/double rewards/full storage is in deterministic unit tests.
  await reopened.evaluate(async () => {
    await navigator.serviceWorker.register('./sw.js')
    await navigator.serviceWorker.ready
  })
  if (!await reopened.evaluate(() => !!navigator.serviceWorker.controller)) {
    await reopened.reload()
    await reopened.waitForFunction(() => !!window.__farm)
  }
  assert(await reopened.evaluate(() => !!navigator.serviceWorker.controller), 'اكتمال تنشيط عامل الخدمة قبل فصل الاتصال')
  await desktop.setOffline(true)
  await reopened.reload()
  await reopened.waitForFunction(() => !!window.__farm, { timeout: 15000 })
  assert((await state(reopened)).coins > 0, 'إعادة تحميل اللعبة دون إنترنت بعد اكتمال التخزين المؤقت')
  await desktop.setOffline(false)
  await desktop.close()
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ar' })
  const phone = await open(mobile)
  await phone.tap('[data-action="start"]')
  assert(await phone.locator('.mobile-nav').isVisible(), 'شريط لمس متجاوب على هاتف 390×844')
  const pos = await phone.evaluate(() => window.__farm.scene.screenPosition(0))
  const rect = await phone.locator('#farm-canvas').boundingBox()
  await phone.touchscreen.tap(rect.x + pos.x, rect.y + pos.y)
  assert((await state(phone)).plots[0]?.crop === 'cucumber', 'لمس الحقل على الهاتف يزرع المحصول')
  assert(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'لا تجاوز أفقي على شاشة الهاتف')
  await phone.screenshot({ path: `${out}/04-farm-mobile.png`, fullPage: true })
  await phone.tap('.mobile-nav [data-page="market"]')
  assert(await phone.locator('.tabs').isVisible(), 'التنقل إلى السوق باللمس')
  await phone.tap('.mobile-nav [data-action="more"]')
  await phone.tap('dialog [data-page="settings"]')
  assert(await phone.locator('#mute-toggle').isVisible(), 'المزيد يفتح الإعدادات على الهاتف')
  await phone.tap('#mute-toggle')
  assert((await state(phone)).settings.muted, 'كتم الصوت محفوظ في حالة اللعبة')
  await mobile.close()
  if (errors.length) throw new Error(errors.join('\n'))
  writeFileSync(`${out}/smoke-results.json`, JSON.stringify({ passed: checks.length, checks, consoleErrors: errors }, null, 2))
  console.log(`smoke: OK — ${checks.length} checks, no console/page/network errors`)
} catch (err) {
  console.error(`smoke: FAIL — ${err?.stack ?? err}`)
  writeFileSync(`${out}/smoke-results.json`, JSON.stringify({ passed: checks.length, checks, consoleErrors: errors, failure: String(err) }, null, 2))
  process.exitCode = 1
} finally { await browser?.close(); server.kill('SIGTERM'); clearTimeout(guard) }
