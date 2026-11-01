import type {
  AccessGrant, AccessPurpose, AccessTargetType, AppState, DisputeCase, HelpCase, Letter, Pair, Person,
  Permission, SchoolAuthority, TeacherScope, TrainingRecord,
} from './types'
import { TRAINING_VERSION } from './types'

export type PolicyAction =
  | 'read-overview' | 'read-letter' | 'read-attachment' | 'read-help-case'
  | 'read-risk-signal' | 'read-dispute' | 'read-grant'
  | 'report-abnormal' | 'open-case'
  | 'grant-access' | 'revoke-access'
  | 'open-emergency-access' | 'review-emergency-access'
  | 'triage-help-case' | 'update-help-report' | 'escalate-help-case' | 'resolve-help-case'
  | 'open-dispute' | 'decide-dispute'
  | 'review-risk-signal' | 'complete-support-task' | 'complete-training'
  | 'match' | 'write-letter' | 'submit-letter' | 'pause-volunteer' | 'resume-pair' | 'record-delivery'

export type PolicyPurpose =
  | 'home-overview' | 'deliver-print' | 'child-assisted-capture'
  | 'safeguarding-case' | 'emergency-risk' | 'audit-review' | 'data-request'
  | 'content-review' | 'pair-management'

export type PolicyReasonCode =
  | 'RESOURCE_NOT_FOUND' | 'ROLE_NOT_PERMITTED' | 'NO_PERMISSION_PACKAGE'
  | 'NO_ASSIGNMENT' | 'ASSIGNMENT_EXPIRED' | 'WRONG_SCHOOL'
  | 'PAIR_NOT_ACTIVE' | 'EXCLUDED_ACTOR' | 'NOT_REVIEWER'
  | 'NO_SCHOOL_AUTHORITY' | 'SECOND_SIGNATURE_REQUIRED' | 'SIGNATURE_CONFLICT'
  | 'GRANT_NOT_FOUND' | 'GRANT_EXPIRED' | 'GRANT_REVOKED' | 'PURPOSE_MISMATCH'
  | 'EMERGENCY_OUTSTANDING' | 'EMERGENCY_WINDOW_EXCEEDED' | 'BREAK_GLASS_SELF_REVIEW'
  | 'TRAINING_REQUIRED' | 'CAPACITY_EXCEEDED' | 'COOLDOWN_ACTIVE'
  | 'SAFETY_PAUSE' | 'OPEN_DISPUTE' | 'REPORT_FIELDS_INCOMPLETE'
  | 'NOTE_TOO_SHORT' | 'NO_DUTY_BACKUP' | 'DUTY_NOT_ACTIVE'

export type PolicyDecision =
  | { decision: 'allow'; grantId?: string }
  | { decision: 'deny'; reason: string; reasonCode: PolicyReasonCode }

export interface PolicyResource {
  type: 'letter' | 'attachment' | 'help-case' | 'overview'
  | 'risk-signal' | 'dispute' | 'pair' | 'grant' | 'support-task' | 'training' | 'none'
  id?: string
}

export interface PolicyInput {
  actor: Person
  action: PolicyAction
  resource: PolicyResource
  purpose: PolicyPurpose
  state: AppState
  now: string
  reason?: string
  note?: string
}

const deny = (reason: string, reasonCode: PolicyReasonCode): PolicyDecision => ({ decision: 'deny', reason, reasonCode })
const allow = (grantId?: string): PolicyDecision => grantId ? { decision: 'allow', grantId } : { decision: 'allow' }

export const hasPackage = (person: Person, permission: Permission): boolean =>
  person.role === 'operator' && (person.permissions ? person.permissions.includes(permission) : true)

const activeAccount = (person: Person | undefined): person is Person => !!person && person.accountStatus !== 'disabled'
const inWindow = (start: string, end: string | undefined, now: string) => Date.parse(start) <= Date.parse(now) && (!end || Date.parse(now) < Date.parse(end))
const activeSchool = (state: AppState, schoolId: string | undefined) =>
  !state.schools?.length || !!state.schools.some(school => school.id === schoolId && school.status === 'active')

/** The only teacher-scope implementation. Both client and server delegate here. */
export function teacherScope(state: AppState, teacherId: string, childId: string, scope: TeacherScope, now: string): boolean {
  const teacher = state.people.find(person => person.id === teacherId && person.role === 'teacher')
  const child = state.people.find(person => person.id === childId && person.role === 'child')
  if (!activeAccount(teacher) || !child) return false
  const assignments = state.teacherAssignments ?? []
  if (!assignments.length) return child.teacherId === teacherId || state.pairs.some(pair => pair.childId === childId && pair.teacherId === teacherId)
  return assignments.some(assignment => {
    const childIsAssigned = assignment.childId === childId
      || (!assignment.childId && (scope === 'protect' || scope === 'status' && assignment.scope.includes('school-coordinate')))
    return assignment.teacherId === teacherId
      && childIsAssigned
      && assignment.scope.includes(scope)
      && !assignment.revokedAt
      && inWindow(assignment.startsAt, assignment.endsAt, now)
      && activeSchool(state, assignment.schoolId)
      && (!child.schoolId || assignment.schoolId === child.schoolId)
      && (!teacher.schoolId || assignment.schoolId === teacher.schoolId)
  })
}

export function schoolAuthority(state: AppState, userId: string, schoolId: string, now: string, kind?: 'principal' | 'safeguarding-lead'): SchoolAuthority | undefined {
  const person = state.people.find(item => item.id === userId)
  if (!activeAccount(person)) return undefined
  return (state.schoolAuthorities ?? []).find(item => item.schoolId === schoolId && item.userId === userId
    && (!kind || item.kind === kind) && !item.revokedAt && inWindow(item.startsAt, item.endsAt, now))
}

const authorityAnywhere = (state: AppState, userId: string, kind: 'principal' | 'safeguarding-lead', now: string) =>
  (state.schoolAuthorities ?? []).some(item => item.userId === userId && item.kind === kind && !item.revokedAt && inWindow(item.startsAt, item.endsAt, now))

/** Backup of the active safeguarding lead also carries the school protection seat. */
export const safeguardingSeat = (state: AppState, userId: string, now: string): string | undefined => {
  const direct = (state.schoolAuthorities ?? []).find(item => item.kind === 'safeguarding-lead' && item.userId === userId && !item.revokedAt && inWindow(item.startsAt, item.endsAt, now))
  if (direct) return direct.schoolId
  const backup = (state.schoolAuthorities ?? []).find(item => item.kind === 'safeguarding-lead' && item.backupUserId === userId && !item.revokedAt && inWindow(item.startsAt, item.endsAt, now))
  return backup?.schoolId
}

export const onDuty = (state: AppState, userId: string, now: string, scope: 'platform' | 'school', schoolId?: string) =>
  (state.dutyShifts ?? []).some(shift => shift.scope === scope && shift.userId === userId
    && (!schoolId || shift.schoolId === schoolId) && inWindow(shift.startsAt, shift.endsAt, now))

export const isExcluded = (helpCase: HelpCase, actorId: string) =>
  helpCase.excludedActorIds.includes(actorId) || helpCase.reportedPersonId === actorId

export function eligibleHelpOwner(person: Person, helpCase: Pick<HelpCase, 'reportedParty' | 'reportedPersonId' | 'excludedActorIds'>): boolean {
  if (person.accountStatus === 'disabled' || person.id === helpCase.reportedPersonId || helpCase.excludedActorIds.includes(person.id)) return false
  if (!hasPackage(person, 'safeguarding')) return false
  return helpCase.reportedParty !== 'operator' || hasPackage(person, 'independentSafeguarding')
}

export const trainingFor = (state: AppState, volunteerId: string): TrainingRecord | undefined =>
  (state.trainingRecords ?? []).find(item => item.volunteerId === volunteerId && item.version === TRAINING_VERSION)

const grantById = (state: AppState, id: string) => (state.accessGrants ?? []).find(item => item.id === id)
const helpCaseById = (state: AppState, id: string) => (state.helpCases ?? []).find(item => item.id === id)
const pairById = (state: AppState, id: string) => state.pairs.find(item => item.id === id)
const letterById = (state: AppState, id: string) => state.letters.find(item => item.id === id)

function letterForTarget(state: AppState, targetType: AccessTargetType, targetId: string): Letter | undefined {
  if (targetType === 'letter') return letterById(state, targetId)
  if (targetType !== 'attachment') return undefined
  return state.letters.find(item => item.attachmentId === targetId || item.approvedRenditionId === targetId
    || item.submissionVersions?.some(version => version.attachmentId === targetId || version.approvedRenditionId === targetId))
}

function helpCaseSchoolId(state: AppState, helpCase: HelpCase | undefined): string | undefined {
  if (!helpCase) return undefined
  if (helpCase.pairId) return pairById(state, helpCase.pairId)?.schoolId
  return state.people.find(item => item.id === helpCase.requesterId)?.schoolId
}

function targetSchoolId(state: AppState, targetType: AccessTargetType, targetId: string): string | undefined {
  if (targetType === 'help-case') return helpCaseSchoolId(state, helpCaseById(state, targetId))
  const letter = letterForTarget(state, targetType, targetId)
  return letter ? pairById(state, letter.pairId)?.schoolId : undefined
}

export function grantIsActive(grant: AccessGrant | undefined, now: string): grant is AccessGrant {
  return !!grant && !grant.revokedAt && inWindow(grant.startsAt, grant.expiresAt, now) && !!(grant.emergency || grant.approvedBy)
}

function grantFor(state: AppState, actorId: string, targetType: AccessTargetType, targetId: string, now: string, purposes?: AccessPurpose[]): AccessGrant | undefined {
  return (state.accessGrants ?? []).find(item => item.actorId === actorId && item.targetType === targetType && item.targetId === targetId
    && (!purposes || purposes.includes(item.purpose)) && grantIsActive(item, now) && grantMatchesCase(state, item))
}

export const activeGrantCount = (state: AppState, actorId: string, now: string) =>
  (state.accessGrants ?? []).filter(item => item.actorId === actorId && grantIsActive(item, now)).length

const isSensitiveTarget = (type: AccessTargetType) => type === 'letter' || type === 'attachment' || type === 'help-case'

function grantMatchesCase(state: AppState, grant: AccessGrant): boolean {
  if (!isSensitiveTarget(grant.targetType)) return true
  const grantee = state.people.find(item => item.id === grant.actorId)
  const targetSchool = targetSchoolId(state, grant.targetType, grant.targetId)
  if (grantee?.role === 'teacher' && (!targetSchool || safeguardingSeat(state, grantee.id, state.clock) !== targetSchool)) return false
  if (grant.emergency) return true
  const helpCase = grant.caseId ? helpCaseById(state, grant.caseId) : undefined
  if (!helpCase || helpCase.status === 'resolved' || isExcluded(helpCase, grant.actorId)) return false
  const caseSchool = helpCaseSchoolId(state, helpCase)
  if (targetSchool && caseSchool && targetSchool !== caseSchool) return false
  if (grant.targetType === 'help-case') return grant.targetId === helpCase.id
  const letter = letterForTarget(state, grant.targetType, grant.targetId)
  return !!letter && !!helpCase.pairId && letter.pairId === helpCase.pairId
}

export function helpReportComplete(helpCase: HelpCase): boolean {
  if (helpCase.severity !== 'high' || !helpCase.reportRequired) return true
  if (helpCase.reportDecision === 'not-required') {
    return !!helpCase.reportReason && !!helpCase.reportReviewedBy
      && helpCase.reportReviewedBy !== helpCase.ownerId
      && helpCase.reportReviewedBy !== helpCase.schoolOwnerId
  }
  return !!helpCase.reportedAt && !!helpCase.reportAuthority && !!helpCase.reportReceipt
}

export function hasSchoolSeat(state: AppState, userId: string, schoolId: string, now: string) {
  return !!schoolAuthority(state, userId, schoolId, now, 'safeguarding-lead') || !!schoolAuthority(state, userId, schoolId, now, 'principal')
}

export const hasPlatformSignature = (actor: Person) => hasPackage(actor, 'privacy') || hasPackage(actor, 'safeguarding')

function disputeForPair(state: AppState, pairId: string): DisputeCase | undefined {
  return (state.disputeCases ?? []).find(item => item.pairId === pairId)
}

function safetySuspension(pair: Pair): boolean {
  return (pair.pauseReason ?? '').includes('保护性暂停') || (pair.pauseReason ?? '').includes('安全风险') || (pair.pauseReason ?? '').includes('学校停止交付')
}

/** Pure authorization. It never writes, logs, or throws. */
export function authorize(input: PolicyInput): PolicyDecision {
  const { actor, action, resource, state, now, note } = input
  if (!activeAccount(actor)) return deny('账号不可用。', 'ROLE_NOT_PERMITTED')
  const op = actor.role === 'operator'
  let pair: Pair | undefined

  switch (action) {
    case 'read-overview': {
      if (actor.role === 'child' || actor.role === 'volunteer') return allow()
      if (actor.role === 'teacher') {
        const assigned = state.pairs.some(item => teacherScope(state, actor.id, item.childId, 'status', now))
          || (state.teacherAssignments ?? []).some(item => item.teacherId === actor.id && !item.revokedAt && inWindow(item.startsAt, item.endsAt, now) && activeSchool(state, item.schoolId))
        return assigned ? allow() : deny('当前没有有效的校内指派。', 'NO_ASSIGNMENT')
      }
      return hasPackage(actor, 'administration') || hasPackage(actor, 'matching') || hasPackage(actor, 'review') || hasPackage(actor, 'safeguarding') || hasPackage(actor, 'accounts') || hasPackage(actor, 'privacy')
        ? allow() : deny('当前账号没有运营职责。', 'NO_PERMISSION_PACKAGE')
    }
    case 'read-letter': {
      const letter = resource.id ? letterById(state, resource.id) : undefined
      if (!letter) return deny('信件不存在。', 'RESOURCE_NOT_FOUND')
      pair = pairById(state, letter.pairId)
      if (!pair) return deny('结对不存在。', 'RESOURCE_NOT_FOUND')
      if (letter.authorId === actor.id || letter.createdBy === actor.id && letter.moderation === 'draft') return allow()
      if (actor.role === 'child' || actor.role === 'volunteer') {
        const recipientId = letter.recipientId ?? (letter.authorId === pair.childId ? pair.volunteerId : pair.childId)
        const delivered = !!state.deliveries.find(item => item.letterId === letter.id && item.deliveredAt)
        return recipientId === actor.id && letter.moderation === 'approved' && delivered
          ? allow() : deny('这封信暂时不在你的可读范围内。', 'NO_ASSIGNMENT')
      }
      if (op) {
        if (letter.moderation === 'pending' && letter.reviewAssigneeId === actor.id && hasPackage(actor, 'review')) return allow()
        const grant = grantFor(state, actor.id, 'letter', letter.id, now, ['audit-review', 'data-request', 'safeguarding-case', 'emergency-risk'])
        if (grant) return allow(grant.id)
        return deny('运营不能在日常巡检中查阅信件正文。', 'NO_PERMISSION_PACKAGE')
      }
      if (actor.role === 'teacher') {
        const capture = letter.createdBy === actor.id && letter.moderation === 'draft' && teacherScope(state, actor.id, pair.childId, 'capture', now)
        const delivery = pair.status === 'active' && letter.moderation === 'approved' && letter.authorId === pair.volunteerId && letter.recipientId === pair.childId
          && (letter.deliveryRoute ?? (pair.channel === 'paper' ? 'school-paper' : 'online')) === 'school-paper'
          && !state.deliveries.some(item => item.letterId === letter.id && item.deliveredAt)
          && teacherScope(state, actor.id, pair.childId, 'paper-delivery', now)
        const grant = grantFor(state, actor.id, 'letter', letter.id, now, ['deliver-print', 'safeguarding-case', 'emergency-risk'])
        if (capture || delivery) return allow()
        if (grant) return allow(grant.id)
        return deny('这封信不在当前协助、交付或经批准的访问范围内。', 'NO_ASSIGNMENT')
      }
      return deny('没有这封信的读取权限。', 'ROLE_NOT_PERMITTED')
    }
    case 'read-attachment': {
      const attachment = resource.id ? state.attachments.find(item => item.id === resource.id) : undefined
      if (!attachment) return deny('图片不存在。', 'RESOURCE_NOT_FOUND')
      const asLetter = state.letters.find(item => item.approvedRenditionId === attachment.id || item.attachmentId === attachment.id)
      if (asLetter) {
        const decision = authorize({ ...input, action: 'read-letter', resource: { type: 'letter', id: asLetter.id } })
        if (decision.decision === 'deny') return decision
        const privateSource = !!asLetter.manuscriptAssetId && asLetter.attachmentId === attachment.id
        if (privateSource && actor.id !== asLetter.authorId && actor.id !== asLetter.createdBy && !(op && asLetter.reviewAssigneeId === actor.id)) {
          return deny('私有原稿不能作为普通附件读取。', 'NO_ASSIGNMENT')
        }
        return allow()
      }
      if (attachment.ownerId === actor.id) return allow()
      const grant = grantFor(state, actor.id, 'attachment', attachment.id, now)
      return grant ? allow(grant.id) : deny('这张图片不在当前任务范围内。', 'NO_ASSIGNMENT')
    }
    case 'read-help-case': {
      const helpCase = resource.id ? helpCaseById(state, resource.id) : undefined
      if (!helpCase) return deny('保护个案不存在。', 'RESOURCE_NOT_FOUND')
      if (helpCase.requesterId === actor.id) return allow()
      if (isExcluded(helpCase, actor.id)) return deny('你是被反映人或需要回避的人员，不能读取这个个案。', 'EXCLUDED_ACTOR')
      if (helpCase.status === 'resolved') return deny('个案已结案，原处理权限已撤销。', 'NO_ASSIGNMENT')
      if (op && hasPackage(actor, 'safeguarding') && [helpCase.ownerId, helpCase.backupOwnerId].includes(actor.id)
        && (helpCase.reportedParty !== 'operator' || hasPackage(actor, 'independentSafeguarding'))) return allow()
      if (actor.role === 'teacher' && helpCase.schoolOwnerId === actor.id) {
        const childId = helpCase.pairId ? pairById(state, helpCase.pairId)?.childId : helpCase.requesterId
        if (childId && teacherScope(state, actor.id, childId, 'protect', now)) return allow()
      }
      if (actor.role === 'teacher') {
        const schoolId = helpCase.pairId ? pairById(state, helpCase.pairId)?.schoolId : undefined
        if (schoolId && safeguardingSeat(state, actor.id, now) === schoolId) return allow()
      }
      const grant = grantFor(state, actor.id, 'help-case', helpCase.id, now, ['safeguarding-case', 'emergency-risk'])
      return grant ? allow(grant.id) : deny('没有这个保护个案的读取权限。', 'NO_ASSIGNMENT')
    }
    case 'read-risk-signal': {
      if (!op || !(hasPackage(actor, 'safeguarding') || hasPackage(actor, 'privacy'))) return deny('只有保护岗可以查看风险信号。', 'NO_PERMISSION_PACKAGE')
      const signal = (state.riskSignals ?? []).find(item => item.id === resource.id)
      if (!signal) return deny('风险信号不存在。', 'RESOURCE_NOT_FOUND')
      if (signal.volunteerId === actor.id) return deny('被反映的志愿者不能查看自己的风险信号。', 'EXCLUDED_ACTOR')
      return allow()
    }
    case 'read-dispute': {
      const dispute = (state.disputeCases ?? []).find(item => item.id === resource.id)
      if (!dispute) return deny('争议不存在。', 'RESOURCE_NOT_FOUND')
      if (!op) {
        if (actor.role === 'teacher' && hasSchoolSeat(state, actor.id, dispute.schoolId, now)) return allow()
        return deny('只有学校负责人可以查看本校争议。', 'NO_SCHOOL_AUTHORITY')
      }
      return hasPackage(actor, 'matching') || hasPackage(actor, 'safeguarding') || hasPackage(actor, 'privacy')
        ? allow() : deny('没有查看争议的权限。', 'NO_PERMISSION_PACKAGE')
    }
    case 'read-grant': {
      const grant = resource.id ? grantById(state, resource.id) : undefined
      if (!grant) return deny('授权不存在。', 'GRANT_NOT_FOUND')
      if (grant.actorId === actor.id || grant.grantedBy === actor.id) return allow()
      if (op && (hasPackage(actor, 'privacy') || hasPackage(actor, 'accounts'))) return allow()
      return deny('没有查看这条授权的权限。', 'NO_PERMISSION_PACKAGE')
    }
    case 'report-abnormal': {
      if (actor.role !== 'teacher') return deny('只有负责老师可以上报异常。', 'ROLE_NOT_PERMITTED')
      if (!resource.id) return deny('请选择要上报的结对。', 'RESOURCE_NOT_FOUND')
      pair = pairById(state, resource.id)
      if (!pair) return deny('结对不存在。', 'RESOURCE_NOT_FOUND')
      const allowed = teacherScope(state, actor.id, pair.childId, 'protect', now) || teacherScope(state, actor.id, pair.childId, 'paper-delivery', now)
      return allowed ? allow() : deny('没有这位孩子当前的上报授权。', 'NO_ASSIGNMENT')
    }
    case 'open-case': {
      if (op) return hasPackage(actor, 'safeguarding') ? allow() : deny('只有保护岗可以新建个案。', 'NO_PERMISSION_PACKAGE')
      if (actor.role === 'teacher') {
        if (!resource.id) return deny('请选择要开启个案的结对。', 'RESOURCE_NOT_FOUND')
        pair = pairById(state, resource.id)
        if (!pair) return deny('结对不存在。', 'RESOURCE_NOT_FOUND')
        return teacherScope(state, actor.id, pair.childId, 'protect', now) ? allow() : deny('没有这位孩子的保护授权。', 'NO_ASSIGNMENT')
      }
      return deny('当前身份不能新建保护个案。', 'ROLE_NOT_PERMITTED')
    }
    case 'grant-access': {
      if (actor.role === 'teacher') {
        const seatSchool = safeguardingSeat(state, actor.id, now)
        if (!seatSchool) return deny('只有学校负责人可以审批本校敏感访问。', 'NO_SCHOOL_AUTHORITY')
        const resourceSchool = resource.id && (resource.type === 'letter' || resource.type === 'attachment' || resource.type === 'help-case')
          ? targetSchoolId(state, resource.type, resource.id) : undefined
        if (!resourceSchool || resourceSchool !== seatSchool) return deny('学校负责人只能审批本校个案关联的敏感访问。', 'WRONG_SCHOOL')
        return allow()
      }
      if (op) {
        if (!hasPlatformSignature(actor)) return deny('平台侧需要隐私或保护权限。', 'NO_PERMISSION_PACKAGE')
        if (input.purpose === 'safeguarding-case' && !hasPackage(actor, 'privacy')) {
          return hasPackage(actor, 'safeguarding') ? allow() : deny('平台侧需要隐私或保护权限。', 'NO_PERMISSION_PACKAGE')
        }
        return allow()
      }
      return deny('当前身份不能授予访问权限。', 'ROLE_NOT_PERMITTED')
    }
    case 'revoke-access': {
      const grant = resource.id ? grantById(state, resource.id) : undefined
      if (!grant) return deny('授权不存在。', 'GRANT_NOT_FOUND')
      if (grant.grantedBy === actor.id || grant.actorId === actor.id) return allow()
      if (op && (hasPackage(actor, 'privacy') || hasPackage(actor, 'accounts'))) return allow()
      if (actor.role === 'teacher' && safeguardingSeat(state, actor.id, now)) return allow()
      return deny('没有撤销这条授权的权限。', 'NO_PERMISSION_PACKAGE')
    }
    case 'open-emergency-access': {
      if (!(op && hasPackage(actor, 'safeguarding'))) {
        const seat = safeguardingSeat(state, actor.id, now)
        if (!seat) return deny('只有保护岗或学校负责人可以开启紧急破窗。', 'NO_SCHOOL_AUTHORITY')
        const resourceSchool = resource.id && (resource.type === 'letter' || resource.type === 'attachment' || resource.type === 'help-case')
          ? targetSchoolId(state, resource.type, resource.id) : undefined
        if (!resourceSchool || resourceSchool !== seat) return deny('学校负责人只能紧急查看本校的受保护对象。', 'WRONG_SCHOOL')
      }
      if (resource.type !== 'letter' && resource.type !== 'attachment' && resource.type !== 'help-case') return deny('紧急破窗只能针对单个受保护对象。', 'ROLE_NOT_PERMITTED')
      if ((input.reason ?? '').trim().length < 10) return deny('请写明至少 10 字的紧急理由。', 'NOTE_TOO_SHORT')
      const outstanding = (state.accessGrants ?? []).some(item => item.actorId === actor.id && item.emergency && !item.reviewedAt && !item.revokedAt)
      if (outstanding) return deny('你还有未复核的紧急破窗，需先完成复核。', 'EMERGENCY_OUTSTANDING')
      return allow()
    }
    case 'review-emergency-access': {
      if (!op || !hasPackage(actor, 'privacy')) return deny('只有隐私岗可以复核紧急破窗。', 'NO_PERMISSION_PACKAGE')
      const grant = resource.id ? grantById(state, resource.id) : undefined
      if (!grant || !grant.emergency) return deny('这条紧急访问不存在。', 'GRANT_NOT_FOUND')
      if (grant.reviewedAt) return deny('这条紧急访问已经复核。', 'GRANT_NOT_FOUND')
      if (grant.actorId === actor.id || grant.grantedBy === actor.id) return deny('开启者不能复核自己的破窗。', 'BREAK_GLASS_SELF_REVIEW')
      if ((note ?? '').trim().length < 3) return deny('请写下至少 3 字的复核结论。', 'NOTE_TOO_SHORT')
      return allow()
    }
    case 'triage-help-case':
    case 'update-help-report': {
      const helpCase = resource.id ? helpCaseById(state, resource.id) : undefined
      if (!helpCase) return deny('保护个案不存在。', 'RESOURCE_NOT_FOUND')
      if (isExcluded(helpCase, actor.id)) return deny('被反映人或回避人员不能填写报告。', 'EXCLUDED_ACTOR')
      if (action === 'update-help-report' && op && hasPackage(actor, 'privacy')) return allow()
      if (op && hasPackage(actor, 'safeguarding') && [helpCase.ownerId, helpCase.backupOwnerId].includes(actor.id)) return allow()
      if (actor.role === 'teacher' && helpCase.schoolOwnerId === actor.id && safeguardingSeat(state, actor.id, now)) return allow()
      return deny('没有填写这个个案报告的权限。', 'NO_ASSIGNMENT')
    }
    case 'escalate-help-case': {
      const helpCase = resource.id ? helpCaseById(state, resource.id) : undefined
      if (!helpCase) return deny('保护个案不存在。', 'RESOURCE_NOT_FOUND')
      if (op && hasPackage(actor, 'safeguarding')) return allow()
      return deny('只有保护岗可以升级个案。', 'NO_PERMISSION_PACKAGE')
    }
    case 'resolve-help-case': {
      const helpCase = resource.id ? helpCaseById(state, resource.id) : undefined
      if (!helpCase) return deny('保护个案不存在。', 'RESOURCE_NOT_FOUND')
      if (isExcluded(helpCase, actor.id)) return deny('被反映人不能关闭这个个案。', 'EXCLUDED_ACTOR')
      const assigned = op && hasPackage(actor, 'safeguarding') && [helpCase.ownerId, helpCase.backupOwnerId].includes(actor.id)
        || actor.role === 'teacher' && helpCase.schoolOwnerId === actor.id && !!safeguardingSeat(state, actor.id, now)
      if (!assigned) return deny('没有关闭这个个案的权限。', 'NO_ASSIGNMENT')
      if (!helpCase.triagedAt || !helpCase.triagedBy || !helpCase.triageNote) return deny('保护个案必须先完成分诊，再记录处置与结案。', 'REPORT_FIELDS_INCOMPLETE')
      if (!helpReportComplete(helpCase)) return deny('高严重度个案必须先完成报告记录或独立免报告复核。', 'REPORT_FIELDS_INCOMPLETE')
      if ((note ?? '').trim().length < 3) return deny('请记录至少 3 字的处理情况。', 'NOTE_TOO_SHORT')
      return allow()
    }
    case 'open-dispute': {
      if (op) return hasPackage(actor, 'matching') || hasPackage(actor, 'safeguarding') ? allow() : deny('只有结对岗或保护岗可以发起争议。', 'NO_PERMISSION_PACKAGE')
      if (actor.role === 'teacher') {
        const schoolId = resource.id ?? ''
        return hasSchoolSeat(state, actor.id, schoolId, now) ? allow() : deny('只有学校负责人可以发起争议。', 'NO_SCHOOL_AUTHORITY')
      }
      return deny('当前身份不能发起争议。', 'ROLE_NOT_PERMITTED')
    }
    case 'decide-dispute': {
      const dispute = (state.disputeCases ?? []).find(item => item.id === resource.id)
      if (!dispute) return deny('争议不存在。', 'RESOURCE_NOT_FOUND')
      if (dispute.status === 'decided') return deny('争议已经裁决。', 'OPEN_DISPUTE')
      if (dispute.caseId) {
        const linked = helpCaseById(state, dispute.caseId)
        if (linked && isExcluded(linked, actor.id)) return deny('你需要回避这个争议。', 'EXCLUDED_ACTOR')
      }
      if (actor.role === 'teacher') {
        if (!hasSchoolSeat(state, actor.id, dispute.schoolId, now)) return deny('只有学校负责人可以签名。', 'NO_SCHOOL_AUTHORITY')
        return allow()
      }
      if (op) {
        if (dispute.topic === 'data' && hasPackage(actor, 'privacy')) return allow()
        if (hasPackage(actor, 'safeguarding') && onDuty(state, actor.id, now, 'platform')) return allow()
        if (hasPackage(actor, 'matching')) return deny('结对岗只能发起争议，平台签名需当值保护岗。', 'DUTY_NOT_ACTIVE')
        return deny('平台签名需当值保护岗。', 'DUTY_NOT_ACTIVE')
      }
      return deny('当前身份不能签署争议。', 'ROLE_NOT_PERMITTED')
    }
    case 'review-risk-signal': {
      if (!op || !hasPackage(actor, 'safeguarding')) return deny('只有保护岗可以复核风险信号。', 'NO_PERMISSION_PACKAGE')
      const signal = (state.riskSignals ?? []).find(item => item.id === resource.id)
      if (!signal) return deny('风险信号不存在。', 'RESOURCE_NOT_FOUND')
      if (signal.volunteerId === actor.id) return deny('被反映的志愿者不能复核自己的信号。', 'EXCLUDED_ACTOR')
      if (signal.status === 'actioned' && (note ?? '').trim().length < 3) return deny('请记录处置说明。', 'NOTE_TOO_SHORT')
      if (note !== undefined && (note ?? '').trim().length < 2) return deny('请记录复核结论。', 'NOTE_TOO_SHORT')
      return allow()
    }
    case 'complete-support-task': {
      const task = (state.supportTasks ?? []).find(item => item.id === resource.id)
      if (!task) return deny('支持任务不存在。', 'RESOURCE_NOT_FOUND')
      if (!(note ?? '').trim().length) return deny('请记录支持情况。', 'NOTE_TOO_SHORT')
      if (task.ownerTeacherId && task.ownerTeacherId === actor.id) return allow()
      if (actor.role === 'teacher' && task.pairId) {
        pair = pairById(state, task.pairId)
        if (pair && teacherScope(state, actor.id, pair.childId, 'status', now)) return allow()
      }
      if (op && hasPackage(actor, 'safeguarding')) return allow()
      return deny('只有负责老师或保护岗可以完成这项支持任务。', 'NO_ASSIGNMENT')
    }
    case 'complete-training': {
      if (actor.role !== 'volunteer') return deny('只有志愿者需要完成培训。', 'ROLE_NOT_PERMITTED')
      if (!trainingFor(state, actor.id)) return allow()
      return deny('当前版本培训已完成。', 'NOTE_TOO_SHORT')
    }
    case 'match': {
      if (!op || !(hasPackage(actor, 'matching') || hasPackage(actor, 'administration'))) return deny('只有结对岗可以建立结对。', 'NO_PERMISSION_PACKAGE')
      return allow()
    }
    case 'write-letter':
    case 'submit-letter': {
      if (!resource.id) return deny('请先选择结对。', 'RESOURCE_NOT_FOUND')
      pair = pairById(state, resource.id)
      if (!pair) return deny('结对不存在。', 'RESOURCE_NOT_FOUND')
      if (actor.role === 'volunteer') {
        if (!trainingFor(state, actor.id)) return deny('请先完成当前版本的行为边界培训，再寄出信件。', 'TRAINING_REQUIRED')
        return allow()
      }
      if (actor.role === 'child') return allow()
      if (actor.role === 'teacher') return teacherScope(state, actor.id, pair.childId, 'capture', now) ? allow() : deny('没有这位孩子当前的纸信协助授权。', 'NO_ASSIGNMENT')
      return deny('没有写这封信的权限。', 'ROLE_NOT_PERMITTED')
    }
    case 'pause-volunteer':
      return op && hasPackage(actor, 'safeguarding') ? allow() : deny('只有保护岗可以暂停志愿者的全部结对。', 'NO_PERMISSION_PACKAGE')
    case 'resume-pair': {
      pair = resource.id ? pairById(state, resource.id) : undefined
      if (!pair) return deny('结对不存在。', 'RESOURCE_NOT_FOUND')
      const current = pair
      if (current.status === 'ended') return deny('陪伴已结束。', 'PAIR_NOT_ACTIVE')
      if (!op) return deny('恢复结对需要平台结对岗处理。', 'NO_PERMISSION_PACKAGE')
      if (safetySuspension(current) || (state.disputeCases ?? []).some(item => item.pairId === current.id && item.status !== 'decided')) {
        const dispute = disputeForPair(state, current.id)
        if (!dispute || dispute.status !== 'decided') return deny('安全暂停需争议裁决后才能恢复。', 'OPEN_DISPUTE')
        if (!dispute.schoolDecisionBy || !dispute.platformDecisionBy) return deny('安全暂停需学校与平台两个签名确认后才能恢复。', 'SECOND_SIGNATURE_REQUIRED')
        if (dispute.schoolDecisionBy === dispute.platformDecisionBy) return deny('学校与平台签名必须由不同负责人完成。', 'SIGNATURE_CONFLICT')
      }
      return hasPackage(actor, 'matching') || hasPackage(actor, 'administration') ? allow() : deny('只有结对岗可以恢复结对。', 'NO_PERMISSION_PACKAGE')
    }
    case 'record-delivery': {
      if (actor.role !== 'teacher') return deny('请使用负责收发的老师账号。', 'ROLE_NOT_PERMITTED')
      if (!resource.id) return deny('请选择信件。', 'RESOURCE_NOT_FOUND')
      const letter = letterById(state, resource.id)
      pair = letter && pairById(state, letter.pairId)
      if (!letter || !pair) return deny('信件不存在。', 'RESOURCE_NOT_FOUND')
      const current = pair
      if (current.status !== 'active') return deny('这组陪伴正在暂停，不能继续交付。', 'SAFETY_PAUSE')
      if ((state.disputeCases ?? []).some(item => item.pairId === current.id && item.status !== 'decided')) return deny('争议未裁决期间不能继续交付。', 'OPEN_DISPUTE')
      return teacherScope(state, actor.id, current.childId, 'paper-delivery', now) ? allow() : deny('没有这些纸信的当前交付授权。', 'NO_ASSIGNMENT')
    }
    default: return deny('不支持的业务操作。', 'ROLE_NOT_PERMITTED')
  }
}

/** Convenience wrapper matching the reason-first shape used by pages. */
export function explain(decision: PolicyDecision): string | undefined {
  return decision.decision === 'deny' ? decision.reason : undefined
}
