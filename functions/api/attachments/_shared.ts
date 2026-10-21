import { ServiceError } from '../../../server/core'
import type { V3Env } from '../../types'

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024
const SAFE_VARIANTS = new Set(['thumbnail', 'letter', 'print'])

export function requireMedia(env: V3Env) {
  if (!env.MEDIA_BUCKET || !env.IMAGE_TRANSFORMER) throw new ServiceError('MEDIA_NOT_CONFIGURED', '图片服务尚未接入，请稍后再试')
  return { bucket: env.MEDIA_BUCKET, transformer: env.IMAGE_TRANSFORMER }
}

export function assertVariant(value: string | null) {
  const variant = value || 'letter'
  if (!SAFE_VARIANTS.has(variant)) throw new ServiceError('INVALID_INPUT', '图片尺寸选项无效')
  return variant
}

export function attachmentName(raw: string | null) {
  let decoded = ''
  try { decoded = raw ? decodeURIComponent(raw) : '' } catch { throw new ServiceError('INVALID_INPUT', '图片名称格式不正确') }
  const basename = decoded.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f\u007f]/g, '').trim() || '手写图片'
  return basename.slice(0, 90)
}

export async function readLimitedStream(stream: ReadableStream<Uint8Array> | null, maxBytes = MAX_IMAGE_BYTES, declaredLength = 0) {
  if (declaredLength > maxBytes) throw new ServiceError('IMAGE_TOO_LARGE', '图片不能超过 3 MiB')
  if (!stream) throw new ServiceError('INVALID_IMAGE', '请选择一张图片')
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined)
      throw new ServiceError('IMAGE_TOO_LARGE', '图片不能超过 3 MiB')
    }
    chunks.push(value)
  }
  if (!size) throw new ServiceError('INVALID_IMAGE', '请选择一张图片')
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return bytes
}

export async function transformImage(transformer: { fetch(request: Request): Promise<Response> }, path: string, body: ArrayBufferView, contentType: string, variant?: string) {
  const url = new URL(path, 'https://image-transformer.internal')
  if (variant) url.searchParams.set('variant', variant)
  try {
    const copy = new Uint8Array(body.byteLength)
    copy.set(new Uint8Array(body.buffer, body.byteOffset, body.byteLength))
    return await transformer.fetch(new Request(url, { method: 'POST', headers: { 'Content-Type': contentType }, body: copy.buffer as ArrayBuffer }))
  } catch {
    throw new ServiceError('STORAGE_FAILED', '图片处理服务暂时不可用，请保留内容后重试')
  }
}

export async function transformedBytes(response: Response) {
  if (!response.ok || response.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase() !== 'image/webp') {
    const code = response.status === 413 ? 'IMAGE_TOO_LARGE' : 'INVALID_IMAGE'
    throw new ServiceError(code, response.status === 413 ? '图片不能超过 3 MiB' : '图片处理失败，请确认文件是有效的 PNG 或 JPG')
  }
  const bytes = await readLimitedStream(response.body)
  return bytes
}
