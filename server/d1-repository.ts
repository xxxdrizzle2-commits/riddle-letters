import { emptyStore, ServiceError, type AccessAuditEvent, type Repository, type Store } from './core'

type SqlRow = Record<string, string | number | null>
export interface D1Statement {
  bind(...values: unknown[]): D1Statement
  all<T extends SqlRow = SqlRow>(): Promise<{ results: T[] }>
}
export interface D1DatabaseLike {
  prepare(query: string): D1Statement
  batch<T = unknown>(statements: D1Statement[]): Promise<T[]>
}

type Row = { key: string; primary: Record<string, string | number>; columns: Record<string, string | number | null>; data: unknown }
type TableSpec = { table: string; primaryColumns: string[] }
const specs: Record<string, TableSpec> = {
  accounts: { table: 'app_accounts', primaryColumns: ['user_id'] },
  applications: { table: 'app_applications', primaryColumns: ['id'] },
  invites: { table: 'app_invites', primaryColumns: ['id'] },
  consents: { table: 'app_consents', primaryColumns: ['id'] },
  privacyRequests: { table: 'app_privacy_requests', primaryColumns: ['id'] },
  schools: { table: 'app_schools', primaryColumns: ['id'] },
  teacherAssignments: { table: 'app_teacher_assignments', primaryColumns: ['id'] },
  people: { table: 'app_people', primaryColumns: ['id'] },
  pairs: { table: 'app_pairs', primaryColumns: ['id'] },
  letters: { table: 'app_letters', primaryColumns: ['id'] },
  letterVersions: { table: 'app_letter_versions', primaryColumns: ['letter_id', 'revision'] },
  deliveries: { table: 'app_deliveries', primaryColumns: ['letter_id'] },
  tasks: { table: 'app_reply_tasks', primaryColumns: ['id'] },
  reviews: { table: 'app_reviews', primaryColumns: ['id'] },
  followups: { table: 'app_followups', primaryColumns: ['id'] },
  helpCases: { table: 'app_help_cases', primaryColumns: ['id'] },
  deliveryEvents: { table: 'app_delivery_events', primaryColumns: ['id'] },
  manuscriptAssets: { table: 'app_manuscript_assets', primaryColumns: ['id'] },
  ocrRuns: { table: 'app_ocr_runs', primaryColumns: ['id'] },
  attachments: { table: 'app_attachments', primaryColumns: ['id'] },
  schoolAuthorities: { table: 'app_school_authorities', primaryColumns: ['id'] },
  accessGrants: { table: 'app_access_grants', primaryColumns: ['id'] },
  evidenceSnapshots: { table: 'app_evidence_snapshots', primaryColumns: ['id'] },
  riskSignals: { table: 'app_risk_signals', primaryColumns: ['id'] },
  disputeCases: { table: 'app_dispute_cases', primaryColumns: ['id'] },
  supportTasks: { table: 'app_support_tasks', primaryColumns: ['id'] },
  dutyShifts: { table: 'app_duty_shifts', primaryColumns: ['id'] },
  trainingRecords: { table: 'app_training_records', primaryColumns: ['id'] },
  planPolicies: { table: 'app_plan_policies', primaryColumns: ['id'] },
  receipts: { table: 'app_receipts', primaryColumns: ['actor_id', 'request_id'] },
  audit: { table: 'app_audit_events', primaryColumns: ['id'] },
  accessAudit: { table: 'app_access_audit_events', primaryColumns: ['id'] },
  rates: { table: 'app_rate_limits', primaryColumns: ['rate_key'] },
}

const json = (value: unknown) => JSON.stringify(value)
const parse = <T>(value: unknown): T => JSON.parse(String(value)) as T
function recordsFor(store: Store): Record<string, Map<string, Row>> {
  const result: Record<string, Map<string, Row>> = {}
  const add = (name: string, rows: Row[]) => { result[name] = new Map(rows.map(row => [row.key, row])) }
  const simple = <T>(name: string, values: T[], getId: (value: T) => string, columns: (value: T) => Record<string, string | number | null>) => {
    add(name, values.map(value => ({ key: getId(value), primary: Object.fromEntries(Object.entries(columns(value)).filter(([column]) => specs[name].primaryColumns.includes(column))) as Record<string, string | number>, columns: columns(value), data: value })))
  }

  simple('accounts', Object.values(store.accounts), item => item.uid, item => ({ user_id: item.uid, role: item.role, status: item.status, permissions_json: json(item.permissions), created_at: item.createdAt, data_json: json(item) }))
  simple('applications', store.applications, item => item.id, item => ({ id: item.id, user_id: item.userId, status: item.status, data_json: json(item) }))
  simple('invites', store.invites, item => item.id, item => ({ id: item.id, token_hash: item.tokenHash, status: item.status, created_by: item.createdBy, expires_at: item.expiresAt, data_json: json(item) }))
  simple('consents', store.consents, item => item.id, item => ({ id: item.id, child_id: item.childId ?? null, teacher_id: item.teacherId, data_json: json(item) }))
  simple('privacyRequests', store.privacyRequests, item => item.id, item => ({ id: item.id, user_id: item.userId, status: item.status, data_json: json(item) }))
  simple('schools', store.state.schools ?? [], item => item.id, item => ({ id: item.id, name: item.name, status: item.status, data_json: json(item) }))
  simple('teacherAssignments', store.state.teacherAssignments ?? [], item => item.id, item => ({ id: item.id, school_id: item.schoolId, teacher_id: item.teacherId, child_id: item.childId ?? null, scope_json: json(item.scope), starts_at: item.startsAt, ends_at: item.endsAt ?? null, revoked_at: item.revokedAt ?? null, approved_by: item.approvedBy, data_json: json(item) }))
  simple('people', store.state.people, item => item.id, item => ({ id: item.id, role: item.role, nickname: item.nickname, teacher_id: item.teacherId ?? null, account_status: item.accountStatus ?? null, data_json: json(item) }))
  simple('pairs', store.state.pairs, item => item.id, item => ({ id: item.id, child_id: item.childId, volunteer_id: item.volunteerId, teacher_id: item.teacherId, school_id: item.schoolId ?? null, channel: item.channel, status: item.status, data_json: json(item) }))
  simple('letters', store.state.letters, item => item.id, item => {
    const { submissionVersions: _versions, ...current } = item
    return { id: item.id, pair_id: item.pairId, author_id: item.authorId, recipient_id: item.recipientId ?? null, created_by: item.createdBy, reply_to: item.replyTo ?? null, moderation: item.moderation, delivery_route: item.deliveryRoute ?? null, updated_at: item.updatedAt, data_json: json(current) }
  })
  const versions: Row[] = store.state.letters.flatMap(letter => (letter.submissionVersions ?? []).map(version => {
    const columns = { letter_id: letter.id, revision: version.revision, submitted_at: version.submittedAt, data_json: json(version) }
    return { key: `${letter.id}\u0000${version.revision}`, primary: { letter_id: letter.id, revision: version.revision }, columns, data: version }
  }))
  add('letterVersions', versions)
  simple('deliveries', store.state.deliveries, item => item.letterId, item => ({ letter_id: item.letterId, printed_at: item.printedAt ?? null, delivered_at: item.deliveredAt ?? null, read_at: item.readAt ?? null, data_json: json(item) }))
  simple('tasks', store.state.tasks, item => item.id, item => ({ id: item.id, letter_id: item.letterId, pair_id: item.pairId, recipient_id: item.recipientId ?? null, status: item.status, due_at: item.dueAt, data_json: json(item) }))
  simple('reviews', store.state.reviews, item => item.id, item => ({ id: item.id, letter_id: item.letterId, operator_id: item.operatorId, decision: item.decision, created_at: item.createdAt, data_json: json(item) }))
  simple('followups', store.state.followups, item => item.id, item => ({ id: item.id, pair_id: item.pairId ?? null, task_id: item.taskId ?? null, requester_id: item.requesterId ?? null, owner_id: item.ownerId ?? null, kind: item.kind, status: item.status, next_followup_at: item.nextFollowupAt ?? null, data_json: json(item) }))
  simple('helpCases', store.state.helpCases ?? [], item => item.id, item => ({ id: item.id, requester_id: item.requesterId, owner_id: item.ownerId, backup_owner_id: item.backupOwnerId ?? null, school_owner_id: item.schoolOwnerId ?? null, status: item.status, created_at: item.createdAt, data_json: json(item) }))
  simple('deliveryEvents', store.state.deliveryEvents ?? [], item => item.id, item => ({ id: item.id, letter_id: item.letterId, type: item.type, actor_id: item.actorId, created_at: item.at, data_json: json(item) }))
  simple('manuscriptAssets', store.state.manuscriptAssets ?? [], item => item.id, item => ({ id: item.id, letter_id: item.letterId, kind: item.kind, storage_path: item.storagePath ?? null, sha256: item.sha256 ?? null, created_at: item.createdAt, data_json: json(item) }))
  simple('ocrRuns', store.state.ocrRuns ?? [], item => item.id, item => ({ id: item.id, letter_id: item.letterId, manuscript_asset_id: item.manuscriptAssetId, status: item.status, source_sha256: item.sourceSha256, started_at: item.startedAt, data_json: json(item) }))
  simple('attachments', store.state.attachments, item => item.id, item => {
    const { blob: _blob, ...metadata } = item
    return { id: item.id, pair_id: item.pairId ?? null, owner_id: item.ownerId ?? null, storage_path: item.storagePath ?? null, size: item.size ?? null, data_json: json(metadata) }
  })
  simple('receipts', Object.entries(store.receipts).map(([key, value]) => ({ key, value })), item => item.key, item => {
    const separator = item.key.indexOf(':')
    const actorId = item.key.slice(0, separator), requestId = item.key.slice(separator + 1)
    return { actor_id: actorId, request_id: requestId, payload_hash: item.value.hash, result_id: item.value.resultId, created_at: item.value.at }
  })
  simple('audit', store.audit, item => item.id, item => ({ id: item.id, actor_id: item.actorId, action: item.action, target_id: item.targetId ?? null, created_at: item.at }))
  simple('accessAudit', store.accessAudit, item => item.id, item => ({ id: item.id, actor_id: item.actorId, target_type: item.targetType, target_id: item.targetId, decision: item.decision, created_at: item.at, grant_id: item.grantId ?? null, severity: item.severity ?? null, reason_code: item.reasonCode ?? null, data_json: json(item) }))
  simple('schoolAuthorities', store.state.schoolAuthorities ?? [], item => item.id, item => ({ id: item.id, school_id: item.schoolId, user_id: item.userId, kind: item.kind, backup_user_id: item.backupUserId ?? null, starts_at: item.startsAt, ends_at: item.endsAt ?? null, revoked_at: item.revokedAt ?? null, approved_by: item.approvedBy, data_json: json(item) }))
  simple('accessGrants', store.state.accessGrants ?? [], item => item.id, item => ({ id: item.id, actor_id: item.actorId, target_type: item.targetType, target_id: item.targetId, purpose: item.purpose, granted_by: item.grantedBy, approved_by: item.approvedBy ?? null, starts_at: item.startsAt, expires_at: item.expiresAt, emergency: item.emergency ? 1 : 0, review_due_at: item.reviewDueAt ?? null, reviewed_at: item.reviewedAt ?? null, revoked_at: item.revokedAt ?? null, data_json: json(item) }))
  simple('evidenceSnapshots', store.state.evidenceSnapshots ?? [], item => item.id, item => ({ id: item.id, case_id: item.caseId ?? null, letter_id: item.letterId ?? null, version_id: item.versionId ?? null, attachment_id: item.attachmentId ?? null, digest: item.digest, captured_by: item.capturedBy, captured_at: item.capturedAt, data_json: json(item) }))
  simple('riskSignals', store.state.riskSignals ?? [], item => item.id, item => ({ id: item.id, volunteer_id: item.volunteerId, kind: item.kind, severity: item.severity, status: item.status, created_at: item.createdAt, data_json: json(item) }))
  simple('disputeCases', store.state.disputeCases ?? [], item => item.id, item => ({ id: item.id, school_id: item.schoolId, topic: item.topic, pair_id: item.pairId ?? null, opened_by: item.openedBy, opened_at: item.openedAt, status: item.status, data_json: json(item) }))
  simple('supportTasks', store.state.supportTasks ?? [], item => item.id, item => ({ id: item.id, child_id: item.childId, case_id: item.caseId ?? null, pair_id: item.pairId ?? null, owner_teacher_id: item.ownerTeacherId ?? null, due_at: item.dueAt, status: item.status, data_json: json(item) }))
  simple('dutyShifts', store.state.dutyShifts ?? [], item => item.id, item => ({ id: item.id, scope: item.scope, school_id: item.schoolId ?? null, user_id: item.userId, backup_user_id: item.backupUserId ?? null, starts_at: item.startsAt, ends_at: item.endsAt, data_json: json(item) }))
  simple('trainingRecords', store.state.trainingRecords ?? [], item => item.id, item => ({ id: item.id, volunteer_id: item.volunteerId, version: item.version, completed_at: item.completedAt, data_json: json(item) }))
  simple('planPolicies', store.state.planPolicies ?? [], item => item.id, item => ({ id: item.id, child_max_active_pairs: item.childMaxActivePairs, volunteer_max_active_pairs: item.volunteerMaxActivePairs, new_pair_cooldown_days: item.newPairCooldownDays, data_json: json(item) }))
  simple('rates', Object.entries(store.rates).map(([rateKey, value]) => ({ rateKey, ...value })), item => item.rateKey, item => ({ rate_key: item.rateKey, minute: item.minute, count: item.count }))
  return result
}

export class D1Repository implements Repository {
  constructor(private readonly db: D1DatabaseLike) {}

  async appendAccessAudit(event: AccessAuditEvent): Promise<void> {
    try {
      await this.db.batch([this.db.prepare('INSERT INTO app_access_audit_events (id, actor_id, target_type, target_id, decision, created_at, data_json) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(event.id, event.actorId, event.targetType, event.targetId, event.decision, event.at, json(event))])
    } catch {
      throw new ServiceError('AUDIT_UNAVAILABLE', '读取记录未能保存，请稍后重试')
    }
  }

  private async load(): Promise<Store> {
    const names = Object.keys(specs)
    const rows = await Promise.all(names.map(async name => {
      const { table } = specs[name]
      const response = await this.db.prepare(`SELECT * FROM ${table}`).all()
      return [name, response.results] as const
    }))
    const tables = Object.fromEntries(rows) as Record<string, SqlRow[]>
    const meta = (await this.db.prepare("SELECT revision, clock FROM app_meta WHERE id = 'main'").all()).results[0]
    if (!meta) throw new ServiceError('SCHEMA_NOT_READY', '试测数据库还没有完成初始化')
    const store = emptyStore(String(meta.clock))
    store.revision = Number(meta.revision)
    const list = <T>(name: string) => (tables[name] ?? []).map(row => parse<T>(row.data_json))
    store.accounts = Object.fromEntries(list<Store['accounts'][string]>('accounts').map(item => [item.uid, item]))
    store.applications = list<Store['applications'][number]>('applications')
    store.invites = list<Store['invites'][number]>('invites')
    store.consents = list<Store['consents'][number]>('consents')
    store.privacyRequests = list<Store['privacyRequests'][number]>('privacyRequests')
    store.state.schools = list<NonNullable<Store['state']['schools']>[number]>('schools')
    store.state.teacherAssignments = list<NonNullable<Store['state']['teacherAssignments']>[number]>('teacherAssignments')
    store.state.people = list<Store['state']['people'][number]>('people')
    store.state.pairs = list<Store['state']['pairs'][number]>('pairs')
    const versions = new Map<string, Store['state']['letters'][number]['submissionVersions']>()
    for (const row of tables.letterVersions ?? []) {
      const items = versions.get(String(row.letter_id)) ?? []
      items.push(parse<NonNullable<Store['state']['letters'][number]['submissionVersions']>[number]>(row.data_json))
      versions.set(String(row.letter_id), items)
    }
    store.state.letters = list<Omit<Store['state']['letters'][number], 'submissionVersions'>>('letters').map(letter => ({ ...letter, submissionVersions: versions.get(letter.id) }))
    store.state.deliveries = list<Store['state']['deliveries'][number]>('deliveries')
    store.state.tasks = list<Store['state']['tasks'][number]>('tasks')
    store.state.reviews = list<Store['state']['reviews'][number]>('reviews')
    store.state.followups = list<Store['state']['followups'][number]>('followups')
    store.state.helpCases = list<NonNullable<Store['state']['helpCases']>[number]>('helpCases')
    store.state.deliveryEvents = list<NonNullable<Store['state']['deliveryEvents']>[number]>('deliveryEvents')
    store.state.manuscriptAssets = list<NonNullable<Store['state']['manuscriptAssets']>[number]>('manuscriptAssets')
    store.state.ocrRuns = list<NonNullable<Store['state']['ocrRuns']>[number]>('ocrRuns')
    store.state.attachments = list<Store['state']['attachments'][number]>('attachments')
    store.state.schoolAuthorities = list<NonNullable<Store['state']['schoolAuthorities']>[number]>('schoolAuthorities')
    store.state.accessGrants = list<NonNullable<Store['state']['accessGrants']>[number]>('accessGrants')
    store.state.evidenceSnapshots = list<NonNullable<Store['state']['evidenceSnapshots']>[number]>('evidenceSnapshots')
    store.state.riskSignals = list<NonNullable<Store['state']['riskSignals']>[number]>('riskSignals')
    store.state.disputeCases = list<NonNullable<Store['state']['disputeCases']>[number]>('disputeCases')
    store.state.supportTasks = list<NonNullable<Store['state']['supportTasks']>[number]>('supportTasks')
    store.state.dutyShifts = list<NonNullable<Store['state']['dutyShifts']>[number]>('dutyShifts')
    store.state.trainingRecords = list<NonNullable<Store['state']['trainingRecords']>[number]>('trainingRecords')
    store.state.planPolicies = list<NonNullable<Store['state']['planPolicies']>[number]>('planPolicies')
    store.receipts = Object.fromEntries((tables.receipts ?? []).map(row => [`${row.actor_id}:${row.request_id}`, { hash: String(row.payload_hash), resultId: String(row.result_id), at: String(row.created_at) }]))
    store.audit = (tables.audit ?? []).map(row => ({ id: String(row.id), actorId: String(row.actor_id), action: String(row.action), targetId: row.target_id == null ? undefined : String(row.target_id), at: String(row.created_at) }))
    store.accessAudit = list<Store['accessAudit'][number]>('accessAudit')
    store.rates = Object.fromEntries((tables.rates ?? []).map(row => [String(row.rate_key), { minute: Number(row.minute), count: Number(row.count) }]))
    return store
  }

  async read<T>(operation: (store: Store) => T | Promise<T>): Promise<T> {
    return operation(await this.load())
  }

  async transact<T>(operation: (store: Store) => T | Promise<T>): Promise<T> {
    const store = await this.load()
    const startingRevision = store.revision
    const before = json(store)
    const result = await operation(store)
    if (before === json(store)) return result
    if (store.revision === startingRevision) {
      store.revision++
      if (result && typeof result === 'object' && 'revision' in result) (result as { revision: number }).revision = store.revision
    }

    const previous = recordsFor(parse<Store>(before))
    const next = recordsFor(store)
    const statements: D1Statement[] = [
      this.db.prepare("UPDATE app_meta SET revision = ?, clock = ? WHERE id = 'main' AND revision = ?").bind(store.revision, store.state.clock, startingRevision),
      this.db.prepare("INSERT INTO app_write_guard(value) SELECT CASE WHEN changes() = 1 THEN 1 ELSE 0 END"),
      this.db.prepare('DELETE FROM app_write_guard'),
    ]
    for (const [name, spec] of Object.entries(specs)) {
      const oldRows = previous[name] ?? new Map<string, Row>()
      const newRows = next[name] ?? new Map<string, Row>()
      for (const [key, row] of oldRows) if (!newRows.has(key)) {
        const where = spec.primaryColumns.map(column => `${column} = ?`).join(' AND ')
        statements.push(this.db.prepare(`DELETE FROM ${spec.table} WHERE ${where}`).bind(...spec.primaryColumns.map(column => row.primary[column])))
      }
      for (const [key, row] of newRows) {
        if (oldRows.has(key) && json(oldRows.get(key)) === json(row)) continue
        const columns = Object.keys(row.columns)
        const assignments = columns.filter(column => !spec.primaryColumns.includes(column)).map(column => `${column} = excluded.${column}`).join(', ')
        const sql = `INSERT INTO ${spec.table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')}) ON CONFLICT (${spec.primaryColumns.join(', ')}) DO UPDATE SET ${assignments}`
        statements.push(this.db.prepare(sql).bind(...columns.map(column => row.columns[column])))
      }
    }
    try { await this.db.batch(statements) }
    catch (error) {
      if (error instanceof Error && /app_write_guard|CHECK constraint|UNIQUE constraint/i.test(error.message)) throw new ServiceError('CONFLICT', '内容刚刚在另一台设备更新，请刷新后核对；你的输入仍然保留')
      throw new ServiceError('DATABASE_ERROR', '保存没有完成，请保留内容后重试')
    }
    return result
  }
}

export function createD1Repository(database: D1DatabaseLike): Repository { return new D1Repository(database) }
