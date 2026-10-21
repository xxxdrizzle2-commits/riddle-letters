import { getAccount, requireValue, ServiceError, type Identity, type Store } from './core'
import type { Attachment } from '../src/types'

export const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024
export const MAX_ACCOUNT_ATTACHMENTS = 40
export const MAX_ACCOUNT_ATTACHMENT_BYTES = 80 * 1024 * 1024

export function authorizeAttachmentUpload(store: Store, identity: Identity, pairId: string) {
  const account = getAccount(store, identity, true)
  requireValue(store.state.people.some(person => person.id === identity.uid), '账号资料尚未完成', 'PROFILE_MISSING')

  if (!pairId) {
    requireValue(account.role === 'child' && !store.state.pairs.some(pair => pair.status !== 'ended' && pair.childId === identity.uid), '此处只能保存尚未结对的小朋友自我介绍图片', 'FORBIDDEN')
    return
  }

  const pair = store.state.pairs.find(item => item.id === pairId && item.status !== 'ended')
  requireValue(pair && (
    (account.role === 'child' && pair.childId === identity.uid) ||
    (account.role === 'volunteer' && pair.volunteerId === identity.uid) ||
    (account.role === 'teacher' && pair.teacherId === identity.uid && pair.channel === 'paper')
  ), '不能为这组伙伴上传图片', 'FORBIDDEN')
}

export function assertAttachmentQuota(store: Store, ownerId: string, incomingBytes = 0) {
  const owned = store.state.attachments.filter(item => item.ownerId === ownerId && !item.deletingAt)
  const usedBytes = owned.reduce((sum, item) => sum + (item.size ?? MAX_ATTACHMENT_BYTES), 0)
  requireValue(owned.length < MAX_ACCOUNT_ATTACHMENTS && usedBytes + incomingBytes <= MAX_ACCOUNT_ATTACHMENT_BYTES, '手写图片已达到试用容量上限，请联系运营协助整理', 'UPLOAD_QUOTA')
}

export function attachmentForDeletion(store: Store, identity: Identity, id: string): Attachment | undefined {
  getAccount(store, identity, true)
  const attachment = store.state.attachments.find(item => item.id === id)
  if (!attachment) return undefined
  requireValue(attachment.ownerId === identity.uid, '只有上传图片的账号可以清理它', 'FORBIDDEN')
  const referenced = store.state.letters.some(letter => letter.attachmentId === id || letter.submissionVersions?.some(version => version.attachmentId === id))
  requireValue(!referenced, '图片仍保存在书信或历史版本中，不能删除', 'ATTACHMENT_IN_USE')
  return attachment
}

export function assertDeleteMarker(store: Store, id: string, marker: string) {
  const attachment = store.state.attachments.find(item => item.id === id)
  requireValue(attachment?.deletingAt === marker, '图片清理状态已变化，请刷新后重试', 'CONFLICT')
  const referenced = store.state.letters.some(letter => letter.attachmentId === id || letter.submissionVersions?.some(version => version.attachmentId === id))
  requireValue(!referenced, '图片已用于书信，不能清理', 'ATTACHMENT_IN_USE')
  return attachment
}

export function missingMedia(message = '图片存储服务尚未配置') {
  return new ServiceError('MEDIA_NOT_CONFIGURED', message)
}
