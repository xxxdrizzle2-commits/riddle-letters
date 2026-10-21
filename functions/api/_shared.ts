import { createBetterAuth } from '../../server/better-auth'
import { createD1Repository } from '../../server/d1-repository'
import { ServiceError, type Identity } from '../../server/core'
import type { PagesContext, V3Env } from '../types'

export function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
}
export function requirePreview(env: V3Env) {
  if (env.V3_MODE !== 'preview' || !env.DB || !env.BETTER_AUTH_SECRET) throw new ServiceError('V3_PREVIEW_DISABLED', 'V3 成人试测接口尚未在受保护的 Preview 启用')
}
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get('Origin')
  const site = request.headers.get('Sec-Fetch-Site')
  if (!origin || new URL(origin).origin !== new URL(request.url).origin || site === 'cross-site') throw new ServiceError('CSRF_REJECTED', '请求来源无法确认，请刷新页面后重试')
}
export async function identityFor(context: PagesContext<V3Env>): Promise<Identity> {
  const { request, env } = context
  requirePreview(env)
  const auth = createBetterAuth(env, request)
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user?.id) throw new ServiceError('UNAUTHENTICATED', '请先登录成人试测账号')
  const accountRows = await env.DB!.prepare('SELECT role, status FROM app_accounts WHERE user_id = ?').bind(session.user.id).all()
  const account = accountRows.results[0]
  if (!account) throw new ServiceError('ACCOUNT_REQUIRED', '此账号尚未加入 V3 成人试测，请联系试测负责人')
  if (account.status !== 'active') throw new ServiceError('ACCOUNT_DISABLED', '试测账号当前不可用，请联系试测负责人')
  return { uid: session.user.id, email: session.user.email || undefined }
}
export function repositoryFor(env: V3Env) {
  requirePreview(env)
  return createD1Repository(env.DB!)
}
export function errorResponse(error: unknown) {
  const known = error instanceof ServiceError ? error : undefined
  const status = known?.code === 'UNAUTHENTICATED' ? 401
    : known?.code === 'FORBIDDEN' || known?.code === 'ACCOUNT_REQUIRED' || known?.code === 'ACCOUNT_DISABLED' ? 403
    : known?.code === 'CONFLICT' ? 409
    : known?.code === 'INVALID_INPUT' ? 400
    : known?.code === 'RATE_LIMITED' ? 429
    : known?.code === 'V3_PREVIEW_DISABLED' || known?.code === 'SCHEMA_NOT_READY' ? 503
    : 500
  const message = known?.message || '请求暂时没有完成，请保留内容后重试'
  return jsonResponse({ error: { code: known?.code || 'INTERNAL_ERROR', message } }, status)
}
