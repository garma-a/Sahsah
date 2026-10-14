import { randomInt, timingSafeEqual } from 'node:crypto'
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { BANK } from './standard-bank.ts'
import { GameRules } from '../src/lib/game-rules.ts'
import type { AdminQuestion } from '../src/lib/game-types.ts'
export { ApiError, check, clean, validateQuestion } from '../src/lib/game-rules.ts'
export type { PrivateSession } from '../src/lib/game-rules.ts'
export const safeEqual = (a: string, b: string) =>
  Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b))

export class GameEngine extends GameRules {
  directory: string
  constructor(directory: string, seed: AdminQuestion[] = []) {
    mkdirSync(directory, { recursive: true })
    const file = path.join(directory, 'database.json')
    super(
      {
        bank: BANK,
        compareSecrets: safeEqual,
        code: () => String(randomInt(1000, 10000)),
        load: () => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : undefined),
        save: (data) => {
          writeFileSync(file + '.tmp', JSON.stringify(data))
          renameSync(file + '.tmp', file)
        },
      },
      seed,
    )
    this.directory = directory
  }
}
