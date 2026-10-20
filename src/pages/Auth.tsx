import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, ArrowRight, Leaf } from 'lucide-react'
import { roleNames } from './Entry'
import type { Role } from '../types'

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

// These historical routes remain readable while V2 operates as a local demonstration.
export function AuthPage({ kind = 'login' }: { kind?: 'login' | 'register' | 'recover' | 'activate'; notify?: (message: string) => void }) {
  const { role: requestedRole } = useParams()
  const role = (requestedRole && requestedRole in roleNames ? requestedRole : 'volunteer') as Role
  const title = kind === 'login' ? `${roleNames[role]}入口` : kind === 'register' ? '申请加入陪伴' : kind === 'recover' ? '找回账号' : '激活邀请'
  return <div className="container auth-layout auth-unavailable">
    <aside className="auth-aside"><img src="/images/letter-garden.webp" alt="打开的信和沿着花草小路飞来的小鸟"/><h2>慢慢相识，<br/>好好回应。</h2></aside>
    <section className="auth-panel">
      <Link className="back-link" to="/"><ArrowLeft size={16}/>返回项目首页</Link>
      <Leaf size={29} color="#356B55"/>
      <h1>{title}将在正式试用阶段开放</h1>
      <p>当前 V2 是合成数据演示。还没有真实账号、注册和跨设备保存；你现在可以选择身份，实际体验写信、审核、收发与跟进。</p>
      <Link className="btn" to="/choose">选择演示身份<ArrowRight size={17}/></Link>
      <p className="auth-footnote">演示身份可以随时切换，不会给真实伙伴发送消息。</p>
    </section>
  </div>
}
