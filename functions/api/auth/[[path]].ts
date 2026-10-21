import { createBetterAuth } from '../../../server/better-auth'
import { errorResponse, requirePreview } from '../_shared'
import type { PagesFunction, V3Env } from '../../types'

export const onRequest: PagesFunction<V3Env> = async ({ request, env }) => {
  try {
    requirePreview(env)
    const auth = createBetterAuth(env, request)
    return auth.handler(request)
  } catch (error) { return errorResponse(error) }
}
