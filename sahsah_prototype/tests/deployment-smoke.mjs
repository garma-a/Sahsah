import { chromium, expect } from '@playwright/test'
import { createServer } from 'node:http'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

// Exercise the static deployment, with no Vite plugin or API service.
const root = path.resolve('dist')
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
}
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  const candidate = path.resolve(root, '.' + pathname)
  if (
    (!candidate.startsWith(root + path.sep) && candidate !== root) ||
    pathname.startsWith('/api/')
  ) {
    response.writeHead(404)
    response.end()
    return
  }
  const file =
    existsSync(candidate) && statSync(candidate).isFile()
      ? candidate
      : path.extname(candidate)
        ? null
        : path.join(root, 'index.html')
  if (!file || !existsSync(file)) {
    response.writeHead(404)
    response.end()
    return
  }
  response.writeHead(200, {
    'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream',
  })
  response.end(readFileSync(file))
})

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
let browser
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
  const base = process.env.SAHSAH_SMOKE_URL || `http://127.0.0.1:${server.address().port}`
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  })
  // A browser-only fixture with two purchased demo tokens; all actions use the UI.
  await context.addInitScript(() => {
    if (!localStorage.getItem('sahsah.demo.ui.v1')) {
      localStorage.setItem('sahsah.demo.ui.v1', JSON.stringify({ tokens: 2 }))
    }
  })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  const errors = [],
    apiCalls = [],
    missingAssets = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) apiCalls.push(request.url())
  })
  page.on('response', (response) => {
    if (new URL(response.url()).pathname.startsWith('/assets/') && response.status() >= 400) {
      missingAssets.push(response.url())
    }
  })

  await page.goto(base + '/tokens')
  await expect(page.getByRole('heading', { name: 'توكن واحد = لعبة واحدة' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'اشتري', exact: true })).toHaveCount(3)
  await page.goto(base + '/play')
  await page.getByRole('button', { name: 'جرّب الألعاب الجديدة', exact: true }).click()
  await expect(page.getByText('سمّوا الفريقين')).toBeVisible()
  await page.getByRole('button', { name: 'ابدأ اللعبة', exact: true }).click()
  await page.getByRole('button', { name: 'يلا نبدأ!', exact: true }).click()
  const board = page.getByRole('region', { name: 'لوحة الأسئلة' })
  await expect(board.getByRole('button')).toHaveCount(36)
  const state = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem('sahsah.demo.ui.v1')).session)
  const session = await state()
  const question = session.questions.find((item) => item.type === 'STANDARD')
  expect(question).toBeTruthy()
  await page.locator(`[data-question-id="${question.id}"]`).click()
  await page.getByRole('button', { name: 'إظهار الإجابة', exact: true }).click()
  await page.getByRole('button', { name: /الفراعنة.*\+/ }).click()
  await expect.poll(async () => (await state()).teams[0].score).toBe(question.availablePoints)
  await expect(board.getByRole('button')).toHaveCount(36)
  await page.reload()
  await expect(page.locator(`[data-question-id="${question.id}"]`)).toBeDisabled()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(board.getByRole('button')).toHaveCount(36)
  expect(errors).toEqual([])
  expect(apiCalls).toEqual([])
  expect(missingAssets).toEqual([])
  console.log(
    `Static deployment passed: ${base}; deep links, token cards, lobby, intro, board, reveal, scoring, refresh, mobile, no API or missing assets.`,
  )
} finally {
  await browser?.close()
  await new Promise((resolve) => server.close(resolve))
}
