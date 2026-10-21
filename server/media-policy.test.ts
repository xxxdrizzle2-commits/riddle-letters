import { describe, expect, it } from 'vitest'
import { emptyStore, ServiceError, type Identity } from './core'
import { assertAttachmentQuota, attachmentForDeletion, authorizeAttachmentUpload, MAX_ACCOUNT_ATTACHMENT_BYTES, MAX_ACCOUNT_ATTACHMENTS } from './media-policy'

function baseStore() {
  const store = emptyStore('2026-10-21T00:00:00.000Z')
  const roles = [['child-1', 'child'], ['volunteer-1', 'volunteer'], ['teacher-1', 'teacher'], ['operator-1', 'operator']] as const
  for (const [id, role] of roles) {
    store.accounts[id] = { uid: id, role, status: 'active', permissions: [], createdAt: store.state.clock }
    store.state.people.push({ id, role, nickname: id, subtitle: '', avatar: '', interests: [] })
  }
  store.state.pairs.push({ id: 'paper-pair', childId: 'child-1', volunteerId: 'volunteer-1', teacherId: 'teacher-1', channel: 'paper', status: 'active', startedAt: store.state.clock })
  store.state.pairs.push({ id: 'online-pair', childId: 'child-2', volunteerId: 'volunteer-2', teacherId: 'teacher-2', channel: 'online', status: 'active', startedAt: store.state.clock })
  return store
}

const identity = (uid: string): Identity => ({ uid })
const expectCode = (run: () => unknown, code: string) => {
  try { run(); throw new Error('Expected ServiceError') }
  catch (error) { expect(error).toBeInstanceOf(ServiceError); expect((error as ServiceError).code).toBe(code) }
}

describe('attachment role and quota policy', () => {
  it('allows only paired participants and the assigned teacher for a paper pair', () => {
    const store = baseStore()
    expect(() => authorizeAttachmentUpload(store, identity('child-1'), 'paper-pair')).not.toThrow()
    expect(() => authorizeAttachmentUpload(store, identity('volunteer-1'), 'paper-pair')).not.toThrow()
    expect(() => authorizeAttachmentUpload(store, identity('teacher-1'), 'paper-pair')).not.toThrow()
    expectCode(() => authorizeAttachmentUpload(store, identity('teacher-1'), 'online-pair'), 'FORBIDDEN')
    expectCode(() => authorizeAttachmentUpload(store, identity('operator-1'), 'paper-pair'), 'FORBIDDEN')
    expectCode(() => authorizeAttachmentUpload(store, identity('volunteer-1'), 'online-pair'), 'FORBIDDEN')
  })

  it('allows an unpaired child to save an introduction image, but not other roles', () => {
    const store = baseStore()
    store.accounts['child-3'] = { uid: 'child-3', role: 'child', status: 'active', permissions: [], createdAt: store.state.clock }
    store.state.people.push({ id: 'child-3', role: 'child', nickname: 'child-3', subtitle: '', avatar: '', interests: [] })
    expect(() => authorizeAttachmentUpload(store, identity('child-3'), '')).not.toThrow()
    expectCode(() => authorizeAttachmentUpload(store, identity('volunteer-1'), ''), 'FORBIDDEN')
  })

  it('enforces account attachment count and byte quotas', () => {
    const store = baseStore()
    store.state.attachments = Array.from({ length: MAX_ACCOUNT_ATTACHMENTS }, (_, index) => ({ id: String(index), name: '', type: 'image/webp', ownerId: 'child-1', size: 1 }))
    expectCode(() => assertAttachmentQuota(store, 'child-1'), 'UPLOAD_QUOTA')
    store.state.attachments = [{ id: 'big', name: '', type: 'image/webp', ownerId: 'child-1', size: MAX_ACCOUNT_ATTACHMENT_BYTES }]
    expectCode(() => assertAttachmentQuota(store, 'child-1', 1), 'UPLOAD_QUOTA')
  })

  it('allows only the owner to delete an unreferenced attachment', () => {
    const store = baseStore()
    store.state.attachments.push({ id: 'asset', name: 'letter.webp', type: 'image/webp', ownerId: 'child-1', storagePath: 'attachments/asset.webp', size: 100 })
    expect(attachmentForDeletion(store, identity('child-1'), 'asset')?.storagePath).toBe('attachments/asset.webp')
    expectCode(() => attachmentForDeletion(store, identity('volunteer-1'), 'asset'), 'FORBIDDEN')
    store.state.letters.push({ id: 'letter', pairId: 'paper-pair', authorId: 'child-1', createdBy: 'child-1', title: '你好', body: '', attachmentId: 'asset', moderation: 'draft', createdAt: store.state.clock, updatedAt: store.state.clock })
    expectCode(() => attachmentForDeletion(store, identity('child-1'), 'asset'), 'ATTACHMENT_IN_USE')
  })
})
