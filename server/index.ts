import { randomBytes, randomUUID } from 'node:crypto'
import sharp from 'sharp'
import Manager from '@cloudbase/manager-node'
import { accountStatus, authorizeAttachment, executeAccountAction, executeCommand, executeSnapshot, finishInvite, getAccount, reserveInvite, ServiceError, text, throttle, type Identity, type Repository, type Store } from './core'
import { createCloudApp, createRepository } from './repository'
import type { Attachment, Command, Person } from '../src/types'

type Request = { action?: string; command?: Command; requestId?: string; expectedRevision?: number; operation?: string; payload?: Record<string, unknown>; token?: string; username?: string; password?: string; activationId?: string; pairId?: string; name?: string; type?: string; base64?: string; id?: string }
const MAX_IMAGE = 3 * 1024 * 1024
const MAX_ACCOUNT_IMAGES = 40
const MAX_ACCOUNT_BYTES = 80 * 1024 * 1024
const ORPHAN_AGE_MS = 24 * 3600000
const asPayload = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const validPassword = (password: unknown): password is string => typeof password === 'string' && password.length >= 8 && password.length <= 32 && [/[a-z]/, /[A-Z]/, /\d/, /[^\w]/].filter(pattern => pattern.test(password)).length >= 3
function requirePilotReady() {
  if (process.env.V1_PILOT_READY !== 'true') throw new ServiceError('PILOT_NOT_READY', '正式试用尚未开放，请先使用独立演示版')
}

function manager() {
  const envId = process.env.CLOUDBASE_ENV_ID || process.env.SCB_ENV
  const secretId = process.env.TENCENTCLOUD_SECRETID
  const secretKey = process.env.TENCENTCLOUD_SECRETKEY
  if (!envId || !secretId || !secretKey) throw new ServiceError('SERVICE_NOT_CONFIGURED', '账号管理服务尚未配置')
  return Manager.init({ envId, secretId, secretKey })
}
async function identityFor(app: ReturnType<typeof createCloudApp>): Promise<Identity> {
  const basic = app.auth().getUserInfo()
  if (!basic.uid) throw new ServiceError('UNAUTHENTICATED', '请先登录')
  const response = await app.auth().getEndUserInfo(basic.uid)
  const info = response?.userInfo ?? {}
  return { uid: basic.uid, email: info.email || info.Email || undefined, anonymous: info.isAnonymous === true || info.IsAnonymous === true }
}
function uploader(store: Store, identity: Identity, pairId: string): Person {
  const account = getAccount(store, identity, true)
  const person = store.state.people.find(item => item.id === identity.uid)
  if (!person) throw new ServiceError('PROFILE_MISSING', '账号资料尚未完成')
  if (!pairId) {
    if (account.role !== 'child' || store.state.pairs.some(pair => pair.status !== 'ended' && pair.childId === identity.uid)) throw new ServiceError('FORBIDDEN', '此处只能保存尚未结对的自我介绍图片')
    return person
  }
  const pair = store.state.pairs.find(item => item.id === pairId && item.status !== 'ended')
  if (!pair || !(
    (account.role === 'child' && pair.childId === identity.uid) ||
    (account.role === 'volunteer' && pair.volunteerId === identity.uid) ||
    (account.role === 'teacher' && pair.teacherId === identity.uid && pair.channel === 'paper')
  )) throw new ServiceError('FORBIDDEN', '不能为这组伙伴上传图片')
  return person
}
async function upload(repository: Repository, app: ReturnType<typeof createCloudApp>, identity: Identity, request: Request) {
  const pairId = typeof request.pairId === 'string' ? request.pairId : ''
  await repository.transact(store => {
    uploader(store, identity, pairId)
    throttle(store, `upload:${identity.uid}`, new Date().toISOString(), 3)
  })
  const name = text(request.name, '图片名称', 90)
  if (request.type !== 'image/png' && request.type !== 'image/jpeg') throw new ServiceError('INVALID_IMAGE', '请选择 PNG 或 JPEG 图片')
  const encoded = text(request.base64, '图片数据', 4_500_000)
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new ServiceError('INVALID_IMAGE', '图片内容无法识别')
  const input = Buffer.from(encoded, 'base64')
  if (!input.length || input.length > MAX_IMAGE) throw new ServiceError('INVALID_IMAGE', '图片不能超过 3 MiB')
  const image = sharp(input, { limitInputPixels: 20_000_000 })
  const metadata = await image.metadata().catch(() => { throw new ServiceError('INVALID_IMAGE', '图片内容无法识别') })
  if (!['png', 'jpeg'].includes(metadata.format ?? '') || (request.type === 'image/png' ? metadata.format !== 'png' : metadata.format !== 'jpeg')) throw new ServiceError('INVALID_IMAGE', '图片格式与文件类型不一致')
  // Re-encode rather than preserving EXIF, GPS, embedded thumbnails, or user supplied metadata.
  const clean = await image.rotate().flatten({ background: '#ffffff' }).jpeg({ quality: 85, mozjpeg: true }).toBuffer()
  if (clean.length > MAX_IMAGE) throw new ServiceError('INVALID_IMAGE', '处理后的图片仍超过 3 MiB，请先压缩')
  const checkQuota = (store: Store) => {
    const owned = store.state.attachments.filter(item => item.ownerId === identity.uid && item.storagePath && !item.deletingAt)
    const used = owned.reduce((sum, item) => sum + (item.size ?? MAX_IMAGE), 0)
    if (owned.length >= MAX_ACCOUNT_IMAGES || used + clean.length > MAX_ACCOUNT_BYTES) throw new ServiceError('UPLOAD_QUOTA', '手写图片已达到试用容量上限，请联系运营协助整理')
  }
  await repository.read(store => { uploader(store, identity, pairId); checkQuota(store) })
  const id = randomUUID(), cloudPath = `private/letters/${identity.uid}/${id}.jpg`
  const saved = await app.uploadFile({ cloudPath, fileContent: clean })
  if (!saved.fileID) throw new ServiceError('STORAGE_FAILED', '图片没有保存成功，请重试')
  try {
    await repository.transact(store => {
      uploader(store, identity, pairId)
      checkQuota(store)
      store.state.attachments.push({ id, pairId, ownerId: identity.uid, name, type: 'image/jpeg', storagePath: saved.fileID, size: clean.length, uploadedAt: new Date().toISOString() } as Attachment)
      store.revision++
    })
  } catch (error) {
    await app.deleteFile({ fileList: [saved.fileID] }).catch(() => undefined)
    throw error
  }
  return { id, name, type: 'image/jpeg' }
}
async function download(repository: Repository, app: ReturnType<typeof createCloudApp>, identity: Identity, id: string) {
  const attachment = await repository.read(store => authorizeAttachment(store, identity, id))
  if (!attachment.storagePath) throw new ServiceError('NOT_FOUND', '图片不存在')
  const result = await app.downloadFile({ fileID: attachment.storagePath })
  const bytes = Buffer.isBuffer(result.fileContent) ? result.fileContent : Buffer.from(result.fileContent || '')
  if (!bytes.length || bytes.length > MAX_IMAGE) throw new ServiceError('STORAGE_FAILED', '图片读取失败')
  return { data: bytes.toString('base64'), type: attachment.type, name: attachment.name }
}
async function activate(repository: Repository, request: Request) {
  const token = text(request.token, '邀请码', 128), username = text(request.username, '登录账号', 24), password = request.password
  if (!validPassword(password)) throw new ServiceError('INVALID_INPUT', '密码需为 8—32 位，包含至少三类字符')
  const activationId = text(request.activationId, '激活编号', 100)
  const invite = await reserveInvite(repository, token, username, activationId)
  if (invite.status !== 'used') {
    const admin = manager()
    const existing = await admin.user.describeUserList({ uidList: [invite.userId!] })
    const prior = existing.Data.UserList.find(user => user.Uid === invite.userId)
    if (prior && prior.Name !== username) throw new ServiceError('CONFLICT', '账号名称与邀请记录不一致')
    if (!prior) {
      const created = await admin.user.createUser({ name: username, uid: invite.userId, password, type: 'externalUser', nickName: invite.nickname, email: invite.email, userStatus: 'ACTIVE' })
      if (created.Data?.Uid !== invite.userId) throw new ServiceError('IDENTITY_MISMATCH', '身份服务返回了不同账号，已停止激活')
    }
  }
  return finishInvite(repository, invite.id, activationId, invite.userId!)
}
async function resetChildPassword(repository: Repository, identity: Identity, payload: Record<string, unknown>) {
  const childId = text(payload.childId, '孩子账号', 100)
  const child = await repository.read(store => {
    const account = getAccount(store, identity, true)
    const person = store.state.people.find(item => item.id === childId && item.role === 'child')
    if (!person || person.teacherId !== identity.uid || account.role !== 'teacher' || store.accounts[childId]?.status !== 'active' || !person.guardianConsent) throw new ServiceError('FORBIDDEN', '只能协助自己负责且仍有有效授权的小朋友')
    return person
  })
  const password = `Lr${randomBytes(14).toString('base64url')}8!`
  const admin = manager()
  const users = await admin.user.describeUserList({ uidList: [childId] })
  const username = users.Data.UserList.find(item => item.Uid === childId)?.Name
  if (!username) throw new ServiceError('NOT_FOUND', '身份账号不存在')
  const modified = await admin.user.modifyUser({ uid: childId, password })
  if (!modified.Data?.Success) throw new ServiceError('AUTH_FAILED', '暂时无法重置登录卡')
  await repository.transact(store => {
    getAccount(store, identity, true)
    if (store.state.people.find(item => item.id === childId)?.teacherId !== identity.uid) throw new ServiceError('CONFLICT', '负责老师已变化，请联系运营重新处理')
    store.audit.push({ id: randomUUID(), actorId: identity.uid, action: 'reset-child-password', targetId: childId, at: new Date().toISOString() })
  })
  return { username, temporaryPassword: password, nickname: child.nickname }
}

/** Event cloud function called with the CloudBase web SDK; caller UID is read from trusted function context. */
export async function main(raw: unknown) {
  try {
    requirePilotReady()
    const request = asPayload(raw) as Request
    const app = createCloudApp(), repository = createRepository(app)
    const identity = await identityFor(app)
    if (identity.anonymous) throw new ServiceError('UNAUTHENTICATED', '请使用正式账号登录')
    let data: unknown
    switch (request.action) {
      case 'snapshot': data = await executeSnapshot(repository, identity); break
      case 'command': data = await executeCommand(repository, identity, { command: request.command!, requestId: request.requestId!, expectedRevision: request.expectedRevision }); break
      case 'account': {
        const action = text(request.operation, '账号操作', 80)
        const payload = asPayload(request.payload)
        if (action === 'status') data = await repository.read(store => accountStatus(store, identity))
        else if (action === 'reset-child-password') data = await resetChildPassword(repository, identity, payload)
        else data = await executeAccountAction(repository, identity, action, payload)
        break
      }
      case 'upload': data = await upload(repository, app, identity, request); break
      case 'download': data = await download(repository, app, identity, text(request.id, '图片编号', 100)); break
      default: throw new ServiceError('INVALID_ACTION', '不支持此项服务操作')
    }
    return { ok: true, data }
  } catch (error) {
    if (error instanceof ServiceError) return { ok: false, code: error.code, message: error.message }
    // Do not log letter text, credentials, invite secrets, or minors' personal data.
    return { ok: false, code: 'SERVICE_ERROR', message: '服务暂时无法完成，请保留输入后重试' }
  }
}

/** Expose only this single operation in the separately public activation function. */
export async function activationMain(raw: unknown) {
  try {
    requirePilotReady()
    const request = asPayload(raw) as Request
    if (request.action !== 'activate-invite') throw new ServiceError('INVALID_ACTION', '不支持此项服务操作')
    const app = createCloudApp(), repository = createRepository(app)
    const clientIp = app.auth().getClientIP()
    await repository.transact(store => throttle(store, `invite:${clientIp || request.token?.slice(0, 16) || 'unknown'}`, new Date().toISOString(), 12))
    return { ok: true, data: await activate(repository, request) }
  } catch (error) {
    if (error instanceof ServiceError) return { ok: false, code: error.code, message: error.message }
    return { ok: false, code: 'SERVICE_ERROR', message: '邀请暂时无法激活，请稍后重试' }
  }
}

/** Scheduled maintenance only. Deny client invocation in CloudBase function security rules. */
export async function maintenanceMain() {
  try {
    requirePilotReady()
    const app = createCloudApp(), repository = createRepository(app)
    const now = new Date().toISOString()
    const expired = await repository.transact(store => {
      const referenced = new Set(store.state.letters.flatMap(letter => [letter.attachmentId, ...(letter.submissionVersions ?? []).map(version => version.attachmentId)]))
      const candidates = store.state.attachments.filter(item => item.storagePath && !referenced.has(item.id) && ((item.deletingAt !== undefined) || Date.parse(item.uploadedAt ?? now) < Date.parse(now) - ORPHAN_AGE_MS))
      for (const item of candidates) item.deletingAt ??= now
      return candidates.map(item => ({ id: item.id, storagePath: item.storagePath! }))
    })
    let removed = 0
    for (const candidate of expired) {
      const deleted = await app.deleteFile({ fileList: [candidate.storagePath] })
      if (deleted.fileList.some(file => file.code !== 'SUCCESS')) continue
      await repository.transact(store => {
        const referenced = store.state.letters.some(letter => letter.attachmentId === candidate.id || letter.submissionVersions?.some(version => version.attachmentId === candidate.id))
        if (referenced) throw new ServiceError('CONFLICT', '附件在清理时被使用')
        store.state.attachments = store.state.attachments.filter(item => item.id !== candidate.id)
        store.revision++
      })
      removed++
    }
    return { ok: true, data: { candidates: expired.length, removed } }
  } catch { return { ok: false, code: 'MAINTENANCE_FAILED', message: '附件清理未完成；请检查任务日志并重试' } }
}
