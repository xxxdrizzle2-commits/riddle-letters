import { randomUUID } from 'node:crypto'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { resolve } from 'node:path'
import { hashPassword } from 'better-auth/crypto'
import { getPlatformProxy } from 'wrangler'

const roles = [
  { role: 'child', example: '小树', subtitle: '试测登录 · 合成孩子角色', avatar: '🌱', interests: ['谜语', '植物', '画画'] },
  { role: 'volunteer', example: '林溪', subtitle: '试测登录 · 合成志愿者角色', avatar: '✉️', interests: ['阅读', '散步', '观察'] },
  { role: 'teacher', example: '周老师', subtitle: '试测登录 · 合成老师角色', avatar: '📚', interests: [] },
  { role: 'operator', example: '运营同学', subtitle: '试测登录 · 合成运营角色', avatar: '🪴', interests: [] },
]
const operatorPermissions = ['accounts', 'moderate', 'followup', 'help', 'privacy']
const permissionsFor = role => role === 'operator' ? operatorPermissions : []
const escapeSql = value => `'${String(value).replaceAll("'", "''")}'`
const rl = createInterface({ input, output })
const ask = async (label, fallback = '') => {
  const suffix = fallback ? `（默认：${fallback}）` : ''
  const value = (await rl.question(`${label}${suffix}：`)).trim()
  return value || fallback
}
const askSecret = async label => {
  if (!input.isTTY) throw new Error('请在本机交互式终端运行此脚本，以隐藏输入密码。')
  const lineReader = rl
  const originalWrite = lineReader._writeToOutput.bind(lineReader)
  const prompt = `${label}：`
  lineReader._writeToOutput = chunk => {
    if (chunk === prompt || chunk === '\r\n' || chunk === '\n') originalWrite(chunk)
  }
  try { return await rl.question(prompt) }
  finally { lineReader._writeToOutput = originalWrite; output.write('\n') }
}

let proxy
try {
  const consent = await ask('确认仅给四位成年测试者创建合成角色账号？请输入 ADULT-ONLY')
  if (consent !== 'ADULT-ONLY') throw new Error('未确认成人合成数据边界，已停止。')

  const users = []
  for (const item of roles) {
    output.write(`\n${item.role} 角色账号\n`)
    const email = (await ask('试测邮箱')).toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`邮箱格式不正确：${email || '空值'}`)
    const name = await ask('工作区显示称呼', item.example)
    const password = await askSecret('设置密码（至少 12 位；输入内容不会显示）')
    if (password.length < 12 || password.length > 128) throw new Error('密码需为 12 至 128 位。')
    const confirmation = await askSecret('再次输入密码')
    if (password !== confirmation) throw new Error('两次输入的密码不一致。')
    users.push({ ...item, email, name, password, id: randomUUID() })
  }

  proxy = await getPlatformProxy({
    configPath: resolve('wrangler.v3-preview.jsonc'),
    persist: true,
    remote: false,
  })
  const db = proxy.env.DB
  if (!db) throw new Error('没有找到本机 D1 绑定。请先应用 V3 Preview 迁移。')
  const schema = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('user', 'app_meta', 'app_accounts', 'app_people')").all()
  const available = new Set(schema.results.map(row => row.name))
  for (const table of ['user', 'app_meta', 'app_accounts', 'app_people']) if (!available.has(table)) throw new Error(`本机 D1 缺少 ${table} 表；请先运行 npm run db:v3-preview:migrate。`)

  const emails = users.map(user => user.email)
  const existing = await db.prepare(`SELECT email FROM "user" WHERE email IN (${emails.map(() => '?').join(',')})`).bind(...emails).all()
  if (existing.results.length) throw new Error(`以下邮箱已经存在，未修改数据库：${existing.results.map(row => row.email).join(', ')}`)

  const teacher = users.find(user => user.role === 'teacher')
  const now = new Date().toISOString()
  const statements = []
  for (const user of users) {
    const permissions = permissionsFor(user.role)
    const profile = {
      id: user.id,
      role: user.role,
      nickname: user.name,
      subtitle: user.subtitle,
      avatar: user.avatar,
      interests: user.interests,
      accountStatus: 'active',
      volunteerApproved: user.role === 'volunteer' ? true : undefined,
      // This marker belongs only to this generated synthetic fixture; it is not a real child or guardian record.
      guardianConsent: user.role === 'child' ? true : undefined,
      teacherId: user.role === 'child' ? teacher.id : undefined,
      permissions: user.role === 'operator' ? ['review', 'safeguarding', 'administration'] : undefined,
    }
    const account = { uid: user.id, role: user.role, status: 'active', permissions, createdAt: now }
    const passwordHash = await hashPassword(user.password)
    statements.push(
      db.prepare('INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)').bind(user.id, user.name, user.email, 1, now, now),
      db.prepare('INSERT INTO "account" (id, accountId, providerId, userId, password, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(randomUUID(), user.id, 'credential', user.id, passwordHash, now, now),
      db.prepare('INSERT INTO app_accounts (user_id, role, status, permissions_json, created_at, data_json) VALUES (?, ?, ?, ?, ?, ?)').bind(user.id, user.role, 'active', JSON.stringify(permissions), now, JSON.stringify(account)),
      db.prepare('INSERT INTO app_people (id, role, nickname, teacher_id, account_status, data_json) VALUES (?, ?, ?, ?, ?, ?)').bind(user.id, user.role, user.name, profile.teacherId ?? null, 'active', JSON.stringify(profile)),
    )
  }
  await db.batch(statements)
  output.write('\n已在本机 V3 Preview D1 创建 4 个成人测试账号和合成角色资料。\n')
  for (const user of users) output.write(`- ${user.role}: ${user.email}\n`)
  output.write('密码只保存在你输入时的内存中，并以哈希写入本机数据库；没有账号对应真实儿童。\n')
} finally {
  rl.close()
  await proxy?.dispose()
}
