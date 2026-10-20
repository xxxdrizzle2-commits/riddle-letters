import type { AppState, Command, Person } from '../types'

/**
 * V2 deliberately runs as a local, synthetic-data demo. Keep the interface used
 * by the account screens, but do not initialize a cloud SDK or imply that a
 * production account service is available. V3 will replace this adapter with
 * the selected Cloudflare implementation.
 */
export const cloudConfigured = false

type Snapshot = { state: AppState; profile: Person; revision: number; account: { status: string; permissions?: string[]; application?: unknown } }

function unavailable(): never {
  throw new Error('正式账号服务尚未接入。V2 仅提供当前浏览器中的合成数据演示。')
}

export async function getCloudSession(): Promise<boolean> { return false }
export async function signIn(_credentials: { username: string; password: string }): Promise<void> { unavailable() }
export async function signOut(): Promise<void> { /* No remote session exists in V2. */ }
export async function cloudSnapshot(): Promise<Snapshot> { return unavailable() }
export async function cloudDispatch(_command: Command, _options: { requestId: string; expectedRevision?: number }): Promise<Snapshot & { resultId: string }> { return unavailable() }
export async function cloudAccountAction(_action: string, _payload: Record<string, unknown>): Promise<unknown> { return unavailable() }
export async function registerVolunteer(_input: { email: string; password: string; nickname: string; institution: string; availability: string }): Promise<void> { unavailable() }
export async function verifyVolunteerEmail(_input: { email: string; token: string }): Promise<void> { unavailable() }
export async function recoverPassword(_email: string): Promise<void> { unavailable() }
export async function completePasswordRecovery(_input: { email: string; token: string; password: string }): Promise<void> { unavailable() }
export async function changePassword(_input: { oldPassword: string; newPassword: string }): Promise<void> { unavailable() }
export async function activateInvite(_input: { token: string; username: string; password: string; nickname?: string }): Promise<{ username: string }> { return unavailable() }
export async function downloadAttachment(_id: string): Promise<Blob> { return unavailable() }
