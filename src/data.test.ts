import { describe, expect, it } from 'vitest'
import { canReadLetter, createSeedState, groupedResponseTasks, isOverdue, normalizeState, reduceCommand, refreshState, scopeState, validateAttachment } from './domain'
import type { AppState, Command } from './types'

const run = (state: AppState, actor: string, command: Command) => reduceCommand(state, actor, command)
const seed = () => normalizeState(createSeedState())
const at = (state: AppState, day: string) => run(state, 'op1', { type: 'set-clock', value: day + 'T09:00:00+08:00' })
function write(state: AppState, authorId = 'c1', id = 'new', extra: Partial<Extract<Command, { type: 'save-letter' }>> = {}) {
  return run(state, authorId, { type: 'save-letter', id, pairId: 'p1', title: '', body: '你好', ...extra })
}
const submit = (s: AppState, id = 'new', author = 'c1', coveredLetterIds?: string[]) => run(s, author, { type: 'submit-letter', id, coveredLetterIds })
const approve = (s: AppState, id = 'new') => run(s, 'op1', { type: 'review-letter', id, decision: 'approved', note: '' })

describe('V1 写信、审核与持续回应', () => {
  it('孩子可以主动写信，标题自动生成，无作文最低字数门槛', () => {
    let state = write(seed())
    expect(state.letters.find(l => l.id === 'new')!.recipientId).toBe('v1')
    state = approve(submit(state))
    const letter = state.letters.find(l => l.id === 'new')!
    expect(letter.title).toBe('你好')
    expect(letter.replyTo).toBeUndefined()
    expect(state.tasks.find(t => t.letterId === 'new')!.recipientId).toBe('v1')
    expect(state.tasks.find(t => t.letterId === 'new')!.dueAt).toBe('2026-10-26T01:00:00.000Z')
  })
  it('未结对可保存介绍，不能提交；结对后显式绑定伙伴再寄出', () => {
    let state = write(seed(), 'c3', 'intro', { pairId: '' })
    expect(() => submit(state, 'intro', 'c3')).toThrow('不存在')
    expect(canReadLetter(state, state.people.find(p => p.id === 'c3')!, state.letters.find(l => l.id === 'intro')!)).toBe(true)
    state = run(state, 'op1', { type: 'match', childId: 'c3', volunteerId: 'v3', teacherId: 't1', channel: 'online' })
    const pair = state.pairs.find(p => p.childId === 'c3')!
    expect(state.tasks.some(t => t.pairId === pair.id && t.kind === 'first-letter')).toBe(true)
    state = write(state, 'c3', 'intro', { pairId: pair.id })
    expect(submit(state, 'intro', 'c3').letters.find(l => l.id === 'intro')!.moderation).toBe('pending')
  })
  it('新草稿需要内容或附件才能提交，失败不会修改快照', () => {
    const state = write(seed(), 'c1', 'blank', { body: '  ' })
    const before = structuredClone(state)
    expect(() => submit(state, 'blank')).toThrow('写下')
    expect(state).toEqual(before)
  })
  it('草稿暂停可修改，但提交与交付暂停，审核通过的线上信等待恢复', () => {
    let state = submit(write(seed()))
    state = run(state, 'op1', { type: 'pause-pair', id: 'p1', reason: '假期休息' })
    state = write(state, 'c1', 'paused-draft')
    expect(() => submit(state, 'paused-draft')).toThrow('暂停')
    state = approve(state)
    expect(state.deliveries.find(d => d.letterId === 'new')!.deliveredAt).toBeUndefined()
    state = at(state, '2026-10-24')
    state = run(state, 'op1', { type: 'resume-pair', id: 'p1' })
    expect(state.deliveries.find(d => d.letterId === 'new')!.deliveredAt).toBe(state.clock)
    expect(state.tasks.find(t => t.letterId === 'new')!.dueAt).toBe('2026-10-31T01:00:00.000Z')
  })
  it('每次提交的内容和附件版本不可被退回修改覆盖', () => {
    let state = submit(write(seed(), 'c1', 'new', { body: '第一版' }))
    state = run(state, 'op1', { type: 'review-letter', id: 'new', decision: 'returned', note: '可以补充想分享的事情。' })
    state = write(state, 'c1', 'new', { body: '第二版' })
    state = submit(state)
    const versions = state.letters.find(l => l.id === 'new')!.submissionVersions!
    expect(versions.map(v => v.body)).toEqual(['第一版', '第二版'])
    expect(versions[0].revision).toBeLessThan(versions[1].revision)
    expect(() => write(state, 'c1', 'new', { body: '暗改' })).toThrow('已提交')
  })
  it('回复覆盖在提交时固定，新来信不能被之后的批准意外完成', () => {
    let state = submit(write(seed(), 'c1', 'reply', { replyTo: 'l1' }), 'reply', 'c1', ['l1'])
    state = approve(submit(write(state, 'v1', 'later'), 'later', 'v1'), 'later')
    state = approve(state, 'reply')
    expect(state.tasks.find(t => t.letterId === 'l1')!.status).toBe('completed')
    expect(state.tasks.find(t => t.letterId === 'later')!.status).toBe('awaiting')
    expect(state.tasks.find(t => t.letterId === 'reply')!.recipientId).toBe('v1')
  })
  it('双向两轮往来持续产生对方回应任务，不再终止于孩子回信', () => {
    let state = approve(submit(write(seed(), 'c1', 'child-one', { replyTo: 'l1' }), 'child-one'), 'child-one')
    state = approve(submit(write(state, 'v1', 'adult-two', { replyTo: 'child-one' }), 'adult-two', 'v1'), 'adult-two')
    state = approve(submit(write(state, 'c1', 'child-two', { replyTo: 'adult-two' }), 'child-two'), 'child-two')
    expect(state.tasks.find(t => t.letterId === 'child-one')!.status).toBe('completed')
    expect(state.tasks.find(t => t.letterId === 'adult-two')!.status).toBe('completed')
    expect(state.tasks.find(t => t.letterId === 'child-two')!.status).toBe('awaiting')
  })
  it('首页同一伙伴多封来信聚合并保留最早期限，跟进不重复堆积', () => {
    let state = approve(submit(write(seed(), 'v1', 'later'), 'later', 'v1'), 'later')
    const group = groupedResponseTasks(state, 'c1')[0]
    expect(group.letterIds).toEqual(['l1', 'later'])
    expect(group.dueAt).toBe('2026-10-31T01:00:00.000Z')
    state = at(state, '2026-11-10')
    expect(state.followups.filter(f => f.pairId === 'p1' && f.kind === 'overdue')).toHaveLength(1)
  })
  it('审核中的旧回信不会占用新来信的入口和期限', () => {
    let state = submit(write(seed(), 'c1', 'reply', { replyTo: 'l1' }), 'reply')
    state = approve(submit(write(state, 'v1', 'later'), 'later', 'v1'), 'later')
    const group = groupedResponseTasks(state, 'c1')[0]
    expect(group.status).toBe('awaiting')
    expect(group.letterIds).toEqual(['later'])
    expect(group.dueAt).toBe(state.tasks.find(t => t.letterId === 'later')!.dueAt)
  })
  it('上一轮已处理后，新一轮真的逾期会建立新的跟进事项', () => {
    let state = at(seed(), '2026-11-10')
    const oldId = state.followups.find(f => f.pairId === 'p1' && f.kind === 'overdue')!.id
    state = approve(submit(write(state, 'c1', 'child-one', { replyTo: 'l1' }), 'child-one'), 'child-one')
    expect(state.followups.find(f => f.id === oldId)!.status).toBe('resolved')
    state = approve(submit(write(state, 'v1', 'adult-two', { replyTo: 'child-one' }), 'adult-two', 'v1'), 'adult-two')
    state = at(state, '2026-12-10')
    const followups = state.followups.filter(f => f.pairId === 'p1' && f.kind === 'overdue' && state.tasks.find(t => t.id === f.taskId)?.recipientId === 'c1')
    expect(followups).toHaveLength(2)
    expect(followups.find(f => f.id !== oldId)?.status).toBe('open')
  })
  it('审核等待与暂停的重叠区间只顺延一次', () => {
    let state = submit(write(seed(), 'c1', 'reply', { replyTo: 'l1' }), 'reply')
    state = at(state, '2026-10-20')
    state = run(state, 'op1', { type: 'pause-pair', id: 'p1', reason: '临时休息' })
    state = at(state, '2026-10-22')
    state = run(state, 'op1', { type: 'review-letter', id: 'reply', decision: 'returned', note: '可以再加一个小发现。' })
    state = at(state, '2026-10-24')
    state = run(state, 'op1', { type: 'resume-pair', id: 'p1' })
    expect(state.tasks.find(t => t.letterId === 'l1')!.dueAt).toBe('2026-11-05T01:00:00.000Z')
    expect(state.tasks.find(t => t.letterId === 'l1')!.status).toBe('awaiting')
  })
  it('审核期间停止催办，退回保留等待时长，恢复时保留原有负余量', () => {
    let state = run(seed(), 'op1', { type: 'pause-pair', id: 'p2', reason: '假期暂停' })
    expect(isOverdue(state, state.tasks.find(t => t.letterId === 'l6')!)).toBe(false)
    state = at(state, '2026-10-24')
    state = run(state, 'op1', { type: 'resume-pair', id: 'p2' })
    expect(state.tasks.find(t => t.letterId === 'l6')!.dueAt).toBe('2026-10-20T01:00:00.000Z')
    expect(isOverdue(state, state.tasks.find(t => t.letterId === 'l6')!)).toBe(true)
  })
  it('纸质打印与交付分开、送达后起算；代录作者仍是孩子', () => {
    let state = seed()
    expect(() => run(state, 't2', { type: 'deliver', ids: ['l2'] })).toThrow('先打印')
    state = run(state, 't2', { type: 'print', ids: ['l2', 'l2'] })
    expect(state.deliveries.find(d => d.letterId === 'l2')!.deliveredAt).toBeUndefined()
    state = run(state, 't2', { type: 'deliver', ids: ['l2'] })
    expect(state.tasks.find(t => t.letterId === 'l2')!.dueAt).toBe('2026-11-02T01:00:00.000Z')
    state = write(state, 't2', 'paper-reply', { pairId: 'p2', replyTo: 'l2' })
    expect(state.letters.find(l => l.id === 'paper-reply')!.authorId).toBe('c2')
    expect(state.letters.find(l => l.id === 'paper-reply')!.createdBy).toBe('t2')
    state = approve(submit(state, 'paper-reply', 't2'), 'paper-reply')
    expect(state.deliveries.find(d => d.letterId === 'paper-reply')!.deliveredAt).toBeUndefined()
    expect(state.tasks.some(t => t.letterId === 'paper-reply')).toBe(false)
    expect(canReadLetter(state, state.people.find(p => p.id === 'v2')!, state.letters.find(l => l.id === 'paper-reply')!)).toBe(false)
    expect(canReadLetter(state, state.people.find(p => p.id === 't2')!, state.letters.find(l => l.id === 'paper-reply')!)).toBe(true)
    state = run(state, 't2', { type: 'print', ids: ['paper-reply'] })
    expect(state.deliveries.find(d => d.letterId === 'paper-reply')!.deliveredAt).toBeUndefined()
    state = run(state, 't2', { type: 'deliver', ids: ['paper-reply'] })
    expect(state.deliveries.find(d => d.letterId === 'paper-reply')!.deliveredAt).toBe(state.clock)
    expect(state.tasks.find(t => t.letterId === 'paper-reply')!.recipientId).toBe('v2')
  })
  it('重复提交、审核与交付不会产生重复记录，批量非法操作原子失败', () => {
    let state = submit(write(seed()))
    state = submit(state)
    expect(state.letters.find(l => l.id === 'new')!.submissionVersions).toHaveLength(1)
    state = approve(approve(state))
    expect(state.reviews.filter(r => r.letterId === 'new')).toHaveLength(1)
    expect(state.tasks.filter(t => t.letterId === 'new')).toHaveLength(1)
    const before = structuredClone(state)
    expect(() => run(state, 't2', { type: 'print', ids: ['l2', 'l1'] })).toThrow()
    expect(state).toEqual(before)
  })
  it('多设备版本冲突保留原稿，相同重试幂等', () => {
    let state = write(seed(), 'c1', 'new', { expectedRevision: 0 })
    state = write(state, 'c1', 'new', { expectedRevision: 0 })
    expect(state.letters.find(l => l.id === 'new')!.revision).toBe(1)
    expect(() => write(state, 'c1', 'new', { body: '另一台设备修改', expectedRevision: 0 })).toThrow('另一台设备')
    expect(state.letters.find(l => l.id === 'new')!.body).toBe('你好')
  })
  it('结束结对禁止新往来但保留已送达历史，再结对不共享旧信', () => {
    let state = run(seed(), 'op1', { type: 'end-pair', id: 'p1', reason: '伙伴毕业，更换安排' })
    expect(() => write(state)).toThrow('结束')
    expect(canReadLetter(state, state.people.find(p => p.id === 'c1')!, state.letters.find(l => l.id === 'l1')!)).toBe(true)
    state = run(state, 'op1', { type: 'match', childId: 'c1', volunteerId: 'v3', teacherId: 't1', channel: 'online' })
    expect(scopeState(state, 'v3').letters.some(l => l.id === 'l1')).toBe(false)
  })
})

describe('正式权限与受限求助', () => {
  it('未审核、未送达、私人草稿与其他结对数据在服务端投影中不可见', () => {
    const state = write(seed())
    expect(scopeState(state, 'v1').letters.some(l => l.id === 'new')).toBe(false)
    expect(scopeState(state, 'op1').letters.some(l => l.id === 'new')).toBe(false)
    expect(scopeState(state, 't1').letters).toHaveLength(0)
    expect(scopeState(state, 't2').letters.map(l => l.id)).toEqual(['l2', 'l6'])
    expect(scopeState(state, 'c1').people.some(p => p.id === 'c2')).toBe(false)
    expect(scopeState(state, 'c1').letters.some(l => l.id === 'l2')).toBe(false)
    expect(() => run(state, 'v2', { type: 'read', id: 'l1' })).toThrow('可读范围')
  })
  it('运营权限仅投影职责需要的伙伴、信件和待办', () => {
    const state = seed()
    const operator = state.people.find(p => p.id === 'op1')!
    operator.permissions = ['safeguarding']
    const helpOnly = scopeState(state, 'op1')
    expect(helpOnly.pairs).toHaveLength(0)
    expect(helpOnly.letters).toHaveLength(0)
    expect(helpOnly.tasks).toHaveLength(0)
    expect(helpOnly.people.map(p => p.id)).toEqual(['op1'])
    operator.permissions = ['review']
    const reviewOnly = scopeState(state, 'op1')
    expect(reviewOnly.letters.every(l => l.moderation !== 'draft')).toBe(true)
    expect(reviewOnly.tasks).toHaveLength(0)
    expect(reviewOnly.followups).toHaveLength(0)
    expect(reviewOnly.pairs.map(p => p.id).sort()).toEqual(['p1', 'p2'])
  })
  it('正式结对同时要求监护授权、志愿者审核和负责老师；正式不能改时钟', () => {
    const state = seed()
    state.people.forEach(p => p.accountStatus = 'active')
    const match: Command = { type: 'match', childId: 'c3', volunteerId: 'v3', teacherId: 't1', channel: 'online' }
    expect(() => reduceCommand(state, 'op1', match, { formal: true })).toThrow('监护授权')
    state.people.find(p => p.id === 'c3')!.guardianConsent = true
    state.people.find(p => p.id === 'c3')!.teacherId = 't1'
    expect(() => reduceCommand(state, 'op1', match, { formal: true })).toThrow('审核')
    state.people.find(p => p.id === 'v3')!.volunteerApproved = true
    expect(reduceCommand(state, 'op1', match, { formal: true }).pairs).toHaveLength(3)
    expect(() => reduceCommand(state, 'op1', { type: 'set-clock', value: state.clock }, { formal: true })).toThrow('服务端时间')
  })
  it('老师正式代录必须有孩子核对确认，不能读取其他孩子草稿', () => {
    const state = write(seed(), 't2', 'paper', { pairId: 'p2' })
    state.people.forEach(p => p.accountStatus = 'active')
    expect(() => reduceCommand(state, 't2', { type: 'submit-letter', id: 'paper' }, { formal: true })).toThrow('核对')
    const submitted = reduceCommand(state, 't2', { type: 'submit-letter', id: 'paper', confirmedByChild: true }, { formal: true })
    expect(submitted.letters.find(l => l.id === 'paper')!.childConfirmedAt).toBe(state.clock)
    expect(scopeState(state, 't1').letters.some(l => l.id === 'paper')).toBe(false)
  })
  it('求助只对申请人和有受理权限的运营可见，不自动告知被反映的老师', () => {
    let state = run(seed(), 'c1', { type: 'help', pairId: 'p1', body: '有件事情想私下和运营说。' })
    const help = state.followups.find(f => f.kind === 'help')!
    expect(help.requesterId).toBe('c1')
    expect(scopeState(state, 'c1').followups.some(f => f.id === help.id)).toBe(true)
    expect(scopeState(state, 't1').followups).toHaveLength(0)
    expect(scopeState(state, 'v1').followups).toHaveLength(0)
    state.people.find(p => p.id === 'op1')!.permissions = ['review']
    expect(scopeState(state, 'op1').followups).toHaveLength(0)
    expect(() => run(state, 'op1', { type: 'resolve-followup', id: help.id, note: '已经处理完成' })).toThrow('权限')
  })
  it('已处理但尚未回应的事项到下次跟进时间重新打开', () => {
    let state = at(seed(), '2026-11-10')
    const followup = state.followups.find(f => f.pairId === 'p1')!
    state = run(state, 'op1', { type: 'resolve-followup', id: followup.id, note: '已经沟通，下周再次询问。', nextFollowupAt: '2026-11-17T09:00:00+08:00' })
    expect(at(state, '2026-11-16').followups.find(f => f.id === followup.id)!.status).toBe('resolved')
    expect(at(state, '2026-11-17').followups.find(f => f.id === followup.id)!.status).toBe('open')
    expect(refreshState(seed(), '2026-11-10T09:00:00+08:00').followups.some(f => f.pairId === 'p1')).toBe(true)
  })
  it('延期与负责人变更需要权限并保留原因', () => {
    let state = seed()
    expect(() => run(state, 't1', { type: 'extend-task', id: 'task-l1', dueAt: '2026-11-10', reason: '学校活动' })).toThrow('运营')
    state = run(state, 'op1', { type: 'extend-task', id: 'task-l1', dueAt: '2026-11-10T09:00:00+08:00', reason: '学校活动，给孩子充分时间' })
    expect(state.tasks.find(t => t.id === 'task-l1')!.extensionReason).toContain('充分时间')
  })
})

describe('附件边界', () => {
  it('附件头部、类型和大小均需校验', async () => {
    await expect(validateAttachment(new File([new Uint8Array([137,80,78,71,13,10,26,10,0])], 'a.png', { type: 'image/png' }))).resolves.toBeUndefined()
    await expect(validateAttachment(new File(['invalid'], 'a.png', { type: 'image/png' }))).rejects.toThrow('格式')
    await expect(validateAttachment(new File([new Uint8Array(3 * 1024 * 1024 + 1)], 'a.png', { type: 'image/png' }))).rejects.toThrow('3 MiB')
  })
  it('正式附件必须已验证归属；已提交附件替换后仍保留审核版本引用', () => {
    let state = seed()
    state.people.forEach(p => p.accountStatus = 'active')
    state.attachments.push({ id: 'asset', pairId: 'p1', ownerId: 'v1', name: 'a.png', type: 'image/png', blob: new Blob() })
    expect(() => reduceCommand(state, 'c1', { type: 'save-letter', id: 'new', pairId: 'p1', title: '', body: '', attachmentId: 'asset' }, { formal: true })).toThrow('不属于')
    state = write(state, 'v1', 'with-file', { attachmentId: 'asset' })
    state = submit(state, 'with-file', 'v1')
    state = run(state, 'op1', { type: 'review-letter', id: 'with-file', decision: 'returned', note: '请调整文字后重新提交。' })
    state = write(state, 'v1', 'with-file', { removeAttachment: true })
    expect(state.attachments.some(a => a.id === 'asset')).toBe(true)
    expect(state.letters.find(l => l.id === 'with-file')!.submissionVersions![0].attachmentId).toBe('asset')
  })
})
