import { describe, expect, it } from 'vitest'
import { emptyStore, executeAttachmentContentRead, executeCommand, executeHelpCaseContentRead, executeLetterContentRead, executeSnapshot, ServiceError, type Repository } from './core'

function repositoryForRole(role: 'child' | 'volunteer' | 'teacher') {
  const store = emptyStore('2026-10-21T00:00:00.000Z')
  const uid = `${role}-test`
  store.accounts[uid] = { uid, role, status: 'active', permissions: [], createdAt: store.state.clock }
  store.state.people.push({ id: uid, role, nickname: role, subtitle: '', avatar: '', interests: [], accountStatus: 'active' })
  const repository: Repository = {
    read: operation => operation(store),
    transact: operation => operation(store),
  }
  return { store, repository, identity: { uid } }
}

describe('command authorization responses', () => {
  it('returns FORBIDDEN for a teacher attempting to create a pairing and leaves the store unchanged', async () => {
    const { store, repository, identity } = repositoryForRole('teacher')

    await expect(executeCommand(repository, identity, {
      requestId: 'teacher-match-test-001',
      command: { type: 'match', childId: 'child', volunteerId: 'volunteer', teacherId: identity.uid, channel: 'online' },
    })).rejects.toMatchObject({ code: 'FORBIDDEN' } satisfies Partial<ServiceError>)

    expect(store.revision).toBe(0)
    expect(store.state.pairs).toHaveLength(0)
    expect(store.receipts).toEqual({})
  })

  it('returns FORBIDDEN for non-operators attempting pairing administration commands', async () => {
    const { repository, identity } = repositoryForRole('volunteer')

    await expect(executeCommand(repository, identity, {
      requestId: 'volunteer-pause-test-01',
      command: { type: 'pause-pair', id: 'pair', reason: '测试越权' },
    })).rejects.toMatchObject({ code: 'FORBIDDEN' } satisfies Partial<ServiceError>)
  })

  it('returns a client action error instead of an internal error for an invalid business command', async () => {
    const { repository, identity } = repositoryForRole('child')

    await expect(executeCommand(repository, identity, {
      requestId: 'child-invalid-pair-test',
      command: { type: 'save-letter', pairId: 'missing-pair', title: '', body: '一段测试文字' },
    })).rejects.toMatchObject({ code: 'INVALID_ACTION' } satisfies Partial<ServiceError>)
  })

  it('does not save a help request when no independent safeguarding handler exists', async () => {
    const { store, repository, identity } = repositoryForRole('child')
    store.accounts['operator-test'] = { uid: 'operator-test', role: 'operator', status: 'active', permissions: ['help'], createdAt: store.state.clock }
    store.state.people.push({ id: 'operator-test', role: 'operator', nickname: '被反映人员', subtitle: '', avatar: '', interests: [], accountStatus: 'active' })

    await expect(executeCommand(repository, identity, {
      requestId: 'child-operator-help-001',
      command: { type: 'help', body: '需要独立人员帮助。', reportedParty: 'operator', reportedPersonId: 'operator-test' },
    })).rejects.toMatchObject({ code: 'INVALID_ACTION' } satisfies Partial<ServiceError>)

    expect(store.state.followups).toHaveLength(0)
    expect(store.revision).toBe(0)
    expect(store.receipts).toEqual({})
  })

  it('separates protection cases, requires an independent operator route, and recuses the reported handler', async () => {
    const { store, repository, identity } = repositoryForRole('child')
    for (const [uid, permissions] of [
      ['reported-operator', ['help', 'followup']],
      ['independent-handler', ['help', 'help-independent']],
      ['ordinary-help-backup', ['help']],
      ['overdue-handler', ['followup']],
    ] as const) {
      store.accounts[uid] = { uid, role: 'operator', status: 'active', permissions: [...permissions], createdAt: store.state.clock }
      store.state.people.push({ id: uid, role: 'operator', nickname: uid, subtitle: '', avatar: '', interests: [], accountStatus: 'active' })
    }
    const id = 'case-operator-1'
    store.state.helpCases = [{ id, requesterId: identity.uid, reportedParty: 'operator', reportedPersonId: 'reported-operator', excludedActorIds: ['reported-operator'], ownerId: 'independent-handler', backupOwnerId: 'ordinary-help-backup', status: 'open', body: '需要独立保护人员处理。', createdAt: store.state.clock, updatedAt: store.state.clock, severity: 'medium', triagedAt: store.state.clock, triagedBy: 'independent-handler', triageNote: '已完成合成分诊。', reportRequired: false, history: [] }]
    const requesterOverview = await executeSnapshot(repository, identity, store.state.clock)
    const accusedView = await executeSnapshot(repository, { uid: 'reported-operator' })
    const overdueView = await executeSnapshot(repository, { uid: 'overdue-handler' })
    const handlerView = await executeSnapshot(repository, { uid: 'independent-handler' })
    expect(accusedView.state.helpCases?.some(item => item.id === id)).toBe(false)
    expect(overdueView.state.helpCases?.some(item => item.id === id)).toBe(false)
    expect(handlerView.state.helpCases?.find(item => item.id === id)).toMatchObject({ reportedPersonId: 'reported-operator', body: '' })
    expect(requesterOverview.state.helpCases?.find(item => item.id === id)).toMatchObject({ body: '需要独立保护人员处理。', ownerId: '', history: [] })
    await expect(executeHelpCaseContentRead(repository, { uid: 'reported-operator' }, id)).rejects.toMatchObject({ code: 'FORBIDDEN' } satisfies Partial<ServiceError>)
    await expect(executeHelpCaseContentRead(repository, { uid: 'ordinary-help-backup' }, id)).rejects.toMatchObject({ code: 'FORBIDDEN' } satisfies Partial<ServiceError>)
    await expect(executeHelpCaseContentRead(repository, { uid: 'independent-handler' }, id)).resolves.toMatchObject({ body: '需要独立保护人员处理。' })
    const requesterView = await executeHelpCaseContentRead(repository, identity, id)
    expect(requesterView).toMatchObject({ body: '需要独立保护人员处理。', status: 'open', ownerId: '', history: [] })
    expect(requesterView).not.toHaveProperty('backupOwnerId')
    expect(requesterView).not.toHaveProperty('resolution')
    await executeCommand(repository, { uid: 'independent-handler' }, { requestId: 'resolve-help-case-001', command: { type: 'resolve-help-case', id, note: '已完成必要报告并安排后续支持。' } })
    await expect(executeHelpCaseContentRead(repository, { uid: 'independent-handler' }, id)).rejects.toMatchObject({ code: 'FORBIDDEN' } satisfies Partial<ServiceError>)
    const resolvedRequesterView = await executeHelpCaseContentRead(repository, identity, id)
    expect(resolvedRequesterView).toMatchObject({ status: 'resolved', history: [], ownerId: '' })
    expect(resolvedRequesterView).not.toHaveProperty('resolution')
    expect(store.accessAudit.filter(item => item.targetType === 'help-case' && item.targetId === id).map(item => item.decision)).toEqual(['denied', 'denied', 'allowed', 'allowed', 'denied', 'allowed'])
  })

  it('authorizes a teacher only for an active same-school paper task and strips content from overview snapshots', async () => {
    const store = emptyStore('2026-10-21T00:00:00.000Z')
    const repository: Repository = { read: operation => operation(store), transact: operation => operation(store) }
    for (const [uid, role] of [['child-1', 'child'], ['volunteer-1', 'volunteer'], ['teacher-1', 'teacher'], ['teacher-2', 'teacher']] as const) {
      store.accounts[uid] = { uid, role, status: 'active', permissions: [], createdAt: store.state.clock }
      store.state.people.push({ id: uid, role, nickname: uid, subtitle: '', avatar: '', interests: [], accountStatus: 'active', schoolId: uid === 'teacher-2' ? 'school-2' : 'school-1' })
    }
    store.state.schools = [{ id: 'school-1', name: '合成学校一', status: 'active' }, { id: 'school-2', name: '合成学校二', status: 'active' }]
    store.state.teacherAssignments = [
      { id: 'assignment-1', schoolId: 'school-1', teacherId: 'teacher-1', childId: 'child-1', scope: ['status', 'paper-delivery'], startsAt: '2026-10-01T00:00:00.000Z', endsAt: '2026-11-01T00:00:00.000Z', approvedBy: 'school-owner' },
      { id: 'assignment-2', schoolId: 'school-2', teacherId: 'teacher-2', childId: 'child-1', scope: ['status', 'paper-delivery'], startsAt: '2026-10-01T00:00:00.000Z', endsAt: '2026-11-01T00:00:00.000Z', approvedBy: 'school-owner-2' },
    ]
    store.state.pairs = [{ id: 'pair-1', childId: 'child-1', volunteerId: 'volunteer-1', teacherId: 'legacy-teacher', schoolId: 'school-1', channel: 'paper', status: 'active', startedAt: store.state.clock }]
    store.state.letters = [
      { id: 'letter-1', pairId: 'pair-1', authorId: 'volunteer-1', recipientId: 'child-1', createdBy: 'volunteer-1', deliveryRoute: 'school-paper', title: '合成来信', body: '仅用于权限测试', attachmentId: 'attachment-1', manuscriptAssetId: 'original-1', ocrRunId: 'ocr-1', approvedRenditionId: 'approved-1', moderation: 'approved', revision: 1, createdAt: store.state.clock, updatedAt: store.state.clock },
      { id: 'private-draft', pairId: 'pair-1', authorId: 'volunteer-1', recipientId: 'child-1', createdBy: 'volunteer-1', deliveryRoute: 'school-paper', title: '尚未提交', body: '老师不应知道这封草稿存在', moderation: 'draft', revision: 0, createdAt: store.state.clock, updatedAt: store.state.clock },
    ]
    store.state.deliveries = [{ letterId: 'letter-1' }]
    store.state.attachments = [{ id: 'attachment-1', pairId: 'pair-1', name: 'synthetic-original.webp', type: 'image/webp', ownerId: 'volunteer-1', storagePath: 'attachments/synthetic-original.webp' }, { id: 'approved-1', pairId: 'pair-1', name: 'synthetic-approved.webp', type: 'image/webp', ownerId: 'volunteer-1', storagePath: 'attachments/synthetic-approved.webp' }]

    const overview = await executeSnapshot(repository, { uid: 'teacher-1' }, store.state.clock)
    expect(overview.state.letters.map(letter => letter.id)).toEqual(['letter-1'])
    expect(overview.state.letters[0]).toMatchObject({ id: 'letter-1', body: '', title: '', attachmentId: undefined, manuscriptAssetId: undefined, ocrRunId: undefined })
    expect(store.accessAudit.filter(item => item.targetType === 'teacher-overview')).toHaveLength(0)
    const printView = await executeLetterContentRead(repository, { uid: 'teacher-1' }, 'letter-1')
    expect(printView).toMatchObject({ body: '仅用于权限测试', attachmentId: 'approved-1' })
    expect(printView).not.toHaveProperty('manuscriptAssetId')
    await expect(executeAttachmentContentRead(repository, { uid: 'teacher-1' }, 'approved-1')).resolves.toMatchObject({ storagePath: 'attachments/synthetic-approved.webp' })
    await expect(executeAttachmentContentRead(repository, { uid: 'teacher-1' }, 'attachment-1')).rejects.toMatchObject({ code: 'FORBIDDEN' } satisfies Partial<ServiceError>)
    await expect(executeCommand(repository, { uid: 'teacher-2' }, { requestId: 'teacher-cross-pause-01', command: { type: 'pause-pair', id: 'pair-1', reason: '跨校测试' } }, store.state.clock)).rejects.toMatchObject({ code: 'FORBIDDEN' } satisfies Partial<ServiceError>)
    await executeCommand(repository, { uid: 'teacher-1' }, { requestId: 'teacher-stop-delivery-01', command: { type: 'pause-pair', id: 'pair-1', reason: '需要保护性核实' } }, store.state.clock)
    expect(store.state.pairs[0]).toMatchObject({ status: 'paused', pauseReason: '保护性暂停：学校停止交付：需要保护性核实', pauseOwnerId: 'teacher-1' })
    expect(store.state.helpCases).toHaveLength(1)
    expect(store.state.disputeCases).toEqual([expect.objectContaining({ pairId: 'pair-1', status: 'joint-review' })])
    await expect(executeLetterContentRead(repository, { uid: 'teacher-1' }, 'letter-1')).rejects.toMatchObject({ code: 'FORBIDDEN' } satisfies Partial<ServiceError>)
    await expect(executeAttachmentContentRead(repository, { uid: 'teacher-1' }, 'approved-1')).rejects.toMatchObject({ code: 'FORBIDDEN' } satisfies Partial<ServiceError>)
    store.state.pairs[0].status = 'active'
    await expect(executeLetterContentRead(repository, { uid: 'teacher-2' }, 'letter-1')).rejects.toMatchObject({ code: 'FORBIDDEN' } satisfies Partial<ServiceError>)
    store.state.teacherAssignments[0].endsAt = '2026-10-20T00:00:00.000Z'
    await expect(executeLetterContentRead(repository, { uid: 'teacher-1' }, 'letter-1')).rejects.toMatchObject({ code: 'FORBIDDEN' } satisfies Partial<ServiceError>)
    expect(store.accessAudit.filter(item => item.targetId === 'letter-1').map(item => item.decision)).toEqual(['allowed', 'denied', 'denied', 'denied'])
  })

  it('lets only the assigned reviewer read a pending letter or image and fails closed when audit storage fails', async () => {
    const store = emptyStore('2026-10-21T00:00:00.000Z')
    for (const uid of ['reviewer-1', 'reviewer-2']) {
      store.accounts[uid] = { uid, role: 'operator', status: 'active', permissions: ['moderate'], createdAt: store.state.clock }
      store.state.people.push({ id: uid, role: 'operator', nickname: uid, subtitle: '', avatar: '', interests: [], accountStatus: 'active' })
    }
    store.state.people.push({ id: 'child-1', role: 'child', nickname: 'child', subtitle: '', avatar: '', interests: [], accountStatus: 'active' }, { id: 'volunteer-1', role: 'volunteer', nickname: 'volunteer', subtitle: '', avatar: '', interests: [], accountStatus: 'active' })
    store.state.pairs = [{ id: 'pair-1', childId: 'child-1', volunteerId: 'volunteer-1', teacherId: 'teacher-1', channel: 'online', status: 'active', startedAt: store.state.clock }]
    store.state.letters = [{ id: 'letter-1', pairId: 'pair-1', authorId: 'volunteer-1', recipientId: 'child-1', createdBy: 'volunteer-1', deliveryRoute: 'school-paper', reviewAssigneeId: 'reviewer-1', title: '待审', body: '待审正文', attachmentId: 'attachment-1', moderation: 'pending', revision: 2, createdAt: store.state.clock, updatedAt: store.state.clock }]
    store.state.attachments = [{ id: 'attachment-1', pairId: 'pair-1', name: 'synthetic.webp', type: 'image/webp', ownerId: 'volunteer-1', storagePath: 'attachments/synthetic.webp' }]
    const repository: Repository = { read: operation => operation(store), transact: operation => operation(store) }
    await expect(executeLetterContentRead(repository, { uid: 'reviewer-1' }, 'letter-1')).resolves.toMatchObject({ body: '待审正文' })
    await expect(executeAttachmentContentRead(repository, { uid: 'reviewer-1' }, 'attachment-1')).resolves.toMatchObject({ id: 'attachment-1' })
    await expect(executeLetterContentRead(repository, { uid: 'reviewer-2' }, 'letter-1')).rejects.toMatchObject({ code: 'FORBIDDEN' } satisfies Partial<ServiceError>)
    await expect(executeAttachmentContentRead(repository, { uid: 'reviewer-2' }, 'attachment-1')).rejects.toMatchObject({ code: 'FORBIDDEN' } satisfies Partial<ServiceError>)

    const unavailable: Repository = { read: operation => operation(store), transact: operation => operation(store), appendAccessAudit: async () => { throw new ServiceError('AUDIT_UNAVAILABLE', '读取记录未能保存') } }
    await expect(executeLetterContentRead(unavailable, { uid: 'reviewer-1' }, 'letter-1')).rejects.toMatchObject({ code: 'AUDIT_UNAVAILABLE' } satisfies Partial<ServiceError>)
  })

  it('gives a manuscript recipient only the approved image rendition, never the private source', async () => {
    const store = emptyStore('2026-10-21T00:00:00.000Z')
    for (const [uid, role] of [['child-1', 'child'], ['volunteer-1', 'volunteer']] as const) {
      store.accounts[uid] = { uid, role, status: 'active', permissions: [], createdAt: store.state.clock }
      store.state.people.push({ id: uid, role, nickname: uid, subtitle: '', avatar: '', interests: [], accountStatus: 'active' })
    }
    store.state.pairs = [{ id: 'pair-1', childId: 'child-1', volunteerId: 'volunteer-1', teacherId: 'teacher-1', channel: 'online', status: 'active', startedAt: store.state.clock }]
    store.state.letters = [{ id: 'letter-1', pairId: 'pair-1', authorId: 'child-1', recipientId: 'volunteer-1', createdBy: 'teacher-1', deliveryRoute: 'online', title: '合成手写信', body: '忠实转写', attachmentId: 'private-original', manuscriptAssetId: 'manuscript-original', ocrRunId: 'ocr-1', approvedRenditionId: 'approved-rendition', moderation: 'approved', revision: 1, createdAt: store.state.clock, updatedAt: store.state.clock }]
    store.state.deliveries = [{ letterId: 'letter-1', deliveredAt: store.state.clock }]
    store.state.attachments = [
      { id: 'private-original', pairId: 'pair-1', name: 'private.webp', type: 'image/webp', ownerId: 'teacher-1', storagePath: 'attachments/private.webp' },
      { id: 'approved-rendition', pairId: 'pair-1', name: 'approved.webp', type: 'image/webp', ownerId: 'teacher-1', storagePath: 'attachments/approved.webp' },
    ]
    const repository: Repository = { read: operation => operation(store), transact: operation => operation(store) }
    const delivered = await executeLetterContentRead(repository, { uid: 'volunteer-1' }, 'letter-1')
    expect(delivered).toMatchObject({ attachmentId: 'approved-rendition', body: '忠实转写' })
    expect(delivered).not.toHaveProperty('manuscriptAssetId')
    expect(delivered).not.toHaveProperty('submissionVersions')
    expect(delivered).not.toHaveProperty('moderationNote')
    await expect(executeAttachmentContentRead(repository, { uid: 'volunteer-1' }, 'approved-rendition')).resolves.toMatchObject({ storagePath: 'attachments/approved.webp' })
    await expect(executeAttachmentContentRead(repository, { uid: 'volunteer-1' }, 'private-original')).rejects.toMatchObject({ code: 'FORBIDDEN' } satisfies Partial<ServiceError>)
  })

  it('never exposes returned submissions or review internals to the final recipient', async () => {
    const store = emptyStore('2026-10-21T00:00:00.000Z')
    for (const [uid, role] of [['child-1', 'child'], ['volunteer-1', 'volunteer']] as const) {
      store.accounts[uid] = { uid, role, status: 'active', permissions: [], createdAt: store.state.clock }
      store.state.people.push({ id: uid, role, nickname: uid, subtitle: '', avatar: '', interests: [], accountStatus: 'active' })
    }
    store.state.pairs = [{ id: 'pair-1', childId: 'child-1', volunteerId: 'volunteer-1', teacherId: 'teacher-1', channel: 'online', status: 'active', startedAt: store.state.clock }]
    store.state.letters = [{
      id: 'letter-1', pairId: 'pair-1', authorId: 'volunteer-1', recipientId: 'child-1', createdBy: 'volunteer-1', deliveryRoute: 'online',
      reviewAssigneeId: 'reviewer-1', title: '最终安全版本', body: '只保留适合送达的内容。', moderation: 'approved', moderationNote: '内部审核说明',
      revision: 2, coveredLetterIds: ['private-task-id'], createdAt: store.state.clock, updatedAt: store.state.clock,
      submissionVersions: [{ revision: 1, title: '退回版本', body: '请加我的微信 wx-sensitive', coveredLetterIds: [], submittedAt: store.state.clock, submittedBy: 'volunteer-1' }],
    }]
    store.state.deliveries = [{ letterId: 'letter-1', deliveredAt: store.state.clock }]
    const repository: Repository = { read: operation => operation(store), transact: operation => operation(store) }

    const delivered = await executeLetterContentRead(repository, { uid: 'child-1' }, 'letter-1')
    expect(delivered).toMatchObject({ title: '最终安全版本', body: '只保留适合送达的内容。', moderation: 'approved' })
    expect(JSON.stringify(delivered)).not.toContain('wx-sensitive')
    for (const field of ['submissionVersions', 'moderationNote', 'reviewAssigneeId', 'coveredLetterIds', 'childConfirmedAt', 'manuscriptAssetId']) expect(delivered).not.toHaveProperty(field)
  })

  it('keeps participant snapshot bodies empty and records the separate object read without mutating a read-only snapshot', async () => {
    const store = emptyStore('2026-10-21T00:00:00.000Z')
    for (const [uid, role] of [['child-1', 'child'], ['volunteer-1', 'volunteer']] as const) {
      store.accounts[uid] = { uid, role, status: 'active', permissions: [], createdAt: store.state.clock }
      store.state.people.push({ id: uid, role, nickname: uid, subtitle: '', avatar: '', interests: [], accountStatus: 'active' })
    }
    store.state.pairs = [{ id: 'pair-1', childId: 'child-1', volunteerId: 'volunteer-1', teacherId: 'teacher-1', channel: 'online', status: 'active', startedAt: store.state.clock }]
    store.state.letters = [{ id: 'letter-1', pairId: 'pair-1', authorId: 'volunteer-1', recipientId: 'child-1', createdBy: 'volunteer-1', deliveryRoute: 'online', title: '合成来信', body: '只能通过逐对象读取取得的正文', moderation: 'approved', revision: 1, createdAt: store.state.clock, updatedAt: store.state.clock }]
    store.state.deliveries = [{ letterId: 'letter-1', deliveredAt: store.state.clock }]
    const repository: Repository = { read: operation => operation(store), transact: operation => operation(store) }
    const before = structuredClone(store)

    const overview = await executeSnapshot(repository, { uid: 'child-1' }, store.state.clock)
    expect(overview.state.letters[0]).toMatchObject({ id: 'letter-1', title: '合成来信', body: '' })
    expect(store).toEqual(before)
    expect(store.accessAudit).toHaveLength(0)

    await expect(executeLetterContentRead(repository, { uid: 'child-1' }, 'letter-1')).resolves.toMatchObject({ body: '只能通过逐对象读取取得的正文' })
    expect(store.accessAudit).toEqual([expect.objectContaining({ actorId: 'child-1', targetId: 'letter-1', decision: 'allowed' })])
  })

  it('lets only safeguarding staff pause every active pair of a volunteer', async () => {
    const store = emptyStore('2026-10-21T00:00:00.000Z')
    const repository: Repository = { read: operation => operation(store), transact: operation => operation(store) }
    for (const [uid, role, permissions] of [
      ['safeguarding-operator', 'operator', ['help']],
      ['ordinary-operator', 'operator', ['followup']],
      ['volunteer-1', 'volunteer', []],
      ['child-1', 'child', []],
      ['child-2', 'child', []],
    ] as const) {
      store.accounts[uid] = { uid, role, status: 'active', permissions: [...permissions], createdAt: store.state.clock }
      store.state.people.push({ id: uid, role, nickname: uid, subtitle: '', avatar: '', interests: [], accountStatus: 'active' })
    }
    store.state.pairs = [
      { id: 'pair-1', childId: 'child-1', volunteerId: 'volunteer-1', teacherId: 'teacher-1', channel: 'online', status: 'active', startedAt: store.state.clock },
      { id: 'pair-2', childId: 'child-2', volunteerId: 'volunteer-1', teacherId: 'teacher-2', channel: 'paper', status: 'active', startedAt: store.state.clock },
    ]
    await expect(executeCommand(repository, { uid: 'ordinary-operator' }, { requestId: 'ordinary-pause-vol-1', command: { type: 'pause-volunteer', volunteerId: 'volunteer-1', reason: '可信风险测试' } })).rejects.toMatchObject({ code: 'FORBIDDEN' } satisfies Partial<ServiceError>)
    await executeCommand(repository, { uid: 'safeguarding-operator' }, { requestId: 'protect-pause-vol-1', command: { type: 'pause-volunteer', volunteerId: 'volunteer-1', reason: '可信风险测试' } })
    expect(store.state.pairs.map(pair => pair.status)).toEqual(['paused', 'paused'])
    expect(store.state.pairs.every(pair => pair.pauseReason?.includes('保护性暂停'))).toBe(true)
  })

  it('requires an active same-school coordinator assignment for teacher delegation', async () => {
    const store = emptyStore('2026-10-21T00:00:00.000Z')
    const repository: Repository = { read: operation => operation(store), transact: operation => operation(store) }
    for (const [uid, schoolId] of [['coordinator-1', 'school-1'], ['teacher-1', 'school-1'], ['teacher-2', 'school-2']] as const) {
      store.accounts[uid] = { uid, role: 'teacher', status: 'active', permissions: [], createdAt: store.state.clock }
      store.state.people.push({ id: uid, role: 'teacher', nickname: uid, subtitle: '', avatar: '', interests: [], accountStatus: 'active', schoolId })
    }
    store.accounts['child-1'] = { uid: 'child-1', role: 'child', status: 'active', permissions: [], createdAt: store.state.clock }
    store.state.people.push({ id: 'child-1', role: 'child', nickname: 'child', subtitle: '', avatar: '', interests: [], accountStatus: 'active', schoolId: 'school-1' })
    store.state.schools = [{ id: 'school-1', name: '合成学校一', status: 'active' }, { id: 'school-2', name: '合成学校二', status: 'active' }]
    store.state.teacherAssignments = [{ id: 'coord-1', schoolId: 'school-1', teacherId: 'coordinator-1', scope: ['school-coordinate'], startsAt: '2026-10-01T00:00:00.000Z', endsAt: '2026-12-01T00:00:00.000Z', approvedBy: 'operator-1' }]
    await expect(executeCommand(repository, { uid: 'coordinator-1' }, { requestId: 'cross-school-assign-1', command: { type: 'assign-teacher', schoolId: 'school-1', teacherId: 'teacher-2', childId: 'child-1', scope: ['status'], startsAt: store.state.clock } })).rejects.toMatchObject({ code: 'INVALID_ACTION' } satisfies Partial<ServiceError>)
    await expect(executeCommand(repository, { uid: 'coordinator-1' }, { requestId: 'self-assign-test-01', command: { type: 'assign-teacher', schoolId: 'school-1', teacherId: 'coordinator-1', childId: 'child-1', scope: ['status'], startsAt: store.state.clock } })).rejects.toMatchObject({ code: 'FORBIDDEN' } satisfies Partial<ServiceError>)
    await executeCommand(repository, { uid: 'coordinator-1' }, { requestId: 'same-school-assign1', command: { type: 'assign-teacher', schoolId: 'school-1', teacherId: 'teacher-1', childId: 'child-1', scope: ['status', 'paper-delivery'], startsAt: store.state.clock, endsAt: '2026-12-01T00:00:00.000Z' } })
    expect(store.state.teacherAssignments.some(item => item.teacherId === 'teacher-1' && item.childId === 'child-1')).toBe(true)
  })

  it('rejects a letter read from the wrong pair and records the denial reason', async () => {
    const store = emptyStore('2026-10-21T00:00:00.000Z')
    const repository: Repository = { read: operation => operation(store), transact: operation => operation(store) }
    for (const [uid, role] of [['child-1', 'child'], ['child-2', 'child'], ['volunteer-1', 'volunteer']] as const) {
      store.accounts[uid] = { uid, role, status: 'active', permissions: [], createdAt: store.state.clock }
      store.state.people.push({ id: uid, role, nickname: uid, subtitle: '', avatar: '', interests: [], accountStatus: 'active' })
    }
    store.state.pairs = [{ id: 'pair-1', childId: 'child-1', volunteerId: 'volunteer-1', teacherId: 'teacher-1', channel: 'online', status: 'active', startedAt: store.state.clock }]
    store.state.letters = [{ id: 'letter-1', pairId: 'pair-1', authorId: 'volunteer-1', recipientId: 'child-1', createdBy: 'volunteer-1', deliveryRoute: 'online', title: '合成来信', body: '仅用于权限测试', moderation: 'approved', revision: 1, createdAt: store.state.clock, updatedAt: store.state.clock }]
    store.state.deliveries = [{ letterId: 'letter-1', deliveredAt: store.state.clock }]
    await expect(executeLetterContentRead(repository, { uid: 'child-2' }, 'letter-1')).rejects.toMatchObject({ code: 'FORBIDDEN' } satisfies Partial<ServiceError>)
    const audit = store.accessAudit.filter(item => item.targetType === 'letter' && item.targetId === 'letter-1').at(-1)!
    expect(audit).toMatchObject({ decision: 'denied', reasonCode: 'NO_ASSIGNMENT' })
  })

  it('rejects a teacher whose assignment was revoked', async () => {
    const store = emptyStore('2026-10-21T00:00:00.000Z')
    const repository: Repository = { read: operation => operation(store), transact: operation => operation(store) }
    for (const [uid, role] of [['teacher-1', 'teacher'], ['child-1', 'child'], ['volunteer-1', 'volunteer']] as const) {
      store.accounts[uid] = { uid, role, status: 'active', permissions: [], createdAt: store.state.clock }
      store.state.people.push({ id: uid, role, nickname: uid, subtitle: '', avatar: '', interests: [], accountStatus: 'active', schoolId: uid === 'teacher-1' || uid === 'child-1' ? 'school-1' : undefined })
    }
    store.state.schools = [{ id: 'school-1', name: '合成学校', status: 'active' }]
    store.state.teacherAssignments = [{ id: 'assignment-1', schoolId: 'school-1', teacherId: 'teacher-1', childId: 'child-1', scope: ['status', 'capture', 'paper-delivery'], startsAt: '2026-10-01T00:00:00.000Z', revokedAt: '2026-10-20T00:00:00.000Z', approvedBy: 'school-owner' }]
    store.state.pairs = [{ id: 'pair-1', childId: 'child-1', volunteerId: 'volunteer-1', teacherId: 'teacher-1', schoolId: 'school-1', channel: 'paper', status: 'active', startedAt: store.state.clock }]
    store.state.letters = [{ id: 'letter-1', pairId: 'pair-1', authorId: 'volunteer-1', recipientId: 'child-1', createdBy: 'volunteer-1', deliveryRoute: 'school-paper', title: '合成来信', body: '仅用于权限测试', moderation: 'approved', revision: 1, createdAt: store.state.clock, updatedAt: store.state.clock }]
    store.state.deliveries = [{ letterId: 'letter-1' }]
    await expect(executeLetterContentRead(repository, { uid: 'teacher-1' }, 'letter-1')).rejects.toMatchObject({ code: 'FORBIDDEN' } satisfies Partial<ServiceError>)
  })

  it('records emergency break-glass reads as high severity and refuses a second outstanding one', async () => {
    const store = emptyStore('2026-10-21T00:00:00.000Z')
    const repository: Repository = { read: operation => operation(store), transact: operation => operation(store) }
    store.accounts['safe-operator'] = { uid: 'safe-operator', role: 'operator', status: 'active', permissions: ['help'], createdAt: store.state.clock }
    for (const [uid, role] of [['safe-operator', 'operator'], ['child-1', 'child'], ['volunteer-1', 'volunteer']] as const) {
      store.accounts[uid] ??= { uid, role, status: 'active', permissions: [], createdAt: store.state.clock }
      store.state.people.push({ id: uid, role, nickname: uid, subtitle: '', avatar: '', interests: [], accountStatus: 'active' })
    }
    store.state.pairs = [{ id: 'pair-1', childId: 'child-1', volunteerId: 'volunteer-1', teacherId: 'teacher-1', channel: 'online', status: 'active', startedAt: store.state.clock }]
    store.state.letters = [
      { id: 'letter-1', pairId: 'pair-1', authorId: 'volunteer-1', recipientId: 'child-1', createdBy: 'volunteer-1', deliveryRoute: 'online', title: '合成来信', body: '紧急核实用正文', moderation: 'approved', revision: 1, createdAt: store.state.clock, updatedAt: store.state.clock },
      { id: 'letter-2', pairId: 'pair-1', authorId: 'volunteer-1', recipientId: 'child-1', createdBy: 'volunteer-1', deliveryRoute: 'online', title: '合成来信二', body: '第二封', moderation: 'approved', revision: 1, createdAt: store.state.clock, updatedAt: store.state.clock },
    ]
    store.state.deliveries = [{ letterId: 'letter-1', deliveredAt: store.state.clock }, { letterId: 'letter-2', deliveredAt: store.state.clock }]
    await executeCommand(repository, { uid: 'safe-operator' }, { requestId: 'break-glass-letter-1', command: { type: 'open-emergency-access', targetType: 'letter', targetId: 'letter-1', reason: '合成演练：来信出现紧急风险线索，需要立即核实。' } })
    const grant = store.state.accessGrants!.at(-1)!
    expect(grant).toMatchObject({ targetType: 'letter', targetId: 'letter-1', emergency: true })
    expect(Date.parse(grant.expiresAt) - Date.parse(store.state.clock)).toBeLessThanOrEqual(2 * 3_600_000)
    await expect(executeLetterContentRead(repository, { uid: 'safe-operator' }, 'letter-1')).resolves.toMatchObject({ body: '紧急核实用正文' })
    expect(store.accessAudit.filter(item => item.targetId === 'letter-1').at(-1)).toMatchObject({ decision: 'allowed', severity: 'high', grantId: grant.id })
    await expect(executeCommand(repository, { uid: 'safe-operator' }, { requestId: 'break-glass-letter-2', command: { type: 'open-emergency-access', targetType: 'letter', targetId: 'letter-2', reason: '合成演练：准备再开一次破窗核对另一封信。' } })).rejects.toThrow('未复核的紧急破窗')
  })
})
