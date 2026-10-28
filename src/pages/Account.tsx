import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, ArrowRight, HeartHandshake, KeyRound, Leaf, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { cloudAccountAction, cloudConfigured, changePassword } from '../services/cloud'
import { refreshCloud } from '../runtime'
import { dispatch, formatDate } from '../data'
import { BackLink, Badge, Empty, Notice, PageHeader, useAction, type PageProps } from '../ui'
import { PasswordField } from './Auth'

type AccountStatus = {
  account?: { status?: string; email?: string; createdAt?: string }
  profile?: { nickname?: string; role?: string }
  applications?: { id:string; nickname:string; institution:string; availability:string; status:string; email?:string; createdAt?:string; decisionNote?:string }[]
  invites?: { id:string; role:string; nickname?:string; status?:string; expiresAt?:string; createdAt?:string }[]
  consents?: { id:string; childId:string; guardianName?:string; relationship?:string; noticeVersion?:string; evidenceReference?:string; status?:string; recordedAt?:string }[]
  privacyRequests?: { id:string; requesterId:string; kind:string; reason?:string; status:string; createdAt?:string; resolution?:string }[]
  accounts?: { id:string; role:string; nickname:string; status:string; email?:string }[]
}
function CloudAction({run, busy, error, children}:{run:(e:FormEvent)=>void;busy:boolean;error:string;children:ReactNode}){return <form className="auth-form" onSubmit={run}>{children}{error&&<p className="field-error" role="alert">{error}</p>}<button className="btn" disabled={busy||!cloudConfigured}>{busy?'正在保存…':'确认提交'}</button></form>}
function SimpleField({id,label,value,onChange,required=true,placeholder='',type='text'}:{id:string;label:string;value:string;onChange:(s:string)=>void;required?:boolean;placeholder?:string;type?:string}){return <div className="field"><label htmlFor={id}>{label}</label><input id={id} type={type} value={value} onChange={e=>onChange(e.target.value)} required={required} placeholder={placeholder} maxLength={180}/></div>}
function useStatus(notify:(m:string)=>void,enabled=cloudConfigured){const [status,setStatus]=useState<AccountStatus>(),[error,setError]=useState(''),[loading,setLoading]=useState(false);const reload=useCallback(async()=>{if(!enabled)return;setLoading(true);setError('');try{setStatus(await cloudAccountAction('status',{}) as AccountStatus)}catch(e){setError(e instanceof Error?e.message:'暂时不能读取账号状态。')}finally{setLoading(false)}},[enabled]);useEffect(()=>{reload()},[reload]);async function act(action:string,payload:Record<string,unknown>,success:string){if(!enabled)throw new Error('此项账号处理功能暂未在试测登录中开放。');const result=await cloudAccountAction(action,payload) as Record<string,unknown>;await refreshCloud();await reload();notify(success);return result}return {status,error,loading,reload,act}}
export function AccountPage(props:PageProps&{onLogout:()=>void}){
  const {actor,notify,mode='demo',onLogout}=props;const {status,error,loading,act}=useStatus(notify,mode==='demo'&&cloudConfigured)
  const {run,busy,error:actionError}=useAction(notify);const [requestKind,setRequestKind]=useState<'export'|'delete'|'withdraw'>('export'),[reason,setReason]=useState('');const [oldPassword,setOldPassword]=useState(''),[newPassword,setNewPassword]=useState('')
  async function request(event:FormEvent){event.preventDefault();await run(async()=>{await act('privacy-request',{kind:requestKind,reason},'申请已记录，运营会按流程处理。');setReason('')})}
  async function password(event:FormEvent){event.preventDefault();await run(async()=>{await changePassword({oldPassword,newPassword});setOldPassword('');setNewPassword('');notify('密码已更新。')})}
  return <div><PageHeader eyebrow="我的" title={mode==='demo'?'我的演示身份':'我的账号'} description={mode==='demo'?'这里使用虚构身份，书信只保存在当前浏览器。':'查看自己的身份、参与状态和需要帮助的方式。'}/><div className="account-grid"><div className="stack"><section className="panel"><h2><UserRound size={19}/> 基本信息</h2><div className="account-meta"><p>称呼：<strong>{actor.nickname}</strong></p><p>身份：{({child:'小朋友',volunteer:'志愿者',teacher:'老师',operator:'运营人员'} as Record<string,string>)[actor.role]}</p><p>参与状态：{mode==='demo'?'演示身份':actor.accountStatus==='pending'?'等待审核':actor.accountStatus==='disabled'?'已暂停':'已启用'}</p>{mode==='live'&&actor.role==='volunteer'&&!actor.volunteerApproved&&<Notice>你的申请正在审核，审核完成前暂不能结对或读取孩子的信。</Notice>}</div><div className="toolbar"><button className="btn secondary" onClick={onLogout}>退出{mode==='demo'?'演示':'登录'}</button></div></section>
    {mode==='live'&&<section className="panel"><h2><KeyRound size={19}/> 修改密码</h2><CloudAction run={password} busy={busy} error={actionError}><PasswordField name="old-password" label="当前密码" value={oldPassword} onChange={setOldPassword}/><PasswordField name="new-password" label="新密码" value={newPassword} onChange={setNewPassword} autoComplete="new-password"/><p className="field-help">新密码至少 12 位。可以粘贴密码，也可以使用密码管理器。</p></CloudAction></section>}</div>
    <div className="stack"><section className="panel"><h2><HeartHandshake size={19}/> 找人帮忙</h2><p className="muted">遇到收发、登录或陪伴上的困难，可以告诉负责运营的人。这里是站内留言，不会即时回复。需要马上得到帮助时，也请告诉身边信任的大人。</p><Link className="btn secondary" to="/help">打开帮助入口<ArrowRight size={16}/></Link></section>
      {mode==='demo'&&<section className="panel"><h2><ShieldCheck size={19}/> 演示资料</h2><p className="muted">演示身份没有真实账号或监护授权记录。请勿输入真实儿童或个人敏感信息。</p></section>}
    </div></div></div>
}
export function ManageAccountsPage({actor,notify,mode='demo',state}:PageProps){
  const {status,error,loading,act,reload}=useStatus(notify,mode==='demo'&&cloudConfigured);const [tab,setTab]=useState(actor.role==='teacher'?'invite':'applications'),[token,setToken]=useState(''),[expires,setExpires]=useState('')
  const {run,busy,error:actionError}=useAction(notify)
  const [role,setRole]=useState<'child'|'teacher'|'operator'>('child'),[nickname,setNickname]=useState(''),[teacherId,setTeacherId]=useState(actor.role==='teacher'?actor.id:''),[guardianName,setGuardianName]=useState(''),[relationship,setRelationship]=useState(''),[evidenceReference,setEvidenceReference]=useState(''),[inviteEmail,setInviteEmail]=useState('')
  const [decisionNote,setDecisionNote]=useState<Record<string,string>>({}),[selectedAccount,setSelectedAccount]=useState('')
  async function invitation(event:FormEvent){event.preventDefault();await run(async()=>{const response=await act('create-invite',{role,nickname,teacherId:role==='child'?teacherId:undefined,email:role==='child'?undefined:inviteEmail,guardianConsent:role==='child'?{guardianName,relationship,noticeVersion:'v1-2026-10',evidenceReference}:undefined},'邀请已创建，请私下交付。') as {token?:string;expiresAt?:string};setToken(response.token||'');setExpires(response.expiresAt||'')})}
  async function decide(id:string,decision:'approved'|'returned'){await run(async()=>{await act('review-application',{id,decision,note:decisionNote[id]||''},decision==='approved'?'申请已通过。':'已记录修改说明。')})}
  if(mode==='demo')return <Empty title="演示中没有真实账号任务" description="演示身份只用来体验书信流程；真实邀请、申请和授权留待后续版本。"><Link className="btn" to="/space">回到当前任务</Link></Empty>
  if(mode==='live')return <Empty title="试测账号由负责人线下创建" description="V3 试测登录关闭公开注册、邀请管理和儿童账号激活。请把账号变更交给试测负责人处理。"><Link className="btn" to="/space">回到当前任务</Link></Empty>
  if(!['teacher','operator'].includes(actor.role))return <Empty title="这里由老师和运营处理" description="你可以在“我的”页面查看自己的申请与参与状态。"><Link className="btn" to="/account">回到我的账号</Link></Empty>
  return <div><PageHeader eyebrow="加入与账号" title={actor.role==='teacher'?'协助加入陪伴':'处理加入与授权'} description="每一位参与者都从合适的入口开始；处理记录留在工作台中。"><button className="btn secondary" onClick={reload} disabled={loading}>刷新记录</button></PageHeader>
    <div className="tabs management-tabs" aria-label="账号任务分类">{([['invite','创建邀请'],['applications','志愿者申请'],['consents','监护授权'],['privacy','资料申请'],['accounts','账号状态']] as const).filter(([key])=>actor.role==='operator'||key==='invite'||key==='consents'||key==='accounts').map(([key,label])=><button key={key} className={tab===key?'active':''} aria-pressed={tab===key} onClick={()=>setTab(key)}>{label}</button>)}</div>
    {error&&<p role="alert" className="field-error">{error}</p>}{loading&&<p role="status">正在读取账号任务…</p>}{actionError&&<p role="alert" className="field-error">{actionError}</p>}
    {tab==='invite'&&<div className="account-grid"><section className="panel"><h2>给参与者准备邀请</h2><p className="muted small">老师可为自己负责的孩子创建邀请。工作人员邀请只由运营发起。</p><form className="auth-form" onSubmit={invitation}><div className="field"><label htmlFor="invite-role">加入身份</label><select id="invite-role" value={role} onChange={e=>setRole(e.target.value as typeof role)}>{(actor.role==='teacher'?['child']:['child','teacher','operator']).map(r=><option key={r} value={r}>{({child:'小朋友',teacher:'老师',operator:'运营人员'} as Record<string,string>)[r]}</option>)}</select></div><SimpleField id="invite-nickname" label="显示称呼" value={nickname} onChange={setNickname} required/>
      {role==='child'?<><div className="field"><label htmlFor="invite-teacher">负责老师</label><select id="invite-teacher" value={teacherId} onChange={e=>setTeacherId(e.target.value)} required><option value="">选择老师</option>{state.people.filter(p=>p.role==='teacher').map(p=><option value={p.id} key={p.id}>{p.nickname}</option>)}</select></div><SimpleField id="guardian-name" label="授权的监护人称呼" value={guardianName} onChange={setGuardianName}/><SimpleField id="guardian-relationship" label="与孩子的关系" value={relationship} onChange={setRelationship}/><SimpleField id="consent-evidence" label="授权记录编号或存放位置" value={evidenceReference} onChange={setEvidenceReference} placeholder="填写可核对的纸质/电子授权记录编号"/><p className="field-help">请先向监护人提供参与说明，并妥善保存真实授权记录。填写编号只是记录位置，不能代替取得监护人同意。</p></>:<SimpleField id="invite-email" label="被邀请人的邮箱" value={inviteEmail} onChange={setInviteEmail} type="email"/>}
      <button className="btn" disabled={busy||!cloudConfigured}>{busy?'正在创建…':'创建一次性邀请'}</button></form></section><aside className="panel"><h2>交付与有效期</h2>{token?<div className="secret-card" role="status"><strong>请在私下渠道交给本人</strong><code>{token}</code><p>有效期：{expires?formatDate(expires):'请以系统记录为准'}。离开此页后不再展示完整邀请码。</p><button className="btn secondary" onClick={()=>{setToken('');setExpires('')}}>已经记下，隐藏邀请码</button></div>:<p className="muted">创建成功后，一次性邀请码只在此处出现。小朋友无需手机号或邮箱。</p>}</aside></div>}
    {tab==='applications'&&<section className="panel"><h2>志愿者申请</h2>{status?.applications?.length?status.applications.map(a=><article className="account-row" key={a.id}><h3>{a.nickname} <Badge>{a.status==='pending'?'待审核':a.status==='approved'?'已通过':'已退回'}</Badge></h3><p>{a.institution} · {a.availability}</p>{a.email&&<p>{a.email}</p>}{a.status==='pending'&&<><div className="field"><label htmlFor={`decision-${a.id}`}>审核说明</label><textarea id={`decision-${a.id}`} value={decisionNote[a.id]||''} onChange={e=>setDecisionNote({...decisionNote,[a.id]:e.target.value})} maxLength={1000}/></div><div className="toolbar"><button className="btn" disabled={busy} onClick={()=>decide(a.id,'approved')}>审核通过</button><button className="btn secondary" disabled={busy||!decisionNote[a.id]?.trim()} onClick={()=>decide(a.id,'returned')}>退回并说明</button></div></>}{a.decisionNote&&<p>审核说明：{a.decisionNote}</p>}</article>):<Empty title="暂时没有申请" description="志愿者验证邮箱并提交申请后，会显示在这里。"/>}</section>}
    {tab==='consents'&&<section className="panel"><h2>监护授权记录</h2>{status?.consents?.length?status.consents.map(c=><article className="account-row" key={c.id}><h3>孩子账号：{state.people.find(p=>p.id===c.childId)?.nickname||c.childId} <Badge>{c.status==='withdrawn'?'已撤回':'已记录'}</Badge></h3><p>监护人：{c.guardianName||'未填写'} · 关系：{c.relationship||'未填写'} · 说明版本：{c.noticeVersion||'未标记'}</p><p>记录编号：{c.evidenceReference||'未填写'}</p>{c.status!=='withdrawn'&&<button className="text-button danger-text" onClick={()=>{const reason=window.prompt('请输入监护人撤回授权的记录编号与处理说明');if(reason?.trim())run(()=>act('withdraw-consent',{childId:c.childId,reason},'已记录撤回并停止孩子的正式参与。'))}}>记录撤回</button>}</article>):<Empty title="还没有授权记录" description="老师取得监护授权并创建孩子邀请后，记录会显示在这里。"/>}</section>}
    {tab==='privacy'&&<section className="panel"><h2>资料处理申请</h2>{status?.privacyRequests?.length?status.privacyRequests.map(r=><article className="account-row" key={r.id}><h3>{r.kind==='export'?'查阅/导出':r.kind==='delete'?'删除资料':'撤回参与'} · {r.status==='resolved'?'已处理':'待处理'}</h3><p>申请人：{state.people.find(p=>p.id===r.requesterId)?.nickname||r.requesterId} · {r.reason||'未填写原因'}</p>{r.status!=='resolved'&&<button className="btn secondary" disabled={busy} onClick={()=>{const note=window.prompt('请记录已执行的处理结果或核对编号；尚未执行时不要标记已处理。');if(note?.trim())run(()=>act('resolve-privacy-request',{id:r.id,note},'处理结果已记录。'))}}>记录处理结果</button>}</article>):<Empty title="暂时没有资料申请" description="用户提出查阅、撤回或删除申请后，会在这里处理。"/>}</section>}
    {tab==='accounts'&&<section className="panel"><h2>账号与协助</h2>{status?.accounts?.length?status.accounts.map(a=><article className="account-row" key={a.id}><h3>{a.nickname} · {({child:'小朋友',volunteer:'志愿者',teacher:'老师',operator:'运营'} as Record<string,string>)[a.role]||a.role} <Badge>{a.status==='active'?'启用中':'已停用'}</Badge></h3>{a.role==='child'&&actor.role==='teacher'&&<button className="btn secondary" disabled={busy} onClick={()=>{if(!window.confirm(`为${a.nickname}重置登录卡？旧密码会失效。`))return;run(async()=>{const result=await act('reset-child-password',{childId:a.id},'已生成新的登录卡。') as {temporaryPassword?:string};setSelectedAccount(`${a.nickname}：${result.temporaryPassword||'请查看服务端记录'}`)})}}>重置孩子登录卡</button>}{actor.role==='operator'&&a.id!==actor.id&&<button className="btn secondary" disabled={busy} onClick={()=>{const reason=window.prompt(`记录${a.status==='active'?'暂停':'恢复'} ${a.nickname} 账号的原因`);if(reason?.trim())run(()=>act('set-account-status',{id:a.id,status:a.status==='active'?'disabled':'active',reason},'账号状态已更新。'))}}>{a.status==='active'?'暂停账号':'恢复账号'}</button>}</article>):<Empty title="没有可处理的账号" description="正式账号加入后，在这里协助处理。"/>}{selectedAccount&&<div className="secret-card" role="status"><p>请只通过私下渠道交给孩子或负责老师：</p><code>{selectedAccount}</code><button className="text-button" onClick={()=>setSelectedAccount('')}>隐藏登录卡</button></div>}</section>}
  </div>
}
export function HelpPage({state,actor,notify=()=>{},mode='demo'}:Partial<PageProps>){
  const [body,setBody]=useState(''),[submitted,setSubmitted]=useState(false)
  const [reportedParty,setReportedParty]=useState<''|'volunteer'|'teacher'|'operator'|'other'>('')
  const [reportedPersonId,setReportedPersonId]=useState(''),[pairId,setPairId]=useState('')
  const {run,busy,error}=useAction(notify)
  const roleHome = actor?.role === 'volunteer' ? '陪伴任务' : actor?.role === 'teacher' ? '收发任务' : actor?.role === 'operator' ? '待处理' : '信箱'
  const relatedPairs = state?.pairs.filter(pair => actor && [pair.childId,pair.volunteerId,pair.teacherId].includes(actor.id)) ?? []
  const relevantPersonIds = new Set(relatedPairs.filter(pair=>!pairId||pair.id===pairId).map(pair => reportedParty === 'volunteer' ? pair.volunteerId : pair.teacherId))
  const relevantPeople = (reportedParty === 'volunteer' || reportedParty === 'teacher')
    ? state?.people.filter(person => person.role === reportedParty && relevantPersonIds.has(person.id) && person.id !== actor?.id) ?? []
    : []
  async function submit(event:FormEvent){
    event.preventDefault()
    if(!actor || actor.role==='operator' || !reportedParty || reportedParty==='operator')return
    const ok=await run(async()=>{
      await dispatch(actor.id,{type:'help',pairId:pairId||undefined,reportedParty,reportedPersonId:reportedPersonId||undefined,body})
      setBody('')
    },mode==='demo'?'演示求助已保存在当前浏览器，不会通知真实工作人员。':'求助已记录在成年合成试测数据中，供有权限的试测账号查看。')
    if(ok)setSubmitted(true)
  }
  return <div className="container public-page">
    <BackLink fallbackTo={actor ? '/space' : '/choose'} fallbackLabel={actor ? `返回${roleHome}` : '返回身份入口'}/>
    <PageHeader eyebrow="找人帮忙" title="有困难时，可以说出来。" description={mode==='demo'?'这里只体验合成数据的求助流程，不会通知真实工作人员。':'这里供成年参与者用合成身份试测求助流程，不提供正式儿童保护服务。'}/>
    {submitted&&<Notice>{mode==='demo'?<>演示求助已保存在当前浏览器，可切换运营演示身份查看；不会通知真实工作人员。 <Link className="text-button" to="/demo/start/operator">切换演示身份</Link></>:'求助已记录在成年合成账号试测数据中，等待有保护权限的试测账号查看。这里不是实时求助渠道。'}</Notice>}
    <div className="account-grid"><section className="panel stack">
      <h2><HeartHandshake size={20}/> 说明遇到的问题</h2>
      {actor?.role==='operator'?<Notice>运营人员需要通过独立于本账号的现实渠道反映问题；此处不受理运营账号的站内求助。</Notice>:actor?<form className="auth-form" onSubmit={submit}>
        <div className="field"><label htmlFor="help-party">这件事主要与谁有关？</label><select id="help-party" value={reportedParty} required onChange={event=>{setReportedParty(event.target.value as typeof reportedParty);setReportedPersonId('');setPairId('');setSubmitted(false)}}>
          <option value="" disabled>请先选择</option><option value="volunteer">书信伙伴</option><option value="teacher">协助老师</option><option value="operator">运营人员</option><option value="other">其他事情／暂时不方便说</option>
        </select><p className="field-help">选择仅用于把求助交给合适的人，不会自动分享给被反映的人。</p></div>
        {reportedParty==='operator'?<Notice tone="warning">当前成年合成试测没有可核实的独立运营投诉接手人，请勿在这里填写涉及运营人员的敏感内容。请在现实中联系学校指定负责人或项目负责人；若涉及正在发生的危险，及时向当地有关部门求助。真实试点开放前必须公布独立联系人和替补。</Notice>:reportedParty&&<>
          {relevantPeople.length>0&&<div className="field"><label htmlFor="help-person">涉及哪位人员？（可不选）</label><select id="help-person" value={reportedPersonId} onChange={event=>setReportedPersonId(event.target.value)}><option value="">不确定或不方便选择</option>{relevantPeople.map(person=><option value={person.id} key={person.id}>{person.nickname}</option>)}</select></div>}
          {relatedPairs.length>0&&<div className="field"><label htmlFor="help-pair">与哪组书信有关？（可不选）</label><select id="help-pair" value={pairId} onChange={event=>{setPairId(event.target.value);setReportedPersonId('')}}><option value="">不指定结对</option>{relatedPairs.map(pair=><option value={pair.id} key={pair.id}>{state?.people.find(person=>person.id===pair.childId)?.nickname??'小朋友'} ↔ {state?.people.find(person=>person.id===pair.volunteerId)?.nickname??'志愿者'}</option>)}</select></div>}
          <div className="field"><label htmlFor="help-body">想说的话</label><textarea id="help-body" value={body} onChange={event=>setBody(event.target.value)} required minLength={2} maxLength={2000} placeholder="可以从“我希望得到什么帮助”写起。"/></div>
          <button className="btn" disabled={busy||body.trim().length<2}>{busy?'正在提交…':mode==='demo'?'提交演示求助':'提交试测求助'}</button>{error&&<p role="alert" className="field-error">{error}</p>}
        </>}
      </form>:<p>如果无法登录，请在现实中联系负责老师或试测负责人。需要马上获得帮助时，请告诉身边信任的大人。</p>}
    </section><aside className="panel"><h2>求助会怎样处理？</h2><ol className="journey"><li><span>1</span><p>{mode==='demo'?'演示求助只存于当前浏览器，切换演示身份可查看。':'站内求助仅供成年合成账号试测，按保护权限限制读取。'}</p></li><li><span>2</span><p>这里不是即时聊天，也没有已公布的正式值守时间；提交成功只代表记录已保存。</p></li><li><span>3</span><p>需要及时保护时，直接联系现实中信任的成年人或有权部门。</p></li></ol></aside></div>
  </div>
}
export function PrivacyPage(){return <div className="container public-page"><PageHeader eyebrow="隐私说明" title="认真保护每一封信。" description="当前仅供成年人使用合成身份和内容演示，正式儿童试点尚未开放。"/><div className="panel stack" style={{maxWidth:800,margin:'0 auto'}}>
  <Notice>{cloudConfigured?'当前 V3 站点使用预置的成年合成试测账号；书信和操作记录经云端服务保存在试测数据库，由有权限的试测账号共享。':'当前 V2 演示使用虚构身份；书信和操作记录保存在此浏览器。'} 请勿输入真实儿童的姓名、联系方式、照片或私人信件。</Notice>
  <section><h2>两个演示环境的数据范围</h2><p>V2 Demo 在当前浏览器保存合成数据；V3 成年账号试测使用独立的 Cloudflare Pages Functions 与 D1 数据库。两者不共用业务数据。云端试测并不表示可以处理真实儿童资料。</p></section>
  <section><h2>真实儿童试点前须确认</h2><p>学校与平台需明确数据处理责任、监护告知与儿童意愿、人员的最小访问范围、保存和删除期限、独立求助渠道及云服务数据流向。儿童纸信的拍摄、识别和例行审阅还需由合作学校与法律专业人员确认合法路径；当前未开放手写图片和 OCR。</p></section>
  <section><h2>参与者的选择</h2><p>正式试点应提供资料查阅、撤回和删除申请，并在参与前说明每种资料的用途与可见人员。公开故事仅使用虚构内容。</p></section>
  <Notice>本页说明现有演示与待办事项。项目尚未公布正式儿童试点的负责人联系方式、值守时段、资料保存期限和监护告知材料。</Notice><Link className="btn secondary" to="/">回到身份入口</Link></div></div>}
