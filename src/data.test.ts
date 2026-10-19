import { describe, expect, it } from 'vitest'
import { canReadLetter, createSeedState, isOverdue, reduceCommand, validateAttachment, visibleLetters } from './data'
import type { AppState, Command, Letter } from './types'

function run(state: AppState, actor: string, command: Command) { return reduceCommand(state, actor, command) }
function saveReply(state: AppState, actor = 'c1', original = 'l1'): { state: AppState; letter: Letter } {
  const pairId = state.letters.find(l => l.id === original)!.pairId
  const next = run(state, actor, { type: 'save-letter', pairId, replyTo: original, title: '我也发现了一片叶子', body: '我今天在操场上发现了黄色的树叶，想把这件小事分享给你。' })
  return { state: next, letter: next.letters.find(l => l.replyTo === original)! }
}

describe('书信的状态与角色边界', () => {
  it('种子展示四个独立角色；孩子不可读未审核、未送达的原信', () => {
    const state = createSeedState()
    const child = state.people.find(p => p.id === 'c1')!
    expect(visibleLetters(state, child).map(l => l.id)).toEqual(['l1'])
    expect(canReadLetter(state, child, state.letters.find(l => l.id === 'l3')!)).toBe(false)
    expect(canReadLetter(state, child, state.letters.find(l => l.id === 'l2')!)).toBe(false)
    expect(() => run(state, 'c1', { type: 'read', id: 'l5' })).toThrow('可读范围')
  })

  it('老师只看到负责且已批准的原信；不读取孩子自己的私人草稿', () => {
    const saved = saveReply(createSeedState())
    const teacher = saved.state.people.find(p => p.id === 't1')!
    expect(canReadLetter(saved.state, teacher, saved.letter)).toBe(false)
    expect(canReadLetter(saved.state, teacher, saved.state.letters.find(l => l.id === 'l1')!)).toBe(true)
    expect(canReadLetter(saved.state, teacher, saved.state.letters.find(l => l.id === 'l2')!)).toBe(false)
  })

  it('非作者不能编辑，已提交的信不能修改或被重新打开为草稿', () => {
    const state = createSeedState()
    const edit: Command = { type: 'save-letter', id: 'l3', pairId: 'p1', title: '修改标题', body: '这里是一封想分享日常小发现的书信。' }
    expect(() => run(state, 'v2', edit)).toThrow()
    const pending = run(state, 'v1', { type: 'submit-letter', id: 'l3' })
    expect(() => run(pending, 'v1', edit)).toThrow('已提交')
    expect(pending.letters.find(l => l.id === 'l3')!.moderation).toBe('pending')
  })

  it('审核、结对、暂停、演示时钟均限制运营身份', () => {
    const state = createSeedState()
    for (const command of [
      { type: 'review-letter', id: 'l4', decision: 'approved', note: '' },
      { type: 'pause-pair', id: 'p1', reason: '假期暂停' },
      { type: 'set-clock', value: '2026-10-20T09:00:00+08:00' },
      { type: 'match', childId: 'c3', volunteerId: 'v3', teacherId: 't1', channel: 'online' },
    ] as Command[]) expect(() => run(state, 'v1', command)).toThrow('运营')
  })

  it('同一结对操作幂等，并阻止重复占用已有伙伴', () => {
    const command: Command = { type: 'match', childId: 'c3', volunteerId: 'v3', teacherId: 't1', channel: 'online' }
    const state = run(createSeedState(), 'op1', command)
    expect(run(state, 'op1', command).pairs).toHaveLength(3)
    expect(() => run(createSeedState(), 'op1', { ...command, childId: 'c1' })).toThrow('已有结对')
  })

  it('线上批准即送达，阅读单独记录；重复审核不产生重复任务', () => {
    let state = run(createSeedState(), 'v1', { type: 'submit-letter', id: 'l3' })
    const command: Command = { type: 'review-letter', id: 'l3', decision: 'approved', note: '可以分享。' }
    state = run(state, 'op1', command)
    const delivery = state.deliveries.find(d => d.letterId === 'l3')!
    expect(delivery.deliveredAt).toBe(state.clock)
    expect(delivery.readAt).toBeUndefined()
    expect(state.tasks.find(t => t.letterId === 'l3')!.dueAt).toBe('2026-11-02T01:00:00.000Z')
    state = run(state, 'op1', command)
    expect(state.tasks.filter(t => t.letterId === 'l3')).toHaveLength(1)
    expect(state.reviews.filter(r => r.letterId === 'l3')).toHaveLength(1)
    state = run(state, 'c1', { type: 'read', id: 'l3' })
    expect(state.deliveries.find(d => d.letterId === 'l3')!.readAt).toBe(state.clock)
  })

  it('纸质已打印不等于已交付，确认交付才起算期限；批量处理具有事务语义', () => {
    const seed = createSeedState()
    expect(() => run(seed, 't2', { type: 'deliver', ids: ['l2'] })).toThrow('先打印')
    const printed = run(seed, 't2', { type: 'print', ids: ['l2', 'l2'] })
    expect(printed.deliveries.find(d => d.letterId === 'l2')!.deliveredAt).toBeUndefined()
    expect(printed.tasks.some(t => t.letterId === 'l2')).toBe(false)
    expect(() => run(printed, 't1', { type: 'deliver', ids: ['l2'] })).toThrow()
    const delivered = run(printed, 't2', { type: 'deliver', ids: ['l2'] })
    expect(delivered.tasks.find(t => t.letterId === 'l2')!.dueAt).toBe('2026-11-02T01:00:00.000Z')
    expect(run(delivered, 't2', { type: 'deliver', ids: ['l2'] }).tasks.filter(t => t.letterId === 'l2')).toHaveLength(1)
    expect(() => run(seed, 't2', { type: 'print', ids: ['l2', 'l1'] })).toThrow()
    expect(seed.deliveries.find(d => d.letterId === 'l2')!.printedAt).toBeUndefined()
  })

  it('回信提交前志愿者不可见，审核通过结束原任务且不创建回信的回信任务', () => {
    const saved = saveReply(createSeedState())
    const id = saved.letter.id
    let state = run(saved.state, 'c1', { type: 'submit-letter', id })
    const volunteer = state.people.find(p => p.id === 'v1')!
    expect(canReadLetter(state, volunteer, state.letters.find(l => l.id === id)!)).toBe(false)
    expect(state.tasks.find(t => t.letterId === 'l1')!.status).toBe('review')
    state = run(state, 'op1', { type: 'review-letter', id, decision: 'approved', note: '' })
    expect(state.tasks.find(t => t.letterId === 'l1')!.status).toBe('completed')
    expect(state.tasks.some(t => t.letterId === id)).toBe(false)
    expect(canReadLetter(state, volunteer, state.letters.find(l => l.id === id)!)).toBe(true)
  })

  it('回信待审核抑制逾期，退回后恢复原期限并保留修改意见', () => {
    const saved = saveReply(createSeedState())
    let state = run(saved.state, 'c1', { type: 'submit-letter', id: saved.letter.id })
    state = run(state, 'op1', { type: 'set-clock', value: '2026-11-10T09:00:00+08:00' })
    expect(isOverdue(state, state.tasks.find(t => t.letterId === 'l1')!)).toBe(false)
    state = run(state, 'op1', { type: 'review-letter', id: saved.letter.id, decision: 'returned', note: '可以把分享内容写得更清楚一些。' })
    const task = state.tasks.find(t => t.letterId === 'l1')!
    expect(task.dueAt).toBe('2026-10-31T09:00:00+08:00')
    expect(isOverdue(state, task)).toBe(true)
    expect(state.letters.find(l => l.id === saved.letter.id)!.moderationNote).toContain('更清楚')
    expect(state.followups.filter(f => f.taskId === task.id)).toHaveLength(1)
  })

  it('老师代录作者仍为孩子，老师可提交，其他老师不可编辑', () => {
    const saved = saveReply(createSeedState(), 't2', 'l6')
    expect(saved.letter.authorId).toBe('c2')
    expect(saved.letter.createdBy).toBe('t2')
    expect(run(saved.state, 't2', { type: 'submit-letter', id: saved.letter.id }).letters.find(l => l.id === saved.letter.id)!.moderation).toBe('pending')
    expect(() => run(saved.state, 't1', { type: 'save-letter', id: saved.letter.id, pairId: 'p2', replyTo: 'l6', title: '代录回信', body: '我想向你分享今天的新发现。' })).toThrow()
  })

  it('重复保存无 id 草稿及重复提交不会产生多个回信', () => {
    const saved = saveReply(createSeedState())
    let state = saveReply(saved.state).state
    expect(state.letters.filter(l => l.replyTo === 'l1')).toHaveLength(1)
    state = run(state, 'c1', { type: 'submit-letter', id: saved.letter.id })
    expect(run(state, 'c1', { type: 'submit-letter', id: saved.letter.id }).letters.filter(l => l.replyTo === 'l1')).toHaveLength(1)
  })

  it('客户端预分配的新 id 创建独立草稿，不覆盖已有草稿，重复保存仍只有一封', () => {
    const seed = createSeedState()
    const command: Command = { type: 'save-letter', id: 'new-client-letter', pairId: 'p1', title: '今天窗边的新发现', body: '今天看到窗边的叶子长大了一点，想和你分享。' }
    let state = run(seed, 'v1', command)
    expect(state.letters.find(l => l.id === 'l3')).toEqual(seed.letters.find(l => l.id === 'l3'))
    expect(state.letters.find(l => l.id === 'new-client-letter')!.title).toBe('今天窗边的新发现')
    state = run(state, 'v1', command)
    expect(state.letters.filter(l => l.id === 'new-client-letter')).toHaveLength(1)
    expect(() => run(state, 'v2', command)).toThrow()
  })

  it('无 id 的新原信只复用完全相同的草稿，不隐式替换另一封草稿', () => {
    const seed = createSeedState()
    const command: Command = { type: 'save-letter', pairId: 'p1', title: '这是新写的一封信', body: '今天有新的事情想和你分享，原来的草稿也会好好保留。' }
    let state = run(seed, 'v1', command)
    expect(state.letters.find(l => l.id === 'l3')).toEqual(seed.letters.find(l => l.id === 'l3'))
    expect(state.letters).toHaveLength(seed.letters.length + 1)
    state = run(state, 'v1', command)
    expect(state.letters).toHaveLength(seed.letters.length + 1)
  })

  it('先写正文或空白草稿可以保存，完整性在提交时检查', () => {
    const seed = createSeedState()
    let state = run(seed, 'v1', { type: 'save-letter', id: 'body-first', pairId: 'p1', title: '', body: '我先把今天看到的云写下来，等一会儿再想一个标题。' })
    expect(state.letters.find(l => l.id === 'body-first')!.title).toBe('')
    expect(() => run(state, 'v1', { type: 'submit-letter', id: 'body-first' })).toThrow('取一个')
    state = run(state, 'v1', { type: 'save-letter', id: 'body-first', pairId: 'p1', title: '窗边的云', body: '' })
    expect(() => run(state, 'v1', { type: 'submit-letter', id: 'body-first' })).toThrow('至少 10 字')
    expect(() => run(seed, 'v1', { type: 'save-letter', id: 'too-long', pairId: 'p1', title: '叶'.repeat(61), body: '' })).toThrow('60 字')
  })

  it('暂停停止催办与提交交付，恢复顺延暂停时长，并保留已逾期的负余量', () => {
    let state = run(createSeedState(), 'op1', { type: 'pause-pair', id: 'p2', reason: '国庆补假' })
    expect(isOverdue(state, state.tasks.find(t => t.letterId === 'l6')!)).toBe(false)
    expect(() => run(state, 't2', { type: 'print', ids: ['l2'] })).toThrow('暂停')
    expect(() => run(state, 'v2', { type: 'submit-letter', id: 'l4' })).toThrow('暂停')
    state = run(state, 'op1', { type: 'set-clock', value: '2026-10-24T09:00:00+08:00' })
    state = run(state, 'op1', { type: 'resume-pair', id: 'p2' })
    expect(state.tasks.find(t => t.letterId === 'l6')!.dueAt).toBe('2026-10-20T01:00:00.000Z')
    expect(isOverdue(state, state.tasks.find(t => t.letterId === 'l6')!)).toBe(true)
    expect(run(state, 'op1', { type: 'resume-pair', id: 'p2' }).tasks).toEqual(state.tasks)
  })

  it('时钟只能向前；同一任务只产生一条跟进记录', () => {
    let state = run(createSeedState(), 'op1', { type: 'set-clock', value: '2026-11-10T09:00:00+08:00' })
    state = run(state, 'op1', { type: 'set-clock', value: '2026-11-11T09:00:00+08:00' })
    expect(state.followups.filter(f => f.taskId === 'task-l1')).toHaveLength(1)
    expect(() => run(state, 'op1', { type: 'set-clock', value: '2026-10-18' })).toThrow('只能向前')
  })

  it('求助仅孩子可发、运营可处理；不混同违规或对其他角色公开', () => {
    const command: Command = { type: 'help', pairId: 'p1', body: '我最近有一点烦恼，想找人聊聊。' }
    expect(() => run(createSeedState(), 'v1', command)).toThrow('小朋友')
    expect(() => run(createSeedState(), 'c2', command)).toThrow('自己')
    const state = run(createSeedState(), 'c1', command)
    const help = state.followups.find(f => f.kind === 'help')!
    expect(help.note).toContain('小禾')
    expect(() => run(state, 't1', { type: 'resolve-followup', id: help.id, note: '已处理' })).toThrow('运营')
    expect(run(state, 'op1', { type: 'resolve-followup', id: help.id, note: '已通过演示流程了解情况，安排后续陪伴。' }).followups.find(f => f.id === help.id)!.status).toBe('resolved')
  })

  it('提交失败保留原稿内容，状态转移不会修改传入快照', () => {
    const state = createSeedState()
    const draft = state.letters.find(l => l.id === 'l3')!
    draft.body = '太短'
    expect(() => run(state, 'v1', { type: 'submit-letter', id: 'l3' })).toThrow('至少 10 字')
    expect(draft.moderation).toBe('draft')
    expect(draft.body).toBe('太短')
  })
})

describe('演示附件', () => {
  it('接受 PNG/JPEG 文件头，拒绝改名文本、类型不符与超限文件', async () => {
    await expect(validateAttachment(new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0])], 'leaf.png', { type: 'image/png' }))).resolves.toBeUndefined()
    await expect(validateAttachment(new File([new Uint8Array([255, 216, 255, 224])], 'letter.jpg', { type: 'image/jpeg' }))).resolves.toBeUndefined()
    await expect(validateAttachment(new File(['not an image'], 'leaf.png', { type: 'image/png' }))).rejects.toThrow('格式')
    await expect(validateAttachment(new File([new Uint8Array([255, 216, 255])], 'letter.png', { type: 'image/png' }))).rejects.toThrow('格式')
    await expect(validateAttachment(new File([new Uint8Array(3 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }))).rejects.toThrow('3 MiB')
  })

  it('替换或移除附件清理孤立 Blob', () => {
    const saved = saveReply(createSeedState())
    saved.letter.attachmentId = 'old-image'
    saved.state.attachments.push({ id: 'old-image', pairId: 'p1', name: 'old.png', type: 'image/png', blob: new Blob(['old']) })
    const state = run(saved.state, 'c1', { type: 'save-letter', id: saved.letter.id, pairId: 'p1', replyTo: 'l1', title: saved.letter.title, body: saved.letter.body, removeAttachment: true })
    expect(state.attachments).toHaveLength(0)
    expect(state.letters.find(l => l.id === saved.letter.id)!.attachmentId).toBeUndefined()
  })
})
