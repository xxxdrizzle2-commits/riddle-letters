import type { AppState } from './types'
import { helpReportComplete, teacherScope } from './policy'

export type InvariantRule =
  | 'PAIR_VALIDITY' | 'LETTER_IDENTITY' | 'PAPER_EVENT_ORDER'
  | 'CASE_REPORT_COMPLETE' | 'EXCLUSION_CLEAN'
  | 'GRANT_LIFECYCLE' | 'EMERGENCY_REVIEWED' | 'DELIVERY_DURING_SAFETY_PAUSE'
  | 'PAIR_UNIQUE' | 'PAUSE_METADATA' | 'RISK_SIGNAL_RESOLVED'

export interface InvariantViolation {
  rule: InvariantRule
  severity: 'high' | 'medium'
  message: string
  refs: string[]
}

const DAY = 86_400_000

export function checkInvariants(state: AppState): InvariantViolation[] {
  const violations: InvariantViolation[] = []
  const add = (rule: InvariantRule, severity: 'high' | 'medium', message: string, refs: string[]) => violations.push({ rule, severity, message, refs })
  const person = (id?: string) => state.people.find(item => item.id === id)
  const now = state.clock

  for (const pair of state.pairs.filter(item => item.status === 'active')) {
    const child = person(pair.childId), volunteer = person(pair.volunteerId), teacher = person(pair.teacherId)
    const refs = [pair.id]
    if (!child || child.role !== 'child' || child.accountStatus === 'disabled') add('PAIR_VALIDITY', 'high', '进行中的结对缺少有效的孩子账号。', refs)
    else if (!volunteer || volunteer.role !== 'volunteer' || volunteer.accountStatus === 'disabled') add('PAIR_VALIDITY', 'high', '进行中的结对缺少有效的志愿者账号。', refs)
    if (!teacher || !teacherScope(state, pair.teacherId, pair.childId, 'status', now)) add('PAIR_VALIDITY', 'high', '进行中的结对缺少未过期的负责老师指派。', refs)
    if (pair.schoolId && state.schools?.length && !state.schools.some(school => school.id === pair.schoolId && school.status === 'active')) add('PAIR_VALIDITY', 'high', '结对所属学校不存在或已暂停。', refs)
  }

  for (const letter of state.letters) {
    const pair = state.pairs.find(item => item.id === letter.pairId)
    if (!pair) { add('LETTER_IDENTITY', 'high', '信件引用了不存在的结对。', [letter.id]); continue }
    const expected = letter.authorId === pair.childId ? pair.volunteerId : letter.authorId === pair.volunteerId ? pair.childId : undefined
    const recipient = letter.recipientId ?? expected
    if (!expected) add('LETTER_IDENTITY', 'high', '信件作者不是该结对的任何一端。', [letter.id, pair.id])
    else if (recipient !== expected) add('LETTER_IDENTITY', 'high', '信件收件人与结对中的另一端不一致。', [letter.id, pair.id])
  }

  const rank: Record<string, number> = { printed: 1, 'handed-to-child': 2, 'witnessed-read': 3 }
  for (const letter of state.letters) {
    if ((letter.deliveryRoute ?? state.pairs.find(item => item.id === letter.pairId)?.channel) === 'online') continue
    const events = (state.deliveryEvents ?? []).filter(item => item.letterId === letter.id && item.type in rank).sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    if (!events.length) continue
    const approvedAt = letter.moderation === 'approved'
      ? (state.reviews.filter(item => item.letterId === letter.id && item.decision === 'approved').map(item => Date.parse(item.createdAt)).sort((a, b) => a - b)[0] ?? Date.parse(letter.updatedAt))
      : undefined
    if (approvedAt === undefined) add('PAPER_EVENT_ORDER', 'high', '纸质信件出现了交付事件，但从未审核通过。', [letter.id])
    else {
      const printed = events.find(item => item.type === 'printed')
      if (printed && Date.parse(printed.at) < approvedAt) add('PAPER_EVENT_ORDER', 'high', '打印记录早于审核通过时间。', [letter.id, printed.id])
    }
    let highest = 0
    for (const event of events) {
      const value = rank[event.type]
      if (value > highest + 1) add('PAPER_EVENT_ORDER', 'high', `纸质事件跳过了前置步骤：${event.type}。`, [letter.id, event.id])
      highest = Math.max(highest, value)
    }
  }

  for (const helpCase of state.helpCases ?? []) {
    if (helpCase.status === 'resolved' && (!helpCase.triagedAt || !helpCase.triagedBy || !helpCase.triageNote)) {
      add('CASE_REPORT_COMPLETE', 'high', '保护个案未经分诊就已结案。', [helpCase.id])
    }
    if (helpCase.status === 'resolved' && helpCase.severity === 'high' && helpCase.reportRequired) {
      if (!helpReportComplete(helpCase)) add('CASE_REPORT_COMPLETE', 'high', '高严重度个案已结案，但报告字段不完整。', [helpCase.id])
    }
  }

  for (const helpCase of state.helpCases ?? []) {
    for (const holder of [helpCase.ownerId, helpCase.backupOwnerId, helpCase.schoolOwnerId]) {
      if (!holder) continue
      if (helpCase.excludedActorIds.includes(holder) || helpCase.reportedPersonId === holder) add('EXCLUSION_CLEAN', 'high', '个案的负责人位于回避集合中。', [helpCase.id, holder])
    }
  }

  for (const grant of state.accessGrants ?? []) {
    if (grant.revokedAt) continue
    if (!grant.emergency && !grant.approvedBy) add('GRANT_LIFECYCLE', 'medium', '授权缺少第二签名却仍在生效。', [grant.id])
    if (!grant.emergency && ['letter', 'attachment', 'help-case'].includes(grant.targetType) && !grant.caseId) add('GRANT_LIFECYCLE', 'high', '敏感访问授权没有关联保护个案。', [grant.id])
    if (!grant.emergency && Date.parse(grant.expiresAt) <= Date.parse(now)) add('GRANT_LIFECYCLE', 'medium', '授权已过期但仍未撤销。', [grant.id])
  }
  for (const grant of state.accessGrants ?? []) {
    if (!grant.emergency || grant.reviewedAt || grant.revokedAt) continue
    if (grant.reviewDueAt && Date.parse(grant.reviewDueAt) < Date.parse(now)) add('EMERGENCY_REVIEWED', 'high', '紧急破窗超过了复核时限仍未复核。', [grant.id])
  }

  for (const pair of state.pairs) {
    for (const interval of pair.pauseHistory ?? []) {
      if (!interval.kind || interval.kind !== 'pause') continue
      const end = interval.end ? Date.parse(interval.end) : Date.parse(now)
      for (const event of (state.deliveryEvents ?? []).filter(item => item.type === 'handed-to-child')) {
        const letter = state.letters.find(item => item.id === event.letterId)
        if (letter?.pairId !== pair.id) continue
        if (Date.parse(event.at) > Date.parse(interval.start) && Date.parse(event.at) < end) add('DELIVERY_DURING_SAFETY_PAUSE', 'high', '暂停期间仍记录了新的纸质交付。', [pair.id, event.id])
      }
    }
  }

  for (const child of new Set(state.pairs.filter(item => item.status !== 'ended').map(item => `${item.childId}:${item.volunteerId}`))) {
    const duplicates = state.pairs.filter(item => item.status !== 'ended' && `${item.childId}:${item.volunteerId}` === child)
    if (duplicates.length > 1) add('PAIR_UNIQUE', 'high', '同一对孩子与志愿者存在重复的未结束结对。', duplicates.map(item => item.id))
  }

  for (const pair of state.pairs.filter(item => item.status === 'paused')) {
    if (!pair.pauseReason || !pair.pauseOwnerId || !pair.pauseReviewAt) add('PAUSE_METADATA', 'high', '暂停缺少原因、负责人或复核日期。', [pair.id])
  }

  for (const signal of state.riskSignals ?? []) {
    if (signal.status === 'open' && Date.parse(now) - Date.parse(signal.createdAt) > 3 * DAY) add('RISK_SIGNAL_RESOLVED', 'high', '高风险信号超过三天仍无结论。', [signal.id])
    if (['actioned', 'dismissed'].includes(signal.status) && (!signal.reviewedBy || !signal.action)) add('RISK_SIGNAL_RESOLVED', 'medium', '风险信号缺少复核人或处置结论。', [signal.id])
  }

  return violations
}
