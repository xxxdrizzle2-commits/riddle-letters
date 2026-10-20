import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, Leaf } from 'lucide-react'
import { cloudConfigured, signIn, registerVolunteer, verifyVolunteerEmail, recoverPassword, activateInvite, completePasswordRecovery } from '../services/cloud'
import { clearRuntime, refreshCloud } from '../runtime'
import { Notice, useAction } from '../ui'
import { roleNames } from './Entry'
import type { Role } from '../types'

export function PasswordField({label='密码',name='password',value,onChange,autoComplete='current-password'}:{label?:string;name?:string;value:string;onChange:(v:string)=>void;autoComplete?:string}) {
  const [shown,setShown]=useState(false)
  return <div className="field"><label htmlFor={name}>{label}</label><div className="password-field"><input id={name} type={shown?'text':'password'} value={value} onChange={e=>onChange(e.target.value)} autoComplete={autoComplete} required maxLength={128}/><button type="button" aria-label={shown?'隐藏密码':'显示密码'} aria-pressed={shown} onClick={()=>setShown(!shown)}>{shown?'隐藏':'显示'}</button></div></div>
}
export function AuthPage({kind='login',notify}:{kind?:'login'|'register'|'recover'|'activate';notify:(m:string)=>void}) {
  const params=useParams();const [search]=useSearchParams();const requestedRole=params.role||search.get('role')||'';const role=(['child','volunteer','teacher','operator'].includes(requestedRole)?requestedRole:'volunteer') as Role
  const navigate=useNavigate();const {run,busy,error}=useAction(notify)
  const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[email,setEmail]=useState(''),[token,setToken]=useState(search.get('token')||''),[nickname,setNickname]=useState(''),[institution,setInstitution]=useState(''),[availability,setAvailability]=useState(''),[agreed,setAgreed]=useState(false),[step,setStep]=useState<'form'|'verify'>('form'),[message,setMessage]=useState('')
  const title=kind==='register'?'成为一位书信伙伴':kind==='recover'?'找回你的账号':kind==='activate'?'开启你的书信旅程':`${roleNames[role]}，欢迎回来`
  const description=kind==='register'?'先验证邮箱，再提交陪伴申请。审核通过后，我们会为你安排结对。':kind==='activate'?'请使用老师或运营交给你的邀请信息。邀请只能激活一次。':kind==='recover'?'成人账号使用邮箱验证找回；小朋友可以请负责老师帮助重置。':role==='child'?'拿出你的登录卡，打开属于自己的小信箱。':'登录后，继续处理属于你的陪伴任务。'
  async function enterCloud(){clearRuntime();const snapshot=await refreshCloud();if(snapshot.profile.role!==role&&kind==='login')notify(`这个账号属于${roleNames[snapshot.profile.role]}，已进入对应页面。`);navigate('/space',{replace:true})}
  async function submit(event:FormEvent){event.preventDefault();setMessage('');await run(async()=>{
    if(kind==='login'){await signIn({username,password});await enterCloud()}
    else if(kind==='register'){
      if(step==='form'){await registerVolunteer({email,password,nickname,institution,availability});setStep('verify');setMessage('验证码已发送，请检查邮箱。')}
      else {await verifyVolunteerEmail({email,token});await enterCloud()}
    } else if(kind==='activate'){await activateInvite({token,username,password,nickname});await signIn({username,password});await enterCloud()}
    else if(step==='form'){await recoverPassword(email);setStep('verify');setMessage('如果该邮箱可用于找回，验证码会发送到邮箱。')}
    else {await completePasswordRecovery({email,token,password});setMessage('密码已更新，请使用新密码登录。');navigate(`/login/${role}`)}
  })}
  return <div className="container auth-layout"><aside className="auth-aside"><img src="/images/letter-garden.webp" alt="信件沿着花草间的小路，来到朋友身边"/><h2>每一次认真表达，<br/>都值得被温柔接住。</h2><p>可以慢慢想，也可以先写一点。<br/>我们在这里，陪你把日常装进信封。</p></aside><section className="auth-panel"><Link className="back-link" to="/"><ArrowLeft size={15}/>重新选择身份</Link><Leaf size={27} color="#356B55"/><h1>{title}</h1><p>{description}</p>
    {!cloudConfigured&&<Notice>真实账号服务尚未连接，暂时不能注册或登录。你可以先体验 Demo；演示内容不会作为真实账号数据。</Notice>}
    <form className="auth-form" onSubmit={submit}>
      {(kind==='login'||kind==='activate')&&<div className="field"><label htmlFor="username">{role==='child'||kind==='activate'?'登录账号':'邮箱或登录账号'}</label><input id="username" value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" required maxLength={64} spellCheck={false}/>{kind==='activate'&&<small className="field-help">使用字母或数字开头，可包含点、下划线和短横线。</small>}</div>}
      {(kind==='register'||kind==='recover')&&<div className="field"><label htmlFor="email">邮箱</label><input id="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required readOnly={step==='verify'}/></div>}
      {((kind==='register'&&step==='form')||kind==='activate')&&<div className="field"><label htmlFor="nickname">希望伙伴怎样称呼你</label><input id="nickname" value={nickname} onChange={e=>setNickname(e.target.value)} autoComplete="nickname" maxLength={32} required/></div>}
      {(kind==='login'||kind==='activate'||(kind==='register'&&step==='form')||(kind==='recover'&&step==='verify'))&&<PasswordField value={password} onChange={setPassword} autoComplete={kind==='login'?'current-password':'new-password'} label={kind==='recover'?'新密码':'密码'}/>}
      {(kind==='activate'||kind==='register'&&step==='form'||kind==='recover'&&step==='verify')&&<p className="field-help">密码使用 8—32 位，包含大写字母、小写字母、数字、符号中的至少三类。可以粘贴或使用密码管理器。</p>}
      {kind==='register'&&step==='form'&&<><div className="field"><label htmlFor="institution">学校或机构</label><input id="institution" value={institution} onChange={e=>setInstitution(e.target.value)} required maxLength={100}/></div><div className="field"><label htmlFor="availability">你可以怎样安排写信时间</label><textarea id="availability" value={availability} onChange={e=>setAvailability(e.target.value)} required maxLength={500} placeholder="例如：每周末有一段安静的时间，可以持续参与本学期。"/></div><label className="checkbox-line"><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)} required/><span>我已阅读<Link to="/plan">陪伴约定</Link>与<Link to="/privacy">隐私说明</Link>，愿意认真回应，并接受参与审核。</span></label></>}
      {(kind==='activate'||step==='verify')&&<div className="field"><label htmlFor="verification-token">{kind==='activate'?'邀请码':'邮箱验证码'}</label><input id="verification-token" value={token} onChange={e=>setToken(e.target.value)} autoComplete={kind==='activate'?'off':'one-time-code'} required maxLength={256}/></div>}
      {message&&<p role="status" className="notice">{message}</p>}{error&&<p role="alert" className="field-error">{error}</p>}
      <button className="btn" disabled={busy||!cloudConfigured}>{busy?'正在处理…':kind==='login'?'打开我的页面':kind==='activate'?'激活邀请':kind==='register'?(step==='form'?'验证邮箱并申请加入':'验证并完成申请'):(step==='form'?'发送找回验证码':'保存新密码')}</button>
    </form><div className="auth-links">{kind==='login'?<>{role==='volunteer'?<Link to="/register">还没有账号？申请成为志愿者</Link>:<Link to="/activate">我有邀请码</Link>}{role==='child'?<Link to="/help">忘记密码？找老师帮忙</Link>:<Link to={`/recover?role=${role}`}>忘记密码</Link>}</>:<Link to={`/login/${role}`}>已有账号，返回登录</Link>}<Link to="/demo">先体验 Demo</Link></div></section></div>
}
