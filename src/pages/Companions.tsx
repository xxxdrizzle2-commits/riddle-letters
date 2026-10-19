import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, Feather, HeartHandshake, Leaf, Mail, Plus, Save, Send } from 'lucide-react'
import { canReadLetter, dispatch, formatDate, isOverdue, riddles, visibleLetters } from '../data'
import { Avatar, Badge, Empty, LetterBadge, LetterPaper, Notice, PageHeader, useAction, type PageProps } from '../ui'
import type { Letter, Pair } from '../types'

export function ChildPage({ state, actor, notify }: PageProps) {
  const [tab, setTab] = useState('inbox'), [help, setHelp] = useState(false), [helpBody, setHelpBody] = useState('')
  const { run, busy, error } = useAction(notify)
  const pair = state.pairs.find(p => p.childId === actor.id)
  const letters = visibleLetters(state, actor)
  const incoming = letters.filter(l => l.authorId !== actor.id).sort((a,b) => b.createdAt.localeCompare(a.createdAt))
  const newest = incoming[0], volunteer = state.people.find(p => p.id === pair?.volunteerId)
  const outgoing = letters.filter(l => l.authorId === actor.id)
  return <><PageHeader eyebrow="我的信箱" title={`${actor.nickname}，见字如面。`} description={newest ? '把今天的小发现，留给一个认真听你说话的人。' : '故事可以从一句问好开始，我们在这里等你。'}><span className="botanical" aria-hidden="true"><Leaf size={42} strokeWidth={1}/></span></PageHeader>
    <div className="child-grid"><div className="stack">
    {pair?.status === 'paused' && <Notice>这段陪伴正在暂停：{pair.pauseReason}。之前的信依然可以慢慢读，恢复后再接着写。</Notice>}
    <div className="tabs" aria-label="信件分类">{[['inbox','收到的信'],['outbox','我的回信']].map(([key,label]) => <button key={key} type="button" className={tab === key ? 'active' : ''} aria-pressed={tab === key} onClick={() => setTab(key)}>{label}<span>{key === 'inbox' ? incoming.length : outgoing.length}</span></button>)}</div>
    {tab === 'inbox' && (newest ? <>
      <article className="featured-letter"><div className="envelope-scene" aria-hidden="true"><img src="/images/letter-garden.webp" alt=""/><span className="scene-label">一封来信，慢慢打开</span></div><div className="featured-letter-content"><div className="toolbar between"><span className="eyebrow">来自{volunteer?.nickname}的日常</span><LetterBadge state={state} letter={newest}/></div><h2>{newest.title}</h2><p className="muted">{newest.body.split('\n').filter(Boolean)[1]?.slice(0,52) || '有一些小小的故事，想和你分享。'}</p><Link className="btn" to={`/letters/${newest.id}`}><Mail size={18}/>打开这封信<ArrowRight size={18}/></Link></div></article>
      {incoming.length > 1 && <section className="panel"><h2 className="section-title">之前的来信</h2>{incoming.slice(1).map(l => <LetterRow key={l.id} letter={l} {...{ state, actor, notify }}/>)}</section>}
    </> : <Empty title={pair ? '下一封来信，正在路上' : '你的小小信箱，准备好了'} description={pair ? '还没有送达的来信。你可以先去谜语小屋逛逛。' : '运营伙伴会帮你找到一位书信伙伴。等待的时候，也可以猜一道谜语。'}><Link className="btn secondary" to="/riddles">去猜一道谜语<ArrowRight size={16}/></Link></Empty>)}
    {tab === 'outbox' && (outgoing.length ? <section className="panel">{outgoing.map(l => <LetterRow key={l.id} letter={l} {...{state,actor,notify}}/>)}</section> : <Empty title="第一封回信，还没有写下" description="收到来信后，点开信件就可以开始回信。也可以先想一件想分享的小事。"/>)}
    </div><aside className="stack child-aside"><section className="partner-panel"><div className="toolbar"><Avatar person={volunteer} large/><div><span className="muted small">我的书信伙伴</span><h2>{volunteer?.nickname || '等待遇见'}</h2></div></div><p>{volunteer ? '不必每次都有大故事，窗边的一片新叶，也值得写进信里。' : '每个人都带着自己的故事。我们会认真安排这次相遇。'}</p><div className="hairline"/><div className="toolbar"><Leaf size={16}/><span className="small">{volunteer?.interests.join(' · ') || '好奇 · 分享 · 慢慢认识'}</span></div></section>
    <section className="small-discovery"><span className="stamp small-stamp"><Leaf size={26}/></span><p className="eyebrow">今天的小发现</p><h3>抬头看看，<br/>天空像什么？</h3><p className="muted small">可以把答案留在下一封信里。</p><Link className="text-button" to="/riddles">也来猜个谜<ArrowRight size={15}/></Link></section>
    <button className="help-button" onClick={() => setHelp(!help)} aria-expanded={help}><HeartHandshake size={20}/><span>我想找人帮忙</span><ArrowRight size={16}/></button>
    {help && <form className="panel stack" onSubmit={async e => { e.preventDefault(); if(await run(() => dispatch(actor.id,{type:'help',pairId:pair?.id,body:helpBody}), '你的求助已保存，运营伙伴会在演示待办里看到。')) {setHelpBody('');setHelp(false)} }}><label htmlFor="help-body">想告诉运营伙伴什么？</label><textarea id="help-body" required maxLength={2000} rows={4} value={helpBody} onChange={e=>setHelpBody(e.target.value)}/><p className="muted small">这段话只进入运营的求助事项。这是本地演示，不会通知真实工作人员；需要现实中的帮助时，也请告诉身边信任的大人。</p>{error && <p role="alert" className="field-error">{error}</p>}<button className="btn" disabled={busy}>保存求助</button></form>}
    </aside></div></>
}

export function VolunteerPage(props: PageProps) {
  const {state,actor}=props; const [filter,setFilter]=useState('all')
  const pairs=state.pairs.filter(p=>p.volunteerId===actor.id), letters=visibleLetters(state,actor)
  const drafts=letters.filter(l=>l.authorId===actor.id && ['draft','returned'].includes(l.moderation))
  const inbox=letters.filter(l=>l.authorId!==actor.id)
  const filtered=letters.filter(l=>filter==='all'||filter==='draft'&&['draft','returned'].includes(l.moderation)||filter==='inbox'&&l.authorId!==actor.id).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))
  return <><PageHeader eyebrow="志愿者工作台" title={`${actor.nickname}，今天想聊些什么？`} description="把陪伴放进日常，让每一次回应都有迹可循。"><Link className="btn" to="/write"><Plus size={17}/>写一封信</Link></PageHeader>
    <div className="volunteer-overview"><section className="partner-panel"><p className="eyebrow">这一段书信陪伴</p>{pairs.length ? pairs.map(pair=>{const child=state.people.find(p=>p.id===pair.childId); return <div key={pair.id}><div className="toolbar"><Avatar person={child} large/><div><h2>{child?.nickname}</h2><p className="muted">{child?.subtitle} · {pair.channel==='online'?'线上信箱':'老师协助纸质收发'}</p></div><Badge tone={pair.status==='active'?'success':'warning'}>{pair.status==='active'?'陪伴进行中':'暂停中'}</Badge></div><p className="small">喜欢 {child?.interests.join('、')}。从对方上次提到的一件小事开始聊吧。</p>{pair.status==='paused' && <Notice>{pair.pauseReason}，恢复后可继续写信。</Notice>}</div>}) : <Empty title="正在等待一位伙伴" description="运营完成结对后，你就可以写下第一封信。"/>}</section><section className="quiet-stats"><div><span className="muted">可以接着写</span><strong>{drafts.length}<small> 封</small></strong><p>草稿和需要修改的信</p></div><div><span className="muted">收到的回信</span><strong>{inbox.length}<small> 封</small></strong><p>已审核并送达的回应</p></div></section></div>
    <section className="panel correspondence"><div className="toolbar between"><h2 className="section-title">我们的书信往来</h2><span className="muted small">共 {filtered.length} 封</span></div><div className="tabs" aria-label="往来筛选">{[['all','全部往来'],['draft','草稿与修改'],['inbox','收到的回信']].map(([key,label])=><button key={key} className={filter===key?'active':''} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}</button>)}</div>{filtered.length?filtered.map(l=><LetterRow key={l.id} letter={l} {...props}/>):<Empty title="这里还没有书信" description="不妨从一句问好、一道谜语开始。"/>}</section>
    <div className="writing-note"><Feather size={22}/><p>不需要写得完美，认真回应就很好。避免询问孩子的详细住址、私人联系方式，或要求发送个人照片。</p></div>
  </>
}

export function LetterRow({state,actor,letter}:PageProps & {letter:Letter}) {
  const editable=letter.authorId===actor.id && ['draft','returned'].includes(letter.moderation)
  const author=state.people.find(p=>p.id===letter.authorId)
  return <Link className="letter-row" to={editable?`/write/${letter.id}`:`/letters/${letter.id}`}><span className="letter-row-icon"><Mail size={21} strokeWidth={1.5}/></span><div className="letter-row-text"><h3>{letter.title||'还没有取名的草稿'}</h3><span className="muted small">{author?.nickname} · {formatDate(letter.updatedAt)}{letter.replyTo?' · 回信':''}</span></div><LetterBadge state={state} letter={letter}/><ArrowRight size={17} className="row-arrow"/></Link>
}

export function LetterDetail(props:PageProps) {
  const {state,actor,notify}=props; const {id}=useParams(); const {run,error,busy}=useAction(notify)
  const letter=state.letters.find(l=>l.id===id)
  const readable=letter && canReadLetter(state,actor,letter)
  const delivery=state.deliveries.find(d=>d.letterId===id)
  useEffect(()=>{if(readable && letter.authorId!==actor.id && (actor.role==='child'||actor.role==='volunteer') && delivery?.deliveredAt && !delivery.readAt) void run(()=>dispatch(actor.id,{type:'read',id:letter.id}))},[id,readable,actor.id,delivery?.readAt])
  if(!letter||!readable) return <Empty title="这封信暂时不能打开" description="可能还在等待审核，或它属于另一位演示伙伴。"><Link to="/space" className="btn secondary">返回我的工作台</Link></Empty>
  const pair=state.pairs.find(p=>p.id===letter.pairId)!, reply=state.letters.find(l=>l.replyTo===id)
  const task=state.tasks.find(t=>t.letterId===id)
  const canReply=actor.role==='child' && letter.authorId===pair.volunteerId && !!delivery?.deliveredAt && pair.status==='active'
  return <><Link className="back-link" to="/space"><ArrowLeft size={16}/>回到我的信箱</Link><div className="reading-grid"><div className="stack">{letter.moderation==='pending' && <Notice><strong>这封信正在等待审核。</strong> 审核通过后才会送达对方，你可以回到工作台查看进展。</Notice>}{letter.moderation==='returned' && <Notice tone="warning">修改建议：{letter.moderationNote}<Link className="text-button" to={`/write/${id}`}>继续修改<ArrowRight size={15}/></Link></Notice>}<LetterPaper state={state} letter={letter}/></div><aside className="stack"><section className="panel"><h2 className="section-title">这封信的小旅程</h2><ol className="timeline"><li className="done"><CheckCircle2 size={17}/><div><strong>认真写下</strong><span>{formatDate(letter.createdAt)}</span></div></li><li className={letter.moderation==='approved'?'done':''}><CheckCircle2 size={17}/><div><strong>{letter.moderation==='approved'?'已通过审核':letter.moderation==='pending'?'正在等待审核':letter.moderation==='returned'?'需要修改':'还在草稿中'}</strong></div></li>{pair.channel==='paper'&&!letter.replyTo&&<li className={delivery?.printedAt?'done':''}><Mail size={17}/><div><strong>{delivery?.printedAt?'已打印':'等待老师打印'}</strong>{delivery?.printedAt&&<span>{formatDate(delivery.printedAt)}</span>}</div></li>}<li className={delivery?.deliveredAt?'done':''}><Mail size={17}/><div><strong>{delivery?.deliveredAt?'已送达':'等待送达'}</strong>{delivery?.deliveredAt&&<span>{formatDate(delivery.deliveredAt)}</span>}</div></li><li className={delivery?.readAt?'done':''}><Leaf size={17}/><div><strong>{delivery?.readAt?'已打开阅读':'等待打开阅读'}</strong></div></li></ol></section>
    {task && <section className="partner-panel"><Clock3 size={21}/><h3>{task.status==='completed'?'这一轮，收到回应了':task.status==='review'?'回信正在审核':'给回应留一点时间'}</h3><p className="small">{task.status==='awaiting'?`本轮约定 ${formatDate(task.dueAt)} 前回信。可以先存草稿，下次再接着写。`:task.status==='review'?'回信已保存并提交，审核通过后会送达。':'谢谢你，把日常认真地写进信里。'}</p>{pair.status==='paused'&&<Badge tone="warning">暂停期间不催办</Badge>}{isOverdue(state,task)&&actor.role!=='child'&&<Badge tone="warning">等待运营跟进</Badge>}</section>}
    {canReply && (!reply ? <Link className="btn" to={`/write?pair=${pair.id}&replyTo=${id}`}><Feather size={18}/>给这封信写回信</Link> : <Link className="btn" to={['draft','returned'].includes(reply.moderation)?`/write/${reply.id}`:`/letters/${reply.id}`}><Feather size={18}/>{['draft','returned'].includes(reply.moderation)?'接着写我的回信':'查看我的回信'}</Link>)}{error&&<p className="field-error" role="alert">{error}<button disabled={busy} onClick={()=>run(()=>dispatch(actor.id,{type:'read',id:letter.id}))}>重试</button></p>}
    </aside></div></>
}

const letterSchema=z.object({title:z.string().trim().min(1,'给这封信取一个名字吧。').max(60,'标题请控制在 60 字以内。'),body:z.string().trim().min(1,'写下一点想分享的内容吧。').max(6000,'这封信有些长，请控制在 6000 字以内。'),riddleId:z.string()})
type Fields=z.infer<typeof letterSchema>
export function ComposePage(props:PageProps & {setDirty:(dirty:boolean)=>void}) {
  const {state,actor}=props; const {id}=useParams(); const [query]=useSearchParams()
  const existing=id?state.letters.find(l=>l.id===id):undefined
  const pairId=existing?.pairId||query.get('pair')||state.pairs.find(p=>p.volunteerId===actor.id||p.childId===actor.id)?.id
  const pair=state.pairs.find(p=>p.id===pairId)
  const replyTo=existing?.replyTo||query.get('replyTo')||undefined
  const original=replyTo?state.letters.find(l=>l.id===replyTo):undefined
  const validOriginal=original && pair && original.pairId===pair.id && !original.replyTo && original.authorId===pair.volunteerId && original.moderation==='approved' && state.deliveries.some(d=>d.letterId===original.id && d.deliveredAt) && canReadLetter(state,actor,original)
  if(!pair||!['child','volunteer'].includes(actor.role)||(actor.role==='child'?pair.childId!==actor.id:pair.volunteerId!==actor.id)||existing&&(existing.authorId!==actor.id||!['draft','returned'].includes(existing.moderation))||id&&!existing||actor.role==='child'&&!validOriginal||actor.role==='volunteer'&&!!replyTo) return <Empty title="现在还不能写这封信" description="请先完成结对，或从已经送达的来信开始回信。"><Link className="btn secondary" to="/space">返回工作台</Link></Empty>
  if(pair.status==='paused') return <Empty title="陪伴正在暂停" description={`${pair.pauseReason}。恢复后就能接着写，已保存的草稿会保留。`}><Link className="btn secondary" to="/space">返回工作台</Link></Empty>
  return <Editor key={`${actor.id}-${id||'new'}-${replyTo||''}`} {...props} pair={pair} existing={existing} original={original}/>
}
function Editor({state,actor,notify,setDirty,pair,existing,original}:PageProps & {setDirty:(d:boolean)=>void;pair:Pair;existing?:Letter;original?:Letter}) {
  const navigate=useNavigate(); const {run,busy,error}=useAction(notify); const idRef=useRef(existing?.id||crypto.randomUUID())
  const [saved,setSaved]=useState(existing?.updatedAt||''), [file,setFile]=useState<File>(), [autoError,setAutoError]=useState('')
  const defaults={title:existing?.title||(original?`回信：${original.title}`:''),body:existing?.body||'',riddleId:existing?.riddleId||''}
  const baseline=useRef(JSON.stringify(defaults)); const {register,watch,handleSubmit,formState:{errors}}=useForm<Fields>({resolver:zodResolver(letterSchema),defaultValues:defaults,mode:'onBlur'})
  const values=watch(), signature=JSON.stringify(values), edited=signature!==baseline.current || !!file
  const recipient=state.people.find(p=>p.id===(actor.role==='volunteer'?pair.childId:pair.volunteerId))
  useEffect(()=>{setDirty(edited);return()=>setDirty(false)},[edited,setDirty])
  async function persist(data:Fields,submit=false) {
    const okay=await run(async()=>{const id=await dispatch(actor.id,{type:'save-letter',id:idRef.current,pairId:pair.id,replyTo:original?.id,title:data.title,body:data.body,riddleId:data.riddleId||undefined,file});idRef.current=id;baseline.current=JSON.stringify(data);setDirty(false);setFile(undefined);setSaved(state.clock);setAutoError('');if(submit) await dispatch(actor.id,{type:'submit-letter',id})},submit?'已提交审核，通过后才会送达。':'草稿已保存在这个浏览器里。')
    if(okay&&submit) navigate(`/letters/${idRef.current}`)
    return okay
  }
  useEffect(()=>{if(!edited||busy||file) return;const timer=window.setTimeout(()=>{void persist(values).then(ok=>{if(!ok)setAutoError('自动保存未完成，内容仍在编辑区，请手动重试。')})},2200);return()=>clearTimeout(timer)},[signature])
  return <><Link className="back-link" to="/space"><ArrowLeft size={16}/>回到工作台</Link><PageHeader eyebrow={original?'回应一封来信':'写信给远方的朋友'} title={original?'把你的日常，也说给我听。':'今天，有什么小事值得分享？'} description={`写给${recipient?.nickname} · ${pair.channel==='paper'?'纸质送达，由老师协助收发':'线上信箱送达'}`}/>
  <form className="compose-grid" onSubmit={handleSubmit(data=>persist(data,true))} aria-busy={busy}><div className="stack"><section className="panel compose-panel">{existing?.moderation==='returned'&&<Notice tone="warning">运营的修改建议：{existing.moderationNote}</Notice>}<div className="field"><label htmlFor="letter-title">信的名字 <span className="required">*</span></label><input id="letter-title" placeholder="比如：窗边的小树，又长高了一点" aria-invalid={!!errors.title} aria-describedby={errors.title?'title-error':'title-help'} {...register('title')}/>{errors.title?<p id="title-error" className="field-error">{errors.title.message}</p>:<p id="title-help" className="field-help">短短一句，告诉朋友这封信的主题。</p>}</div>
  <div className="field"><label htmlFor="letter-body">想说的话 <span className="required">*</span></label><textarea id="letter-body" rows={15} placeholder={`${recipient?.nickname}，你好：\n\n最近有件小事，我想和你分享……`} aria-invalid={!!errors.body} aria-describedby={errors.body?'body-error':'body-help'} {...register('body')}/><div className="toolbar between">{errors.body?<p id="body-error" className="field-error">{errors.body.message}</p>:<p id="body-help" className="field-help">问候、分享一件小事，再留一个可以回应的话题。</p>}<span className="small muted">{Array.from(values.body||'').length} / 6000</span></div></div>
  <div className="field"><label htmlFor="letter-riddle">附上一道小谜语 <span className="muted small">选填</span></label><select id="letter-riddle" {...register('riddleId')}><option value="">这次先聊聊天</option>{riddles.map(r=><option value={r.id} key={r.id}>{r.question}</option>)}</select></div>
  {actor.role==='child'&&<div className="field"><label htmlFor="letter-file">附上一张演示小画 <span className="muted small">选填</span></label><input id="letter-file" type="file" accept="image/png,image/jpeg" onChange={e=>setFile(e.target.files?.[0])}/><p className="field-help">PNG / JPG，最多 3 MiB，仅使用合成演示图片，不上传个人照片。</p></div>}
  </section><section className="compose-check"><CheckCircle2 size={20}/><div><strong>寄出前，给自己一点检查的时间</strong><p className="small muted">{values.title?'已有标题':'还没写标题'} · {values.body.trim()?`正文 ${Array.from(values.body).length} 字`:'还没写正文'} · {values.riddleId?'附有一道谜语':'没有附加谜语'}。提交后由运营审核，通过后才会送达。</p></div></section>{(error||autoError)&&<p role="alert" className="field-error">{error||autoError} 内容仍保留，可以点击保存重试。</p>}<div className="commit-bar"><div className="save-state"><Save size={15}/>{busy?'正在保存…':edited?'有未保存的修改':saved?'草稿已保存':'还没有保存'}</div><div className="toolbar"><button className="btn secondary" type="button" disabled={busy} onClick={()=>persist(values)}><Save size={16}/>保存草稿</button><button className="btn" type="submit" disabled={busy}><Send size={16}/>{busy?'正在处理…':'提交审核'}</button></div></div></div>
  <aside className="stack compose-aside">{original?<><h2 className="section-title">上次聊到这里</h2><div className="previous-letter"><h3>{original.title}</h3><p>{original.body}</p><Link className="text-button" to={`/letters/${original.id}`}>读完整来信<ArrowRight size={15}/></Link></div></>:<section className="partner-panel"><Avatar person={recipient} large/><h2>写给{recipient?.nickname}</h2><p>从“你上次提到的……”开始，也可以聊聊今天的天气、一本书或一片新叶。</p><div className="hairline"/><p className="small">喜欢 {recipient?.interests.join('、')}</p></section>}<section className="writing-tips"><Feather size={23}/><h3>认真，就已经很好</h3><p>不比较，不追问，让对方可以自由选择想分享的内容。</p><p className="small muted">私人联系方式、详细住址和个人照片，请留在信件之外。</p></section></aside></form></>
}
