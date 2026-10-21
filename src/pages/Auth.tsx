import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, ArrowRight, Leaf, LoaderCircle } from 'lucide-react'
import { roleNames } from './Entry'
import type { Role } from '../types'
import { cloudConfigured, signIn } from '../services/cloud'
import { logout, refreshCloud } from '../runtime'

// Kept for the account profile component used by the future live service.
export function PasswordField({ label = '密码', name = 'password', value, onChange, autoComplete = 'current-password' }: {
  label?: string; name?: string; value: string; onChange: (value: string) => void; autoComplete?: string
}) {
  const [shown, setShown] = useState(false)
  return <div className="field"><label htmlFor={name}>{label}</label><div className="password-field">
    <input id={name} type={shown ? 'text' : 'password'} value={value} onChange={event => onChange(event.target.value)} autoComplete={autoComplete} required maxLength={128}/>
    <button type="button" aria-label={shown ? '隐藏密码' : '显示密码'} aria-pressed={shown} onClick={() => setShown(!shown)}>{shown ? '隐藏' : '显示'}</button>
  </div></div>
}

// Historical account routes remain informational in V2. Only an explicitly
// configured and access-protected V3 Preview exposes the adult test sign-in.
export function AuthPage({ kind = 'login', notify }: { kind?: 'login' | 'register' | 'recover' | 'activate'; notify?: (message: string) => void }) {
  const { role: requestedRole } = useParams()
  const navigate = useNavigate()
  const role = (requestedRole && requestedRole in roleNames ? requestedRole : 'volunteer') as Role
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      await signIn({ username: email.trim(), password })
      let snapshot
      try { snapshot = await refreshCloud() }
      catch (cause) {
        await logout()
        throw cause
      }
      const actualRole = snapshot.profile.role
      if (actualRole !== role) notify?.(`此账号的实际身份是“${roleNames[actualRole]}”，已按账号权限进入对应工作区。`)
      else notify?.(`已进入${roleNames[actualRole]}试测工作区。`)
      navigate('/space', { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录没有完成，请检查账号后重试。')
    } finally { setBusy(false) }
  }

  if (cloudConfigured && kind !== 'login') return <div className="container auth-layout auth-unavailable">
    <aside className="auth-aside"><img src="/images/letter-garden.webp" alt="打开的信和沿着花草小路飞来的小鸟"/><h2>慢慢相识，<br/>好好回应。</h2></aside>
    <section className="auth-panel"><Link className="back-link" to="/choose"><ArrowLeft size={16}/>返回角色入口</Link><Leaf size={29} color="#356B55"/><h1>试测登录采用邀请制</h1><p>试测期间不开放公众注册、账号恢复或儿童账号激活。请由试测负责人准备账号；如无法登录，请联系负责人处理。</p><Link className="btn" to="/login/volunteer">前往试测登录<ArrowRight size={17}/></Link><p className="auth-footnote">全部测试使用成年人和合成身份，不接入真实儿童资料。</p></section>
  </div>

  if (cloudConfigured) return <div className="container auth-layout">
    <aside className="auth-aside"><img src="/images/letter-garden.webp" alt="打开的信和沿着花草小路飞来的小鸟"/><h2>慢慢相识，<br/>好好回应。</h2><p>试测登录 · 合成身份</p></aside>
    <section className="auth-panel">
      <Link className="back-link" to="/choose"><ArrowLeft size={16}/>返回角色入口</Link>
      <Leaf size={29} color="#356B55"/>
      <h1>试测登录</h1>
      <p>你选了“{roleNames[role]}”入口。登录后会按服务端记录的真实测试角色进入工作区。</p>
      <form className="auth-form" onSubmit={submit} aria-busy={busy}>
        <div className="field"><label htmlFor="test-email">试测邮箱</label><input id="test-email" type="email" autoComplete="username" inputMode="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={200} /></div>
        <PasswordField name="test-password" label="密码" value={password} onChange={setPassword} />
        {error && <p className="field-error" role="alert">{error}</p>}
        <button className="btn" type="submit" disabled={busy || !email.trim() || !password}>{busy && <LoaderCircle size={17} className="spin" aria-hidden="true"/>}{busy ? '正在验证…' : '登录并进入工作区'}<ArrowRight size={17}/></button>
      </form>
      <p className="auth-footnote">仅限已邀请的成年测试者。此页面不会创建账号；登录失败时保留邮箱，密码可由密码管理器粘贴。</p>
    </section>
  </div>

  const title = kind === 'login' ? `${roleNames[role]}入口将在正式试用阶段开放` : kind === 'register' ? '申请加入陪伴将在正式试用阶段开放' : kind === 'recover' ? '找回账号将在正式试用阶段开放' : '激活邀请将在正式试用阶段开放'
  return <div className="container auth-layout auth-unavailable">
    <aside className="auth-aside"><img src="/images/letter-garden.webp" alt="打开的信和沿着花草小路飞来的小鸟"/><h2>慢慢相识，<br/>好好回应。</h2></aside>
    <section className="auth-panel">
      <Link className="back-link" to="/"><ArrowLeft size={16}/>返回项目首页</Link>
      <Leaf size={29} color="#356B55"/>
      <h1>{title}</h1>
      <p>当前 V2 是合成数据演示。还没有真实账号、注册和跨设备保存；你现在可以选择身份，实际体验写信、审核、收发与跟进。</p>
      <Link className="btn" to="/choose">选择演示身份<ArrowRight size={17}/></Link>
      <p className="auth-footnote">演示身份可以随时切换，不会给真实伙伴发送消息。</p>
    </section>
  </div>
}
