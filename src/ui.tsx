/* finesse · register=product · A=paper+postal-green · B=Chinese-sans+Songti · C=letter-workflow · D=CSS-feedback · E=correspondence · SOUL=7 SPECTACLE=2 DENSITY=5 */
import { useEffect, useRef, useState, type ComponentProps, type MouseEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ArrowLeft, ArrowRight, Feather, Leaf, Mail, Check, HelpCircle, FileText, Image as ImageIcon, LocateFixed, TriangleAlert } from 'lucide-react'
import type { AppState, Letter, Person } from './types'
import { formatDate, riddles } from './data'
import { downloadAttachment } from './services/cloud'

export interface PageProps { state: AppState; actor: Person; notify: (message: string) => void; mode?: 'demo' | 'live' }

type ReturnContext = { to: string; label: string; sourcePath: string; sourceKey: string; focusId?: string; historyBack: boolean }
type ContextLinkProps = Omit<ComponentProps<typeof Link>, 'to' | 'state'> & {
  to: string; returnLabel: string; returnTo?: string; focusId?: string; historyBack?: boolean; state?: Record<string, unknown>
}

export function ContextLink({ to, returnLabel, returnTo, focusId, historyBack = true, state, ...props }: ContextLinkProps) {
  const location = useLocation()
  const sourcePath = `${location.pathname}${location.search}${location.hash}`
  const returnContext: ReturnContext = { to: returnTo || sourcePath, label: returnLabel, sourcePath, sourceKey: location.key, focusId, historyBack }
  return <Link {...props} to={to} state={{ ...state, returnContext }} />
}

export function BackLink({ fallbackTo, fallbackLabel }: { fallbackTo: string; fallbackLabel: string }) {
  const location = useLocation()
  const navigate = useNavigate()
  const context = (location.state as { returnContext?: Partial<ReturnContext> } | null)?.returnContext
  const target = typeof context?.to === 'string' && context.to.startsWith('/') && !context.to.startsWith('//') ? context.to : fallbackTo
  const label = typeof context?.label === 'string' && context.label.trim() ? context.label : fallbackLabel
  function goBack(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    if (context?.focusId && /^[\w-]+$/.test(context.focusId)) sessionStorage.setItem('riddle-return-focus', context.focusId)
    if (context?.historyBack && context.sourceKey && history.length > 1) navigate(-1)
    else navigate(target, { replace: true })
  }
  return <Link className="back-link" to={target} replace onClick={goBack}><ArrowLeft size={16} aria-hidden="true" />{label}</Link>
}
export function PageHeader({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description?: string; children?: ReactNode }) {
  return <header className="page-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="muted">{description}</p>}</div>{children && <div className="toolbar">{children}</div>}</header>
}
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) { return <span className={`badge ${tone}`}>{children}</span> }
export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: string }) { return <div className={`notice ${tone}`}>{children}</div> }
export function Empty({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return <div className="empty"><div className="empty-mark"><Mail size={32} strokeWidth={1.3}/><Leaf className="empty-leaf" size={18}/></div><h2>{title}</h2>{description && <p className="muted">{description}</p>}{children}</div>
}
export function Avatar({ person, large = false }: { person?: Person; large?: boolean }) { return <span aria-hidden="true" className={`avatar ${person?.role ?? ''} ${large ? 'large' : ''}`}>{person?.avatar || '信'}</span> }
export function useAction(notify: (message: string) => void) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''); const lock = useRef(false)
  async function run(task: () => Promise<unknown>, success?: string) {
    if (lock.current) return false
    lock.current = true; setBusy(true); setError('')
    try { await task(); if (success) notify(success); return true }
    catch (e) {
      const message = e instanceof Error ? e.message : ''
      setError(/failed to fetch|networkerror|load failed/i.test(message)
        ? '网络连接似乎中断了，操作还没完成。请检查网络后重试。'
        : message || '暂时没能保存，请保留内容后再试一次。')
      return false
    }
    finally { lock.current = false; setBusy(false) }
  }
  return { busy, error, run }
}
export function AttachmentView({ state, id }: { state: AppState; id?: string }) {
  const attachment = state.attachments.find(a => a.id === id) ?? (id ? { id, pairId: '', name: '本次受限任务图像', type: 'image/webp' } : undefined)
  const [url, setUrl] = useState(''), [error, setError] = useState(false), [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!attachment) { setUrl(''); setError(false); return }
    let cancelled = false, objectUrl = ''
    setUrl(''); setError(false)
    const show = (blob: Blob) => { if (cancelled) return; objectUrl = URL.createObjectURL(blob); setUrl(objectUrl) }
    if (attachment.blob) show(attachment.blob)
    else void downloadAttachment(attachment.id).then(show).catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [attachment?.id, attachment?.blob, retry])
  if (!attachment) return null
  if (error) return <div className="notice error" role="alert" data-attachment-status="error">手写图片暂时打不开。<button type="button" className="text-button" onClick={() => setRetry(value => value + 1)}>重试加载图片</button></div>
  return url ? <figure className="attachment" data-attachment-status="ready"><img src={url} alt={`手写信附件：${attachment.name}`} /><figcaption>{attachment.name}</figcaption></figure> : <p className="muted small" role="status" data-attachment-status="loading">正在打开手写图片…</p>
}

function HandwritingReader({ state, letter }: { state: AppState; letter: Letter }) {
  const run = letter.authorizedOcrRun ?? state.ocrRuns?.find(item => item.id === letter.ocrRunId && item.letterId === letter.id && item.status === 'completed')
  const rendition = state.attachments.find(item => item.id === letter.approvedRenditionId)
  const [view, setView] = useState<'transcript' | 'image'>('transcript')
  const [selectedLine, setSelectedLine] = useState<string>()
  const [url, setUrl] = useState(''), [imageError, setImageError] = useState(false)
  const imageRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!rendition || view !== 'image') return
    let cancelled = false, objectUrl = ''
    setImageError(false)
    const show = (blob: Blob) => { if (!cancelled) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl) } }
    if (rendition.blob) show(rendition.blob)
    else void downloadAttachment(rendition.id).then(show).catch(() => { if (!cancelled) setImageError(true) })
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [rendition?.id, rendition?.blob, view])
  if (!run || !rendition) return null
  const active = run.lines.find(line => line.id === selectedLine)
  const points = active?.polygon ?? []
  const xs = points.filter((_, index) => index % 2 === 0), ys = points.filter((_, index) => index % 2 === 1)
  const highlight = xs.length && ys.length ? {
    left: `${Math.min(...xs) * 100}%`, top: `${Math.min(...ys) * 100}%`,
    width: `${(Math.max(...xs) - Math.min(...xs)) * 100}%`, height: `${(Math.max(...ys) - Math.min(...ys)) * 100}%`,
  } : undefined
  function locate(id: string) {
    setSelectedLine(id); setView('image')
    setTimeout(() => imageRef.current?.focus(), 0)
  }
  return <section className="handwriting-reader" aria-label="手写信阅读方式">
    <div className="handwriting-reader-head"><div><strong>这是一封手写信</strong><p>清晰转写忠实保留原话；原稿页展示的是已获准的遮盖副本，不是私有原件。</p></div><div className="handwriting-tabs" role="group" aria-label="切换手写信阅读方式"><button type="button" className={view === 'transcript' ? 'active' : ''} aria-pressed={view === 'transcript'} onClick={() => setView('transcript')}><FileText size={17}/>清晰转写</button><button type="button" className={view === 'image' ? 'active' : ''} aria-pressed={view === 'image'} onClick={() => setView('image')}><ImageIcon size={17}/>手写原稿</button></div></div>
    {view === 'transcript' ? <div className="handwriting-transcript"><p className="sr-only">点击任意一行可定位到已获准原稿副本的相应位置。</p>{run.lines.map(line => <button type="button" key={line.id} className={`handwriting-line ${line.uncertain ? 'uncertain' : ''}`} onClick={() => locate(line.id)}><span>{line.correctedText ?? line.text}</span><small>{line.uncertain ? <><TriangleAlert size={14}/>疑难行，查看原稿位置</> : <><LocateFixed size={14}/>定位到原稿</>}</small></button>)}</div> : <div className="handwriting-image-panel" ref={imageRef} tabIndex={-1} aria-label={active ? `已定位到第 ${active.pageIndex + 1} 页所选行` : '已获准的手写原稿遮盖副本'}>{imageError ? <Notice tone="error">获准原稿副本暂时打不开，请稍后重试。</Notice> : url ? <div className="handwriting-image-wrap"><img src={url} alt="已获准展示的手写原稿遮盖副本"/>{highlight && <span className="handwriting-highlight" style={highlight} aria-hidden="true"/>}</div> : <p className="muted" role="status">正在打开获准原稿副本…</p>}{active && <p className="handwriting-location-note"><LocateFixed size={16}/>已定位：{active.correctedText ?? active.text}</p>}</div>}
  </section>
}
export function RiddleBlock({ id }: { id: string }) {
  const riddle = riddles.find(r => r.id === id); const [hint, setHint] = useState(false), [answer, setAnswer] = useState(false)
  if (!riddle) return null
  return <section className="riddle-block" aria-label="信里的小谜语"><div className="toolbar"><HelpCircle size={19}/><span>留给你的小谜语</span></div><p className="riddle-question">{riddle.question}</p><div className="toolbar"><button type="button" className="text-button" aria-expanded={hint} onClick={() => setHint(!hint)}>{hint ? '收起提示' : '给我一点提示'}</button><button type="button" className="text-button" aria-expanded={answer} onClick={() => setAnswer(!answer)}>{answer ? '收起谜底' : '看看谜底'}<ArrowRight size={15}/></button></div>{hint && <p className="muted">小提示：{riddle.hint}</p>}{answer && <p className="answer"><Check size={17}/>谜底：{riddle.answer}</p>}</section>
}
export function LetterPaper({ state, letter }: { state: AppState; letter: Letter }) {
  const author = state.people.find(p => p.id === letter.authorId)
  const handwriting = !!letter.ocrRunId && !!letter.approvedRenditionId
  return <article className="letter-paper"><div className="letter-paper-top"><span><Feather size={17}/> 一封认真写下的信</span><span className="stamp"><Leaf size={24} strokeWidth={1.4}/></span></div><h2>{letter.title}</h2><div className="letter-meta">{author?.nickname} · {formatDate(letter.updatedAt)}</div>{handwriting ? <HandwritingReader state={state} letter={letter}/> : <div className="letter-body">{letter.body.split('\n').map((line, i) => <p className={line ? undefined : 'letter-gap'} key={i}>{line || '\u00a0'}</p>)}</div>}{letter.riddleId && <RiddleBlock key={letter.riddleId} id={letter.riddleId}/>}<AttachmentView state={state} id={handwriting ? undefined : letter.attachmentId}/><div className="letter-signature">见字如面，慢慢聊。<Leaf size={18}/></div></article>
}
export const moderationLabel = { draft: '草稿', pending: '等待审核', returned: '请修改', approved: '审核通过' }
export function LetterBadge({ state, letter }: { state: AppState; letter: Letter }) {
  const d = state.deliveries.find(d => d.letterId === letter.id)
  if (letter.moderation !== 'approved') return <Badge tone={letter.moderation === 'returned' ? 'warning' : 'neutral'}>{moderationLabel[letter.moderation]}</Badge>
  const pair = state.pairs.find(p => p.id === letter.pairId)
  return <Badge tone={pair?.status === 'paused' && !d?.deliveredAt ? 'warning' : 'success'}>{d?.readAt ? '已阅读' : d?.deliveredAt ? '已送达' : pair?.status === 'paused' ? '审核通过 · 暂缓投递' : d?.printedAt ? '已打印 · 待交付' : pair?.channel === 'paper' ? '待打印' : '审核通过 · 待送达'}</Badge>
}
