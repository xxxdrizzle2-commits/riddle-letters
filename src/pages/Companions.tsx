/* finesse · register=product · A=paper+postal-green · B=Chinese-sans+Songti · C=private-pair-workflow · D=CSS-feedback · E=correspondence · SOUL=7 SPECTACLE=2 DENSITY=4 */
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, CheckCircle2, Clock3, Feather, HeartHandshake, Leaf, Mail, Plus, Save, Send, X } from 'lucide-react'
import { canReadLetter, dispatch, formatDate, isOverdue, riddles, visibleLetters, groupedResponseTasks, recipientForLetter } from '../data'
import { Avatar, BackLink, Badge, ContextLink, Empty, LetterBadge, LetterPaper, Notice, PageHeader, useAction, type PageProps } from '../ui'
import { cloudConfigured, cloudLetter } from '../services/cloud'
import { trainingFor } from '../policy'
import type { Letter, Pair } from '../types'
import { TRAINING_VERSION } from '../types'
import './WorkflowV1.css'

const roleHome = (role: string) => ({child: '信箱', volunteer: '陪伴任务', teacher: '收发任务', operator: '待处理'}[role] || '任务页')
const roleNextPath = (role: string, mode: 'demo' | 'live') => mode === 'demo' ? `/demo/start/${role}` : `/login/${role}`
const roleNextAction = (role: string, mode: 'demo' | 'live') => mode === 'demo' ? `切换到${({child:'小朋友',volunteer:'志愿者',teacher:'老师',operator:'运营人员'} as Record<string,string>)[role]}演示身份继续` : `请${({child:'小朋友',volunteer:'志愿者',teacher:'老师',operator:'运营人员'} as Record<string,string>)[role]}成人测试者登录继续`
const activePairs = (state: PageProps['state'], actor: PageProps['actor']) => state.pairs.filter(p => p.status !== 'ended' && (p.childId === actor.id || p.volunteerId === actor.id))
const partnerFor = (state: PageProps['state'], pairId: string, actorId: string) => {
  const pair = state.pairs.find(item => item.id === pairId)
  return state.people.find(person => person.id === (pair?.childId === actorId ? pair?.volunteerId : pair?.childId))
}
const routeFor = (state: PageProps['state'], letter: Letter): 'online'|'school-paper' => {
  if (letter.deliveryRoute) return letter.deliveryRoute
  const pair = state.pairs.find(item => item.id === letter.pairId)
  return pair?.channel === 'paper' && recipientForLetter(state, letter) === pair.childId ? 'school-paper' : 'online'
}

export function HelpPanel() {
  return <section className="help-panel"><Link className="help-button" to="/help"><HeartHandshake size={20} aria-hidden="true"/><span>找人帮忙</span><ArrowRight size={16} aria-hidden="true"/></Link><p className="muted small-text">求助不用先选择书信伙伴，也可以反映老师或运营人员。</p></section>
}

export function ChildPage(props: PageProps) {
  const {state, actor, mode = 'demo'} = props
  const pairs = activePairs(state, actor)
  const letters = visibleLetters(state, actor)
  const own = letters.filter(letter => letter.authorId === actor.id)
  const incoming = letters.filter(letter => letter.authorId !== actor.id)
  const returned = own.find(letter => letter.moderation === 'returned')
  const draft = own.find(letter => letter.moderation === 'draft')
  const unread = incoming.find(letter => !state.deliveries.find(delivery => delivery.letterId === letter.id)?.readAt)
  const pending = own.find(letter => letter.moderation === 'pending')
  const write = returned
    ? {title: '这封信，可以接着改一改。', description: '你的原文还在。看看修改建议，再按自己的想法写下去。', label: '修改这封信', to: `/write/${returned.id}`}
    : draft
      ? {title: '上次写到这里，接着来吧。', description: mode === 'demo' ? '草稿保存在这个浏览器里，可以从停下的地方继续。' : '草稿保存在试测账号中，可以从停下的地方继续。', label: '接着写', to: `/write/${draft.id}`}
      : !pairs.length
        ? {title: '先等一位书信伙伴。', description: '结对后就能选择准确的收件人。现在也可以看看你的信箱。', label: '写一封信', to: '/write'}
        : {title: '今天，有什么想分享的小事？', description: pairs.length > 1 ? '先选择想写给哪位伙伴，再说说一件小发现。' : '一句问好、一件小发现，都可以写给伙伴。', label: '写一封信', to: pairs.length === 1 ? `/write?pair=${encodeURIComponent(pairs[0].id)}` : '/write'}
  return <div className="v2-child-home">
    <PageHeader eyebrow="信箱" title={`欢迎回来，${actor.nickname}。`} description="有话想说可以写信，收到的信也在这里。" />
    <section className="next-letter-card v2-write-first" aria-label="开始写信">
      <div className="next-letter-copy">
        <p className="eyebrow">先做这一件事</p>
        <h2>{write.title}</h2>
        <p>{write.description}</p>
        <ContextLink id="child-start-writing" className="btn" to={write.to} returnLabel="返回信箱" focusId="child-start-writing"><Feather size={19}/>{write.label}<ArrowRight size={18}/></ContextLink>
        {!!pairs.length && pairs.every(pair => pair.status === 'paused') && <p className="v2-quiet-note">陪伴暂停中，已有草稿会保留，恢复后再寄出。</p>}
      </div>
      <img src="/images/letter-garden.webp" alt="" aria-hidden="true" />
    </section>
    {unread && <section className="v2-arrival-card" aria-label="未读来信">
      <span className="v2-arrival-icon"><Mail size={25} strokeWidth={1.5}/></span>
      <div><p className="eyebrow">还有一封新来信</p><h2>{unread.title}</h2><p>{state.people.find(person => person.id === unread.authorId)?.nickname || '书信伙伴'}写给你的话，等你有空时慢慢读。</p></div>
      <ContextLink id={`child-letter-${unread.id}`} className="btn secondary" to={`/letters/${unread.id}`} returnLabel="返回信箱" focusId="child-start-writing">打开来信<ArrowRight size={16}/></ContextLink>
    </section>}
    {!unread && pending && <section className="v2-status-card" aria-label="信件进度">
      <Mail size={19}/><p>你写的《{pending.title}》正在等待运营审核，通过后才会送给伙伴。</p><ContextLink id={`child-letter-${pending.id}`} className="text-button" to={`/letters/${pending.id}`} returnLabel="返回信箱" focusId={`child-letter-${pending.id}`}>查看进度<ArrowRight size={16}/></ContextLink>
    </section>}
    {pairs.length > 1 && <section className="partner-choice-list" aria-label="我的书信伙伴"><h2>我的书信伙伴</h2><div className="partner-choice-grid">{pairs.map(pair => <article className="panel partner-choice" key={pair.id}><strong>{partnerFor(state, pair.id, actor.id)?.nickname ?? '伙伴'}</strong><span>{pair.status === 'paused' ? '这组陪伴暂停中' : '可以写信'}</span><Link className="btn secondary small" to={`/write?pair=${encodeURIComponent(pair.id)}`}>写给这位伙伴<ArrowRight size={15} aria-hidden="true"/></Link></article>)}</div></section>}
    <Link className="v2-history-link" to="/correspondence"><span><strong>看看我们的信</strong><small>{pairs.length ? `${pairs.length} 组伙伴的来信、回信与草稿按各组保存。` : '收到的信、写过的信和草稿都在这里。'}</small></span><ArrowRight size={18}/></Link>
  </div>
}

type TaskLink = { label: string; detail: string; to: string; sourceTitle?: string }

function taskFromGroup(state: PageProps['state'], group: ReturnType<typeof groupedResponseTasks>[number]): TaskLink {
  const awaiting = group.tasks.filter(task => task.status === 'awaiting')
  const reviewLetter = group.tasks.map(task => state.letters.find(letter => letter.id === task.reviewLetterId)).find(Boolean)
  const replyTo = group.letterIds[0]
  if (!awaiting.length) return {label: '回应正在审核', detail: '运营审核完成前，暂时不需要重复寄出。', to: reviewLetter ? `/letters/${reviewLetter.id}` : '/correspondence'}
  if (replyTo) return {label: '回应伙伴的来信', detail: `${formatDate(group.dueAt)} 前安排时间。读过信后，认真写下你的回应。`, to: `/write?pair=${group.pairId}&replyTo=${replyTo}`, sourceTitle: state.letters.find(letter => letter.id === replyTo)?.title}
  return {label: '写第一封信', detail: `${formatDate(group.dueAt)} 前发出第一封信，先从一声问好开始。`, to: `/write?pair=${encodeURIComponent(group.pairId)}`}
}

export function VolunteerPage(props: PageProps) {
  const {state, actor, notify} = props
  const trainingRequired = !trainingFor(state, actor.id)
  const {run: runTraining, busy: trainingBusy, error: trainingError} = useAction(notify)
  const pairs = activePairs(state, actor)
  const letters = visibleLetters(state, actor)
  const unreadIncoming = letters.filter(letter => letter.authorId !== actor.id && state.deliveries.some(delivery => delivery.letterId === letter.id && delivery.deliveredAt && !delivery.readAt))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0]
  const drafts = letters.filter(letter => letter.authorId === actor.id && ['draft', 'returned'].includes(letter.moderation))
  const returned = drafts.find(letter => letter.moderation === 'returned')
  const draft = drafts.find(letter => letter.moderation === 'draft')
  const groups = groupedResponseTasks(state, actor.id).filter(group => pairs.some(pair => pair.id === group.pairId))
  const due = groups.find(group => group.status === 'awaiting')
  const review = groups.find(group => group.status === 'review')
  const newLetterPath = pairs.length === 1 ? `/write?pair=${encodeURIComponent(pairs[0].id)}` : '/write'
  const priority: TaskLink = !pairs.length
    ? {label: '查看加入进度', detail: '结对后会在这里看到第一封信的任务。', to: '/account'}
    : unreadIncoming
      ? {label: `${partnerFor(state, unreadIncoming.pairId, actor.id)?.nickname || '伙伴'}${unreadIncoming.replyTo ? '已回信' : '写来一封信'}，先读来信`, detail: '来信已经送达，等你打开阅读。读完后再安排回应。', to: `/letters/${unreadIncoming.id}`, sourceTitle: unreadIncoming.title}
    : returned
      ? {label: '修改后重新提交', detail: '审核意见已附在原稿上，修改后还需要再次提交审核。', to: `/write/${returned.id}`, sourceTitle: returned.title}
      : due
        ? taskFromGroup(state, due)
        : draft
          ? {label: '接着写草稿', detail: '从上次停下的地方继续，写好后再检查并提交。', to: `/write/${draft.id}`, sourceTitle: draft.title}
          : review
            ? taskFromGroup(state, review)
            : {label: '写一封信', detail: pairs.every(pair => pair.status === 'paused') ? '陪伴暂停中，可以先看看以前的信。' : '没有待回应来信，也可以主动分享一件小事。', to: newLetterPath}
  const otherDrafts: TaskLink[] = drafts.map(letter => ({
    label: letter.moderation === 'returned' ? '修改这封信' : '接着写草稿',
    detail: `${partnerFor(state, letter.pairId, actor.id)?.nickname || '伙伴'} · ${letter.title}`,
    to: `/write/${letter.id}`,
  }))
  const otherGroups: TaskLink[] = groups.map(group => ({...taskFromGroup(state, group), detail: `${partnerFor(state, group.pairId, actor.id)?.nickname || '伙伴'} · ${taskFromGroup(state, group).detail}`}))
  const otherTasks = [...otherDrafts, ...otherGroups].filter(task => task.to !== priority.to).slice(0, 3)
  return <div className="v2-volunteer-home">
    <PageHeader eyebrow="陪伴任务" title={`${actor.nickname}，这次先做什么？`} description="先完成眼前这一步，再继续下一封信。">
      {!!pairs.length && <ContextLink className="btn secondary" to={newLetterPath} returnLabel="返回陪伴任务"><Plus size={17}/>写一封信</ContextLink>}
    </PageHeader>
    {trainingRequired && <section className="panel stack" aria-label="需要完成培训" data-testid="volunteer-training-gate">
      <h2>先完成本期行为边界培训</h2>
      <p>培训说明通信边界、隐私保护和求助方式。完成前可以读来信、写草稿，但还不能提交信件。</p>
      <button className="btn" type="button" disabled={trainingBusy} onClick={() => void runTraining(async () => { await dispatch(actor.id, {type: 'complete-training', version: TRAINING_VERSION}) }, '培训记录已保存到此浏览器；接下来可以提交第一封信。')}>{trainingBusy ? '正在保存…' : '完成培训'}</button>
      {trainingError && <p className="field-error" role="alert">{trainingError}</p>}
    </section>}
    <section className="v2-priority-card" aria-label="当前最需要处理的事">
      <p className="eyebrow">现在先做这件事</p>
      <h2>{priority.label}</h2>
      <p>{priority.detail}</p>
      <ContextLink className="task-action v2-task-primary" to={priority.to} returnLabel="返回陪伴任务"><Feather size={19}/><span><strong>{priority.label}</strong>{priority.sourceTitle && <small>{priority.sourceTitle}</small>}</span><ArrowRight size={17}/></ContextLink>
    </section>
    {!!pairs.length && pairs.every(pair => pair.status === 'paused') && <Notice>目前所有结对都暂停中。草稿和原有往来会保留，恢复后再提交审核。</Notice>}
    {otherTasks.length > 0 && <section className="v2-secondary-tasks" aria-label="其余待办"><h2 className="section-title">稍后还可以处理</h2>{otherTasks.map((task, index) => <ContextLink className="task-action" key={`${task.to}-${index}`} to={task.to} returnLabel="返回陪伴任务"><Mail size={18}/><span><strong>{task.label}</strong><small>{task.sourceTitle || task.detail}</small></span><ArrowRight size={16}/></ContextLink>)}</section>}
    {!!pairs.length && <section className="partner-choice-list" aria-label="我的书信伙伴"><h2>我的书信伙伴</h2><div className="partner-choice-grid">{pairs.map(pair => <article className="panel partner-choice" key={pair.id}><div className="partner-choice-person"><Avatar person={partnerFor(state, pair.id, actor.id)}/><strong>{partnerFor(state, pair.id, actor.id)?.nickname || '伙伴'}</strong></div><span>{pair.status === 'paused' ? '这组陪伴暂停中' : '每封信选择线上或由老师交付'}</span><Link className="btn secondary small" to={`/write?pair=${encodeURIComponent(pair.id)}`}>写给这位伙伴<ArrowRight size={15} aria-hidden="true"/></Link></article>)}</div></section>}
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
  const id = `correspondence-letter-${letter.id}`
  return <ContextLink id={id} className="letter-row" to={editable ? `/write/${letter.id}` : `/letters/${letter.id}`} returnLabel="返回书信往来" focusId={id}><span className="letter-row-icon"><Mail size={21} strokeWidth={1.5}/></span><div className="letter-row-text"><h3>{letter.title || '一封还在慢慢写的信'}</h3><span className="muted small">{author?.nickname} · {partnerFor(state, letter.pairId, actor.id)?.nickname || '伙伴'} · {formatDate(letter.updatedAt)}{letter.replyTo ? ' · 回信' : ''}</span></div><LetterBadge state={state} letter={letter}/><ArrowRight size={17} className="row-arrow"/></ContextLink>
}

export function LetterDetail(props: PageProps) {
  const {state, actor, notify, mode = 'demo'} = props
  const {id} = useParams()
  const [query] = useSearchParams()
  const {run, error, busy} = useAction(notify)
  const letterMetadata = state.letters.find(item => item.id === id)
  const readable = letterMetadata && canReadLetter(state, actor, letterMetadata)
  const [authorizedLetter, setAuthorizedLetter] = useState<Letter>()
  const [contentError, setContentError] = useState('')
  useEffect(() => {
    setAuthorizedLetter(undefined); setContentError('')
    if (mode !== 'live' || !letterMetadata || !readable) return
    let cancelled = false
    void cloudLetter(letterMetadata.id).then(full => { if (!cancelled) setAuthorizedLetter(full) }).catch(cause => { if (!cancelled) setContentError(cause instanceof Error ? cause.message : '无法取得这封信的授权版本。') })
    return () => { cancelled = true }
  }, [mode, letterMetadata?.id, readable])
  const letter = mode === 'live' ? authorizedLetter : letterMetadata
  const delivery = state.deliveries.find(item => item.letterId === id)
  useEffect(() => {
    if (letter && readable && letter.authorId !== actor.id && ['child', 'volunteer'].includes(actor.role) && routeFor(state, letter) === 'online' && delivery?.deliveredAt && !delivery.readAt) {
      void run(() => dispatch(actor.id, {type: 'read', id: letter.id}))
    }
  }, [id, readable, actor.id, delivery?.readAt, letter?.id])
  const fallback = actor.role === 'volunteer' ? '/space' : '/space'
  if (!letterMetadata || !readable) return <div className="stack"><BackLink fallbackTo={fallback} fallbackLabel={`返回${roleHome(actor.role)}`} /><Empty title="这封信暂时不能打开" description="可能还在等待审核，或当前身份没有阅读权限。"><Link to={fallback} className="btn secondary">回到{roleHome(actor.role)}</Link></Empty></div>
  if (!letter) return <div className="stack"><BackLink fallbackTo={fallback} fallbackLabel={`返回${roleHome(actor.role)}`} /><section className="panel stack" aria-live="polite"><h2>正在取得这封信</h2><p className="muted">任务列表不携带正文；系统正在逐封核验你是否为作者或唯一收件人。</p>{contentError && <Notice tone="error">{contentError}</Notice>}</section></div>
  const pair = state.pairs.find(item => item.id === letter.pairId)
  const deliveryRoute = routeFor(state, letter)
  const task = state.tasks.find(item => item.letterId === id)
  const own = letter.authorId === actor.id
  const canReply = !!pair && ['child', 'volunteer'].includes(actor.role) && recipientForLetter(state, letter) === actor.id && !!delivery?.deliveredAt && pair.status !== 'ended'
  const reply = state.letters.find(item => item.replyTo === id && item.authorId === actor.id && ['draft', 'returned'].includes(item.moderation))
  const sentReply = state.letters.find(item => item.replyTo === id && item.authorId === actor.id && ['pending', 'approved'].includes(item.moderation))
  const submitted = query.get('submitted') === '1' && own && letter.moderation === 'pending'
  const status = letter.moderation === 'draft' ? '这封信还在草稿中。'
    : letter.moderation === 'returned' ? '这封信需要修改，原文和审核建议都已保留。'
    : letter.moderation === 'pending' ? '这封信正在等待运营审核，通过后才会安排送达。'
    : delivery?.witnessedReadAt ? '老师已记录孩子自愿阅读。'
    : delivery?.readAt ? '这封信已打开阅读。'
    : delivery?.deliveredAt ? deliveryRoute === 'school-paper' ? '老师已确认实际交给孩子，阅读尚未确认。' : '这封信已送达，等待伙伴打开阅读。'
    : pair?.status === 'paused' ? '信件已通过审核，陪伴恢复后再安排投递。'
    : delivery?.printedAt ? '信件已打印，等待老师确认实际交付。'
    : deliveryRoute === 'school-paper' ? '信件已通过审核，等待老师打印。' : '信件已通过审核，等待线上送达。'
  return <div className="v2-letter-detail">
    <div className="toolbar between reading-top">
      <BackLink fallbackTo={fallback} fallbackLabel={`返回${roleHome(actor.role)}`} />
      {canReply && !sentReply && <ContextLink id="letter-reply-top" className="btn" to={reply ? `/write/${reply.id}` : `/write?pair=${pair!.id}&replyTo=${id}`} returnLabel="返回来信" focusId="letter-reply-top"><Feather size={18}/>{reply ? '接着写回信' : '给 TA 回信'}</ContextLink>}
    </div>
    {submitted && <section className="v2-submission-confirmation" role="status"><CheckCircle2 size={24}/><div><h2>已提交审核</h2><p>当前状态：等待运营审核。下一步由运营审核；通过后才会送达伙伴。</p><div className="toolbar"><Link className="text-button" to="/space">回到{roleHome(actor.role)}<ArrowRight size={16}/></Link><Link className="text-button" to={roleNextPath('operator', mode)}>{roleNextAction('operator', mode)}<ArrowRight size={16}/></Link></div></div></section>}
    {letter.moderation === 'returned' && <Notice tone="warning">修改建议：{letter.moderationNote}{own && pair?.status !== 'ended' && <Link className="text-button" to={`/write/${id}`}>继续修改<ArrowRight size={15}/></Link>}</Notice>}
    {letter.moderation === 'pending' && !submitted && <Notice>这封信正在等待审核。通过后才会送往下一站。</Notice>}
    <div className="reading-grid">
      <div className="v2-paper-column"><LetterPaper state={state} letter={letter}/>{canReply && !sentReply && <ContextLink id="letter-reply-after-paper" className="btn v2-reply-after-paper" to={reply ? `/write/${reply.id}` : `/write?pair=${pair!.id}&replyTo=${id}`} returnLabel="返回来信" focusId="letter-reply-after-paper"><Feather size={18}/>{reply ? '接着写回信' : '给 TA 回信'}</ContextLink>}{sentReply && <Notice>你写的回应{sentReply.moderation === 'pending' ? '正在等待运营审核' : '已经通过审核'}，这封来信不会重复催办。</Notice>}</div>
      <aside className="stack v2-reading-aside">
        <section className="panel v2-progress-summary"><h2 className="section-title">这封信现在到哪了</h2><p>{status}</p>{delivery?.deliveredAt && <p className="small muted">已确认送达：{formatDate(delivery.deliveredAt)}</p>}{delivery?.readAt && <p className="small muted">已打开阅读：{formatDate(delivery.readAt)}</p>}
          <details className="v2-progress-details"><summary>查看每一步</summary><ol className="timeline">
            <li className="done"><CheckCircle2 size={17}/><div><strong>认真写下</strong><span>{formatDate(letter.createdAt)}</span></div></li>
            <li className={letter.moderation === 'approved' ? 'done' : ''}><CheckCircle2 size={17}/><div><strong>{letter.moderation === 'approved' ? '已通过审核' : letter.moderation === 'pending' ? '正在等待审核' : letter.moderation === 'returned' ? '需要修改' : '还在草稿中'}</strong></div></li>
            {deliveryRoute === 'school-paper' && <li className={delivery?.printedAt ? 'done' : ''}><Mail size={17}/><div><strong>{delivery?.printedAt ? '已打印' : '等待老师打印'}</strong></div></li>}
            <li className={delivery?.deliveredAt ? 'done' : ''}><Mail size={17}/><div><strong>{delivery?.deliveredAt ? deliveryRoute === 'school-paper' ? '老师已确认实际交付' : '已在线送达' : pair?.status === 'paused' ? '暂停中，等待处理' : '等待送达'}</strong>{delivery?.deliveredAt && <span>{formatDate(delivery.deliveredAt)}</span>}</div></li>
            <li className={delivery?.readAt || delivery?.witnessedReadAt ? 'done' : ''}><Leaf size={17}/><div><strong>{delivery?.witnessedReadAt ? '老师见证孩子阅读' : delivery?.readAt ? '已打开阅读' : '尚无阅读记录'}</strong></div></li>
          </ol></details>
        </section>
        {task && <section className="partner-panel"><Clock3 size={21}/><h3>{task.status === 'completed' ? '已经收到回应' : task.status === 'review' ? '回应正在审核' : '给回应留一点时间'}</h3><p className="small">{task.status === 'awaiting' ? actor.role === 'child' ? '想回信的时候再写，老师可以帮助你收发。' : `约定 ${formatDate(task.dueAt)} 前回应，可以先存草稿，下次接着写。` : task.status === 'review' ? '已提交审核，暂时不需要重复寄出。' : '谢谢你，把日常认真地写进信里。'}</p>{pair?.status === 'paused' && <Badge tone="warning">暂停期间不催办</Badge>}{isOverdue(state, task) && actor.role !== 'child' && <Badge tone="warning">需要了解近况</Badge>}</section>}
        {error && <p className="field-error" role="alert">{error}<button disabled={busy} onClick={() => run(() => dispatch(actor.id, {type: 'read', id: letter.id}))}>重试</button></p>}
      </aside>
    </div>
  </div>
}
const letterSchema = z.object({title:z.string().max(60,'标题请控制在 60 字以内。'),body:z.string().max(6000,'这封信有些长，请控制在 6000 字以内。'),riddleId:z.string()})
type Fields = z.infer<typeof letterSchema>
export function ComposePage(props: PageProps & {setDirty:(dirty:boolean) => void; registerSaveDraft:(save?:()=>Promise<boolean>)=>void}) {
  const {state,actor,mode = 'demo'} = props, {id} = useParams(), [query] = useSearchParams(), location = useLocation()
  const historyDraftId = !id ? sessionStorage.getItem(`riddle-draft-route:${location.key}`) || undefined : undefined
  const draftId = id || historyDraftId
  const existingMetadata = draftId ? state.letters.find(l => l.id === draftId) : undefined
  const pairId = existingMetadata?.pairId || query.get('pair') || ''
  const pair = state.pairs.find(p => p.id === pairId)
  const replyId = existingMetadata?.replyTo || query.get('replyTo') || undefined
  const originalMetadata = replyId ? state.letters.find(l => l.id === replyId) : undefined
  const [authorizedLetters, setAuthorizedLetters] = useState<Record<string, Letter>>({})
  const [contentError, setContentError] = useState('')
  const requestedIds = [existingMetadata?.id, originalMetadata?.id].filter((value): value is string => !!value)
  useEffect(() => {
    if (mode !== 'live' || !requestedIds.length) return
    let cancelled = false
    const missing = requestedIds.filter(letterId => !authorizedLetters[letterId])
    if (!missing.length) return
    setContentError('')
    void Promise.all(missing.map(letterId => cloudLetter(letterId))).then(fullLetters => { if (!cancelled) setAuthorizedLetters(old => ({ ...old, ...Object.fromEntries(fullLetters.map(letter => [letter.id, letter])) })) }).catch(cause => { if (!cancelled) setContentError(cause instanceof Error ? cause.message : '无法取得草稿或原来信的授权版本。') })
    return () => { cancelled = true }
  }, [mode, requestedIds.join('|')])
  const existing = existingMetadata && (mode === 'live' ? authorizedLetters[existingMetadata.id] : existingMetadata)
  const original = originalMetadata && (mode === 'live' ? authorizedLetters[originalMetadata.id] : originalMetadata)
  const validOriginal = originalMetadata && pair && originalMetadata.pairId === pair.id && recipientForLetter(state,originalMetadata) === actor.id && originalMetadata.moderation === 'approved' && state.deliveries.some(d => d.letterId === originalMetadata.id && d.deliveredAt) && canReadLetter(state,actor,originalMetadata)
  const denied = !['child','volunteer'].includes(actor.role) || (pair && pair.childId !== actor.id && pair.volunteerId !== actor.id) || pair?.status === 'ended' || !!pairId && !pair || existingMetadata && (existingMetadata.authorId !== actor.id || !['draft','returned'].includes(existingMetadata.moderation)) || draftId && !existingMetadata || replyId && !validOriginal
  if (denied) return <Empty title="现在还不能写这封信" description="请从自己的信箱选择伙伴或已送达的来信。"><Link className="btn secondary" to="/space">返回{roleHome(actor.role)}</Link></Empty>
  if (mode === 'live' && requestedIds.some(letterId => !authorizedLetters[letterId])) return <div className="stack v2-compose-page"><BackLink fallbackTo="/space" fallbackLabel={`返回${roleHome(actor.role)}`}/><section className="panel stack" aria-live="polite"><h2>正在取得可编辑版本</h2><p className="muted">列表快照不携带正文；系统正在逐封核验作者、结对和版本。</p>{contentError && <Notice tone="error">{contentError}</Notice>}</section></div>
  if (!pair) {
    const choices = activePairs(state, actor)
    return <div className="stack v2-compose-page"><BackLink fallbackTo="/space" fallbackLabel={`返回${roleHome(actor.role)}`}/><PageHeader eyebrow="选择收件伙伴" title="这封信，写给谁？" description="每组往来单独保存。选定伙伴后，信只会进入这一组结对。"/>{choices.length ? <div className="partner-choice-grid">{choices.map(item => <Link className="panel partner-choice partner-choice-link" key={item.id} to={`/write?pair=${encodeURIComponent(item.id)}`}><strong>{partnerFor(state, item.id, actor.id)?.nickname || '伙伴'}</strong><span>{item.status === 'paused' ? '暂停中：可查看原有信件' : '写给这位伙伴'}</span><ArrowRight size={17} aria-hidden="true"/></Link>)}</div> : <Empty title="结对后才能写给伙伴" description="当前没有可选的结对。为避免信件送错人，暂时不创建收件人不明的信。"/>}</div>
  }
  return <Editor key={`${actor.id}-${draftId || 'new'}-${replyId || ''}`} {...props} pair={pair} existing={existing} original={original} initialRiddle={query.get('riddle') || query.get('riddleId') || ''}/>
}

function Editor({state, actor, notify, setDirty, registerSaveDraft, pair, existing, original, initialRiddle, mode = 'demo'}: PageProps & {setDirty:(dirty:boolean) => void; registerSaveDraft:(save?:()=>Promise<boolean>)=>void; pair?:Pair; existing?:Letter; original?:Letter; initialRiddle:string}) {
  const navigate = useNavigate()
  const location = useLocation()
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
  const defaultDeliveryRoute: 'online'|'school-paper' = actor.role === 'child' ? 'online' : existing?.deliveryRoute || (pair?.channel === 'paper' ? 'school-paper' : 'online')
  const [deliveryRoute, setDeliveryRoute] = useState<'online'|'school-paper'>(defaultDeliveryRoute)
  const defaults = {title: existing?.title || '', body: existing?.body || '', riddleId: existing?.riddleId || (riddles.some(riddle => riddle.id === initialRiddle) ? initialRiddle : '')}
  const baseline = useRef(JSON.stringify(defaults))
  const covered = useRef(existing?.coveredLetterIds?.length ? existing.coveredLetterIds : groupedResponseTasks(state, actor.id).filter(group => group.pairId === pair?.id).flatMap(group => group.tasks.filter(task => task.status === 'awaiting').map(task => task.letterId)).filter(Boolean))
  const {register, watch, handleSubmit, setValue, setError, formState:{errors}} = useForm<Fields>({resolver:zodResolver(letterSchema), defaultValues:defaults, mode:'onBlur'})
  const values = watch()
  const signature = JSON.stringify(values)
  const edited = signature !== baseline.current || !!file || removeAttachment || deliveryRoute !== defaultDeliveryRoute
  const recipient = state.people.find(person => person.id === (actor.role === 'volunteer' ? pair?.childId : pair?.volunteerId))
  const trainingRequired = actor.role === 'volunteer' && !trainingFor(state, actor.id)
  const savedAttachment = state.letters.find(letter => letter.id === idRef.current)?.attachmentId || existing?.attachmentId
  const hasAttachment = !!file || !!savedAttachment && !removeAttachment
  const currentFileRef = useRef(file)
  const currentRemoveAttachmentRef = useRef(removeAttachment)
  const saveInFlight = useRef<null | {key:string; promise:Promise<boolean>}>(null)
  currentFileRef.current = file
  currentRemoveAttachmentRef.current = removeAttachment

  useEffect(() => {setDirty(edited); return () => setDirty(false)}, [edited, setDirty])
  useEffect(() => {if (preview && previewDialog.current && !previewDialog.current.open) previewDialog.current.showModal()}, [preview])
  useEffect(() => {
    if (savedRouteId && !busy && !edited && !preview && state.letters.some(letter => letter.id === savedRouteId)) {
      navigate(`/write/${savedRouteId}`, {replace:true, state:location.state})
    }
  }, [savedRouteId, busy, edited, preview, state.letters, navigate, location.state])

  const titleFor = (data:Fields) => data.title.trim() || (original ? `给${recipient?.nickname || '伙伴'}的回信` : pair ? `${actor.nickname}的小小分享` : `${actor.nickname}的自我介绍`)
  async function persist(data:Fields, submit = false, automatic = false, keepEditorRoute = false) {
    if (fileError) return false
    const selectedFile = file
    const operationKey = `${JSON.stringify(data)}|${deliveryRoute}|${selectedFile?.name || ''}|${selectedFile?.lastModified || ''}|${removeAttachment}`
    if (saveInFlight.current) {
      const inFlight = saveInFlight.current
      const succeeded = await inFlight.promise
      if (!succeeded) return false
      if (!submit && inFlight.key === operationKey) return true
    }
    const operation = run(async () => {
      const changed = !persistedRef.current || !!existing && existing.pairId !== (pair?.id || '') || JSON.stringify(data) !== baseline.current || !!selectedFile || removeAttachment || deliveryRoute !== defaultDeliveryRoute
      if (changed) {
        const id = await dispatch(actor.id, {type:'save-letter', id:idRef.current, pairId:pair?.id || '', replyTo:original?.id, title:titleFor(data), body:data.body, riddleId:data.riddleId || undefined, deliveryRoute, file:selectedFile, removeAttachment, expectedRevision:revisionRef.current})
        idRef.current = id
        persistedRef.current = true
        revisionRef.current += 1
        baseline.current = JSON.stringify(data)
        const currentValuesSaved = JSON.stringify(watch()) === JSON.stringify(data) && currentFileRef.current === selectedFile && currentRemoveAttachmentRef.current === removeAttachment
        setDirty(!currentValuesSaved)
        setSaved(state.clock)
        setAutoError('')
        setRemoveAttachment(false)
        if (currentFileRef.current === selectedFile) setFile(undefined)
        if (!existing && !submit && !keepEditorRoute) setSavedRouteId(id)
      }
      if (submit) await dispatch(actor.id, {type:'submit-letter', id:idRef.current, coveredLetterIds:covered.current})
    }, automatic ? undefined : submit ? '已提交审核，通过后才会送达伙伴。' : mode === 'demo' ? '草稿已保存到此浏览器。' : '草稿已保存到试测账号。')
    saveInFlight.current = { key: operationKey, promise: operation }
    const okay = await operation
    if (saveInFlight.current?.promise === operation) saveInFlight.current = null
    if (okay && submit) {
      previewDialog.current?.close()
      setPreview(undefined)
      setDirty(false)
      navigate(`/letters/${idRef.current}?submitted=1`, {replace:true})
    }
    return okay
  }
  useEffect(() => { registerSaveDraft(async () => { const ok = await persist(values, false, false, true); if (ok) sessionStorage.setItem(`riddle-draft-route:${location.key}`, idRef.current); return ok }); return () => registerSaveDraft(undefined) }, [registerSaveDraft, signature, file, removeAttachment, fileError])
  useEffect(() => {
    if (!edited || busy || preview || fileError || autoError) return
    const timer = window.setTimeout(() => {
      void persist(values, false, true).then(okay => {
        if (!okay) setAutoError('自动保存没有完成。文字还在编辑区，请点击“保存草稿”重试。')
      })
    }, 1800)
    return () => clearTimeout(timer)
  }, [signature, file, removeAttachment, deliveryRoute, busy, preview, fileError, autoError])
  function inspect(data:Fields) {
    if (!data.body.trim() && !hasAttachment) {
      setError('body', {message:'写一句想说的话，或附上一张手写图片，就可以寄出了。'})
      return
    }
    if (fileError) return
    setPreview(data)
  }
  const pendingPreview:Letter = {id:'preview', pairId:pair?.id || '', authorId:actor.id, recipientId:actor.role === 'volunteer' ? pair?.childId : pair?.volunteerId, createdBy:actor.id, deliveryRoute, createdAt:state.clock, updatedAt:state.clock, title:preview ? titleFor(preview) : '', body:preview?.body || '', riddleId:preview?.riddleId || undefined, attachmentId:removeAttachment ? undefined : savedAttachment, moderation:'draft'}
  const back = original ? `/letters/${original.id}` : existing ? '/correspondence' : '/space'
  const backLabel = original ? '返回来信' : existing ? '返回书信往来' : `返回${roleHome(actor.role)}`
  const saveMessage = busy ? (mode === 'demo' ? '正在保存到此浏览器…' : '正在保存到试测账号…') : error || autoError ? '还没保存成功' : edited ? '有未保存的修改' : saved ? (mode === 'demo' ? '已保存到此浏览器' : '已保存到试测账号') : '开始写后会自动保存'
  return <div className="v2-compose-page">
    <BackLink fallbackTo={back} fallbackLabel={backLabel} />
    <PageHeader eyebrow={original ? '写一封回信' : '写一封信'} title={existing?.moderation === 'returned' ? '把这封信接着写好。' : '想说什么，就从这里开始。'} description="可以只写几句。写完后先检查，再提交给运营审核。" />
    <div className="v2-compose-recipient"><Mail size={18}/><span>{recipient ? `写给 ${recipient.nickname}` : '尚未选择伙伴'}</span><small>{deliveryRoute === 'school-paper' ? '审核后由老师打印并实际交给孩子' : '审核后送到收件人的线上信箱'}</small></div>
    {existing?.moderation === 'returned' && <Notice tone="warning"><strong>审核建议：</strong>{existing.moderationNote} 原文还在，可以修改后重新提交。</Notice>}
    {pair?.status === 'paused' && <Notice>陪伴暂停中，可以写和保存草稿；恢复后再提交审核。</Notice>}
    {trainingRequired && <Notice tone="warning">请先完成当前版本的行为边界培训，再提交信件。<Link className="text-button" to="/space">回到陪伴任务完成培训</Link></Notice>}
    <form className="v2-compose-form" onSubmit={handleSubmit(inspect)} aria-busy={busy}>
      <section className="panel compose-panel">
        {actor.role === 'volunteer' && !existing && <fieldset className="channel-options"><legend>这封信怎样送到孩子手中？</legend><label><input type="radio" name="deliveryRoute" value="online" checked={deliveryRoute === 'online'} onChange={() => setDeliveryRoute('online')}/><span><strong>线上信箱</strong><small>审核后在线可读。</small></span></label><label><input type="radio" name="deliveryRoute" value="school-paper" checked={deliveryRoute === 'school-paper'} onChange={() => setDeliveryRoute('school-paper')}/><span><strong>老师纸质交付</strong><small>审核、打印、实际交付和阅读分开记录。</small></span></label></fieldset>}
        {actor.role === 'child' && <p className="field-help">写给志愿者的信经必要处理后，由志愿者在线阅读；老师不执行远端打印或交付。</p>}
        <div className="field"><label htmlFor="letter-body">想说的话</label><textarea id="letter-body" rows={9} placeholder={`${recipient?.nickname || '未来的伙伴'}，你好：\n\n最近有件小事，我想和你分享……`} aria-invalid={!!errors.body} aria-describedby="body-help body-error" {...register('body')}/><div className="toolbar between"><p id="body-help" className="field-help">可以只写几句。不要填写详细住址或私人联系方式。</p><span className="small muted">{Array.from(values.body || '').length} / 6000</span></div>{errors.body && <p id="body-error" className="field-error" role="alert">{errors.body.message}</p>}</div>
        {original && <details className="v2-previous-letter"><summary>看看上一封信：{original.title}</summary><p>{original.body}</p>{covered.current.length > 1 && <p className="muted small">这次回应包含开始写信时收到的 {covered.current.length} 封待回应来信。新来信会另外保留待办。</p>}</details>}
        <details className="v2-topic-options"><summary>还没想好？看看话题提示 <span className="muted small">选用也可以跳过</span></summary><div className="topic-prompts">{['最近开心的一件小事', '窗边看到的小发现', '想问伙伴的一个问题'].map(topic => <button type="button" key={topic} onClick={() => setValue('body', `${values.body}${values.body ? '\n\n' : ''}${topic}：`, {shouldDirty:true})}>{topic}</button>)}</div></details>
        <details className="letter-options"><summary>信的名字、谜语{cloudConfigured ? '' : '和手写图片'} <span className="muted small">都可以不选</span></summary><div className="stack">
          <div className="field"><label htmlFor="letter-title">信的名字（不填也可以）</label><input id="letter-title" placeholder={titleFor({...values, title:''})} aria-invalid={!!errors.title} {...register('title')}/>{errors.title && <p className="field-error" role="alert">{errors.title.message}</p>}</div>
          <div className="field"><label htmlFor="letter-riddle">附上一道小谜语</label><select id="letter-riddle" {...register('riddleId')}><option value="">这次先聊聊天</option>{riddles.map(riddle => <option key={riddle.id} value={riddle.id}>{riddle.question}</option>)}</select></div>
          <div className="field">{!cloudConfigured && <><label htmlFor="letter-file">附上手写信或小画</label><input id="letter-file" type="file" accept="image/png,image/jpeg" onChange={event => {const next = event.target.files?.[0]; if (next && (!['image/png', 'image/jpeg'].includes(next.type) || next.size > 3 * 1024 * 1024)) {setFileError('请选择不超过 3 MiB 的 PNG 或 JPG 图片。'); setFile(undefined); return} setFile(next); setFileError(''); setRemoveAttachment(false)}}/></>}<p className="field-help">{cloudConfigured ? '试测期间暂不支持图片上传，先用文字写信也可以。' : <>PNG / JPG，最多 3 MiB。{mode === 'demo' ? '演示中请只选合成图片。' : '只附上信纸或小画，不上传个人照片和私人资料。'}</>}</p>{file && <p className="small">已选择：{file.name}</p>}{savedAttachment && !file && <label className="checkbox-row"><input type="checkbox" checked={removeAttachment} onChange={event => setRemoveAttachment(event.target.checked)}/>移除已保存的图片</label>}{fileError && <p className="field-error" role="alert">{fileError}</p>}</div>
        </div></details>
        {values.riddleId && <p className="selected-riddle"><Leaf size={16}/>已选谜语：{riddles.find(riddle => riddle.id === values.riddleId)?.question}</p>}
      </section>
      {(error || autoError) && <div className="notice error" role="alert">{error || autoError}<p>输入仍在编辑区。若提示其他设备有修改，请先复制自己的内容，再重新打开这封信查看最新版本。</p></div>}
      <div className="commit-bar"><div className="save-state" role="status"><Save size={15}/>{saveMessage}</div><div className="toolbar"><button className="btn secondary" type="button" disabled={busy || !!fileError} onClick={() => void persist(values)}><Save size={16}/>保存草稿</button><button className="btn" type="submit" disabled={busy || !pair || pair.status !== 'active' || !!fileError || trainingRequired}><Send size={16}/>检查并寄出</button></div></div>
      {!pair && <p className="muted small">还没结对，暂时不能寄出。{mode === 'demo' ? '草稿只保存在当前浏览器。' : '草稿保存在当前试测登录账号。'}</p>}
    </form>
    <dialog ref={previewDialog} className="confirm-dialog letter-preview-dialog" onCancel={() => setPreview(undefined)} aria-labelledby="preview-title"><div className="dialog-content"><div className="toolbar between"><h2 id="preview-title">寄出前，再看一眼</h2><button type="button" aria-label="关闭预览" onClick={() => {previewDialog.current?.close(); setPreview(undefined)}}><X size={22}/></button></div><p>写给{recipient?.nickname}。提交后进入运营审核，通过后才会送达。</p>{preview && <LetterPaper state={state} letter={pendingPreview}/>}<SelectedImage file={file}/>{error && <p role="alert" className="field-error">{error}</p>}<div className="toolbar"><button type="button" className="btn secondary" disabled={busy} onClick={() => {previewDialog.current?.close(); setPreview(undefined)}}>再改一改</button><button type="button" className="btn" disabled={busy} onClick={() => preview && void persist(preview, true)}><Send size={17}/>{busy ? '正在提交…' : '提交审核'}</button></div></div></dialog>
  </div>
}function SelectedImage({file}:{file?:File}) {
  const [url,setUrl] = useState('')
  useEffect(() => {if (!file) {setUrl('');return}const next = URL.createObjectURL(file);setUrl(next);return () => URL.revokeObjectURL(next)},[file])
  return url ? <figure className="attachment"><img src={url} alt="即将提交的手写图片"/><figcaption>{file?.name}</figcaption></figure> : null
}
