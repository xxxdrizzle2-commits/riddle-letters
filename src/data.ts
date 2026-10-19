import Dexie, { type Table } from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import type { AppState, Attachment, Command, Letter, Person, ReplyTask, Riddle } from './types'

const DAY = 86_400_000
const db = new Dexie('riddle-letter-demo-v1') as Dexie & { snapshots: Table<AppState, string> }
db.version(1).stores({ snapshots: 'id' })

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

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', timeZone: 'Asia/Shanghai' }).format(new Date(iso))
}

export function isOverdue(state: AppState, task: ReplyTask): boolean {
  return task.status === 'awaiting' && state.pairs.find(p => p.id === task.pairId)?.status === 'active' && Date.parse(state.clock) > Date.parse(task.dueAt)
}

export function canReadLetter(state: AppState, actor: Person, letter: Letter): boolean {
  if (actor.role === 'operator') return true
  const pair = state.pairs.find(p => p.id === letter.pairId)
  if (!pair) return false
  if (actor.role === 'volunteer' && actor.id === pair.volunteerId) return letter.authorId === actor.id || !!(letter.replyTo && letter.moderation === 'approved' && state.deliveries.find(d => d.letterId === letter.id)?.deliveredAt)
  if (actor.role === 'child' && actor.id === pair.childId) return letter.authorId === actor.id || !!(!letter.replyTo && letter.moderation === 'approved' && state.deliveries.find(d => d.letterId === letter.id)?.deliveredAt)
  if (actor.role === 'teacher' && actor.id === pair.teacherId) return (!letter.replyTo && letter.moderation === 'approved') || (letter.createdBy === actor.id && !!letter.replyTo)
  return false
}

export function visibleLetters(state: AppState, actor: Person): Letter[] {
  return state.letters.filter(letter => canReadLetter(state, actor, letter)).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}

function deliver(state: AppState, letter: Letter): void {
  let delivery = state.deliveries.find(d => d.letterId === letter.id)
  if (!delivery) { delivery = { letterId: letter.id }; state.deliveries.push(delivery) }
  if (delivery.deliveredAt) return
  delivery.deliveredAt = state.clock
  if (!letter.replyTo && !state.tasks.some(t => t.letterId === letter.id)) {
    state.tasks.push({ id: `task-${letter.id}`, letterId: letter.id, pairId: letter.pairId, dueAt: addDays(state.clock, 14), status: 'awaiting' })
  }
}

function reconcileFollowups(state: AppState): void {
  for (const task of state.tasks) {
    if (isOverdue(state, task) && !state.followups.some(f => f.taskId === task.id && f.kind === 'overdue')) {
      state.followups.push({ id: `overdue-${task.id}`, pairId: task.pairId, taskId: task.id, kind: 'overdue', status: 'open', note: '回信暂未收到。请先了解伙伴的近况与收发情况，温和跟进。', createdAt: state.clock, updatedAt: state.clock })
    }
  }
}

/** Pure transition function. File signatures are checked by dispatch before entering the transaction. */
export function reduceCommand(previous: AppState, actorId: string, command: Command): AppState {
  const state = structuredClone(previous)
  const actor = state.people.find(p => p.id === actorId)
  ensure(actor, '演示身份不存在，请重新选择身份。')
  const pairById = (id: string) => state.pairs.find(p => p.id === id) ?? fail('这组陪伴关系不存在。')
  const letterById = (id: string) => state.letters.find(l => l.id === id) ?? fail('这封信不存在。')
  const active = (pairId: string) => { const pair = pairById(pairId); ensure(pair.status === 'active', '这组陪伴正在暂停，恢复后再继续操作。'); return pair }
  const operator = () => ensure(actor.role === 'operator', '这项操作需要切换到运营演示身份。')
  const editable = (letter: Letter) => {
    const pair = pairById(letter.pairId)
    ensure((actor.id === letter.authorId && (actor.id === pair.volunteerId || actor.id === pair.childId)) || (actor.role === 'teacher' && actor.id === pair.teacherId && actor.id === letter.createdBy && !!letter.replyTo), '你只能修改自己写的信或自己代录的回信。')
    ensure(letter.moderation === 'draft' || letter.moderation === 'returned', '这封信已提交，请等待审核结果。')
  }

  switch (command.type) {
    case 'match': {
      operator()
      const existing = state.pairs.find(p => p.childId === command.childId && p.volunteerId === command.volunteerId)
      if (existing) break
      ensure(state.people.some(p => p.id === command.childId && p.role === 'child'), '请选择一位小朋友。')
      ensure(state.people.some(p => p.id === command.volunteerId && p.role === 'volunteer'), '请选择一位志愿者。')
      ensure(state.people.some(p => p.id === command.teacherId && p.role === 'teacher'), '请选择协助收发的老师。')
      ensure(!state.pairs.some(p => p.childId === command.childId || p.volunteerId === command.volunteerId), '这位伙伴已有结对，请选择尚未结对的伙伴。')
      state.pairs.push({ id: uid('pair'), childId: command.childId, volunteerId: command.volunteerId, teacherId: command.teacherId, channel: command.channel, status: 'active', startedAt: state.clock })
      break
    }
    case 'save-letter': {
      const pair = active(command.pairId)
      ensure(command.title.trim().length <= 60, '标题请控制在 60 字以内。')
      ensure(command.id === undefined || (command.id.trim().length > 0 && command.id.length <= 120), '这封信的标识无效，请重新打开编辑区。')
      ensure(command.body.length <= 6000, '信件正文请控制在 6000 字以内。')
      ensure(!command.riddleId || riddles.some(r => r.id === command.riddleId), '这道谜语不存在，请重新选择。')
      let authorId: string
      if (command.replyTo) {
        const original = letterById(command.replyTo)
        ensure(original.pairId === pair.id && !original.replyTo && original.authorId === pair.volunteerId && original.moderation === 'approved' && state.deliveries.some(d => d.letterId === original.id && d.deliveredAt), '原信确认送达后，才可以写回信。')
        ensure(actor.id === pair.childId || (actor.role === 'teacher' && actor.id === pair.teacherId), '这封回信应由小朋友或协助老师填写。')
        ensure(state.tasks.some(t => t.letterId === original.id && t.status !== 'completed'), '这一轮回信已经完成。')
        authorId = pair.childId
      } else {
        ensure(actor.role === 'volunteer' && actor.id === pair.volunteerId, '请用已结对的志愿者身份写信。')
        authorId = actor.id
      }
      let letter = command.id ? state.letters.find(l => l.id === command.id) : state.letters.find(l => l.pairId === pair.id && l.authorId === authorId && l.replyTo === command.replyTo && l.createdBy === actor.id && (l.moderation === 'draft' || l.moderation === 'returned') && (command.replyTo || (l.title === command.title.trim() && l.body === command.body && l.riddleId === command.riddleId)))
      if (letter) {
        editable(letter)
        ensure(letter.pairId === pair.id && letter.replyTo === command.replyTo && letter.authorId === authorId, '修改时不能更换信件的伙伴或原信。')
      } else {
        ensure(!command.replyTo || !state.letters.some(l => l.replyTo === command.replyTo && (l.moderation === 'pending' || l.moderation === 'approved')), '这封原信的回信已提交，请等待审核。')
        letter = { id: command.id ?? uid('letter'), pairId: pair.id, authorId, createdBy: actor.id, title: '', body: '', replyTo: command.replyTo, moderation: 'draft', createdAt: state.clock, updatedAt: state.clock }
        state.letters.push(letter)
      }
      letter.title = command.title.trim(); letter.body = command.body; letter.riddleId = command.riddleId; letter.updatedAt = state.clock
      if (command.removeAttachment) letter.attachmentId = undefined
      if (command.file) {
        const attachment: Attachment = { id: uid('attachment'), pairId: pair.id, name: command.file.name, type: command.file.type, blob: command.file }
        state.attachments.push(attachment); letter.attachmentId = attachment.id
      }
      state.attachments = state.attachments.filter(a => state.letters.some(l => l.attachmentId === a.id))
      break
    }
    case 'submit-letter': {
      const letter = letterById(command.id)
      active(letter.pairId)
      if (letter.moderation === 'pending') {
        ensure(actor.id === letter.authorId || actor.id === letter.createdBy, '你不能提交这封信。')
        break
      }
      editable(letter)
      ensure(letter.title.trim().length >= 1 && letter.title.trim().length <= 60, '请先给这封信取一个 1—60 字的名字。')
      ensure(letter.body.trim().length >= 10 || letter.attachmentId, '再写几句吧：正文至少 10 字，或附上演示手写回信图片。')
      if (letter.replyTo) ensure(!state.letters.some(l => l.id !== letter.id && l.replyTo === letter.replyTo && (l.moderation === 'pending' || l.moderation === 'approved')), '这一轮已有回信在审核中。')
      letter.moderation = 'pending'; letter.updatedAt = state.clock
      if (letter.replyTo) { const task = state.tasks.find(t => t.letterId === letter.replyTo); if (task) task.status = 'review' }
      break
    }
    case 'review-letter': {
      operator()
      const letter = letterById(command.id)
      if (letter.moderation === command.decision) break
      ensure(letter.moderation === 'pending', '只有待审核的信件可以审核。')
      if (command.decision === 'approved') active(letter.pairId)
      ensure(command.decision === 'approved' || command.note.trim().length >= 3, '请写下具体的修改建议。')
      letter.moderation = command.decision; letter.moderationNote = command.note.trim(); letter.updatedAt = state.clock
      state.reviews.push({ id: uid('review'), letterId: letter.id, operatorId: actor.id, decision: command.decision, note: command.note.trim(), createdAt: state.clock })
      if (letter.replyTo) {
        const task = state.tasks.find(t => t.letterId === letter.replyTo)
        if (task) task.status = command.decision === 'approved' ? 'completed' : 'awaiting'
      }
      if (command.decision === 'approved') {
        if (letter.replyTo || pairById(letter.pairId).channel === 'online') deliver(state, letter)
        else if (!state.deliveries.some(d => d.letterId === letter.id)) state.deliveries.push({ letterId: letter.id })
        if (letter.replyTo) for (const followup of state.followups.filter(f => f.taskId === state.tasks.find(t => t.letterId === letter.replyTo)?.id && f.kind === 'overdue' && f.status === 'open')) { followup.status = 'resolved'; followup.resolution = '回信已审核通过，本轮交流完成。'; followup.updatedAt = state.clock }
      }
      break
    }
    case 'print':
    case 'deliver': {
      ensure(actor.role === 'teacher', '请切换到协助收发的老师身份。')
      for (const id of new Set(command.ids)) {
        const letter = letterById(id); const pair = active(letter.pairId)
        ensure(pair.teacherId === actor.id && pair.channel === 'paper' && !letter.replyTo && letter.moderation === 'approved', '只能处理自己负责的、已审核通过的纸质来信。')
        let delivery = state.deliveries.find(d => d.letterId === id)
        if (!delivery) { delivery = { letterId: id }; state.deliveries.push(delivery) }
        if (command.type === 'print') { delivery.printedAt ??= state.clock }
        else { ensure(delivery.printedAt, '请先打印这封信，再确认实际交付。'); deliver(state, letter) }
      }
      break
    }
    case 'read': {
      const letter = letterById(command.id)
      ensure(canReadLetter(state, actor, letter), '这封信暂时不在你的可读范围内。')
      const pair = pairById(letter.pairId)
      if ((letter.replyTo && actor.id === pair.volunteerId) || (!letter.replyTo && actor.id === pair.childId)) {
        const delivery = state.deliveries.find(d => d.letterId === letter.id)
        ensure(letter.moderation === 'approved' && delivery?.deliveredAt, '信件尚未送达。')
        delivery.readAt ??= state.clock
      }
      break
    }
    case 'pause-pair': {
      operator(); const pair = pairById(command.id)
      if (pair.status === 'paused') break
      ensure(command.reason.trim().length >= 2, '请记录暂停原因，例如假期或临时调整。')
      pair.status = 'paused'; pair.pausedAt = state.clock; pair.pauseReason = command.reason.trim()
      break
    }
    case 'resume-pair': {
      operator(); const pair = pairById(command.id)
      if (pair.status === 'active') break
      const duration = Date.parse(state.clock) - Date.parse(pair.pausedAt!)
      for (const task of state.tasks.filter(t => t.pairId === pair.id && t.status !== 'completed')) task.dueAt = new Date(Date.parse(task.dueAt) + duration).toISOString()
      pair.status = 'active'; pair.pausedAt = undefined; pair.pauseReason = undefined
      break
    }
    case 'help': {
      ensure(actor.role === 'child', '请使用小朋友演示身份发送求助。')
      ensure(command.body.trim().length >= 2 && command.body.length <= 2000, '请写下 2—2000 字的想法。')
      if (command.pairId) ensure(pairById(command.pairId).childId === actor.id, '请选择自己的书信伙伴。')
      state.followups.push({ id: uid('help'), pairId: command.pairId ?? state.pairs.find(p => p.childId === actor.id)?.id, kind: 'help', status: 'open', note: `${actor.nickname}：${command.body.trim()}`, createdAt: state.clock, updatedAt: state.clock })
      break
    }
    case 'resolve-followup': {
      operator(); const followup = state.followups.find(f => f.id === command.id)
      ensure(followup, '这条跟进事项不存在。')
      if (followup.status === 'resolved') break
      ensure(command.note.trim().length >= 3 && command.note.length <= 2000, '请记录至少 3 字的处理结果。')
      followup.status = 'resolved'; followup.resolution = command.note.trim(); followup.updatedAt = state.clock
      break
    }
    case 'set-clock': {
      operator(); const value = Date.parse(command.value)
      ensure(Number.isFinite(value) && value >= Date.parse(state.clock), '演示时间只能向前调整。需要重新开始时，请重置演示。')
      state.clock = new Date(value).toISOString()
      break
    }
  }
  reconcileFollowups(state)
  return state
}

export async function validateAttachment(file: File): Promise<void> {
  ensure(file.size > 0 && file.size <= 3 * 1024 * 1024, '图片不能超过 3 MiB，请选择一张较小的演示图片。')
  ensure(file.type === 'image/png' || file.type === 'image/jpeg', '请选择 PNG 或 JPEG 图片。')
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => header[index] === byte)
  const jpeg = header[0] === 255 && header[1] === 216 && header[2] === 255
  ensure((file.type === 'image/png' && png) || (file.type === 'image/jpeg' && jpeg), '这张图片的实际格式与文件类型不一致，请重新选择。')
}

export async function initialize(): Promise<void> {
  await db.transaction('rw', db.snapshots, async () => { if (!(await db.snapshots.get('main'))) await db.snapshots.put(createSeedState()) })
}

export async function resetDemo(): Promise<void> {
  await db.transaction('rw', db.snapshots, async () => { await db.snapshots.put(createSeedState()) })
}

export function useAppData(): AppState | undefined { return useLiveQuery(() => db.snapshots.get('main'), []) }

export async function dispatch(actorId: string, command: Command): Promise<string> {
  if (command.type === 'save-letter' && command.file) await validateAttachment(command.file)
  return db.transaction('rw', db.snapshots, async () => {
    const previous = await db.snapshots.get('main')
    ensure(previous, '演示数据还没有准备好，请稍后重试。')
    const next = reduceCommand(previous, actorId, command)
    await db.snapshots.put(next)
    if (command.type === 'save-letter') return command.id ?? next.letters.find(l => !previous.letters.some(old => old.id === l.id))?.id ?? next.letters.find(l => l.pairId === command.pairId && l.replyTo === command.replyTo && l.createdBy === actorId && l.title === command.title.trim() && l.body === command.body && l.riddleId === command.riddleId && (l.moderation === 'draft' || l.moderation === 'returned'))?.id ?? ''
    if (command.type === 'match') return next.pairs.find(p => p.childId === command.childId && p.volunteerId === command.volunteerId)?.id ?? ''
    return ''
  })
}
