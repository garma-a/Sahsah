import { GIFT_DISCOUNT, PROMOS, TOKEN_PRICE } from './data.ts'

export const MAX_TOKEN_QUANTITY = 999
export type TokenOrder = {
  id: string
  quantity: number
  unitPrice: number
  promo?: string
  gift?: { phone: string; note: string }
  returnTo?: string
  status: 'review' | 'pending' | 'success' | 'failed'
}
export const parseTokenQuantity = (value: string | number): number | null => {
  const normalized = String(value)
    .trim()
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  if (!/^\d+$/.test(normalized)) return null
  const quantity = Number(normalized)
  return quantity >= 1 && quantity <= MAX_TOKEN_QUANTITY ? quantity : null
}
/** Before promo codes: gifted tokens are always discounted. */
export const listTotal = (order: Pick<TokenOrder, 'quantity' | 'unitPrice' | 'gift'>) =>
  Math.round(order.quantity * order.unitPrice * (order.gift ? 1 - GIFT_DISCOUNT : 1) * 100) / 100
export const orderTotal = (order: Pick<TokenOrder, 'quantity' | 'unitPrice' | 'promo' | 'gift'>) =>
  Math.round(listTotal(order) * (1 - (PROMOS[order.promo ?? ''] ?? 0)) * 100) / 100

export const gameReturnPath = (value?: string | null) =>
  value && (value === '/play?step=room' || /^\/game\/[a-zA-Z0-9-]+(?:\/results)?$/.test(value))
    ? value
    : undefined

// Translate saved presentation purchases into games and discard old feedback bonuses.
export function migrateTokenWallet(saved: Record<string, any>) {
  const legacyQuantities: Record<string, number> = { b1: 1, b2: 2, b3: 5 }
  const orders: Record<string, TokenOrder> = Object.fromEntries(
    Object.entries(saved.orders ?? {}).flatMap(([id, raw]) => {
      const order = raw as Record<string, any>
      const quantity = parseTokenQuantity(order.quantity ?? legacyQuantities[order.bundleId] ?? 0)
      if (!quantity) return []
      return [
        [
          id,
          {
            id,
            quantity,
            unitPrice:
              Number.isFinite(order.unitPrice) && order.unitPrice > 0
                ? order.unitPrice
                : TOKEN_PRICE,
            promo: order.promo,
            gift: order.gift,
            status: order.status,
            returnTo: gameReturnPath(order.returnTo),
          },
        ],
      ]
    }),
  )
  const paidOrders = [
    ...new Set<string>([
      ...(Array.isArray(saved.paidOrders) ? saved.paidOrders : []),
      ...Object.values(orders)
        .filter((order) => order.status === 'success')
        .map((order) => order.id),
    ]),
  ]
  let tokens = Number.isFinite(saved.tokens) ? Math.max(0, Math.floor(saved.tokens)) : undefined
  if (tokens === undefined) {
    const purchases = paidOrders.map((id) => orders[id]).filter((order) => order && !order.gift)
    if (purchases.length) tokens = purchases.reduce((sum, order) => sum + order.quantity, 0)
    else {
      const bonus = Object.values(saved.feedback ?? {}).reduce<number>(
        (sum, value) => sum + (Number((value as { reward?: number }).reward) || 0),
        0,
      )
      let remaining = Math.max(0, (Number(saved.coins) || 0) - bonus)
      tokens = 0
      for (const [coins, games] of [
        [1000, 5],
        [400, 2],
        [100, 1],
      ]) {
        const count = Math.floor(remaining / coins)
        tokens += count * games
        remaining %= coins
      }
    }
  }
  const feedback = Object.fromEntries(
    Object.entries(saved.feedback ?? {}).map(([key, raw]) => {
      const value = raw as { vote: 'like' | 'dislike'; at: number }
      return [key, { vote: value.vote, at: value.at }]
    }),
  )
  const activity = (Array.isArray(saved.activity) ? saved.activity : [])
    .filter(
      (item: { id: string; text: string }) =>
        !item.id.startsWith('fb') && !item.text.includes('مكافأة'),
    )
    .map((item: { id: string; text: string; at: number }) => {
      const order = orders[item.id]
      return order
        ? {
            ...item,
            text: `${order.gift ? 'إهداء' : 'شراء'} ${order.quantity} توكن · ${order.quantity} لعبة`,
          }
        : item
    })
  return {
    tokens,
    orders,
    paidOrders,
    feedback,
    activity,
    chargedGames: Array.isArray(saved.chargedGames) ? saved.chargedGames : [],
  }
}
