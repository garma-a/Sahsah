import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import { buildQuestions, BUNDLES, PROMOS, type Question } from './data'

export type TeamId = 'A' | 'B'
export type Team = { id: TeamId; name: string; score: number }
export type Timer = { durationMs: number; remainingMs: number; status: 'idle' | 'running' | 'paused' | 'expired'; startedAt?: number }
export type Session = {
  id: string
  code: string
  phase: 'lobby' | 'board' | 'question' | 'answer' | 'finished'
  teams: [Team, Team]
  categoryIds: string[]
  questions: Question[]
  activeQuestionId?: string
  answerRevealed: boolean
  timer: Timer
  guests: { name: string; team: TeamId }[]
  lastAward?: { teamId: TeamId | null; points: number; at: number }
  version: number
}
export type User = { name: string; phone: string }
export type Order = { id: string; bundleId: string; promo?: string; gift?: { phone: string; note: string }; status: 'review' | 'pending' | 'success' | 'failed' }
export type Activity = { id: string; text: string; at: number }

type State = {
  selected: string[]
  user: User | null
  coins: number
  session: Session | null
  hostSessionId: string | null
  orders: Record<string, Order>
  paidOrders: string[]
  activity: Activity[]
  feedback: Record<string, { vote: 'like' | 'dislike'; reward: number; at: number }>
  toast?: { id: number; text: string }
}

type Action =
  | { type: 'toggleCategory'; id: string }
  | { type: 'createRoom'; names: [string, string] }
  | { type: 'rename'; idx: 0 | 1; name: string }
  | { type: 'startGame' }
  | { type: 'joinGuest'; name: string; team: TeamId }
  | { type: 'openQuestion'; id: string }
  | { type: 'timer'; op: 'start' | 'pause' | 'reset' | 'expire' }
  | { type: 'reveal' }
  | { type: 'award'; questionId: string; teamId: TeamId | null }
  | { type: 'adjust'; teamId: TeamId; delta: number }
  | { type: 'backToBoard' }
  | { type: 'finish' }
  | { type: 'replay'; newCategories: boolean }
  | { type: 'sync'; session: Session | null }
  | { type: 'login'; user: User }
  | { type: 'logout' }
  | { type: 'order'; order: Order }
  | { type: 'settle'; orderId: string; ok: boolean }
  | { type: 'toast'; text: string }
  | { type: 'feedback'; key: string; vote: 'like' | 'dislike'; reward: number }

const KEY = 'sahsah.v1'
const DURATION = 30000
const genCode = () => String(Math.floor(1000 + Math.random() * 9000))
const uid = () => Math.random().toString(36).slice(2, 9)

const initial: State = { selected: [], user: null, coins: 0, session: null, hostSessionId: null, orders: {}, paidOrders: [], activity: [], feedback: {} }

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    const host = sessionStorage.getItem(KEY + '.host')
    if (raw) return { ...initial, ...JSON.parse(raw), hostSessionId: host, toast: undefined }
  } catch {
    /* ignore */
  }
  return initial
}

const bump = (s: Session, patch: Partial<Session>): Session => ({ ...s, ...patch, version: s.version + 1 })

function reduce(state: State, a: Action): State {
  const s = state.session
  switch (a.type) {
    case 'toggleCategory': {
      if (state.selected.includes(a.id)) return { ...state, selected: state.selected.filter((x) => x !== a.id) }
      if (state.selected.length >= 6) return state
      return { ...state, selected: [...state.selected, a.id] }
    }
    case 'createRoom': {
      if (state.selected.length !== 6) return state
      const id = uid()
      const session: Session = {
        id,
        code: genCode(),
        phase: 'lobby',
        teams: [
          { id: 'A', name: a.names[0], score: 0 },
          { id: 'B', name: a.names[1], score: 0 },
        ],
        categoryIds: state.selected,
        questions: buildQuestions(state.selected),
        answerRevealed: false,
        timer: { durationMs: DURATION, remainingMs: DURATION, status: 'idle' },
        guests: [],
        version: 1,
      }
      sessionStorage.setItem(KEY + '.host', id)
      return { ...state, session, hostSessionId: id }
    }
    case 'rename':
      if (!s) return state
      return { ...state, session: bump(s, { teams: s.teams.map((t, i) => (i === a.idx ? { ...t, name: a.name } : t)) as [Team, Team] }) }
    case 'startGame':
      if (!s || s.questions.length !== 36) return state
      return { ...state, session: bump(s, { phase: 'board' }) }
    case 'joinGuest':
      if (!s) return state
      return { ...state, session: bump(s, { guests: [...s.guests, { name: a.name, team: a.team }] }) }
    case 'openQuestion': {
      if (!s) return state
      const q = s.questions.find((x) => x.id === a.id)
      if (!q || q.state === 'answered') return state
      return { ...state, session: bump(s, { phase: 'question', activeQuestionId: a.id, answerRevealed: false, timer: { durationMs: DURATION, remainingMs: DURATION, status: 'idle' } }) }
    }
    case 'timer': {
      if (!s) return state
      const t = s.timer
      const now = Date.now()
      const live = t.status === 'running' && t.startedAt ? Math.max(0, t.remainingMs - (now - t.startedAt)) : t.remainingMs
      if (a.op === 'start') {
        if (t.status === 'running') return state
        return { ...state, session: bump(s, { timer: { ...t, remainingMs: t.status === 'expired' ? t.durationMs : live || t.durationMs, status: 'running', startedAt: now } }) }
      }
      if (a.op === 'pause') return t.status !== 'running' ? state : { ...state, session: bump(s, { timer: { ...t, remainingMs: live, status: 'paused', startedAt: undefined } }) }
      if (a.op === 'reset') return { ...state, session: bump(s, { timer: { durationMs: t.durationMs, remainingMs: t.durationMs, status: 'idle' } }) }
      return t.status === 'running' ? { ...state, session: bump(s, { timer: { ...t, remainingMs: 0, status: 'expired', startedAt: undefined } }) } : state
    }
    case 'reveal':
      if (!s || !s.activeQuestionId) return state
      return { ...state, session: bump(s, { phase: 'answer', answerRevealed: true, timer: { ...s.timer, status: s.timer.status === 'running' ? 'paused' : s.timer.status, remainingMs: s.timer.remainingMs, startedAt: undefined } }) }
    case 'award': {
      if (!s) return state
      const q = s.questions.find((x) => x.id === a.questionId)
      if (!q || q.state === 'answered') return state
      const questions = s.questions.map((x) => (x.id === q.id ? { ...x, state: 'answered' as const } : x))
      const teams = s.teams.map((t) => (t.id === a.teamId ? { ...t, score: t.score + q.points } : t)) as [Team, Team]
      const name = a.teamId ? s.teams.find((t) => t.id === a.teamId)!.name : null
      const text = name ? `✓ ${q.points} نقطة محسوبة لـ${name}` : 'ولا حد جاوب — الدور اللي بعده'
      const done = questions.every((x) => x.state === 'answered')
      return {
        ...state,
        toast: { id: Date.now(), text },
        session: bump(s, { questions, teams, phase: done ? 'finished' : 'board', activeQuestionId: undefined, answerRevealed: false, lastAward: { teamId: a.teamId, points: q.points, at: Date.now() } }),
      }
    }
    case 'adjust':
      if (!s) return state
      return { ...state, session: bump(s, { teams: s.teams.map((t) => (t.id === a.teamId ? { ...t, score: Math.max(0, t.score + a.delta) } : t)) as [Team, Team] }) }
    case 'backToBoard':
      return s ? { ...state, session: bump(s, { phase: 'board', activeQuestionId: undefined, answerRevealed: false }) } : state
    case 'finish':
      return s ? { ...state, session: bump(s, { phase: 'finished' }) } : state
    case 'replay': {
      if (!s) return state
      if (a.newCategories) {
        sessionStorage.removeItem(KEY + '.host')
        return { ...state, session: null, hostSessionId: null, selected: [] }
      }
      return { ...state, session: bump(s, { phase: 'board', teams: s.teams.map((t) => ({ ...t, score: 0 })) as [Team, Team], questions: buildQuestions(s.categoryIds), activeQuestionId: undefined, answerRevealed: false, lastAward: undefined }) }
    }
    case 'sync':
      if (!a.session) return { ...state, session: null }
      if (state.session && state.session.id === a.session.id && state.session.version >= a.session.version) return state
      return { ...state, session: a.session }
    case 'login':
      return { ...state, user: a.user, coins: state.coins || 0 }
    case 'logout':
      return { ...state, user: null }
    case 'order':
      return { ...state, orders: { ...state.orders, [a.order.id]: a.order } }
    case 'settle': {
      const o = state.orders[a.orderId]
      if (!o || o.status === 'success') return state
      if (!a.ok) return { ...state, orders: { ...state.orders, [o.id]: { ...o, status: 'failed' } } }
      if (state.paidOrders.includes(o.id)) return state
      const b = BUNDLES.find((x) => x.id === o.bundleId)!
      return {
        ...state,
        orders: { ...state.orders, [o.id]: { ...o, status: 'success' } },
        paidOrders: [...state.paidOrders, o.id],
        coins: o.gift ? state.coins : state.coins + b.coins,
        activity: [{ id: o.id, text: o.gift ? `إهداء ${b.coins} عملة` : `شحن ${b.coins} عملة`, at: Date.now() }, ...state.activity].slice(0, 6),
      }
    }
    case 'feedback': {
      if (state.feedback[a.key]) return state
      return {
        ...state,
        coins: state.coins + a.reward,
        feedback: { ...state.feedback, [a.key]: { vote: a.vote, reward: a.reward, at: Date.now() } },
        activity: [{ id: 'fb' + a.key, text: `مكافأة رأيك في سؤال: +${a.reward} عملة`, at: Date.now() }, ...state.activity].slice(0, 6),
      }
    }
    case 'toast':
      return { ...state, toast: { id: Date.now(), text: a.text } }
  }
}

type Ctx = { state: State; dispatch: (a: Action) => void; isHost: boolean }
const C = createContext<Ctx>(null as never)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reduce, undefined, load)
  const fromRemote = useRef(false)

  useEffect(() => {
    const { toast: _t, hostSessionId: _h, ...persist } = state
    void _t
    void _h
    if (fromRemote.current) {
      fromRemote.current = false
      return
    }
    localStorage.setItem(KEY, JSON.stringify(persist))
  }, [state])

  useEffect(() => {
    const on = (e: StorageEvent) => {
      if (e.key !== KEY || !e.newValue) return
      try {
        fromRemote.current = true
        dispatch({ type: 'sync', session: JSON.parse(e.newValue).session })
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('storage', on)
    return () => window.removeEventListener('storage', on)
  }, [])

  const value = useMemo(() => ({ state, dispatch, isHost: !!state.session && state.hostSessionId === state.session.id }), [state])
  return <C.Provider value={value}>{children}</C.Provider>
}

export const useStore = () => useContext(C)
export { PROMOS }

if (import.meta.hot) import.meta.hot.invalidate()
