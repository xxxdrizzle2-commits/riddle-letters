import type { PagesFunction, V3Env } from './types'

const SIGN_IN_PATH = '/api/auth/sign-in/email'
const ACCOUNT_ATTEMPTS_PER_MINUTE = 5
const ADDRESS_ATTEMPTS_PER_MINUTE = 20

function rejection(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status, headers: { 'Cache-Control': 'no-store' } })
}

async function recordAttempt(env: V3Env, key: string, minute: number) {
  const db = env.DB!
  const existing = await db.prepare('SELECT minute, count FROM app_rate_limits WHERE rate_key = ?').bind(key).all()
  const row = existing.results[0]
  const count = row && Number(row.minute) === minute ? Number(row.count) + 1 : 1
  await db.batch([
    db.prepare('INSERT INTO app_rate_limits (rate_key, minute, count) VALUES (?, ?, ?) ON CONFLICT(rate_key) DO UPDATE SET minute = excluded.minute, count = excluded.count')
      .bind(key, minute, count),
  ])
  return count
}

export const onRequest: PagesFunction<V3Env> = async ({ request, env, next }) => {
  if (env.V3_MODE !== 'preview') return next()
  const url = new URL(request.url)
  // 静态外壳和登录端点对所有人开放；数据接口由各自的 identityFor 校验会话与角色。
  if (url.pathname !== SIGN_IN_PATH || request.method !== 'POST') return next()
  if (!env.DB) return rejection('SCHEMA_NOT_READY', '试测数据库还没有完成初始化', 503)

  const address = (request.headers.get('CF-Connecting-IP') || 'unknown').trim().slice(0, 64)
  const body = await request.clone().json().catch(() => null) as { email?: unknown } | null
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase().slice(0, 200) : ''
  const minute = Math.floor(Date.now() / 60000)

  const accountAttempts = await recordAttempt(env, `login:acct:${address}:${email}`, minute)
  const addressAttempts = await recordAttempt(env, `login:ip:${address}`, minute)
  if (accountAttempts > ACCOUNT_ATTEMPTS_PER_MINUTE || addressAttempts > ADDRESS_ATTEMPTS_PER_MINUTE) {
    return rejection('RATE_LIMITED', '登录尝试过于频繁，请稍后再试', 429)
  }
  return next()
}
