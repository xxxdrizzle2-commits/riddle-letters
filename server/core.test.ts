import { describe, expect, it } from 'vitest'
import { emptyStore, executeCommand, ServiceError, type Repository } from './core'

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
})
