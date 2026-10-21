import { executeCommand } from '../../server/core'
import type { Command } from '../../src/types'
import { errorResponse, identityFor, jsonResponse, repositoryFor, requireSameOrigin } from './_shared'
import type { PagesFunction, V3Env } from '../types'

export const onRequestPost: PagesFunction<V3Env> = async context => {
  try {
    requireSameOrigin(context.request)
    const identity = await identityFor(context)
    const declaredLength = Number(context.request.headers.get('Content-Length') || 0)
    if (declaredLength > 32_000) return jsonResponse({ error: { code: 'INVALID_INPUT', message: '提交内容过长，请缩短后重试。' } }, 413)
    const raw = await context.request.text()
    if (raw.length > 32_000) return jsonResponse({ error: { code: 'INVALID_INPUT', message: '提交内容过长，请缩短后重试。' } }, 413)
    const input = JSON.parse(raw) as { requestId?: unknown; expectedRevision?: unknown; command?: unknown }
    if (!input || typeof input !== 'object' || typeof input.requestId !== 'string' || !input.command || typeof input.command !== 'object' || Array.isArray(input.command)) {
      return jsonResponse({ error: { code: 'INVALID_INPUT', message: '请求内容不完整，请保留草稿后重试。' } }, 400)
    }
    if (input.expectedRevision !== undefined && (!Number.isSafeInteger(input.expectedRevision) || Number(input.expectedRevision) < 0)) {
      return jsonResponse({ error: { code: 'INVALID_INPUT', message: '内容版本无效，请刷新后重试。' } }, 400)
    }
    return jsonResponse(await executeCommand(repositoryFor(context.env), identity, {
      command: input.command as Command,
      requestId: input.requestId,
      expectedRevision: input.expectedRevision as number | undefined,
    }))
  } catch (error) {
    if (error instanceof SyntaxError) return jsonResponse({ error: { code: 'INVALID_INPUT', message: '请求格式不完整，请保留草稿后重试。' } }, 400)
    return errorResponse(error)
  }
}
