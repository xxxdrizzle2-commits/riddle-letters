import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { normalizeState, reduceCommand, refreshState, scopeState, canReadLetter } from '../src/domain'
import type { AppState, Command, Person, Role } from '../src/types'

export class ServiceError extends Error { constructor(public code: string, message: string) { super(message) } }
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
export interface Store { revision: number; state: AppState; accounts: Record<string, Account>; applications: Application[]; invites: Invite[]; consents: Consent[]; privacyRequests: PrivacyRequest[]; receipts: Record<string, { hash: string; resultId: string; at: string }>; audit: { id: string; actorId: string; action: string; targetId?: string; at: string }[]; rates: Record<string, { minute: number; count: number }> }
export interface Identity { uid: string; email?: string; anonymous?: boolean }
export interface Repository { read<T>(operation: (store: Store) => T | Promise<T>): Promise<T>; transact<T>(operation: (store: Store) => T | Promise<T>): Promise<T> }
export function emptyStore(now = new Date().toISOString()): Store {
  return { revision: 0, state: { id: 'main', version: 1, clock: now, people: [], pairs: [], letters: [], deliveries: [], tasks: [], reviews: [], followups: [], attachments: [] }, accounts: {}, applications: [], invites: [], consents: [], privacyRequests: [], receipts: {}, audit: [], rates: {} }
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
      ...(account.permissions.includes('followup') ? ['administration' as const] : []),
    ] : []
  }
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
  state.attachments = state.attachments.map(({ blob: _blob, storagePath: _storagePath, ...safe }) => safe)
  state.people = state.people.map(person => { const { guardianName: _name, ...safe } = person as Person & { guardianName?: string }; return safe })
  if (account.role === 'operator' && !account.permissions.includes('help')) state.followups = state.followups.filter(item => item.kind !== 'help')
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
  if (!viewed.changed) return viewed.result
  return repository.transact(store => {
    getAccount(store, identity)
    syncPermissions(store)
    store.state = refreshState(store.state, now)
    return snapshot(store, identity)
  })
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
const commandTypes = new Set(['match', 'save-letter', 'submit-letter', 'review-letter', 'print', 'deliver', 'read', 'pause-pair', 'resume-pair', 'end-pair', 'extend-task', 'help', 'resolve-followup', 'assign-followup', 'reopen-followup'])
function resultId(command: Command, previous: AppState, next: AppState): string {
  if (command.type === 'match') return next.pairs.find(item => !previous.pairs.some(old => old.id === item.id))?.id ?? next.pairs.find(item => item.status !== 'ended' && item.childId === command.childId && item.volunteerId === command.volunteerId)?.id ?? ''
  if (command.type === 'save-letter') return command.id ?? next.letters.find(item => !previous.letters.some(old => old.id === item.id))?.id ?? ''
  if (command.type === 'help') return next.followups.find(item => !previous.followups.some(old => old.id === item.id))?.id ?? ''
  return 'id' in command && typeof command.id === 'string' ? command.id : ''
}
export async function executeCommand(repository: Repository, identity: Identity, input: { command: Command; requestId: string; expectedRevision?: number }, now = new Date().toISOString()) {
  return repository.transact(store => {
    const account = getAccount(store, identity, true); store.state.clock = now
    syncPermissions(store)
    requireValue(typeof input.requestId === 'string' && /^[a-zA-Z0-9_-]{12,100}$/.test(input.requestId), '缺少有效的操作编号')
    requireValue(input.command && commandTypes.has(input.command.type), '不支持此项操作')
    requireValue(!('file' in input.command) && !('actorId' in input.command), '请通过安全附件接口上传图片')
    requireValue(JSON.stringify(input.command).length < 30000, '内容过长，请缩短后再试')
    if (input.command.type === 'save-letter') { text(input.command.body, '正文', 12000, true); text(input.command.title ?? '', '标题', 120, true) }
    if (input.command.type === 'review-letter') operator(account, 'moderate')
    if (['resolve-followup', 'assign-followup', 'reopen-followup'].includes(input.command.type)) {
      const item = store.state.followups.find(item => item.id === (input.command as { id: string }).id)
      operator(account, item?.kind === 'help' ? 'help' : 'followup')
    }
    const key = `${identity.uid}:${input.requestId}`; const hash = digest(JSON.stringify(input.command)); const previous = store.receipts[key]
    if (previous) { requireValue(previous.hash === hash, '操作编号已用于其他内容', 'CONFLICT'); return { ...snapshot(store, identity), resultId: previous.resultId } }
    if (input.expectedRevision !== undefined) requireValue(input.expectedRevision === store.revision, '内容已在另一台设备更新，请刷新后核对；你的输入仍然保留', 'CONFLICT')
    throttle(store, identity.uid, now)
    const previousState = store.state
    const nextState = reduceCommand(previousState, identity.uid, input.command, { formal: true })
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
    accounts: (accountManager ? Object.values(store.accounts) : account.role === 'teacher' ? Object.values(store.accounts).filter(item => item.role === 'child' && store.state.people.some(person => person.id === item.uid && person.teacherId === identity.uid)) : []).map(item => ({ id: item.uid, uid: item.uid, role: item.role, status: item.status, nickname: store.state.people.find(person => person.id === item.uid)?.nickname ?? '参与者' })),
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
      requireValue(Array.isArray(requestedPermissions) && requestedPermissions.every(permission => typeof permission === 'string' && ['accounts', 'moderate', 'followup', 'help', 'privacy'].includes(permission) && account.permissions.includes(permission)), '不能授予超出自身范围的权限', 'FORBIDDEN')
      const token = randomBytes(32).toString('base64url'); const invite: Invite = { id: randomUUID(), tokenHash: digest(token), role: role as Invite['role'], nickname: text(payload.nickname, '昵称', 30), email, permissions: [...requestedPermissions], teacherId, createdBy: identity.uid, createdAt: now, expiresAt: new Date(Date.parse(now) + 72 * 3600000).toISOString(), status: 'open', consentId }
      store.invites.push(invite); store.revision++; audit(store, identity.uid, action, invite.id); return { token, expiresAt: invite.expiresAt, id: invite.id }
    } else if (action === 'withdraw-consent') {
      const childId = text(payload.childId, '孩子账号', 100); const child = store.state.people.find(person => person.id === childId && person.role === 'child')
      requireValue(child && ((account.role === 'teacher' && child.teacherId === identity.uid) || (account.role === 'operator' && account.permissions.includes('privacy'))), '没有此项操作权限', 'FORBIDDEN')
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
  const account = getAccount(store, identity, true); const attachment = store.state.attachments.find(item => item.id === id)
  syncPermissions(store)
  requireValue(attachment, '图片不存在', 'NOT_FOUND')
  const ownerId = (attachment as typeof attachment & { ownerId?: string }).ownerId
  const person = store.state.people.find(item => item.id === account.uid)!
  const current = store.state.letters.find(item => item.attachmentId === id)
  const historical = store.state.letters.find(item => item.submissionVersions?.some(version => version.attachmentId === id))
  const currentAccess = current && canReadLetter(store.state, person, current)
  const historyAccess = historical && (historical.authorId === identity.uid || historical.createdBy === identity.uid || (account.role === 'operator' && account.permissions.includes('moderate')))
  requireValue(ownerId === identity.uid || currentAccess || historyAccess, '无权查看这张图片', 'FORBIDDEN')
  return attachment as typeof attachment & { storagePath: string; ownerId: string }
}
