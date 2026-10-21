import { executeSnapshot } from '../../server/core'
import { errorResponse, identityFor, jsonResponse, repositoryFor } from './_shared'
import type { PagesFunction, V3Env } from '../types'

export const onRequestGet: PagesFunction<V3Env> = async context => {
  try {
    const identity = await identityFor(context)
    return jsonResponse(await executeSnapshot(repositoryFor(context.env), identity))
  } catch (error) { return errorResponse(error) }
}
