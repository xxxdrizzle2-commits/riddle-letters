import { betterAuth } from 'better-auth'
import type { V3Env } from '../functions/types'

export function createBetterAuth(env: V3Env, request: Request) {
  if (!env.DB || !env.BETTER_AUTH_SECRET || env.V3_MODE !== 'preview') throw new Error('V3 preview authentication is not configured')
  const requestOrigin = new URL(request.url).origin
  const baseURL = env.BETTER_AUTH_URL || requestOrigin
  const trustedOrigins = [...new Set([requestOrigin, env.BETTER_AUTH_URL].filter((value): value is string => !!value))]
  return betterAuth({
    database: env.DB as never,
    baseURL,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins,
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      requireEmailVerification: false,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    advanced: {
      useSecureCookies: baseURL.startsWith('https://'),
      cookiePrefix: 'riddle-v3',
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 12,
      cookieCache: { enabled: false },
    },
  })
}
