import { randomUUID } from 'node:crypto'
import { authorizeAttachmentUpload, assertAttachmentQuota, MAX_ATTACHMENT_BYTES } from '../../../server/media-policy'
import { throttle, ServiceError } from '../../../server/core'
import { errorResponse, identityFor, jsonResponse, repositoryFor, requireSameOrigin } from '../_shared'
import { attachmentName, MAX_IMAGE_BYTES, readLimitedStream, requireMedia, transformedBytes, transformImage } from './_shared'
import type { PagesFunction, V3Env } from '../../types'

const inputTypes = new Set(['image/png', 'image/jpeg'])

export const onRequestPost: PagesFunction<V3Env> = async context => {
  let storedKey = ''
  try {
    requireSameOrigin(context.request)
    const identity = await identityFor(context)
    const { bucket, transformer } = requireMedia(context.env)
    const pairId = context.request.headers.get('X-Pair-Id')?.trim() || ''
    if (pairId.length > 100) throw new ServiceError('INVALID_INPUT', '伙伴信息无效，请刷新页面后重试')
    const inputType = context.request.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase() || ''
    if (!inputTypes.has(inputType)) throw new ServiceError('INVALID_IMAGE', '请选择 PNG 或 JPG 图片')
    const name = attachmentName(context.request.headers.get('X-File-Name'))
    const declaredLength = Number(context.request.headers.get('Content-Length') || 0)
    const bytes = await readLimitedStream(context.request.body, MAX_IMAGE_BYTES, declaredLength)
    const repository = repositoryFor(context.env)
    const now = new Date().toISOString()

    await repository.transact(store => {
      store.state.clock = now
      authorizeAttachmentUpload(store, identity, pairId)
      assertAttachmentQuota(store, identity.uid)
      throttle(store, `upload:${identity.uid}`, now, 3)
    })

    const transformed = await transformImage(transformer, '/sanitize', bytes, inputType)
    const clean = await transformedBytes(transformed)
    if (clean.byteLength > MAX_ATTACHMENT_BYTES) throw new ServiceError('IMAGE_TOO_LARGE', '处理后的图片仍超过 3 MiB，请先压缩')

    const id = randomUUID()
    storedKey = `attachments/${id}.webp`
    await bucket.put(storedKey, clean, { httpMetadata: { contentType: 'image/webp', cacheControl: 'private, no-store' } })
    try {
      await repository.transact(store => {
        store.state.clock = now
        authorizeAttachmentUpload(store, identity, pairId)
        assertAttachmentQuota(store, identity.uid, clean.byteLength)
        store.state.attachments.push({ id, pairId, ownerId: identity.uid, name, type: 'image/webp', storagePath: storedKey, size: clean.byteLength, uploadedAt: now })
      })
    } catch (error) {
      await bucket.delete(storedKey).catch(() => undefined)
      storedKey = ''
      throw error
    }
    return jsonResponse({ id, name, type: 'image/webp' }, 201)
  } catch (error) {
    if (storedKey && context.env.MEDIA_BUCKET) await context.env.MEDIA_BUCKET.delete(storedKey).catch(() => undefined)
    return errorResponse(error)
  }
}
