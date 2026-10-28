import { describe, expect, it } from 'vitest'
import { emptyStore, executeCommand, executeSnapshot, ServiceError, type Repository } from './core'

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

  it('separates protection cases from ordinary followup access and recuses the reported handler', async () => {
    const { store, repository, identity } = repositoryForRole('child')
    for (const [uid, permissions] of [
      ['reported-operator', ['help', 'followup']],
      ['independent-handler', ['help']],
      ['overdue-handler', ['followup']],
    ] as const) {
      store.accounts[uid] = { uid, role: 'operator', status: 'active', permissions: [...permissions], createdAt: store.state.clock }
      store.state.people.push({ id: uid, role: 'operator', nickname: uid, subtitle: '', avatar: '', interests: [], accountStatus: 'active' })
    }
    const submitted = await executeCommand(repository, identity, {
      requestId: 'child-protection-case-01',
      command: { type: 'help', body: '需要独立保护人员处理。', reportedParty: 'operator', reportedPersonId: 'reported-operator' },
    })
    const id = submitted.resultId
    const accusedView = await executeSnapshot(repository, { uid: 'reported-operator' })
    const overdueView = await executeSnapshot(repository, { uid: 'overdue-handler' })
    const handlerView = await executeSnapshot(repository, { uid: 'independent-handler' })
    expect(accusedView.state.followups.some(item => item.id === id)).toBe(false)
    expect(overdueView.state.followups.some(item => item.id === id)).toBe(false)
    expect(handlerView.state.followups.find(item => item.id === id)?.reportedPersonId).toBe('reported-operator')

    await expect(executeCommand(repository, { uid: 'reported-operator' }, {
      requestId: 'reported-close-attempt', command: { type: 'resolve-followup', id, note: '试图关闭案件。' },
    })).rejects.toMatchObject({ code: 'FORBIDDEN' } satisfies Partial<ServiceError>)
    await expect(executeCommand(repository, { uid: 'independent-handler' }, {
      requestId: 'handler-assign-attempt', command: { type: 'assign-followup', id, ownerId: 'reported-operator' },
    })).rejects.toMatchObject({ code: 'INVALID_ACTION' } satisfies Partial<ServiceError>)
    expect(store.state.followups.find(item => item.id === id)?.status).toBe('open')
  })
})
