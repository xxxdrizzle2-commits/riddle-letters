import type { AppState, Attachment, Command, Letter, Person, ReplyTask, Riddle, TimeInterval } from './types'

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
      { id: 'c1', role: 'child', nickname: '小禾', subtitle: '喜欢收集秋天的小发现', avatar: '🌱', interests: ['画画', '植物', '猜谜'] },
      { id: 'c2', role: 'child', nickname: '阿川', subtitle: '想知道更多关于星空的事', avatar: '⛵', interests: ['星空', '折纸', '足球'] },
      { id: 'c3', role: 'child', nickname: '芽芽', subtitle: '等待认识一位书信伙伴', avatar: '🌻', interests: ['故事', '小动物'] },
      { id: 'v1', role: 'volunteer', nickname: '林语', subtitle: '大学生志愿者 · 爱读故事和散步', avatar: '🍃', interests: ['阅读', '植物'] },
      { id: 'v2', role: 'volunteer', nickname: '许舟', subtitle: '大学生志愿者 · 喜欢仰望星空', avatar: '🪁', interests: ['天文', '运动'] },
      { id: 'v3', role: 'volunteer', nickname: '苏宁', subtitle: '大学生志愿者 · 已完成演示审核', avatar: '🌼', interests: ['故事', '小动物'] },
      { id: 't1', role: 'teacher', nickname: '陈老师', subtitle: '协助小禾和芽芽收发书信', avatar: '📚', interests: [] },
      { id: 't2', role: 'teacher', nickname: '周老师', subtitle: '协助阿川收发纸质书信', avatar: '📖', interests: [] },
      { id: 'op1', role: 'operator', nickname: '小满', subtitle: '陪伴计划运营 · 守护每一次交流', avatar: '✉️', interests: [] },
    ],
    pairs: [
      { id: 'p1', childId: 'c1', volunteerId: 'v1', teacherId: 't1', channel: 'online', status: 'active', startedAt: '2026-09-01T09:00:00+08:00' },
      { id: 'p2', childId: 'c2', volunteerId: 'v2', teacherId: 't2', channel: 'paper', status: 'active', startedAt: '2026-09-01T09:00:00+08:00' },
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
    followups: [{ id: 'overdue-task-l6', pairId: 'p2', taskId: 'task-l6', kind: 'overdue', status: 'open', note: '阿川的回信尚未收到，请先了解收发情况，给予充分的时间。', createdAt: '2026-10-16T09:00:00+08:00', updatedAt: '2026-10-16T09:00:00+08:00' }], attachments: [],
  }
}

const fail = (message: string): never => { throw new Error(message) }
function ensure(condition: unknown, message: string): asserts condition { if (!condition) fail(message) }
const uid = (prefix: string) => `${prefix}-${crypto.randomUUID()}`
const addDays = (iso: string, days: number) => new Date(Date.parse(iso) + days * DAY).toISOString()
export const hasPermission = (actor: Person, permission: NonNullable<Person['permissions']>[number]) => actor.role === 'operator' && (!actor.permissions || actor.permissions.includes(permission))

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
  for (const letter of state.letters) {
    letter.recipientId ??= recipientForLetter(state, letter)
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
  if (actor.accountStatus === 'disabled') return false
  if (letter.authorId === actor.id) return true
  if (actor.role === 'operator') return hasPermission(actor, 'review') && letter.moderation !== 'draft'
  const pair = state.pairs.find(p => p.id === letter.pairId)
  if (!pair) return false
  if (actor.role === 'teacher' && actor.id === pair.teacherId) {
    return letter.createdBy === actor.id || (pair.channel === 'paper' && letter.moderation === 'approved')
  }
  return recipientForLetter(state, letter) === actor.id && letter.moderation === 'approved' && !!state.deliveries.find(d => d.letterId === letter.id)?.deliveredAt
}

export function visibleLetters(state: AppState, actor: Person): Letter[] {
  return state.letters.filter(l => canReadLetter(state, actor, l)).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}

/** Server-side projection: never ship all records and rely on UI hiding. */
export function scopeState(previous: AppState, actorId: string): AppState {
  const state = normalizeState(previous)
  const actor = state.people.find(p => p.id === actorId)
  ensure(actor && actor.accountStatus !== 'disabled', '账号不可用，请重新登录或联系负责老师。')
  const operator = actor.role === 'operator'
  const administered = hasPermission(actor, 'administration')
  const reviewPairs = new Set(hasPermission(actor, 'review') ? state.letters.filter(l => l.moderation !== 'draft').map(l => l.pairId) : [])
  const helpPairs = new Set(hasPermission(actor, 'safeguarding') ? state.followups.filter(f => f.kind === 'help').map(f => f.pairId) : [])
  state.pairs = state.pairs.filter(p => administered || reviewPairs.has(p.id) || helpPairs.has(p.id) || (!operator && (p.childId === actorId || p.volunteerId === actorId || p.teacherId === actorId)))
  const relatedIds = new Set([actorId, ...state.pairs.flatMap(p => [p.childId, p.volunteerId, p.teacherId])])
  state.people = state.people.filter(p => administered || relatedIds.has(p.id) || (actor.role === 'teacher' && p.teacherId === actorId) || (hasPermission(actor, 'safeguarding') && state.followups.some(f => f.kind === 'help' && f.requesterId === p.id)))
  state.letters = visibleLetters(state, actor).map(letter => {
    if (letter.authorId === actorId || letter.createdBy === actorId || hasPermission(actor, 'review')) return letter
    return { ...letter, submissionVersions: [], moderationNote: undefined, coveredLetterIds: [] }
  })
  const letterIds = new Set(state.letters.map(l => l.id))
  const pairIds = new Set(state.pairs.map(p => p.id))
  state.deliveries = state.deliveries.filter(d => letterIds.has(d.letterId))
  state.tasks = state.tasks.filter(t => pairIds.has(t.pairId) && (administered || t.recipientId === actorId || (actor.role === 'teacher' && state.pairs.some(p => p.id === t.pairId && p.channel === 'paper' && t.recipientId === p.childId))))
  state.reviews = state.reviews.filter(r => state.letters.some(l => l.id === r.letterId && (l.authorId === actorId || l.createdBy === actorId || hasPermission(actor, 'review'))))
  state.followups = state.followups.filter(f => f.kind === 'help' ? f.requesterId === actorId || hasPermission(actor, 'safeguarding') : operator && hasPermission(actor, 'administration'))
  const attachmentIds = new Set(state.letters.flatMap(l => [l.attachmentId, ...(l.submissionVersions ?? []).map(v => v.attachmentId)]).filter(Boolean))
  state.attachments = state.attachments.filter(a => attachmentIds.has(a.id))
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
  return task.status === 'awaiting' && state.pairs.find(p => p.id === task.pairId)?.status === 'active' && Date.parse(state.clock) > Date.parse(task.dueAt)
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

function deliver(state: AppState, letter: Letter): void {
  const pair = state.pairs.find(p => p.id === letter.pairId)!
  if (pair.status !== 'active') return
  let delivery = state.deliveries.find(d => d.letterId === letter.id)
  if (!delivery) { delivery = { letterId: letter.id }; state.deliveries.push(delivery) }
  if (delivery.deliveredAt) return
  delivery.deliveredAt = state.clock
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
    if (target && (target.status === 'completed' || !state.tasks.some(t => t.pairId === target.pairId && t.recipientId === target.recipientId && t.status !== 'completed'))) { followup.status = 'resolved'; followup.resolution = '待回应的信件已完成。'; followup.updatedAt = state.clock }
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
  const operator = (permission: NonNullable<Person['permissions']>[number] = 'administration') => ensure(hasPermission(actor, permission), '这项操作需要获得相应权限的运营人员处理。')
  const editable = (letter: Letter) => {
    const pair = state.pairs.find(p => p.id === letter.pairId)
    ensure(actor.id === letter.authorId || (actor.role === 'teacher' && pair?.teacherId === actor.id && letter.createdBy === actor.id), '你只能修改自己写的信或自己代录的回信。')
    ensure(!pair || pair.status !== 'ended', '这组陪伴已经结束。')
    ensure(letter.moderation === 'draft' || letter.moderation === 'returned', '这封信已提交，请等待审核结果。')
  }
  switch (command.type) {
    case 'match': {
      operator()
      const existing = state.pairs.find(p => p.status !== 'ended' && p.childId === command.childId && p.volunteerId === command.volunteerId)
      if (existing) break
      const child = state.people.find(p => p.id === command.childId && p.role === 'child')
      const volunteer = state.people.find(p => p.id === command.volunteerId && p.role === 'volunteer')
      ensure(child && volunteer && state.people.some(p => p.id === command.teacherId && p.role === 'teacher'), '请选择有效的小朋友、志愿者和老师。')
      if (options.formal) { ensure(child.guardianConsent && child.accountStatus === 'active', '请先完成有效的监护授权。'); ensure(volunteer.volunteerApproved && volunteer.accountStatus === 'active', '志愿者尚未通过审核。'); ensure(child.teacherId === command.teacherId, '只能选择负责这位小朋友的老师。') }
      ensure(!state.pairs.some(p => p.status !== 'ended' && (p.childId === child.id || p.volunteerId === volunteer.id)), '这位伙伴已有结对，请选择尚未结对的伙伴。')
      const id = uid('pair'), dueAt = addDays(state.clock, 7)
      state.pairs.push({ id, childId: child.id, volunteerId: volunteer.id, teacherId: command.teacherId, channel: command.channel, status: 'active', startedAt: state.clock, pauseHistory: [] })
      state.tasks.push({ id: `first-${id}`, pairId: id, letterId: '', recipientId: volunteer.id, dueAt, baseDueAt: dueAt, createdAt: state.clock, status: 'awaiting', kind: 'first-letter', exclusions: [] })
      break
    }
    case 'save-letter': {
      const pair = command.pairId ? pairById(command.pairId) : undefined
      ensure(!pair || pair.status !== 'ended', '这组陪伴已经结束。')
      ensure(command.title.trim().length <= 60, '标题请控制在 60 字以内。')
      ensure(command.id === undefined || (command.id.trim().length > 0 && command.id.length <= 120), '这封信的标识无效。')
      ensure(command.body.length <= 6000, '信件正文请控制在 6000 字以内。')
      ensure(!command.riddleId || riddles.some(r => r.id === command.riddleId), '这道谜语不存在，请重新选择。')
      ensure(actor.role === 'child' || actor.role === 'volunteer' || (actor.role === 'teacher' && pair?.teacherId === actor.id), '你没有写这封信的权限。')
      const authorId = actor.role === 'teacher' ? pair!.childId : actor.id
      ensure(!command.authorId || command.authorId === authorId, '不能替换写信人。')
      ensure(!pair || authorId === pair.childId || authorId === pair.volunteerId, '请选择自己的书信伙伴。')
      ensure(pair || !state.pairs.some(p => p.status !== 'ended' && (p.childId === actor.id || p.volunteerId === actor.id)), '请将草稿写给当前的书信伙伴。')
      const recipientId = pair ? authorId === pair.childId ? pair.volunteerId : pair.childId : undefined
      ensure(!command.recipientId || command.recipientId === recipientId, '不能向未结对的人寄信。')
      if (command.replyTo) { const original = letterById(command.replyTo); ensure(original.pairId === pair?.id && recipientForLetter(state, original) === authorId && original.moderation === 'approved' && state.deliveries.some(d => d.letterId === original.id && d.deliveredAt), '原信确认送达后，才可以写回信。') }
      let letter = command.id ? state.letters.find(l => l.id === command.id) : state.letters.find(l => l.pairId === command.pairId && l.authorId === authorId && l.createdBy === actor.id && l.replyTo === command.replyTo && (l.moderation === 'draft' || l.moderation === 'returned') && l.title === command.title.trim() && l.body === command.body && l.riddleId === command.riddleId)
      if (letter) {
        editable(letter)
        const introductionBinding = !letter.pairId && !!pair && !letter.replyTo && letter.authorId === actor.id
        ensure((letter.pairId === command.pairId || introductionBinding) && letter.authorId === authorId && letter.replyTo === command.replyTo, '修改时不能更换信件的伙伴或原信。')
        const unchanged = !command.file && !command.removeAttachment && (!command.attachmentId || command.attachmentId === letter.attachmentId) && letter.pairId === command.pairId && letter.title === command.title.trim() && letter.body === command.body && letter.riddleId === command.riddleId
        if (unchanged) break
        ensure(command.expectedRevision === undefined || command.expectedRevision === letter.revision, '这封草稿已在另一台设备更新。请保留当前文字，重新载入后合并。')
        if (introductionBinding) { letter.pairId = pair.id; letter.recipientId = recipientId }
      } else {
        ensure(command.expectedRevision === undefined || command.expectedRevision === 0, '这封草稿的版本已变化，请重新载入。')
        letter = { id: command.id ?? uid('letter'), pairId: command.pairId, authorId, recipientId, createdBy: actor.id, title: '', body: '', replyTo: command.replyTo, moderation: 'draft', createdAt: state.clock, updatedAt: state.clock, revision: 0, coveredLetterIds: [], submissionVersions: [] }
        state.letters.push(letter)
      }
      letter.title = command.title.trim(); letter.body = command.body; letter.riddleId = command.riddleId; letter.updatedAt = state.clock; letter.revision = (letter.revision ?? 0) + 1
      if (command.removeAttachment) letter.attachmentId = undefined
      if (command.attachmentId) {
        const attachment = state.attachments.find(a => a.id === command.attachmentId)
        ensure(attachment && attachment.ownerId === actor.id && (!attachment.pairId || attachment.pairId === command.pairId), '附件不属于当前账号或书信伙伴。')
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
      ensure(actor.id === letter.authorId || actor.id === letter.createdBy, '你不能提交这封信。')
      active(letter.pairId)
      if (letter.moderation === 'pending' || letter.moderation === 'approved') break
      editable(letter)
      ensure(letter.body.trim().length > 0 || letter.attachmentId, '写下一点想分享的事，或附上手写信图片后再寄出。')
      if (options.formal && actor.role === 'teacher') ensure(command.confirmedByChild, '请先让小朋友核对代录内容，再确认提交。')
      if (actor.role === 'teacher' && command.confirmedByChild) letter.childConfirmedAt = state.clock
      letter.title ||= letter.body.trim().split(/\r?\n/)[0].slice(0, 24) || '给伙伴的一封信'
      const coverage = [...new Set(command.coveredLetterIds ?? (letter.replyTo ? [letter.replyTo] : []))]
      for (const id of coverage) ensure(state.tasks.some(t => t.letterId === id && t.pairId === letter.pairId && t.recipientId === letter.authorId && t.status === 'awaiting'), '所选来信已被回应或正在审核，请重新选择。')
      letter.coveredLetterIds = coverage
      letter.submissionVersions!.push({ revision: letter.revision!, title: letter.title, body: letter.body, riddleId: letter.riddleId, attachmentId: letter.attachmentId, coveredLetterIds: [...coverage], submittedAt: state.clock, submittedBy: actor.id })
      letter.moderation = 'pending'; letter.updatedAt = state.clock
      for (const task of state.tasks.filter(t => t.pairId === letter.pairId && t.recipientId === letter.authorId && (coverage.includes(t.letterId) || t.kind === 'first-letter') && t.status === 'awaiting')) { task.status = 'review'; task.reviewLetterId = letter.id; task.exclusions!.push({ start: state.clock, kind: 'review', sourceId: letter.id }) }
      break
    }
    case 'review-letter': {
      operator('review')
      const letter = letterById(command.id)
      if (letter.moderation === command.decision) break
      ensure(letter.moderation === 'pending', '只有待审核的信件可以审核。')
      const pair = pairById(letter.pairId)
      ensure(pair.status !== 'ended' || command.decision === 'returned', '陪伴已结束，不能继续送出信件。')
      ensure(command.decision === 'approved' || command.note.trim().length >= 3, '请写下具体的修改建议。')
      letter.moderation = command.decision; letter.moderationNote = command.note.trim(); letter.updatedAt = state.clock
      state.reviews.push({ id: uid('review'), letterId: letter.id, operatorId: actor.id, decision: command.decision, note: command.note.trim(), createdAt: state.clock, revision: letter.revision })
      for (const task of state.tasks.filter(t => t.reviewLetterId === letter.id && t.status === 'review')) {
        for (const interval of task.exclusions ?? []) if (interval.kind === 'review' && interval.sourceId === letter.id && !interval.end) interval.end = state.clock
        task.status = command.decision === 'approved' ? 'completed' : 'awaiting'; task.reviewLetterId = undefined
        if (task.status === 'completed') task.completedAt = state.clock
      }
      if (command.decision === 'approved') {
        if (!state.deliveries.some(d => d.letterId === letter.id)) state.deliveries.push({ letterId: letter.id })
        if (pair.channel === 'online') deliver(state, letter)
      }
      break
    }
    case 'print':
    case 'deliver': {
      ensure(actor.role === 'teacher', '请使用负责收发的老师账号。')
      for (const id of new Set(command.ids)) {
        const letter = letterById(id), pair = active(letter.pairId)
        ensure(pair.teacherId === actor.id && pair.channel === 'paper' && letter.moderation === 'approved', '只能处理自己负责的、已审核通过的纸质信件。')
        let delivery = state.deliveries.find(d => d.letterId === id)
        if (!delivery) { delivery = { letterId: id }; state.deliveries.push(delivery) }
        if (command.type === 'print') delivery.printedAt ??= state.clock
        else { ensure(delivery.printedAt, '请先打印这封信，再确认实际交付。'); deliver(state, letter) }
      }
      break
    }
    case 'read': {
      const letter = letterById(command.id)
      ensure(canReadLetter(state, actor, letter), '这封信暂时不在你的可读范围内。')
      if (recipientForLetter(state, letter) === actor.id) { const delivery = state.deliveries.find(d => d.letterId === letter.id); ensure(letter.moderation === 'approved' && delivery?.deliveredAt, '信件尚未送达。'); delivery.readAt ??= state.clock }
      break
    }
    case 'pause-pair': {
      operator(); const pair = pairById(command.id)
      if (pair.status === 'paused') break
      ensure(pair.status !== 'ended', '陪伴已结束。'); ensure(command.reason.trim().length >= 2, '请记录暂停原因。')
      pair.status = 'paused'; pair.pausedAt = state.clock; pair.pauseReason = command.reason.trim(); pair.pauseHistory!.push({ start: state.clock, kind: 'pause', sourceId: pair.id })
      break
    }
    case 'resume-pair': {
      operator(); const pair = pairById(command.id)
      if (pair.status === 'active') break
      ensure(pair.status !== 'ended', '陪伴已结束，请重新建立结对。')
      for (const interval of pair.pauseHistory ?? []) if (!interval.end) interval.end = state.clock
      pair.status = 'active'; pair.pausedAt = undefined; pair.pauseReason = undefined
      for (const letter of state.letters.filter(l => l.pairId === pair.id && l.moderation === 'approved' && !state.deliveries.some(d => d.letterId === l.id && d.deliveredAt))) if (pair.channel === 'online') deliver(state, letter)
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
      ensure(actor.role !== 'operator', '运营人员请在跟进事项中记录处理情况。')
      ensure(command.body.trim().length >= 2 && command.body.length <= 2000, '请写下 2—2000 字的想法。')
      const pair = command.pairId ? pairById(command.pairId) : state.pairs.find(p => p.status !== 'ended' && (p.childId === actor.id || p.volunteerId === actor.id))
      ensure(!pair || [pair.childId, pair.volunteerId, pair.teacherId].includes(actor.id), '请选择自己的书信伙伴。')
      state.followups.push({ id: uid('help'), pairId: pair?.id, requesterId: actor.id, ownerId: state.people.find(p => hasPermission(p, 'safeguarding'))?.id, kind: 'help', status: 'open', note: `${actor.nickname}：${command.body.trim()}`, createdAt: state.clock, updatedAt: state.clock, history: [] })
      break
    }
    case 'resolve-followup':
    case 'assign-followup':
    case 'reopen-followup': {
      const followup = state.followups.find(f => f.id === command.id)
      ensure(followup, '这条跟进事项不存在。'); operator(followup.kind === 'help' ? 'safeguarding' : 'administration')
      if (command.nextFollowupAt) ensure(Number.isFinite(Date.parse(command.nextFollowupAt)) && Date.parse(command.nextFollowupAt) > Date.parse(state.clock), '下次跟进时间应晚于现在。')
      if (command.type === 'assign-followup') { ensure(state.people.some(p => p.id === command.ownerId && hasPermission(p, followup.kind === 'help' ? 'safeguarding' : 'administration')), '请选择有处理权限的运营人员。'); followup.ownerId = command.ownerId }
      else { ensure(command.note.trim().length >= 3 && command.note.length <= 2000, '请记录至少 3 字的处理情况。'); followup.status = command.type === 'resolve-followup' ? 'resolved' : 'open'; followup.resolution = command.type === 'resolve-followup' ? command.note.trim() : undefined; (followup.history ??= []).push({ at: state.clock, actorId: actor.id, note: command.note.trim() }) }
      followup.nextFollowupAt = command.nextFollowupAt ?? (followup.kind === 'overdue' && command.type === 'resolve-followup' ? addDays(state.clock, 3) : followup.nextFollowupAt)
      followup.updatedAt = state.clock
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

