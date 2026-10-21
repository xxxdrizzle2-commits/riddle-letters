import { jsonResponse } from './_shared'
import type { PagesFunction, V3Env } from '../types'

export const onRequestGet: PagesFunction<V3Env> = async ({ env }) => {
  if (env.V3_MODE !== 'preview' || !env.DB || !env.BETTER_AUTH_SECRET) return jsonResponse({ mode: 'v2-demo', apiReady: false }, 503)
  try {
    const meta = await env.DB.prepare("SELECT revision FROM app_meta WHERE id = 'main'").all()
    const authTables = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('user','session','account','verification')").all()
    const authReady = new Set(authTables.results.map(row => row.name)).size === 4
    const ready = meta.results.length === 1 && authReady
    return jsonResponse({ mode: 'adult-preview', apiReady: ready }, ready ? 200 : 503)
  } catch {
    return jsonResponse({ mode: 'adult-preview', apiReady: false }, 503)
  }
}
