import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, Feather, HeartHandshake, Leaf, Mail, Plus, Save, Send, X } from 'lucide-react'
import { canReadLetter, dispatch, formatDate, isOverdue, riddles, visibleLetters, groupedResponseTasks, recipientForLetter } from '../data'
import { Avatar, Badge, Empty, LetterBadge, LetterPaper, Notice, PageHeader, useAction, type PageProps } from '../ui'
import type { Letter, Pair } from '../types'
import './WorkflowV1.css'

const roleHome = (role: string) => ({child: '我的信箱', volunteer: '陪伴任务', teacher: '收发任务', operator: '运营任务'}[role] || '我的首页')
const activePair = (state: PageProps['state'], actor: PageProps['actor']) => state.pairs.find(p => p.status !== 'ended' && (p.childId === actor.id || p.volunteerId === actor.id))

export function HelpPanel({state, actor, notify, mode = 'demo'}: PageProps) {
  const [opened, setOpened] = useState(false), [body, setBody] = useState('')
  const { run, busy, error } = useAction(notify)
  const pair = activePair(state, actor)
  return <section className="help-panel"><button type="button" className="help-button" onClick={() => setOpened(!opened)} aria-expanded={opened}><HeartHandshake size={20}/><span>找人帮忙</span><ArrowRight size={16}/></button>{opened && <form className="panel stack" onSubmit={async e => {e.preventDefault(); if (!body.trim()) return; if (await run(() => dispatch(actor.id, {type:'help', pairId: pair?.id, body}), mode === 'demo' ? '演示求助已保存，运营演示身份可以查看。' : '求助已提交，负责运营会在值守时段查看。')) {setBody(''); setOpened(false)}}}><label htmlFor="help-message">有什么想告诉负责运营的人？</label><textarea id="help-message" value={body} onChange={e => setBody(e.target.value)} rows={4} maxLength={2000} required/><p className="muted small">这段话交给有求助处理权限的运营人员，不会自动分享给你的伙伴或老师。{mode === 'demo' ? '当前为本地演示，不会通知真实工作人员。' : '这里并非即时聊天，值守安排请查看“我的”页面。'}需要马上得到帮助时，也请告诉身边信任的大人。</p>{error && <p className="field-error" role="alert">{error}</p>}<button className="btn" disabled={busy || !body.trim()}>{busy ? '正在提交…' : '提交求助'}</button></form>}</section>
}

export function ChildPage(props: PageProps) {
  const {state, actor} = props
  const [tab, setTab] = useState('inbox')
  const pair = activePair(state, actor), partner = state.people.find(p => p.id === pair?.volunteerId)
  const letters = visibleLetters(state, actor)
  const incoming = letters.filter(l => l.authorId !== actor.id)
  const outgoing = letters.filter(l => l.authorId === actor.id)
  const writable = outgoing.filter(letter => !letter.pairId || letter.pairId === pair?.id)
  const returned = writable.find(l => l.moderation === 'returned')
  const draft = writable.find(l => l.moderation === 'draft')
  const unread = incoming.find(l => l.pairId === pair?.id && !state.deliveries.find(d => d.letterId === l.id)?.readAt)
  const awaiting = groupedResponseTasks(state, actor.id).find(g => g.tasks.some(t => t.status === 'awaiting'))
  const pending = writable.find(l => l.moderation === 'pending')
  const next = returned ? {title:'有一封信，可以接着改一改。', description:'运营伙伴留下了具体建议，你想说的话还在。', label:'接着改一改', to:`/write/${returned.id}`}
    : draft ? {title:'上次的小故事，还等着你。', description:'写到哪里都没关系，我们从那里接着写。', label:'接着写', to:`/write/${draft.id}`}
    : unread ? {title:'有一封新来信，写给你。', description:`${state.people.find(p => p.id === unread.authorId)?.nickname || '你的伙伴'}想和你分享一些小发现。`, label:'打开来信', to:`/letters/${unread.id}`}
    : awaiting?.letterIds[0] ? {title:'想把你的近况，也告诉 TA 吗？', description:'一句问好、一件小事，都可以成为回应。', label:'给 TA 回信', to:`/write?pair=${awaiting.pairId}&replyTo=${awaiting.letterIds[0]}`}
    : !pair ? {title:'先写一句，介绍自己吧。', description:'我们会认真安排一位伙伴。自我介绍会先保存，结对后由你确认寄出。', label:'写一封自我介绍', to:'/write'}
    : pending ? {title:'你的信正在等待审核。', description:'审核通过后会送往下一站。还有新发现，也可以再写一封。', label:'看看信的进度', to:`/letters/${pending.id}`}
    : {title: outgoing.length ? '今天，有什么想分享的小事？' : '我们的故事，从一声问好开始。', description:'不用想一个很大的故事，想说什么，就慢慢写下来。', label: outgoing.length ? '写一封信' : '写第一封信', to:'/write'}
  return <><PageHeader eyebrow="我的信箱" title={`${actor.nickname}，见字如面。`} description="读一封信，也把自己的小发现寄出去。"><Link className="btn secondary" to="/write"><Feather size={18}/>写一封信</Link></PageHeader>
    {pair?.status === 'paused' && <Notice>这段陪伴正在暂停：{pair.pauseReason}。你仍可以写草稿、读以前的信，也可以找人帮忙；恢复后再寄出。</Notice>}
    <section className="next-letter-card" aria-label="现在可以做什么"><div className="next-letter-copy"><p className="eyebrow">现在，可以从这里开始</p><h2>{next.title}</h2><p>{next.description}</p><Link className="btn" to={next.to}><Mail size={18}/>{next.label}<ArrowRight size={18}/></Link>{unread && next.to !== `/letters/${unread.id}` && <Link className="text-button" to={`/letters/${unread.id}`}>还有一封未读来信<ArrowRight size={16}/></Link>}</div><img src="/images/letter-garden.webp" alt="" aria-hidden="true"/></section>
    <div className="child-grid"><div className="stack"><div className="tabs" aria-label="信件分类">{[['inbox','收到的信'],['outbox','我写的信']].map(([key,label]) => <button key={key} className={tab === key ? 'active' : ''} aria-pressed={tab === key} onClick={() => setTab(key)}>{label}<span>{key === 'inbox' ? incoming.length : outgoing.length}</span></button>)}</div>
    {(tab === 'inbox' ? incoming : outgoing).length ? <section className="panel" aria-label={tab === 'inbox' ? '收到的信' : '我写的信'}>{(tab === 'inbox' ? incoming : outgoing).map(l => <LetterRow key={l.id} {...props} letter={l}/>)}</section> : <Empty title={tab === 'inbox' ? '信箱准备好了' : '把第一句问好，留在这里'} description={tab === 'inbox' ? '来信送达后，会出现在这里。你也可以主动写一封信。' : '不必等到收到来信，你也可以分享今天的心情。'}><Link className="btn secondary" to="/write"><Feather size={17}/>写一封信</Link></Empty>}</div>
    <aside className="stack child-aside"><section className="partner-panel"><div className="toolbar"><Avatar person={partner} large/><div><p className="muted small">我的书信伙伴</p><h2>{partner?.nickname || '等待遇见'}</h2></div></div><p>{partner ? '窗边的一片新叶，也值得写进信里。' : '等伙伴到来之前，可以先写下你的自我介绍。'}</p><div className="hairline"/><p className="small">{partner?.interests.join(' · ') || '好奇 · 分享 · 慢慢认识'}</p></section><HelpPanel {...props}/><Link className="text-button" to="/riddles"><Leaf size={17}/>去谜语小屋逛逛<ArrowRight size={16}/></Link></aside></div></>
}

function VolunteerTask({state, group}:{state:PageProps['state']; group:ReturnType<typeof groupedResponseTasks>[number]}) {
  const awaiting = group.tasks.filter(task => task.status === 'awaiting')
  const reviewing = !awaiting.length
  const reviewedLetter = group.tasks.map(task => state.letters.find(letter => letter.id === task.reviewLetterId)).find(Boolean)
  const firstIncoming = awaiting.find(task => task.letterId)?.letterId
  const target = reviewing ? reviewedLetter ? `/letters/${reviewedLetter.id}` : undefined : firstIncoming ? `/write?pair=${group.pairId}&replyTo=${firstIncoming}` : '/write'
  const content = <><Mail size={19}/><span><strong>{reviewing ? '回应正在审核' : firstIncoming ? `回应伙伴的 ${awaiting.filter(task => task.letterId).length} 封来信` : '给伙伴写第一封信'}</strong><small>{reviewing ? '审核期间不催办。打开已提交的信可查看进度。' : `${formatDate(group.dueAt)} 前安排时间，遇到困难可以求助。`}</small></span>{target && <ArrowRight size={16}/>}</>
  return target ? <Link className="task-action" to={target}>{content}</Link> : <div className="task-action">{content}</div>
}

export function VolunteerPage(props: PageProps) {
  const {state,actor} = props, [filter,setFilter] = useState('all')
  const pair = activePair(state, actor), child = state.people.find(p => p.id === pair?.childId)
  const letters = visibleLetters(state,actor), drafts = letters.filter(l => l.authorId === actor.id && (!l.pairId || l.pairId === pair?.id) && ['draft','returned'].includes(l.moderation))
  const groups = groupedResponseTasks(state, actor.id).filter(g => g.tasks.some(t => t.status !== 'completed'))
  const filtered = letters.filter(l => filter === 'all' || filter === 'draft' && drafts.some(draft => draft.id === l.id) || filter === 'inbox' && l.authorId !== actor.id)
  return <><PageHeader eyebrow="陪伴任务" title={`${actor.nickname}，今天想聊些什么？`} description="先看看伙伴说了什么，再认真回应。"><Link className="btn" to="/write"><Plus size={17}/>写一封信</Link></PageHeader><div className="volunteer-overview"><section className="partner-panel"><p className="eyebrow">这一段书信陪伴</p>{pair ? <><div className="toolbar"><Avatar person={child} large/><div><h2>{child?.nickname}</h2><p className="muted">{pair.channel === 'online' ? '线上信箱' : '老师协助纸质收发'}</p></div><Badge tone={pair.status === 'active' ? 'success' : 'warning'}>{pair.status === 'active' ? '陪伴进行中' : '暂停中'}</Badge></div><p>喜欢 {child?.interests.join('、') || '慢慢分享日常'}。从对方上次提到的一件小事开始聊吧。</p>{pair.status === 'paused' && <Notice>{pair.pauseReason}。可以先写草稿，恢复后寄出。</Notice>}</> : <Empty title="先完成加入，再认识伙伴" description="请在“我的”中查看申请进度。审核通过后，运营会安排结对。"><Link className="text-button" to="/account">查看加入进度<ArrowRight size={16}/></Link></Empty>}</section><section className="panel stack"><h2 className="section-title">现在需要我做什么</h2>{drafts.slice(0,2).map(l => <Link className="task-action" key={l.id} to={`/write/${l.id}`}><Feather size={19}/><span><strong>{l.moderation === 'returned' ? '修改后重新提交' : '接着写草稿'}</strong><small>{l.title}</small></span><ArrowRight size={16}/></Link>)}{groups.map(g => <VolunteerTask key={g.pairId} state={state} group={g}/>)}{!drafts.length && !groups.length && <p className="muted">{pair ? '当前没有待回应事项。也可以主动分享最近的小发现。' : '审核及结对进度会在账号页面更新。'}</p>}</section></div><section className="panel correspondence"><h2 className="section-title">我们的书信往来</h2><div className="tabs" aria-label="往来筛选">{[['all','全部往来'],['draft','草稿与修改'],['inbox','收到的信']].map(([key,label]) => <button key={key} className={filter === key ? 'active' : ''} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div>{filtered.length ? filtered.map(l => <LetterRow key={l.id} {...props} letter={l}/>) : <Empty title="这里还没有书信" description="不妨从一句问好、一道谜语开始。"/>}</section><HelpPanel {...props}/><div className="writing-note"><Feather size={22}/><p>认真回应就很好。私人联系方式、详细住址和个人照片，请留在信件之外。</p></div></>
}

export function LetterRow({state, actor, letter}: PageProps & {letter: Letter}) {
  const editable = letter.authorId === actor.id && (!letter.pairId || state.pairs.find(pair => pair.id === letter.pairId)?.status !== 'ended') && ['draft','returned'].includes(letter.moderation)
  const author = state.people.find(p => p.id === letter.authorId)
  return <Link className="letter-row" to={editable ? `/write/${letter.id}` : `/letters/${letter.id}`}><span className="letter-row-icon"><Mail size={21} strokeWidth={1.5}/></span><div className="letter-row-text"><h3>{letter.title || '一封还在慢慢写的信'}</h3><span className="muted small">{author?.nickname} · {formatDate(letter.updatedAt)}{letter.replyTo ? ' · 回信' : ''}</span></div><LetterBadge state={state} letter={letter}/><ArrowRight size={17} className="row-arrow"/></Link>
}

export function LetterDetail(props: PageProps) {
  const {state,actor,notify} = props, {id} = useParams(), {run,error,busy} = useAction(notify)
  const letter = state.letters.find(l => l.id === id), readable = letter && canReadLetter(state,actor,letter)
  const delivery = state.deliveries.find(d => d.letterId === id)
  useEffect(() => {if (readable && letter.authorId !== actor.id && ['child','volunteer'].includes(actor.role) && delivery?.deliveredAt && !delivery.readAt) void run(() => dispatch(actor.id,{type:'read',id:letter.id}))},[id,readable,actor.id,delivery?.readAt])
  if (!letter || !readable) return <Empty title="这封信暂时不能打开" description="可能还在等待审核，或当前账号没有阅读权限。"><Link to="/space" className="btn secondary">返回{roleHome(actor.role)}</Link></Empty>
  const pair = state.pairs.find(p => p.id === letter.pairId), task = state.tasks.find(t => t.letterId === id)
  const canReply = pair && ['child','volunteer'].includes(actor.role) && recipientForLetter(state,letter) === actor.id && !!delivery?.deliveredAt && pair.status !== 'ended'
  const reply = state.letters.find(l => l.replyTo === id && l.authorId === actor.id && ['draft','returned'].includes(l.moderation))
  return <><div className="toolbar between reading-top"><Link className="back-link" to="/space"><ArrowLeft size={16}/>回到{roleHome(actor.role)}</Link>{canReply && <Link className="btn" to={reply ? `/write/${reply.id}` : `/write?pair=${pair.id}&replyTo=${id}`}><Feather size={18}/>{reply ? '接着写回信' : '给 TA 回信'}</Link>}</div><div className="reading-grid"><div className="stack">{letter.moderation === 'pending' && <Notice><strong>这封信正在等待审核。</strong> 通过后才会送往下一站。</Notice>}{letter.moderation === 'returned' && <Notice tone="warning">修改建议：{letter.moderationNote}{letter.authorId === actor.id && pair?.status !== 'ended' && <Link className="text-button" to={`/write/${id}`}>继续修改<ArrowRight size={15}/></Link>}</Notice>}<LetterPaper state={state} letter={letter}/></div><aside className="stack"><section className="panel"><h2 className="section-title">这封信的小旅程</h2><ol className="timeline"><li className="done"><CheckCircle2 size={17}/><div><strong>认真写下</strong><span>{formatDate(letter.createdAt)}</span></div></li><li className={letter.moderation === 'approved' ? 'done' : ''}><CheckCircle2 size={17}/><div><strong>{letter.moderation === 'approved' ? '已通过审核' : letter.moderation === 'pending' ? '正在等待审核' : letter.moderation === 'returned' ? '需要修改' : '还在草稿中'}</strong></div></li>{pair?.channel === 'paper' && <li className={delivery?.printedAt ? 'done' : ''}><Mail size={17}/><div><strong>{delivery?.printedAt ? '已打印' : '等待老师打印'}</strong></div></li>}<li className={delivery?.deliveredAt ? 'done' : ''}><Mail size={17}/><div><strong>{delivery?.deliveredAt ? '已送达' : pair?.status === 'paused' ? '暂停中，等待恢复后投递' : '等待送达'}</strong>{delivery?.deliveredAt && <span>{formatDate(delivery.deliveredAt)}</span>}</div></li><li className={delivery?.readAt ? 'done' : ''}><Leaf size={17}/><div><strong>{delivery?.readAt ? '已打开阅读' : '尚无打开阅读记录'}</strong></div></li></ol></section>{task && <section className="partner-panel"><Clock3 size={21}/><h3>{task.status === 'completed' ? '已经收到回应' : task.status === 'review' ? '回应正在审核' : '给回应留一点时间'}</h3><p className="small">{task.status === 'awaiting' ? `约定 ${formatDate(task.dueAt)} 前回应，可以先存草稿，下次接着写。` : task.status === 'review' ? '已提交审核，暂时不需要重复寄出。' : '谢谢你，把日常认真地写进信里。'}</p>{pair?.status === 'paused' && <Badge tone="warning">暂停期间不催办</Badge>}{isOverdue(state,task) && actor.role !== 'child' && <Badge tone="warning">需要了解近况</Badge>}</section>}{error && <p className="field-error" role="alert">{error}<button disabled={busy} onClick={() => run(() => dispatch(actor.id,{type:'read',id:letter.id}))}>重试</button></p>}</aside></div></>
}

const letterSchema = z.object({title:z.string().max(60,'标题请控制在 60 字以内。'),body:z.string().max(6000,'这封信有些长，请控制在 6000 字以内。'),riddleId:z.string()})
type Fields = z.infer<typeof letterSchema>
export function ComposePage(props: PageProps & {setDirty:(dirty:boolean) => void}) {
  const {state,actor} = props, {id} = useParams(), [query] = useSearchParams()
  const existing = id ? state.letters.find(l => l.id === id) : undefined
  const pairId = existing?.pairId || query.get('pair') || activePair(state,actor)?.id || ''
  const pair = state.pairs.find(p => p.id === pairId)
  const replyId = existing?.replyTo || query.get('replyTo') || undefined
  const original = replyId ? state.letters.find(l => l.id === replyId) : undefined
  const validOriginal = original && pair && original.pairId === pair.id && recipientForLetter(state,original) === actor.id && original.moderation === 'approved' && state.deliveries.some(d => d.letterId === original.id && d.deliveredAt) && canReadLetter(state,actor,original)
  const denied = !['child','volunteer'].includes(actor.role) || (pair && pair.childId !== actor.id && pair.volunteerId !== actor.id) || pair?.status === 'ended' || !!pairId && !pair || existing && (existing.authorId !== actor.id || !['draft','returned'].includes(existing.moderation)) || id && !existing || replyId && !validOriginal
  if (denied) return <Empty title="现在还不能写这封信" description="请从自己的信箱选择伙伴或已送达的来信。"><Link className="btn secondary" to="/space">返回{roleHome(actor.role)}</Link></Empty>
  return <Editor key={`${actor.id}-${id || 'new'}-${replyId || ''}`} {...props} pair={pair} existing={existing} original={original} initialRiddle={query.get('riddle') || query.get('riddleId') || ''}/>
}

function Editor({state,actor,notify,setDirty,pair,existing,original,initialRiddle,mode = 'demo'}: PageProps & {setDirty:(d:boolean) => void; pair?:Pair; existing?:Letter; original?:Letter; initialRiddle:string}) {
  const navigate = useNavigate(), {run,busy,error} = useAction(notify), idRef = useRef(existing?.id || crypto.randomUUID())
  const persistedRef = useRef(!!existing)
  const revisionRef = useRef(existing?.revision ?? 0), previewDialog = useRef<HTMLDialogElement>(null)
  const [savedRouteId,setSavedRouteId] = useState('')
  const [saved,setSaved] = useState(existing?.updatedAt || ''), [file,setFile] = useState<File>(), [fileError,setFileError] = useState(''), [autoError,setAutoError] = useState(''), [preview,setPreview] = useState<Fields>()
  const [removeAttachment,setRemoveAttachment] = useState(false)
  const defaults = {title:existing?.title || '', body:existing?.body || '', riddleId:existing?.riddleId || (riddles.some(r => r.id === initialRiddle) ? initialRiddle : '')}
  const baseline = useRef(JSON.stringify(defaults)), covered = useRef(existing?.coveredLetterIds?.length ? existing.coveredLetterIds : groupedResponseTasks(state,actor.id).filter(g => g.pairId === pair?.id).flatMap(g => g.tasks.filter(t => t.status === 'awaiting').map(t => t.letterId)).filter(Boolean))
  const {register,watch,handleSubmit,setValue,setError,formState:{errors}} = useForm<Fields>({resolver:zodResolver(letterSchema),defaultValues:defaults,mode:'onBlur'})
  const values = watch(), signature = JSON.stringify(values), edited = signature !== baseline.current || !!file || removeAttachment
  const recipient = state.people.find(p => p.id === (actor.role === 'volunteer' ? pair?.childId : pair?.volunteerId))
  const savedAttachment = state.letters.find(l => l.id === idRef.current)?.attachmentId || existing?.attachmentId
  const hasAttachment = !!file || !!savedAttachment && !removeAttachment
  const currentFileRef = useRef(file); currentFileRef.current = file
  useEffect(() => {setDirty(edited);return () => setDirty(false)},[edited,setDirty])
  useEffect(() => {if (preview && previewDialog.current && !previewDialog.current.open) previewDialog.current.showModal()},[preview])
  useEffect(() => {if (savedRouteId && !busy && !edited && !preview && state.letters.some(letter => letter.id === savedRouteId)) navigate(`/write/${savedRouteId}`,{replace:true})},[savedRouteId,busy,edited,preview,state.letters,navigate])
  const titleFor = (data:Fields) => data.title.trim() || (original ? `给${recipient?.nickname || '伙伴'}的回信` : pair ? `${actor.nickname}的小小分享` : `${actor.nickname}的自我介绍`)
  async function persist(data:Fields,submit = false,automatic = false) {
    if (fileError) return false
    const selectedFile = file
    const okay = await run(async () => {
      const changed = !persistedRef.current || !!existing && existing.pairId !== (pair?.id || '') || JSON.stringify(data) !== baseline.current || !!selectedFile || removeAttachment
      if (changed) {
        const id = await dispatch(actor.id,{type:'save-letter',id:idRef.current,pairId:pair?.id || '',replyTo:original?.id,title:titleFor(data),body:data.body,riddleId:data.riddleId || undefined,file:selectedFile,removeAttachment,expectedRevision:revisionRef.current})
        idRef.current = id; persistedRef.current = true; revisionRef.current += 1; baseline.current = JSON.stringify(data); setSaved(state.clock); setAutoError(''); setRemoveAttachment(false)
        if (currentFileRef.current === selectedFile) setFile(undefined)
        if (!existing && !submit) {
          // Secure a reloadable URL immediately; let the router remount only after the saved snapshot is visible.
          window.history.replaceState(window.history.state,'',`#/write/${encodeURIComponent(id)}`)
          setSavedRouteId(id)
        }
      }
      if (submit) await dispatch(actor.id,{type:'submit-letter',id:idRef.current,coveredLetterIds:covered.current})
    }, automatic ? undefined : submit ? '已提交审核，通过后才会送往下一站。' : mode === 'demo' ? '草稿已保存在当前浏览器。' : '草稿已保存，可以换设备接着写。')
    if (okay && submit) {previewDialog.current?.close();setPreview(undefined);navigate(`/letters/${idRef.current}`)}
    return okay
  }
  useEffect(() => {if (!edited || busy || preview || fileError || autoError) return;const timer = window.setTimeout(() => {void persist(values,false,true).then(ok => {if (!ok) setAutoError('自动保存未完成，输入仍在，请点击“保存草稿”重试。')})},1800);return () => clearTimeout(timer)},[signature,file,removeAttachment,busy,preview,fileError,autoError])
  function inspect(data:Fields) {if (!data.body.trim() && !hasAttachment) {setError('body',{message:'写一句想说的话，或附上一张手写图片，就可以寄出了。'});return} if (fileError) return;setPreview(data)}
  const pendingPreview:Letter = {id:'preview',pairId:pair?.id || '',authorId:actor.id,createdBy:actor.id,title:preview ? titleFor(preview) : '',body:preview?.body || '',riddleId:preview?.riddleId || undefined,attachmentId:removeAttachment ? undefined : savedAttachment,moderation:'draft',createdAt:state.clock,updatedAt:state.clock}
  return <><Link className="back-link" to="/space"><ArrowLeft size={16}/>回到{roleHome(actor.role)}</Link><PageHeader eyebrow={pair ? `写给${recipient?.nickname || '我的伙伴'}` : '先写给未来的伙伴'} title={original ? '把你的日常，也说给我听。' : '今天，有什么小事值得分享？'} description={pair ? '不用写得完美，一句真诚的分享就很好。' : '这封信会先保存为自我介绍，结对后由你确认寄出。'}/>{pair?.status === 'paused' && <Notice>陪伴暂停中，可以写和保存草稿；恢复后再寄出。</Notice>}
    <form className="compose-grid v1-compose" onSubmit={handleSubmit(inspect)} aria-busy={busy}><div className="stack"><section className="panel compose-panel">{existing?.moderation === 'returned' && <Notice tone="warning">修改建议：{existing.moderationNote}</Notice>}<div className="field"><label htmlFor="letter-body">想说的话</label><textarea id="letter-body" rows={12} placeholder={`${recipient?.nickname || '未来的伙伴'}，你好：\n\n最近有件小事，我想和你分享……`} aria-invalid={!!errors.body} aria-describedby="body-help body-error" {...register('body')}/><div className="toolbar between"><p id="body-help" className="field-help">可以只写几句。不要填写详细住址、私人联系方式。</p><span className="small muted">{Array.from(values.body || '').length} / 6000</span></div>{errors.body && <p id="body-error" className="field-error">{errors.body.message}</p>}</div><div className="topic-prompts" aria-label="可选话题"><span className="small muted">还没想好？可以聊聊：</span>{['最近开心的一件小事','窗边看到的小发现','想问伙伴的一个问题'].map(topic => <button type="button" key={topic} onClick={() => setValue('body',`${values.body}${values.body ? '\n\n' : ''}${topic}：`,{shouldDirty:true})}>{topic}</button>)}</div><details className="letter-options"><summary>信的名字、谜语和手写图片 <span className="muted small">选填</span></summary><div className="stack"><div className="field"><label htmlFor="letter-title">信的名字（不填也可以）</label><input id="letter-title" placeholder={titleFor({...values,title:''})} aria-invalid={!!errors.title} {...register('title')}/>{errors.title && <p className="field-error">{errors.title.message}</p>}</div><div className="field"><label htmlFor="letter-riddle">附上一道小谜语</label><select id="letter-riddle" {...register('riddleId')}><option value="">这次先聊聊天</option>{riddles.map(r => <option key={r.id} value={r.id}>{r.question}</option>)}</select></div><div className="field"><label htmlFor="letter-file">附上手写信或小画</label><input id="letter-file" type="file" accept="image/png,image/jpeg" onChange={e => {const next = e.target.files?.[0];if (next && (!['image/png','image/jpeg'].includes(next.type) || next.size > 3 * 1024 * 1024)) {setFileError('请选择不超过 3 MiB 的 PNG 或 JPG 图片。');setFile(undefined);return}setFile(next);setFileError('');setRemoveAttachment(false)}}/><p className="field-help">PNG / JPG，最多 3 MiB。{mode === 'demo' ? '演示中只上传合成图片。' : '只附上信纸或小画，不上传个人照片和私人资料。'}</p>{file && <p className="small">已选择：{file.name}</p>}{savedAttachment && !file && <label className="checkbox-row"><input type="checkbox" checked={removeAttachment} onChange={e => setRemoveAttachment(e.target.checked)}/>移除已保存的图片</label>}{fileError && <p className="field-error" role="alert">{fileError}</p>}</div></div></details>{values.riddleId && <p className="selected-riddle"><Leaf size={16}/>已选谜语：{riddles.find(r => r.id === values.riddleId)?.question}</p>}</section>{(error || autoError) && <div className="notice error" role="alert">{error || autoError}<p>输入仍在编辑区。若提示其他设备有修改，请先复制自己的内容，再重新打开这封信查看最新版本。</p></div>}<div className="commit-bar"><div className="save-state" role="status"><Save size={15}/>{busy ? '正在保存…' : edited ? '有未保存的修改' : saved ? '草稿已保存' : '开始写后会自动保存'}</div><div className="toolbar"><button className="btn secondary" type="button" disabled={busy || !!fileError} onClick={() => void persist(values)}><Save size={16}/>保存草稿</button><button className="btn" type="submit" disabled={busy || !pair || pair.status !== 'active' || !!fileError}><Send size={16}/>检查并寄出</button></div></div>{!pair && <p className="muted small">还没结对，暂时不能寄出。你写下的内容会作为草稿保留。</p>}</div><aside className="stack compose-aside">{original ? <section className="previous-letter"><p className="eyebrow">上次聊到这里</p><h2>{original.title}</h2><p>{original.body}</p>{covered.current.length > 1 && <p className="muted small">这次回应包含你开始写信时收到的 {covered.current.length} 封待回应来信。新收到的信会另外保留待办。</p>}</section> : <section className="partner-panel"><Avatar person={recipient} large/><h2>{recipient ? `写给${recipient.nickname}` : '先介绍一下自己吧'}</h2><p>{recipient ? '可以接着上次的话题，也可以分享一本书、一片叶子或今天的天气。' : '你喜欢什么？最近在做什么？选一件愿意分享的事情就好。'}</p></section>}<section className="writing-tips"><Feather size={23}/><h3>想说多少，都可以慢慢来。</h3><p>不比较，不追问。信件经过审核后，才会送给你的伙伴。</p></section></aside></form>
    <dialog ref={previewDialog} className="confirm-dialog letter-preview-dialog" onCancel={() => setPreview(undefined)} aria-labelledby="preview-title"><div className="dialog-content"><div className="toolbar between"><h2 id="preview-title">寄出前，再看一眼</h2><button type="button" aria-label="关闭预览" onClick={() => {previewDialog.current?.close();setPreview(undefined)}}><X size={22}/></button></div><p>写给{recipient?.nickname}。提交后进入审核，通过后才会送达。</p>{preview && <LetterPaper state={state} letter={pendingPreview}/>}<SelectedImage file={file}/>{error && <p role="alert" className="field-error">{error}</p>}<div className="toolbar"><button type="button" className="btn secondary" disabled={busy} onClick={() => {previewDialog.current?.close();setPreview(undefined)}}>再改一改</button><button type="button" className="btn" disabled={busy} onClick={() => preview && void persist(preview,true)}><Send size={17}/>{busy ? '正在提交…' : '确认提交审核'}</button></div></div></dialog></>
}
function SelectedImage({file}:{file?:File}) {
  const [url,setUrl] = useState('')
  useEffect(() => {if (!file) {setUrl('');return}const next = URL.createObjectURL(file);setUrl(next);return () => URL.revokeObjectURL(next)},[file])
  return url ? <figure className="attachment"><img src={url} alt="即将提交的手写图片"/><figcaption>{file?.name}</figcaption></figure> : null
}
