import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { createApi } from './api.ts'

const api = createApi()
const root = path.resolve('dist')
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}
const server = createServer((req, res) => {
  void api.handler(req, res, () => {
    try {
      const pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname)
      const file = path.resolve(root, '.' + pathname)
      if (file !== root && !file.startsWith(root + path.sep)) {
        res.writeHead(404)
        res.end()
        return
      }
      const target =
        existsSync(file) && statSync(file).isFile() ? file : path.join(root, 'index.html')
      if (!existsSync(target)) {
        res.writeHead(503)
        res.end('Build the app with npm run build first.')
        return
      }
      res.writeHead(200, {
        'Content-Type': mime[path.extname(target)] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
      })
      res.end(readFileSync(target))
    } catch {
      res.writeHead(400)
      res.end()
    }
  })
})
server.listen(Number(process.env.PORT || 8443), process.env.HOST || '0.0.0.0', () =>
  console.log(`صح صح is running on port ${process.env.PORT || 8443}`),
)
const close = () => {
  api.close()
  server.close(() => process.exit(0))
}
process.on('SIGTERM', close)
process.on('SIGINT', close)
