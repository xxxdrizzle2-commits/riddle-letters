import type { D1DatabaseLike } from '../server/d1-repository'

export interface V3Env {
  DB?: D1DatabaseLike
  V3_MODE?: string
  BETTER_AUTH_SECRET?: string
  BETTER_AUTH_URL?: string
  V3_ACCESS_TEAM_DOMAIN?: string
  V3_ACCESS_AUD?: string
}

export interface PagesContext<E = V3Env> {
  request: Request
  env: E
  params: Record<string, string>
  data: Record<string, unknown>
  next(): Promise<Response>
}
export type PagesFunction<E = V3Env> = (context: PagesContext<E>) => Response | Promise<Response>
