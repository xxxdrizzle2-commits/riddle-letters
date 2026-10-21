import { authorizeAttachment } from '../../../server/core'
import { attachmentForDeletion, assertDeleteMarker } from '../../../server/media-policy'
import { ServiceError } from '../../../server/core'
import { errorResponse, identityFor, jsonResponse, repositoryFor, requireSameOrigin } from '../_shared'
import { assertVariant, readLimitedStream, requireMedia, transformImage } from './_shared'
import type { PagesFunction, V3Env } from '../../types'

export const onRequestGet: PagesFunction<V3Env> = async context => {
  try {
    const identity = await identityFor(context)
    const { bucket, transformer } = requireMedia(context.env)
    const id = context.params.id || ''
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ServiceError('NOT_FOUND', '图片不存在')
    const variant = assertVariant(new URL(context.request.url).searchParams.get('variant'))
    const repository = repositoryFor(context.env)
    const attachment = await repository.read(store => authorizeAttachment(store, identity, id))
    if (!attachment.storagePath || !attachment.storagePath.startsWith('attachments/')) throw new ServiceError('NOT_FOUND', '图片不存在')
    const object = await bucket.get(attachment.storagePath)
    if (!object || object.size > 3 * 1024 * 1024) throw new ServiceError('NOT_FOUND', '图片不存在或已清理')
    const bytes = await readLimitedStream(object.body, 3 * 1024 * 1024, object.size)
    const result = await transformImage(transformer, '/resize', bytes, 'image/webp', variant)
    if (!result.ok || result.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase() !== 'image/webp') throw new ServiceError('STORAGE_FAILED', '图片处理暂时失败，请稍后重试')
    return new Response(result.body, { status: 200, headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline; filename="letter.webp"' } })
  } catch (error) { return errorResponse(error) }
}

export const onRequestDelete: PagesFunction<V3Env> = async context => {
  let marker = ''
  let storagePath: string | undefined
  const id = context.params.id || ''
  try {
    requireSameOrigin(context.request)
    const identity = await identityFor(context)
    const { bucket } = requireMedia(context.env)
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ServiceError('NOT_FOUND', '图片不存在')
    const repository = repositoryFor(context.env)
    const now = new Date().toISOString()
    marker = `${now}:${crypto.randomUUID()}`
    const reservation = await repository.transact(store => {
      store.state.clock = now
      const attachment = attachmentForDeletion(store, identity, id)
      if (!attachment) return null
      attachment.deletingAt ??= marker
      marker = attachment.deletingAt
      return { storagePath: attachment.storagePath }
    })
    if (!reservation) return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
    storagePath = reservation.storagePath
    if (storagePath?.startsWith('attachments/')) {
      try { await bucket.delete(storagePath) }
      catch {
        await repository.transact(store => {
          const attachment = store.state.attachments.find(item => item.id === id)
          if (attachment?.deletingAt === marker) { delete attachment.deletingAt; store.state.clock = new Date().toISOString() }
        }).catch(() => undefined)
        throw new ServiceError('STORAGE_FAILED', '图片清理没有完成，请稍后重试')
      }
    }
    await repository.transact(store => {
      const attachment = assertDeleteMarker(store, id, marker)
      store.state.attachments = store.state.attachments.filter(item => item.id !== attachment.id)
      store.state.clock = new Date().toISOString()
    })
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return errorResponse(error) }
}
