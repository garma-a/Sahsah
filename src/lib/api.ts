import type { AdminQuestion, Session } from './game-types'
import { DEMO_MODE } from './runtime'
const HOST_KEY = DEMO_MODE ? 'sahsah.demo.host.v1' : 'sahsah.host.v2'
let demo: Promise<typeof import('#demo-service')> | undefined
let resolveDemoMedia: ((id?: string) => string | undefined) | undefined
const simulation = () =>
  (demo ??= import('#demo-service').then((module) => {
    resolveDemoMedia = module.mediaUrl
    return module
  }))
export const hostCredentials = (): {
  sessionId: string
  token: string
} | null => {
  try {
    return JSON.parse(sessionStorage.getItem(HOST_KEY) || 'null')
  } catch {
    return null
  }
}
export const saveHost = (sessionId: string, token: string) =>
  sessionStorage.setItem(HOST_KEY, JSON.stringify({ sessionId, token }))
export const clearHost = () => sessionStorage.removeItem(HOST_KEY)
export async function api<T>(
  url: string,
  data?: unknown,
  method = data === undefined ? 'GET' : 'POST',
): Promise<T> {
  const credentials = hostCredentials()
  if (DEMO_MODE) return (await simulation()).request<T>(url, data, method, credentials?.token || '')
  const res = await fetch(url, {
    method,
    headers: {
      ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(credentials ? { Authorization: `Bearer ${credentials.token}` } : {}),
    },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || 'حصلت مشكلة، جرّب تاني')
  return body
}
export const getSession = (id: string) => api<Session>(`/api/sessions/${id}`)
export const getAdminMediaUrl = (id?: string) =>
  id ? (DEMO_MODE ? resolveDemoMedia?.(id) : `/api/admin/media/${id}`) : undefined
export async function uploadQuestionMedia(id: string, file: Blob): Promise<AdminQuestion> {
  if (DEMO_MODE)
    return (await simulation()).request(`/api/admin/questions/${id}/media`, file, 'POST', '')
  const response = await fetch(`/api/admin/questions/${id}/media`, {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: file,
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error)
  return result
}
export function subscribeSession(
  id: string,
  receive: (session: Session) => void,
  connected: (ok: boolean) => void,
) {
  if (DEMO_MODE) {
    let active = true,
      close = () => {}
    void simulation()
      .then((module) => {
        if (active) close = module.subscribe(id, receive, connected)
      })
      .catch(() => connected(false))
    return () => {
      active = false
      close()
    }
  }
  const events = new EventSource(`/api/sessions/${id}/events`)
  events.addEventListener('session', (event) => receive(JSON.parse((event as MessageEvent).data)))
  events.onopen = () => connected(true)
  events.onerror = () => connected(false)
  return () => events.close()
}
