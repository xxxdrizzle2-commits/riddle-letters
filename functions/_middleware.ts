import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { PagesFunction, V3Env } from './types'

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

function isLocalRequest(request: Request) {
  const hostname = new URL(request.url).hostname
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

export const onRequest: PagesFunction<V3Env> = async ({ request, env, next }) => {
  if (env.V3_MODE !== 'preview' || isLocalRequest(request)) return next()

  const domain = env.V3_ACCESS_TEAM_DOMAIN?.trim()
  const audience = env.V3_ACCESS_AUD?.trim()
  if (!domain || !audience || !/^[a-z0-9.-]+$/i.test(domain) || domain.includes('..')) {
    return Response.json({ error: { code: 'PREVIEW_ACCESS_NOT_CONFIGURED', message: '成人试测 Preview 尚未设置访问保护。' } }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }

  const assertion = request.headers.get('Cf-Access-Jwt-Assertion')
  if (!assertion) return Response.json({ error: { code: 'PREVIEW_ACCESS_REQUIRED', message: '此成人试测页面仅限受邀测试者访问。' } }, { status: 403, headers: { 'Cache-Control': 'no-store' } })
  try {
    const issuer = `https://${domain}`
    let jwks = keySets.get(issuer)
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`))
      keySets.set(issuer, jwks)
    }
    await jwtVerify(assertion, jwks, { issuer, audience })
    return next()
  } catch {
    return Response.json({ error: { code: 'PREVIEW_ACCESS_INVALID', message: '试测访问凭据已失效，请重新验证访问权限。' } }, { status: 403, headers: { 'Cache-Control': 'no-store' } })
  }
}
