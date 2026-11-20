import { sql, type SQL } from "drizzle-orm";
import type { SahsahDatabase } from "../../database/connection.js";
import { dislikedQuestionVotes, incompleteDraftsFrom } from "./queues.js";

export const STATS_TTL_MS = 120_000;
const CAIRO = "Africa/Cairo";
export const TOP_CATEGORY_LIMIT = 5;

export type HomeSnapshot = {
  /** Calendar date in Cairo that "today" refers to. */
  cairoDate: string;
  kpis: {
    gamesToday: number;
    /** Paid orders created today, in EGP (minor units divided by 100). */
    salesTodayEgp: number;
    paidOrdersToday: number;
    /** False until the first order of any kind exists: checkout is not live yet. */
    anyOrder: boolean;
    newAccountsToday: number;
    tokensInBanks: number;
    activeGames: number;
    liveRooms: number;
  };
  /** The last seven Cairo days, oldest first, today last. */
  trend: { date: string; games: number; accounts: number }[];
  topCategories: { id: string; nameAr: string; nameFranco: string | null; games: number }[];
  queues: { messages: number; payments: number; deletions: number; drafts: number; flags: number; disliked: number };
};

export type HomeStatsResponse = HomeSnapshot & { computedAt: string; ageSeconds: number; analyticsUrl: string | null };

const rowsOf = async <T>(db: SahsahDatabase, query: SQL) => (await db.execute(query)).rows as T[];
const one = async <T>(db: SahsahDatabase, query: SQL) => (await rowsOf<T>(db, query))[0]!;

/** Adds days to a calendar date (no time zone involved, so no daylight-saving edge). */
function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Every figure of the Home page, computed with indexed queries only. `now` is injectable for tests. */
export async function computeHomeSnapshot(db: SahsahDatabase, now: Date = new Date()): Promise<HomeSnapshot> {
  const at = now.toISOString();
  // Day boundaries are Cairo midnights; the database knows the zone's rules, so daylight saving is right.
  const bounds = await one<{ today: string; today_start: string; tomorrow_start: string; week_start: string }>(db, sql`
    SELECT to_char(d, 'YYYY-MM-DD') AS today,
           (d AT TIME ZONE ${CAIRO})::text AS today_start,
           ((d + interval '1 day') AT TIME ZONE ${CAIRO})::text AS tomorrow_start,
           ((d - interval '6 days') AT TIME ZONE ${CAIRO})::text AS week_start
    FROM (SELECT date_trunc('day', ${at}::timestamptz AT TIME ZONE ${CAIRO}) AS d) days`);
  // Kept as the database's own text so it goes back in without a JavaScript Date in between.
  const todayStart = bounds.today_start, tomorrowStart = bounds.tomorrow_start, weekStart = bounds.week_start;

  const [gamesToday, sales, anyOrder, accountsToday, tokens, active, rooms, gameDays, accountDays, categories, queues] = await Promise.all([
    one<{ n: number }>(db, sql`SELECT count(*)::int AS n FROM games WHERE started_at >= ${todayStart}::timestamptz AND started_at < ${tomorrowStart}::timestamptz`),
    one<{ minor: string; n: number }>(db, sql`
      SELECT coalesce(sum(total_minor), 0)::text AS minor, count(*)::int AS n FROM token_orders
      WHERE created_at >= ${todayStart}::timestamptz AND created_at < ${tomorrowStart}::timestamptz AND payment_state = 'paid'`),
    one<{ any: boolean }>(db, sql`SELECT EXISTS (SELECT 1 FROM token_orders) AS any`),
    one<{ n: number }>(db, sql`SELECT count(*)::int AS n FROM accounts WHERE created_at >= ${todayStart}::timestamptz AND created_at < ${tomorrowStart}::timestamptz`),
    one<{ n: string }>(db, sql`SELECT coalesce(sum(token_balance), 0)::text AS n FROM accounts WHERE token_balance > 0`),
    one<{ n: number }>(db, sql`SELECT count(*)::int AS n FROM games WHERE status = 'active'`),
    one<{ n: number }>(db, sql`SELECT count(*)::int AS n FROM rooms WHERE closed_at IS NULL`),
    rowsOf<{ day: string; n: number }>(db, sql`
      SELECT to_char(started_at AT TIME ZONE ${CAIRO}, 'YYYY-MM-DD') AS day, count(*)::int AS n FROM games
      WHERE started_at >= ${weekStart}::timestamptz AND started_at < ${tomorrowStart}::timestamptz GROUP BY 1`),
    rowsOf<{ day: string; n: number }>(db, sql`
      SELECT to_char(created_at AT TIME ZONE ${CAIRO}, 'YYYY-MM-DD') AS day, count(*)::int AS n FROM accounts
      WHERE created_at >= ${weekStart}::timestamptz AND created_at < ${tomorrowStart}::timestamptz GROUP BY 1`),
    rowsOf<{ id: string; name_ar: string; name_franco: string | null; n: number }>(db, sql`
      SELECT c.id, c.name_ar, c.name_franco, count(*)::int AS n
      FROM games g JOIN game_packs gp ON gp.game_id = g.id JOIN categories c ON c.id = gp.category_id
      WHERE g.started_at >= ${weekStart}::timestamptz AND g.started_at < ${tomorrowStart}::timestamptz
      GROUP BY c.id, c.name_ar, c.name_franco ORDER BY n DESC, c.name_ar, c.id LIMIT ${TOP_CATEGORY_LIMIT}`),
    one<Record<"messages" | "payments" | "deletions" | "drafts" | "flags" | "disliked", number>>(db, sql`
      SELECT
        (SELECT count(*)::int FROM contact_submissions WHERE state = 'open') AS messages,
        (SELECT count(*)::int FROM payment_reconciliation_cases WHERE state = 'open') AS payments,
        (SELECT count(*)::int FROM account_deletion_requests WHERE state IN ('requested', 'confirmed')) AS deletions,
        (SELECT count(*)::int ${incompleteDraftsFrom}) AS drafts,
        (SELECT count(DISTINCT account_id)::int FROM account_flags WHERE resolved_at IS NULL) AS flags,
        (SELECT count(*)::int FROM (${dislikedQuestionVotes}) v JOIN questions q ON q.id = v.question_id AND q.retired_at IS NULL) AS disliked`),
  ]);

  const perDay = (rows: { day: string; n: number }[]) => new Map(rows.map((row) => [row.day, row.n]));
  const games = perDay(gameDays), accountsByDay = perDay(accountDays);
  const trend = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(bounds.today, index - 6);
    return { date, games: games.get(date) ?? 0, accounts: accountsByDay.get(date) ?? 0 };
  });
  return {
    cairoDate: bounds.today,
    kpis: {
      gamesToday: gamesToday.n,
      salesTodayEgp: Number(sales.minor) / 100,
      paidOrdersToday: sales.n,
      anyOrder: anyOrder.any,
      newAccountsToday: accountsToday.n,
      tokensInBanks: Number(tokens.n),
      activeGames: active.n,
      liveRooms: rooms.n,
    },
    trend,
    topCategories: categories.map((row) => ({ id: row.id, nameAr: row.name_ar, nameFranco: row.name_franco, games: row.n })),
    queues,
  };
}

/**
 * The Home figures, computed on request and kept in this process for two minutes. Every committed
 * admin change calls `invalidate()`. A computation that started before an invalidation never
 * stores its (possibly stale) result: it is compared against the version it started with.
 */
export class HomeStats {
  private version = 0;
  private cached?: { snapshot: HomeSnapshot; at: number };
  private inflight?: { version: number; promise: Promise<HomeSnapshot> };

  constructor(
    private readonly database: () => SahsahDatabase,
    private readonly analyticsUrl?: string,
    private readonly clock: () => number = Date.now,
    private readonly compute: (db: SahsahDatabase, now: Date) => Promise<HomeSnapshot> = computeHomeSnapshot,
  ) {}

  invalidate() {
    this.version += 1;
    this.cached = undefined;
    this.inflight = undefined;
  }

  async get(options: { refresh?: boolean } = {}): Promise<HomeStatsResponse> {
    const now = this.clock();
    let entry = options.refresh ? undefined : this.cached;
    if (entry && now - entry.at >= STATS_TTL_MS) entry = undefined;
    if (!entry) {
      const version = this.version;
      // Requests that arrive while one computation runs share it, unless they asked to refresh.
      let running = options.refresh ? undefined : this.inflight;
      if (!running || running.version !== version) {
        running = { version, promise: this.compute(this.database(), new Date(now)) };
        this.inflight = running;
        const done = () => {
          if (this.inflight === running) this.inflight = undefined;
        };
        running.promise.then(done, done);
      }
      const snapshot = await running.promise;
      entry = { snapshot, at: now };
      if (version === this.version) this.cached = entry;
    }
    return { ...entry.snapshot, computedAt: new Date(entry.at).toISOString(), ageSeconds: Math.max(0, Math.floor((this.clock() - entry.at) / 1000)), analyticsUrl: this.analyticsUrl ?? null };
  }
}
