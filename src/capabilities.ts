import type { AppState, Person } from './types'
import { authorize, onDuty, hasPackage, hasSchoolSeat, trainingFor, type PolicyAction, type PolicyPurpose, type PolicyResource } from './policy'

export interface Capabilities {
  canReportAbnormal: boolean
  canOpenCase: boolean
  canApproveSensitive: boolean
  canBreakGlass: boolean
  canReviewBreakGlass: boolean
  canDecideDispute: boolean
  canOpenDispute: boolean
  canReviewRiskSignal: boolean
  canCompleteSupportTask: boolean
  canCompleteTraining: boolean
  canViewSystemCheck: boolean
  canManagePairs: boolean
  canManageTraining: boolean
  canSeeDeliveryActions: boolean
  canWriteLetter: boolean
  trainingRequired: boolean
}

const check = (actor: Person, state: AppState, action: PolicyAction, resource: PolicyResource, purpose: PolicyPurpose, now: string, note?: string) =>
  authorize({ actor, action, resource, purpose, state, now, note }).decision === 'allow'

export function capabilitiesFor(actor: Person, state: AppState, now: string): Capabilities {
  const pair = state.pairs.find(item => item.childId === actor.id || item.volunteerId === actor.id) ?? state.pairs[0]
  const pairResource = (): PolicyResource => pair ? { type: 'pair', id: pair.id } : { type: 'none' }
  return {
    canReportAbnormal: check(actor, state, 'report-abnormal', pairResource(), 'safeguarding-case', now),
    canOpenCase: check(actor, state, 'open-case', pairResource(), 'safeguarding-case', now),
    canApproveSensitive: check(actor, state, 'grant-access', { type: 'none', id: pair?.id ?? '' }, 'safeguarding-case', now),
    canBreakGlass: check(actor, state, 'open-emergency-access', { type: 'letter', id: (state.letters[0]?.id ?? 'none') }, 'emergency-risk', now, '需要紧急查看这封合成信件'),
    canReviewBreakGlass: (state.accessGrants ?? []).some(item => item.emergency && !item.reviewedAt && item.actorId !== actor.id) && hasPackage(actor, 'privacy'),
    canDecideDispute: (state.disputeCases ?? []).some(item => item.status !== 'decided'
      && (actor.role === 'teacher'
        ? hasSchoolSeat(state, actor.id, item.schoolId, now)
        : check(actor, state, 'decide-dispute', { type: 'dispute', id: item.id }, 'pair-management', now))),
    canOpenDispute: check(actor, state, 'open-dispute', { type: 'dispute', id: actor.schoolId ?? 'school-a' }, 'pair-management', now),
    canReviewRiskSignal: (state.riskSignals ?? []).some(item => item.status === 'open' && check(actor, state, 'review-risk-signal', { type: 'risk-signal', id: item.id }, 'content-review', now, '待复核')),
    canCompleteSupportTask: (state.supportTasks ?? []).some(item => item.status === 'open' && check(actor, state, 'complete-support-task', { type: 'support-task', id: item.id }, 'safeguarding-case', now, '已联系孩子并记录')),
    canCompleteTraining: actor.role === 'volunteer' && !trainingFor(state, actor.id),
    canViewSystemCheck: hasPackage(actor, 'privacy'),
    canManagePairs: hasPackage(actor, 'matching') || hasPackage(actor, 'administration'),
    canManageTraining: hasPackage(actor, 'accounts') || hasPackage(actor, 'safeguarding'),
    canSeeDeliveryActions: actor.role === 'teacher' && state.pairs.some(item => item.status === 'active' && check(actor, state, 'record-delivery', { type: 'letter', id: state.letters.find(letter => letter.pairId === item.id)?.id ?? 'none' }, 'deliver-print', now)),
    canWriteLetter: check(actor, state, actor.role === 'volunteer' ? 'submit-letter' : 'write-letter', pairResource(), actor.role === 'volunteer' ? 'home-overview' : 'child-assisted-capture', now),
    trainingRequired: actor.role === 'volunteer' && !trainingFor(state, actor.id),
  }
}

export { onDuty }
