import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { approvedLetterProjection, DomainError, normalizeState, reduceCommand, refreshState, requesterHelpCaseProjection, scopeState } from '../src/domain'
import { authorize, teacherScope } from '../src/policy'
import type { PolicyDecision } from '../src/policy'
import type { AppState, Command, Person, Role } from '../src/types'

export class ServiceError extends Error {
  constructor(public code: string, message: string, public reasonCode?: string, public severity?: string) { super(message) }
}
export function requireValue(value: unknown, message: string, code = 'INVALID_INPUT'): asserts value { if (!value) throw new ServiceError(code, message) }
export function text(value: unknown, label: string, max = 200, optional = false): string {
  requireValue(typeof value === 'string', `${label}格式不正确`)
  const result = value.trim(); requireValue((optional || result.length > 0) && result.length <= max, `${label}请填写${max}字以内的内容`); return result
}
export const digest = (value: string) => createHash('sha256').update(value).digest('hex')
export interface Account { uid: string; role: Role; status: 'pending' | 'active' | 'disabled'; permissions: string[]; createdAt: string; disabledReason?: string }
export interface Application { id: string; userId: string; nickname: string; institution: string; availability: string; agreementAcceptedAt: string; status: 'pending' | 'approved' | 'returned'; email?: string; note?: string; reviewedBy?: string; updatedAt: string }
export interface Invite { id: string; tokenHash: string; role: 'child' | 'teacher' | 'operator'; nickname: string; email?: string; permissions?: string[]; teacherId?: string; createdBy: string; createdAt: string; expiresAt: string; status: 'open' | 'activating' | 'used' | 'revoked'; activationId?: string; username?: string; userId?: string; consentId?: string }
export interface Consent { id: string; childId?: string; teacherId: string; guardianName: string; relationship: string; noticeVersion: string; evidenceReference: string; recordedBy: string; recordedAt: string; withdrawnAt?: string; reason?: string }
export interface PrivacyRequest { id: string; userId: string; kind: 'export' | 'delete' | 'withdraw'; reason: string; status: 'open' | 'resolved'; createdAt: string; resolvedBy?: string; note?: string }
export interface AccessAuditEvent { id: string; actorId: string; targetType: 'letter' | 'attachment' | 'help-case' | 'teacher-overview'; targetId: string; decision: 'allowed' | 'denied'; purpose: string; at: string; approvalId?: string; versionId?: string; grantId?: string; reasonCode?: string; severity?: string }
export interface Store { revision: number; state: AppState; accounts: Record<string, Account>; applications: Application[]; invites: Invite[]; consents: Consent[]; privacyRequests: PrivacyRequest[]; receipts: Record<string, { hash: string; resultId: string; at: string }>; audit: { id: string; actorId: string; action: string; targetId?: string; at: string }[]; accessAudit: AccessAuditEvent[]; rates: Record<string, { minute: number; count: number }> }
export interface Identity { uid: string; email?: string; anonymous?: boolean }
export interface Repository { read<T>(operation: (store: Store) => T | Promise<T>): Promise<T>; transact<T>(operation: (store: Store) => T | Promise<T>): Promise<T>; appendAccessAudit?(event: AccessAuditEvent): Promise<void> }
export function emptyStore(now = new Date().toISOString()): Store {
  return { revision: 0, state: { id: 'main', version: 1, clock: now, people: [], pairs: [], letters: [], deliveries: [], tasks: [], reviews: [], followups: [], attachments: [], schools: [], teacherAssignments: [], helpCases: [], deliveryEvents: [], schoolAuthorities: [], accessGrants: [], evidenceSnapshots: [], riskSignals: [], disputeCases: [], supportTasks: [], dutyShifts: [], trainingRecords: [], planPolicies: [{ id: 'main', childMaxActivePairs: 2, volunteerMaxActivePairs: 2, newPairCooldownDays: 7 }] }, accounts: {}, applications: [], invites: [], consents: [], privacyRequests: [], receipts: {}, audit: [], accessAudit: [], rates: {} }
}
export function getAccount(store: Store, identity: Identity, active = false): Account {
  requireValue(identity.uid && !identity.anonymous, '请先登录', 'UNAUTHENTICATED')
  const account = store.accounts[identity.uid]
  requireValue(account, '请先完成加入申请或邀请激活', 'ACCOUNT_REQUIRED')
  requireValue(account.status !== 'disabled', '账号已停用，请联系负责老师或运营', 'ACCOUNT_DISABLED')
  if (active) requireValue(account.status === 'active', '加入申请仍在审核中', 'ACCOUNT_PENDING')
  return account
}
export function operator(account: Account, permission?: string) { requireValue(account.role === 'operator' && (!permission || account.permissions.includes(permission)), '没有此项操作权限', 'FORBIDDEN') }
/** Application permissions are authoritative; old demo profiles are never an authorization source. */
export function syncPermissions(store: Store) {
  for (const person of store.state.people) {
    const account = store.accounts[person.id]
    person.accountStatus = account?.status ?? 'disabled'
    if (person.role === 'operator') person.permissions = account?.status === 'active' ? [
      ...(account.permissions.includes('moderate') ? ['review' as const] : []),
      ...(account.permissions.includes('help') ? ['safeguarding' as const] : []),
      ...(account.permissions.includes('help-independent') ? ['independentSafeguarding' as const] : []),
      ...(account.permissions.includes('followup') ? ['administration' as const] : []),
      ...(account.permissions.includes('privacy') ? ['privacy' as const] : []),
      ...(account.permissions.includes('matching') ? ['matching' as const] : []),
      ...(account.permissions.includes('accounts') ? ['accounts' as const] : []),
    ] : []
  }
}
export function teacherHasScope(store: Store, teacherId: string, childId: string, scope: NonNullable<AppState['teacherAssignments']>[number]['scope'][number], now = store.state.clock, schoolId?: string): boolean {
  if (store.accounts[teacherId]?.status !== 'active') return false
  const teacher = store.state.people.find(person => person.id === teacherId && person.role === 'teacher')
  const child = store.state.people.find(person => person.id === childId && person.role === 'child')
  if (!teacher || !child) return false
  if (schoolId && (teacher.schoolId && teacher.schoolId !== schoolId || child.schoolId && child.schoolId !== schoolId)) return false
  return teacherScope(store.state, teacherId, childId, scope, now)
}

export function teacherCoordinatesSchool(store: Store, teacherId: string, schoolId: string, now = store.state.clock): boolean {
  if (store.accounts[teacherId]?.status !== 'active') return false
  const teacher = store.state.people.find(person => person.id === teacherId && person.role === 'teacher')
  if (!teacher || teacher.schoolId !== schoolId || !store.state.schools?.some(school => school.id === schoolId && school.status === 'active')) return false
  return !!store.state.teacherAssignments?.some(item => item.teacherId === teacherId && item.schoolId === schoolId && item.scope.includes('school-coordinate') && !item.revokedAt && Date.parse(item.startsAt) <= Date.parse(now) && (!item.endsAt || Date.parse(now) < Date.parse(item.endsAt)))
}

async function appendAccessAudit(repository: Repository, event: AccessAuditEvent): Promise<void> {
  if (repository.appendAccessAudit) return repository.appendAccessAudit(event)
  await repository.transact(store => { store.accessAudit.push(event) })
}

async function auditedRead<T>(repository: Repository, identity: Identity, targetType: AccessAuditEvent['targetType'], targetId: string, purpose: string, authorize: (store: Store) => T, now = new Date().toISOString(), auditDetails?: (store: Store, value: T) => Pick<AccessAuditEvent, 'approvalId' | 'versionId' | 'grantId' | 'reasonCode' | 'severity'>): Promise<T> {
  const outcome = await repository.read(store => {
    try {
      const value = authorize(store)
      return { allowed: true as const, value, details: auditDetails?.(store, value) }
    }
    catch (error) { return { allowed: false as const, error } }
  })
  const denial = !outcome.allowed && outcome.error instanceof ServiceError
    ? { reasonCode: outcome.error.reasonCode, severity: outcome.error.severity }
    : undefined
  const details = outcome.allowed ? outcome.details : denial
  await appendAccessAudit(repository, { id: randomUUID(), actorId: identity.uid || 'anonymous', targetType, targetId, decision: outcome.allowed ? 'allowed' : 'denied', purpose, at: now, ...(details ?? {}) })
  if (!outcome.allowed) throw outcome.error
  return outcome.value
}

/** Throws a ServiceError carrying the policy reason code so audits stay explainable. */
function requireAllow(decision: PolicyDecision, fallback: string, severity?: string): void {
  if (decision.decision === 'allow') return
  throw new ServiceError('FORBIDDEN', decision.reason || fallback, decision.reasonCode, severity)
}
export function snapshot(store: Store, identity: Identity) {
  const account = getAccount(store, identity)
  syncPermissions(store)
  if (account.status !== 'active') {
    const profile = store.state.people.find(person => person.id === identity.uid)
    requireValue(profile, '账号资料尚未完成，请联系运营', 'PROFILE_MISSING')
    return { state: { ...emptyStore(store.state.clock).state, people: [profile] }, profile, revision: store.revision, account: { ...account, application: store.applications.find(item => item.userId === identity.uid) } }
  }
  const state = scopeState(normalizeState(store.state), identity.uid)
  if (account.role === 'teacher') {
    const full = normalizeState(store.state)
    const allowedPairs = new Set(full.pairs.filter(pair => teacherHasScope(store, identity.uid, pair.childId, 'status', store.state.clock, pair.schoolId)).map(pair => pair.id))
    state.pairs = full.pairs.filter(pair => allowedPairs.has(pair.id))
    state.letters = full.letters.filter(letter => allowedPairs.has(letter.pairId))
    state.tasks = full.tasks.filter(task => allowedPairs.has(task.pairId))
    const visibleLetterIds = new Set(state.letters.map(letter => letter.id))
    state.deliveries = full.deliveries.filter(delivery => visibleLetterIds.has(delivery.letterId))
    state.deliveryEvents = (full.deliveryEvents ?? []).filter(event => visibleLetterIds.has(event.letterId))
    state.reviews = []
    state.people = full.people.filter(person => person.id === identity.uid || state.pairs.some(pair => [pair.childId, pair.volunteerId].includes(person.id)))
  }
  state.letters = state.letters.map(letter => {
    if (account.role !== 'teacher' && account.role !== 'operator') return letter
    const pair = store.state.pairs.find(pair => pair.id === letter.pairId)
    const editableTeacherDraft = account.role === 'teacher' && letter.moderation === 'draft' && letter.createdBy === identity.uid && !!pair && teacherHasScope(store, identity.uid, pair.childId, 'capture', store.state.clock, pair.schoolId)
    return editableTeacherDraft ? letter : {
      ...letter,
      title: '',
      body: '',
      riddleId: undefined,
      attachmentId: undefined,
      manuscriptAssetId: undefined,
      ocrRunId: undefined,
      approvedRenditionId: undefined,
      submissionVersions: [],
      moderationNote: undefined,
    }
  })
  const readableLetterIds = new Set(state.letters.map(letter => letter.id))
  state.deliveryEvents = (state.deliveryEvents ?? []).filter(item => readableLetterIds.has(item.letterId))
  state.manuscriptAssets = []
  if (account.role === 'teacher' || account.role === 'operator') state.ocrRuns = []
  state.helpCases = (state.helpCases ?? []).filter(item => {
    try { authorizeHelpCaseContent(store, identity, item.id); return true } catch { return false }
  }).map(item => {
    const visible = item.requesterId === identity.uid ? requesterHelpCaseProjection(item) : item
    return { ...visible, body: '', resolution: undefined, history: [] }
  })
  const mayManageAssignments = account.role === 'operator' && (account.permissions.includes('accounts') || account.permissions.includes('followup'))
  state.teacherAssignments = mayManageAssignments ? store.state.teacherAssignments ?? [] : account.role === 'teacher' ? (store.state.teacherAssignments ?? []).filter(item => item.teacherId === identity.uid) : []
  const schoolIds = new Set(state.teacherAssignments.map(item => item.schoolId))
  state.schools = mayManageAssignments ? store.state.schools ?? [] : (store.state.schools ?? []).filter(item => schoolIds.has(item.id))
  state.followups = state.followups.filter(item => item.kind !== 'help')
  state.attachments = account.role === 'teacher' || account.role === 'operator' ? [] : state.attachments.map(({ blob: _blob, storagePath: _storagePath, ...safe }) => safe)
  state.people = state.people.map(person => { const { guardianName: _name, ...safe } = person as Person & { guardianName?: string }; return safe })
  const profile = state.people.find(person => person.id === identity.uid)
  requireValue(profile, '账号资料尚未完成，请联系运营', 'PROFILE_MISSING')
  return { state, profile, revision: store.revision, account: { ...account, application: store.applications.find(item => item.userId === identity.uid) } }
}
export async function executeSnapshot(repository: Repository, identity: Identity, now = new Date().toISOString()) {
  const viewed = await repository.read(store => {
    getAccount(store, identity)
    syncPermissions(store)
    const original = store.state.followups
    store.state = refreshState(store.state, now)
    return { result: snapshot(store, identity), changed: JSON.stringify(original) !== JSON.stringify(store.state.followups) }
  })
  const result = !viewed.changed ? viewed.result : await repository.transact(store => {
    getAccount(store, identity)
    syncPermissions(store)
    store.state = refreshState(store.state, now)
    return snapshot(store, identity)
  })
  if (result.account.role === 'teacher') {
    const childIds = [...new Set(result.state.pairs.map(pair => pair.childId))]
    for (const childId of childIds.length ? childIds : [identity.uid]) await appendAccessAudit(repository, { id: randomUUID(), actorId: identity.uid, targetType: 'teacher-overview', targetId: childId, decision: 'allowed', purpose: childIds.length ? 'assigned-child-status' : 'assigned-children-empty-overview', at: now })
  }
  return result
}
function audit(store: Store, actorId: string, action: string, targetId?: string) {
  store.audit.push({ id: randomUUID(), actorId, action, targetId, at: store.state.clock })
  // Small-pilot workspace retains recent audit metadata; encrypted backups retain previous records.
  if (store.audit.length > 2000) store.audit.splice(0, store.audit.length - 2000)
}
export function throttle(store: Store, key: string, now: string, limit = 60) {
  const minute = Math.floor(Date.parse(now) / 60000); const old = store.rates[key]
  const next = old?.minute === minute ? { minute, count: old.count + 1 } : { minute, count: 1 }
  requireValue(next.count <= limit, '操作有些频繁，请稍后再试', 'RATE_LIMITED'); store.rates[key] = next
  for (const [id, value] of Object.entries(store.rates)) if (value.minute < minute - 2) delete store.rates[id]
}
const commandTypes = new Set(['match', 'assign-teacher', 'revoke-teacher-assignment', 'save-letter', 'submit-letter', 'review-letter', 'assign-review', 'release-held-letter', 'print', 'deliver', 'witness-read', 'read', 'pause-pair', 'pause-volunteer', 'resume-pair', 'end-pair', 'extend-task', 'help', 'claim-help-case', 'assign-help-case', 'resolve-help-case', 'resolve-followup', 'assign-followup', 'reopen-followup', 'grant-access', 'revoke-access', 'open-emergency-access', 'review-emergency-access', 'update-help-report', 'escalate-help-case', 'open-dispute', 'decide-dispute', 'review-risk-signal', 'complete-support-task', 'complete-training'])
function resultId(command: Command, previous: AppState, next: AppState): string {
  if (command.type === 'match') return next.pairs.find(item => !previous.pairs.some(old => old.id === item.id))?.id ?? next.pairs.find(item => item.status !== 'ended' && item.childId === command.childId && item.volunteerId === command.volunteerId)?.id ?? ''
  if (command.type === 'assign-teacher') return next.teacherAssignments?.find(item => !previous.teacherAssignments?.some(old => old.id === item.id))?.id ?? ''
  if (command.type === 'pause-volunteer') return command.volunteerId
  if (command.type === 'save-letter') return command.id ?? next.letters.find(item => !previous.letters.some(old => old.id === item.id))?.id ?? ''
  if (command.type === 'help') return next.helpCases?.find(item => !previous.helpCases?.some(old => old.id === item.id))?.id ?? ''
  if (command.type === 'grant-access' || command.type === 'open-emergency-access') return next.accessGrants?.find(item => !previous.accessGrants?.some(old => old.id === item.id))?.id ?? ''
  if (command.type === 'open-dispute') return next.disputeCases?.find(item => !previous.disputeCases?.some(old => old.id === item.id))?.id ?? ''
  return 'id' in command && typeof command.id === 'string' ? command.id : ''
}
export async function executeCommand(repository: Repository, identity: Identity, input: { command: Command; requestId: string; expectedRevision?: number }, now = new Date().toISOString()) {
  return repository.transact(store => {
    const command = input.command
    const account = getAccount(store, identity, true)
    syncPermissions(store)
    requireValue(typeof input.requestId === 'string' && /^[a-zA-Z0-9_-]{12,100}$/.test(input.requestId), '缺少有效的操作编号')
    requireValue(input.command && commandTypes.has(input.command.type), '不支持此项操作')
    requireValue(!('file' in input.command) && !('actorId' in input.command), '请通过安全附件接口上传图片')
    requireValue(JSON.stringify(input.command).length < 30000, '内容过长，请缩短后再试')
    if (input.command.type === 'save-letter') { text(input.command.body, '正文', 12000, true); text(input.command.title ?? '', '标题', 120, true) }
    if (['match', 'resume-pair', 'end-pair', 'extend-task'].includes(input.command.type)) operator(account)
    if (command.type === 'pause-pair') {
      if (account.role === 'teacher') {
        const pair = store.state.pairs.find(item => item.id === command.id)
        requireValue(pair && teacherHasScope(store, identity.uid, pair.childId, 'paper-delivery', now, pair.schoolId), '没有停止这组学校交付的权限', 'FORBIDDEN')
      } else operator(account, 'followup')
    }
    if (command.type === 'pause-volunteer') operator(account, 'help')
    if (command.type === 'assign-teacher') {
      if (account.role === 'operator') operator(account, 'followup')
      else {
        requireValue(account.role === 'teacher' && teacherCoordinatesSchool(store, identity.uid, command.schoolId, now), '没有本校老师指派权限', 'FORBIDDEN')
        requireValue(command.teacherId !== identity.uid && !command.scope.includes('school-coordinate'), '校内协调老师不能给自己扩权或授予协调权限', 'FORBIDDEN')
      }
    }
    if (command.type === 'revoke-teacher-assignment') {
      const assignmentId = command.id
      const assignment = store.state.teacherAssignments?.find(item => item.id === assignmentId)
      requireValue(assignment, '这条老师指派不存在', 'INVALID_ACTION')
      if (account.role === 'operator') operator(account, 'followup')
      else requireValue(account.role === 'teacher' && teacherCoordinatesSchool(store, identity.uid, assignment.schoolId, now) && assignment.teacherId !== identity.uid && !assignment.scope.includes('school-coordinate'), '没有撤销这条指派的权限', 'FORBIDDEN')
    }
    if (input.command.type === 'review-letter') operator(account, 'moderate')
    if (input.command.type === 'release-held-letter') operator(account, 'moderate')
    if (input.command.type === 'assign-review') operator(account, 'followup')
    if (['claim-help-case', 'assign-help-case', 'resolve-help-case'].includes(input.command.type)) operator(account, 'help')
    if (['resolve-followup', 'assign-followup', 'reopen-followup'].includes(input.command.type)) {
      const item = store.state.followups.find(item => item.id === (input.command as { id: string }).id)
      operator(account, item?.kind === 'help' ? 'help' : 'followup')
    }
    if (input.command.type === 'match' && (store.state.schools?.length || store.state.teacherAssignments?.length)) {
      requireValue(teacherHasScope(store, input.command.teacherId, input.command.childId, 'status', now), '学校尚未指派有效的负责老师', 'FORBIDDEN')
    }
    if (account.role === 'teacher' && command.type === 'save-letter') {
      const pairId = command.pairId
      const pair = store.state.pairs.find(item => item.id === pairId)
      requireValue(pair && teacherHasScope(store, identity.uid, pair.childId, 'capture', now, pair.schoolId), '没有这位孩子当前的纸信协助授权', 'FORBIDDEN')
    }
    if (account.role === 'teacher' && command.type === 'submit-letter') {
      const letterId = command.id
      const letter = store.state.letters.find(item => item.id === letterId)
      const pair = store.state.pairs.find(item => item.id === letter?.pairId)
      requireValue(pair && teacherHasScope(store, identity.uid, pair.childId, 'capture', now, pair.schoolId), '没有这位孩子当前的纸信协助授权', 'FORBIDDEN')
    }
    if (account.role === 'teacher' && ['print', 'deliver', 'witness-read'].includes(input.command.type)) {
      const ids = 'ids' in input.command ? input.command.ids : 'id' in input.command ? [input.command.id] : []
      requireValue(Array.isArray(ids) && ids.length > 0 && ids.every(id => {
        const letter = store.state.letters.find(item => item.id === id)
        const pair = store.state.pairs.find(item => item.id === letter?.pairId)
        return !!pair && teacherHasScope(store, identity.uid, pair.childId, 'paper-delivery', now, pair.schoolId)
      }), '没有这些纸信的当前交付授权', 'FORBIDDEN')
    }
    const key = `${identity.uid}:${input.requestId}`; const hash = digest(JSON.stringify(input.command)); const previous = store.receipts[key]
    if (previous) { requireValue(previous.hash === hash, '操作编号已用于其他内容', 'CONFLICT'); return { ...snapshot(store, identity), resultId: previous.resultId } }
    if (input.expectedRevision !== undefined) requireValue(input.expectedRevision === store.revision, '内容已在另一台设备更新，请刷新后核对；你的输入仍然保留', 'CONFLICT')
    store.state.clock = now
    throttle(store, identity.uid, now)
    const previousState = store.state
    let nextState: AppState
    try {
      nextState = reduceCommand(previousState, identity.uid, input.command, { formal: true })
    } catch (error) {
      if (error instanceof DomainError) throw new ServiceError(error.code, error.message)
      throw error
    }
    const id = resultId(input.command, previousState, nextState)
    store.state = nextState; store.state.clock = now; store.revision++
    store.receipts[key] = { hash, resultId: id, at: now }
    for (const [id, receipt] of Object.entries(store.receipts)) if (Date.parse(receipt.at) < Date.parse(now) - 7 * 86400000) delete store.receipts[id]
    audit(store, identity.uid, input.command.type, id)
    return { ...snapshot(store, identity), resultId: id }
  })
}
export function accountStatus(store: Store, identity: Identity) {
  const account = getAccount(store, identity)
  const accountManager = account.role === 'operator' && account.permissions.includes('accounts')
  const privacyManager = account.role === 'operator' && account.permissions.includes('privacy')
  return {
    account, profile: store.state.people.find(person => person.id === identity.uid),
    applications: store.applications.filter(item => accountManager || item.userId === identity.uid).map(({ note, ...item }) => ({ ...item, decisionNote: note })),
    invites: store.invites.filter(item => accountManager || item.createdBy === identity.uid).map(({ tokenHash: _token, activationId: _activation, ...safe }) => safe),
    consents: store.consents.filter(item => privacyManager || item.teacherId === identity.uid).map(item => ({ ...item, childId: item.childId ?? '', status: item.withdrawnAt ? 'withdrawn' : 'recorded' })),
    privacyRequests: store.privacyRequests.filter(item => privacyManager || item.userId === identity.uid).map(item => ({ ...item, requesterId: item.userId, resolution: item.note })),
    accounts: (accountManager ? Object.values(store.accounts) : account.role === 'teacher' ? Object.values(store.accounts).filter(item => item.role === 'child' && teacherHasScope(store, identity.uid, item.uid, 'status')) : []).map(item => ({ id: item.uid, uid: item.uid, role: item.role, status: item.status, nickname: store.state.people.find(person => person.id === item.uid)?.nickname ?? '参与者' })),
  }
}
export async function executeAccountAction(repository: Repository, identity: Identity, action: string, payload: Record<string, unknown>, now = new Date().toISOString()) {
  return repository.transact(store => {
    store.state.clock = now
    if (action === 'apply-volunteer') {
      requireValue(identity.uid && !identity.anonymous && identity.email, '请先完成邮箱验证码验证', 'UNAUTHENTICATED')
      const prior = store.accounts[identity.uid]; requireValue(!prior || (prior.role === 'volunteer' && prior.status !== 'disabled'), '当前账号不能申请志愿者')
      const existing = store.applications.find(item => item.userId === identity.uid)
      requireValue(!existing || existing.status !== 'approved', '申请已经通过，无需重复提交')
      requireValue(payload.agreementAccepted === true, '请阅读并确认陪伴约定')
      const nickname = text(payload.nickname, '昵称', 30)
      const application: Application = { id: existing?.id ?? randomUUID(), userId: identity.uid, nickname, email: identity.email, institution: text(payload.institution, '学校或机构', 100), availability: text(payload.availability, '可参与时间', 300), agreementAcceptedAt: now, status: 'pending', updatedAt: now }
      store.applications = [...store.applications.filter(item => item.userId !== identity.uid), application]
      store.accounts[identity.uid] = { uid: identity.uid, role: 'volunteer', status: 'pending', permissions: [], createdAt: prior?.createdAt ?? now }
      const profile: Person = { id: identity.uid, role: 'volunteer', nickname, subtitle: '陪伴申请审核中', avatar: '🍃', interests: [], accountStatus: 'pending', volunteerApproved: false }
      store.state.people = [...store.state.people.filter(person => person.id !== identity.uid), profile]
      store.revision++; audit(store, identity.uid, action, application.id); return snapshot(store, identity)
    }
    const account = getAccount(store, identity); if (action === 'status') return accountStatus(store, identity)
    throttle(store, identity.uid, now, 30)
    if (action === 'review-application') {
      operator(account, 'accounts'); const item = store.applications.find(item => item.id === payload.id); requireValue(item, '找不到申请')
      requireValue(['approved', 'returned'].includes(String(payload.decision)), '请选择审核结果')
      item.status = payload.decision as 'approved' | 'returned'; item.note = text(payload.note ?? '', '审核说明', 1000, item.status === 'approved'); item.reviewedBy = identity.uid; item.updatedAt = now
      const target = store.accounts[item.userId]; target.status = item.status === 'approved' ? 'active' : 'pending'
      Object.assign(store.state.people.find(person => person.id === item.userId)!, { accountStatus: target.status, volunteerApproved: item.status === 'approved', subtitle: item.status === 'approved' ? '已通过陪伴审核' : '请查看申请修改意见' })
      if (item.status === 'returned') for (const pair of store.state.pairs.filter(pair => pair.volunteerId === item.userId && pair.status === 'active')) { pair.status = 'paused'; pair.pausedAt = now; pair.pauseReason = '志愿者资格正在复核'; (pair.pauseHistory ??= []).push({ start: now, kind: 'pause', sourceId: pair.id }) }
    } else if (action === 'create-invite') {
      requireValue(account.status === 'active' && ['teacher', 'operator'].includes(account.role), '只有负责老师或运营可以邀请', 'FORBIDDEN')
      const role = payload.role; requireValue(['child', 'teacher', 'operator'].includes(String(role)), '邀请身份不正确')
      if (role !== 'child') operator(account, 'accounts')
      const teacherId = account.role === 'teacher' ? identity.uid : role === 'child' ? text(payload.teacherId, '负责老师', 100) : undefined
      if (teacherId) requireValue(store.accounts[teacherId]?.role === 'teacher' && store.accounts[teacherId]?.status === 'active', '请选择有效的负责老师')
      let consentId: string | undefined
      if (role === 'child') {
        const consent = payload.guardianConsent as Record<string, unknown>; requireValue(consent && typeof consent === 'object', '请先记录监护人授权')
        consentId = randomUUID(); store.consents.push({ id: consentId, teacherId: teacherId!, guardianName: text(consent.guardianName, '监护人姓名', 50), relationship: text(consent.relationship, '监护关系', 50), noticeVersion: text(consent.noticeVersion, '告知书版本', 100), evidenceReference: text(consent.evidenceReference, '已取得授权的凭证编号', 200), recordedBy: identity.uid, recordedAt: now })
      }
      const email = role === 'child' ? undefined : text(payload.email, '被邀请人的邮箱', 200)
      requireValue(!email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), '邮箱格式不正确')
      const requestedPermissions = role === 'operator' ? (payload.permissions === undefined ? ['moderate', 'followup'] : payload.permissions) : []
      requireValue(Array.isArray(requestedPermissions) && requestedPermissions.every(permission => typeof permission === 'string' && ['accounts', 'moderate', 'followup', 'help', 'help-independent', 'privacy', 'matching'].includes(permission) && account.permissions.includes(permission)), '不能授予超出自身范围的权限', 'FORBIDDEN')
      requireValue(!requestedPermissions.includes('help-independent') || requestedPermissions.includes('help'), '独立保护人员还须具备保护处理权限')
      const token = randomBytes(32).toString('base64url'); const invite: Invite = { id: randomUUID(), tokenHash: digest(token), role: role as Invite['role'], nickname: text(payload.nickname, '昵称', 30), email, permissions: [...requestedPermissions], teacherId, createdBy: identity.uid, createdAt: now, expiresAt: new Date(Date.parse(now) + 72 * 3600000).toISOString(), status: 'open', consentId }
      store.invites.push(invite); store.revision++; audit(store, identity.uid, action, invite.id); return { token, expiresAt: invite.expiresAt, id: invite.id }
    } else if (action === 'withdraw-consent') {
      const childId = text(payload.childId, '孩子账号', 100); const child = store.state.people.find(person => person.id === childId && person.role === 'child')
      requireValue(child && ((account.role === 'teacher' && teacherHasScope(store, identity.uid, childId, 'status', now)) || (account.role === 'operator' && account.permissions.includes('privacy'))), '没有此项操作权限', 'FORBIDDEN')
      const reason = text(payload.reason, '撤回说明', 1000)
      for (const consent of store.consents.filter(item => item.childId === childId && !item.withdrawnAt)) { consent.withdrawnAt = now; consent.reason = reason }
      child.guardianConsent = false; child.accountStatus = 'disabled'; store.accounts[childId].status = 'disabled'
      for (const pair of store.state.pairs.filter(item => item.childId === childId && item.status === 'active')) { pair.status = 'paused'; pair.pausedAt = now; pair.pauseReason = '监护授权已撤回'; (pair.pauseHistory ??= []).push({ start: now, kind: 'pause', sourceId: pair.id }) }
    } else if (action === 'privacy-request') {
      requireValue(['export', 'delete', 'withdraw'].includes(String(payload.kind)), '请选择申请类型')
      const prior = store.privacyRequests.find(item => item.userId === identity.uid && item.kind === payload.kind && item.status === 'open')
      if (!prior) store.privacyRequests.push({ id: randomUUID(), userId: identity.uid, kind: payload.kind as PrivacyRequest['kind'], reason: text(payload.reason, '申请说明', 1000), status: 'open', createdAt: now })
    } else if (action === 'resolve-privacy-request') {
      operator(account, 'privacy'); const item = store.privacyRequests.find(item => item.id === payload.id); requireValue(item, '找不到申请')
      requireValue(payload.completed === true, '完成资料处理后才可标记已处理；请先核对申请人及监护授权', 'PROCESSING_REQUIRED')
      item.status = 'resolved'; item.note = text(payload.note, '处理凭证及结果', 1000); item.resolvedBy = identity.uid
    } else if (action === 'set-account-status') {
      operator(account, 'accounts'); const target = store.accounts[text(payload.id, '账号', 100)]; requireValue(target && target.uid !== identity.uid, '不能通过这里更改自己的账号')
      requireValue(['active', 'disabled'].includes(String(payload.status)), '状态不正确')
      const person = store.state.people.find(item => item.id === target.uid)!
      if (payload.status === 'active') requireValue((person.role !== 'child' || person.guardianConsent) && (person.role !== 'volunteer' || person.volunteerApproved), '请先完成监护授权或志愿者审核')
      target.status = payload.status as 'active' | 'disabled'; target.disabledReason = text(payload.reason, '变更原因', 1000); person.accountStatus = target.status
      if (target.status === 'disabled') for (const pair of store.state.pairs.filter(item => item.status === 'active' && [item.childId, item.volunteerId].includes(target.uid))) { pair.status = 'paused'; pair.pausedAt = now; pair.pauseReason = '参与账号已停用'; (pair.pauseHistory ??= []).push({ start: now, kind: 'pause', sourceId: pair.id }) }
    } else throw new ServiceError('INVALID_ACTION', '不支持此项账号操作')
    store.revision++; audit(store, identity.uid, action, typeof payload.id === 'string' ? payload.id : undefined); return accountStatus(store, identity)
  })
}
export async function reserveInvite(repository: Repository, token: string, username: string, activationId: string, now = new Date().toISOString()) {
  requireValue(typeof token === 'string' && token.length >= 32 && token.length <= 128, '邀请信息不正确', 'INVITE_INVALID')
  requireValue(/^[A-Za-z0-9][A-Za-z0-9_.-]{4,23}$/.test(username), '账号需为5至24位字母、数字或 ._-')
  requireValue(/^[a-zA-Z0-9_-]{12,100}$/.test(activationId), '缺少激活编号')
  return repository.transact(store => {
    const invite = store.invites.find(item => item.tokenHash === digest(token))
    requireValue(invite && Date.parse(invite.expiresAt) > Date.parse(now), '邀请已失效，请向老师或运营申请新邀请', 'INVITE_INVALID')
    requireValue(invite.status === 'open' || (['activating', 'used'].includes(invite.status) && invite.activationId === activationId && invite.username === username), '邀请已使用，请直接登录或联系邀请人', 'INVITE_USED')
    invite.status = invite.status === 'used' ? 'used' : 'activating'; invite.activationId = activationId; invite.username = username; invite.userId ??= `inv_${digest(invite.id).slice(0,28)}`
    return { ...invite }
  })
}
export async function finishInvite(repository: Repository, inviteId: string, activationId: string, authUid: string, now = new Date().toISOString()) {
  return repository.transact(store => {
    const invite = store.invites.find(item => item.id === inviteId); requireValue(invite && invite.activationId === activationId && invite.userId === authUid && ['activating', 'used'].includes(invite.status), '邀请激活状态已变化', 'CONFLICT')
    if (invite.status === 'used') return { username: invite.username }
    const permissions = invite.role === 'operator' ? invite.permissions ?? [] : []
    store.accounts[authUid] = { uid: authUid, role: invite.role, status: 'active', permissions, createdAt: now }
    store.state.people.push({ id: authUid, role: invite.role, nickname: invite.nickname, subtitle: invite.role === 'child' ? '期待认识一位书信伙伴' : '陪伴计划参与者', avatar: invite.role === 'child' ? '🌱' : invite.role === 'teacher' ? '📚' : '✉️', interests: [], accountStatus: 'active', teacherId: invite.teacherId, guardianConsent: invite.role === 'child' ? true : undefined, permissions } as Person)
    if (invite.consentId) store.consents.find(item => item.id === invite.consentId)!.childId = authUid
    invite.status = 'used'; store.state.clock = now; store.revision++; audit(store, authUid, 'activate-invite', invite.id); return { username: invite.username }
  })
}
export function authorizeAttachment(store: Store, identity: Identity, id: string) {
  const account = getAccount(store, identity, true)
  syncPermissions(store)
  const attachment = store.state.attachments.find(item => item.id === id)
  requireValue(attachment, '图片不存在', 'NOT_FOUND')
  requireValue(!attachment.deletingAt, '图片正在清理，请刷新后重试', 'NOT_FOUND')
  const actor = store.state.people.find(person => person.id === identity.uid)
  requireValue(actor, '账号资料尚未完成，请联系运营', 'PROFILE_MISSING')
  const approved = store.state.letters.find(item => item.approvedRenditionId === id)
  const current = store.state.letters.find(item => item.attachmentId === id)
  const linked = approved ?? current
  if (linked) {
    const decision = authorize({ actor, action: 'read-attachment', resource: { type: 'attachment', id }, purpose: 'child-assisted-capture', state: store.state, now: store.state.clock })
    requireAllow(decision, '这封信不在你的可读范围内。')
    return attachment as typeof attachment & { storagePath: string; ownerId: string }
  }
  const historical = store.state.letters.find(item => item.submissionVersions?.some(version => version.attachmentId === id || version.approvedRenditionId === id))
  if (historical) {
    requireValue((account.role === 'child' || account.role === 'volunteer') && (historical.authorId === identity.uid || historical.createdBy === identity.uid), '无权查看这张历史图片', 'FORBIDDEN')
    return attachment as typeof attachment & { storagePath: string; ownerId: string }
  }
  const decision = authorize({ actor, action: 'read-attachment', resource: { type: 'attachment', id }, purpose: 'child-assisted-capture', state: store.state, now: store.state.clock })
  requireAllow(decision, '无权查看这张图片')
  if (account.role === 'teacher' && attachment.ownerId === identity.uid) {
    const pair = store.state.pairs.find(item => item.id === attachment.pairId)
    requireValue(!!pair && teacherHasScope(store, identity.uid, pair.childId, 'capture', store.state.clock, pair.schoolId), '这张图片不在当前拍摄协助任务内', 'FORBIDDEN')
  }
  return attachment as typeof attachment & { storagePath: string; ownerId: string }
}

export async function executeAttachmentContentRead(repository: Repository, identity: Identity, id: string, now = new Date().toISOString()) {
  return auditedRead(repository, identity, 'attachment', id, 'letter-image-or-capture-task', store => authorizeAttachment(store, identity, id), now, (store, attachment) => {
    const letter = store.state.letters.find(item => item.attachmentId === attachment.id || item.approvedRenditionId === attachment.id || item.submissionVersions?.some(version => version.attachmentId === attachment.id || version.approvedRenditionId === attachment.id))
    const version = letter?.attachmentId === attachment.id || letter?.approvedRenditionId === attachment.id ? letter.revision : letter?.submissionVersions?.find(item => item.attachmentId === attachment.id || item.approvedRenditionId === attachment.id)?.revision
    const approval = letter && [...store.state.reviews].reverse().find(item => item.letterId === letter.id && item.decision === 'approved')
    return { versionId: version == null ? undefined : `${letter!.id}:${version}`, approvalId: approval?.id }
  })
}

export function authorizeLetterContent(store: Store, identity: Identity, id: string) {
  const account = getAccount(store, identity, true)
  syncPermissions(store)
  const actor = store.state.people.find(person => person.id === identity.uid)
  const letter = store.state.letters.find(item => item.id === id)
  requireValue(actor && letter, '信件不存在', 'NOT_FOUND')
  const decision = authorize({ actor, action: 'read-letter', resource: { type: 'letter', id: letter.id }, purpose: 'home-overview', state: store.state, now: store.state.clock })
  requireAllow(decision, '这封信不在你的可读范围内。')
  if (account.role === 'teacher') {
    const capture = letter.createdBy === identity.uid && letter.moderation === 'draft'
    return capture ? letter : approvedLetterProjection(letter)
  }
  if (account.role === 'operator') return letter
  return letter.authorId === identity.uid ? letter : approvedLetterProjection(letter)
}

export async function executeLetterContentRead(repository: Repository, identity: Identity, id: string, now = new Date().toISOString()) {
  return auditedRead(repository, identity, 'letter', id, 'correspondence-or-assigned-task', store => authorizeLetterContent(store, identity, id), now, (store, letter) => {
    const approval = [...store.state.reviews].reverse().find(item => item.letterId === letter.id && item.decision === 'approved')
    const emergency = (store.state.accessGrants ?? []).find(grant => grant.actorId === identity.uid && grant.targetType === 'letter' && grant.targetId === letter.id && grant.emergency && !grant.revokedAt && Date.parse(grant.startsAt) <= Date.parse(store.state.clock) && Date.parse(store.state.clock) < Date.parse(grant.expiresAt))
    return { versionId: `${letter.id}:${letter.revision ?? 0}`, approvalId: approval?.id, ...(emergency ? { grantId: emergency.id, severity: 'high' } : {}) }
  })
}

export function authorizeHelpCaseContent(store: Store, identity: Identity, id: string) {
  getAccount(store, identity, true)
  syncPermissions(store)
  const item = store.state.helpCases?.find(entry => entry.id === id)
  requireValue(item, '保护事项不存在', 'NOT_FOUND')
  const actor = store.state.people.find(person => person.id === identity.uid)
  requireValue(actor, '账号资料尚未完成，请联系运营', 'PROFILE_MISSING')
  const decision = authorize({ actor, action: 'read-help-case', resource: { type: 'help-case', id: item.id }, purpose: 'safeguarding-case', state: store.state, now: store.state.clock })
  requireAllow(decision, '没有这项保护事项的访问权限', item.severity)
  return item.requesterId === identity.uid ? requesterHelpCaseProjection(item) : item
}

export async function executeHelpCaseContentRead(repository: Repository, identity: Identity, id: string, now = new Date().toISOString()) {
  return auditedRead(repository, identity, 'help-case', id, 'assigned-safeguarding-case', store => authorizeHelpCaseContent(store, identity, id), now,
    (store, item) => ({ severity: item.severity }))
}
