import cloudbase from '@cloudbase/js-sdk'
import type { AppState, Command, Person } from '../types'

const envId = import.meta.env.VITE_CLOUDBASE_ENV_ID?.trim() || ''
export const cloudConfigured = Boolean(envId)
const app = cloudConfigured ? cloudbase.init({ env: envId }) : undefined
// Shared school devices must lose the SDK login when the browser session closes.
const auth = app?.auth({ persistence: 'session' })

type Snapshot = { state: AppState; profile: Person; revision: number; account: { status: string; permissions?: string[]; application?: unknown } }
type FunctionResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string }
type PendingSignup = { email: string; nickname: string; institution: string; availability: string; verify: (params: { token: string }) => Promise<{ data: unknown; error: Error | null }>; verified?: boolean }
let pendingSignup: PendingSignup | undefined
let pendingRecovery: { email: string; update: (attributes: { nonce: string; password: string }) => Promise<{ data: unknown; error: Error | null }> } | undefined

function requireCloud() {
  if (!app || !auth) throw new Error('真实账号服务尚未连接。请先使用独立 Demo。')
  return { app, auth }
}
function unwrap<T>(value: { data: T; error: Error | null }, fallback: string): T {
  if (value.error) throw new Error(value.error.message || fallback)
  return value.data
}
async function call<T>(name: 'riddle-v1' | 'riddle-v1-activate', data: Record<string, unknown>): Promise<T> {
  const { app } = requireCloud()
  const response = await app.callFunction({ name, data, parse: true })
  const raw = typeof response.result === 'string' ? JSON.parse(response.result) : response.result
  const result = raw as FunctionResult<T> | undefined
  if (!result) throw new Error('服务暂时没有返回结果，请保留输入后重试。')
  if (!result.ok) throw new Error(result.message || '暂时无法完成操作，请重试。')
  return result.data
}
export async function getCloudSession(): Promise<boolean> {
  if (!auth) return false
  try {
    const session = await auth.getSession()
    return !session.error && !!session.data.session?.access_token
  } catch { return false }
}
export async function signIn({ username, password }: { username: string; password: string }) {
  const { auth } = requireCloud()
  const login = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username.trim()) ? { email: username.trim(), password } : { username: username.trim(), password }
  unwrap(await auth.signInWithPassword(login), '登录没有完成，请核对账号和密码。')
}
export async function signOut() {
  if (!auth) return
  await auth.signOut()
  pendingSignup = undefined; pendingRecovery = undefined
}
export async function cloudSnapshot(): Promise<Snapshot> {
  return call<Snapshot>('riddle-v1', { action: 'snapshot' })
}
export async function cloudDispatch(command: Command, options: { requestId: string; expectedRevision?: number }): Promise<Snapshot & { resultId: string }> {
  let safeCommand: Command = command
  if (command.type === 'save-letter' && command.file) {
    const file = command.file
    if (file.size > 3 * 1024 * 1024 || !['image/png', 'image/jpeg'].includes(file.type)) throw new Error('请选择不超过 3 MiB 的 PNG 或 JPEG 图片。')
    const bytes = new Uint8Array(await file.arrayBuffer())
    let binary = ''
    for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
    const uploaded = await call<{ id: string }>('riddle-v1', { action: 'upload', pairId: command.pairId, name: file.name, type: file.type, base64: btoa(binary) })
    const { file: _file, ...rest } = command
    safeCommand = { ...rest, attachmentId: uploaded.id }
  }
  return call<Snapshot & { resultId: string }>('riddle-v1', { action: 'command', command: safeCommand, ...options })
}
export async function cloudAccountAction(action: string, payload: Record<string, unknown>): Promise<unknown> {
  return call('riddle-v1', { action: 'account', operation: action, payload })
}
export async function registerVolunteer({ email, password, nickname, institution, availability }: { email: string; password: string; nickname: string; institution: string; availability: string }) {
  const { auth } = requireCloud()
  const response = await auth.signUp({ email: email.trim(), password })
  if (response.error) throw new Error(response.error.message || '暂时无法发送邮箱验证码。')
  const result = response.data
  if (!result.verifyOtp) throw new Error('邮箱验证尚未准备好，请重新尝试。')
  pendingSignup = { email: email.trim(), nickname, institution, availability, verify: result.verifyOtp }
}
export async function verifyVolunteerEmail({ email, token }: { email: string; token: string }) {
  if (!pendingSignup || pendingSignup.email !== email.trim()) throw new Error('验证流程已结束，请重新提交申请。')
  if (!pendingSignup.verified) {
    unwrap(await pendingSignup.verify({ token: token.trim() }), '验证码不正确或已过期。')
    pendingSignup.verified = true
  }
  await cloudAccountAction('apply-volunteer', { nickname: pendingSignup.nickname, institution: pendingSignup.institution, availability: pendingSignup.availability, agreementAccepted: true })
  pendingSignup = undefined
}
export async function recoverPassword(email: string) {
  const { auth } = requireCloud()
  const result = unwrap(await auth.resetPasswordForEmail(email.trim()), '暂时无法发送找回验证码。')
  if (!result.updateUser) throw new Error('找回流程尚未准备好，请重新尝试。')
  pendingRecovery = { email: email.trim(), update: result.updateUser }
}
export async function completePasswordRecovery({ email, token, password }: { email: string; token: string; password: string }) {
  if (!pendingRecovery || pendingRecovery.email !== email.trim()) throw new Error('找回流程已结束，请重新发送验证码。')
  unwrap(await pendingRecovery.update({ nonce: token.trim(), password }), '验证码不正确或已过期。')
  pendingRecovery = undefined
  await signOut()
}
export async function changePassword({ oldPassword, newPassword }: { oldPassword: string; newPassword: string }) {
  const { auth } = requireCloud()
  unwrap(await auth.resetPasswordForOld({ old_password: oldPassword, new_password: newPassword }), '密码暂时没有更新。')
}
export async function activateInvite({ token, username, password }: { token: string; username: string; password: string; nickname?: string }) {
  const key = `riddle-activation-${token.slice(0, 16)}`
  const activationId = sessionStorage.getItem(key) || crypto.randomUUID()
  sessionStorage.setItem(key, activationId)
  const result = await call<{ username: string }>('riddle-v1-activate', { action: 'activate-invite', token, username, password, activationId })
  sessionStorage.removeItem(key)
  return result
}
export async function downloadAttachment(id: string): Promise<Blob> {
  const result = await call<{ data: string; type: string }>('riddle-v1', { action: 'download', id })
  const binary = atob(result.data), bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: result.type })
}
