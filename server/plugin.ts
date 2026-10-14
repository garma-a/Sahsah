import type { Plugin } from 'vite'
import { createApi } from './api.ts'
export default function sahsahApi(): Plugin {
  return {
    name: 'sahsah-session-api',
    configureServer(server) {
      const api = createApi()
      server.middlewares.use(api.handler)
      server.httpServer?.on('close', api.close)
    },
    configurePreviewServer(server) {
      const api = createApi()
      server.middlewares.use(api.handler)
      server.httpServer.on('close', api.close)
    },
  }
}
