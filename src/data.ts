import Dexie, { type Table } from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSyncExternalStore } from 'react'
import type { AppState, Command } from './types'
import { createSeedState, normalizeState, reduceCommand, validateAttachment } from './domain'
import { executeRemote, getRuntime, subscribeRuntime } from './runtime'
import { removeCloudAttachment, uploadCloudAttachment } from './services/cloud'
export { canReadLetter, createSeedState, formatDate, groupedResponseTasks, hasPermission, isOverdue, normalizeState, recipientForLetter, reduceCommand, riddles, scopeState, validateAttachment, visibleLetters } from './domain'

const db = new Dexie('riddle-letter-demo-v1') as Dexie & { snapshots: Table<AppState, string> }
db.version(1).stores({ snapshots: 'id' })

export async function initialize(): Promise<void> {
  await db.transaction('rw', db.snapshots, async () => {
    const existing = await db.snapshots.get('main')
    await db.snapshots.put(existing ? normalizeState(existing) : normalizeState(createSeedState()))
  })
}
export async function resetDemo(): Promise<void> {
  if (getRuntime().mode === 'cloud') throw new Error('正式数据不能通过演示重置清空。')
  await db.transaction('rw', db.snapshots, async () => { await db.snapshots.put(normalizeState(createSeedState())) })
}
export function useAppData(): AppState | undefined {
  const runtime = useSyncExternalStore(subscribeRuntime, getRuntime, getRuntime)
  const local = useLiveQuery(() => runtime.mode === 'demo' ? db.snapshots.get('main') : undefined, [runtime.mode])
  return runtime.mode === 'cloud' ? runtime.state : local
}

/** Decode and re-encode the image, dropping EXIF/location metadata and malformed images. */
export async function sanitizeAttachment(file: File): Promise<File> {
  await validateAttachment(file)
  const bitmap = await createImageBitmap(file)
  try {
    if (bitmap.width * bitmap.height > 25_000_000 || bitmap.width < 1 || bitmap.height < 1) throw new Error('图片尺寸过大，请缩小后再上传。')
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width; canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('图片处理失败，请重试。')
    context.drawImage(bitmap, 0, 0)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('图片处理失败。')), file.type, .9))
    if (blob.size > 3 * 1024 * 1024) throw new Error('处理后的图片超过 3 MiB，请缩小后重试。')
    return new File([blob], file.name.replace(/[^\p{L}\p{N}._-]/gu, '_'), { type: file.type })
  } finally { bitmap.close() }
}

export async function dispatch(actorId: string, original: Command): Promise<string> {
  let command = original
  if (command.type === 'save-letter' && command.file) command = { ...command, file: await sanitizeAttachment(command.file) }
  if (getRuntime().mode === 'cloud') {
    if (command.type !== 'save-letter') return executeRemote(command)
    let cloudCommand: Extract<Command, { type: 'save-letter' }> = command
    const oldAttachmentId = getRuntime().state?.letters.find(letter => letter.id === cloudCommand.id)?.attachmentId
    let uploadedId: string | undefined
    if (cloudCommand.file) {
      const uploaded = await uploadCloudAttachment(cloudCommand.pairId, cloudCommand.file)
      uploadedId = uploaded.id
      cloudCommand = { ...cloudCommand, file: undefined, attachmentId: uploaded.id, removeAttachment: false }
    }
    try {
      const result = await executeRemote(cloudCommand)
      if (oldAttachmentId && oldAttachmentId !== uploadedId && (uploadedId || cloudCommand.removeAttachment)) {
        await removeCloudAttachment(oldAttachmentId).catch(() => undefined)
      }
      return result
    } catch (error) {
      if (uploadedId) await removeCloudAttachment(uploadedId).catch(() => undefined)
      throw error
    }
  }
  return db.transaction('rw', db.snapshots, async () => {
    const previous = await db.snapshots.get('main')
    if (!previous) throw new Error('演示数据还没有准备好，请稍后重试。')
    const next = reduceCommand(previous, actorId, command)
    await db.snapshots.put(next)
    if (command.type === 'save-letter') return command.id ?? next.letters.find(l => !previous.letters.some(old => old.id === l.id))?.id ?? next.letters.find(l => l.pairId === command.pairId && l.replyTo === command.replyTo && l.createdBy === actorId && l.title === command.title.trim() && l.body === command.body && l.riddleId === command.riddleId && (l.moderation === 'draft' || l.moderation === 'returned'))?.id ?? ''
    if (command.type === 'match') return next.pairs.find(p => p.status !== 'ended' && p.childId === command.childId && p.volunteerId === command.volunteerId)?.id ?? ''
    return ''
  })
}
