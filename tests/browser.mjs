import { chromium, expect } from '@playwright/test'
import { createServer } from 'vite'
import { mkdtempSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

process.env.VITE_DEMO_MODE = 'false'
process.env.SAHSAH_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'sahsah-browser-'))
const server = await createServer({
  cacheDir: mkdtempSync(path.join(tmpdir(), 'sahsah-vite-cache-')),
  server: { host: '127.0.0.1', port: 8455, strictPort: true },
})
await server.listen()
const browser = await chromium.launch({
  headless: true,
  ...(process.env.SAHSAH_CHROMIUM_PATH ? { executablePath: process.env.SAHSAH_CHROMIUM_PATH } : {}),
})
const base = 'http://127.0.0.1:8455'
mkdirSync('test-results', { recursive: true })
const errors = []
const hostContext = await browser.newContext({
  viewport: { width: 1440, height: 900 },
})
const guestContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
})
const host = await hostContext.newPage(),
  guest = await guestContext.newPage()
for (const page of [host, guest]) page.on('pageerror', (error) => errors.push(error.message))
const state = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('sahsah.v1') || '{}').session)
const waitPhase = (page, phase) => expect.poll(async () => (await state(page))?.phase).toBe(phase)
const open = async (type) => {
  const s = await state(host),
    q = s.questions.find((q) => q.type === type && q.state === 'available')
  if (!q) throw new Error(`Missing question type ${type}`)
  await host.locator(`[data-question-id="${q.id}"]`).click()
  await waitPhase(host, 'question')
  await waitPhase(guest, 'question')
  return q
}
try {
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
  await host.getByRole('textbox').nth(0).fill('فريق التجربة أ')
  await host.getByRole('textbox').nth(1).fill('فريق التجربة ب')
  await guest.goto(base + `/join/${room.code}`)
  await guest.getByRole('textbox', { name: 'اسمك (اختياري)' }).fill('ضيف التجربة')
  await guest.getByRole('button', { name: 'ادخل', exact: true }).click()
  await expect(guest.getByText('الشلة بتتجمع')).toBeVisible()
  await host.getByRole('button', { name: 'ابدأ اللعبة', exact: true }).click()
  await waitPhase(host, 'board')
  await waitPhase(guest, 'board')
  await expect(host.getByRole('region', { name: 'لوحة الأسئلة' }).getByRole('button')).toHaveCount(
    36,
  )
  await expect.poll(async () => (await state(host)).teams[0].name).toBe('فريق التجربة أ')
  await host.waitForTimeout(350)
  await host.screenshot({
    path: 'test-results/board-desktop.png',
    fullPage: true,
  })

  const blur = await open('IMAGE_BLUR')
  await expect(host.getByRole('timer')).toHaveAttribute('aria-label', '30 ثانية')
  await expect(guest.getByRole('button', { name: 'وضح الصورة', exact: true })).toHaveCount(0)
  await host.getByRole('button', { name: 'وضح الصورة', exact: true }).dblclick()
  await expect
    .poll(async () => (await state(host)).questions.find((q) => q.id === blur.id).stageIndex)
    .toBe(1)
  await expect
    .poll(async () => (await state(guest)).questions.find((q) => q.id === blur.id).stageIndex)
    .toBe(1)
  await host.reload()
  await expect(host.getByRole('button', { name: 'وضح الصورة', exact: true })).toBeVisible()
  await expect
    .poll(async () => (await state(host)).questions.find((q) => q.id === blur.id).stageIndex)
    .toBe(1)
  await host.getByRole('button', { name: 'ابدأ الوقت', exact: true }).click()
  await expect(host.getByRole('button', { name: 'وقّف الوقت', exact: true })).toBeVisible()
  await host.getByRole('button', { name: 'إعادة الوقت', exact: true }).click()
  await expect(host.getByRole('timer')).toHaveAttribute('aria-label', '30 ثانية')
  await host.waitForTimeout(350)
  await host.screenshot({
    path: 'test-results/blur-desktop.png',
    fullPage: true,
  })
  await guest.waitForTimeout(350)
  await guest.screenshot({
    path: 'test-results/blur-mobile.png',
    fullPage: true,
  })
  await host.getByRole('button', { name: 'إظهار الإجابة', exact: true }).click()
  await waitPhase(host, 'answer')
  await host.getByRole('button', { name: /فريق التجربة أ.*\+/ }).dblclick()
  await waitPhase(host, 'board')
  const awarded = await state(host)
  if (awarded.teams[0].score !== blur.pointStages[1]) throw new Error('Incorrect image-stage award')
  await host.getByRole('button', { name: 'تعديل النقاط', exact: true }).click()
  await host.getByRole('button', { name: 'إضافة ١٠٠ لـفريق التجربة أ', exact: true }).click()
  await expect.poll(async () => (await state(host)).teams[0].score).toBe(blur.pointStages[1] + 100)
  await host.getByRole('button', { name: 'تعديل رصيد فريق التجربة أ', exact: true }).click()
  await host.getByLabel('الرصيد الجديد', { exact: true }).fill(String(blur.pointStages[1] + 125))
  await host.getByRole('button', { name: 'حفظ الرصيد', exact: true }).click()
  await expect.poll(async () => (await state(host)).teams[0].score).toBe(blur.pointStages[1] + 125)
  await host.getByRole('button', { name: 'تعديل النقاط', exact: true }).click()

  await open('IMAGE_ZOOM')
  await host.getByRole('button', { name: 'وسع الصورة', exact: true }).click()
  await host.waitForTimeout(350)
  await host.screenshot({
    path: 'test-results/zoom-desktop.png',
    fullPage: true,
  })
  await host.getByRole('button', { name: 'إظهار الإجابة', exact: true }).click()
  await host.getByRole('button', { name: 'ولا حد', exact: true }).click()
  await waitPhase(host, 'board')

  const sound = await open('AUDIO_GUESS')
  await expect(host.getByText('٣ مرات متاحة', { exact: true })).toBeVisible()
  await expect(guest.getByRole('button', { name: 'شغّل الصوت', exact: true })).toBeDisabled()
  await host.waitForTimeout(350)
  await host.screenshot({
    path: 'test-results/audio-desktop.png',
    fullPage: true,
  })
  await expect(guest.locator('audio')).toHaveCount(0)
  await host.evaluate(() => {
    window.sahsahOriginalPlay = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = () =>
      Promise.reject(new DOMException('Browser rejected playback', 'NotAllowedError'))
  })
  await host.getByRole('button', { name: 'شغّل الصوت', exact: true }).click()
  await expect(host.getByRole('alert')).toContainText('الصوت مش اشتغل، جرّب تاني')
  if ((await state(host)).questions.find((q) => q.id === sound.id).audioPlaysUsed !== 0)
    throw new Error('Rejected playback consumed a play')
  await host.evaluate(() => {
    HTMLMediaElement.prototype.play = window.sahsahOriginalPlay
  })
  for (let i = 1; i <= 3; i++) {
    await host.getByRole('button', { name: 'شغّل الصوت', exact: true }).click()
    await expect
      .poll(async () => (await state(host)).questions.find((q) => q.id === sound.id).audioPlaysUsed)
      .toBe(i)
    await expect
      .poll(
        async () => (await state(guest)).questions.find((q) => q.id === sound.id).audioPlaysUsed,
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
  await expect(host.getByText('مرات التشغيل خلصت', { exact: true })).toBeVisible()
  await host.getByRole('button', { name: 'إظهار الإجابة', exact: true }).click()
  await host.getByRole('button', { name: 'ولا حد', exact: true }).click()
  await waitPhase(host, 'board')

  await open('AUDIO_REVERSE')
  await expect(host.locator('audio[controls]')).toHaveCount(0)
  await host.getByRole('button', { name: 'إظهار الإجابة', exact: true }).click()
  await expect(host.locator('audio[controls]')).toHaveCount(1)
  await host.waitForTimeout(350)
  await host.screenshot({
    path: 'test-results/reverse-reveal.png',
    fullPage: true,
  })
  await host.getByRole('button', { name: 'ولا حد', exact: true }).click()
  await waitPhase(host, 'board')
  await open('STANDARD')
  await host.getByRole('button', { name: 'إظهار الإجابة', exact: true }).click()
  await host.getByRole('button', { name: 'ولا حد', exact: true }).click()
  await waitPhase(host, 'board')

  await host.setViewportSize({ width: 390, height: 844 })
  await open('IMAGE_ZOOM')
  await host.waitForTimeout(350)
  await host.screenshot({
    path: 'test-results/zoom-host-mobile.png',
    fullPage: true,
  })
  if (await host.evaluate(() => document.documentElement.scrollWidth > innerWidth))
    throw new Error('Mobile question overflows horizontally')
  await host.getByRole('button', { name: 'إظهار الإجابة', exact: true }).click()
  await host.getByRole('button', { name: 'ولا حد', exact: true }).click()
  await waitPhase(host, 'board')
  await host.setViewportSize({ width: 1440, height: 900 })
  await host.getByRole('button', { name: 'ملء الشاشة', exact: true }).click()
  await expect.poll(() => host.evaluate(() => !!document.fullscreenElement)).toBe(true)
  await host.getByRole('button', { name: 'ملء الشاشة', exact: true }).click()

  const admin = await hostContext.newPage()
  admin.on('pageerror', (error) => errors.push(error.message))
  await admin.goto(base + '/admin')
  await admin.getByLabel('كلمة السر', { exact: true }).fill('browser-test-password')
  await admin.getByRole('button', { name: 'إنشاء حساب الإدارة', exact: true }).click()
  await expect(admin.getByText('كل سؤال، له حكاية')).toBeVisible()
  await admin.getByRole('button', { name: 'سؤال جديد', exact: true }).click()
  await admin.getByLabel('نوع السؤال', { exact: true }).selectOption('IMAGE_ZOOM')
  await admin.getByLabel('الإجابة الصحيحة', { exact: true }).fill('إجابة اختبار خاصة')
  await admin.getByLabel('رفع الصورة', { exact: true }).setInputFiles('src/assets/img/general.webp')
  await admin
    .getByRole('button', { name: 'اختيار نقطة التركيز', exact: true })
    .click({ position: { x: 60, y: 60 } })
  await admin.getByRole('button', { name: 'حفظ وتوليد المراحل', exact: true }).click()
  await expect(admin.getByText('اتحفظ ✓', { exact: true })).toBeVisible({
    timeout: 15000,
  })
  await expect(admin.getByRole('img', { name: 'معاينة المرحلة 1', exact: true })).toBeVisible()
  await admin.waitForTimeout(350)
  await admin.screenshot({
    path: 'test-results/admin-desktop.png',
    fullPage: true,
  })
  await admin.setViewportSize({ width: 390, height: 844 })
  await admin.waitForTimeout(350)
  await admin.screenshot({
    path: 'test-results/admin-mobile.png',
    fullPage: true,
  })
  if (await admin.evaluate(() => document.documentElement.scrollWidth > innerWidth))
    throw new Error('Admin mobile page overflows horizontally')
  if (errors.length) throw new Error(errors.join('\n'))
  const legacyContext = await browser.newContext()
  await legacyContext.addInitScript(() => {
    const old = {
      id: 'legacy-browser-game',
      code: '1234',
      phase: 'question',
      categoryIds: ['football', 'general', 'cinema', 'travel', 'music', 'ancient'],
      teams: [
        { id: 'A', name: 'الفراعنة', score: 600 },
        { id: 'B', name: 'الجدعان', score: 1200 },
      ],
      questions: [
        { id: 'general-0', categoryId: 'general', row: 0, state: 'answered' },
        {
          id: 'general-1',
          categoryId: 'general',
          row: 1,
          state: 'available',
          correctAnswer: 'do not trust this answer',
        },
      ],
      activeQuestionId: 'general-1',
      timer: { status: 'paused', remainingMs: 12000 },
    }
    localStorage.setItem('sahsah.v1', JSON.stringify({ selected: old.categoryIds, session: old }))
    sessionStorage.setItem('sahsah.v1.host', old.id)
  })
  const migrated = await legacyContext.newPage()
  migrated.on('pageerror', (error) => errors.push(error.message))
  await migrated.goto(base + '/game/legacy-browser-game')
  await expect(
    migrated.getByRole('heading', { name: 'كام عدد محافظات مصر؟', exact: true }),
  ).toBeVisible()
  await expect.poll(async () => (await state(migrated))?.teams[0].score).toBe(600)
  await expect.poll(async () => (await state(migrated))?.teams[1].score).toBe(1200)
  if ((await state(migrated)).timer.remainingMs !== 12000)
    throw new Error('Migration reset the manual timer')
  await migrated.getByRole('button', { name: 'إظهار الإجابة', exact: true }).click()
  await expect(migrated.getByText('27', { exact: true })).toBeVisible()
  if (errors.length) throw new Error(errors.join('\n'))
  await legacyContext.close()
  console.log(
    'Browser checks passed: original landing art, two-device QR join/sync, all five modes, manual timer/scoring, shared audio cap, refresh, mobile, fullscreen and admin image generation.',
  )
} catch (error) {
  if (errors.length) console.error('Browser errors:', errors)
  await host.screenshot({ path: 'test-results/host-failure.png', fullPage: true }).catch(() => {})
  await guest.screenshot({ path: 'test-results/guest-failure.png', fullPage: true }).catch(() => {})
  throw error
} finally {
  await browser.close()
  await server.close()
}
