import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { HashRouter, Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router'
import { ArrowRight, BookOpen, CheckCircle2, Feather, HeartHandshake, Leaf, Mail, RotateCcw, Settings2, UserRound, Users, X } from 'lucide-react'
import { dispatch, formatDate, initialize, resetDemo, useAppData } from './data'
import { Avatar, Empty, useAction } from './ui'
import { RoleEntry, roleNames } from './pages/Entry'
import { clearRuntime, getRuntime, subscribeRuntime, useDemoRuntime } from './runtime'
import type { AppState, Person, Role } from './types'
import './pages/Operations.css'

const ChildPage = lazy(() => import('./pages/Companions').then(module => ({ default: module.ChildPage })))
const VolunteerPage = lazy(() => import('./pages/Companions').then(module => ({ default: module.VolunteerPage })))
const CorrespondencePage = lazy(() => import('./pages/Companions').then(module => ({ default: module.CorrespondencePage })))
const ComposePage = lazy(() => import('./pages/Companions').then(module => ({ default: module.ComposePage })))
const LetterDetail = lazy(() => import('./pages/Companions').then(module => ({ default: module.LetterDetail })))
const TeacherPage = lazy(() => import('./pages/Operations').then(module => ({ default: module.TeacherPage })))
const TeacherQueuePage = lazy(() => import('./pages/Operations').then(module => ({ default: module.TeacherQueuePage })))
const TeacherHistoryPage = lazy(() => import('./pages/Operations').then(module => ({ default: module.TeacherHistoryPage })))
const OperatorPage = lazy(() => import('./pages/Operations').then(module => ({ default: module.OperatorPage })))
const OperatorReviewPage = lazy(() => import('./pages/Operations').then(module => ({ default: module.OperatorReviewPage })))
const OperatorPairsPage = lazy(() => import('./pages/Operations').then(module => ({ default: module.OperatorPairsPage })))
const OperatorFollowupPage = lazy(() => import('./pages/Operations').then(module => ({ default: module.OperatorFollowupPage })))
const AuthPage = lazy(() => import('./pages/Auth').then(module => ({ default: module.AuthPage })))
const AccountPage = lazy(() => import('./pages/Account').then(module => ({ default: module.AccountPage })))
const ManageAccountsPage = lazy(() => import('./pages/Account').then(module => ({ default: module.ManageAccountsPage })))
const HelpPage = lazy(() => import('./pages/Account').then(module => ({ default: module.HelpPage })))
const PrivacyPage = lazy(() => import('./pages/Account').then(module => ({ default: module.PrivacyPage })))
const Home = lazy(() => import('./App').then(module => ({ default: module.Home })))
const PlanPage = lazy(() => import('./App').then(module => ({ default: module.PlanPage })))
const StoriesPage = lazy(() => import('./App').then(module => ({ default: module.StoriesPage })))
const RiddlesPage = lazy(() => import('./App').then(module => ({ default: module.RiddlesPage })))

const demoActors: Record<Role, string> = { child: 'c1', volunteer: 'v1', teacher: 't2', operator: 'op1' }
const roleFromPath = (pathname: string): Role | undefined => {
  const match = /^\/demo\/start\/(child|volunteer|teacher|operator)$/.exec(pathname)
  return match?.[1] as Role | undefined
}
const isWorkPath = (pathname: string) => /^\/(space|correspondence|write|letters|teacher|operator|account|help)(\/|$)/.test(pathname)

export default function App() { return <HashRouter><Shell/></HashRouter> }

function Shell() {
  const runtime = useSyncExternalStore(subscribeRuntime, getRuntime)
  const state = useAppData()
  const location = useLocation()
  const navigate = useNavigate()
  const [actorId, setActorId] = useState(() => localStorage.getItem('riddle-demo-actor') || 'c1')
  const [toast, setToast] = useState('')
  const [dirty, setDirty] = useState(false)
  const [boot, setBoot] = useState(true)
  const [loadError, setLoadError] = useState('')
  const starting = useRef(false)
  const demo = runtime.mode === 'demo'
  const actor = demo ? state?.people.find(person => person.id === actorId) || state?.people.find(person => person.id === 'c1') : undefined
  const workPath = isWorkPath(location.pathname)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (sessionStorage.getItem('riddle-v1-mode') === 'demo') {
          await initialize()
          if (!cancelled) useDemoRuntime()
        }
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : '暂时没能打开演示信箱。')
      } finally { if (!cancelled) setBoot(false) }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const role = roleFromPath(location.pathname)
    if (boot || !role || starting.current) return
    starting.current = true
    ;(async () => {
      try {
        await initialize()
        useDemoRuntime()
        const id = demoActors[role]
        setActorId(id)
        localStorage.setItem('riddle-demo-actor', id)
        setDirty(false)
        navigate('/space', { replace: true })
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : '浏览器无法打开演示存储，请允许本站保存本地数据后重试。')
      } finally { starting.current = false }
    })()
  }, [boot, location.pathname, navigate])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 6500)
    return () => clearTimeout(timer)
  }, [toast])
  useEffect(() => {
    window.scrollTo(0, 0)
    document.getElementById('main-content')?.focus({ preventScroll: true })
  }, [location.pathname])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function changeActor(id: string, force = false) {
    if (dirty && !force && !window.confirm('还有未保存的文字。仍要切换演示身份吗？')) return
    setDirty(false)
    setActorId(id)
    localStorage.setItem('riddle-demo-actor', id)
    navigate('/space')
  }
  function exitDemo() {
    if (dirty && !window.confirm('还有未保存的文字。确认退出演示吗？')) return
    setDirty(false)
    clearRuntime()
    navigate('/')
  }
  const props = state && actor ? { state, actor, notify: setToast, mode: 'demo' as const } : undefined
  const guard = (content: () => ReactNode, roles?: Role[]) => boot || demo && !props
    ? <Loading/>
    : !props ? <Navigate to="/choose" replace/>
      : roles && !roles.includes(actor!.role) ? <Navigate to="/space" replace/> : content()

  const routeContent = <Suspense fallback={<Loading/>}><Routes>
    <Route path="/" element={<Home/>}/>
    <Route path="/choose" element={<div className="container public-page v2-choose-page"><RoleEntry/></div>}/>
    <Route path="/demo" element={<Navigate to="/choose" replace/>}/>
    <Route path="/demo/start/:role" element={!roleFromPath(location.pathname) ? <Navigate to="/choose" replace/> : loadError ? <DemoStartError message={loadError}/> : <Loading/>}/>
    <Route path="/plan" element={<PlanPage/>}/>
    <Route path="/stories" element={<StoriesPage/>}/>
    <Route path="/riddles" element={<RiddlesPage/>}/>
    <Route path="/privacy" element={<PrivacyPage/>}/>
    <Route path="/login/:role" element={<AuthPage/>}/>
    <Route path="/register" element={<AuthPage kind="register"/>}/>
    <Route path="/recover" element={<AuthPage kind="recover"/>}/>
    <Route path="/activate" element={<AuthPage kind="activate"/>}/>
    <Route path="/space" element={guard(() => actor!.role === 'child' ? <ChildPage key={actor!.id} {...props!}/>
      : actor!.role === 'volunteer' ? <VolunteerPage key={actor!.id} {...props!}/>
        : actor!.role === 'teacher' ? <TeacherPage key={actor!.id} {...props!} setDirty={setDirty}/>
          : <OperatorPage key={actor!.id} {...props!}/>)}/>
    <Route path="/correspondence" element={guard(() => <CorrespondencePage key={actor!.id} {...props!}/>, ['child', 'volunteer'])}/>
    <Route path="/write" element={guard(() => <ComposePage key={actor!.id + location.pathname + location.search} {...props!} setDirty={setDirty}/>, ['child', 'volunteer'])}/>
    <Route path="/write/:id" element={guard(() => <ComposePage key={actor!.id + location.pathname} {...props!} setDirty={setDirty}/>, ['child', 'volunteer'])}/>
    <Route path="/letters/:id" element={guard(() => <LetterDetail key={actor!.id + location.pathname} {...props!}/>, ['child', 'volunteer'])}/>
    <Route path="/teacher/tasks/:stage" element={guard(() => <TeacherQueuePage key={actor!.id + location.pathname} {...props!} setDirty={setDirty}/>, ['teacher'])}/>
    <Route path="/teacher/history" element={guard(() => <TeacherHistoryPage key={actor!.id} {...props!}/>, ['teacher'])}/>
    <Route path="/operator/review" element={guard(() => <OperatorReviewPage key={actor!.id} {...props!}/>, ['operator'])}/>
    <Route path="/operator/pairs" element={guard(() => <OperatorPairsPage key={actor!.id} {...props!}/>, ['operator'])}/>
    <Route path="/operator/followups" element={guard(() => <OperatorFollowupPage key={actor!.id} {...props!}/>, ['operator'])}/>
    <Route path="/account" element={guard(() => <AccountPage {...props!} onLogout={exitDemo}/>)}/>
    <Route path="/account/manage" element={guard(() => <ManageAccountsPage {...props!}/>, ['teacher', 'operator'])}/>
    <Route path="/help" element={guard(() => <HelpPage {...props!}/>)}/>
    <Route path="*" element={<div className="container public-page"><Empty title="这条邮路还没有开通" description="回到首页，再找找你想去的地方。"><Link to="/" className="btn">返回首页</Link></Empty></div>}/>
  </Routes></Suspense>

  return <div className="shell-root" onClickCapture={event => {
    const anchor = (event.target as HTMLElement).closest('a')
    if (dirty && anchor && anchor.href !== window.location.href && !window.confirm('还有未保存的文字。仍要离开吗？')) {
      event.preventDefault()
      event.stopPropagation()
    }
  }}>
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus() }}>跳到主要内容</a>
    {workPath && actor ? <DemoLayout state={state!} actor={actor} notify={setToast} changeActor={changeActor} exitDemo={exitDemo} dirty={dirty}>
      {routeContent}
    </DemoLayout> : <PublicLayout hasDemo={!!actor}>{routeContent}</PublicLayout>}
    {loadError && !location.pathname.startsWith('/demo/start/') && <div className="toast toast-error" role="alert"><span>{loadError}</span><button aria-label="关闭错误提示" onClick={() => setLoadError('')}><X size={17}/></button></div>}
    {toast && <div className="toast" role="status"><CheckCircle2 size={19}/><span>{toast}</span><button aria-label="关闭提示" onClick={() => setToast('')}><X size={17}/></button></div>}
  </div>
}

function PublicLayout({ hasDemo, children }: { hasDemo: boolean; children: ReactNode }) {
  return <div className="v2-public-layout">
    <header className="site-header"><div className="container header-inner">
      <Link to="/" className="brand"><span className="brand-icon"><Mail strokeWidth={1.5}/><Leaf size={16}/></span><span>谜语书信<small>把日常，寄给远方。</small></span></Link>
      <nav className="public-nav" aria-label="网站导航"><NavLink to="/plan">陪伴计划</NavLink><NavLink to="/riddles">谜语小屋</NavLink><NavLink to="/stories">来信故事</NavLink></nav>
      <Link className="btn header-cta" to={hasDemo ? '/space' : '/choose'}>{hasDemo ? '回到演示' : '选择身份'}<ArrowRight size={16}/></Link>
    </div></header>
    <main id="main-content" tabIndex={-1} className="public-main">{children}</main>
    <footer className="site-footer container"><Link className="brand footer-brand" to="/"><Mail size={21}/>谜语书信</Link><p>温暖、清晰，被认真回应。</p><span><Link to="/privacy">隐私说明</Link> · 合成数据演示</span></footer>
  </div>
}

type NavItem = { to: string; label: string; icon: typeof Mail; group?: string }
const roleNavigation: Record<Role, NavItem[]> = {
  child: [{ to: '/space', label: '信箱', icon: Mail }, { to: '/write', label: '写信', icon: Feather }, { to: '/account', label: '我的', icon: UserRound }],
  volunteer: [{ to: '/space', label: '陪伴任务', icon: HeartHandshake }, { to: '/write', label: '写信', icon: Feather }, { to: '/correspondence', label: '书信往来', icon: Mail }],
  teacher: [{ to: '/space', label: '收发任务', icon: Mail }, { to: '/teacher/history', label: '处理记录', icon: BookOpen }, { to: '/account', label: '我的', icon: UserRound }],
  operator: [{ to: '/space', label: '待处理', icon: HeartHandshake }, { to: '/operator/review', label: '审核', icon: Mail }, { to: '/operator/pairs', label: '结对', icon: Users }, { to: '/operator/followups', label: '跟进', icon: BookOpen }],
}
function navActive(pathname: string, role: Role, to: string) {
  if (to === '/space') return pathname === '/space' || role === 'child' && (pathname === '/correspondence' || pathname.startsWith('/letters/')) || role === 'teacher' && pathname.startsWith('/teacher/tasks/')
  if (to === '/write') return pathname === '/write' || pathname.startsWith('/write/')
  if (to === '/correspondence') return pathname === '/correspondence' || pathname.startsWith('/letters/')
  return pathname === to || pathname.startsWith(`${to}/`)
}
function DemoNav({ role, mobile = false }: { role: Role; mobile?: boolean }) {
  const { pathname } = useLocation()
  return <nav className={mobile ? 'v1-mobile-nav v2-mobile-nav' : 'v2-role-nav'} aria-label={mobile ? '手机任务导航' : '工作区导航'}>
    {roleNavigation[role].map(({ to, label, icon: Icon }) => <Link key={to} to={to} aria-current={navActive(pathname, role, to) ? 'page' : undefined} className={navActive(pathname, role, to) ? 'active' : ''}><Icon size={mobile ? 20 : 19} strokeWidth={1.8}/><span>{label}</span></Link>)}
  </nav>
}

function DemoLayout({ state, actor, notify, changeActor, exitDemo, dirty, children }: {
  state: AppState; actor: Person; notify: (message: string) => void; changeActor: (id: string, force?: boolean) => void; exitDemo: () => void; dirty: boolean; children: ReactNode
}) {
  return <div className="v2-demo-layout">
    <header className="v2-demo-header"><div className="container v2-demo-header-inner">
      <Link className="brand v2-demo-brand" to="/space"><span className="brand-icon"><Mail strokeWidth={1.5}/><Leaf size={16}/></span><span>谜语书信</span></Link>
      <div className="v2-demo-identity"><strong>{roleNames[actor.role]}</strong><span>合成数据演示 · 仅当前浏览器保存</span></div>
      <div className="v2-demo-tools">{actor.role === 'child' && <Link className="v2-help-link" to="/help"><HeartHandshake size={17}/>找人帮忙</Link>}
        {actor.role !== 'child' && actor.role !== 'teacher' && <Link className="v2-account-link" to="/account"><UserRound size={17}/>我的</Link>}
        <DemoSettings state={state} actor={actor} notify={notify} onActor={changeActor} onReset={() => changeActor('c1', true)} onExit={exitDemo} dirty={dirty}/>
      </div>
    </div></header>
    <div className="app-layout container v2-app-layout">
      <aside className="app-sidebar v2-app-sidebar"><div className="sidebar-person"><Avatar person={actor} large/><h2>{actor.nickname}</h2><span>{roleNames[actor.role]} · 演示身份</span></div><DemoNav role={actor.role}/><div className="v2-sidebar-foot"><p>一封信，慢慢认识一个人。</p><small>演示日期：{formatDate(state.clock)}</small></div></aside>
      <main id="main-content" tabIndex={-1} className="app-main">{children}</main>
    </div>
    <DemoNav role={actor.role} mobile/>
  </div>
}

function DemoSettings({ state, actor, notify, onActor, onReset, onExit, dirty }: {
  state: AppState; actor: Person; notify: (message: string) => void; onActor: (id: string) => void; onReset: () => void; onExit: () => void; dirty: boolean
}) {
  const { run, busy, error } = useAction(notify)
  const [date, setDate] = useState(state.clock.slice(0, 10))
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => setDate(state.clock.slice(0, 10)), [state.clock])
  const setClock = (value: string) => run(() => dispatch('op1', { type: 'set-clock', value }), '演示日期已保存到此浏览器。')
  return <><details className="demo-settings v2-demo-settings"><summary><Settings2 size={17}/><span>演示设置</span></summary>
    <div className="settings-panel"><h2>演示设置</h2><p className="muted small">所有人物和书信都是合成内容。切换身份只改变当前视角。</p>
      <div className="settings-fields"><div className="field"><label htmlFor="demo-role">演示角色</label><select id="demo-role" value={actor.role} onChange={event => onActor(demoActors[event.target.value as Role])}>{Object.entries(roleNames).map(([role, name]) => <option key={role} value={role}>{name}</option>)}</select></div>
        <div className="field"><label htmlFor="demo-person">演示人物</label><select id="demo-person" value={actor.id} onChange={event => onActor(event.target.value)}>{state.people.filter(person => person.role === actor.role).map(person => <option key={person.id} value={person.id}>{person.nickname}</option>)}</select></div></div>
      <div className="hairline"/><div className="field"><label htmlFor="demo-date">演示日期：{formatDate(state.clock)}</label><input id="demo-date" type="date" value={date} onChange={event => setDate(event.target.value)}/></div>
      <div className="toolbar"><button type="button" className="btn secondary small" disabled={busy || !date} onClick={() => setClock(`${date}T09:00:00+08:00`)}>应用日期</button><button type="button" className="btn secondary small" disabled={busy} onClick={() => setClock(new Date(Date.parse(state.clock) + 7 * 86400000).toISOString())}>前进 7 天</button></div>
      <p className="small muted">调整日期只用于查看本地演示的逾期待办，不会发送通知。</p>
      <div className="v2-settings-actions"><button type="button" className="text-button danger-text" onClick={() => dialog.current?.showModal()}><RotateCcw size={16}/>重置演示数据</button><button type="button" className="text-button" onClick={onExit}>退出演示</button></div>
      {error && <p role="alert" className="field-error">{error}</p>}
    </div></details>
    <dialog ref={dialog} className="confirm-dialog" aria-labelledby="reset-title"><div className="dialog-content"><h2 id="reset-title">把信箱恢复到最初的样子？</h2><p>这会删除当前浏览器中的演示操作。{dirty ? '未保存的文字也会丢失。' : ''}</p><div className="toolbar"><button className="btn secondary" onClick={() => dialog.current?.close()}>保留当前内容</button><button className="btn" disabled={busy} onClick={async () => { if (await run(resetDemo, '演示信箱已恢复初始状态。')) { dialog.current?.close(); onReset() } }}>确认重置</button></div></div></dialog>
  </>
}

function Loading() { return <div className="v1-loading" role="status"><Mail size={32}/><h1>正在整理演示信箱…</h1><p>把每一封认真写下的信，放回它的位置。</p></div> }
function DemoStartError({ message }: { message: string }) { return <div className="container public-page"><Empty title="暂时没能打开演示" description={message}><Link className="btn" to="/choose">重新选择身份<ArrowRight size={16}/></Link></Empty></div> }
