const MAX_IMAGE_BYTES = 3 * 1024 * 1024
const MAX_PIXELS = 20_000_000

type SupportedFormat = 'png' | 'jpeg' | 'webp'
type ImageInfo = { format?: string; width?: number; height?: number; fileSize?: number }
type TransformOptions = { width?: number; height?: number; rotate?: number }
type ImageResult = { response(options?: { headers?: HeadersInit }): Response }
type ImagePipeline = {
  transform(options: TransformOptions): ImagePipeline
  output(options: { format: 'image/webp'; quality: number }): Promise<ImageResult>
}
export interface ImagesBindingLike {
  info(source: ReadableStream<Uint8Array>): Promise<ImageInfo>
  input(source: ReadableStream<Uint8Array>): ImagePipeline
}
export interface MediaWorkerEnv { IMAGES: ImagesBindingLike }

const variants = {
  thumbnail: { width: 480, height: 480 },
  letter: { width: 1400, height: 1400 },
  print: { width: 2000, height: 2000 },
} as const
export type ImageVariant = keyof typeof variants

function jsonError(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
}

async function readLimited(request: Request): Promise<Uint8Array> {
  const declaredLength = Number(request.headers.get('Content-Length') || 0)
  if (declaredLength > MAX_IMAGE_BYTES) throw new RangeError('IMAGE_TOO_LARGE')
  const reader = request.body?.getReader()
  if (!reader) throw new TypeError('IMAGE_EMPTY')
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel().catch(() => undefined)
      throw new RangeError('IMAGE_TOO_LARGE')
    }
    chunks.push(value)
  }
  if (!total) throw new TypeError('IMAGE_EMPTY')
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return bytes
}

function stream(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new Response(copy.buffer as ArrayBuffer).body!
}

export function detectFormat(bytes: Uint8Array): SupportedFormat | undefined {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg'
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'webp'
  return undefined
}

function normalizeImageFormat(format: unknown): SupportedFormat | undefined {
  if (typeof format !== 'string') return undefined
  const normalized = format.toLowerCase().replace(/^image\//, '')
  return normalized === 'jpg' ? 'jpeg' : normalized === 'png' || normalized === 'jpeg' || normalized === 'webp' ? normalized : undefined
}

function dimensionsAreValid(info: ImageInfo) {
  const width = Number(info.width), height = Number(info.height)
  return Number.isSafeInteger(width) && Number.isSafeInteger(height) && width > 0 && height > 0 && width * height <= MAX_PIXELS
}

async function sanitizedUpload(request: Request, env: MediaWorkerEnv) {
  const declared = request.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase()
  if (declared !== 'image/png' && declared !== 'image/jpeg') return jsonError('INVALID_IMAGE', '只接受 PNG 或 JPEG 图片', 400)
  const bytes = await readLimited(request)
  const expected: SupportedFormat = declared === 'image/png' ? 'png' : 'jpeg'
  if (detectFormat(bytes) !== expected) return jsonError('INVALID_IMAGE', '图片内容与文件类型不一致', 400)

  let info: ImageInfo
  try { info = await env.IMAGES.info(stream(bytes)) }
  catch { return jsonError('INVALID_IMAGE', '图片内容无法识别', 400) }
  if (normalizeImageFormat(info.format) !== expected || !dimensionsAreValid(info)) return jsonError('INVALID_IMAGE', '图片格式或尺寸不符合要求', 400)

  try {
    const result = await env.IMAGES.input(stream(bytes))
      .transform({ width: 2000, height: 2000 })
      .output({ format: 'image/webp', quality: 82 })
    return result.response({ headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
  } catch {
    return jsonError('IMAGE_TRANSFORM_FAILED', '图片处理失败，请稍后重试', 422)
  }
}

async function resizedImage(request: Request, env: MediaWorkerEnv, url: URL) {
  const variant = url.searchParams.get('variant') as ImageVariant | null
  if (!variant || !(variant in variants)) return jsonError('INVALID_VARIANT', '图片尺寸选项无效', 400)
  if (request.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase() !== 'image/webp') return jsonError('INVALID_IMAGE', '存储图片格式无效', 400)
  const bytes = await readLimited(request)
  if (detectFormat(bytes) !== 'webp') return jsonError('INVALID_IMAGE', '存储图片内容无法识别', 400)
  let info: ImageInfo
  try { info = await env.IMAGES.info(stream(bytes)) }
  catch { return jsonError('INVALID_IMAGE', '存储图片内容无法识别', 400) }
  if (normalizeImageFormat(info.format) !== 'webp' || !dimensionsAreValid(info)) return jsonError('INVALID_IMAGE', '存储图片尺寸无效', 400)

  try {
    const size = variants[variant]
    const result = await env.IMAGES.input(stream(bytes))
      .transform(size)
      .output({ format: 'image/webp', quality: 82 })
    return result.response({ headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
  } catch {
    return jsonError('IMAGE_TRANSFORM_FAILED', '图片处理失败，请稍后重试', 422)
  }
}

export async function handleMediaRequest(request: Request, env: MediaWorkerEnv): Promise<Response> {
  const url = new URL(request.url)
  if (request.method !== 'POST') return jsonError('METHOD_NOT_ALLOWED', '请求方式不支持', 405)
  if (url.pathname === '/sanitize') {
    try { return await sanitizedUpload(request, env) }
    catch (error) {
      if (error instanceof RangeError && error.message === 'IMAGE_TOO_LARGE') return jsonError('IMAGE_TOO_LARGE', '图片不能超过 3 MiB', 413)
      if (error instanceof TypeError && error.message === 'IMAGE_EMPTY') return jsonError('INVALID_IMAGE', '请选择一张图片', 400)
      return jsonError('IMAGE_TRANSFORM_FAILED', '图片处理失败，请稍后重试', 422)
    }
  }
  if (url.pathname === '/resize') {
    try { return await resizedImage(request, env, url) }
    catch (error) {
      if (error instanceof RangeError && error.message === 'IMAGE_TOO_LARGE') return jsonError('IMAGE_TOO_LARGE', '图片不能超过 3 MiB', 413)
      if (error instanceof TypeError && error.message === 'IMAGE_EMPTY') return jsonError('INVALID_IMAGE', '图片内容为空', 400)
      return jsonError('IMAGE_TRANSFORM_FAILED', '图片处理失败，请稍后重试', 422)
    }
  }
  return jsonError('NOT_FOUND', '图片处理接口不存在', 404)
}

export default { fetch: handleMediaRequest }
