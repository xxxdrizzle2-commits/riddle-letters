import type { AppState, Command, Person } from '../types'

/** Set only on the protected V3 Preview build; production remains the local V2 demo. */
export const cloudConfigured = import.meta.env.VITE_V3_PREVIEW === 'true'

type Snapshot = { state: AppState; profile: Person; revision: number; account: { status: string; permissions?: string[]; application?: unknown } }
type ApiError = { error?: { message?: string; code?: string } }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: 'include', cache: 'no-store', ...init, headers: { ...(init?.headers || {}), ...(init?.body ? { 'Content-Type': 'application/json' } : {}) } })
  const payload = await response.json().catch(() => ({})) as T & ApiError
  if (!response.ok) throw new Error(payload.error?.message || `请求未完成（${response.status}）`)
  return payload
}

function unavailable(): never {
  throw new Error('账号和云端数据仅在受保护的 V3 试测登录 Preview 中启用。当前公开版继续使用本地合成数据。')
}

export async function getCloudSession(): Promise<boolean> {
  if (!cloudConfigured) return false
  try { await request('/api/me'); return true } catch { return false }
}
export async function signIn(credentials: { username: string; password: string }): Promise<void> {
  if (!cloudConfigured) unavailable()
  await request('/api/auth/sign-in/email', { method: 'POST', body: JSON.stringify({ email: credentials.username, password: credentials.password, rememberMe: false }) })
}
export async function signOut(): Promise<void> {
  if (!cloudConfigured) return
  await request('/api/auth/sign-out', { method: 'POST', body: '{}' }).catch(() => undefined)
}
export async function cloudSnapshot(): Promise<Snapshot> {
  if (!cloudConfigured) return unavailable()
  return request<Snapshot>('/api/snapshot')
}
export async function cloudDispatch(command: Command, options: { requestId: string; expectedRevision?: number }): Promise<Snapshot & { resultId: string }> {
  if (!cloudConfigured) return unavailable()
  return request('/api/commands', { method: 'POST', body: JSON.stringify({ command, ...options }) })
}
export async function cloudAccountAction(_action: string, _payload: Record<string, unknown>): Promise<unknown> {
  return unavailable()
}
export async function registerVolunteer(_input: { email: string; password: string; nickname: string; institution: string; availability: string }): Promise<void> { return unavailable() }
export async function verifyVolunteerEmail(_input: { email: string; token: string }): Promise<void> { return unavailable() }
export async function recoverPassword(_email: string): Promise<void> { return unavailable() }
export async function completePasswordRecovery(_input: { email: string; token: string; password: string }): Promise<void> { return unavailable() }
export async function changePassword(_input: { oldPassword: string; newPassword: string }): Promise<void> {
  if (!cloudConfigured) unavailable()
  await request('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: _input.oldPassword, newPassword: _input.newPassword, revokeOtherSessions: true }) })
}
export async function activateInvite(_input: { token: string; username: string; password: string; nickname?: string }): Promise<{ username: string }> { return unavailable() }
export async function downloadAttachment(_id: string): Promise<Blob> {
  throw new Error('V3 试测登录暂不提供云端图片附件；图片仍只在本地 Demo 使用。')
}
