import { describe, expect, it } from 'vitest'
import { detectFormat, handleMediaRequest, type ImagesBindingLike } from './index'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3])
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])

function imageStream(bytes: Uint8Array) { return new Response(bytes).body! }
function fakeImages(options: { format?: string; width?: number; height?: number } = {}) {
  const transforms: Record<string, unknown>[] = []
  const outputs: Record<string, unknown>[] = []
  const images: ImagesBindingLike = {
    async info(source) {
      const bytes = new Uint8Array(await new Response(source).arrayBuffer())
      return { format: options.format ?? detectFormat(bytes), width: options.width ?? 320, height: options.height ?? 240 }
    },
    input() {
      return {
        transform(value) { transforms.push(value); return this },
        async output(value) {
          outputs.push(value)
          return { response(config = {}) { return new Response(webp, { headers: { 'Content-Type': 'image/webp', ...Object.fromEntries(new Headers(config.headers)) } }) } }
        },
      }
    },
  }
  return { images, transforms, outputs }
}

describe('Cloudflare Images media worker', () => {
  it('normalizes accepted uploads to a metadata-free WebP derivative', async () => {
    const fake = fakeImages()
    const response = await handleMediaRequest(new Request('https://media.internal/sanitize', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: png }), { IMAGES: fake.images })
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/webp')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(fake.transforms).toEqual([{ width: 2000, height: 2000 }])
    expect(fake.outputs).toEqual([{ format: 'image/webp', quality: 82 }])
  })

  it('accepts the MIME-style format strings returned by the local Images binding', async () => {
    const fake = fakeImages({ format: 'image/png' })
    const response = await handleMediaRequest(new Request('https://media.internal/sanitize', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: png }), { IMAGES: fake.images })
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/webp')
  })

  it('rejects MIME spoofing and unsupported image formats before transformation', async () => {
    const fake = fakeImages()
    const mismatched = await handleMediaRequest(new Request('https://media.internal/sanitize', { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: png }), { IMAGES: fake.images })
    const unsupported = await handleMediaRequest(new Request('https://media.internal/sanitize', { method: 'POST', headers: { 'Content-Type': 'image/gif' }, body: jpeg }), { IMAGES: fake.images })
    expect(mismatched.status).toBe(400)
    expect(unsupported.status).toBe(400)
    expect(fake.outputs).toHaveLength(0)
  })

  it('rejects oversized and decompression-bomb dimensions', async () => {
    const tooLarge = fakeImages()
    const large = new Uint8Array(3 * 1024 * 1024 + 1)
    const sizeResponse = await handleMediaRequest(new Request('https://media.internal/sanitize', { method: 'POST', headers: { 'Content-Type': 'image/png', 'Content-Length': String(large.length) }, body: large }), { IMAGES: tooLarge.images })
    expect(sizeResponse.status).toBe(413)

    const bomb = fakeImages({ width: 6000, height: 6000 })
    const dimensionResponse = await handleMediaRequest(new Request('https://media.internal/sanitize', { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: jpeg }), { IMAGES: bomb.images })
    expect(dimensionResponse.status).toBe(400)
    expect(bomb.outputs).toHaveLength(0)
  })

  it('only applies allowlisted, bounded variants to clean WebP objects', async () => {
    const fake = fakeImages({ format: 'webp' })
    const response = await handleMediaRequest(new Request('https://media.internal/resize?variant=print', { method: 'POST', headers: { 'Content-Type': 'image/webp' }, body: webp }), { IMAGES: fake.images })
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(fake.transforms).toEqual([{ width: 2000, height: 2000 }])

    const invalid = await handleMediaRequest(new Request('https://media.internal/resize?variant=99999', { method: 'POST', headers: { 'Content-Type': 'image/webp' }, body: webp }), { IMAGES: fake.images })
    expect(invalid.status).toBe(400)
  })
})
