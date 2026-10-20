import type { AppState, Command, Person } from './types'
import { cloudDispatch, cloudSnapshot, signOut } from './services/cloud'

export interface RuntimeState {
  mode: 'demo' | 'cloud'
  state?: AppState
  profile?: Person
  revision?: number
  account?: { status: string; permissions?: string[]; application?: unknown }
}
let runtime: RuntimeState = { mode: 'cloud' }
const listeners = new Set<() => void>()
let generation = 0
let queue: Promise<unknown> = Promise.resolve()
export const getRuntime = () => runtime
export function subscribeRuntime(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
export function setRuntime(next: RuntimeState) { runtime = next; listeners.forEach(listener => listener()) }
export function useDemoRuntime() {
  generation++
  sessionStorage.setItem('riddle-v1-mode', 'demo')
  setRuntime({ mode: 'demo' })
}
export function clearRuntime() {
  generation++
  sessionStorage.removeItem('riddle-v1-mode')
  setRuntime({ mode: 'cloud' })
}
export async function refreshCloud() {
  const ticket = generation
  const snapshot = await cloudSnapshot()
  if (ticket === generation) setRuntime({ mode: 'cloud', ...snapshot })
  return snapshot
}
export async function executeRemote(command: Command): Promise<string> {
  const ticket = generation
  const requestId = crypto.randomUUID()
  const job = queue.catch(() => undefined).then(async () => {
    if (runtime.mode !== 'cloud' || !runtime.profile || ticket !== generation) throw new Error('请重新登录后再保存。')
    const result = await cloudDispatch(command, { requestId, expectedRevision: runtime.revision })
    if (ticket !== generation) throw new Error('账号已切换，请回到当前账号查看保存结果。')
    setRuntime({ ...runtime, ...result, mode: 'cloud' })
    return result.resultId
  })
  queue = job
  return job
}
export async function logout() {
  if (runtime.mode === 'cloud') await signOut()
  clearRuntime()
}
