import type { D1DatabaseLike } from '../server/d1-repository'

export interface V3Env {
  DB?: D1DatabaseLike
  MEDIA_BUCKET?: R2BucketLike
  IMAGE_TRANSFORMER?: ServiceFetcherLike
  V3_MODE?: string
  BETTER_AUTH_SECRET?: string
  BETTER_AUTH_URL?: string
}

export interface PagesContext<E = V3Env> {
  request: Request
  env: E
  params: Record<string, string>
  data: Record<string, unknown>
  next(): Promise<Response>
}

export interface R2BucketLike {
  get(key: string): Promise<{ body: ReadableStream<Uint8Array>; size: number } | null>
  put(key: string, value: ArrayBuffer | ArrayBufferView | ReadableStream<Uint8Array>, options?: {
    httpMetadata?: { contentType?: string; cacheControl?: string }
  }): Promise<unknown>
  delete(key: string): Promise<void>
}

export interface ServiceFetcherLike {
  fetch(request: Request): Promise<Response>
}

export type PagesFunction<E = V3Env> = (context: PagesContext<E>) => Response | Promise<Response>
