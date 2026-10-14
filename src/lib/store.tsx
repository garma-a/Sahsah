import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'
import { PROMOS } from './data'
import { migrateTokenWallet, parseTokenQuantity, type TokenOrder } from './token-economy'
import { api, getSession, hostCredentials, saveHost, clearHost, subscribeSession } from './api'
import type { Session, TeamId } from './game-types'
import { DEMO_MODE, UI_STORAGE_KEY } from './runtime'
export type { Session, Team, TeamId, Timer } from './game-types'

export type User = { name: string; phone: string }
export type Order = TokenOrder
export type Activity = { id: string; text: string; at: number }

type State = {
  selected: string[]
  user: User | null
  tokens: number
  chargedGames: string[]
  session: Session | null
  hostSessionId: string | null
  orders: Record<string, Order>
  paidOrders: string[]
  activity: Activity[]
  feedback: Record<
    string,
    {
      vote: 'like' | 'dislike'
      at: number
    }
  >
  toast?: { id: number; text: string }
}

type Action =
  | { type: 'toggleCategory'; id: string }
  | {
      type: 'createRoom'
      names: [string, string]
      categoryIds?: string[]
    }
  | { type: 'rename'; idx: 0 | 1; name: string }
  | { type: 'startGame' }
  | {
      type: 'joinGuest'
      name: string
      team: TeamId
    }
  | { type: 'openQuestion'; id: string }
  | {
      type: 'timer'
      op: 'start' | 'pause' | 'reset' | 'expire'
    }
  | { type: 'reveal' }
  | { type: 'advanceStage' }
  | { type: 'startMemory' | 'hideMemory' | 'resetMemory' }
  | {
      type: 'remoteSession'
      session: Session
      host?: boolean
      chargeKey?: string
    }
  | { type: 'award'; questionId: string; teamId: TeamId | null }
  | {
      type: 'adjust'
      teamId: TeamId
      delta: number
    }
  | { type: 'backToBoard' }
  | { type: 'finish' }
  | {
      type: 'replay'
      newCategories: boolean
    }
  | { type: 'sync'; session: Session | null }
  | { type: 'login'; user: User }
  | {
      type: 'logout'
    }
  | { type: 'order'; order: Order }
  | {
      type: 'settle'
      orderId: string
      ok: boolean
    }
  | { type: 'toast'; text: string }
  | { type: 'walletSync'; wallet: Wallet }
  | {
      type: 'feedback'
      key: string
      vote: 'like' | 'dislike'
    }

const KEY = UI_STORAGE_KEY
const WALLET_KEY = KEY + '.tokens'
type Wallet = Pick<
  State,
  'tokens' | 'orders' | 'paidOrders' | 'chargedGames' | 'feedback' | 'activity'
>
const walletOf = (state: State): Wallet => ({
  tokens: state.tokens,
  orders: state.orders,
  paidOrders: state.paidOrders,
  chargedGames: state.chargedGames,
  feedback: state.feedback,
  activity: state.activity,
})

const initial: State = {
  selected: [],
  user: null,
  tokens: 0,
  chargedGames: [],
  session: null,
  hostSessionId: null,
  orders: {},
  paidOrders: [],
  activity: [],
  feedback: {},
}

function legacyGame(): Record<string, unknown> | null {
  if (DEMO_MODE) return null
  try {
    const saved = JSON.parse(
      localStorage.getItem(KEY + '.legacy') || localStorage.getItem(KEY) || 'null',
    )
    const session = saved?.session
    if (
      session &&
      !session.questions?.every((q: { type?: string }) => q.type) &&
      sessionStorage.getItem(KEY + '.host') === session.id
    ) {
      localStorage.setItem(KEY + '.legacy', JSON.stringify({ session }))
      return session
    }
  } catch {
    /* Invalid old storage cannot become an authorized session. */
  }
  return null
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    const saved = raw ? JSON.parse(raw) : {}
    const wallet = JSON.parse(localStorage.getItem(WALLET_KEY) || 'null')
    const { coins: _coins, ...ui } = saved
    const session = saved.session?.questions?.every((q: { type?: string }) => q.type)
      ? saved.session
      : null
    return {
      ...initial,
      ...ui,
      ...migrateTokenWallet(wallet ? { ...saved, ...wallet } : saved),
      session,
      hostSessionId: hostCredentials()?.sessionId ?? null,
      toast: undefined,
    }
  } catch {
    return initial
  }
}

function reduce(state: State, a: Action): State {
  switch (a.type) {
    case 'toggleCategory': {
      if (state.selected.includes(a.id))
        return { ...state, selected: state.selected.filter((x) => x !== a.id) }
      if (state.selected.length >= 6) return state
      return { ...state, selected: [...state.selected, a.id] }
    }
    case 'remoteSession': {
      const previous = state.session
      if (previous?.id === a.session.id && previous.version > a.session.version) return state
      const award = a.session.lastAward
      const isNewAward = award && previous?.lastAward?.at !== award.at
      const name = award?.teamId ? a.session.teams.find((t) => t.id === award.teamId)?.name : null
      const charge = a.chargeKey && !state.chargedGames.includes(a.chargeKey)
      return {
        ...state,
        ...(charge
          ? {
              tokens: Math.max(0, state.tokens - 1),
              chargedGames: [...state.chargedGames, a.chargeKey!],
              activity: [
                { id: a.chargeKey!, text: 'بدأت لعبة · ١ توكن', at: Date.now() },
                ...state.activity,
              ].slice(0, 6),
            }
          : {}),
        session: a.session,
        hostSessionId: a.host ? a.session.id : state.hostSessionId,
        ...(isNewAward
          ? {
              toast: {
                id: award.at,
                text: name ? `✓ ${award.points} نقطة محسومة لـ${name}` : 'ولا حد — الدور اللي بعده',
              },
            }
          : {}),
      }
    }
    case 'sync':
      if (!a.session) return { ...state, session: null }
      if (state.session?.id === a.session.id && state.session.version > a.session.version)
        return state
      return { ...state, session: a.session }
    case 'replay':
      return a.newCategories
        ? { ...state, session: null, hostSessionId: null, selected: [] }
        : state
    case 'createRoom':
    case 'rename':
    case 'startGame':
    case 'joinGuest':
    case 'openQuestion':
    case 'timer':
    case 'reveal':
    case 'advanceStage':
    case 'startMemory':
    case 'hideMemory':
    case 'resetMemory':
    case 'award':
    case 'adjust':
    case 'backToBoard':
    case 'finish':
      return state
    case 'login':
      return { ...state, user: a.user }
    case 'logout':
      return { ...state, user: null }
    case 'order':
      return parseTokenQuantity(a.order.quantity)
        ? { ...state, orders: { ...state.orders, [a.order.id]: a.order } }
        : state
    case 'settle': {
      const o = state.orders[a.orderId]
      if (!o || o.status === 'success') return state
      if (!a.ok)
        return {
          ...state,
          orders: { ...state.orders, [o.id]: { ...o, status: 'failed' } },
        }
      if (state.paidOrders.includes(o.id)) return state
      return {
        ...state,
        orders: { ...state.orders, [o.id]: { ...o, status: 'success' } },
        paidOrders: [...state.paidOrders, o.id],
        tokens: o.gift ? state.tokens : state.tokens + o.quantity,
        activity: [
          {
            id: o.id,
            text: `${o.gift ? 'إهداء' : 'شراء'} ${o.quantity} توكن · ${o.quantity} لعبة`,
            at: Date.now(),
          },
          ...state.activity,
        ].slice(0, 6),
      }
    }
    case 'feedback': {
      if (state.feedback[a.key]) return state
      return {
        ...state,
        feedback: {
          ...state.feedback,
          [a.key]: { vote: a.vote, at: Date.now() },
        },
      }
    }
    case 'toast':
      return { ...state, toast: { id: Date.now(), text: a.text } }
    case 'walletSync':
      return { ...state, ...a.wallet }
  }
}

type Ctx = {
  state: State
  dispatch: (a: Action) => Promise<boolean>
  isHost: boolean
  connected: boolean
  busy: boolean
  adoptSession: (session: Session) => void
}
const C = createContext<Ctx>(null as never)
const HOST_ACTIONS = new Set([
  'rename',
  'startGame',
  'openQuestion',
  'timer',
  'reveal',
  'advanceStage',
  'startMemory',
  'hideMemory',
  'resetMemory',
  'award',
  'adjust',
  'backToBoard',
  'finish',
  'replay',
])

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(reduce, undefined, load)
  const legacy = useRef<Record<string, unknown> | null | undefined>(undefined)
  if (legacy.current === undefined) legacy.current = legacyGame()
  const current = useRef(state)
  current.current = state
  const [network, setNetwork] = useReducer(
    (
      previous: { connected: boolean; busy: boolean },
      patch: Partial<{ connected: boolean; busy: boolean }>,
    ) => ({ ...previous, ...patch }),
    { connected: true, busy: false },
  )
  const pending = useRef(false)
  const adoptSession = useCallback((session: Session) => {
    if (
      current.current.session?.id === session.id &&
      current.current.session.version > session.version
    )
      return
    current.current = { ...current.current, session }
    rawDispatch({ type: 'sync', session })
  }, [])
  useEffect(() => {
    if (!legacy.current) return
    const old = legacy.current
    legacy.current = null
    void api<{ session: Session; hostToken: string }>('/api/sessions/import', old)
      .then((result) => {
        saveHost(result.session.id, result.hostToken)
        localStorage.removeItem(KEY + '.legacy')
        current.current = {
          ...current.current,
          session: result.session,
          hostSessionId: result.session.id,
        }
        if (location.pathname.startsWith('/game/')) {
          history.replaceState(null, '', `/game/${result.session.id}`)
          window.dispatchEvent(new PopStateEvent('popstate'))
        }
        rawDispatch({ type: 'remoteSession', session: result.session, host: true })
      })
      .catch(() =>
        rawDispatch({
          type: 'toast',
          text: 'اللعبة القديمة محفوظة. افتح الصفحة تاني لما الاتصال يرجع.',
        }),
      )
  }, [])
  const dispatch = useCallback(
    async (a: Action) => {
      const s = current.current.session
      if (a.type === 'createRoom' || a.type === 'joinGuest' || HOST_ACTIONS.has(a.type)) {
        if (pending.current) return false
        const startsGame = a.type === 'startGame' || (a.type === 'replay' && !a.newCategories)
        if (startsGame && current.current.tokens < 1) {
          rawDispatch({ type: 'toast', text: 'محتاج ١ توكن عشان تبدأ لعبة جديدة' })
          return false
        }
        pending.current = true
        setNetwork({ busy: true })
        try {
          if (a.type === 'createRoom') {
            const result = await api<{ session: Session; hostToken: string }>('/api/sessions', {
              categoryIds: a.categoryIds ?? current.current.selected,
              names: a.names,
            })
            saveHost(result.session.id, result.hostToken)
            current.current = {
              ...current.current,
              session: result.session,
              hostSessionId: result.session.id,
            }
            rawDispatch({
              type: 'remoteSession',
              session: result.session,
              host: true,
            })
          } else if (a.type === 'replay' && a.newCategories) {
            clearHost()
            current.current = {
              ...current.current,
              session: null,
              hostSessionId: null,
            }
            rawDispatch(a)
          } else if (s) {
            const session =
              a.type === 'joinGuest'
                ? await api<Session>(`/api/sessions/${s.id}/join`, a)
                : await api<Session>(`/api/sessions/${s.id}/actions`, {
                    ...a,
                    version: s.version,
                  })
            if (
              current.current.session?.id !== session.id ||
              current.current.session.version <= session.version
            )
              current.current = { ...current.current, session }
            const chargeKey = startsGame ? `${session.id}:${session.version}:${a.type}` : undefined
            if (chargeKey) {
              current.current = {
                ...current.current,
                tokens: Math.max(0, current.current.tokens - 1),
              }
            }
            rawDispatch({ type: 'remoteSession', session, chargeKey })
          }
          setNetwork({ connected: true })
        } catch (error) {
          if (error instanceof TypeError) setNetwork({ connected: false })
          rawDispatch({
            type: 'toast',
            text: error instanceof Error ? error.message : 'حصلت مشكلة، جرّب تاني',
          })
          if (s)
            getSession(s.id)
              .then(adoptSession)
              .catch(() => {})
          return false
        } finally {
          pending.current = false
          setNetwork({ busy: false })
        }
      } else rawDispatch(a)
      return true
    },
    [adoptSession],
  )

  useEffect(() => {
    const { toast: _t, hostSessionId: _h, ...persist } = state
    localStorage.setItem(KEY, JSON.stringify(persist))
  }, [state])

  useEffect(() => {
    const serialized = JSON.stringify(walletOf(state))
    if (localStorage.getItem(WALLET_KEY) !== serialized)
      localStorage.setItem(WALLET_KEY, serialized)
  }, [
    state.tokens,
    state.orders,
    state.paidOrders,
    state.chargedGames,
    state.feedback,
    state.activity,
  ])

  useEffect(() => {
    const syncWallet = (event: StorageEvent) => {
      if (event.key !== WALLET_KEY || !event.newValue) return
      try {
        const wallet = migrateTokenWallet(JSON.parse(event.newValue))
        current.current = { ...current.current, ...wallet }
        rawDispatch({ type: 'walletSync', wallet })
      } catch {
        /* Ignore an incomplete presentation storage write. */
      }
    }
    window.addEventListener('storage', syncWallet)
    return () => window.removeEventListener('storage', syncWallet)
  }, [])

  useEffect(() => {
    const id =
      location.pathname.match(/^\/game\/([^/]+)/)?.[1] ||
      state.session?.id ||
      hostCredentials()?.sessionId
    if (!id) return
    let active = true
    getSession(id)
      .then((s) => {
        if (active) adoptSession(s)
      })
      .catch(() => {
        if (active) setNetwork({ connected: false, busy: pending.current })
      })
    const close = subscribeSession(
      id,
      (session) => {
        if (!active) return
        if (
          current.current.session?.id === session.id &&
          current.current.session.version > session.version
        )
          return
        current.current = { ...current.current, session }
        rawDispatch({ type: 'remoteSession', session })
        setNetwork({ connected: true, busy: pending.current })
      },
      (connected) => {
        if (active) setNetwork({ connected, busy: pending.current })
      },
    )
    return () => {
      active = false
      close()
    }
  }, [state.session?.id, adoptSession])

  const value = useMemo(
    () => ({
      state,
      dispatch,
      adoptSession,
      isHost: !!state.session && hostCredentials()?.sessionId === state.session.id,
      ...network,
    }),
    [state, dispatch, adoptSession, network],
  )
  return <C.Provider value={value}>{children}</C.Provider>
}

export const useStore = () => useContext(C)
export { PROMOS }

if (import.meta.hot) import.meta.hot.invalidate()
