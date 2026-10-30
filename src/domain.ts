import type { AppState, Attachment, Command, DeliveryRoute, HelpCase, Letter, Person, ReplyTask, Riddle, TeacherScope, TimeInterval } from './types'
import { TRAINING_VERSION } from './types'
import { authorize, teacherScope, eligibleHelpOwner, hasPackage, trainingFor } from './policy'
import { syntheticDigest } from './evidence'

const DAY = 86_400_000
export const riddles: Riddle[] = [
  { id: 'r1', question: '千条线，万条线，落到水里看不见。', hint: '带上小伞去找它。', answer: '雨', category: '大自然' },
  { id: 'r2', question: '小小一座桥，雨后天上飘。', hint: '它有好几种颜色。', answer: '彩虹', category: '大自然' },
  { id: 'r3', question: '白天躲起来，夜晚亮晶晶。', hint: '抬头看看晴朗的夜空。', answer: '星星', category: '大自然' },
  { id: 'r4', question: '一只小船两头尖，白天不见夜里现。', hint: '它的样子每天有一点变化。', answer: '月亮', category: '大自然' },
  { id: 'r5', question: '有面没有口，有脚没有手，虽然四只脚，自己不会走。', hint: '你可以坐在它旁边写信。', answer: '桌子', category: '身边物品' },
  { id: 'r6', question: '小小身体穿绿衣，轻轻一跳到田里，唱起歌来呱呱呱。', hint: '它是田里的小帮手。', answer: '青蛙', category: '小动物' },
  { id: 'r7', question: '远看像把伞，近看是一团，雨后冒出头，长在树根旁。', hint: '野外遇到它，可不能随便采来吃。', answer: '蘑菇', category: '大自然' },
  { id: 'r8', question: '薄薄一片纸，装着许多话，越过山和水，走到朋友家。', hint: '我们正在用它分享小发现。', answer: '信', category: '身边物品' },
  { id: 'r9', question: '一朵花儿真奇怪，晴天不开雨天开。', hint: '它帮你挡住雨滴。', answer: '雨伞', category: '身边物品' },
  { id: 'r10', question: '小小船儿水中游，尾巴摇摇点点头。', hint: '它用鳃呼吸。', answer: '鱼', category: '小动物' },
  { id: 'r11', question: '身穿花衣裳，爱在花间忙，飞来又飞去，翅膀像花瓣。', hint: '它小时候常常是一条毛毛虫。', answer: '蝴蝶', category: '小动物' },
  { id: 'r12', question: '没脚也会跑，没嘴也会叫，走过树林时，树叶把手招。', hint: '闭上眼睛，你也能感觉到它。', answer: '风', category: '大自然' },
]

export function createSeedState(): AppState {
  return {
    id: 'main', version: 1, clock: '2026-10-19T09:00:00+08:00',
    people: [
      { id: 'c1', role: 'child', schoolId: 'school-a', nickname: '小禾', subtitle: '喜欢收集秋天的小发现', avatar: '🌱', interests: ['画画', '植物', '猜谜'] },
      { id: 'c2', role: 'child', schoolId: 'school-b', nickname: '阿川', subtitle: '想知道更多关于星空的事', avatar: '⛵', interests: ['星空', '折纸', '足球'] },
      { id: 'c3', role: 'child', schoolId: 'school-a', nickname: '芽芽', subtitle: '等待认识一位书信伙伴', avatar: '🌻', interests: ['故事', '小动物'] },
      { id: 'v1', role: 'volunteer', nickname: '林语', subtitle: '大学生志愿者 · 爱读故事和散步', avatar: '🍃', interests: ['阅读', '植物'] },
      { id: 'v2', role: 'volunteer', nickname: '许舟', subtitle: '大学生志愿者 · 喜欢仰望星空', avatar: '🪁', interests: ['天文', '运动'] },
      { id: 'v3', role: 'volunteer', nickname: '苏宁', subtitle: '大学生志愿者 · 已完成本期培训', avatar: '🌼', interests: ['故事', '小动物'], accountStatus: 'active' },
      { id: 'v4', role: 'volunteer', nickname: '安然', subtitle: '大学生志愿者 · 尚未完成本期培训', avatar: '🌿', interests: ['手工'], volunteerApproved: true, accountStatus: 'active' },
      { id: 't1', role: 'teacher', schoolId: 'school-a', nickname: '陈老师', subtitle: '协助小禾和芽芽收发书信 · 演示学校保护负责人', avatar: '📚', interests: [] },
      { id: 't2', role: 'teacher', schoolId: 'school-b', nickname: '周老师', subtitle: '协助阿川收发纸质书信 · 演示学校保护负责人', avatar: '📖', interests: [] },
      { id: 't3', role: 'teacher', schoolId: 'school-a', nickname: '林老师', subtitle: '合成替补 · 演示学校甲保护备岗', avatar: '📘', interests: [] },
      { id: 't4', role: 'teacher', schoolId: 'school-b', nickname: '何老师', subtitle: '合成替补 · 演示学校乙保护备岗', avatar: '📗', interests: [] },
      { id: 'op1', role: 'operator', nickname: '小满', subtitle: '陪伴计划运营 · 守护每一次交流', avatar: '✉️', interests: [], permissions: ['review', 'safeguarding', 'administration'] },
      { id: 'op2', role: 'operator', nickname: '独立保护值守', subtitle: '合成身份 · 独立受理涉及运营的求助', avatar: '🛡️', interests: [], accountStatus: 'active', permissions: ['safeguarding', 'independentSafeguarding'] },
      { id: 'op3', role: 'operator', nickname: '隐私与结对岗', subtitle: '合成身份 · 隐私复核与结对待办', avatar: '🗂️', interests: [], accountStatus: 'active', permissions: ['privacy', 'accounts', 'matching'] },
    ],
    schools: [{ id: 'school-a', name: '演示学校甲', status: 'active' }, { id: 'school-b', name: '演示学校乙', status: 'active' }],
    teacherAssignments: [
      { id: 'assignment-c1', schoolId: 'school-a', teacherId: 't1', childId: 'c1', scope: ['status', 'capture', 'paper-delivery', 'protect'], startsAt: '2026-09-01T00:00:00+08:00', approvedBy: 'synthetic-school-a' },
      { id: 'assignment-c3', schoolId: 'school-a', teacherId: 't1', childId: 'c3', scope: ['status', 'capture', 'paper-delivery', 'protect'], startsAt: '2026-09-01T00:00:00+08:00', approvedBy: 'synthetic-school-a' },
      { id: 'assignment-c2', schoolId: 'school-b', teacherId: 't2', childId: 'c2', scope: ['status', 'capture', 'paper-delivery', 'protect'], startsAt: '2026-09-01T00:00:00+08:00', approvedBy: 'synthetic-school-b' },
    ],
    pairs: [
      { id: 'p1', childId: 'c1', volunteerId: 'v1', teacherId: 't1', schoolId: 'school-a', channel: 'online', status: 'active', startedAt: '2026-09-01T09:00:00+08:00' },
      { id: 'p2', childId: 'c2', volunteerId: 'v2', teacherId: 't2', schoolId: 'school-b', channel: 'paper', status: 'active', startedAt: '2026-09-01T09:00:00+08:00' },
      { id: 'p3', childId: 'c1', volunteerId: 'v2', teacherId: 't1', schoolId: 'school-a', channel: 'online', status: 'active', startedAt: '2026-09-10T09:00:00+08:00' },
      { id: 'p4', childId: 'c2', volunteerId: 'v1', teacherId: 't2', schoolId: 'school-b', channel: 'online', status: 'paused', startedAt: '2026-09-10T09:00:00+08:00', pausedAt: '2026-10-18T09:00:00+08:00', pauseReason: '保护性暂停：等待保护岗核实跨结对的相似话术。', pauseOwnerId: 'op2', pauseReviewAt: '2026-10-25T09:00:00+08:00', pauseHistory: [{ start: '2026-10-18T09:00:00+08:00', kind: 'pause', sourceId: 'volunteer:v1' }] },
    ],
    letters: [
      { id: 'l1', pairId: 'p1', authorId: 'v1', createdBy: 'v1', title: '把秋天装进信封里', body: '小禾，你好呀！\n\n今天散步时，我发现一片叶子很像一只小小的手掌。树叶的边缘变成了金黄色，中间还留着一点绿。我把它夹进了书里，想把这个小发现告诉你。\n\n你上次画的那棵树，我很喜欢。它的枝条伸向不同的方向，像是在认真听风说话。最近你有没有见到什么有意思的颜色？可以画下来，也可以慢慢写给我。\n\n这次还带来一道小谜语。猜不出来也没关系，我们下封信一起聊。愿你有一个自在的下午。\n\n你的书信伙伴 林语', riddleId: 'r1', moderation: 'approved', createdAt: '2026-10-16T09:00:00+08:00', updatedAt: '2026-10-17T09:00:00+08:00' },
      { id: 'l2', pairId: 'p2', authorId: 'v2', createdBy: 'v2', title: '今晚的月亮像一艘小船', body: '阿川，你好！\n\n我收到了你折的小纸船，谢谢你愿意和我分享。昨天夜里我看到弯弯的月亮，忽然觉得它也像一只小船，安静地停在天空里。\n\n你问星星为什么闪，我找了资料，原来星光穿过流动的空气时，会有一点变化。下次我们可以各自画一张夜空，不必一模一样，画自己看到的就很好。\n\n这封信附了一道月亮的谜语，想看看你有什么有趣的答案。\n\n你的伙伴 许舟', riddleId: 'r4', moderation: 'approved', createdAt: '2026-10-17T09:00:00+08:00', updatedAt: '2026-10-18T09:00:00+08:00' },
      { id: 'l3', pairId: 'p1', authorId: 'v1', createdBy: 'v1', title: '一颗种子的慢慢旅行', body: '小禾，今天想和你分享一个关于种子的发现。楼下花盆里冒出了一片小叶子，我准备每天看一眼，把它的变化记下来。你最近在窗边看到了什么呢？', riddleId: 'r12', moderation: 'draft', createdAt: '2026-10-19T08:00:00+08:00', updatedAt: '2026-10-19T08:00:00+08:00' },
      { id: 'l4', pairId: 'p2', authorId: 'v2', createdBy: 'v2', title: '你的纸船，开到了哪里？', body: '阿川，你好！上次你说想做一艘更大的纸船，我也试着折了一只。第一次没有折好，第二次才慢慢找到诀窍。原来有些事情，试一试，再歇一歇，会更有意思。愿意告诉我你的新发现吗？', riddleId: 'r10', moderation: 'pending', createdAt: '2026-10-18T09:00:00+08:00', updatedAt: '2026-10-18T09:00:00+08:00' },
      { id: 'l5', pairId: 'p1', authorId: 'v1', createdBy: 'v1', title: '我们交换一个小故事吧', body: '小禾，你好！这周我在图书馆看到一本很有趣的故事书，讲一只喜欢问问题的小狐狸。我想知道你最近读到了什么故事，如果愿意，可以把最喜欢的一段分享给我。', moderation: 'returned', moderationNote: '请把“每周都要写完”的表达调整为更轻松的邀请，给伙伴充分的选择和时间。', createdAt: '2026-10-15T09:00:00+08:00', updatedAt: '2026-10-16T09:00:00+08:00' },
      { id: 'l6', pairId: 'p2', authorId: 'v2', createdBy: 'v2', title: '慢慢来，纸船也会到岸', body: '阿川，你好呀！\n\n收到你的画，我很开心。画里的河有好多种蓝色，每一种都很特别。我最近也在试着用不同的颜色画同一棵树，发现每一天看它，都会有不一样的感觉。\n\n如果你有想分享的小发现，随时可以写给我。不知道从哪里写起，也可以先画一笔。我们慢慢来。\n\n你的伙伴 许舟', moderation: 'approved', createdAt: '2026-09-30T09:00:00+08:00', updatedAt: '2026-10-01T09:00:00+08:00' },
    ],
    deliveries: [
      { letterId: 'l1', deliveredAt: '2026-10-17T09:00:00+08:00' },
      { letterId: 'l2' },
      { letterId: 'l6', printedAt: '2026-10-01T08:00:00+08:00', deliveredAt: '2026-10-01T09:00:00+08:00' },
    ],
    tasks: [
      { id: 'task-l1', letterId: 'l1', pairId: 'p1', dueAt: '2026-10-31T09:00:00+08:00', status: 'awaiting' },
      { id: 'task-l6', letterId: 'l6', pairId: 'p2', dueAt: '2026-10-15T09:00:00+08:00', status: 'awaiting' },
    ],
    reviews: [{ id: 'review-l5', letterId: 'l5', operatorId: 'op1', decision: 'returned', note: '请把“每周都要写完”的表达调整为更轻松的邀请，给伙伴充分的选择和时间。', createdAt: '2026-10-16T09:00:00+08:00' }],
    followups: [], deliveryEvents: [], manuscriptAssets: [], ocrRuns: [], attachments: [],
    schoolAuthorities: [
      { id: 'authority-a', schoolId: 'school-a', userId: 't1', kind: 'safeguarding-lead', backupUserId: 't3', startsAt: '2026-09-01T00:00:00+08:00', approvedBy: 'synthetic-school-a' },
      { id: 'authority-b', schoolId: 'school-b', userId: 't2', kind: 'safeguarding-lead', backupUserId: 't4', startsAt: '2026-09-01T00:00:00+08:00', approvedBy: 'synthetic-school-b' },
    ],
    accessGrants: [
      { id: 'grant-reviewed', actorId: 't1', targetType: 'letter', targetId: 'l1', purpose: 'emergency-risk', reason: '合成演练：核对一封已送达纸信的落款时间。', grantedBy: 't1', startsAt: '2026-10-19T07:00:00+08:00', expiresAt: '2026-10-19T08:00:00+08:00', emergency: true, reviewDueAt: '2026-10-19T09:00:00+08:00', reviewedAt: '2026-10-19T08:30:00+08:00', reviewedBy: 'op2' },
      { id: 'grant-pending', actorId: 't2', targetType: 'help-case', targetId: 'case-1', purpose: 'emergency-risk', reason: '合成演练：需要核实涉及本校孩子的求助线索。', grantedBy: 't2', startsAt: '2026-10-19T08:00:00+08:00', expiresAt: '2026-10-19T10:00:00+08:00', emergency: true, reviewDueAt: '2026-10-20T08:00:00+08:00' },
    ],
    evidenceSnapshots: [],
    riskSignals: [
      { id: 'risk-1', volunteerId: 'v1', pairIds: ['p1', 'p4'], letterIds: ['l1', 'l4'], kind: 'duplicate-script', severity: 'high', status: 'open', note: '两组合成信件出现相似话术，等待保护岗核实。', createdAt: '2026-10-18T09:00:00+08:00' },
    ],
    disputeCases: [
      { id: 'dispute-1', schoolId: 'school-b', topic: 'pause', pairId: 'p4', openedBy: 't2', openedAt: '2026-10-18T10:00:00+08:00', status: 'joint-review', schoolDecisionBy: 't2' },
    ],
    supportTasks: [],
    dutyShifts: [
      { id: 'duty-platform', scope: 'platform', userId: 'op1', backupUserId: 'op2', startsAt: '2026-10-19T00:00:00+08:00', endsAt: '2026-10-20T00:00:00+08:00' },
      { id: 'duty-school-a', scope: 'school', schoolId: 'school-a', userId: 't1', backupUserId: 't3', startsAt: '2026-10-19T00:00:00+08:00', endsAt: '2026-10-20T00:00:00+08:00' },
      { id: 'duty-school-b', scope: 'school', schoolId: 'school-b', userId: 't2', backupUserId: 't4', startsAt: '2026-10-19T00:00:00+08:00', endsAt: '2026-10-20T00:00:00+08:00' },
    ],
    trainingRecords: [
      { id: 'training-v1', volunteerId: 'v1', version: '2026-10-v1', completedAt: '2026-09-15T09:00:00+08:00' },
      { id: 'training-v2', volunteerId: 'v2', version: '2026-10-v1', completedAt: '2026-09-15T09:00:00+08:00' },
      { id: 'training-v3', volunteerId: 'v3', version: '2026-10-v1', completedAt: '2026-09-15T09:00:00+08:00' },
    ],
    planPolicies: [{ id: 'main', childMaxActivePairs: 2, volunteerMaxActivePairs: 2, newPairCooldownDays: 7 }],
    helpCases: [
      { id: 'case-1', requesterId: 'c3', reportedParty: 'volunteer', reportedPersonId: 'v1', excludedActorIds: ['v1'], ownerId: 'op2', status: 'claimed', body: '我想反映一些让我不舒服的话。', createdAt: '2026-10-18T08:00:00+08:00', updatedAt: '2026-10-18T09:00:00+08:00', claimedAt: '2026-10-18T09:00:00+08:00', severity: 'high', slaDueAt: '2026-10-19T11:00:00+08:00', reportRequired: true, history: [{ at: '2026-10-18T08:00:00+08:00', actorId: 'c3', note: '已提交求助，等待独立保护人员接手。' }, { at: '2026-10-18T09:00:00+08:00', actorId: 'op2', note: '保护人员已接手。' }] },
    ],
  }
}

export type DomainErrorCode = 'FORBIDDEN' | 'INVALID_ACTION'
export class DomainError extends Error {
  constructor(message: string, public readonly code: DomainErrorCode = 'INVALID_ACTION') {
    super(message)
    this.name = 'DomainError'
  }
}
const fail = (message: string, code: DomainErrorCode = 'INVALID_ACTION'): never => { throw new DomainError(message, code) }
function ensure(condition: unknown, message: string, code: DomainErrorCode = 'INVALID_ACTION'): asserts condition { if (!condition) fail(message, code) }
const uid = (prefix: string) => `${prefix}-${crypto.randomUUID()}`
const addDays = (iso: string, days: number) => new Date(Date.parse(iso) + days * DAY).toISOString()
export const hasPermission = (actor: Person, permission: NonNullable<Person['permissions']>[number]) => actor.role === 'operator' && (!actor.permissions || actor.permissions.includes(permission))
const canHandleHelp = (actor: Person, followup: AppState['followups'][number]) =>
  hasPermission(actor, 'safeguarding') && actor.accountStatus !== 'disabled' && followup.ownerId === actor.id && followup.reportedPersonId !== actor.id

export function hasTeacherScope(state: AppState, teacherId: string, childId: string, scope: TeacherScope): boolean {
  return teacherScope(state, teacherId, childId, scope, state.clock)
}

function canCoordinateSchool(state: AppState, teacherId: string, schoolId: string): boolean {
  const teacher = state.people.find(person => person.id === teacherId && person.role === 'teacher')
  if (!teacher || teacher.accountStatus === 'disabled' || teacher.schoolId !== schoolId) return false
  const clock = Date.parse(state.clock)
  return !!state.teacherAssignments?.some(assignment => assignment.teacherId === teacherId && assignment.schoolId === schoolId && assignment.scope.includes('school-coordinate') && !assignment.revokedAt && Date.parse(assignment.startsAt) <= clock && (!assignment.endsAt || clock < Date.parse(assignment.endsAt)))
}

const scriptKey = (body: string) => body.replace(/\s+/g, '').replace(/[，。！？、,.!?；;：:“”"'（）()《》…—~～·\-]/g, '')

/** Same volunteer sending the same script to different children is one signal, not one per letter. */
function recordDuplicateScript(state: AppState, volunteerId: string) {
  const groups = new Map<string, Letter[]>()
  for (const letter of state.letters.filter(item => item.authorId === volunteerId && (item.moderation === 'pending' || item.moderation === 'approved'))) {
    const key = scriptKey(letter.body)
    if (key.length < 20) continue
    groups.set(key, [...(groups.get(key) ?? []), letter])
  }
  for (const group of groups.values()) {
    const pairIds = [...new Set(group.map(letter => letter.pairId))]
    if (pairIds.length < 2) continue
    const letterIds = group.map(letter => letter.id)
    const open = (state.riskSignals ?? []).find(signal => signal.volunteerId === volunteerId && signal.kind === 'duplicate-script' && (signal.status === 'open' || signal.status === 'reviewing'))
    if (open) {
      open.pairIds = [...new Set([...open.pairIds, ...pairIds])]
      open.letterIds = [...new Set([...open.letterIds, ...letterIds])]
      continue
    }
    state.riskSignals!.push({ id: uid('risk'), volunteerId, pairIds, letterIds, kind: 'duplicate-script', severity: 'high', status: 'open', note: '同一志愿者在不同结对提交了相同话术，等待保护岗核实。', createdAt: state.clock })
  }
}

export function deliveryRouteForLetter(state: AppState, letter: Letter): DeliveryRoute | undefined {
  if (letter.deliveryRoute) return letter.deliveryRoute
  const pair = state.pairs.find(p => p.id === letter.pairId)
  if (!pair) return undefined
  return letter.authorId === pair.childId ? 'online' : pair.channel === 'paper' ? 'school-paper' : 'online'
}

export function canHandleHelpCase(state: AppState, actor: Person, helpCase: HelpCase): boolean {
  return authorize({ actor, action: 'read-help-case', resource: { type: 'help-case', id: helpCase.id }, purpose: 'safeguarding-case', state, now: state.clock }).decision === 'allow'
}

/** The requester may follow receipt/status and reread their own words, but does
 * not receive handler identities, conflict rules or internal case notes. */
export function requesterHelpCaseProjection(helpCase: HelpCase): HelpCase {
  return {
    id: helpCase.id,
    requesterId: helpCase.requesterId,
    pairId: helpCase.pairId,
    reportedParty: helpCase.reportedParty,
    reportedPersonId: helpCase.reportedPersonId,
    excludedActorIds: [],
    ownerId: '',
    status: helpCase.status,
    body: helpCase.body,
    createdAt: helpCase.createdAt,
    updatedAt: helpCase.updatedAt,
    history: [],
  }
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', timeZone: 'Asia/Shanghai' }).format(new Date(iso))
}

export function recipientForLetter(state: AppState, letter: Letter): string | undefined {
  const pair = state.pairs.find(p => p.id === letter.pairId)
  return letter.recipientId ?? (pair ? letter.authorId === pair.childId ? pair.volunteerId : pair.childId : undefined)
}

/** Upgrade older synthetic snapshots without importing React, IndexedDB, or cloud SDKs. */
export function normalizeState(previous: AppState): AppState {
  const state = structuredClone(previous)
  state.schools ??= []
  state.teacherAssignments ??= []
  state.deliveryEvents ??= []
  state.helpCases ??= []
  state.manuscriptAssets ??= []
  state.ocrRuns ??= []
  state.schoolAuthorities ??= []
  state.accessGrants ??= []
  state.evidenceSnapshots ??= []
  state.riskSignals ??= []
  state.disputeCases ??= []
  state.supportTasks ??= []
  state.dutyShifts ??= []
  state.trainingRecords ??= []
  state.planPolicies ??= [{ id: 'main', childMaxActivePairs: 2, volunteerMaxActivePairs: 2, newPairCooldownDays: 7 }]
  for (const helpCase of state.helpCases) {
    helpCase.severity ??= 'medium'
    helpCase.reportRequired ??= false
  }
  for (const grant of state.accessGrants) grant.emergency ??= false
  for (const letter of state.letters) {
    letter.recipientId ??= recipientForLetter(state, letter)
    letter.deliveryRoute ??= deliveryRouteForLetter(state, letter)
    if (letter.moderation === 'pending') letter.reviewAssigneeId ??= state.people.find(person => hasPermission(person, 'review') && person.accountStatus !== 'disabled' && person.id !== letter.authorId)?.id
    letter.revision ??= 0
    letter.submissionVersions ??= []
    letter.coveredLetterIds ??= letter.replyTo ? [letter.replyTo] : []
    if (letter.moderation !== 'draft' && !letter.submissionVersions.length) letter.submissionVersions.push({ revision: letter.revision, title: letter.title, body: letter.body, riddleId: letter.riddleId, attachmentId: letter.attachmentId, coveredLetterIds: [...letter.coveredLetterIds], submittedAt: letter.updatedAt, submittedBy: letter.createdBy })
  }
  for (const task of state.tasks) {
    const letter = state.letters.find(l => l.id === task.letterId)
    task.recipientId ??= letter ? recipientForLetter(state, letter) : state.pairs.find(p => p.id === task.pairId)?.volunteerId
    task.kind ??= 'response'
    task.baseDueAt ??= task.dueAt
    task.createdAt ??= state.deliveries.find(d => d.letterId === task.letterId)?.deliveredAt ?? state.clock
    task.exclusions ??= []
  }
  for (const pair of state.pairs) {
    pair.pauseHistory ??= []
    if (pair.status === 'paused' && pair.pausedAt && !pair.pauseHistory.some(i => !i.end)) pair.pauseHistory.push({ start: pair.pausedAt, kind: 'pause', sourceId: pair.id })
  }
  return state
}

export function canReadLetter(state: AppState, actor: Person, letter: Letter): boolean {
  return authorize({ actor, action: 'read-letter', resource: { type: 'letter', id: letter.id }, purpose: 'home-overview', state, now: state.clock }).decision === 'allow'
}

export function visibleLetters(state: AppState, actor: Person): Letter[] {
  return state.letters.filter(l => canReadLetter(state, actor, l)).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}

/** A delivered recipient or print-task view contains only the frozen, approved
 * current version. Review routing, earlier submissions and internal notes must
 * never cross the correspondence boundary. */
export function approvedLetterProjection(letter: Letter): Letter {
  return {
    id: letter.id,
    pairId: letter.pairId,
    authorId: letter.authorId,
    recipientId: letter.recipientId,
    createdBy: letter.createdBy,
    deliveryRoute: letter.deliveryRoute,
    title: letter.title,
    body: letter.body,
    riddleId: letter.riddleId,
    replyTo: letter.replyTo,
    attachmentId: letter.approvedRenditionId ?? letter.attachmentId,
    ocrRunId: letter.ocrRunId,
    approvedRenditionId: letter.approvedRenditionId,
    moderation: 'approved',
    createdAt: letter.createdAt,
    updatedAt: letter.updatedAt,
    revision: letter.revision,
  }
}

/** Server-side projection: never ship all records and rely on UI hiding. */
export function scopeState(previous: AppState, actorId: string): AppState {
  const state = normalizeState(previous)
  const actor = state.people.find(p => p.id === actorId)
  ensure(actor && actor.accountStatus !== 'disabled', '账号不可用，请重新登录或联系负责老师。')
  const operator = actor.role === 'operator'
  const administered = hasPermission(actor, 'administration')
  const reviewPairs = new Set(hasPermission(actor, 'review') ? state.letters.filter(l => l.moderation === 'pending' && l.reviewAssigneeId === actorId).map(l => l.pairId) : [])
  const helpPairs = new Set(state.followups.filter(f => f.kind === 'help' && canHandleHelp(actor, f)).map(f => f.pairId))
  const visibleHelpCases = state.helpCases?.filter(helpCase => helpCase.requesterId === actorId || canHandleHelpCase(state, actor, helpCase)) ?? []
  for (const helpCase of visibleHelpCases) if (helpCase.pairId) helpPairs.add(helpCase.pairId)
  state.pairs = state.pairs.filter(p => administered || reviewPairs.has(p.id) || helpPairs.has(p.id) || (!operator && (p.childId === actorId || p.volunteerId === actorId || actor.role === 'teacher' && hasTeacherScope(state, actorId, p.childId, 'status'))))
  const casePeople = visibleHelpCases.flatMap(helpCase => helpCase.requesterId === actorId ? [] : [helpCase.requesterId, helpCase.reportedPersonId].filter((id): id is string => !!id))
  const relatedIds = new Set([actorId, ...state.pairs.flatMap(p => [p.childId, p.volunteerId, p.teacherId]), ...casePeople])
  state.people = state.people.filter(p => administered || relatedIds.has(p.id) || (actor.role === 'teacher' && p.role === 'child' && hasTeacherScope(state, actorId, p.id, 'status')) || state.followups.some(f => f.kind === 'help' && f.requesterId === p.id && canHandleHelp(actor, f)))
  state.letters = visibleLetters(state, actor).map(letter => {
    if (letter.authorId === actorId || letter.createdBy === actorId && letter.moderation === 'draft' || actor.role === 'operator' && letter.reviewAssigneeId === actorId && letter.moderation === 'pending') return letter
    return approvedLetterProjection(letter)
  })
  const letterIds = new Set(state.letters.map(l => l.id))
  const pairIds = new Set(state.pairs.map(p => p.id))
  state.deliveries = state.deliveries.filter(d => letterIds.has(d.letterId))
  state.tasks = state.tasks.filter(t => pairIds.has(t.pairId) && (administered || t.recipientId === actorId || actor.role === 'teacher' && state.pairs.some(p => p.id === t.pairId && t.recipientId === p.childId && hasTeacherScope(state, actorId, p.childId, 'status'))))
  state.reviews = state.reviews.filter(r => state.letters.some(l => l.id === r.letterId && (l.authorId === actorId || l.createdBy === actorId || hasPermission(actor, 'review'))))
  state.followups = state.followups.filter(f => f.kind === 'help' ? f.requesterId === actorId || canHandleHelp(actor, f) : operator && hasPermission(actor, 'administration'))
  state.helpCases = visibleHelpCases.map(helpCase => helpCase.requesterId === actorId ? requesterHelpCaseProjection(helpCase) : helpCase)
  state.teacherAssignments = state.teacherAssignments?.filter(assignment => administered || actor.role === 'teacher' && assignment.teacherId === actorId || actor.role === 'child' && assignment.childId === actorId)
  const visibleSchoolIds = new Set(state.people.map(person => person.schoolId).filter(Boolean))
  state.schools = state.schools?.filter(school => administered || visibleSchoolIds.has(school.id))
  // Original manuscripts and their hashes never travel in an ordinary workspace
  // snapshot. A delivered letter may expose only its approved rendition and the
  // faithful, line-located transcript needed by that specific reader.
  state.manuscriptAssets = []
  const ocrRunIds = new Set(state.letters.map(letter => letter.ocrRunId).filter((id): id is string => !!id))
  state.ocrRuns = (state.ocrRuns ?? []).filter(run => ocrRunIds.has(run.id) && run.status === 'completed').map(run => ({ ...run, manuscriptAssetId: '', sourceSha256: '', error: undefined }))
  const attachmentIds = new Set<string>()
  for (const letter of state.letters) {
    const ownsDraftOrVersion = letter.authorId === actorId || letter.createdBy === actorId || actor.role === 'operator' && letter.reviewAssigneeId === actorId && letter.moderation === 'pending'
    if (letter.approvedRenditionId) attachmentIds.add(letter.approvedRenditionId)
    if (letter.attachmentId && (!letter.manuscriptAssetId && !letter.ocrRunId || ownsDraftOrVersion)) attachmentIds.add(letter.attachmentId)
    if (ownsDraftOrVersion) for (const version of letter.submissionVersions ?? []) if (version.attachmentId) attachmentIds.add(version.attachmentId)
  }
  state.attachments = state.attachments.filter(a => attachmentIds.has(a.id))
  const holds = (action: 'read-grant' | 'read-risk-signal' | 'read-dispute', type: 'grant' | 'risk-signal' | 'dispute', id?: string) =>
    authorize({ actor, action, resource: { type, id }, purpose: 'home-overview', state, now: state.clock }).decision === 'allow'
  state.accessGrants = (state.accessGrants ?? []).filter(grant => holds('read-grant', 'grant', grant.id))
  state.riskSignals = (state.riskSignals ?? []).filter(signal => holds('read-risk-signal', 'risk-signal', signal.id))
  state.disputeCases = (state.disputeCases ?? []).filter(dispute => holds('read-dispute', 'dispute', dispute.id))
  const safeguardingView = operator && (hasPackage(actor, 'safeguarding') || hasPackage(actor, 'privacy'))
  state.supportTasks = (state.supportTasks ?? []).filter(task => safeguardingView || task.ownerTeacherId === actorId || task.pairId && pairIds.has(task.pairId) && actor.role === 'teacher')
  state.evidenceSnapshots = safeguardingView ? state.evidenceSnapshots ?? [] : []
  state.dutyShifts = (state.dutyShifts ?? []).filter(shift => operator || actor.role === 'teacher' && shift.scope === 'school' && shift.schoolId === actor.schoolId)
  state.trainingRecords = (state.trainingRecords ?? []).filter(record => actor.role === 'volunteer' ? record.volunteerId === actorId : operator && (hasPackage(actor, 'accounts') || hasPackage(actor, 'safeguarding') || hasPackage(actor, 'privacy')))
  state.planPolicies ??= []
  return state
}

function unionDuration(intervals: TimeInterval[], now: string, from: string): number {
  const start = Date.parse(from), end = Date.parse(now)
  const sorted = intervals.map(i => [Math.max(start, Date.parse(i.start)), Math.min(end, Date.parse(i.end ?? now))]).filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0])
  let total = 0, previousEnd = start
  for (const [a, b] of sorted) { total += Math.max(0, b - Math.max(a, previousEnd)); previousEnd = Math.max(previousEnd, b) }
  return total
}

function refreshDeadlines(state: AppState): void {
  for (const task of state.tasks) {
    if (task.status === 'completed') continue
    const pair = state.pairs.find(p => p.id === task.pairId)
    const duration = unionDuration([...(task.exclusions ?? []), ...(pair?.pauseHistory ?? [])], state.clock, task.createdAt ?? state.clock)
    task.dueAt = new Date(Date.parse(task.baseDueAt ?? task.dueAt) + duration).toISOString()
  }
}

export function isOverdue(state: AppState, task: ReplyTask): boolean {
  const pair = state.pairs.find(p => p.id === task.pairId)
  return task.status === 'awaiting' && pair?.status === 'active' && task.recipientId !== pair.childId && Date.parse(state.clock) > Date.parse(task.dueAt)
}

export function groupedResponseTasks(state: AppState, actorId: string) {
  const groups = new Map<string, { pairId: string; recipientId: string; tasks: ReplyTask[]; letterIds: string[]; dueAt: string; status: 'awaiting' | 'review' }>()
  for (const task of normalizeState(state).tasks.filter(t => t.recipientId === actorId && t.status !== 'completed')) {
    let group = groups.get(task.pairId)
    if (!group) { group = { pairId: task.pairId, recipientId: actorId, tasks: [], letterIds: [], dueAt: task.dueAt, status: 'review' }; groups.set(task.pairId, group) }
    group.tasks.push(task)
    if (task.letterId && task.status === 'awaiting') group.letterIds.push(task.letterId)
  }
  for (const group of groups.values()) {
    const awaiting = group.tasks.filter(task => task.status === 'awaiting')
    group.status = awaiting.length ? 'awaiting' : 'review'
    const relevant = awaiting.length ? awaiting : group.tasks
    group.dueAt = relevant.reduce((earliest, task) => Date.parse(task.dueAt) < Date.parse(earliest) ? task.dueAt : earliest, relevant[0].dueAt)
  }
  return [...groups.values()].sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))
}

function recordDeliveryEvent(state: AppState, letterId: string, type: NonNullable<AppState['deliveryEvents']>[number]['type'], actorId: string, note?: string): void {
  state.deliveryEvents ??= []
  if (state.deliveryEvents.some(event => event.letterId === letterId && event.type === type && type !== 'print-attempt' && type !== 'delivery-failed')) return
  state.deliveryEvents.push({ id: uid('delivery-event'), letterId, type, actorId, at: state.clock, note })
}

function deliver(state: AppState, letter: Letter, actorId: string): void {
  const pair = state.pairs.find(p => p.id === letter.pairId)!
  if (pair.status !== 'active') return
  let delivery = state.deliveries.find(d => d.letterId === letter.id)
  if (!delivery) { delivery = { letterId: letter.id }; state.deliveries.push(delivery) }
  if (delivery.deliveredAt) return
  delivery.deliveredAt = state.clock
  recordDeliveryEvent(state, letter.id, deliveryRouteForLetter(state, letter) === 'school-paper' ? 'handed-to-child' : 'online-available', actorId)
  const recipientId = recipientForLetter(state, letter)!
  if (!state.tasks.some(t => t.letterId === letter.id)) {
    const dueAt = addDays(state.clock, recipientId === pair.childId ? 14 : 7)
    state.tasks.push({ id: `task-${letter.id}`, letterId: letter.id, pairId: pair.id, recipientId, dueAt, baseDueAt: dueAt, createdAt: state.clock, status: 'awaiting', kind: 'response', exclusions: [] })
  }
}

function reconcileFollowups(state: AppState): void {
  refreshDeadlines(state)
  const grouped = new Set<string>()
  for (const task of state.tasks.filter(t => isOverdue(state, t)).sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))) {
    const key = `${task.pairId}:${task.recipientId}`
    if (grouped.has(key)) continue
    grouped.add(key)
    const related = state.followups.filter(f => f.kind === 'overdue' && f.pairId === task.pairId && state.tasks.some(t => t.id === f.taskId && t.recipientId === task.recipientId))
    const open = related.find(f => f.status === 'open')
    const existing = open ?? related.find(f => f.status === 'resolved' && state.tasks.some(t => t.id === f.taskId && t.status !== 'completed'))
    if (!existing) state.followups.push({ id: uid('overdue'), pairId: task.pairId, taskId: task.id, kind: 'overdue', status: 'open', note: '回信暂未收到。请先了解伙伴的近况与收发情况，温和跟进。', ownerId: state.people.find(p => hasPermission(p, 'administration'))?.id, createdAt: state.clock, updatedAt: state.clock })
    else if (existing.status === 'open' && existing.taskId !== task.id) { existing.taskId = task.id; existing.updatedAt = state.clock }
    else if (existing.status === 'resolved' && existing.nextFollowupAt && Date.parse(state.clock) >= Date.parse(existing.nextFollowupAt)) { existing.status = 'open'; existing.updatedAt = state.clock; existing.taskId = task.id }
  }
  for (const followup of state.followups.filter(f => f.kind === 'overdue' && f.status === 'open')) {
    const target = state.tasks.find(t => t.id === followup.taskId)
    const pair = target && state.pairs.find(p => p.id === target.pairId)
    if (target && (target.recipientId === pair?.childId || target.status === 'completed' || !state.tasks.some(t => t.pairId === target.pairId && t.recipientId === target.recipientId && t.status !== 'completed'))) { followup.status = 'resolved'; followup.resolution = target.recipientId === pair?.childId ? '孩子没有回信时限，改为关怀性询问。' : '待回应的信件已完成。'; followup.updatedAt = state.clock }
  }
}

/** Reconcile on every authenticated snapshot, so reminders advance even without writes. */
export function refreshState(previous: AppState, clock = previous.clock): AppState {
  const state = normalizeState(previous)
  ensure(Number.isFinite(Date.parse(clock)), '当前时间无效。')
  state.clock = clock
  reconcileFollowups(state)
  return state
}

/** Only authenticated backend code should choose actorId in formal mode. */
export function reduceCommand(previous: AppState, actorId: string, command: Command, options: { formal?: boolean } = {}): AppState {
  const state = normalizeState(previous)
  const actor = state.people.find(p => p.id === actorId)
  ensure(actor, '身份不存在，请重新登录。')
  ensure(actor.accountStatus !== 'disabled' && (!options.formal || actor.accountStatus === 'active'), '账号尚未获得参与权限。')
  const pairById = (id: string) => state.pairs.find(p => p.id === id) ?? fail('这组陪伴关系不存在。')
  const letterById = (id: string) => state.letters.find(l => l.id === id) ?? fail('这封信不存在。')
  const active = (id: string) => { const pair = pairById(id); ensure(pair.status === 'active', pair.status === 'ended' ? '这组陪伴已经结束。' : '这组陪伴正在暂停，恢复后再继续操作。'); return pair }
  const operator = (permission: NonNullable<Person['permissions']>[number] = 'administration') => ensure(hasPermission(actor, permission), '这项操作需要获得相应权限的运营人员处理。', 'FORBIDDEN')
  const editable = (letter: Letter) => {
    const pair = state.pairs.find(p => p.id === letter.pairId)
    ensure(actor.id === letter.authorId || (actor.role === 'teacher' && !!pair && hasTeacherScope(state, actor.id, pair.childId, 'capture') && letter.createdBy === actor.id), '你只能修改自己写的信或自己代录的回信。', 'FORBIDDEN')
    ensure(!pair || pair.status !== 'ended', '这组陪伴已经结束。')
    ensure(letter.moderation === 'draft' || letter.moderation === 'returned', '这封信已提交，请等待审核结果。')
  }
  switch (command.type) {
    case 'assign-teacher': {
      const coordinator = actor.role === 'teacher' && canCoordinateSchool(state, actor.id, command.schoolId)
      ensure(hasPermission(actor, 'administration') || coordinator, '只有平台授权岗或本校协调老师可以指派老师。', 'FORBIDDEN')
      const school = state.schools?.find(item => item.id === command.schoolId)
      const teacher = state.people.find(person => person.id === command.teacherId && person.role === 'teacher')
      const child = command.childId ? state.people.find(person => person.id === command.childId && person.role === 'child') : undefined
      ensure(school?.status === 'active' && teacher?.schoolId === school.id && (!command.childId || child?.schoolId === school.id), '老师、孩子和学校必须属于同一有效学校。')
      ensure(command.scope.length > 0 && command.scope.every(scope => ['status', 'capture', 'paper-delivery', 'protect', 'school-coordinate'].includes(scope)), '请选择有效的授权范围。')
      if (coordinator) {
        ensure(teacher.id !== actor.id, '校内协调老师不能给自己扩权。', 'FORBIDDEN')
        ensure(!command.scope.includes('school-coordinate'), '校内协调权限只能由平台授权岗授予。', 'FORBIDDEN')
      }
      ensure(command.childId || command.scope.every(scope => scope === 'protect' || scope === 'school-coordinate' || scope === 'status'), '拍摄和纸质交付授权必须指向具体孩子。')
      ensure(Number.isFinite(Date.parse(command.startsAt)) && (!command.endsAt || Date.parse(command.endsAt) > Date.parse(command.startsAt)), '请填写有效的授权起止时间。')
      const duplicate = state.teacherAssignments!.some(assignment => assignment.schoolId === school.id && assignment.teacherId === teacher.id && assignment.childId === command.childId && !assignment.revokedAt && (!assignment.endsAt || Date.parse(assignment.endsAt) > Date.parse(command.startsAt)))
      ensure(!duplicate, '这位老师已有重叠的有效指派，请先撤销或调整原指派。')
      state.teacherAssignments!.push({ id: uid('teacher-assignment'), schoolId: school.id, teacherId: teacher.id, childId: child?.id, scope: [...new Set(command.scope)], startsAt: new Date(command.startsAt).toISOString(), endsAt: command.endsAt ? new Date(command.endsAt).toISOString() : undefined, approvedBy: actor.id })
      break
    }
    case 'revoke-teacher-assignment': {
      const assignment = state.teacherAssignments!.find(item => item.id === command.id)
      ensure(assignment, '这条老师指派不存在。')
      const coordinator = actor.role === 'teacher' && canCoordinateSchool(state, actor.id, assignment.schoolId)
      ensure(hasPermission(actor, 'administration') || coordinator, '只有平台授权岗或本校协调老师可以撤销指派。', 'FORBIDDEN')
      if (coordinator) {
        ensure(assignment.teacherId !== actor.id && !assignment.scope.includes('school-coordinate'), '校内协调老师不能撤销自己的权限或其他协调授权。', 'FORBIDDEN')
      }
      assignment.revokedAt ??= state.clock
      break
    }
    case 'match': {
      ensure(hasPermission(actor, 'matching') || hasPermission(actor, 'administration'), '只有平台结对岗可以建立结对。', 'FORBIDDEN')
      const existing = state.pairs.find(p => p.status !== 'ended' && p.childId === command.childId && p.volunteerId === command.volunteerId)
      if (existing) break
      const child = state.people.find(p => p.id === command.childId && p.role === 'child')
      const volunteer = state.people.find(p => p.id === command.volunteerId && p.role === 'volunteer')
      ensure(child && volunteer && state.people.some(p => p.id === command.teacherId && p.role === 'teacher'), '请选择有效的小朋友、志愿者和老师。')
      if (options.formal) { ensure(child.guardianConsent && child.accountStatus === 'active', '请先完成有效的监护授权。'); ensure(volunteer.volunteerApproved && volunteer.accountStatus === 'active', '志愿者尚未通过审核。'); ensure(hasTeacherScope(state, command.teacherId, child.id, 'status'), '只能选择已获学校授权负责这位小朋友的老师。') }
      const policy = state.planPolicies?.find(item => item.id === 'main') ?? { childMaxActivePairs: 2, volunteerMaxActivePairs: 2, newPairCooldownDays: 7 }
      const childActive = state.pairs.filter(p => p.childId === child.id && p.status !== 'ended').length
      ensure(childActive < policy.childMaxActivePairs, `同一名孩子同时最多 ${policy.childMaxActivePairs} 组陪伴，请先结束或暂停其中一组。`, 'FORBIDDEN')
      const volunteerActive = state.pairs.filter(p => p.volunteerId === volunteer.id && p.status !== 'ended').length
      ensure(volunteerActive < policy.volunteerMaxActivePairs, `同一名志愿者同时最多 ${policy.volunteerMaxActivePairs} 组陪伴，请先结束或暂停其中一组。`, 'FORBIDDEN')
      const recent = state.pairs.find(p => p.status === 'ended' && p.childId === child.id && p.volunteerId === volunteer.id && p.endedAt && Date.parse(state.clock) - Date.parse(p.endedAt) < policy.newPairCooldownDays * DAY)
      ensure(!recent, `与同一伙伴结束陪伴后需满 ${policy.newPairCooldownDays} 天才能重新结对，请先与学校或运营沟通。`, 'FORBIDDEN')
      const id = uid('pair'), dueAt = addDays(state.clock, 7)
      state.pairs.push({ id, childId: child.id, volunteerId: volunteer.id, teacherId: command.teacherId, schoolId: child.schoolId, channel: command.channel, status: 'active', startedAt: state.clock, pauseHistory: [] })
      state.tasks.push({ id: `first-${id}`, pairId: id, letterId: '', recipientId: volunteer.id, dueAt, baseDueAt: dueAt, createdAt: state.clock, status: 'awaiting', kind: 'first-letter', exclusions: [] })
      break
    }
    case 'save-letter': {
      ensure(command.pairId, '请先选择明确的书信伙伴。')
      const pair = pairById(command.pairId)
      ensure(pair.status !== 'ended', '这组陪伴已经结束。')
      ensure(command.title.trim().length <= 60, '标题请控制在 60 字以内。')
      ensure(command.id === undefined || (command.id.trim().length > 0 && command.id.length <= 120), '这封信的标识无效。')
      ensure(command.body.length <= 6000, '信件正文请控制在 6000 字以内。')
      ensure(!command.riddleId || riddles.some(r => r.id === command.riddleId), '这道谜语不存在，请重新选择。')
      ensure(actor.role === 'child' || actor.role === 'volunteer' || (actor.role === 'teacher' && hasTeacherScope(state, actor.id, pair.childId, 'capture')), '你没有写这封信的权限。', 'FORBIDDEN')
      const authorId = actor.role === 'teacher' ? pair.childId : actor.id
      ensure(!command.authorId || command.authorId === authorId, '不能替换写信人。', 'FORBIDDEN')
      ensure(authorId === pair.childId || authorId === pair.volunteerId, '请选择自己的书信伙伴。', 'FORBIDDEN')
      if (authorId === pair.volunteerId) ensure(trainingFor(state, authorId), '请先完成当前版本的行为边界培训，再寄出信件。', 'FORBIDDEN')
      const recipientId = authorId === pair.childId ? pair.volunteerId : pair.childId
      ensure(!command.recipientId || command.recipientId === recipientId, '不能向未结对的人寄信。', 'FORBIDDEN')
      const route: DeliveryRoute = command.deliveryRoute ?? (authorId === pair.childId ? 'online' : pair.channel === 'paper' ? 'school-paper' : 'online')
      ensure(route === 'online' || route === 'school-paper', '请选择有效的逐封投递方式。')
      ensure(authorId !== pair.childId || route === 'online', '孩子写给远端志愿者的信只能在线送达。')
      if (command.replyTo) { const original = letterById(command.replyTo); ensure(original.pairId === pair.id && recipientForLetter(state, original) === authorId && original.moderation === 'approved' && state.deliveries.some(d => d.letterId === original.id && d.deliveredAt), '原信确认送达后，才可以写回信。') }
      let letter = command.id ? state.letters.find(l => l.id === command.id) : state.letters.find(l => l.pairId === command.pairId && l.authorId === authorId && l.createdBy === actor.id && l.replyTo === command.replyTo && (l.moderation === 'draft' || l.moderation === 'returned') && l.title === command.title.trim() && l.body === command.body && l.riddleId === command.riddleId)
      if (letter) {
        editable(letter)
        ensure(letter.pairId === command.pairId && letter.authorId === authorId && letter.recipientId === recipientId && letter.replyTo === command.replyTo && letter.deliveryRoute === route, '修改时不能更换信件的伙伴、收件人、投递方式或原信。')
        const unchanged = !command.file && !command.removeAttachment && (!command.attachmentId || command.attachmentId === letter.attachmentId) && letter.title === command.title.trim() && letter.body === command.body && letter.riddleId === command.riddleId
        if (unchanged) break
        ensure(command.expectedRevision === undefined || command.expectedRevision === letter.revision, '这封草稿已在另一台设备更新。请保留当前文字，重新载入后合并。')
      } else {
        ensure(command.expectedRevision === undefined || command.expectedRevision === 0, '这封草稿的版本已变化，请重新载入。')
        letter = { id: command.id ?? uid('letter'), pairId: pair.id, authorId, recipientId, createdBy: actor.id, deliveryRoute: route, title: '', body: '', replyTo: command.replyTo, moderation: 'draft', createdAt: state.clock, updatedAt: state.clock, revision: 0, coveredLetterIds: [], submissionVersions: [] }
        state.letters.push(letter)
      }
      letter.title = command.title.trim(); letter.body = command.body; letter.riddleId = command.riddleId; letter.updatedAt = state.clock; letter.revision = (letter.revision ?? 0) + 1
      if (command.removeAttachment) letter.attachmentId = undefined
      if (command.attachmentId) {
        const attachment = state.attachments.find(a => a.id === command.attachmentId)
        ensure(attachment && !attachment.deletingAt && attachment.ownerId === actor.id && (!attachment.pairId || attachment.pairId === command.pairId), '附件不属于当前账号或书信伙伴，或正在清理。', 'FORBIDDEN')
        letter.attachmentId = attachment.id; attachment.pairId = command.pairId
      }
      if (command.file) {
        ensure(!options.formal, '请先通过受保护的附件接口上传图片。')
        const attachment: Attachment = { id: uid('attachment'), pairId: command.pairId, name: command.file.name, type: command.file.type, blob: command.file, ownerId: actor.id }
        state.attachments.push(attachment); letter.attachmentId = attachment.id
      }
      const referenced = new Set(state.letters.flatMap(l => [l.attachmentId, ...(l.submissionVersions ?? []).map(v => v.attachmentId)]))
      if (!options.formal) state.attachments = state.attachments.filter(a => referenced.has(a.id))
      break
    }
    case 'submit-letter': {
      const letter = letterById(command.id)
      ensure(actor.id === letter.authorId || actor.id === letter.createdBy, '你不能提交这封信。', 'FORBIDDEN')
      active(letter.pairId)
      if (letter.authorId === pairById(letter.pairId).volunteerId) ensure(trainingFor(state, letter.authorId), '请先完成当前版本的行为边界培训，再寄出信件。', 'FORBIDDEN')
      if (letter.moderation === 'pending' || letter.moderation === 'approved') break
      editable(letter)
      ensure(letter.body.trim().length > 0 || letter.attachmentId, '写下一点想分享的事，或附上手写信图片后再寄出。')
      if (options.formal && actor.role === 'teacher') ensure(command.confirmedByChild, '请先让小朋友核对代录内容，再确认提交。')
      if (actor.role === 'teacher' && command.confirmedByChild) letter.childConfirmedAt = state.clock
      letter.title ||= letter.body.trim().split(/\r?\n/)[0].slice(0, 24) || '给伙伴的一封信'
      const coverage = [...new Set(command.coveredLetterIds ?? (letter.replyTo ? [letter.replyTo] : []))]
      for (const id of coverage) ensure(state.tasks.some(t => t.letterId === id && t.pairId === letter.pairId && t.recipientId === letter.authorId && t.status === 'awaiting'), '所选来信已被回应或正在审核，请重新选择。')
      letter.coveredLetterIds = coverage
      letter.submissionVersions!.push({ revision: letter.revision!, title: letter.title, body: letter.body, riddleId: letter.riddleId, attachmentId: letter.attachmentId, manuscriptAssetId: letter.manuscriptAssetId, ocrRunId: letter.ocrRunId, approvedRenditionId: letter.approvedRenditionId, coveredLetterIds: [...coverage], submittedAt: state.clock, submittedBy: actor.id })
      letter.reviewAssigneeId = state.people.find(person => hasPermission(person, 'review') && person.accountStatus !== 'disabled' && person.id !== letter.authorId)?.id
      letter.moderation = 'pending'; letter.updatedAt = state.clock
      if (letter.authorId === pairById(letter.pairId).volunteerId) recordDuplicateScript(state, letter.authorId)
      for (const task of state.tasks.filter(t => t.pairId === letter.pairId && t.recipientId === letter.authorId && (coverage.includes(t.letterId) || t.kind === 'first-letter') && t.status === 'awaiting')) { task.status = 'review'; task.reviewLetterId = letter.id; task.exclusions!.push({ start: state.clock, kind: 'review', sourceId: letter.id }) }
      break
    }
    case 'review-letter': {
      operator('review')
      const letter = letterById(command.id)
      ensure(letter.reviewAssigneeId === actor.id, '只有被分派的审核员可以处理这封信。', 'FORBIDDEN')
      if (letter.moderation === command.decision) break
      ensure(letter.moderation === 'pending', '只有待审核的信件可以审核。')
      const pair = pairById(letter.pairId)
      ensure(pair.status !== 'ended' || command.decision === 'returned', '陪伴已结束，不能继续送出信件。')
      ensure(command.decision === 'approved' || command.note.trim().length >= 3, '请写下具体的修改建议。')
      const teacherCapturedManuscript = letter.authorId === pair.childId && letter.createdBy !== letter.authorId && !!letter.attachmentId
      if (command.decision === 'approved' && teacherCapturedManuscript) {
        ensure(command.transcriptFaithfulConfirmed && command.imagePrivacyConfirmed, '儿童出站图像须逐行核对忠实转写，并确认获准图像副本不泄露私人信息。')
        if (options.formal) {
          const original = state.manuscriptAssets?.find(asset => asset.id === letter.manuscriptAssetId && asset.letterId === letter.id && asset.kind === 'original')
          const ocr = state.ocrRuns?.find(run => run.id === letter.ocrRunId && run.letterId === letter.id && run.status === 'completed' && run.humanReviewRequired)
          const rendition = state.attachments.find(attachment => attachment.id === letter.approvedRenditionId && attachment.pairId === letter.pairId)
          const approvedAsset = state.manuscriptAssets?.find(asset => asset.letterId === letter.id && asset.kind === 'approved-redacted' && !!asset.storagePath && asset.storagePath === rendition?.storagePath)
          const isolatedStorage = !!original?.storagePath && !!approvedAsset?.storagePath && original.storagePath !== approvedAsset.storagePath
          const sourceIntegrity = !!original?.sha256 && ocr?.manuscriptAssetId === original.id && ocr.sourceSha256 === original.sha256
          ensure(original && ocr && rendition && approvedAsset && rendition.id !== letter.attachmentId && isolatedStorage && sourceIntegrity, '正式试测尚未完成相互隔离且可校验的受控原稿、转写和获准图像副本，不能放行。')
        } else if (!letter.approvedRenditionId) {
          const source = state.attachments.find(item => item.id === letter.attachmentId)
          ensure(source, '私有原稿图片不存在，不能放行。')
          const originalAssetId = uid('manuscript-original')
          const approvedAssetId = uid('manuscript-approved')
          const approvedAttachmentId = uid('attachment-approved')
          const ocrRunId = uid('ocr-manual')
          state.manuscriptAssets!.push({ id: originalAssetId, letterId: letter.id, kind: 'original', storagePath: source.storagePath, sha256: source.sha256, mimeType: source.type, width: source.width, height: source.height, createdAt: source.uploadedAt ?? state.clock })
          state.attachments.push({ ...source, id: approvedAttachmentId, name: `${source.name.replace(/\.(png|jpe?g)$/i, '')}·获准图像副本${/\.png$/i.test(source.name) ? '.png' : '.jpg'}`, ownerId: actor.id, uploadedAt: state.clock })
          state.manuscriptAssets!.push({ id: approvedAssetId, letterId: letter.id, kind: 'approved-redacted', storagePath: source.storagePath, sha256: source.sha256, mimeType: source.type, width: source.width, height: source.height, createdAt: state.clock })
          const lines = letter.body.split(/\r?\n/).filter(line => line.length > 0).map((line, index, all) => {
            const top = 0.08 + index * Math.min(0.12, 0.78 / Math.max(all.length, 1))
            return { id: `${ocrRunId}-line-${index + 1}`, pageIndex: 0, text: line, correctedText: line, polygon: [0.08, top, 0.92, top, 0.92, Math.min(top + 0.07, 0.94), 0.08, Math.min(top + 0.07, 0.94)], uncertain: false }
          })
          state.ocrRuns!.push({ id: ocrRunId, letterId: letter.id, manuscriptAssetId: originalAssetId, sourceSha256: source.sha256 ?? `local-synthetic-${source.id}`, status: 'completed', humanReviewRequired: true, engine: 'manual-faithful-transcription', engineVersion: 'demo-1', startedAt: state.clock, completedAt: state.clock, lines })
          letter.manuscriptAssetId = originalAssetId
          letter.ocrRunId = ocrRunId
          letter.approvedRenditionId = approvedAttachmentId
          const submitted = letter.submissionVersions?.find(version => version.revision === letter.revision)
          if (submitted) { submitted.manuscriptAssetId = originalAssetId; submitted.ocrRunId = ocrRunId; submitted.approvedRenditionId = approvedAttachmentId }
        }
      }
      letter.moderation = command.decision; letter.moderationNote = command.note.trim(); letter.updatedAt = state.clock
      state.reviews.push({ id: uid('review'), letterId: letter.id, operatorId: actor.id, decision: command.decision, note: command.note.trim(), createdAt: state.clock, revision: letter.revision })
      for (const task of state.tasks.filter(t => t.reviewLetterId === letter.id && t.status === 'review')) {
        for (const interval of task.exclusions ?? []) if (interval.kind === 'review' && interval.sourceId === letter.id && !interval.end) interval.end = state.clock
        task.status = command.decision === 'approved' ? 'completed' : 'awaiting'; task.reviewLetterId = undefined
        if (task.status === 'completed') task.completedAt = state.clock
      }
      if (command.decision === 'approved') {
        if (!state.deliveries.some(d => d.letterId === letter.id)) state.deliveries.push({ letterId: letter.id })
        if (deliveryRouteForLetter(state, letter) === 'online') deliver(state, letter, actor.id)
      }
      break
    }
    case 'assign-review': {
      operator('administration')
      const letter = letterById(command.id)
      ensure(letter.moderation === 'pending', '只有待审核信件可以分派。')
      const reviewer = state.people.find(person => person.id === command.reviewerId)
      ensure(reviewer && hasPermission(reviewer, 'review') && reviewer.accountStatus !== 'disabled' && reviewer.id !== letter.authorId, '请选择有效且独立的审核员。', 'FORBIDDEN')
      letter.reviewAssigneeId = reviewer.id
      break
    }
    case 'release-held-letter': {
      operator('review')
      const letter = letterById(command.id), pair = active(letter.pairId)
      ensure(letter.moderation === 'approved' && deliveryRouteForLetter(state, letter) === 'online', '只有已审核且在线投递的信件可以复核放行。')
      ensure(letter.recipientId === (letter.authorId === pair.childId ? pair.volunteerId : pair.childId), '请重新核对收件人和结对。')
      ensure(letter.submissionVersions?.some(version => version.revision === letter.revision), '请重新核对已批准版本。')
      deliver(state, letter, actor.id)
      break
    }
    case 'print':
    case 'deliver': {
      ensure(actor.role === 'teacher', '请使用负责收发的老师账号。', 'FORBIDDEN')
      for (const id of new Set(command.ids)) {
        const letter = letterById(id), pair = active(letter.pairId)
        ensure(hasTeacherScope(state, actor.id, pair.childId, 'paper-delivery') && letter.authorId === pair.volunteerId && letter.recipientId === pair.childId && deliveryRouteForLetter(state, letter) === 'school-paper', '只能处理负责孩子收到的纸质信件。', 'FORBIDDEN')
        ensure(letter.moderation === 'approved', '只有审核通过的纸质信件可以打印或交付。')
        let delivery = state.deliveries.find(d => d.letterId === id)
        if (!delivery) { delivery = { letterId: id }; state.deliveries.push(delivery) }
        if (command.type === 'print') { recordDeliveryEvent(state, id, 'print-attempt', actor.id); if (!delivery.printedAt) { delivery.printedAt = state.clock; recordDeliveryEvent(state, id, 'printed', actor.id) } }
        else { ensure(delivery.printedAt, '请先打印这封信，再确认实际交付。'); deliver(state, letter, actor.id) }
      }
      break
    }
    case 'read': {
      const letter = letterById(command.id)
      ensure(canReadLetter(state, actor, letter), '这封信暂时不在你的可读范围内。', 'FORBIDDEN')
      if (recipientForLetter(state, letter) === actor.id) { const delivery = state.deliveries.find(d => d.letterId === letter.id); ensure(letter.moderation === 'approved' && delivery?.deliveredAt, '信件尚未送达。'); if (!delivery.readAt) { delivery.readAt = state.clock; recordDeliveryEvent(state, letter.id, 'online-read', actor.id) } }
      break
    }
    case 'witness-read': {
      ensure(actor.role === 'teacher', '请使用负责孩子的老师账号。', 'FORBIDDEN')
      const letter = letterById(command.id), pair = pairById(letter.pairId)
      ensure(letter.authorId === pair.volunteerId && letter.recipientId === pair.childId && deliveryRouteForLetter(state, letter) === 'school-paper' && hasTeacherScope(state, actor.id, pair.childId, 'paper-delivery'), '只能见证负责孩子收到的纸信。', 'FORBIDDEN')
      const delivery = state.deliveries.find(d => d.letterId === letter.id)
      ensure(letter.moderation === 'approved' && delivery?.deliveredAt, '纸信实际交付后才能记录见证阅读。')
      if (!delivery.witnessedReadAt) { delivery.witnessedReadAt = state.clock; delivery.witnessedBy = actor.id; recordDeliveryEvent(state, letter.id, 'witnessed-read', actor.id) }
      break
    }
    case 'pause-pair': {
      const pair = pairById(command.id)
      const teacherStop = actor.role === 'teacher' && hasTeacherScope(state, actor.id, pair.childId, 'paper-delivery')
      ensure(hasPermission(actor, 'administration') || teacherStop, '只有平台结对岗或当前负责老师可以停止这组交付。', 'FORBIDDEN')
      if (pair.status === 'paused') break
      ensure(pair.status !== 'ended', '陪伴已结束。'); ensure(command.reason.trim().length >= 2, '请记录暂停原因。')
      pair.status = 'paused'; pair.pausedAt = state.clock; pair.pauseReason = teacherStop ? `学校停止交付：${command.reason.trim()}` : command.reason.trim(); pair.pauseHistory!.push({ start: state.clock, kind: 'pause', sourceId: teacherStop ? `teacher:${actor.id}` : pair.id })
      break
    }
    case 'pause-volunteer': {
      ensure(actor.role === 'operator' && hasPermission(actor, 'safeguarding'), '只有儿童保护授权岗可以暂停志愿者的全部结对。', 'FORBIDDEN')
      ensure(command.reason.trim().length >= 2, '请记录保护性暂停原因。')
      const volunteer = state.people.find(person => person.id === command.volunteerId && person.role === 'volunteer')
      ensure(volunteer, '这位志愿者不存在。')
      const pairs = state.pairs.filter(pair => pair.volunteerId === volunteer.id && pair.status === 'active')
      ensure(pairs.length > 0, '这位志愿者当前没有可暂停的活跃结对。')
      for (const pair of pairs) {
        pair.status = 'paused'; pair.pausedAt = state.clock; pair.pauseReason = `保护性暂停：${command.reason.trim()}`
        pair.pauseOwnerId = actor.id; pair.pauseReviewAt = addDays(state.clock, 3)
        pair.pauseHistory!.push({ start: state.clock, kind: 'pause', sourceId: `volunteer:${volunteer.id}` })
        const support = (state.supportTasks ?? []).find(task => task.pairId === pair.id && task.status === 'open')
        if (!support) state.supportTasks!.push({ id: uid('support-task'), childId: pair.childId, pairId: pair.id, ownerTeacherId: pair.teacherId, dueAt: addDays(state.clock, 3), status: 'open', note: '陪伴暂停后请联系孩子，确认近况与需要的支持。' })
      }
      for (const signal of (state.riskSignals ?? []).filter(item => item.volunteerId === volunteer.id && item.status === 'open')) {
        for (const letterId of signal.letterIds) {
          const letter = state.letters.find(item => item.id === letterId)
          if (!letter) continue
          const exists = (state.evidenceSnapshots ?? []).some(item => item.letterId === letterId && item.capturedBy === actor.id)
          if (!exists) state.evidenceSnapshots!.push({ id: uid('evidence-snapshot'), letterId, versionId: `${letter.id}:${letter.revision ?? 0}`, digest: syntheticDigest(`${letter.title}\n${letter.body}`), capturedBy: actor.id, capturedAt: state.clock, note: `风险信号 ${signal.id} 的证据快照` })
        }
      }
      break
    }
    case 'resume-pair': {
      const pair = pairById(command.id)
      ensure(actor.role === 'operator', '这项操作需要获得相应权限的运营人员处理。', 'FORBIDDEN')
      if (pair.status === 'active') break
      ensure(pair.status !== 'ended', '陪伴已结束，请重新建立结对。')
      const decision = authorize({ actor, action: 'resume-pair', resource: { type: 'pair', id: pair.id }, purpose: 'pair-management', state, now: state.clock })
      ensure(decision.decision === 'allow', decision.decision === 'deny' ? decision.reason : '', 'FORBIDDEN')
      for (const interval of pair.pauseHistory ?? []) if (!interval.end) interval.end = state.clock
      pair.status = 'active'; pair.pausedAt = undefined; pair.pauseReason = undefined; pair.pauseOwnerId = undefined; pair.pauseReviewAt = undefined
      // A previously approved letter stays held until its recipient, version and
      // delivery route are checked again. Resuming a Pair never delivers it.
      break
    }
    case 'end-pair': {
      operator(); const pair = pairById(command.id)
      if (pair.status === 'ended') break
      ensure(command.reason.trim().length >= 2, '请记录结束原因。')
      pair.status = 'ended'; pair.endedAt = state.clock; pair.endReason = command.reason.trim()
      for (const interval of pair.pauseHistory ?? []) if (!interval.end) interval.end = state.clock
      for (const task of state.tasks.filter(t => t.pairId === pair.id && t.status !== 'completed')) { task.status = 'completed'; task.completedAt = state.clock }
      break
    }
    case 'extend-task': {
      operator(); const task = state.tasks.find(t => t.id === command.id)
      ensure(task && task.status !== 'completed', '这条回应任务已结束或不存在。')
      refreshDeadlines(state)
      ensure(Number.isFinite(Date.parse(command.dueAt)) && Date.parse(command.dueAt) > Date.parse(task.dueAt), '新的期限应晚于当前期限。')
      ensure(command.reason.trim().length >= 2, '请记录延期原因。')
      task.baseDueAt = new Date(Date.parse(task.baseDueAt!) + Date.parse(command.dueAt) - Date.parse(task.dueAt)).toISOString(); task.extensionReason = command.reason.trim()
      break
    }
    case 'help': {
      ensure(actor.role !== 'operator', '运营人员请使用独立保护渠道提交或处理个案。', 'FORBIDDEN')
      ensure(typeof command.body === 'string' && command.body.trim().length >= 2 && command.body.length <= 2000, '请写下 2—2000 字的想法。')
      const reportedParty = command.reportedParty ?? 'other'
      ensure(['volunteer', 'teacher', 'operator', 'other'].includes(reportedParty), '请选择求助涉及的对象。')
      const pair = command.pairId ? pairById(command.pairId) : undefined
      ensure(!pair || [pair.childId, pair.volunteerId, pair.teacherId].includes(actor.id), '请选择自己的书信伙伴。', 'FORBIDDEN')
      const reportedPerson = command.reportedPersonId ? state.people.find(p => p.id === command.reportedPersonId) : undefined
      if (command.reportedPersonId) {
        ensure(reportedPerson && reportedParty !== 'other' && reportedPerson.role === reportedParty, '被反映人员与所选身份不一致。')
        if (reportedParty !== 'operator') ensure(state.pairs.some(p => [p.childId, p.volunteerId, p.teacherId].includes(actor.id) && [p.childId, p.volunteerId, p.teacherId].includes(reportedPerson.id)), '请选择与你有关的人员。', 'FORBIDDEN')
      }
      const inferredReportedId = reportedPerson?.id ?? (reportedParty === 'teacher' ? pair?.teacherId : reportedParty === 'volunteer' ? pair?.volunteerId : undefined)
      const excludedActorIds = inferredReportedId ? [inferredReportedId] : []
      const ownerRule = { reportedParty, reportedPersonId: reportedPerson?.id, excludedActorIds }
      const owners = state.people.filter(person => eligibleHelpOwner(person, ownerRule))
      const owner = owners[0]
      ensure(owner, '当前没有可独立接手的保护人员，请联系学校或项目指定负责人。')
      const childId = actor.role === 'child' ? actor.id : pair?.childId
      // When a child only knows that a teacher is involved, no teacher receives
      // the case until the independent platform handler has clarified conflicts.
      const unknownTeacher = reportedParty === 'teacher' && !reportedPerson
      const schoolOwner = childId && !unknownTeacher ? state.people.find(person => person.role === 'teacher' && !excludedActorIds.includes(person.id) && hasTeacherScope(state, person.id, childId, 'protect')) : undefined
      const helpCase: HelpCase = {
        id: uid('help-case'), requesterId: actor.id, pairId: pair?.id, reportedParty, reportedPersonId: reportedPerson?.id,
        excludedActorIds, ownerId: owner.id, backupOwnerId: owners[1]?.id, schoolOwnerId: schoolOwner?.id,
        status: 'open', body: command.body.trim(), createdAt: state.clock, updatedAt: state.clock,
        history: [{ at: state.clock, actorId: actor.id, note: '已提交求助，等待独立保护人员接手。' }],
      }
      state.helpCases!.push(helpCase)
      break
    }
    case 'claim-help-case': {
      const helpCase = state.helpCases!.find(item => item.id === command.id)
      ensure(helpCase, '这个保护个案不存在。')
      ensure(canHandleHelpCase(state, actor, helpCase), '你不能读取或接手这个保护个案。', 'FORBIDDEN')
      if (helpCase.status === 'resolved') break
      helpCase.ownerId = actor.id
      helpCase.status = 'claimed'; helpCase.claimedAt ??= state.clock; helpCase.updatedAt = state.clock
      helpCase.history.push({ at: state.clock, actorId: actor.id, note: '保护人员已接手。' })
      break
    }
    case 'assign-help-case': {
      const helpCase = state.helpCases!.find(item => item.id === command.id)
      ensure(helpCase, '这个保护个案不存在。')
      ensure(canHandleHelpCase(state, actor, helpCase), '你不能转派这个保护个案。', 'FORBIDDEN')
      ensure(helpCase.status !== 'resolved', '已结束的保护个案不能转派。')
      const owner = state.people.find(person => person.id === command.ownerId)
      ensure(owner && eligibleHelpOwner(owner, helpCase), '请选择有受理权限且无需回避的独立保护人员。', 'FORBIDDEN')
      helpCase.ownerId = owner.id; helpCase.status = 'open'; helpCase.claimedAt = undefined; helpCase.updatedAt = state.clock
      helpCase.history.push({ at: state.clock, actorId: actor.id, note: `已转派给${owner.nickname}。` })
      break
    }
    case 'resolve-help-case': {
      const helpCase = state.helpCases!.find(item => item.id === command.id)
      ensure(helpCase, '这个保护个案不存在。')
      ensure(canHandleHelpCase(state, actor, helpCase), '你不能关闭这个保护个案。', 'FORBIDDEN')
      if (helpCase.status === 'resolved') break
      if (helpCase.severity === 'high' && helpCase.reportRequired) {
        if (helpCase.reportDecision === 'not-required') ensure(!!helpCase.reportReason && !!helpCase.reportReviewedBy && helpCase.reportReviewedBy !== actor.id, '免报告结论需要理由与另一名复核人。', 'FORBIDDEN')
        else ensure(!!helpCase.reportedAt && !!helpCase.reportAuthority && !!helpCase.reportReceipt, '高严重度个案必须先填写报告机关与回执。', 'FORBIDDEN')
      }
      ensure(command.note.trim().length >= 3 && command.note.length <= 2000, '请记录至少 3 字的处理情况。')
      helpCase.status = 'resolved'; helpCase.resolution = command.note.trim(); helpCase.updatedAt = state.clock
      helpCase.history.push({ at: state.clock, actorId: actor.id, note: command.note.trim() })
      break
    }
    case 'resolve-followup':
    case 'assign-followup':
    case 'reopen-followup': {
      const followup = state.followups.find(f => f.id === command.id)
      ensure(followup, '这条跟进事项不存在。'); operator(followup.kind === 'help' ? 'safeguarding' : 'administration')
      if (followup.kind === 'help') ensure(canHandleHelp(actor, followup), '被反映人不能接手或处理这条求助。', 'FORBIDDEN')
      if (command.nextFollowupAt) ensure(Number.isFinite(Date.parse(command.nextFollowupAt)) && Date.parse(command.nextFollowupAt) > Date.parse(state.clock), '下次跟进时间应晚于现在。')
      if (command.type === 'assign-followup') { ensure(state.people.some(p => p.id === command.ownerId && p.accountStatus !== 'disabled' && (followup.kind === 'help' ? canHandleHelp(p, followup) : hasPermission(p, 'administration'))), '请选择有处理权限且无需回避的运营人员。'); followup.ownerId = command.ownerId }
      else { ensure(command.note.trim().length >= 3 && command.note.length <= 2000, '请记录至少 3 字的处理情况。'); followup.status = command.type === 'resolve-followup' ? 'resolved' : 'open'; followup.resolution = command.type === 'resolve-followup' ? command.note.trim() : undefined; (followup.history ??= []).push({ at: state.clock, actorId: actor.id, note: command.note.trim() }) }
      followup.nextFollowupAt = command.nextFollowupAt ?? (followup.kind === 'overdue' && command.type === 'resolve-followup' ? addDays(state.clock, 3) : followup.nextFollowupAt)
      followup.updatedAt = state.clock
      break
    }
    case 'grant-access': {
      const targetId = command.targetId
      const target = command.targetType === 'letter' ? state.letters.find(item => item.id === targetId)
        : command.targetType === 'attachment' ? state.attachments.find(item => item.id === targetId)
          : command.targetType === 'help-case' ? state.helpCases!.find(item => item.id === targetId) : undefined
      ensure(target, '请选择这封信、这张图片或这个保护个案。')
      const grantee = state.people.find(person => person.id === command.userId)
      ensure(grantee && grantee.accountStatus !== 'disabled', '请选择有效的受权账号。')
      ensure(command.reason.trim().length >= 5, '请写明至少 5 字的访问理由。')
      ensure(Number.isFinite(Date.parse(command.expiresAt)) && Date.parse(command.expiresAt) > Date.parse(state.clock), '授权到期时间应晚于现在。')
      ensure(Date.parse(command.expiresAt) - Date.parse(state.clock) <= 30 * DAY, '单次授权最长 30 天，到期后请重新审批。')
      const sensitive = command.targetType === 'help-case' || command.purpose === 'audit-review' || command.purpose === 'data-request'
      const pending = state.accessGrants!.find(grant => grant.actorId === command.userId && grant.targetType === command.targetType && grant.targetId === targetId && grant.purpose === command.purpose && !grant.revokedAt && !grant.approvedBy)
      if (pending) {
        ensure(actor.id !== pending.grantedBy, '第二签名必须由另一位负责人完成。', 'FORBIDDEN')
        const second = authorize({ actor, action: 'grant-access', resource: { type: 'none' }, purpose: command.purpose, state, now: state.clock })
        ensure(second.decision === 'allow', second.decision === 'deny' ? second.reason : '', 'FORBIDDEN')
        pending.approvedBy = actor.id
        break
      }
      const decision = authorize({ actor, action: 'grant-access', resource: { type: 'none' }, purpose: command.purpose, state, now: state.clock })
      ensure(decision.decision === 'allow', decision.decision === 'deny' ? decision.reason : '', 'FORBIDDEN')
      state.accessGrants!.push({ id: uid('access-grant'), actorId: command.userId, targetType: command.targetType, targetId, purpose: command.purpose, reason: command.reason.trim(), grantedBy: actor.id, approvedBy: sensitive ? undefined : actor.id, startsAt: state.clock, expiresAt: new Date(command.expiresAt).toISOString() })
      break
    }
    case 'revoke-access': {
      const grant = state.accessGrants!.find(item => item.id === command.id)
      ensure(grant, '这条授权不存在。')
      const decision = authorize({ actor, action: 'revoke-access', resource: { type: 'grant', id: grant.id }, purpose: 'safeguarding-case', state, now: state.clock })
      ensure(decision.decision === 'allow', decision.decision === 'deny' ? decision.reason : '', 'FORBIDDEN')
      if (!grant.revokedAt) grant.revokedAt = state.clock
      if (command.reason) grant.reason = `${grant.reason}（撤销：${command.reason.trim()}）`
      break
    }
    case 'open-emergency-access': {
      ensure(command.targetType !== 'overview', '紧急破窗只能针对单个信封信件、图片或保护个案。')
      const target = command.targetType === 'letter' ? state.letters.find(item => item.id === command.targetId)
        : command.targetType === 'attachment' ? state.attachments.find(item => item.id === command.targetId)
          : state.helpCases!.find(item => item.id === command.targetId)
      ensure(target, '请选择要紧急查看的单个对象。')
      const decision = authorize({ actor, action: 'open-emergency-access', resource: { type: command.targetType, id: command.targetId }, purpose: 'emergency-risk', state, now: state.clock, reason: command.reason })
      ensure(decision.decision === 'allow', decision.decision === 'deny' ? decision.reason : '', 'FORBIDDEN')
      state.accessGrants!.push({ id: uid('access-grant'), actorId: actor.id, targetType: command.targetType, targetId: command.targetId, purpose: 'emergency-risk', reason: command.reason.trim(), grantedBy: actor.id, startsAt: state.clock, expiresAt: new Date(Date.parse(state.clock) + 2 * 3600000).toISOString(), emergency: true, reviewDueAt: addDays(state.clock, 1) })
      break
    }
    case 'review-emergency-access': {
      const grant = state.accessGrants!.find(item => item.id === command.id)
      ensure(grant, '这条紧急访问不存在。')
      const decision = authorize({ actor, action: 'review-emergency-access', resource: { type: 'grant', id: grant.id }, purpose: 'audit-review', state, now: state.clock, note: command.note })
      ensure(decision.decision === 'allow', decision.decision === 'deny' ? decision.reason : '', 'FORBIDDEN')
      ensure(command.decision === 'upheld' || command.decision === 'revoked', '请选择复核结论。')
      grant.reviewedAt = state.clock; grant.reviewedBy = actor.id
      if (command.decision === 'revoked') grant.revokedAt = state.clock
      grant.reason = `${grant.reason}（复核${command.decision === 'upheld' ? '维持' : '撤销'}：${command.note.trim()}）`
      break
    }
    case 'update-help-report': {
      const helpCase = state.helpCases!.find(item => item.id === command.id)
      ensure(helpCase, '这个保护个案不存在。')
      const decision = authorize({ actor, action: 'update-help-report', resource: { type: 'help-case', id: helpCase.id }, purpose: 'safeguarding-case', state, now: state.clock })
      ensure(decision.decision === 'allow', decision.decision === 'deny' ? decision.reason : '', 'FORBIDDEN')
      if (command.reportRequired !== undefined) helpCase.reportRequired = command.reportRequired
      if (command.reportDecision === 'not-required') {
        ensure(command.reportReason?.trim().length && command.reportReason.trim().length >= 3, '请写明不构成法定报告的理由。')
        helpCase.reportDecision = 'not-required'; helpCase.reportReason = command.reportReason.trim(); helpCase.reportReviewedBy = actor.id
        helpCase.reportedAt = undefined; helpCase.reportAuthority = undefined; helpCase.reportReceipt = undefined
      } else if (command.reportDecision === 'reported') {
        ensure(command.reportAuthority?.trim().length && command.reportReceipt?.trim().length, '请填写报告机关与回执编号。')
        helpCase.reportDecision = 'reported'; helpCase.reportedAt = state.clock
        helpCase.reportAuthority = command.reportAuthority.trim(); helpCase.reportReceipt = command.reportReceipt.trim(); helpCase.reportReason = command.reportReason?.trim()
      } else {
        if (command.reportAuthority) helpCase.reportAuthority = command.reportAuthority.trim()
        if (command.reportReceipt) helpCase.reportReceipt = command.reportReceipt.trim()
      }
      helpCase.updatedAt = state.clock
      helpCase.history.push({ at: state.clock, actorId: actor.id, note: '已更新个案报告信息。' })
      break
    }
    case 'escalate-help-case': {
      const helpCase = state.helpCases!.find(item => item.id === command.id)
      ensure(helpCase, '这个保护个案不存在。')
      ensure(helpCase.status !== 'resolved', '已结案的保护个案不能升级。')
      const decision = authorize({ actor, action: 'escalate-help-case', resource: { type: 'help-case', id: helpCase.id }, purpose: 'safeguarding-case', state, now: state.clock })
      ensure(decision.decision === 'allow', decision.decision === 'deny' ? decision.reason : '', 'FORBIDDEN')
      helpCase.escalatedAt = state.clock; helpCase.updatedAt = state.clock
      const backup = helpCase.backupOwnerId ? state.people.find(person => person.id === helpCase.backupOwnerId) : undefined
      if (backup && eligibleHelpOwner(backup, helpCase)) {
        helpCase.ownerId = backup.id; helpCase.status = 'open'; helpCase.claimedAt = undefined
        helpCase.history.push({ at: state.clock, actorId: actor.id, note: `已升级并转交备岗${backup.nickname}。` })
      } else {
        helpCase.history.push({ at: state.clock, actorId: actor.id, note: '已升级，等待人工指派备岗。' })
      }
      break
    }
    case 'open-dispute': {
      ensure(command.reason.trim().length >= 3, '请写明至少 3 字的分歧说明。')
      const school = state.schools?.find(item => item.id === command.schoolId)
      ensure(!state.schools?.length || school?.status === 'active', '请选择有效的学校。')
      const decision = authorize({ actor, action: 'open-dispute', resource: { type: 'dispute', id: command.schoolId }, purpose: 'pair-management', state, now: state.clock })
      ensure(decision.decision === 'allow', decision.decision === 'deny' ? decision.reason : '', 'FORBIDDEN')
      const pair = command.pairId ? pairById(command.pairId) : undefined
      ensure(!command.pairId || pair?.schoolId === command.schoolId, '争议涉及的结对与学校不一致。')
      const safety = ['pause', 'delivery', 'pairing'].includes(command.topic)
      state.disputeCases!.push({ id: uid('dispute'), schoolId: command.schoolId, topic: command.topic, pairId: pair?.id, letterId: command.letterId, caseId: command.caseId, openedBy: actor.id, openedAt: state.clock, status: safety ? 'joint-review' : 'open', reason: command.reason.trim() })
      if (safety && pair && pair.status !== 'ended') {
        pair.status = 'paused'; pair.pausedAt = state.clock; pair.pauseReason = '安全风险：存在未裁决争议'
        pair.pauseOwnerId = actor.id; pair.pauseReviewAt = addDays(state.clock, 3)
        pair.pauseHistory!.push({ start: state.clock, kind: 'pause', sourceId: `dispute:${pair.id}` })
      }
      break
    }
    case 'decide-dispute': {
      ensure(command.reason.trim().length >= 3, '请写明至少 3 字的裁决理由。')
      const dispute = state.disputeCases!.find(item => item.id === command.id)
      ensure(dispute, '这个争议不存在。')
      const decision = authorize({ actor, action: 'decide-dispute', resource: { type: 'dispute', id: dispute.id }, purpose: 'pair-management', state, now: state.clock })
      ensure(decision.decision === 'allow', decision.decision === 'deny' ? decision.reason : '', 'FORBIDDEN')
      if (dispute.decision && dispute.decision !== command.decision) fail('两次签名选择的裁决方向不一致。', 'FORBIDDEN')
      dispute.decision = command.decision
      if (actor.role === 'teacher') dispute.schoolDecisionBy = actor.id
      else dispute.platformDecisionBy = actor.id
      dispute.reason = command.reason.trim()
      if (dispute.schoolDecisionBy && dispute.platformDecisionBy && dispute.schoolDecisionBy !== dispute.platformDecisionBy) { dispute.status = 'decided'; dispute.decidedAt = state.clock }
      break
    }
    case 'review-risk-signal': {
      const signal = state.riskSignals!.find(item => item.id === command.id)
      ensure(signal, '这个风险信号不存在。')
      ensure(['dismiss', 'pause-volunteer', 'open-case'].includes(command.action), '请选择处置方式。')
      if (command.action === 'dismiss') ensure(command.note.trim().length >= 5, '请写明至少 5 字的排除理由。')
      const decision = authorize({ actor, action: 'review-risk-signal', resource: { type: 'risk-signal', id: signal.id }, purpose: 'content-review', state, now: state.clock, note: command.note })
      ensure(decision.decision === 'allow', decision.decision === 'deny' ? decision.reason : '', 'FORBIDDEN')
      if (command.action === 'pause-volunteer') {
        for (const pair of state.pairs.filter(item => item.volunteerId === signal.volunteerId && item.status === 'active')) {
          pair.status = 'paused'; pair.pausedAt = state.clock; pair.pauseReason = `保护性暂停：${command.note.trim()}`
          pair.pauseOwnerId = actor.id; pair.pauseReviewAt = addDays(state.clock, 3)
          pair.pauseHistory!.push({ start: state.clock, kind: 'pause', sourceId: `volunteer:${signal.volunteerId}` })
          if (!state.supportTasks!.some(task => task.pairId === pair.id && task.status === 'open')) state.supportTasks!.push({ id: uid('support-task'), childId: pair.childId, pairId: pair.id, ownerTeacherId: pair.teacherId, dueAt: addDays(state.clock, 3), status: 'open', note: '陪伴暂停后请联系孩子，确认近况与需要的支持。' })
        }
      }
      if (command.action === 'open-case') {
        const reportedPersonId = signal.volunteerId
        const excludedActorIds = [reportedPersonId]
        const owner = state.people.find(person => eligibleHelpOwner(person, { reportedParty: 'volunteer', reportedPersonId, excludedActorIds }) && person.id !== actor.id)
        ensure(owner, '当前没有可独立接手的保护人员。')
        state.helpCases!.push({ id: uid('help-case'), requesterId: actor.id, pairId: signal.pairIds[0], reportedParty: 'volunteer', reportedPersonId, excludedActorIds, ownerId: owner.id, status: 'open', body: `风险信号复核：${command.note.trim()}`, createdAt: state.clock, updatedAt: state.clock, severity: signal.severity, slaDueAt: addDays(state.clock, 2), reportRequired: signal.severity === 'high', history: [{ at: state.clock, actorId: actor.id, note: '由风险信号复核建立保护个案。' }] })
      }
      signal.status = command.action === 'dismiss' ? 'dismissed' : 'actioned'
      signal.reviewedBy = actor.id; signal.reviewedAt = state.clock
      signal.action = command.action; signal.note = command.note.trim()
      break
    }
    case 'complete-support-task': {
      const task = state.supportTasks!.find(item => item.id === command.id)
      ensure(task, '这项支持任务不存在。')
      ensure(task.status === 'open', '这项支持任务已完成。')
      const decision = authorize({ actor, action: 'complete-support-task', resource: { type: 'support-task', id: task.id }, purpose: 'safeguarding-case', state, now: state.clock, note: command.note })
      ensure(decision.decision === 'allow', decision.decision === 'deny' ? decision.reason : '', 'FORBIDDEN')
      task.status = 'done'; task.completedAt = state.clock; task.note = command.note.trim()
      break
    }
    case 'complete-training': {
      ensure(command.version === TRAINING_VERSION, '请完成当前版本的行为边界培训。')
      const decision = authorize({ actor, action: 'complete-training', resource: { type: 'training', id: command.version }, purpose: 'home-overview', state, now: state.clock })
      ensure(decision.decision === 'allow', decision.decision === 'deny' ? decision.reason : '', 'FORBIDDEN')
      state.trainingRecords!.push({ id: uid('training'), volunteerId: actor.id, version: TRAINING_VERSION, completedAt: state.clock })
      break
    }
    case 'set-clock': {
      operator(); ensure(!options.formal, '真实试用使用服务端时间，不支持调整演示日期。')
      const value = Date.parse(command.value); ensure(Number.isFinite(value) && value >= Date.parse(state.clock), '演示时间只能向前调整。需要重新开始时，请重置演示。')
      state.clock = new Date(value).toISOString()
      break
    }
    default: fail('不支持的业务操作。')
  }
  reconcileFollowups(state)
  return state
}

export async function validateAttachment(file: File): Promise<void> {
  ensure(file.size > 0 && file.size <= 3 * 1024 * 1024, '图片不能超过 3 MiB，请选择一张较小的图片。')
  ensure(file.type === 'image/png' || file.type === 'image/jpeg', '请选择 PNG 或 JPEG 图片。')
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => header[index] === byte)
  const jpeg = header[0] === 255 && header[1] === 216 && header[2] === 255
  ensure((file.type === 'image/png' && png) || (file.type === 'image/jpeg' && jpeg), '这张图片的实际格式与文件类型不一致，请重新选择。')
}

