import tcb from '@cloudbase/node-sdk'
import { emptyStore, ServiceError, type Repository, type Store } from './core'

const PARTS = ['accounts', 'applications', 'invites', 'consents', 'privacyRequests', 'receipts', 'audit', 'rates', 'people', 'pairs', 'letters', 'deliveries', 'tasks', 'reviews', 'followups', 'attachments'] as const
type Part = typeof PARTS[number]
type PersistedMeta = { revision: number; clock: string; version: 1 }
const MAX_PART_BYTES = 12 * 1024 * 1024
const COLLECTION = process.env.V1_DB_COLLECTION || 'riddle_v1_workspace'
const ENV = process.env.CLOUDBASE_ENV_ID || process.env.SCB_ENV || ''

export function createCloudApp() {
  if (!ENV) throw new ServiceError('SERVICE_NOT_CONFIGURED', '尚未配置真实账号环境')
  // Event functions receive short-lived platform credentials. Never embed service keys in browser code.
  return tcb.init({ env: ENV })
}
type CloudApp = ReturnType<typeof createCloudApp>
type Transaction = Awaited<ReturnType<ReturnType<CloudApp['database']>['startTransaction']>>

function valueFor(store: Store, key: Part): unknown {
  if (key in store.state) return store.state[key as keyof Store['state']]
  return store[key as keyof Store]
}
function assign(store: Store, key: Part, value: unknown): void {
  if (key in store.state) (store.state as unknown as Record<string, unknown>)[key] = value
  else (store as unknown as Record<string, unknown>)[key] = value
}
function decode(result: { data?: unknown }): string | undefined {
  const first = Array.isArray(result.data) ? result.data[0] : result.data
  return first && typeof first === 'object' && 'value' in first && typeof first.value === 'string' ? first.value : undefined
}

/** A bounded 17-document transaction keeps the pilot workspace atomic and below CloudBase's 100-operation limit. */
export class CloudRepository implements Repository {
  constructor(private app: CloudApp) {}
  private async load(transaction: Transaction): Promise<Store> {
    const collection = transaction.collection(COLLECTION)
    const rawMeta = decode(await collection.doc('meta').get())
    const store = emptyStore()
    if (!rawMeta) return store
    const meta = JSON.parse(rawMeta) as PersistedMeta
    if (meta.version !== 1) throw new ServiceError('SCHEMA_MISMATCH', '数据版本不匹配，请联系维护人员')
    store.revision = meta.revision; store.state.clock = meta.clock
    for (const key of PARTS) {
      const raw = decode(await collection.doc(`part-${key}`).get())
      if (raw === undefined) throw new ServiceError('DATA_INCOMPLETE', '云端数据不完整，已停止读写')
      assign(store, key, JSON.parse(raw))
    }
    return store
  }
  async read<T>(operation: (store: Store) => T | Promise<T>): Promise<T> {
    const transaction = await this.app.database().startTransaction()
    try {
      const result = await operation(await this.load(transaction))
      await transaction.rollback()
      return result
    } catch (error) {
      await transaction.rollback().catch(() => undefined)
      throw error
    }
  }
  async transact<T>(operation: (store: Store) => T | Promise<T>): Promise<T> {
    const transaction = await this.app.database().startTransaction()
    try {
      const store = await this.load(transaction)
      const collection = transaction.collection(COLLECTION)
      const result = await operation(store)
      for (const key of PARTS) {
        const value = JSON.stringify(valueFor(store, key))
        if (Buffer.byteLength(value, 'utf8') > MAX_PART_BYTES) throw new ServiceError('CAPACITY', '试点数据接近单文档容量，请先归档再继续')
        await collection.doc(`part-${key}`).set({ value })
      }
      await collection.doc('meta').set({ value: JSON.stringify({ revision: store.revision, clock: store.state.clock, version: 1 } satisfies PersistedMeta) })
      await transaction.commit()
      return result
    } catch (error) {
      await transaction.rollback().catch(() => undefined)
      throw error
    }
  }
}

export function createRepository(app = createCloudApp()) { return new CloudRepository(app) }
