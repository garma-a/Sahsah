import { expect } from '@playwright/test'

// Verify the requested arrangement by rendered geometry, then play every tile
// to catch category/question mismatches introduced by changing the board order.
export async function reviewBoard(browser, base, storageKey = 'sahsah.demo.ui.v1', options = {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  })
  context.setDefaultTimeout(10000)
  const page = await context.newPage(),
    errors = []
  await context.addInitScript(() => {
    if (!localStorage.getItem('sahsah.demo.ui.v1'))
      localStorage.setItem('sahsah.demo.ui.v1', JSON.stringify({ tokens: 2 }))
  })
  page.on('pageerror', (error) => errors.push(error.message))
  const state = () =>
    page.evaluate((key) => JSON.parse(localStorage.getItem(key)).session, storageKey)
  try {
    await page.goto(base + '/play')
    for (const name of options.categories ?? [
      'سينما مصرية',
      'طرب وكاسيت',
      'كورة وجمهور',
      'رمضانيات',
      'قفشات وضحك',
      'الحرف والسوق',
    ])
      await page.getByRole('button', { name, exact: true }).click()
    await page.getByRole('button', { name: 'ابدأ اللعبة', exact: true }).click()
    await expect(page.getByText('سمّوا الفريقين')).toBeVisible()
    await page.getByRole('button', { name: 'ابدأ اللعبة', exact: true }).click()
    const board = page.getByRole('region', { name: 'لوحة الأسئلة' })
    await expect(board.getByRole('button')).toHaveCount(36)
    const session = await state()
    const categories = board.locator('[data-category-id]')
    await expect(categories).toHaveCount(6)
    for (let index = 0; index < 6; index++) {
      const category = categories.nth(index),
        cid = session.categoryIds[index]
      await expect(category).toHaveAttribute('data-category-id', cid)
      await expect(category.getByRole('button')).toHaveCount(6)
      const questions = session.questions
        .filter((q) => q.categoryId === cid)
        .sort((a, b) => a.row - b.row)
      for (let row = 0; row < 6; row++) {
        await expect(category.getByRole('button').nth(row)).toHaveAttribute(
          'data-question-id',
          questions[row].id,
        )
        await expect(category.getByRole('button').nth(row)).toHaveText(
          String(questions[row].points),
        )
      }
      await category.scrollIntoViewIfNeeded()
      const image = category.getByRole('img')
      await expect
        .poll(() => image.evaluate((img) => img.complete && img.naturalWidth > 0))
        .toBe(true)
      if (cid !== 'cinema') {
        const info = await image.evaluate((img) => ({
          width: img.naturalWidth,
          height: img.naturalHeight,
          fit: getComputedStyle(img).objectFit,
          path: new URL(img.src).pathname,
          displayedRatio: img.getBoundingClientRect().width / img.getBoundingClientRect().height,
        }))
        expect(info.width).toBe(1672)
        expect(info.height).toBe(941)
        expect(info.fit).toBe('contain')
        expect(info.path).toContain('/' + cid)
        expect(Math.abs(info.displayedRatio - 1672 / 941)).toBeLessThan(0.005)
      }
    }
    for (const [width, columns] of [
      [320, 1],
      [390, 1],
      [768, 2],
      [1024, 3],
      [1440, 3],
      [1920, 3],
    ]) {
      await page.setViewportSize({ width, height: 1080 })
      await page.mouse.move(0, 0)
      await page.evaluate(() => scrollTo(0, 0))
      await page.waitForTimeout(100)
      const boxes = await categories.evaluateAll((elements) =>
        elements.map((el) => {
          const r = el.getBoundingClientRect()
          return { x: r.x, y: r.y, width: r.width }
        }),
      )
      for (let i = 1; i < 6; i++) {
        if (i % columns === 0) expect(boxes[i].y).toBeGreaterThan(boxes[i - 1].y)
        else {
          expect(Math.abs(boxes[i].y - boxes[i - 1].y)).toBeLessThan(2)
          expect(boxes[i].x).toBeLessThan(boxes[i - 1].x) // Arabic right-to-left order.
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
      const tiles = await categories
        .first()
        .getByRole('button')
        .evaluateAll((elements) =>
          elements.map((el) => ({
            x: el.offsetLeft,
            y: el.offsetTop,
          })),
        )
      for (let pair = 0; pair < 3; pair++) {
        expect(Math.abs(tiles[pair * 2].y - tiles[pair * 2 + 1].y)).toBeLessThan(2)
        expect(tiles[pair * 2].x).toBeGreaterThan(tiles[pair * 2 + 1].x)
      }
      console.log(`Board layout verified: ${width}px, ${columns} category columns, 36 tiles.`)
      if (width === 390 || width === 1440)
        await page.screenshot({
          path: `test-results/board-${options.label || 'new'}-${width}-${new URL(base).port}.png`,
          fullPage: true,
        })
    }
    await page.setViewportSize({ width: 1440, height: 900 })
    for (let index = 0; index < 36; index++) {
      const question = session.questions[index]
      await page.locator(`[data-question-id="${question.id}"]`).click()
      await expect.poll(async () => (await state()).activeQuestionId).toBe(question.id)
      await expect(
        page.getByRole('heading', { level: 1, name: question.prompt, exact: true }),
      ).toBeVisible()
      await page.getByRole('button', { name: 'إظهار الإجابة', exact: true }).click()
      await page.getByRole('button', { name: 'ولا حد', exact: true }).click()
      await expect.poll(async () => (await state()).phase).toBe(index === 35 ? 'finished' : 'board')
      if (index < 35)
        await expect(page.locator(`[data-question-id="${question.id}"]`)).toBeDisabled()
    }
    expect((await state()).questions.every((q) => q.state === 'answered')).toBe(true)
    expect(errors).toEqual([])
    console.log('All 36 question buttons opened the correct question and completed the game.')
  } finally {
    await context.close()
  }
}
