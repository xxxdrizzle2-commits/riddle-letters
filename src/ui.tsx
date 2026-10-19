import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, Feather, Leaf, Mail, Check, HelpCircle } from 'lucide-react'
import type { AppState, Letter, Person } from './types'
import { formatDate, riddles } from './data'

export interface PageProps { state: AppState; actor: Person; notify: (message: string) => void }
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
    catch (e) { setError(e instanceof Error ? e.message : '暂时没能保存，请保留内容后再试一次。'); return false }
    finally { lock.current = false; setBusy(false) }
  }
  return { busy, error, run }
}
export function AttachmentView({ state, id }: { state: AppState; id?: string }) {
  const attachment = state.attachments.find(a => a.id === id); const [url, setUrl] = useState('')
  useEffect(() => { if (!attachment) { setUrl(''); return }; const objectUrl = URL.createObjectURL(attachment.blob); setUrl(objectUrl); return () => URL.revokeObjectURL(objectUrl) }, [attachment])
  return attachment && url ? <figure className="attachment"><img src={url} alt={`演示手写回信：${attachment.name}`} /><figcaption>{attachment.name} · 演示附件</figcaption></figure> : null
}
export function RiddleBlock({ id }: { id: string }) {
  const riddle = riddles.find(r => r.id === id); const [hint, setHint] = useState(false), [answer, setAnswer] = useState(false)
  if (!riddle) return null
  return <section className="riddle-block" aria-label="信里的小谜语"><div className="toolbar"><HelpCircle size={19}/><span>留给你的小谜语</span></div><p className="riddle-question">{riddle.question}</p><div className="toolbar"><button type="button" className="text-button" aria-expanded={hint} onClick={() => setHint(!hint)}>{hint ? '收起提示' : '给我一点提示'}</button><button type="button" className="text-button" aria-expanded={answer} onClick={() => setAnswer(!answer)}>{answer ? '收起谜底' : '看看谜底'}<ArrowRight size={15}/></button></div>{hint && <p className="muted">小提示：{riddle.hint}</p>}{answer && <p className="answer"><Check size={17}/>谜底：{riddle.answer}</p>}</section>
}
export function LetterPaper({ state, letter }: { state: AppState; letter: Letter }) {
  const author = state.people.find(p => p.id === letter.authorId)
  return <article className="letter-paper"><div className="letter-paper-top"><span><Feather size={17}/> 一封认真写下的信</span><span className="stamp"><Leaf size={24} strokeWidth={1.4}/></span></div><h2>{letter.title}</h2><div className="letter-meta">{author?.nickname} · {formatDate(letter.updatedAt)}</div><div className="letter-body">{letter.body.split('\n').map((line, i) => <p className={line ? undefined : 'letter-gap'} key={i}>{line || '\u00a0'}</p>)}</div>{letter.riddleId && <RiddleBlock key={letter.riddleId} id={letter.riddleId}/>}<AttachmentView state={state} id={letter.attachmentId}/><div className="letter-signature">见字如面，慢慢聊。<Leaf size={18}/></div></article>
}
export const moderationLabel = { draft: '草稿', pending: '等待审核', returned: '请修改', approved: '审核通过' }
export function LetterBadge({ state, letter }: { state: AppState; letter: Letter }) {
  const d = state.deliveries.find(d => d.letterId === letter.id)
  if (letter.moderation !== 'approved') return <Badge tone={letter.moderation === 'returned' ? 'warning' : 'neutral'}>{moderationLabel[letter.moderation]}</Badge>
  return <Badge tone="success">{d?.readAt ? '已阅读' : d?.deliveredAt ? '已送达' : d?.printedAt ? '已打印 · 待交付' : '待打印'}</Badge>
}
