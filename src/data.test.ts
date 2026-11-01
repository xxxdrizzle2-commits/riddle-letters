import { describe, expect, it } from 'vitest'
import { canReadLetter, createSeedState, groupedResponseTasks, hasTeacherScope, isOverdue, normalizeState, reduceCommand, refreshState, scopeState, validateAttachment } from './domain'
import { checkInvariants } from './invariants'
import type { AppState, Command } from './types'

const run = (state: AppState, actor: string, command: Command) => reduceCommand(state, actor, command)
const seed = () => normalizeState(createSeedState())
const at = (state: AppState, day: string) => run(state, 'op1', { type: 'set-clock', value: day + 'T09:00:00+08:00' })
function write(state: AppState, authorId = 'c1', id = 'new', extra: Partial<Extract<Command, { type: 'save-letter' }>> = {}) {
  return run(state, authorId, { type: 'save-letter', id, pairId: 'p1', title: '', body: '你好', ...extra })
}
const submit = (s: AppState, id = 'new', author = 'c1', coveredLetterIds?: string[]) => run(s, author, { type: 'submit-letter', id, coveredLetterIds })
const approve = (s: AppState, id = 'new') => run(s, 'op1', { type: 'review-letter', id, decision: 'approved', note: '' })

describe('V2 写信、审核与持续回应', () => {
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
  it('未结对不能创建收件人不明的信；结对后必须显式绑定伙伴', () => {
    let state = seed()
    expect(() => write(state, 'c3', 'intro', { pairId: '' })).toThrow('明确的书信伙伴')
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
  it('草稿暂停可修改，但提交与交付暂停；恢复后仍需逐封复核放行', () => {
    let state = submit(write(seed()))
    state = run(state, 'op1', { type: 'pause-pair', id: 'p1', reason: '假期休息' })
    state = write(state, 'c1', 'paused-draft')
    expect(() => submit(state, 'paused-draft')).toThrow('暂停')
    state = approve(state)
    expect(state.deliveries.find(d => d.letterId === 'new')!.deliveredAt).toBeUndefined()
    state = at(state, '2026-10-24')
    state = run(state, 'op1', { type: 'resume-pair', id: 'p1' })
    expect(state.deliveries.find(d => d.letterId === 'new')!.deliveredAt).toBeUndefined()
    state = run(state, 'op1', { type: 'release-held-letter', id: 'new' })
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
  it('首页同一伙伴多封来信聚合；孩子没有逾期处罚或催办', () => {
    let state = approve(submit(write(seed(), 'v1', 'later'), 'later', 'v1'), 'later')
    const group = groupedResponseTasks(state, 'c1')[0]
    expect(group.letterIds).toEqual(['l1', 'later'])
    expect(group.dueAt).toBe('2026-10-31T01:00:00.000Z')
    state = at(state, '2026-11-10')
    expect(state.followups.filter(f => f.pairId === 'p1' && f.kind === 'overdue')).toHaveLength(0)
  })
  it('审核中的旧回信不会占用新来信的入口和期限', () => {
    let state = submit(write(seed(), 'c1', 'reply', { replyTo: 'l1' }), 'reply')
    state = approve(submit(write(state, 'v1', 'later'), 'later', 'v1'), 'later')
    const group = groupedResponseTasks(state, 'c1')[0]
    expect(group.status).toBe('awaiting')
    expect(group.letterIds).toEqual(['later'])
    expect(group.dueAt).toBe(state.tasks.find(t => t.letterId === 'later')!.dueAt)
  })
  it('成人上一轮已回应后，下一轮真的逾期会建立新的跟进事项', () => {
    let state = approve(submit(write(seed(), 'c1', 'child-one', { replyTo: 'l1' }), 'child-one'), 'child-one')
    state = at(state, '2026-11-10')
    const oldId = state.followups.find(f => f.pairId === 'p1' && f.kind === 'overdue')!.id
    state = approve(submit(write(state, 'v1', 'adult-two', { replyTo: 'child-one' }), 'adult-two', 'v1'), 'adult-two')
    expect(state.followups.find(f => f.id === oldId)!.status).toBe('resolved')
    state = approve(submit(write(state, 'c1', 'child-two', { replyTo: 'adult-two' }), 'child-two'), 'child-two')
    state = at(state, '2026-12-10')
    const followups = state.followups.filter(f => f.pairId === 'p1' && f.kind === 'overdue' && state.tasks.find(t => t.id === f.taskId)?.recipientId === 'v1')
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
  it('暂停会顺延状态，但孩子收信任务不会被判为逾期', () => {
    let state = run(seed(), 'op1', { type: 'pause-pair', id: 'p2', reason: '假期暂停' })
    expect(isOverdue(state, state.tasks.find(t => t.letterId === 'l6')!)).toBe(false)
    state = at(state, '2026-10-24')
    state = run(state, 'op1', { type: 'resume-pair', id: 'p2' })
    expect(state.tasks.find(t => t.letterId === 'l6')!.dueAt).toBe('2026-10-20T01:00:00.000Z')
    expect(isOverdue(state, state.tasks.find(t => t.letterId === 'l6')!)).toBe(false)
  })
  it('成人来信的打印与交付分开；孩子纸信由老师上传后在线到达志愿者', () => {
    let state = seed()
    expect(() => run(state, 't2', { type: 'deliver', ids: ['l2'] })).toThrow('先打印')
    state = run(state, 't2', { type: 'print', ids: ['l2', 'l2'] })
    expect(state.deliveries.find(d => d.letterId === 'l2')!.deliveredAt).toBeUndefined()
    state = run(state, 't2', { type: 'deliver', ids: ['l2'] })
    expect(state.tasks.find(t => t.letterId === 'l2')!.dueAt).toBe('2026-11-02T01:00:00.000Z')
    state = run(state, 't2', { type: 'witness-read', id: 'l2' })
    expect(state.deliveryEvents?.filter(event => event.letterId === 'l2').map(event => event.type)).toEqual(['print-attempt', 'printed', 'handed-to-child', 'witnessed-read'])
    state = write(state, 't2', 'paper-reply', { pairId: 'p2', replyTo: 'l2' })
    expect(state.letters.find(l => l.id === 'paper-reply')!.authorId).toBe('c2')
    expect(state.letters.find(l => l.id === 'paper-reply')!.createdBy).toBe('t2')
    state = approve(submit(state, 'paper-reply', 't2'), 'paper-reply')
    expect(state.deliveries.find(d => d.letterId === 'paper-reply')!.deliveredAt).toBe(state.clock)
    expect(state.tasks.find(t => t.letterId === 'paper-reply')!.recipientId).toBe('v2')
    expect(canReadLetter(state, state.people.find(p => p.id === 'v2')!, state.letters.find(l => l.id === 'paper-reply')!)).toBe(true)
    expect(canReadLetter(state, state.people.find(p => p.id === 't2')!, state.letters.find(l => l.id === 'paper-reply')!)).toBe(false)
    expect(() => run(state, 't2', { type: 'print', ids: ['paper-reply'] })).toThrow('孩子收到')
    expect(state.deliveryEvents?.filter(event => event.letterId === 'paper-reply').map(event => event.type)).toEqual(['online-available'])
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

describe('N:N 结对、学校授权与保护性暂停', () => {
  it('两名合成孩子与两名志愿者可交叉结对，每封信只属于指定 Pair 与唯一收件人', () => {
    let state = seed()
    state = run(state, 'op1', { type: 'match', childId: 'c1', volunteerId: 'v2', teacherId: 't1', channel: 'online' })
    state = run(state, 'op1', { type: 'match', childId: 'c2', volunteerId: 'v1', teacherId: 't2', channel: 'online' })
    expect(state.pairs).toHaveLength(4)
    const cross = state.pairs.find(pair => pair.childId === 'c1' && pair.volunteerId === 'v2')!
    expect(() => write(state, 'c1', 'wrong-recipient', { pairId: cross.id, recipientId: 'v1' })).toThrow('未结对')
    state = approve(submit(write(state, 'c1', 'c1-to-v2', { pairId: cross.id }), 'c1-to-v2'), 'c1-to-v2')
    const letter = state.letters.find(item => item.id === 'c1-to-v2')!
    expect(letter.pairId).toBe(cross.id)
    expect(letter.recipientId).toBe('v2')
    expect(canReadLetter(state, state.people.find(person => person.id === 'v2')!, letter)).toBe(true)
    expect(canReadLetter(state, state.people.find(person => person.id === 'v1')!, letter)).toBe(false)
    const before = state.pairs.length
    state = run(state, 'op1', { type: 'match', childId: 'c1', volunteerId: 'v2', teacherId: 't1', channel: 'paper' })
    expect(state.pairs).toHaveLength(before)
  })

  it('单 Pair 暂停不影响其他伙伴，可信志愿者风险会暂停其全部活跃 Pair', () => {
    let state = seed()
    state = run(state, 'op1', { type: 'pause-pair', id: 'p1', reason: '单组调整' })
    expect(state.pairs.find(pair => pair.id === 'p1')!.status).toBe('paused')
    expect(state.pairs.find(pair => pair.id === 'p3')!.status).toBe('active')
    state = run(state, 'op1', { type: 'resume-pair', id: 'p1' })
    state = run(state, 'op1', { type: 'pause-volunteer', volunteerId: 'v1', reason: '跨结对可信风险待保护岗核实' })
    expect(state.pairs.filter(pair => pair.volunteerId === 'v1').every(pair => pair.status === 'paused')).toBe(true)
    expect(state.pairs.filter(pair => pair.volunteerId === 'v1').every(pair => pair.pauseReason?.startsWith('保护性暂停：'))).toBe(true)
    expect(state.pairs.find(pair => pair.id === 'p2')!.status).toBe('active')
  })

  it('校内协调老师只能在本校给他人指派，撤权后新查询立即失效', () => {
    let state = seed()
    state.people.push({ id: 't3', role: 'teacher', schoolId: 'school-a', nickname: '林老师', subtitle: '合成替补老师', avatar: '📘', interests: [] })
    state = run(state, 'op1', { type: 'assign-teacher', schoolId: 'school-a', teacherId: 't1', scope: ['status', 'school-coordinate'], startsAt: state.clock })
    state = run(state, 't1', { type: 'assign-teacher', schoolId: 'school-a', teacherId: 't3', childId: 'c1', scope: ['status'], startsAt: state.clock, endsAt: '2026-10-20T09:00:00+08:00' })
    expect(hasTeacherScope(state, 't3', 'c1', 'status')).toBe(true)
    expect(hasTeacherScope(state, 't3', 'c2', 'status')).toBe(false)
    expect(hasTeacherScope(at(state, '2026-10-21'), 't3', 'c1', 'status')).toBe(false)
    expect(() => run(state, 't1', { type: 'assign-teacher', schoolId: 'school-a', teacherId: 't1', childId: 'c1', scope: ['capture'], startsAt: state.clock })).toThrow('不能给自己扩权')
    expect(() => run(state, 't1', { type: 'assign-teacher', schoolId: 'school-a', teacherId: 't2', childId: 'c1', scope: ['status'], startsAt: state.clock })).toThrow('同一有效学校')
    const assignment = state.teacherAssignments!.find(item => item.teacherId === 't3')!
    state = run(state, 't1', { type: 'revoke-teacher-assignment', id: assignment.id })
    expect(hasTeacherScope(state, 't3', 'c1', 'status')).toBe(false)
    expect(scopeState(state, 't3').pairs).toHaveLength(0)
  })
})

describe('正式权限与受限求助', () => {
  it('未审核、未送达、私人草稿与其他结对数据在服务端投影中不可见', () => {
    const state = write(seed())
    expect(scopeState(state, 'v1').letters.some(l => l.id === 'new')).toBe(false)
    expect(scopeState(state, 'op1').letters.some(l => l.id === 'new')).toBe(false)
    expect(scopeState(state, 't1').letters).toEqual([expect.objectContaining({ id: 'l1', title: '', body: '', moderation: 'approved' })])
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
    expect(reviewOnly.pairs.map(p => p.id)).toEqual(['p2'])
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
    expect(reduceCommand(state, 'op1', match, { formal: true }).pairs).toHaveLength(5)
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
  it('儿童出站图片须双重人工确认并生成分离的获准副本；正式流程缺少受控处理时拒绝放行', () => {
    let state = write(seed(), 't2', 'paper-image', { pairId: 'p2', body: '这是忠实转写。' })
    state.attachments.push({ id: 'private-source', pairId: 'p2', name: 'synthetic.png', type: 'image/png', ownerId: 't2', blob: new Blob(['synthetic'], { type: 'image/png' }) })
    state.letters.find(letter => letter.id === 'paper-image')!.attachmentId = 'private-source'
    state = run(state, 't2', { type: 'submit-letter', id: 'paper-image', confirmedByChild: true })
    state.people.forEach(person => person.accountStatus = 'active')
    expect(() => run(state, 'op1', { type: 'review-letter', id: 'paper-image', decision: 'approved', note: '' })).toThrow('逐行核对')
    expect(() => reduceCommand(state, 'op1', { type: 'review-letter', id: 'paper-image', decision: 'approved', note: '', transcriptFaithfulConfirmed: true, imagePrivacyConfirmed: true }, { formal: true })).toThrow('相互隔离且可校验')
    const approved = run(state, 'op1', { type: 'review-letter', id: 'paper-image', decision: 'approved', note: '', transcriptFaithfulConfirmed: true, imagePrivacyConfirmed: true })
    const letter = approved.letters.find(item => item.id === 'paper-image')!
    expect(letter.approvedRenditionId).not.toBe(letter.attachmentId)
    expect(approved.manuscriptAssets?.filter(item => item.letterId === letter.id).map(item => item.kind).sort()).toEqual(['approved-redacted', 'original'])
    expect(approved.ocrRuns?.find(item => item.id === letter.ocrRunId)).toMatchObject({ engine: 'manual-faithful-transcription', status: 'completed', humanReviewRequired: true })
    const recipientView = scopeState(approved, 'v2')
    const recipientLetter = recipientView.letters.find(item => item.id === letter.id)!
    expect(recipientLetter.manuscriptAssetId).toBeUndefined()
    expect(recipientLetter.attachmentId).toBe(letter.approvedRenditionId)
    expect(recipientView.manuscriptAssets).toEqual([])
    expect(recipientView.ocrRuns?.find(item => item.id === letter.ocrRunId)).toMatchObject({ sourceSha256: '', manuscriptAssetId: '' })
    expect(recipientView.attachments.map(item => item.id)).toEqual([letter.approvedRenditionId])
  })
  it('求助成为独立保护个案，只对申请人和未涉事处理人可见', () => {
    let state = run(seed(), 'c1', { type: 'help', pairId: 'p1', body: '有件事情想私下和运营说。', reportedParty: 'teacher', reportedPersonId: 't1' })
    const help = state.helpCases!.at(-1)!
    expect(help.requesterId).toBe('c1')
    expect(help.reportedPersonId).toBe('t1')
    expect(help.excludedActorIds).toContain('t1')
    expect(scopeState(state, 'c1').helpCases?.some(item => item.id === help.id)).toBe(true)
    expect(scopeState(state, 't1').helpCases).toHaveLength(0)
    expect(scopeState(state, 'v1').helpCases).toHaveLength(0)
    state.people.find(p => p.id === 'op1')!.permissions = ['review']
    expect(scopeState(state, 'op1').helpCases).toHaveLength(0)
    expect(() => run(state, 'op1', { type: 'resolve-help-case', id: help.id, note: '已经处理完成' })).toThrow('没有关闭')
  })
  it('无结对求助不会默认关联第一组，伪造他人结对或被反映人身份会被拒绝', () => {
    const state = seed()
    const helped = run(state, 'c1', { type: 'help', body: '我需要帮助。', reportedParty: 'other' })
    expect(helped.helpCases?.at(-1)?.pairId).toBeUndefined()
    expect(helped.helpCases?.at(-1)?.ownerId).toBe('op1')
    expect(() => run(state, 'c1', { type: 'help', pairId: 'p2', body: '我需要帮助。', reportedParty: 'other' })).toThrow('自己的书信伙伴')
    expect(() => run(state, 'c1', { type: 'help', body: '我需要帮助。', reportedParty: 'teacher', reportedPersonId: 't2' })).toThrow('与你有关')
  })
  it('举报运营可不知道姓名；已知对象交独立平台岗，未知对象绕开全部运营', () => {
    const state = seed()
    const named = run(state, 'c1', { type: 'help', body: '想反映普通运营。', reportedParty: 'operator', reportedPersonId: 'op1' })
    expect(named.helpCases?.at(-1)?.excludedActorIds).toContain('op1')
    expect(scopeState(named, 'op1').helpCases).toHaveLength(0)
    const helped = run(state, 'c1', { type: 'help', body: '想反映一位运营人员，但不知道姓名。', reportedParty: 'operator' })
    const help = helped.helpCases!.at(-1)!
    expect(help.ownerId).toBe('t1')
    expect(help.excludedActorIds).toEqual(expect.arrayContaining(['op1', 'op2', 'op3']))
    expect(scopeState(helped, 'op1').helpCases).toHaveLength(0)
    expect(scopeState(helped, 'op2').helpCases?.some(item => item.id === help.id)).toBe(false)
    expect(scopeState(helped, 't1').helpCases?.some(item => item.id === help.id)).toBe(true)
    expect(() => run(helped, 'op1', { type: 'resolve-help-case', id: help.id, note: '已经处理完成' })).toThrow('被反映人')
    const triaged = run(helped, 't1', { type: 'triage-help-case', id: help.id, severity: 'medium', reportRequired: false, note: '由校方保护负责人完成分诊并安排支持。' })
    expect(run(triaged, 't1', { type: 'resolve-help-case', id: help.id, note: '已由校方保护负责人核实并安排支持。' }).helpCases?.find(item => item.id === help.id)?.status).toBe('resolved')
  })
  it('平台独立保护人员不可用时，举报运营转交校方保护负责人而不是普通运营', () => {
    const state = seed()
    state.people.find(p => p.id === 'op2')!.accountStatus = 'disabled'
    const routed = run(state, 'c1', { type: 'help', body: '想反映一位运营人员。', reportedParty: 'operator', reportedPersonId: 'op1' })
    expect(routed.helpCases!.at(-1)).toMatchObject({ ownerId: 't1', schoolOwnerId: 't1' })
    state.people.find(p => p.id === 'op1')!.permissions = ['administration']
    state.people.find(p => p.id === 't1')!.accountStatus = 'disabled'
    const rerouted = run(state, 'c1', { type: 'help', body: '我需要帮助。', reportedParty: 'other' })
    expect(rerouted.helpCases!.at(-1)).toMatchObject({ ownerId: 't3', schoolOwnerId: 't3' })
  })
  it('学校没有有效保护席时不把个案分给普通 protect 指派老师', () => {
    const state = seed()
    state.schoolAuthorities = []
    state.teacherAssignments!.push({ id: 'ordinary-protect', schoolId: 'school-a', teacherId: 't3', childId: 'c1', scope: ['protect'], startsAt: state.clock, approvedBy: 'synthetic-school-a' })
    const routed = run(state, 'c1', { type: 'help', body: '我需要独立人员帮助。', reportedParty: 'other' })
    expect(routed.helpCases!.at(-1)).toMatchObject({ ownerId: 'op1', schoolOwnerId: undefined })
    expect(() => run(state, 'c1', { type: 'help', body: '想反映一位运营，但不知道姓名。', reportedParty: 'operator' })).toThrow('没有可独立接手')
  })
  it('不知道涉事老师姓名时不把个案正文交给任何老师，结案后原处理人撤权', () => {
    const opened = run(seed(), 'c1', { type: 'help', body: '想反映一位老师，但不知道姓名。', reportedParty: 'teacher' })
    const item = opened.helpCases!.at(-1)!
    expect(item.schoolOwnerId).toBeUndefined()
    const requesterView = scopeState(opened, 'c1').helpCases!.find(entry => entry.id === item.id)!
    expect(requesterView).toMatchObject({ body: '想反映一位老师，但不知道姓名。', ownerId: '', history: [] })
    expect(requesterView.backupOwnerId).toBeUndefined()
    const triaged = run(opened, item.ownerId, { type: 'triage-help-case', id: item.id, severity: 'medium', reportRequired: false, note: '独立保护人员已完成分诊。' })
    const resolved = run(triaged, item.ownerId, { type: 'resolve-help-case', id: item.id, note: '已由独立人员处理并安排后续支持。' })
    expect(scopeState(resolved, item.ownerId).helpCases).toHaveLength(0)
    const resolvedRequesterView = scopeState(resolved, 'c1').helpCases!.find(entry => entry.id === item.id)!
    expect(resolvedRequesterView).toMatchObject({ status: 'resolved', history: [], ownerId: '' })
    expect(resolvedRequesterView).not.toHaveProperty('resolution')
  })
  it('普通管理岗不能以管理权限代替儿童保护岗暂停志愿者全部结对', () => {
    const state = seed()
    state.people.find(p => p.id === 'op1')!.permissions = ['administration']
    expect(() => run(state, 'op1', { type: 'pause-volunteer', volunteerId: 'v1', reason: '待核实风险' })).toThrow('儿童保护授权岗')
  })
  it('负责老师可立即停止自己的学校交付，但不能停止跨校结对或自行恢复', () => {
    const state = seed()
    expect(() => run(state, 't1', { type: 'pause-pair', id: 'p2', reason: '跨校测试' })).toThrow('当前负责老师')
    const paused = run(state, 't2', { type: 'pause-pair', id: 'p2', reason: '需要保护性核实' })
    expect(paused.pairs.find(pair => pair.id === 'p2')).toMatchObject({ status: 'paused', pauseReason: '保护性暂停：学校停止交付：需要保护性核实', pauseOwnerId: 't2' })
    const helpCase = paused.helpCases!.find(item => item.pairId === 'p2' && item.requesterId === 't2')
    expect(helpCase).toMatchObject({ status: 'open', severity: 'medium' })
    expect(paused.disputeCases!.some(item => item.pairId === 'p2' && item.caseId === helpCase?.id && item.status === 'joint-review')).toBe(true)
    expect(() => run(paused, 't2', { type: 'resume-pair', id: 'p2' })).toThrow('相应权限')
    expect(() => run(paused, 'op1', { type: 'resume-pair', id: 'p2' })).toThrow('争议裁决')
  })
  it('已处理但尚未回应的事项到下次跟进时间重新打开', () => {
    let state = approve(submit(write(seed(), 'c1', 'child-one', { replyTo: 'l1' }), 'child-one'), 'child-one')
    state = at(state, '2026-11-10')
    const followup = state.followups.find(f => f.pairId === 'p1')!
    state = run(state, 'op1', { type: 'resolve-followup', id: followup.id, note: '已经沟通，下周再次询问。', nextFollowupAt: '2026-11-17T09:00:00+08:00' })
    expect(at(state, '2026-11-16').followups.find(f => f.id === followup.id)!.status).toBe('resolved')
    expect(at(state, '2026-11-17').followups.find(f => f.id === followup.id)!.status).toBe('open')
    const adultPending = approve(submit(write(seed(), 'c1', 'another-child-letter', { replyTo: 'l1' }), 'another-child-letter'), 'another-child-letter')
    expect(refreshState(adultPending, '2026-11-10T09:00:00+08:00').followups.some(f => f.pairId === 'p1')).toBe(true)
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

describe('业务与保护闭环', () => {
  it('孩子同时最多两组结对，超出容量被拒且不改变状态', () => {
    const state = seed()
    expect(state.pairs.filter(pair => pair.status !== 'ended')).toHaveLength(4)
    const before = structuredClone(state)
    expect(() => run(state, 'op1', { type: 'match', childId: 'c1', volunteerId: 'v3', teacherId: 't1', channel: 'online' })).toThrow('同一名孩子同时最多 2 组')
    expect(state).toEqual(before)
  })
  it('没有在任学校负责人时，敏感授权被阻断并给出具体原因', () => {
    const state = seed()
    state.helpCases!.push({ id: 'case-p1', requesterId: 'c1', pairId: 'p1', reportedParty: 'other', excludedActorIds: [], ownerId: 'op2', schoolOwnerId: 't1', status: 'open', body: '合成个案', createdAt: state.clock, updatedAt: state.clock, history: [] })
    state.schoolAuthorities = []
    const before = state.accessGrants!.length
    const expiresAt = new Date(Date.parse(state.clock) + 3_600_000).toISOString()
    expect(() => run(state, 't1', { type: 'grant-access', userId: 'op2', targetType: 'letter', targetId: 'l1', caseId: 'case-p1', purpose: 'safeguarding-case', reason: '需要核对个案关联的来信。', expiresAt })).toThrow('只有学校负责人')
    expect(state.accessGrants).toHaveLength(before)
  })
  it('敏感正文授权必须关联个案、由两名非受权人签名，不能自签自批', () => {
    let state = seed()
    state.helpCases!.push({ id: 'case-p1', requesterId: 'c1', pairId: 'p1', reportedParty: 'other', excludedActorIds: [], ownerId: 'op2', schoolOwnerId: 't1', status: 'open', body: '合成个案', createdAt: state.clock, updatedAt: state.clock, history: [] })
    const expiresAt = new Date(Date.parse(state.clock) + 3_600_000).toISOString()
    const command: Command = { type: 'grant-access', userId: 'op2', targetType: 'letter', targetId: 'l1', caseId: 'case-p1', purpose: 'safeguarding-case', reason: '核对个案关联的指定信件。', expiresAt }
    expect(() => run(state, 'op2', command)).toThrow('不能给自己签发')
    state = run(state, 'op1', command)
    const pending = state.accessGrants!.find(item => item.caseId === 'case-p1')!
    expect(pending.approvedBy).toBeUndefined()
    expect(canReadLetter(state, state.people.find(item => item.id === 'op2')!, state.letters.find(item => item.id === 'l1')!)).toBe(false)
    expect(() => run(state, 'op1', command)).toThrow('第二签名')
    state = run(state, 't1', command)
    expect(state.accessGrants!.find(item => item.id === pending.id)?.approvedBy).toBe('t1')
    expect(canReadLetter(state, state.people.find(item => item.id === 'op2')!, state.letters.find(item => item.id === 'l1')!)).toBe(true)
    const wrongCase: Command = { ...command, targetId: 'l2' }
    expect(() => run(state, 'op1', wrongCase)).toThrow('没有可核对的关联')
  })
  it('学校负责人不能跨校开启紧急破窗或签发敏感访问授权', () => {
    const state = seed()
    expect(() => run(state, 't1', { type: 'open-emergency-access', targetType: 'letter', targetId: 'l2', reason: '合成演练：需要紧急核实另一学校孩子的信件内容。' })).toThrow('本校')
    state.helpCases!.push({ id: 'case-p2', requesterId: 'c2', pairId: 'p2', reportedParty: 'other', excludedActorIds: [], ownerId: 'op2', schoolOwnerId: 't2', status: 'open', body: '合成个案', createdAt: state.clock, updatedAt: state.clock, history: [] })
    const expiresAt = new Date(Date.parse(state.clock) + 3_600_000).toISOString()
    expect(() => run(state, 't1', { type: 'grant-access', userId: 'op2', targetType: 'letter', targetId: 'l2', caseId: 'case-p2', purpose: 'safeguarding-case', reason: '核对个案关联的指定信件。', expiresAt })).toThrow('本校')
  })
  it('紧急破窗只作用于单个对象、两小时失效，未复核前拒绝第二次', () => {
    let state = seed()
    state = run(state, 'op1', { type: 'open-emergency-access', targetType: 'letter', targetId: 'l1', reason: '合成演练：来信出现紧急风险线索，需要立即核实。' })
    const grant = state.accessGrants!.at(-1)!
    expect(grant).toMatchObject({ targetType: 'letter', targetId: 'l1', emergency: true })
    expect(Date.parse(grant.expiresAt) - Date.parse(state.clock)).toBeLessThanOrEqual(2 * 3_600_000)
    expect(() => run(state, 'op1', { type: 'open-emergency-access', targetType: 'letter', targetId: 'l2', reason: '合成演练：准备再开一次破窗核对另一封信。' })).toThrow('未复核的紧急破窗')
  })
  it('高严重度个案缺报告字段不能关闭，被反映者不能读取或接手', () => {
    const state = seed()
    expect(() => run(state, 'op2', { type: 'resolve-help-case', id: 'case-1', note: '已联系学校并完成必要记录。' })).toThrow('报告记录')
    expect(() => run(state, 'v1', { type: 'claim-help-case', id: 'case-1' })).toThrow('不能读取或接手')
    expect(scopeState(state, 'v1').helpCases ?? []).toHaveLength(0)
    let done = run(state, 'op2', { type: 'update-help-report', id: 'case-1', reportDecision: 'reported', reportAuthority: '合成区未成年人保护中心', reportReceipt: 'SYN-2026-001' })
    done = run(done, 'op2', { type: 'resolve-help-case', id: 'case-1', note: '已完成报告并安排后续支持。' })
    expect(done.helpCases!.find(item => item.id === 'case-1')!.status).toBe('resolved')
  })
  it('个案负责人不能取消报告要求，免报告必须由独立隐私复核人确认', () => {
    let state = seed()
    expect(() => run(state, 'op2', { type: 'update-help-report', id: 'case-1', reportRequired: false } as unknown as Command)).toThrow('不能由负责人自行取消')
    expect(() => run(state, 'op2', { type: 'update-help-report', id: 'case-1', reportDecision: 'not-required', reportReason: '不构成报告' })).toThrow('隐私复核人')
    expect(() => run(state, 'op3', { type: 'update-help-report', id: 'case-1', reportDecision: 'not-required', reportReason: '经独立复核，合成情境不构成法定报告。' })).toThrow('双签审计授权')
    const expiresAt = new Date(Date.parse(state.clock) + 3_600_000).toISOString()
    const grant: Command = { type: 'grant-access', userId: 'op3', targetType: 'help-case', targetId: 'case-1', caseId: 'case-1', purpose: 'audit-review', reason: '独立复核是否构成法定报告。', expiresAt }
    state = run(state, 'op1', grant)
    expect(scopeState(state, 'op3').helpCases?.find(item => item.id === 'case-1')?.body).toBe('')
    state = run(state, 't1', grant)
    expect(scopeState(state, 'op3').helpCases?.find(item => item.id === 'case-1')?.body).toBe('我想反映一些让我不舒服的话。')
    const reviewed = run(state, 'op3', { type: 'update-help-report', id: 'case-1', reportDecision: 'not-required', reportReason: '经独立复核，合成情境不构成法定报告。' })
    expect(reviewed.helpCases!.find(item => item.id === 'case-1')).toMatchObject({ reportRequired: true, reportDecision: 'not-required', reportReviewedBy: 'op3' })
    expect(run(reviewed, 'op2', { type: 'resolve-help-case', id: 'case-1', note: '已完成独立复核并安排支持。' }).helpCases!.find(item => item.id === 'case-1')?.status).toBe('resolved')
  })
  it('保护个案必须先分诊才能结案，老师的分诊、报告与结案使用同一保护席口径', () => {
    let state = seed()
    state.helpCases!.push({ id: 'untriaged', requesterId: 'c1', pairId: 'p1', reportedParty: 'other', excludedActorIds: [], ownerId: 'op2', schoolOwnerId: 't1', status: 'open', body: '待分诊合成个案', createdAt: state.clock, updatedAt: state.clock, severity: 'medium', reportRequired: false, history: [] })
    expect(() => run(state, 'op2', { type: 'resolve-help-case', id: 'untriaged', note: '直接关闭个案。' })).toThrow('先完成分诊')
    state = run(state, 'op2', { type: 'triage-help-case', id: 'untriaged', severity: 'medium', reportRequired: false, note: '已核实风险与响应时限。' })
    expect(run(state, 'op2', { type: 'resolve-help-case', id: 'untriaged', note: '已完成处理并安排支持。' }).helpCases!.find(item => item.id === 'untriaged')?.status).toBe('resolved')

    state = seed()
    state.people.push({ id: 't5', role: 'teacher', schoolId: 'school-a', nickname: '无保护席老师', subtitle: '合成身份', avatar: '📙', interests: [] })
    state.teacherAssignments!.push({ id: 'assignment-t5', schoolId: 'school-a', teacherId: 't5', childId: 'c1', scope: ['protect'], startsAt: state.clock, approvedBy: 'synthetic-school-a' })
    state.helpCases!.push({ id: 'teacher-seat-case', requesterId: 'c1', pairId: 'p1', reportedParty: 'other', excludedActorIds: [], ownerId: 't5', schoolOwnerId: 't5', status: 'open', body: '保护席口径测试', createdAt: state.clock, updatedAt: state.clock, severity: 'medium', reportRequired: false, history: [] })
    expect(() => run(state, 't5', { type: 'triage-help-case', id: 'teacher-seat-case', severity: 'medium', reportRequired: false, note: '尝试分诊。' })).toThrow('权限')
    expect(() => run(state, 't5', { type: 'resolve-help-case', id: 'teacher-seat-case', note: '尝试关闭。' })).toThrow('没有关闭')
    const expiresAt = new Date(Date.parse(state.clock) + 3_600_000).toISOString()
    expect(() => run(state, 'op1', { type: 'grant-access', userId: 't5', targetType: 'help-case', targetId: 'teacher-seat-case', caseId: 'teacher-seat-case', purpose: 'safeguarding-case', reason: '尝试给无保护席老师授权。', expiresAt })).toThrow('只能授权给')
  })
  it('同校保护席备岗能在快照中看到可读个案，已结案历史不因负责人离任永久告警', () => {
    const state = seed()
    state.helpCases!.push({ id: 'school-backup-visible', requesterId: 'c1', pairId: 'p1', reportedParty: 'volunteer', reportedPersonId: 'v1', excludedActorIds: ['v1'], ownerId: 'op2', schoolOwnerId: 't1', status: 'open', body: '同校保护席备岗读取测试。', createdAt: state.clock, updatedAt: state.clock, severity: 'medium', reportRequired: false, history: [] })
    const backupView = scopeState(state, 't3')
    expect(backupView.helpCases?.find(item => item.id === 'school-backup-visible')?.body).toBe('同校保护席备岗读取测试。')

    state.helpCases!.push({ id: 'resolved-history', requesterId: 'c1', pairId: 'p1', reportedParty: 'other', excludedActorIds: [], ownerId: 'op2', schoolOwnerId: 't1', status: 'resolved', body: '已结案合成历史。', createdAt: state.clock, updatedAt: state.clock, resolution: '已完成处置。', severity: 'medium', triagedAt: state.clock, triagedBy: 'op2', triageNote: '已完成分诊。', reportRequired: false, history: [] })
    state.people.find(person => person.id === 't1')!.accountStatus = 'disabled'
    expect(checkInvariants(state).filter(item => item.rule === 'CASE_OWNER_ELIGIBLE' && item.refs.includes('resolved-history'))).toEqual([])
  })
  it('结案撤销处置权限，但仍可双签发放限期审计或数据申请授权', () => {
    let state = seed()
    state = run(state, 'op2', { type: 'update-help-report', id: 'case-1', reportDecision: 'reported', reportAuthority: '合成区未成年人保护中心', reportReceipt: 'SYN-AUDIT-001' })
    state = run(state, 'op2', { type: 'resolve-help-case', id: 'case-1', note: '已完成报告并安排后续支持。' })
    const expiresAt = new Date(Date.parse(state.clock) + 3_600_000).toISOString()
    const auditGrant: Command = { type: 'grant-access', userId: 'op3', targetType: 'help-case', targetId: 'case-1', caseId: 'case-1', purpose: 'audit-review', reason: '结案后复核处置记录与报告闭环。', expiresAt }
    expect(() => run(state, 'op1', { ...auditGrant, purpose: 'safeguarding-case' })).toThrow('结案后只能签发')
    state = run(state, 'op1', auditGrant)
    state = run(state, 't1', auditGrant)
    expect(scopeState(state, 'op3').helpCases?.find(item => item.id === 'case-1')?.body).toBe('我想反映一些让我不舒服的话。')
    expect(scopeState(state, 'op2').helpCases?.some(item => item.id === 'case-1')).toBe(false)
  })
  it('未结案个案超过 SLA 会形成高严重度自检，隐私岗只见元数据', () => {
    const state = seed()
    state.helpCases!.push({ id: 'sla-overdue', requesterId: 'c1', pairId: 'p1', reportedParty: 'other', excludedActorIds: [], ownerId: 'op2', schoolOwnerId: 't1', status: 'open', body: '合成超时个案正文', createdAt: '2026-10-17T09:00:00+08:00', updatedAt: '2026-10-17T09:00:00+08:00', severity: 'medium', slaDueAt: '2026-10-18T09:00:00+08:00', reportRequired: false, history: [] })
    expect(checkInvariants(state)).toContainEqual(expect.objectContaining({ rule: 'HELP_CASE_SLA', severity: 'high', refs: ['sla-overdue'] }))
    const privacyView = scopeState(state, 'op3')
    expect(privacyView.helpCases?.find(item => item.id === 'sla-overdue')).toMatchObject({ body: '', status: 'open', slaDueAt: '2026-10-18T09:00:00+08:00' })
    expect(checkInvariants(privacyView)).toContainEqual(expect.objectContaining({ rule: 'HELP_CASE_SLA', refs: ['sla-overdue'] }))
  })
  it('求助创建即有默认分诊时限，伪造争议信件或个案编号会被拒绝', () => {
    const state = seed()
    const helped = run(state, 'c1', { type: 'help', pairId: 'p1', body: '我需要帮助。', reportedParty: 'other' })
    expect(helped.helpCases!.at(-1)).toMatchObject({ severity: 'medium', reportRequired: false })
    expect(helped.helpCases!.at(-1)?.slaDueAt).toBe(new Date(Date.parse(state.clock) + 86_400_000).toISOString())
    expect(() => run(state, 't1', { type: 'open-dispute', schoolId: 'school-a', topic: 'delivery', pairId: 'p1', letterId: 'l2', reason: '信件归属需要核对。' })).toThrow('不属于所选学校与结对')
    expect(() => run(state, 't1', { type: 'open-dispute', schoolId: 'school-a', topic: 'delivery', pairId: 'p1', caseId: 'missing-case', reason: '个案归属需要核对。' })).toThrow('个案不存在或不属于')
  })
  it('争议开启立即暂停该结对，只有双签名裁决后才能恢复', () => {
    let state = seed()
    state = run(state, 't1', { type: 'open-dispute', schoolId: 'school-a', topic: 'pause', pairId: 'p1', reason: '合成演练：出现需要联合复核的分歧。' })
    const dispute = state.disputeCases!.at(-1)!
    expect(state.pairs.find(pair => pair.id === 'p1')!.status).toBe('paused')
    expect(() => run(state, 'op1', { type: 'resume-pair', id: 'p1' })).toThrow('争议裁决')
    state = run(state, 't1', { type: 'decide-dispute', id: dispute.id, decision: 'resume', reason: '学校已完成核实。' })
    expect(() => run(state, 'op1', { type: 'resume-pair', id: 'p1' })).toThrow('争议裁决')
    state = run(state, 'op1', { type: 'decide-dispute', id: dispute.id, decision: 'resume', reason: '平台已复核，同意恢复。' })
    expect(state.disputeCases!.find(item => item.id === dispute.id)!.status).toBe('decided')
    state = run(state, 'op1', { type: 'resume-pair', id: 'p1' })
    expect(state.pairs.find(pair => pair.id === 'p1')!.status).toBe('active')
  })
  it('暂停志愿者会暂停其全部结对，并为每个受影响孩子建立支持任务', () => {
    const state = run(seed(), 'op1', { type: 'pause-volunteer', volunteerId: 'v2', reason: '合成演练：需要核实跨结对相似话术。' })
    expect(state.pairs.filter(pair => pair.volunteerId === 'v2').map(pair => pair.status)).toEqual(['paused', 'paused'])
    const tasks = state.supportTasks!.filter(task => state.pairs.some(pair => pair.volunteerId === 'v2' && pair.id === task.pairId))
    expect(tasks).toHaveLength(2)
    expect(tasks.every(task => task.status === 'open' && !!task.ownerTeacherId)).toBe(true)
    expect(tasks[0].dueAt).toBe(new Date(Date.parse(state.clock) + 3 * 86_400_000).toISOString())
  })
  it('同一志愿者跨两个结对的相同话术聚合成一条风险信号', () => {
    const body = '你好呀，最近我在窗边看到一只小鸟，它每天都停在同一根树枝上，我想把这个小小的发现分享给你，愿你今天也有好心情。'
    let state = seed()
    state = write(state, 'v2', 'script-p2', { pairId: 'p2', body })
    state = submit(state, 'script-p2', 'v2')
    expect(state.riskSignals!.filter(signal => signal.volunteerId === 'v2')).toHaveLength(0)
    state = write(state, 'v2', 'script-p3', { pairId: 'p3', body })
    state = submit(state, 'script-p3', 'v2')
    const signals = state.riskSignals!.filter(signal => signal.volunteerId === 'v2')
    expect(signals).toHaveLength(1)
    expect([...signals[0].pairIds].sort()).toEqual(['p2', 'p3'])
  })
  it('未完成当前版本培训的志愿者不能提交首封信，完成后可提交', () => {
    let state = run(seed(), 'op1', { type: 'match', childId: 'c3', volunteerId: 'v4', teacherId: 't1', channel: 'online' })
    const pair = state.pairs.find(item => item.volunteerId === 'v4')!
    expect(() => write(state, 'v4', 'v4-letter', { pairId: pair.id })).toThrow('行为边界培训')
    state = run(state, 'v4', { type: 'complete-training', version: '2026-10-v1' })
    state = write(state, 'v4', 'v4-letter', { pairId: pair.id })
    state = submit(state, 'v4-letter', 'v4')
    expect(state.letters.find(letter => letter.id === 'v4-letter')!.moderation).toBe('pending')
  })
  it('种子数据不变量零违规，人为破坏后报出对应规则', () => {
    const state = seed()
    expect(checkInvariants(state)).toEqual([])
    const skipped = structuredClone(state)
    skipped.deliveryEvents = [{ id: 'bad-delivery', letterId: 'l2', type: 'handed-to-child', actorId: 't2', at: state.clock }]
    expect(checkInvariants(skipped).some(item => item.rule === 'PAPER_EVENT_ORDER')).toBe(true)
    const duplicated = structuredClone(state)
    duplicated.pairs.push({ ...duplicated.pairs[0], id: 'p1-duplicate' })
    expect(checkInvariants(duplicated).some(item => item.rule === 'PAIR_UNIQUE')).toBe(true)
  })
})
