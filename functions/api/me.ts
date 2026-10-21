import { executeSnapshot } from '../../server/core'
import { errorResponse, identityFor, jsonResponse, repositoryFor } from './_shared'
import type { PagesFunction, V3Env } from '../types'

export const onRequestGet: PagesFunction<V3Env> = async context => {
  try {
    const identity = await identityFor(context)
    const snapshot = await executeSnapshot(repositoryFor(context.env), identity)
    return jsonResponse({ id: identity.uid, role: snapshot.profile.role, nickname: snapshot.profile.nickname, account: snapshot.account })
  } catch (error) { return errorResponse(error) }
}
