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

const roleHome = (role: string) => ({child: '信箱', volunteer: '陪伴任务', teacher: '收发任务', operator: '待处理'}[role] || '任务页')
const activePair = (state: PageProps['state'], actor: PageProps['actor']) => state.pairs.find(p => p.status !== 'ended' && (p.childId === actor.id || p.volunteerId === actor.id))

export function HelpPanel({state, actor, notify, mode = 'demo'}: PageProps) {
  const [opened, setOpened] = useState(false), [body, setBody] = useState('')
  const { run, busy, error } = useAction(notify)
  const pair = activePair(state, actor)
  return <section className="help-panel"><button type="button" className="help-button" onClick={() => setOpened(!opened)} aria-expanded={opened}><HeartHandshake size={20}/><span>找人帮忙</span><ArrowRight size={16}/></button>{opened && <form className="panel stack" onSubmit={async e => {e.preventDefault(); if (!body.trim()) return; if (await run(() => dispatch(actor.id, {type:'help', pairId: pair?.id, body}), mode === 'demo' ? '演示求助已保存，运营演示身份可以查看。' : '求助已提交，负责运营会在值守时段查看。')) {setBody(''); setOpened(false)}}}><label htmlFor="help-message">有什么想告诉负责运营的人？</label><textarea id="help-message" value={body} onChange={e => setBody(e.target.value)} rows={4} maxLength={2000} required/><p className="muted small">这段话交给有求助处理权限的运营人员，不会自动分享给你的伙伴或老师。{mode === 'demo' ? '当前为本地演示，不会通知真实工作人员。' : '这里并非即时聊天，值守安排请查看“我的”页面。'}需要马上得到帮助时，也请告诉身边信任的大人。</p>{error && <p className="field-error" role="alert">{error}</p>}<button className="btn" disabled={busy || !body.trim()}>{busy ? '正在提交…' : '提交求助'}</button></form>}</section>
}

export function ChildPage(props: PageProps) {
  const {state, actor} = props
  const pair = activePair(state, actor)
  const partner = state.people.find(person => person.id === pair?.volunteerId)
  const letters = visibleLetters(state, actor)
  const own = letters.filter(letter => letter.authorId === actor.id && (!letter.pairId || letter.pairId === pair?.id))
  const incoming = letters.filter(letter => letter.authorId !== actor.id)
  const returned = own.find(letter => letter.moderation === 'returned')
  const draft = own.find(letter => letter.moderation === 'draft')
  const unread = incoming.find(letter => !state.deliveries.find(delivery => delivery.letterId === letter.id)?.readAt)
  const pending = own.find(letter => letter.moderation === 'pending')
  const write = returned
    ? {title: '这封信，可以接着改一改。', description: '你的原文还在。看看修改建议，再按自己的想法写下去。', label: '修改这封信', to: `/write/${returned.id}`}
    : draft
      ? {title: '上次写到这里，接着来吧。', description: '草稿保存在这个浏览器里，可以从停下的地方继续。', label: '接着写', to: `/write/${draft.id}`}
      : !pair
        ? {title: '先写几句，介绍自己吧。', description: '等结对后再由你确认寄出。现在写下的内容只会保存在这个浏览器里。', label: '写一封信', to: '/write'}
        : {title: '今天，有什么想分享的小事？', description: '一句问好、一件小发现，都可以写给伙伴。', label: '写一封信', to: '/write'}
  return <div className="v2-child-home">
    <PageHeader eyebrow="信箱" title={`欢迎回来，${actor.nickname}。`} description="有话想说可以写信，收到的信也在这里。" />
    <section className="next-letter-card v2-write-first" aria-label="开始写信">
      <div className="next-letter-copy">
        <p className="eyebrow">先做这一件事</p>
        <h2>{write.title}</h2>
        <p>{write.description}</p>
        <Link className="btn" to={write.to}><Feather size={19}/>{write.label}<ArrowRight size={18}/></Link>
        {pair?.status === 'paused' && <p className="v2-quiet-note">陪伴暂停中，写下的信可以先存草稿，恢复后再寄出。</p>}
      </div>
      <img src="/images/letter-garden.webp" alt="" aria-hidden="true" />
    </section>
    {unread && <section className="v2-arrival-card" aria-label="未读来信">
      <span className="v2-arrival-icon"><Mail size={25} strokeWidth={1.5}/></span>
      <div><p className="eyebrow">还有一封新来信</p><h2>{unread.title}</h2><p>{state.people.find(person => person.id === unread.authorId)?.nickname || '书信伙伴'}写给你的话，等你有空时慢慢读。</p></div>
      <Link className="btn secondary" to={`/letters/${unread.id}`}>打开来信<ArrowRight size={16}/></Link>
    </section>}
    {!unread && pending && <section className="v2-status-card" aria-label="信件进度">
      <Mail size={19}/><p>你写的《{pending.title}》正在等待运营审核，通过后才会送给伙伴。</p><Link className="text-button" to={`/letters/${pending.id}`}>查看进度<ArrowRight size={16}/></Link>
    </section>}
    <Link className="v2-history-link" to="/correspondence"><span><strong>看看我们的信</strong><small>{partner ? `和${partner.nickname}的来信、回信与草稿都在这里。` : '写过的自我介绍会在这里。'}</small></span><ArrowRight size={18}/></Link>
  </div>
}

type TaskLink = { label: string; detail: string; to: string; sourceTitle?: string }

function taskFromGroup(state: PageProps['state'], group: ReturnType<typeof groupedResponseTasks>[number]): TaskLink {
  const awaiting = group.tasks.filter(task => task.status === 'awaiting')
  const reviewLetter = group.tasks.map(task => state.letters.find(letter => letter.id === task.reviewLetterId)).find(Boolean)
  const replyTo = group.letterIds[0]
  if (!awaiting.length) return {label: '回应正在审核', detail: '运营审核完成前，暂时不需要重复寄出。', to: reviewLetter ? `/letters/${reviewLetter.id}` : '/correspondence'}
  if (replyTo) return {label: '回应伙伴的来信', detail: `${formatDate(group.dueAt)} 前安排时间。读过信后，认真写下你的回应。`, to: `/write?pair=${group.pairId}&replyTo=${replyTo}`, sourceTitle: state.letters.find(letter => letter.id === replyTo)?.title}
  return {label: '写第一封信', detail: `${formatDate(group.dueAt)} 前发出第一封信，先从一声问好开始。`, to: '/write'}
}

export function VolunteerPage(props: PageProps) {
  const {state, actor} = props
  const pair = activePair(state, actor)
  const child = state.people.find(person => person.id === pair?.childId)
  const letters = visibleLetters(state, actor)
  const drafts = letters.filter(letter => letter.authorId === actor.id && (!letter.pairId || letter.pairId === pair?.id) && ['draft', 'returned'].includes(letter.moderation))
  const returned = drafts.find(letter => letter.moderation === 'returned')
  const draft = drafts.find(letter => letter.moderation === 'draft')
  const groups = groupedResponseTasks(state, actor.id).filter(group => group.pairId === pair?.id)
  const due = groups.find(group => group.status === 'awaiting')
  const review = groups.find(group => group.status === 'review')
  const chosenGroup = !returned && due ? due : !returned && !draft && review ? review : undefined
  const chosenDraft = returned || (!due ? draft : undefined)
  const priority: TaskLink = !pair
    ? {label: '查看加入进度', detail: '结对后会在这里看到第一封信的任务。', to: '/account'}
    : returned
      ? {label: '修改后重新提交', detail: '审核意见已附在原稿上，修改后还需要再次提交审核。', to: `/write/${returned.id}`, sourceTitle: returned.title}
      : due
        ? taskFromGroup(state, due)
        : draft
          ? {label: '接着写草稿', detail: '从上次停下的地方继续，写好后再检查并提交。', to: `/write/${draft.id}`, sourceTitle: draft.title}
          : review
            ? taskFromGroup(state, review)
            : {label: '写一封信', detail: pair.status === 'paused' ? '可以先保存草稿，恢复后再提交。' : '没有待回应来信，也可以主动分享一件小事。', to: '/write'}
  const otherDrafts: TaskLink[] = drafts.filter(letter => letter.id !== chosenDraft?.id).map(letter => ({
    label: letter.moderation === 'returned' ? '修改这封信' : '接着写草稿',
    detail: letter.title,
    to: `/write/${letter.id}`,
  }))
  const otherGroups: TaskLink[] = groups.filter(group => group !== chosenGroup).map(group => taskFromGroup(state, group))
  const otherTasks = [...otherDrafts, ...otherGroups].filter(task => task.to !== priority.to).slice(0, 3)
  return <div className="v2-volunteer-home">
    <PageHeader eyebrow="陪伴任务" title={`${actor.nickname}，这次先做什么？`} description="先完成眼前这一步，再继续下一封信。">
      {pair && <Link className="btn secondary" to="/write"><Plus size={17}/>写一封信</Link>}
    </PageHeader>
    <section className="v2-priority-card" aria-label="当前最需要处理的事">
      <p className="eyebrow">现在先做这件事</p>
      <h2>{priority.label}</h2>
      <p>{priority.detail}</p>
      <Link className="task-action v2-task-primary" to={priority.to}><Feather size={19}/><span><strong>{priority.label}</strong>{priority.sourceTitle && <small>{priority.sourceTitle}</small>}</span><ArrowRight size={17}/></Link>
    </section>
    {pair?.status === 'paused' && <Notice>这段陪伴暂停中：{pair.pauseReason}。可以写和保存草稿，恢复后再提交审核。</Notice>}
    {otherTasks.length > 0 && <section className="v2-secondary-tasks" aria-label="其余待办"><h2 className="section-title">稍后还可以处理</h2>{otherTasks.map((task, index) => <Link className="task-action" key={`${task.to}-${index}`} to={task.to}><Mail size={18}/><span><strong>{task.label}</strong><small>{task.sourceTitle || task.detail}</small></span><ArrowRight size={16}/></Link>)}</section>}
    {pair && <section className="v2-partner-summary"><Avatar person={child} large/><div><p className="eyebrow">我的书信伙伴</p><h2>{child?.nickname || '等待遇见'}</h2><p>{pair.channel === 'paper' ? '由老师协助纸质收发' : '通过线上信箱往来'} · {pair.status === 'paused' ? '陪伴暂停中' : '陪伴进行中'}</p></div></section>}
    <Link className="v2-history-link" to="/correspondence"><span><strong>查看书信往来</strong><small>来信、已写的信和草稿都在这里。</small></span><ArrowRight size={18}/></Link>
  </div>
}

export function CorrespondencePage(props: PageProps) {
  const {state, actor} = props
  if (!['child', 'volunteer'].includes(actor.role)) return <Empty title="这里是书信伙伴的往来记录" description="请回到自己的任务页面。"><Link className="btn secondary" to="/space">返回任务</Link></Empty>
  const letters = visibleLetters(state, actor)
  const received = letters.filter(letter => letter.authorId !== actor.id)
  const written = letters.filter(letter => letter.authorId === actor.id)
  return <div className="v2-correspondence-page">
    <PageHeader eyebrow="书信往来" title="我们的信，都在这里。" description="收到的信、写过的信和没写完的草稿，按最近的时间排列。"><Link className="btn secondary" to="/write"><Feather size={17}/>写一封信</Link></PageHeader>
    <section className="v2-correspondence-group" aria-label="收到的信"><div className="v2-section-heading"><h2>收到的信</h2><span>{received.length} 封</span></div>
      {received.length ? <div className="panel">{received.map(letter => <LetterRow key={letter.id} {...props} letter={letter}/>)}</div> : <Empty title="还没有收到来信" description="信件审核并送达后，会出现在这里。"/>}
    </section>
    <section className="v2-correspondence-group" aria-label="我写的信"><div className="v2-section-heading"><h2>我写的信</h2><span>{written.length} 封</span></div>
      {written.length ? <div className="panel">{written.map(letter => <LetterRow key={letter.id} {...props} letter={letter}/>)}</div> : <Empty title="还没有写过的信" description="你可以从一句问好开始。"><Link className="btn secondary" to="/write">写一封信</Link></Empty>}
    </section>
  </div>
}
export function LetterRow({state, actor, letter}: PageProps & {letter: Letter}) {
  const editable = letter.authorId === actor.id && (!letter.pairId || state.pairs.find(pair => pair.id === letter.pairId)?.status !== 'ended') && ['draft','returned'].includes(letter.moderation)
  const author = state.people.find(p => p.id === letter.authorId)
  return <Link className="letter-row" to={editable ? `/write/${letter.id}` : `/letters/${letter.id}`}><span className="letter-row-icon"><Mail size={21} strokeWidth={1.5}/></span><div className="letter-row-text"><h3>{letter.title || '一封还在慢慢写的信'}</h3><span className="muted small">{author?.nickname} · {formatDate(letter.updatedAt)}{letter.replyTo ? ' · 回信' : ''}</span></div><LetterBadge state={state} letter={letter}/><ArrowRight size={17} className="row-arrow"/></Link>
}

export function LetterDetail(props: PageProps) {
  const {state, actor, notify} = props
  const {id} = useParams()
  const [query] = useSearchParams()
  const {run, error, busy} = useAction(notify)
  const letter = state.letters.find(item => item.id === id)
  const readable = letter && canReadLetter(state, actor, letter)
  const delivery = state.deliveries.find(item => item.letterId === id)
  useEffect(() => {
    if (readable && letter.authorId !== actor.id && ['child', 'volunteer'].includes(actor.role) && delivery?.deliveredAt && !delivery.readAt) {
      void run(() => dispatch(actor.id, {type: 'read', id: letter.id}))
    }
  }, [id, readable, actor.id, delivery?.readAt])
  const back = ['child', 'volunteer'].includes(actor.role) ? '/correspondence' : '/space'
  if (!letter || !readable) return <Empty title="这封信暂时不能打开" description="可能还在等待审核，或当前身份没有阅读权限。"><Link to={back} className="btn secondary">返回{back === '/space' ? roleHome(actor.role) : '书信往来'}</Link></Empty>
  const pair = state.pairs.find(item => item.id === letter.pairId)
  const task = state.tasks.find(item => item.letterId === id)
  const own = letter.authorId === actor.id
  const canReply = !!pair && ['child', 'volunteer'].includes(actor.role) && recipientForLetter(state, letter) === actor.id && !!delivery?.deliveredAt && pair.status !== 'ended'
  const reply = state.letters.find(item => item.replyTo === id && item.authorId === actor.id && ['draft', 'returned'].includes(item.moderation))
  const sentReply = state.letters.find(item => item.replyTo === id && item.authorId === actor.id && ['pending', 'approved'].includes(item.moderation))
  const submitted = query.get('submitted') === '1' && own && letter.moderation === 'pending'
  const status = letter.moderation === 'draft' ? '这封信还在草稿中。'
    : letter.moderation === 'returned' ? '这封信需要修改，原文和审核建议都已保留。'
    : letter.moderation === 'pending' ? '这封信正在等待运营审核，通过后才会安排送达。'
    : delivery?.readAt ? '这封信已打开阅读。'
    : delivery?.deliveredAt ? '这封信已送达，等待伙伴打开阅读。'
    : pair?.status === 'paused' ? '信件已通过审核，陪伴恢复后再安排投递。'
    : delivery?.printedAt ? '信件已打印，等待老师确认实际交付。'
    : pair?.channel === 'paper' ? '信件已通过审核，等待老师打印。' : '信件已通过审核，等待送达。'
  return <div className="v2-letter-detail">
    <div className="toolbar between reading-top">
      <Link className="back-link" to={back}><ArrowLeft size={16}/>返回{back === '/space' ? roleHome(actor.role) : '书信往来'}</Link>
      {canReply && !sentReply && <Link className="btn" to={reply ? `/write/${reply.id}` : `/write?pair=${pair!.id}&replyTo=${id}`}><Feather size={18}/>{reply ? '接着写回信' : '给 TA 回信'}</Link>}
    </div>
    {submitted && <section className="v2-submission-confirmation" role="status"><CheckCircle2 size={24}/><div><h2>已提交审核</h2><p>这封信已经交给运营演示身份审核。通过后才会送达伙伴；你可以回到任务页，稍后再查看进度。</p><Link className="text-button" to="/space">回到{roleHome(actor.role)}<ArrowRight size={16}/></Link></div></section>}
    {letter.moderation === 'returned' && <Notice tone="warning">修改建议：{letter.moderationNote}{own && pair?.status !== 'ended' && <Link className="text-button" to={`/write/${id}`}>继续修改<ArrowRight size={15}/></Link>}</Notice>}
    {letter.moderation === 'pending' && !submitted && <Notice>这封信正在等待审核。通过后才会送往下一站。</Notice>}
    <div className="reading-grid">
      <div className="v2-paper-column"><LetterPaper state={state} letter={letter}/>{canReply && !sentReply && <Link className="btn v2-reply-after-paper" to={reply ? `/write/${reply.id}` : `/write?pair=${pair!.id}&replyTo=${id}`}><Feather size={18}/>{reply ? '接着写回信' : '给 TA 回信'}</Link>}{sentReply && <Notice>你写的回应{sentReply.moderation === 'pending' ? '正在等待运营审核' : '已经通过审核'}，这封来信不会重复催办。</Notice>}</div>
      <aside className="stack v2-reading-aside">
        <section className="panel v2-progress-summary"><h2 className="section-title">这封信现在到哪了</h2><p>{status}</p>{delivery?.readAt && <p className="small muted">已打开阅读：{formatDate(delivery.readAt)}</p>}
          <details className="v2-progress-details"><summary>查看每一步</summary><ol className="timeline">
            <li className="done"><CheckCircle2 size={17}/><div><strong>认真写下</strong><span>{formatDate(letter.createdAt)}</span></div></li>
            <li className={letter.moderation === 'approved' ? 'done' : ''}><CheckCircle2 size={17}/><div><strong>{letter.moderation === 'approved' ? '已通过审核' : letter.moderation === 'pending' ? '正在等待审核' : letter.moderation === 'returned' ? '需要修改' : '还在草稿中'}</strong></div></li>
            {pair?.channel === 'paper' && <li className={delivery?.printedAt ? 'done' : ''}><Mail size={17}/><div><strong>{delivery?.printedAt ? '已打印' : '等待老师打印'}</strong></div></li>}
            <li className={delivery?.deliveredAt ? 'done' : ''}><Mail size={17}/><div><strong>{delivery?.deliveredAt ? '已送达' : pair?.status === 'paused' ? '暂停中，等待恢复后投递' : '等待送达'}</strong>{delivery?.deliveredAt && <span>{formatDate(delivery.deliveredAt)}</span>}</div></li>
            <li className={delivery?.readAt ? 'done' : ''}><Leaf size={17}/><div><strong>{delivery?.readAt ? '已打开阅读' : '尚无打开阅读记录'}</strong></div></li>
          </ol></details>
        </section>
        {task && <section className="partner-panel"><Clock3 size={21}/><h3>{task.status === 'completed' ? '已经收到回应' : task.status === 'review' ? '回应正在审核' : '给回应留一点时间'}</h3><p className="small">{task.status === 'awaiting' ? `约定 ${formatDate(task.dueAt)} 前回应，可以先存草稿，下次接着写。` : task.status === 'review' ? '已提交审核，暂时不需要重复寄出。' : '谢谢你，把日常认真地写进信里。'}</p>{pair?.status === 'paused' && <Badge tone="warning">暂停期间不催办</Badge>}{isOverdue(state, task) && actor.role !== 'child' && <Badge tone="warning">需要了解近况</Badge>}</section>}
        {error && <p className="field-error" role="alert">{error}<button disabled={busy} onClick={() => run(() => dispatch(actor.id, {type: 'read', id: letter.id}))}>重试</button></p>}
      </aside>
    </div>
  </div>
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

function Editor({state, actor, notify, setDirty, pair, existing, original, initialRiddle, mode = 'demo'}: PageProps & {setDirty:(dirty:boolean) => void; pair?:Pair; existing?:Letter; original?:Letter; initialRiddle:string}) {
  const navigate = useNavigate()
  const {run, busy, error} = useAction(notify)
  const idRef = useRef(existing?.id || crypto.randomUUID())
  const persistedRef = useRef(!!existing)
  const revisionRef = useRef(existing?.revision ?? 0)
  const previewDialog = useRef<HTMLDialogElement>(null)
  const [savedRouteId, setSavedRouteId] = useState('')
  const [saved, setSaved] = useState(existing?.updatedAt || '')
  const [file, setFile] = useState<File>()
  const [fileError, setFileError] = useState('')
  const [autoError, setAutoError] = useState('')
  const [preview, setPreview] = useState<Fields>()
  const [removeAttachment, setRemoveAttachment] = useState(false)
  const defaults = {title: existing?.title || '', body: existing?.body || '', riddleId: existing?.riddleId || (riddles.some(riddle => riddle.id === initialRiddle) ? initialRiddle : '')}
  const baseline = useRef(JSON.stringify(defaults))
  const covered = useRef(existing?.coveredLetterIds?.length ? existing.coveredLetterIds : groupedResponseTasks(state, actor.id).filter(group => group.pairId === pair?.id).flatMap(group => group.tasks.filter(task => task.status === 'awaiting').map(task => task.letterId)).filter(Boolean))
  const {register, watch, handleSubmit, setValue, setError, formState:{errors}} = useForm<Fields>({resolver:zodResolver(letterSchema), defaultValues:defaults, mode:'onBlur'})
  const values = watch()
  const signature = JSON.stringify(values)
  const edited = signature !== baseline.current || !!file || removeAttachment
  const recipient = state.people.find(person => person.id === (actor.role === 'volunteer' ? pair?.childId : pair?.volunteerId))
  const savedAttachment = state.letters.find(letter => letter.id === idRef.current)?.attachmentId || existing?.attachmentId
  const hasAttachment = !!file || !!savedAttachment && !removeAttachment
  const currentFileRef = useRef(file)
  currentFileRef.current = file

  useEffect(() => {setDirty(edited); return () => setDirty(false)}, [edited, setDirty])
  useEffect(() => {if (preview && previewDialog.current && !previewDialog.current.open) previewDialog.current.showModal()}, [preview])
  useEffect(() => {
    if (savedRouteId && !busy && !edited && !preview && state.letters.some(letter => letter.id === savedRouteId)) {
      navigate(`/write/${savedRouteId}`, {replace:true})
    }
  }, [savedRouteId, busy, edited, preview, state.letters, navigate])

  const titleFor = (data:Fields) => data.title.trim() || (original ? `给${recipient?.nickname || '伙伴'}的回信` : pair ? `${actor.nickname}的小小分享` : `${actor.nickname}的自我介绍`)
  async function persist(data:Fields, submit = false, automatic = false) {
    if (fileError) return false
    const selectedFile = file
    const okay = await run(async () => {
      const changed = !persistedRef.current || !!existing && existing.pairId !== (pair?.id || '') || JSON.stringify(data) !== baseline.current || !!selectedFile || removeAttachment
      if (changed) {
        const id = await dispatch(actor.id, {type:'save-letter', id:idRef.current, pairId:pair?.id || '', replyTo:original?.id, title:titleFor(data), body:data.body, riddleId:data.riddleId || undefined, file:selectedFile, removeAttachment, expectedRevision:revisionRef.current})
        idRef.current = id
        persistedRef.current = true
        revisionRef.current += 1
        baseline.current = JSON.stringify(data)
        setSaved(state.clock)
        setAutoError('')
        setRemoveAttachment(false)
        if (currentFileRef.current === selectedFile) setFile(undefined)
        if (!existing && !submit) {
          window.history.replaceState(window.history.state, '', `#/write/${encodeURIComponent(id)}`)
          setSavedRouteId(id)
        }
      }
      if (submit) await dispatch(actor.id, {type:'submit-letter', id:idRef.current, coveredLetterIds:covered.current})
    }, automatic ? undefined : submit ? '已提交审核，通过后才会送达伙伴。' : '草稿已保存到此浏览器。')
    if (okay && submit) {
      previewDialog.current?.close()
      setPreview(undefined)
      setDirty(false)
      navigate(`/letters/${idRef.current}?submitted=1`, {replace:true})
    }
    return okay
  }
  useEffect(() => {
    if (!edited || busy || preview || fileError || autoError) return
    const timer = window.setTimeout(() => {
      void persist(values, false, true).then(okay => {
        if (!okay) setAutoError('自动保存没有完成。文字还在编辑区，请点击“保存草稿”重试。')
      })
    }, 1800)
    return () => clearTimeout(timer)
  }, [signature, file, removeAttachment, busy, preview, fileError, autoError])
  function inspect(data:Fields) {
    if (!data.body.trim() && !hasAttachment) {
      setError('body', {message:'写一句想说的话，或附上一张手写图片，就可以寄出了。'})
      return
    }
    if (fileError) return
    setPreview(data)
  }
  const pendingPreview:Letter = {id:'preview', pairId:pair?.id || '', authorId:actor.id, createdBy:actor.id, createdAt:state.clock, updatedAt:state.clock, title:preview ? titleFor(preview) : '', body:preview?.body || '', riddleId:preview?.riddleId || undefined, attachmentId:removeAttachment ? undefined : savedAttachment, moderation:'draft'}
  const back = original ? `/letters/${original.id}` : existing ? '/correspondence' : '/space'
  const saveMessage = busy ? '正在保存到此浏览器…' : error || autoError ? '还没保存成功' : edited ? '有未保存的修改' : saved ? '已保存到此浏览器' : '开始写后会自动保存'
  return <div className="v2-compose-page">
    <Link className="back-link" to={back}><ArrowLeft size={16}/>返回{original ? '上一封信' : existing ? '书信往来' : roleHome(actor.role)}</Link>
    <PageHeader eyebrow={original ? '写一封回信' : '写一封信'} title={existing?.moderation === 'returned' ? '把这封信接着写好。' : '想说什么，就从这里开始。'} description="可以只写几句。写完后先检查，再提交给运营审核。" />
    <div className="v2-compose-recipient"><Mail size={18}/><span>{recipient ? `写给 ${recipient.nickname}` : '写给未来的书信伙伴'}</span><small>{pair ? pair.channel === 'paper' ? '老师协助纸质收发' : '线上信箱' : '结对后再确认寄出'}</small></div>
    {existing?.moderation === 'returned' && <Notice tone="warning"><strong>审核建议：</strong>{existing.moderationNote} 原文还在，可以修改后重新提交。</Notice>}
    {pair?.status === 'paused' && <Notice>陪伴暂停中，可以写和保存草稿；恢复后再提交审核。</Notice>}
    <form className="v2-compose-form" onSubmit={handleSubmit(inspect)} aria-busy={busy}>
      <section className="panel compose-panel">
        <div className="field"><label htmlFor="letter-body">想说的话</label><textarea id="letter-body" rows={9} placeholder={`${recipient?.nickname || '未来的伙伴'}，你好：\n\n最近有件小事，我想和你分享……`} aria-invalid={!!errors.body} aria-describedby="body-help body-error" {...register('body')}/><div className="toolbar between"><p id="body-help" className="field-help">可以只写几句。不要填写详细住址或私人联系方式。</p><span className="small muted">{Array.from(values.body || '').length} / 6000</span></div>{errors.body && <p id="body-error" className="field-error" role="alert">{errors.body.message}</p>}</div>
        {original && <details className="v2-previous-letter"><summary>看看上一封信：{original.title}</summary><p>{original.body}</p>{covered.current.length > 1 && <p className="muted small">这次回应包含开始写信时收到的 {covered.current.length} 封待回应来信。新来信会另外保留待办。</p>}</details>}
        <details className="v2-topic-options"><summary>还没想好？看看话题提示 <span className="muted small">选用也可以跳过</span></summary><div className="topic-prompts">{['最近开心的一件小事', '窗边看到的小发现', '想问伙伴的一个问题'].map(topic => <button type="button" key={topic} onClick={() => setValue('body', `${values.body}${values.body ? '\n\n' : ''}${topic}：`, {shouldDirty:true})}>{topic}</button>)}</div></details>
        <details className="letter-options"><summary>信的名字、谜语和手写图片 <span className="muted small">都可以不选</span></summary><div className="stack">
          <div className="field"><label htmlFor="letter-title">信的名字（不填也可以）</label><input id="letter-title" placeholder={titleFor({...values, title:''})} aria-invalid={!!errors.title} {...register('title')}/>{errors.title && <p className="field-error" role="alert">{errors.title.message}</p>}</div>
          <div className="field"><label htmlFor="letter-riddle">附上一道小谜语</label><select id="letter-riddle" {...register('riddleId')}><option value="">这次先聊聊天</option>{riddles.map(riddle => <option key={riddle.id} value={riddle.id}>{riddle.question}</option>)}</select></div>
          <div className="field"><label htmlFor="letter-file">附上手写信或小画</label><input id="letter-file" type="file" accept="image/png,image/jpeg" onChange={event => {const next = event.target.files?.[0]; if (next && (!['image/png', 'image/jpeg'].includes(next.type) || next.size > 3 * 1024 * 1024)) {setFileError('请选择不超过 3 MiB 的 PNG 或 JPG 图片。'); setFile(undefined); return} setFile(next); setFileError(''); setRemoveAttachment(false)}}/><p className="field-help">PNG / JPG，最多 3 MiB。{mode === 'demo' ? '演示中请只选合成图片。' : '只附上信纸或小画，不上传个人照片和私人资料。'}</p>{file && <p className="small">已选择：{file.name}</p>}{savedAttachment && !file && <label className="checkbox-row"><input type="checkbox" checked={removeAttachment} onChange={event => setRemoveAttachment(event.target.checked)}/>移除已保存的图片</label>}{fileError && <p className="field-error" role="alert">{fileError}</p>}</div>
        </div></details>
        {values.riddleId && <p className="selected-riddle"><Leaf size={16}/>已选谜语：{riddles.find(riddle => riddle.id === values.riddleId)?.question}</p>}
      </section>
      {(error || autoError) && <div className="notice error" role="alert">{error || autoError}<p>输入仍在编辑区。若提示其他设备有修改，请先复制自己的内容，再重新打开这封信查看最新版本。</p></div>}
      <div className="commit-bar"><div className="save-state" role="status"><Save size={15}/>{saveMessage}</div><div className="toolbar"><button className="btn secondary" type="button" disabled={busy || !!fileError} onClick={() => void persist(values)}><Save size={16}/>保存草稿</button><button className="btn" type="submit" disabled={busy || !pair || pair.status !== 'active' || !!fileError}><Send size={16}/>检查并寄出</button></div></div>
      {!pair && <p className="muted small">还没结对，暂时不能寄出。草稿只保存在当前浏览器。</p>}
    </form>
    <dialog ref={previewDialog} className="confirm-dialog letter-preview-dialog" onCancel={() => setPreview(undefined)} aria-labelledby="preview-title"><div className="dialog-content"><div className="toolbar between"><h2 id="preview-title">寄出前，再看一眼</h2><button type="button" aria-label="关闭预览" onClick={() => {previewDialog.current?.close(); setPreview(undefined)}}><X size={22}/></button></div><p>写给{recipient?.nickname}。提交后进入运营审核，通过后才会送达。</p>{preview && <LetterPaper state={state} letter={pendingPreview}/>}<SelectedImage file={file}/>{error && <p role="alert" className="field-error">{error}</p>}<div className="toolbar"><button type="button" className="btn secondary" disabled={busy} onClick={() => {previewDialog.current?.close(); setPreview(undefined)}}>再改一改</button><button type="button" className="btn" disabled={busy} onClick={() => preview && void persist(preview, true)}><Send size={17}/>{busy ? '正在提交…' : '提交审核'}</button></div></div></dialog>
  </div>
}function SelectedImage({file}:{file?:File}) {
  const [url,setUrl] = useState('')
  useEffect(() => {if (!file) {setUrl('');return}const next = URL.createObjectURL(file);setUrl(next);return () => URL.revokeObjectURL(next)},[file])
  return url ? <figure className="attachment"><img src={url} alt="即将提交的手写图片"/><figcaption>{file?.name}</figcaption></figure> : null
}
