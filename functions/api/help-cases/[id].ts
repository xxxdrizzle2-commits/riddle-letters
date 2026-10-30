import { executeHelpCaseContentRead, ServiceError } from '../../../server/core'
import { errorResponse, identityFor, jsonResponse, repositoryFor } from '../_shared'
import type { PagesFunction, V3Env } from '../../types'

export const onRequestGet: PagesFunction<V3Env> = async context => {
  try {
    const identity = await identityFor(context)
    const id = String(context.params.id || '')
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(id)) throw new ServiceError('NOT_FOUND', '保护事项不存在')
    const item = await executeHelpCaseContentRead(repositoryFor(context.env), identity, id)
    return jsonResponse({ case: item })
  } catch (error) { return errorResponse(error) }
}
