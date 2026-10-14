import { expect } from '@playwright/test'

export async function reviewPartyModes(browser, base) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  await context.addInitScript(() => {
    if (!localStorage.getItem('sahsah.demo.ui.v1'))
      localStorage.setItem('sahsah.demo.ui.v1', JSON.stringify({ tokens: 2 }))
  })
  const errors = [],
    backendCalls = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) backendCalls.push(request.url())
  })
  const state = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem('sahsah.demo.ui.v1')).session)
  const phase = (value) => expect.poll(async () => (await state()).phase).toBe(value)
  const scene = () => page.getByRole('img', { name: 'صورة التحدي', exact: true })
  try {
    await page.goto(base + '/play')
    for (const title of [
      'مين في الصورة؟',
      'اللون الأصلي إيه؟',
      'الصورة بتقول إيه؟',
      'مين صاحب الصوت؟',
      'ركز معايا',
    ])
      await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'جرّب الألعاب الجديدة', exact: true }).click()
    await expect(page.getByText('سمّوا الفريقين')).toBeVisible()
    await page.getByRole('button', { name: 'ابدأ اللعبة', exact: true }).click()
    await phase('board')
    const initial = await state()
    expect(initial.questions).toHaveLength(36)
    expect(new Set(initial.questions.map((q) => q.type)).size).toBe(8)
    await page.screenshot({ path: 'test-results/party-board-desktop.png', fullPage: true })
    for (const q of initial.questions) {
      await page.locator(`[data-question-id="${q.id}"]`).click()
      await phase('question')
      if (q.type === 'IMAGE_PERSON') {
        await expect(scene()).toBeVisible()
        expect(await scene().evaluate((img) => getComputedStyle(img).clipPath)).not.toBe('none')
      }
      if (q.type === 'IMAGE_COLOR') {
        expect(await scene().evaluate((img) => getComputedStyle(img).filter)).toBe('grayscale(1)')
      }
      if (q.type === 'IMAGE_MEMORY') {
        await expect(scene()).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'إظهار الإجابة', exact: true })).toBeDisabled()
        await expect(page.getByRole('button', { name: 'ابدأ الوقت', exact: true })).toBeDisabled()
        await page.getByRole('button', { name: 'اعرض الصورة', exact: true }).click()
        await expect(scene()).toBeVisible()
        if (q.row === 0) {
          await page.reload()
          await expect(scene()).toBeVisible()
          await page.getByRole('button', { name: 'خلاص، اسألني', exact: true }).click()
          await expect(scene()).toHaveCount(0)
          await page.getByRole('button', { name: 'عرض الصورة من جديد', exact: true }).click()
          await expect(page.getByRole('button', { name: 'اعرض الصورة', exact: true })).toBeVisible()
          await page.getByRole('button', { name: 'اعرض الصورة', exact: true }).click()
        }
        if (q.row === 1 || q.row === 5) {
          const deadline = (await state()).questions.find((x) => x.id === q.id).memoryEndsAt
          await page.getByRole('button', { name: 'رجوع للوحة', exact: true }).click()
          await phase('board')
          if (q.row === 5) await page.waitForTimeout(5500)
          await page.locator(`[data-question-id="${q.id}"]`).click()
          await phase('question')
          expect((await state()).questions.find((x) => x.id === q.id).memoryEndsAt).toBe(deadline)
          if (q.row === 1) await expect(scene()).toBeVisible()
        }
        if (q.row < 4) await page.getByRole('button', { name: 'خلاص، اسألني', exact: true }).click()
        await expect(page.getByRole('button', { name: 'إظهار الإجابة', exact: true })).toBeEnabled({
          timeout: 8000,
        })
        await expect(scene()).toHaveCount(0)
        await expect
          .poll(async () => (await state()).questions.find((x) => x.id === q.id).memoryPhase)
          .toBe('recall')
        if (q.row === 4) {
          await page.reload()
          await expect(scene()).toHaveCount(0)
          await expect(
            page.getByRole('button', { name: 'عرض الصورة من جديد', exact: true }),
          ).toBeVisible()
        }
      }
      if (q.type === 'AUDIO_VOICE' && q.row === 0) {
        await page.evaluate(() => {
          window.actualPartyPlay = HTMLMediaElement.prototype.play
          HTMLMediaElement.prototype.play = () =>
            Promise.reject(new DOMException('Denied', 'NotAllowedError'))
        })
        await page.getByRole('button', { name: 'شغّل الصوت', exact: true }).click()
        await expect(page.getByRole('alert')).toContainText('الصوت مش اشتغل')
        expect((await state()).questions.find((x) => x.id === q.id).audioPlaysUsed).toBe(0)
        await page.evaluate(() => {
          HTMLMediaElement.prototype.play = window.actualPartyPlay
        })
        for (let count = 1; count <= 3; count++) {
          await page.getByRole('button', { name: 'شغّل الصوت', exact: true }).click()
          await expect
            .poll(async () => (await state()).questions.find((x) => x.id === q.id).audioPlaysUsed)
            .toBe(count)
          await expect
            .poll(async () => (await state()).questions.find((x) => x.id === q.id).audioIsPlaying, {
              timeout: 6000,
            })
            .toBe(false)
        }
        await page.reload()
        await expect(page.getByRole('button', { name: 'شغّل الصوت', exact: true })).toBeDisabled()
      }
      if (
        q.row === 0 &&
        ['IMAGE_PERSON', 'IMAGE_COLOR', 'IMAGE_RIDDLE', 'AUDIO_VOICE', 'IMAGE_MEMORY'].includes(
          q.type,
        )
      ) {
        await page.setViewportSize({ width: 320, height: 844 })
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
          .toBe(true)
        await page.screenshot({
          path: `test-results/party-${q.type.toLowerCase()}-mobile.png`,
          fullPage: true,
        })
        await page.setViewportSize({ width: 1440, height: 900 })
      }
      await page.getByRole('button', { name: 'إظهار الإجابة', exact: true }).click()
      await phase('answer')
      if (q.type === 'IMAGE_PERSON')
        expect(
          await page
            .getByRole('img', { name: 'الصورة كاملة بعد كشف الإجابة' })
            .evaluate((img) => getComputedStyle(img).clipPath),
        ).toBe('none')
      if (q.type === 'IMAGE_COLOR')
        expect(
          await page
            .getByRole('img', { name: 'الصورة كاملة بعد كشف الإجابة' })
            .evaluate((img) => getComputedStyle(img).filter),
        ).toBe('none')
      await expect
        .poll(() =>
          page
            .locator('img')
            .evaluateAll((images) => images.every((img) => img.complete && img.naturalWidth > 0)),
        )
        .toBe(true)
      await page.getByRole('button', { name: /الفراعنة.*\+/ }).click()
      await phase(q.id === initial.questions.at(-1).id ? 'finished' : 'board')
    }
    expect((await state()).teams[0].score).toBe(14400)
    await page.getByRole('button', { name: 'العبوا مرة تانية', exact: true }).click()
    await phase('board')
    const replay = await state()
    expect(replay.teams[0].score).toBe(0)
    expect(replay.questions.every((q) => q.state === 'available')).toBe(true)
    expect(
      replay.questions
        .filter((q) => q.type === 'IMAGE_MEMORY')
        .every((q) => q.memoryPhase === 'ready'),
    ).toBe(true)
    expect(
      replay.questions.filter((q) => q.type === 'AUDIO_VOICE').every((q) => q.audioPlaysUsed === 0),
    ).toBe(true)
    expect(errors).toEqual([])
    expect(backendCalls).toEqual([])
    console.log(
      'New party modes passed: all 36 questions, portrait/color reveal, memory expiry/refresh/reset, voice three-play limit/rejected playback, scoring/replay, 320px layouts and zero backend requests.',
    )
  } catch (error) {
    await page
      .screenshot({ path: 'test-results/party-failure.png', fullPage: true })
      .catch(() => {})
    throw error
  } finally {
    await context.close()
  }
}
