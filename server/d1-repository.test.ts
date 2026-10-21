import { DatabaseSync, type SQLInputValue, type StatementResultingChanges } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { executeCommand, ServiceError } from './core'
import { createD1Repository, type D1DatabaseLike, type D1Statement } from './d1-repository'

class SqliteStatement {
  private values: SQLInputValue[] = []
  constructor(private readonly db: DatabaseSync, private readonly query: string) {}
  bind(...values: SQLInputValue[]) { this.values = values; return this }
  async all<T extends Record<string, string | number | null>>(): Promise<{ results: T[] }> {
    return { results: this.db.prepare(this.query).all(...this.values) as T[] }
  }
  run() { return this.db.prepare(this.query).run(...this.values) }
}
class SqliteD1 implements D1DatabaseLike {
  beforeNextBatch?: () => void
  constructor(private readonly db: DatabaseSync) {}
  prepare(query: string) { return new SqliteStatement(this.db, query) }
  async batch<T = unknown>(statements: D1Statement[]): Promise<T[]> {
    this.beforeNextBatch?.()
    this.beforeNextBatch = undefined
    this.db.exec('BEGIN')
    try {
      const results = (statements as SqliteStatement[]).map(statement => statement.run())
      this.db.exec('COMMIT')
      return results as unknown as T[]
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }
}

function freshDatabase() {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(readFileSync('migrations/0000_better_auth.sql', 'utf8'))
  db.exec(readFileSync('migrations/0001_v3_core.sql', 'utf8'))
  return db
}

describe('V3 D1 repository', () => {
  it('persists scoped business commands and makes retries idempotent', async () => {
    const database = freshDatabase()
    try {
      const repository = createD1Repository(new SqliteD1(database))
      await repository.transact(store => {
        const people = [
          { id: 'child-1', role: 'child' as const, nickname: '小树', subtitle: '合成角色', avatar: '🌱', interests: ['谜语'], teacherId: 'teacher-1', accountStatus: 'active' as const, guardianConsent: true },
          { id: 'volunteer-1', role: 'volunteer' as const, nickname: '林溪', subtitle: '合成角色', avatar: '✉️', interests: ['阅读'], accountStatus: 'active' as const, volunteerApproved: true },
          { id: 'teacher-1', role: 'teacher' as const, nickname: '周老师', subtitle: '合成角色', avatar: '📚', interests: [], accountStatus: 'active' as const },
          { id: 'operator-1', role: 'operator' as const, nickname: '运营同学', subtitle: '合成角色', avatar: '🪴', interests: [], accountStatus: 'active' as const, permissions: ['review' as const, 'safeguarding' as const, 'administration' as const] },
        ]
        store.state.people = people
        store.state.pairs = [{ id: 'pair-1', childId: 'child-1', volunteerId: 'volunteer-1', teacherId: 'teacher-1', channel: 'online', status: 'active', startedAt: '2026-10-01T09:00:00.000Z', pauseHistory: [] }]
        for (const person of people) {
          const permissions = person.role === 'operator' ? ['moderate', 'followup', 'help', 'accounts', 'privacy'] : []
          store.accounts[person.id] = { uid: person.id, role: person.role, status: 'active', permissions, createdAt: '2026-10-01T09:00:00.000Z' }
        }
        store.revision++
      })

      const input = {
        requestId: 'test-request-0001',
        expectedRevision: 1,
        command: { type: 'save-letter' as const, pairId: 'pair-1', title: '给小树的一封信', body: '我今天看见一片很特别的叶子。' },
      }
      const first = await executeCommand(repository, { uid: 'volunteer-1' }, input, '2026-10-20T10:00:00.000Z')
      const retry = await executeCommand(repository, { uid: 'volunteer-1' }, input, '2026-10-20T10:01:00.000Z')
      expect(first.state.letters).toHaveLength(1)
      expect(retry.state.letters).toHaveLength(1)
      expect(retry.resultId).toBe(first.resultId)

      await expect(executeCommand(repository, { uid: 'volunteer-1' }, {
        ...input,
        requestId: 'test-request-0002',
        expectedRevision: 1,
        command: { ...input.command, body: '这次提交带着过期版本。' },
      }, '2026-10-20T10:02:00.000Z')).rejects.toMatchObject({ code: 'CONFLICT' })

      const final = await repository.read(store => ({ revision: store.revision, count: store.state.letters.length, body: store.state.letters[0]?.body }))
      expect(final).toEqual({ revision: first.revision, count: 1, body: input.command.body })
    } finally { database.close() }
  })

  it('rolls back the batch when the compare-and-swap revision is stale', async () => {
    const database = freshDatabase()
    try {
      const localD1 = new SqliteD1(database)
      const repository = createD1Repository(localD1)
      await repository.transact(store => { store.state.clock = '2026-10-20T11:00:00.000Z'; store.revision++ })
      localD1.beforeNextBatch = () => { database.prepare("UPDATE app_meta SET revision = revision + 1 WHERE id = 'main'").run() }
      await expect(repository.transact(store => { store.state.clock = '2026-10-21T11:00:00.000Z'; store.revision++ })).rejects.toBeInstanceOf(ServiceError)
      const meta = database.prepare("SELECT revision, clock FROM app_meta WHERE id = 'main'").get()
      expect(meta).toEqual({ revision: 2, clock: '2026-10-20T11:00:00.000Z' })
    } finally { database.close() }
  })
})
