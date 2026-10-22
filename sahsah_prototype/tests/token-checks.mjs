import { expect } from '@playwright/test'

const UI = 'sahsah.demo.ui.v1'
const read = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), UI)
const balance = (page) => expect.poll(async () => (await read(page)).tokens)
const phase = (page, value) =>
  expect.poll(async () => (await read(page)).session?.phase).toBe(value)
const login = async (page) => {
  await page.getByLabel('الاسم', { exact: true }).fill('عميل التوكنز')
  await page.getByLabel('رقم الموبايل', { exact: true }).fill('01012345678')
  await page.getByRole('button', { name: 'ابعت الكود على واتساب', exact: true }).click()
  await page.getByLabel('رقم 1', { exact: true }).fill('123456')
  await page.getByRole('button', { name: 'تأكيد والدخول', exact: true }).click()
}
const pay = async (page) => {
  await page.getByRole('button', { name: 'اطلب كود فوري', exact: true }).click()
  await page.getByRole('button', { name: 'دفعت — كمّل (محاكاة)', exact: true }).dblclick()
  await expect(page.getByRole('heading', { name: 'تم الدفع', exact: true })).toBeVisible()
}

export async function reviewTokenEconomy(browser, base) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  })
  const page = await context.newPage(),
    errors = [],
    requests = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) requests.push(request.url())
  })
  try {
    await page.goto(base + '/tokens')
    await expect(page.getByRole('heading', { name: 'توكن واحد = لعبة واحدة' })).toBeVisible()
    await balance(page).toBe(0)
    for (const [quantity, price] of [
      [1, '١٠'],
      [2, '٢٠'],
      [5, '٥٠'],
    ]) {
      const option = page.getByRole('radio', { name: `${quantity} توكن`, exact: true })
      await option.click()
      await expect(option).toContainText(price + ' ج.م')
      await expect(page.getByRole('textbox', { name: 'عدد التوكنز', exact: true })).toHaveValue(
        String(quantity),
      )
    }
    for (const value of ['', '0', '-1', '1.5', '1000']) {
      await page.getByRole('textbox', { name: 'عدد التوكنز', exact: true }).fill(value)
      await expect(page.getByRole('button', { name: 'اشتري توكنز', exact: true })).toBeDisabled()
    }
    await page.getByRole('textbox', { name: 'عدد التوكنز', exact: true }).fill('٧')
    await page.getByLabel('عندك كود خصم؟', { exact: true }).fill('SAH20')
    await page.getByRole('button', { name: 'تطبيق', exact: true }).click()
    await expect(page.getByText('٥٦ ج.م', { exact: true })).toBeVisible()
    await page.screenshot({ path: 'test-results/tokens-desktop.png', fullPage: true })
    await page.setViewportSize({ width: 320, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: 'test-results/tokens-mobile.png', fullPage: true })
    await page.getByRole('button', { name: 'اشتري توكنز', exact: true }).click()
    await login(page)
    await expect(page.getByRole('textbox', { name: 'عدد التوكنز', exact: true })).toHaveValue('7')
    await expect(page.getByText('٥٦ ج.م', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'اشتري توكنز', exact: true }).click()
    const order = Object.values((await read(page)).orders)[0]
    expect(order.quantity).toBe(7)
    expect(order.unitPrice).toBe(10)
    await page.getByRole('button', { name: 'اطلب كود فوري', exact: true }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: 'test-results/token-checkout-mobile.png', fullPage: true })
    await page.getByRole('button', { name: 'دفعت — كمّل (محاكاة)', exact: true }).dblclick()
    await expect(page.getByRole('heading', { name: 'تم الدفع', exact: true })).toBeVisible()
    await balance(page).toBe(7)
    await page.reload()
    await balance(page).toBe(7)
    expect((await read(page)).paidOrders).toHaveLength(1)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByRole('link', { name: 'العب الآن', exact: true }).last().click()
    await page.getByRole('button', { name: 'جرّب الألعاب الجديدة', exact: true }).click()
    await phase(page, 'lobby')
    await balance(page).toBe(7)
    await page.getByRole('button', { name: 'ابدأ اللعبة', exact: true }).dblclick()
    await phase(page, 'board')
    await balance(page).toBe(6)
    await page.reload()
    await balance(page).toBe(6)
    const room = (await read(page)).session
    const guest = await context.newPage()
    await guest.goto(base + '/join/' + room.code)
    await guest.getByRole('button', { name: 'ادخل', exact: true }).click()
    await phase(guest, 'board')
    const q = room.questions.find((q) => q.type === 'STANDARD')
    await page.locator(`[data-question-id="${q.id}"]`).click()
    await phase(page, 'question')
    await page.getByRole('button', { name: 'عجبني السؤال', exact: true }).click()
    await expect(page.getByText('شكرًا على رأيك!', { exact: true })).toBeVisible()
    await balance(page).toBe(6)
    const feedback = (await read(page)).feedback[room.id + ':' + q.id]
    expect(feedback.vote).toBe('like')
    expect(feedback).not.toHaveProperty('reward')
    expect((await read(page)).session.teams.every((team) => team.score === 0)).toBe(true)
    await page.reload()
    await expect(page.getByText('شكرًا على رأيك!', { exact: true })).toBeVisible()
    await balance(page).toBe(6)
    await page.getByRole('button', { name: 'رجوع للوحة', exact: true }).click()
    await page.getByRole('button', { name: 'إنهاء اللعبة', exact: true }).click()
    await phase(page, 'finished')
    await page.getByRole('button', { name: 'العبوا مرة تانية', exact: true }).dblclick()
    await phase(page, 'board')
    await balance(page).toBe(5)
    expect((await read(page)).chargedGames).toHaveLength(2)
    await page.goto(base + '/tokens?tab=gift')
    await page.getByRole('radio', { name: '2 توكن', exact: true }).click()
    await page.getByLabel('رقم المستلم', { exact: true }).fill('01012345678')
    await page.getByLabel('رسالة', { exact: true }).fill('يلا نلعب لعبتين!')
    await page.getByRole('button', { name: 'إهداء التوكنز', exact: true }).click()
    await pay(page)
    await balance(page).toBe(5)
    expect(Object.values((await read(page)).orders).find((order) => order.gift).quantity).toBe(2)
    await page.goto(base + '/tokens')
    await page.getByRole('radio', { name: '1 توكن', exact: true }).click()
    await page.getByRole('button', { name: 'اشتري توكنز', exact: true }).click()
    await pay(page)
    await balance(page).toBe(6)
    await balance(guest).toBe(6)
    await page.goto(base + '/account')
    await expect(page.getByText('رصيد التوكنز', { exact: true })).toBeVisible()
    await page.screenshot({ path: 'test-results/token-account.png', fullPage: true })
    expect(errors).toEqual([])
    expect(requests).toEqual([])
    console.log(
      'Token economy passed: 1/2/5/custom quantities, 10 EGP price, promo, login continuation, single payment credit, one token per start/replay, free feedback, gifts, refresh and shared browser balance.',
    )
  } catch (error) {
    await page
      .screenshot({ path: 'test-results/token-failure.png', fullPage: true })
      .catch(() => {})
    throw error
  } finally {
    await context.close()
  }

  const empty = await browser.newContext({ reducedMotion: 'reduce' }),
    host = await empty.newPage()
  try {
    await host.goto(base + '/play')
    await host.getByRole('button', { name: 'جرّب الألعاب الجديدة', exact: true }).click()
    await phase(host, 'lobby')
    const sessionId = (await read(host)).session.id
    await host.getByRole('button', { name: 'اشتري توكن وابدأ', exact: true }).click()
    await host.getByRole('radio', { name: '2 توكن', exact: true }).click()
    await host.getByRole('button', { name: 'اشتري توكنز', exact: true }).click()
    await login(host)
    await host.getByRole('button', { name: 'اشتري توكنز', exact: true }).click()
    await pay(host)
    await host.getByRole('link', { name: 'كمّل لعبتك', exact: true }).click()
    await phase(host, 'lobby')
    expect((await read(host)).session.id).toBe(sessionId)
    await host.getByRole('button', { name: 'ابدأ اللعبة', exact: true }).click()
    await phase(host, 'board')
    await balance(host).toBe(1)
    await host.getByRole('button', { name: 'إنهاء اللعبة', exact: true }).click()
    await host.getByRole('button', { name: 'العبوا مرة تانية', exact: true }).click()
    await phase(host, 'board')
    await balance(host).toBe(0)
    await host.getByRole('button', { name: 'إنهاء اللعبة', exact: true }).click()
    await phase(host, 'finished')
    await host.getByRole('button', { name: 'اشتري توكن للعبة جديدة', exact: true }).click()
    await host.getByRole('button', { name: 'اشتري توكنز', exact: true }).click()
    await pay(host)
    await host.getByRole('link', { name: 'كمّل لعبتك', exact: true }).click()
    await phase(host, 'finished')
    await host.getByRole('button', { name: 'العبوا مرة تانية', exact: true }).click()
    await phase(host, 'board')
    await balance(host).toBe(0)
    expect((await read(host)).chargedGames).toHaveLength(3)
  } finally {
    await empty.close()
  }

  const legacy = await browser.newContext()
  await legacy.addInitScript(() => {
    if (!localStorage.getItem('sahsah.demo.ui.v1'))
      localStorage.setItem(
        'sahsah.demo.ui.v1',
        JSON.stringify({
          coins: 409,
          user: { name: 'حساب قديم', phone: '01012345678' },
          orders: { old: { id: 'old', bundleId: 'b2', status: 'success' } },
          paidOrders: ['old'],
          feedback: { question: { vote: 'like', reward: 9, at: 1 } },
          activity: [
            { id: 'old', text: 'شحن 400 عملة', at: 1 },
            { id: 'fbquestion', text: 'مكافأة رأيك: +9 عملة', at: 1 },
          ],
        }),
      )
  })
  const migrated = await legacy.newPage()
  try {
    await migrated.goto(base + '/account')
    await balance(migrated).toBe(2)
    const saved = await read(migrated)
    expect(saved).not.toHaveProperty('coins')
    expect(saved.orders.old.quantity).toBe(2)
    expect(saved.feedback.question).not.toHaveProperty('reward')
    expect(saved.activity).toHaveLength(1)
    await migrated.reload()
    await balance(migrated).toBe(2)
    console.log('Empty wallet purchase/resume/replay and old coin/reward migration passed.')
  } finally {
    await legacy.close()
  }
}
