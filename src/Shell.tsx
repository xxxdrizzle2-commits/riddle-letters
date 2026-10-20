import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { HashRouter, Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router'
import { ArrowRight, CheckCircle2, Feather, HeartHandshake, Leaf, Mail, RotateCcw, Settings2, Sparkles, Sprout, UserRound, X } from 'lucide-react'
import { dispatch, formatDate, initialize, resetDemo, useAppData } from './data'
import { Avatar, Badge, Empty, Notice, useAction } from './ui'
import { ChildPage, ComposePage, LetterDetail, VolunteerPage } from './pages/Companions'
import { OperatorPage, TeacherPage } from './pages/Operations'
import { AuthPage } from './pages/Auth'
import { AccountPage, ManageAccountsPage, HelpPage, PrivacyPage } from './pages/Account'
import { Home, PlanPage, StoriesPage, RiddlesPage } from './App'
import { RoleEntry, roleNames, spaceNames } from './pages/Entry'
import { clearRuntime, getRuntime, logout, refreshCloud, subscribeRuntime, useDemoRuntime } from './runtime'
import { cloudConfigured, getCloudSession } from './services/cloud'
import type { AppState, Person, Role } from './types'
import './pages/Operations.css'

export default function App(){return <HashRouter><Shell/></HashRouter>}
function Shell(){
  const runtime=useSyncExternalStore(subscribeRuntime,getRuntime)
  const state=useAppData();const location=useLocation();const navigate=useNavigate()
  const [actorId,setActorId]=useState(()=>localStorage.getItem('riddle-demo-actor')||'c1'),[toast,setToast]=useState(''),[dirty,setDirty]=useState(false),[boot,setBoot]=useState(true),[loadError,setLoadError]=useState('')
  const booted=useRef(false)
  const demo=runtime.mode==='demo'
  const actor=demo?state?.people.find(p=>p.id===actorId)||state?.people[0]:runtime.profile
  const isSpace=['/space','/write','/letters','/account','/help'].some(path=>location.pathname.startsWith(path))&&!!actor
  useEffect(()=>{if(booted.current)return;booted.current=true;(async()=>{try{
    if(location.pathname==='/demo'||sessionStorage.getItem('riddle-v1-mode')==='demo'){await initialize();useDemoRuntime()}
    else if(cloudConfigured&&await getCloudSession())await refreshCloud()
  }catch(error){setLoadError(error instanceof Error?error.message:'暂时没能读取账号，请重试。')}finally{setBoot(false)}})()},[])
  useEffect(()=>{if(!demo||location.pathname!=='/demo')return;navigate('/space',{replace:true})},[demo,location.pathname,navigate])
  useEffect(()=>{if(boot||location.pathname!=='/demo'||demo)return;(async()=>{try{await initialize();useDemoRuntime();navigate('/space',{replace:true})}catch{setLoadError('浏览器无法打开演示存储，请允许本站使用本地存储后重试。')}})()},[boot,demo,location.pathname,navigate])
  useEffect(()=>{if(!runtime.profile||demo||dirty)return;let pending=false;const update=()=>{if(document.hidden||pending)return;pending=true;refreshCloud().then(()=>setLoadError('')).catch(e=>setLoadError(e.message)).finally(()=>{pending=false})};const timer=setInterval(update,300000);window.addEventListener('focus',update);return()=>{clearInterval(timer);window.removeEventListener('focus',update)}},[runtime.profile?.id,demo,dirty])
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),6500);return()=>clearTimeout(timer)},[toast])
  useEffect(()=>{window.scrollTo(0,0);document.getElementById('main-content')?.focus({preventScroll:true})},[location.pathname])
  useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>event.preventDefault();window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[dirty])
  function changeActor(id:string,force=false){if(dirty&&!force&&!window.confirm('还有未保存的文字。仍要切换演示身份吗？'))return;setDirty(false);setActorId(id);localStorage.setItem('riddle-demo-actor',id);navigate('/space')}
  async function exit(){if(dirty&&!window.confirm('还有未保存的文字。确认退出吗？'))return;try{await logout();setDirty(false);navigate('/')}catch{setLoadError('退出登录未完成，当前会话仍可能有效。请重试；若使用共用设备，请先关闭浏览器并联系负责老师。')}}
  const props=state&&actor?{state,actor,notify:setToast,mode:demo?'demo' as const:'live' as const}:undefined
  const guard=(element:React.ReactNode)=>boot||(demo&&!state)||(runtime.profile&&!state)?<Loading/>:props?element:<Navigate to="/" replace/>
  return <div onClickCapture={event=>{const anchor=(event.target as HTMLElement).closest('a');if(dirty&&anchor&&anchor.href!==window.location.href&&!window.confirm('还有未保存的文字。仍要离开吗？')){event.preventDefault();event.stopPropagation()}}}>
    <a className="skip-link" href="#main-content" onClick={e=>{e.preventDefault();document.getElementById('main-content')?.focus()}}>跳到主要内容</a>
    <div className="demo-strip" role="region" aria-label="网站状态"><div className="container"><span><span className="live-dot"/>书信陪伴 · {demo?'独立演示':'见字如面'}</span><span>{demo?'虚构身份 · 仅当前浏览器保存':'慢慢相识，好好回应。'}</span></div></div>
    <header className="site-header"><div className="container header-inner"><Link to="/" className="brand"><span className="brand-icon"><Mail strokeWidth={1.5}/><Leaf size={16}/></span><span>谜语书信<small>把日常，寄给远方。</small></span></Link><nav className="public-nav" aria-label="主导航"><NavLink to="/plan">陪伴计划</NavLink><NavLink to="/riddles">谜语小屋</NavLink><NavLink to="/stories">来信故事</NavLink></nav><div className="header-account">{actor?<><Link className="btn header-cta" to="/space">{spaceNames[actor.role]}<ArrowRight size={16}/></Link>{!demo&&<button className="text-button" onClick={()=>refreshCloud().then(()=>setToast('任务已更新。')).catch(e=>setLoadError(e.message))}>刷新任务</button>}<Link to="/account" aria-label="我的账号"><UserRound size={18}/><span>我的</span></Link></>:<Link className="btn header-cta" to="/choose">选择身份<ArrowRight size={16}/></Link>}</div></div></header>
    {demo&&props&&<div className="demo-toolbar container" role="region" aria-label="演示工具"><div className="toolbar"><span className="demo-chip">DEMO</span><span className="small">{roleNames[actor!.role]} · {actor!.nickname}</span><button className="text-button" onClick={exit}>退出演示</button></div><DemoSettings {...props} onActor={changeActor} onReset={()=>changeActor('c1',true)} dirty={dirty}/></div>}
    {loadError&&<div className="container cloud-refresh-error"><Notice tone="warning">{loadError} <button className="text-button" onClick={()=>{setLoadError('');if(runtime.profile)refreshCloud().catch(e=>setLoadError(e.message));else window.location.reload()}}>重新连接</button></Notice></div>}
    <div className={isSpace?'app-layout container':'public-layout'}>
    {isSpace&&actor&&<aside className="app-sidebar" aria-label="工作区侧栏"><div className="sidebar-person"><Avatar person={actor} large/><h2>{actor.nickname}</h2><span>{roleNames[actor.role]}{demo?' · 演示身份':''}</span></div><nav aria-label="工作区导航"><NavLink to="/space"><Mail size={18}/>{spaceNames[actor.role]}</NavLink>{['child','volunteer'].includes(actor.role)&&<NavLink to="/write"><Feather size={18}/>写一封信</NavLink>}{['teacher','operator'].includes(actor.role)&&<NavLink to="/account/manage"><UserRound size={18}/>{actor.role==='teacher'?'邀请与授权':'加入与账号'}</NavLink>}<NavLink to="/riddles"><Sparkles size={18}/>谜语小屋</NavLink><NavLink to="/account" end><UserRound size={18}/>我的账号</NavLink><NavLink to="/help"><HeartHandshake size={18}/>找人帮忙</NavLink></nav><div className="sidebar-note"><Sprout size={27} strokeWidth={1.1}/><p>一封信，<br/>慢慢认识一个人。</p>{demo&&<small>演示日期<br/>{formatDate(state!.clock)}</small>}</div></aside>}
    <main id="main-content" tabIndex={-1} className={isSpace?'app-main':'public-main'}><Routes>
      <Route path="/" element={!demo&&runtime.profile?<Navigate to="/space" replace/>:<Home/>}/>
      <Route path="/choose" element={!demo&&runtime.profile?<Navigate to="/space" replace/>:<div className="container public-page"><RoleEntry onSelect={clearRuntime}/></div>}/>
      <Route path="/demo" element={<Loading/>}/><Route path="/plan" element={<PlanPage/>}/><Route path="/stories" element={<StoriesPage/>}/><Route path="/riddles" element={<RiddlesPage actor={actor}/>}/><Route path="/privacy" element={<PrivacyPage/>}/>
      <Route path="/login/:role" element={<AuthPage key={location.pathname} notify={setToast}/>}/><Route path="/register" element={<AuthPage key="register" kind="register" notify={setToast}/>}/><Route path="/recover" element={<AuthPage key="recover" kind="recover" notify={setToast}/>}/><Route path="/activate" element={<AuthPage key="activate" kind="activate" notify={setToast}/>}/>
      <Route path="/space" element={guard(props&&(actor!.role==='child'?<ChildPage key={actor!.id} {...props}/>:actor!.role==='volunteer'?<VolunteerPage key={actor!.id} {...props}/>:actor!.role==='teacher'?<TeacherPage key={actor!.id} {...props} setDirty={setDirty}/>:<OperatorPage key={actor!.id} {...props}/>))}/>
      <Route path="/letters/:id" element={guard(props&&<LetterDetail key={actor!.id+location.pathname} {...props}/>)}/><Route path="/write" element={guard(props&&<ComposePage key={actor!.id+location.pathname+location.search} {...props} setDirty={setDirty}/>)}/><Route path="/write/:id" element={guard(props&&<ComposePage key={actor!.id+location.pathname} {...props} setDirty={setDirty}/>)}/>
      <Route path="/account" element={guard(props&&<AccountPage {...props} onLogout={exit}/>)}/><Route path="/account/manage" element={guard(props&&<ManageAccountsPage {...props}/>)}/><Route path="/help" element={<HelpPage {...(props||{})} notify={setToast}/>}/>
      <Route path="*" element={<div className="container"><Empty title="这条邮路还没有开通" description="回到首页，再找找你想去的地方。"><Link to="/" className="btn">返回首页</Link></Empty></div>}/>
    </Routes></main></div>
    {isSpace&&actor&&<nav className="v1-mobile-nav" aria-label="手机任务导航"><NavLink to="/space"><Mail size={21}/>{actor.role==='child'?'信箱':'任务'}</NavLink>{['child','volunteer'].includes(actor.role)?<NavLink to="/write"><Feather size={21}/>写信</NavLink>:<NavLink to="/account/manage"><UserRound size={21}/>加入与账号</NavLink>}<NavLink to="/account" end><UserRound size={21}/>我的</NavLink><NavLink to="/help"><HeartHandshake size={21}/>帮忙</NavLink></nav>}
    <footer className="site-footer container"><Link className="brand footer-brand" to="/"><Mail size={21}/>谜语书信</Link><p>温暖、清晰，被认真回应。</p><span><Link to="/privacy">隐私说明</Link> · {demo?'合成数据演示':'书信陪伴计划'}</span></footer>
    {toast&&<div className="toast" role="status"><CheckCircle2 size={19}/><span>{toast}</span><button aria-label="关闭提示" onClick={()=>setToast('')}><X size={17}/></button></div>}
  </div>
}
function Loading(){return <div className="v1-loading" role="status"><Mail size={32}/><h1>正在整理你的小信箱…</h1><p>把每一封认真写下的信，放回它的位置。</p></div>}
function DemoSettings({state,actor,notify,onActor,onReset,dirty}:{state:AppState;actor:Person;notify:(m:string)=>void;onActor:(id:string)=>void;onReset:()=>void;dirty:boolean}){
  const {run,busy,error}=useAction(notify);const [date,setDate]=useState(state.clock.slice(0,10));const dialog=useRef<HTMLDialogElement>(null)
  useEffect(()=>setDate(state.clock.slice(0,10)),[state.clock])
  const clock=(value:string)=>run(()=>dispatch('op1',{type:'set-clock',value}),'演示日期已更新。')
  return <><details className="demo-settings"><summary><Settings2 size={16}/>演示设置</summary><div className="settings-panel"><h2>换一个视角，看看陪伴</h2><p className="muted small">这里是独立的合成数据体验，切换演示身份不代表真实登录。</p><div className="settings-fields"><div className="field"><label htmlFor="demo-role">演示角色</label><select id="demo-role" value={actor.role} onChange={e=>{const next=state.people.find(p=>p.role===e.target.value&&(p.role!=='teacher'||p.id==='t2'));if(next)onActor(next.id)}}>{Object.entries(roleNames).map(([role,name])=><option key={role} value={role}>{name}</option>)}</select></div><div className="field"><label htmlFor="demo-person">演示身份</label><select id="demo-person" value={actor.id} onChange={e=>onActor(e.target.value)}>{state.people.filter(p=>p.role===actor.role).map(p=><option key={p.id} value={p.id}>{p.nickname}</option>)}</select></div></div><div className="hairline"/><p>演示日期：{formatDate(state.clock)}</p><div className="toolbar clock-toolbar"><label className="sr-only" htmlFor="demo-date">调整演示日期</label><input id="demo-date" type="date" value={date} min={state.clock.slice(0,10)} onChange={e=>setDate(e.target.value)}/><button className="btn secondary small" disabled={busy} onClick={()=>clock(`${date}T09:00:00+08:00`)}>应用日期</button><button className="btn secondary small" disabled={busy} onClick={()=>clock(new Date(Date.parse(state.clock)+7*86400000).toISOString())}>前进 7 天</button></div><p className="small muted">只改变本地演示，不向现实中的人发送通知。</p><button className="text-button danger-text" onClick={()=>dialog.current?.showModal()}><RotateCcw size={15}/>重置演示数据</button>{error&&<p role="alert" className="field-error">{error}</p>}</div></details><dialog ref={dialog} className="confirm-dialog" aria-labelledby="reset-title"><div className="dialog-content"><h2 id="reset-title">把信箱恢复到最初的样子？</h2><p>删除当前浏览器中的演示操作，重新载入合成场景。{dirty?'未保存的文字也会丢失。':''}</p><div className="toolbar"><button className="btn secondary" onClick={()=>dialog.current?.close()}>保留当前内容</button><button className="btn" disabled={busy} onClick={async()=>{if(await run(resetDemo,'演示信箱已重置。')){dialog.current?.close();onReset()}}}>确认重置</button></div></div></dialog></>
}
