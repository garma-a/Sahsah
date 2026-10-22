import { chromium, expect } from '@playwright/test'
import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync, mkdirSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { homedir } from 'node:os'
import { reviewBoard } from './board-checks.mjs'
import { reviewPartyModes } from './party-checks.mjs'
import { reviewTokenEconomy } from './token-checks.mjs'

// Serve only the built files. There is deliberately no backend or Vite plugin.
const root = path.resolve('dist'),
  calls = [],
  failures = []
const mime = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.svg': 'image/svg+xml',
}
const server = createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  if (pathname.startsWith('/api/')) {
    calls.push(pathname)
    res.writeHead(503, { 'Content-Type': 'application/json' })
    res.end('{"error":"No backend in prototype test"}')
    return
  }
  const file = path.resolve(root, '.' + pathname)
  if (file !== root && !file.startsWith(root + path.sep)) {
    res.writeHead(404)
    res.end()
    return
  }
  const target =
    existsSync(file) && statSync(file).isFile()
      ? file
      : path.extname(file)
        ? null
        : path.join(root, 'index.html')
  if (!target) {
    failures.push(pathname)
    res.writeHead(404)
    res.end()
    return
  }
  res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream' })
  res.end(readFileSync(target))
})
await new Promise((resolve) => server.listen(8460, '127.0.0.1', resolve))
const cache = path.join(homedir(), '.cache/ms-playwright')
const cachedBrowser = existsSync(cache)
  ? readdirSync(cache)
      .filter((name) => name.startsWith('chromium_headless_shell-'))
      .sort()
      .reverse()
      .map((name) => path.join(cache, name, 'chrome-headless-shell-linux64/chrome-headless-shell'))
      .find((file) => existsSync(file))
  : undefined
const executablePath =
  process.env.SAHSAH_CHROMIUM_PATH ||
  (existsSync(chromium.executablePath()) ? undefined : cachedBrowser)
const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
})
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await context.addInitScript(() => {
  if (!localStorage.getItem('sahsah.demo.ui.v1'))
    localStorage.setItem('sahsah.demo.ui.v1', JSON.stringify({ tokens: 2 }))
})
context.setDefaultTimeout(10000)
const host = await context.newPage(),
  guest = await context.newPage(),
  errors = []
for (const page of [host, guest]) page.on('pageerror', (error) => errors.push(error.message))
const base = 'http://127.0.0.1:8460'
const state = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('sahsah.demo.ui.v1') || '{}').session)
const waitPhase = (page, phase) => expect.poll(async () => (await state(page))?.phase).toBe(phase)
mkdirSync('test-results', { recursive: true })
const open = async (type) => {
  const s = await state(host)
  const q = s.questions
    .filter((q) => q.type === type && q.state === 'available')
    .sort((a, b) => (a.audioDurationMs ?? 0) - (b.audioDurationMs ?? 0))[0]
  if (!q) throw new Error(`No ${type} demo question`)
  await host.locator(`[data-question-id="${q.id}"]`).click()
  await waitPhase(host, 'question')
  await waitPhase(guest, 'question')
  return q
}
try {
  if (!process.argv.includes('--party-only')) await reviewTokenEconomy(browser, base)
  if (!process.argv.includes('--tokens-only')) {
    await reviewPartyModes(browser, base)
    if (!process.argv.includes('--party-only')) {
      await reviewBoard(browser, base)
      await reviewBoard(browser, base, undefined, {
        label: 'new-artwork',
        categories: [
          'صيف إسكندرية',
          'رحلة في مصر',
          'مصر القديمة',
          'ألعاب الطفولة',
          'أكل الشارع',
          'ثقافة عامة',
        ],
      })
      await host.goto(base + '/play')
      for (const name of [
        'سينما مصرية',
        'طرب وكاسيت',
        'كورة وجمهور',
        'ثقافة عامة',
        'مصر القديمة',
        'رحلة في مصر',
      ])
        await host.getByRole('button', { name, exact: true }).click()
      await host.getByRole('button', { name: 'ابدأ اللعبة', exact: true }).click()
      await expect(host.getByText('سمّوا الفريقين')).toBeVisible()
      const room = await state(host)
      await guest.goto(base + '/join/' + room.code)
      await guest.getByLabel('اسمك (اختياري)').fill('ضيف العرض')
      await guest.getByRole('button', { name: 'ادخل', exact: true }).click()
      await expect(guest.getByText('الشلة بتتجمع')).toBeVisible()
      await host.getByRole('button', { name: 'ابدأ اللعبة', exact: true }).click()
      await waitPhase(host, 'board')
      await waitPhase(guest, 'board')
      await expect(
        host.getByRole('region', { name: 'لوحة الأسئلة' }).getByRole('button'),
      ).toHaveCount(36)
      for (const type of ['STANDARD', 'IMAGE_BLUR', 'IMAGE_ZOOM']) {
        const q = await open(type)
        await expect(host.getByRole('timer')).toHaveAttribute('aria-label', '30 ثانية')
        if (type !== 'STANDARD') {
          await host
            .getByRole('button', {
              name: type === 'IMAGE_BLUR' ? 'وضح الصورة' : 'وسع الصورة',
              exact: true,
            })
            .dblclick()
          await expect
            .poll(async () => (await state(host)).questions.find((x) => x.id === q.id).stageIndex)
            .toBe(1)
          await expect
            .poll(async () => (await state(guest)).questions.find((x) => x.id === q.id).stageIndex)
            .toBe(1)
          await host.reload()
          await expect(
            host.getByRole('button', { name: 'إظهار الإجابة', exact: true }),
          ).toBeEnabled()
          await expect
            .poll(async () => (await state(host)).questions.find((x) => x.id === q.id).stageIndex)
            .toBe(1)
        }
        await host.getByRole('button', { name: 'ابدأ الوقت', exact: true }).click()
        await expect(host.getByRole('button', { name: 'وقّف الوقت', exact: true })).toBeVisible()
        await host.getByRole('button', { name: 'إعادة الوقت', exact: true }).click()
        await host.getByRole('button', { name: 'إظهار الإجابة', exact: true }).click()
        await waitPhase(host, 'answer')
        if (type === 'IMAGE_BLUR')
          await host.getByRole('button', { name: /الفراعنة.*\+/ }).dblclick()
        else await host.getByRole('button', { name: 'ولا حد', exact: true }).click()
        await waitPhase(host, 'board')
      }
      const sound = await open('AUDIO_GUESS')
      await expect(guest.getByRole('button', { name: 'شغّل الصوت', exact: true })).toBeDisabled()
      await host.evaluate(() => {
        window.originalPlay = HTMLMediaElement.prototype.play
        HTMLMediaElement.prototype.play = () =>
          Promise.reject(new DOMException('Rejected', 'NotAllowedError'))
      })
      await host.getByRole('button', { name: 'شغّل الصوت', exact: true }).click()
      await expect(host.getByRole('alert')).toContainText('الصوت مش اشتغل')
      await expect
        .poll(
          async () => (await state(host)).questions.find((q) => q.id === sound.id).audioPlaysUsed,
        )
        .toBe(0)
      await host.evaluate(() => {
        HTMLMediaElement.prototype.play = window.originalPlay
      })
      for (let i = 1; i <= 3; i++) {
        await host.getByRole('button', { name: 'شغّل الصوت', exact: true }).click()
        await expect
          .poll(
            async () => (await state(host)).questions.find((q) => q.id === sound.id).audioPlaysUsed,
          )
          .toBe(i)
        await expect
          .poll(
            async () =>
              (await state(guest)).questions.find((q) => q.id === sound.id).audioPlaysUsed,
          )
          .toBe(i)
        await expect
          .poll(
            async () => (await state(host)).questions.find((q) => q.id === sound.id).audioIsPlaying,
            { timeout: 15000 },
          )
          .toBe(false)
      }
      await expect(host.getByRole('button', { name: 'شغّل الصوت', exact: true })).toBeDisabled()
      await host.getByRole('button', { name: 'إظهار الإجابة', exact: true }).click()
      await host.getByRole('button', { name: 'ولا حد', exact: true }).click()
      await waitPhase(host, 'board')
      const reverse = await open('AUDIO_REVERSE')
      await host.getByRole('button', { name: 'شغّل الصوت', exact: true }).click()
      await expect
        .poll(
          async () => (await state(host)).questions.find((q) => q.id === reverse.id).audioPlaysUsed,
        )
        .toBe(1)
      await host.getByRole('button', { name: 'إظهار الإجابة', exact: true }).click()
      await expect(host.locator('audio[controls]')).toHaveCount(1)
      await host.getByRole('button', { name: 'ولا حد', exact: true }).click()
      await waitPhase(host, 'board')
      await host.getByRole('button', { name: 'تعديل النقاط', exact: true }).click()
      await host.getByRole('button', { name: 'تعديل رصيد الفراعنة', exact: true }).click()
      await host.getByLabel('الرصيد الجديد').fill('275')
      await host.getByRole('button', { name: 'حفظ الرصيد', exact: true }).click()
      await expect.poll(async () => (await state(host)).teams[0].score).toBe(275)
      await host.getByRole('button', { name: 'تعديل النقاط', exact: true }).click()
      await host.setViewportSize({ width: 390, height: 844 })
      await open('IMAGE_ZOOM')
      await host.waitForTimeout(350)
      await host.screenshot({ path: 'test-results/demo-mobile.png', fullPage: true })
      if (await host.evaluate(() => document.documentElement.scrollWidth > innerWidth))
        throw new Error('Mobile overflow')
      await host.getByRole('button', { name: 'إظهار الإجابة', exact: true }).click()
      await host.getByRole('button', { name: 'ولا حد', exact: true }).click()
      await waitPhase(host, 'board')
      await host.getByRole('button', { name: 'إنهاء اللعبة', exact: true }).click()
      await waitPhase(host, 'finished')
      await host.getByRole('button', { name: 'العبوا مرة تانية', exact: true }).click()
      await waitPhase(host, 'board')
      await expect.poll(async () => (await state(host)).teams[0].score).toBe(0)

      const admin = await context.newPage()
      admin.on('pageerror', (error) => errors.push(error.message))
      await admin.goto(base + '/admin')
      await expect(admin.getByText('كل سؤال، له حكاية')).toBeVisible()
      await admin.getByRole('button', { name: 'سؤال جديد', exact: true }).click()
      await admin.getByLabel('نوع السؤال', { exact: true }).selectOption('IMAGE_ZOOM')
      await admin.getByLabel('الإجابة الصحيحة', { exact: true }).fill('إجابة تجريبية')
      await admin
        .getByLabel('رفع الصورة', { exact: true })
        .setInputFiles('src/assets/img/general.webp')
      await admin
        .getByRole('button', { name: 'اختيار نقطة التركيز', exact: true })
        .click({ position: { x: 100, y: 100 } })
      await admin.getByRole('button', { name: 'حفظ وتوليد المراحل', exact: true }).click()
      await expect(admin.getByText('اتحفظ ✓', { exact: true })).toBeVisible({ timeout: 15000 })
      await expect(admin.getByRole('img', { name: 'معاينة المرحلة 1', exact: true })).toBeVisible()
      await admin.reload()
      await expect(admin.getByText('كل سؤال، له حكاية')).toBeVisible()
      await admin.getByRole('button', { name: /إيه الحاجة دي؟.*ثقافة عامة/ }).click()
      await expect(admin.getByRole('img', { name: 'معاينة المرحلة 1', exact: true })).toBeVisible()
      await admin.getByRole('button', { name: 'سؤال جديد', exact: true }).click()
      await admin.getByLabel('نوع السؤال', { exact: true }).selectOption('AUDIO_REVERSE')
      await admin.getByLabel('الكلام الأصلي / الإجابة', { exact: true }).fill('صباح الخير')
      await admin
        .getByLabel('رفع الصوت', { exact: true })
        .setInputFiles('server/seed-media/admin_only/reverse_originals/R01/forward_reference.wav')
      await admin.getByRole('button', { name: 'حفظ وتوليد الصوت المعكوس', exact: true }).click()
      await expect(admin.getByText('اتحفظ ✓', { exact: true })).toBeVisible({ timeout: 15000 })
      await expect(admin.locator('audio')).toHaveCount(2)
      const sources = await admin
        .locator('audio')
        .evaluateAll((players) => players.map((player) => player.src))
      if (sources[0] === sources[1]) throw new Error('Reverse preview reused forward media')

      const account = await context.newPage()
      account.on('pageerror', (error) => errors.push(error.message))
      await account.goto(base + '/auth/login')
      await account.getByLabel('الاسم', { exact: true }).fill('عميل العرض')
      await account.getByLabel('رقم الموبايل', { exact: true }).fill('01012345678')
      await account.getByRole('button', { name: 'ابعت الكود على واتساب', exact: true }).click()
      await account.getByLabel('رقم 1', { exact: true }).fill('123456')
      await account.getByRole('button', { name: 'تأكيد والدخول', exact: true }).click()
      await expect(
        account.getByRole('heading', { name: 'أهلًا يا عميل العرض', exact: true }),
      ).toBeVisible()
      const tokens = () =>
        account.evaluate(() => JSON.parse(localStorage.getItem('sahsah.demo.ui.v1')).tokens)
      const beforePurchase = await tokens()
      await account.getByRole('link', { name: 'اشتري توكنز', exact: true }).click()
      await account
        .getByRole('radiogroup', { name: 'عدد التوكنز' })
        .getByRole('radio')
        .first()
        .click()
      await account.getByLabel('عندك كود خصم؟', { exact: true }).fill('SAH20')
      await account.getByRole('button', { name: 'تطبيق', exact: true }).click()
      await expect(
        account.getByRole('status').filter({ hasText: 'تم تطبيق ٢٠٪ خصم' }),
      ).toBeVisible()
      await account.getByRole('button', { name: 'اشتري توكنز', exact: true }).click()
      await account.getByRole('button', { name: 'اطلب كود فوري', exact: true }).click()
      await account.getByRole('button', { name: 'دفعت — كمّل (محاكاة)', exact: true }).click()
      await expect(account.getByRole('heading', { name: 'تم الدفع', exact: true })).toBeVisible()
      await expect.poll(tokens).toBe(beforePurchase + 1)
      await account.reload()
      await expect(account.getByRole('heading', { name: 'تم الدفع', exact: true })).toBeVisible()
      await expect.poll(tokens).toBe(beforePurchase + 1)

      const phoneContext = await browser.newContext(),
        phone = await phoneContext.newPage()
      phone.on('pageerror', (error) => errors.push(error.message))
      await phone.goto(base + '/join/' + room.code)
      await expect(phone.getByText('عرض ضيف تجريبي', { exact: false })).toBeVisible()
      await phone.getByRole('button', { name: 'ادخل', exact: true }).click()
      await waitPhase(phone, 'board')
      await expect(
        phone.getByRole('region', { name: 'لوحة الأسئلة' }).getByRole('button').first(),
      ).toBeDisabled()
      if (calls.length) throw new Error('Prototype called unavailable backend: ' + calls.join(', '))
      if (failures.length) throw new Error('Missing built assets: ' + failures.join(', '))
      if (errors.length) throw new Error(errors.join('\n'))
      console.log(
        'Static prototype passed: all five modes, timer/scoring, three audio plays, rejected playback, refresh, replay, admin image/audio uploads, simulated login/payment, guest preview, mobile, deep links and zero backend requests.',
      )
      await phoneContext.close()
    }
  }
} catch (error) {
  await host.screenshot({ path: 'test-results/demo-failure.png', fullPage: true }).catch(() => {})
  throw error
} finally {
  await browser.close()
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
}
