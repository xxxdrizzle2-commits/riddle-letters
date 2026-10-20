import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useParams, useSearchParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, ArrowRight, Check, HeartHandshake, Printer, Send, Users } from 'lucide-react'
import { dispatch, formatDate, groupedResponseTasks, hasPermission, isOverdue, recipientForLetter } from '../data'
import type { AppState, Letter, Pair, Person } from '../types'
import { Badge, Empty, LetterBadge, LetterPaper, Notice, PageHeader, useAction } from '../ui'
import './Operations.css'

type Props = { state: AppState; actor: Person; notify: (message: string) => void; setDirty?: (dirty: boolean) => void; mode?: 'demo' | 'live' }
type TeacherTab = 'print' | 'deliver' | 'reply'
const nameOf = (state: AppState, id?: string) => state.people.find(person => person.id === id)?.nickname ?? '未指定'
const moderationLabel = { draft: '草稿', pending: '等待审核', returned: '需修改', approved: '审核通过' }

function useFocusedDetail(key: string) {
  useEffect(() => { window.scrollTo(0, 0); document.getElementById('main-content')?.focus({ preventScroll: true }) }, [key])
}

const teacherStages: { key: TeacherTab; label: string; description: string }[] = [
  { key: 'print', label: '待打印', description: '预览并核对审核通过的信纸' },
  { key: 'deliver', label: '待交付', description: '实际交给收件人后再记录' },
  { key: 'reply', label: '待回传', description: '协助孩子核对并提交回信' },
]

function teacherQueues(state: AppState, actor: Person): Record<TeacherTab, Letter[]> {
  const pairs = state.pairs.filter(pair => pair.teacherId === actor.id && pair.channel === 'paper' && pair.status !== 'ended')
  const letters = state.letters.filter(letter => pairs.some(pair => pair.id === letter.pairId) && letter.moderation === 'approved')
  const childIncoming = letters.filter(letter => pairs.some(pair => pair.id === letter.pairId && recipientForLetter(state, letter) === pair.childId))
  return {
    print: letters.filter(letter => !state.deliveries.find(item => item.letterId === letter.id)?.printedAt && !state.deliveries.find(item => item.letterId === letter.id)?.deliveredAt),
    deliver: letters.filter(letter => { const delivery = state.deliveries.find(item => item.letterId === letter.id); return !!delivery?.printedAt && !delivery.deliveredAt }),
    reply: childIncoming.filter(letter => state.deliveries.some(item => item.letterId === letter.id && item.deliveredAt) && state.tasks.some(task => task.letterId === letter.id && task.status === 'awaiting'))
      .sort((a, b) => Date.parse(state.tasks.find(task => task.letterId === a.id && task.status === 'awaiting')?.dueAt ?? state.clock) - Date.parse(state.tasks.find(task => task.letterId === b.id && task.status === 'awaiting')?.dueAt ?? state.clock)),
  }
}

function LetterTimeline({ state, letter }: { state: AppState; letter: Letter }) {
  const delivery = state.deliveries.find(item => item.letterId === letter.id)
  const review = state.reviews.filter(item => item.letterId === letter.id)
  return <ol className="letter-timeline" aria-label="信件进度">
    <li><span>信件写成</span><time>{formatDate(letter.createdAt)}</time></li>
    {review.map(item => <li key={item.id}><span>{item.decision === 'approved' ? '审核通过' : '退回修改'}{item.note && ` · ${item.note}`}</span><time>{formatDate(item.createdAt)}</time></li>)}
    {delivery?.printedAt && <li><span>已记录打印</span><time>{formatDate(delivery.printedAt)}</time></li>}
    {delivery?.deliveredAt && <li><span>已确认送达</span><time>{formatDate(delivery.deliveredAt)}</time></li>}
    {delivery?.readAt && <li><span>已打开阅读</span><time>{formatDate(delivery.readAt)}</time></li>}
  </ol>
}

const replySchema = z.object({ title: z.string().trim().max(60, '标题请控制在 60 个字以内。'), body: z.string().max(6000, '正文请控制在 6000 个字以内。') })
type ReplyValues = z.infer<typeof replySchema>

function TeacherReplyForm({ state, actor, original, pair, notify, onDirtyChange }: Props & { original: Letter; pair: Pair; onDirtyChange: (dirty: boolean) => void }) {
  const existing = state.letters.filter(letter => letter.replyTo === original.id && letter.authorId === pair.childId && letter.createdBy === actor.id).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).find(letter => ['draft', 'returned'].includes(letter.moderation))
    ?? state.letters.find(letter => letter.replyTo === original.id && letter.authorId === pair.childId && letter.createdBy === actor.id)
  const childSubmission = state.letters.find(letter => letter.authorId === pair.childId && letter.createdBy !== actor.id && letter.moderation === 'pending' && (letter.replyTo === original.id || letter.coveredLetterIds?.includes(original.id)))
  const [draftId, setDraftId] = useState(existing?.id ?? crypto.randomUUID())
  const persistedRef = useRef(!!existing)
  const revisionRef = useRef(existing?.revision ?? 0)
  const [file, setFile] = useState<File>()
  const [fileError, setFileError] = useState('')
  const [removeAttachment, setRemoveAttachment] = useState(false)
  const [childConfirmed, setChildConfirmed] = useState(false)
  const { run, busy, error } = useAction(notify)
  const form = useForm<ReplyValues>({ resolver: zodResolver(replySchema), mode: 'onBlur', defaultValues: { title: existing?.title ?? `给${nameOf(state, pair.volunteerId)}的回信`, body: existing?.body ?? '' } })
  const locked = existing?.moderation === 'pending' || existing?.moderation === 'approved'
  const attachmentId = state.letters.find(letter => letter.id === draftId)?.attachmentId ?? existing?.attachmentId
  const attachment = state.attachments.find(item => item.id === attachmentId)
  const paused = pair.status === 'paused'
  const watchTitle = form.watch('title')
  const watchBody = form.watch('body')
  const baseline = useRef(JSON.stringify({ title: existing?.title ?? `给${nameOf(state, pair.volunteerId)}的回信`, body: existing?.body ?? '' }))
  const dirty = JSON.stringify({ title: watchTitle, body: watchBody }) !== baseline.current || !!file || removeAttachment
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false) }, [dirty, onDirtyChange])

  async function save(submit: boolean) {
    if (fileError || locked) return
    if (submit && !(await form.trigger())) return
    const values = form.getValues()
    if (submit && paused) return
    if (submit && !childConfirmed) { form.setError('body', { message: '请先让小朋友核对代录内容，并确认。' }); return }
    if (submit && !values.body.trim() && !file && !(attachment && !removeAttachment)) { form.setError('body', { message: '代录一点想说的话，或选择手写回信图片，就可以提交。' }); return }
    await run(async () => {
      let id = draftId
      if (dirty || !persistedRef.current) {
        id = await dispatch(actor.id, { type: 'save-letter', id: draftId, pairId: pair.id, replyTo: original.id, title: values.title.trim() || `给${nameOf(state, pair.volunteerId)}的回信`, body: values.body, file, removeAttachment, expectedRevision: revisionRef.current })
        persistedRef.current = true
        revisionRef.current += 1
        baseline.current = JSON.stringify(values)
        setDraftId(id)
        setFile(undefined)
        setRemoveAttachment(false)
      }
      if (submit) {
        const coveredLetterIds = groupedResponseTasks(state, pair.childId).filter(group => group.pairId === pair.id).flatMap(group => group.tasks.filter(task => task.status === 'awaiting' && task.letterId).map(task => task.letterId))
        await dispatch(actor.id, { type: 'submit-letter', id, coveredLetterIds, confirmedByChild: true })
      }
    }, submit ? '回信已提交审核，通过后志愿者才能阅读。' : '代录草稿已保存，可以稍后继续。')
  }

  if (childSubmission) return <section className="panel stack"><h3>回信已经提交</h3><Badge>等待审核</Badge><p>孩子已从自己的信箱提交回信。请等待运营审核，这里无需重复代录。</p></section>
  if (locked) return <section className="panel stack"><h3>孩子的回信</h3><LetterBadge state={state} letter={existing}/><p>{existing.moderation === 'pending' ? '回信正在等待运营审核，通过后才会安排投递。' : '回信已通过审核，请继续查看投递和送达进度。'}</p><LetterPaper state={state} letter={existing} /></section>

  return <form className="panel stack" onSubmit={event => { event.preventDefault(); void save(true) }} aria-busy={busy}>
    <div><h3>把手写回信带回来</h3><p className="muted">请忠实代录孩子的表达，只上传信纸或小画，不上传个人照片和私人信息。</p></div>
    {paused && <Notice>这组陪伴已暂停。可以先保存草稿，恢复后再提交审核。</Notice>}
    {existing?.moderation === 'returned' && <Notice tone="warning">修改意见：{existing.moderationNote}</Notice>}
    {error && <Notice tone="error">{error}</Notice>}
    <div className="field"><label htmlFor="teacher-reply-title">回信标题（选填）</label><input id="teacher-reply-title" {...form.register('title', { onChange: () => setChildConfirmed(false) })} aria-invalid={!!form.formState.errors.title} aria-describedby={form.formState.errors.title ? 'teacher-title-error' : undefined} />{form.formState.errors.title && <p className="field-error" id="teacher-title-error">{form.formState.errors.title.message}</p>}</div>
    <div className="field"><label htmlFor="teacher-reply-body">代录正文（与图片至少填写一项）</label><textarea id="teacher-reply-body" rows={9} {...form.register('body', { onChange: () => setChildConfirmed(false) })} aria-invalid={!!form.formState.errors.body} aria-describedby="teacher-body-hint teacher-body-error" /><p className="muted small-text" id="teacher-body-hint">一句话也可以，最多 6000 字；未写完可以先保存草稿。</p>{form.formState.errors.body && <p className="field-error" id="teacher-body-error">{form.formState.errors.body.message}</p>}</div>
    <div className="field"><label htmlFor="teacher-reply-file">手写回信图片（选填）</label><input id="teacher-reply-file" type="file" accept="image/png,image/jpeg" aria-invalid={!!fileError} aria-describedby="teacher-upload-hint teacher-upload-error" onChange={event => { setChildConfirmed(false); const next = event.target.files?.[0]; if (!next) { setFile(undefined); setFileError(''); return } if (!['image/png', 'image/jpeg'].includes(next.type)) { setFile(undefined); setFileError('请选择 PNG 或 JPG 图片。'); return } if (next.size > 3 * 1024 * 1024) { setFile(undefined); setFileError('图片超过 3 MiB，请压缩后再选择。'); return } setFile(next); setFileError(''); setRemoveAttachment(false) }} /><p className="muted small-text" id="teacher-upload-hint">PNG / JPG，最大 3 MiB。只上传信纸或小画，也可以只代录文字。</p>{fileError && <p className="field-error" id="teacher-upload-error">{fileError}</p>}{file && <p>已选择：{file.name}</p>}{attachment && !file && <label className="checkbox-row"><input type="checkbox" checked={removeAttachment} onChange={event => { setRemoveAttachment(event.target.checked); setChildConfirmed(false) }} />移除已保存的附件：{attachment.name}</label>}</div>
    <div className="pre-submit-check"><strong>提交前，请小朋友核对</strong><p>标题：{watchTitle.trim() || `给${nameOf(state, pair.volunteerId)}的回信`}</p><p className="preserve-lines">正文：{watchBody.trim() || '使用手写图片'}</p>{file && <p>图片：{file.name}</p>}<p>审核通过前，这封回信不会进入志愿者的可读范围。</p><label className="checkbox-row"><input type="checkbox" checked={childConfirmed} onChange={event => setChildConfirmed(event.target.checked)} />小朋友已核对并同意提交这份代录</label></div>
    <div className="toolbar"><button className="btn secondary" type="button" disabled={busy} onClick={() => void save(false)}>保存代录草稿</button><button className="btn" type="submit" disabled={busy || paused || !childConfirmed}>{busy ? '正在保存…' : '提交回信审核'}<Send size={16} aria-hidden="true" /></button></div>
    {existing && <p className="muted small-text">上次保存：{formatDate(existing.updatedAt)}</p>}
  </form>
}

function TeacherStageWorkspace({ state, actor, notify, setDirty, mode = 'demo', stage }: Props & { stage: TeacherTab }) {
  const tab = stage
  const [searchParams, setSearchParams] = useSearchParams()
  const [selected, setSelected] = useState<string[]>([])
  const detailId = searchParams.get('letter') ?? ''
  useFocusedDetail(detailId)
  const [printOpened, setPrintOpened] = useState(false)
  const [printError, setPrintError] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [draftDirty, setDraftDirty] = useState(false)
  const reportDirty = useCallback((value: boolean) => { setDraftDirty(value); setDirty?.(value) }, [setDirty])
  const { run, busy, error } = useAction(notify)
  const pairs = state.pairs.filter(pair => pair.teacherId === actor.id && pair.channel === 'paper' && pair.status !== 'ended')
  const queues = teacherQueues(state, actor)
  const current = queues[tab]
  const detail = current.find(letter => letter.id === detailId)
  const completedLetter = !detail && detailId ? state.letters.find(letter => letter.id === detailId && pairs.some(pair => pair.id === letter.pairId)) : undefined
  const completedDelivery = state.deliveries.find(item => item.letterId === completedLetter?.id)
  const completedTask = state.tasks.find(item => item.letterId === completedLetter?.id)
  const selectedIds = detail ? state.pairs.find(pair => pair.id === detail.pairId)?.status === 'active' ? [detail.id] : [] : selected.filter(id => current.some(letter => letter.id === id && state.pairs.find(pair => pair.id === letter.pairId)?.status === 'active'))
  const detailPair = pairs.find(pair => pair.id === detail?.pairId)
  const printable = queues.print.filter(letter => selectedIds.includes(letter.id))
  const selectable = current.filter(letter => pairs.find(pair => pair.id === letter.pairId)?.status === 'active')

  useEffect(() => { setSelected([]); setConfirmed(false); setPrintOpened(false); setPrintError('') }, [tab, detailId])
  function allowLeave() { return !draftDirty || window.confirm('还有未保存的代录内容。切换前建议先保存草稿，仍要离开吗？') }
  function changeSelection(ids: string[]) { setSelected(ids); setConfirmed(false); setPrintOpened(false); setPrintError('') }
  async function openPrint() {
    setPrintError('')
    const area = document.querySelector('.teacher-print-area')
    if (!area || !printable.length) return
    const limit = Date.now() + 12000
    while (area.querySelector('[data-attachment-status="loading"]') && Date.now() < limit) await new Promise(resolve => window.setTimeout(resolve, 120))
    if (area.querySelector('[data-attachment-status="loading"], [data-attachment-status="error"]')) { setPrintError('手写图片还没有载入，暂时不能完整打印。请重新打开页面后再试。'); return }
    try { await Promise.all([...area.querySelectorAll<HTMLImageElement>('img')].map(image => image.decode())) }
    catch { setPrintError('有图片暂时不能打印，请刷新页面后重试。'); return }
    setPrintOpened(true); setConfirmed(false); window.print()
  }
  async function recordBatch(type: 'print' | 'deliver') {
    if (!confirmed || !selectedIds.length || (type === 'print' && !printOpened)) return
    const ok = await run(() => dispatch(actor.id, { type, ids: selectedIds }), type === 'print' ? '已记录打印，下一步请在实际交给孩子后确认交付。' : '已确认实际交付，回信期限从今天开始计算。')
    if (ok) { setSelected([]); setConfirmed(false); setPrintOpened(false) }
  }
  if (actor.role !== 'teacher') return <Empty title="这项任务需要老师身份" />

  return <div className="stack operations-page">
    <Link className="back-link" to={detailId ? `/teacher/tasks/${tab}` : '/space'} onClick={event => { if (!allowLeave()) event.preventDefault() }}><ArrowLeft size={16} aria-hidden="true" />{detailId ? `返回${teacherStages.find(item => item.key === tab)?.label}列表` : '返回收发任务'}</Link>
    <PageHeader eyebrow="老师收发任务" title={detail ? detail.title : teacherStages.find(item => item.key === tab)?.label ?? '收发任务'} description={detail ? `${nameOf(state, detail.authorId)}写给${nameOf(state, recipientForLetter(state, detail))}。请先核对，再记录这一站。` : teacherStages.find(item => item.key === tab)?.description ?? ''} />
    {completedLetter && tab === 'print' && completedDelivery?.printedAt && <Notice>这封信已记录打印。下一步请在实际交给收件人后确认交付。<Link className="text-button" to={`/teacher/tasks/deliver?letter=${encodeURIComponent(completedLetter.id)}`}>去待交付<ArrowRight size={16} aria-hidden="true" /></Link></Notice>}
    {completedLetter && tab === 'deliver' && completedDelivery?.deliveredAt && <Notice>已确认实际交付。收件人现在可以阅读或准备回信；孩子的纸质回信可在待回传中协助提交审核。<Link className="text-button" to="/teacher/tasks/reply">查看待回传<ArrowRight size={16} aria-hidden="true" /></Link></Notice>}
    {completedLetter && tab === 'reply' && completedTask?.status === 'review' && <Notice>回信正在等待运营审核，通过后才会安排投递。<Link className="text-button" to="/teacher/history">查看处理记录<ArrowRight size={16} aria-hidden="true" /></Link></Notice>}
    {error && <Notice tone="error">{error}</Notice>}
    <div className="teacher-stage-body">
      {!detail && <section className="panel task-list stack" aria-label="信件任务列表">
        <div className="section-title"><h2>{tab === 'print' ? '准备好信纸' : tab === 'deliver' ? '确认实际交付' : '等待孩子的回信'}</h2><span className="muted">{current.length} 封</span></div>
        {tab !== 'reply' && current.length > 0 && <label className="checkbox-row"><input type="checkbox" checked={selectable.length > 0 && selectedIds.length === selectable.length} onChange={event => changeSelection(event.target.checked ? selectable.map(letter => letter.id) : [])} disabled={selectable.length === 0} />全选可处理的信件</label>}
        {current.length === 0 && <Empty title="这一步暂时没有待办" description={tab === 'print' ? '审核通过的纸质信件会出现在这里。' : tab === 'deliver' ? '记录已打印后，就可以在这里确认交付。' : '交给孩子的来信会进入这里，等待孩子回信。'} />}
        <div className="stack compact">{current.map(letter => { const pair = pairs.find(item => item.id === letter.pairId)!; const task = state.tasks.find(item => item.letterId === letter.id); return <div key={letter.id} className="operation-letter-row">
          {tab !== 'reply' && <input type="checkbox" aria-label={`选择${letter.title}`} checked={selectedIds.includes(letter.id)} disabled={pair.status === 'paused' || busy} onChange={event => changeSelection(event.target.checked ? [...selectedIds, letter.id] : selectedIds.filter(id => id !== letter.id))} />}
          <button className="letter-select" type="button" onClick={() => { if (allowLeave()) setSearchParams({ letter: letter.id }) }}><strong>{letter.title}</strong><span>{nameOf(state, letter.authorId)} → {nameOf(state, recipientForLetter(state, letter))}</span><span className="letter-row-meta">{pair.status === 'paused' ? '陪伴已暂停' : task && tab === 'reply' ? `回应期限 ${formatDate(task.dueAt)}` : '审核已通过'}{task?.status === 'review' ? ' · 回信审核中' : task && isOverdue(state, task) ? ' · 已逾期，运营将跟进' : ''}</span></button>
        </div> })}</div>
      </section>}
      {detail && detailPair && <div className="stack teacher-detail">
        <section className="panel stack"><div className="section-title"><h2>这封信的内容</h2><Badge>{detailPair.channel === 'paper' ? '纸质往来' : '线上往来'}</Badge></div><LetterPaper state={state} letter={detail} /><LetterTimeline state={state} letter={detail} /></section>
        {detailPair.status === 'paused' && <Notice>这组陪伴已暂停。可以阅读记录并保存代录草稿，恢复后再提交或继续投递。</Notice>}
        {tab === 'reply' && <TeacherReplyForm key={detail.id} state={state} actor={actor} notify={notify} original={detail} pair={detailPair} onDirtyChange={reportDirty} />}
      </div>}
      {tab !== 'reply' && selectedIds.length > 0 && <section className="panel batch-actions stack">
          <h2>{detail ? '记录这一封信' : `批量处理 ${selectedIds.length} 封信`}</h2>
          <p>{tab === 'print' ? '请先预览 A4 信纸，核对打印结果。' : '请在实际交给收件人后确认。'}</p>
          {tab === 'print' && <button className="btn secondary" type="button" disabled={!selectedIds.length || busy} onClick={() => void openPrint()}><Printer size={17} aria-hidden="true" />打开打印预览</button>}
          {printError && <p className="field-error" role="alert">{printError}</p>}
          <label className="checkbox-row"><input type="checkbox" checked={confirmed} disabled={!selectedIds.length || (tab === 'print' && !printOpened)} onChange={event => setConfirmed(event.target.checked)} />{tab === 'print' ? '我已核对这些信件的打印结果' : '我确认已把这些信件交给对应孩子'}</label>
          <button className="btn" type="button" disabled={busy || !selectedIds.length || !confirmed || (tab === 'print' && !printOpened)} onClick={() => void recordBatch(tab)}>{busy ? '正在记录…' : tab === 'print' ? '记录已打印' : '确认实际交付'}</button>
          <p className="muted small-text">{tab === 'print' ? '打开打印窗口不会自动记为打印完成。已打印也不代表已交付。' : '请在真实交付后记录。交付日期将作为回信期限的起点。'}</p>
        </section>}
    </div>
    {printable.length > 0 && createPortal(<div className="teacher-print-area" aria-hidden="true">{printable.map(letter => <article className="print-letter" key={letter.id}><p className="print-label">谜语书信 · {mode === 'demo' ? '演示书信 / 合成内容' : '书信陪伴计划'}</p><p>亲爱的 {nameOf(state, recipientForLetter(state, letter))}：</p><LetterPaper state={state} letter={letter} /><p className="print-signature">来自 {nameOf(state, letter.authorId)}<br />{formatDate(letter.createdAt)}</p></article>)}</div>, document.body)}
  </div>
}

export function TeacherPage({ state, actor }: Props) {
  if (actor.role !== 'teacher') return <Empty title="这项任务需要老师身份" />
  const queues = teacherQueues(state, actor)
  const urgentReply = queues.reply.map(letter => ({ letter, task: state.tasks.find(task => task.letterId === letter.id && task.status === 'awaiting') }))
    .filter(item => item.task && state.pairs.find(pair => pair.id === item.letter.pairId)?.status === 'active')
    .sort((a, b) => Date.parse(a.task!.dueAt) - Date.parse(b.task!.dueAt))[0]
  const soon = urgentReply && Date.parse(urgentReply.task!.dueAt) - Date.parse(state.clock) <= 3 * 24 * 60 * 60 * 1000
  const next = soon ? { stage: 'reply' as const, letter: urgentReply.letter, label: isOverdue(state, urgentReply.task!) ? '先协助这封逾期回信' : '先协助这封临近期限的回信', description: `回应约定于 ${formatDate(urgentReply.task!.dueAt)} 前完成。先了解孩子是否需要帮助。` }
    : queues.deliver[0] ? { stage: 'deliver' as const, letter: queues.deliver[0], label: '先确认这一封是否已交付', description: '信件已打印，请在实际交给收件人后记录交付。' }
    : queues.print[0] ? { stage: 'print' as const, letter: queues.print[0], label: '先准备打印这一封信', description: '审核已通过。预览 A4 信纸并核对后，再记录打印。' }
    : urgentReply ? { stage: 'reply' as const, letter: urgentReply.letter, label: '留意这封信的回信', description: `回应约定于 ${formatDate(urgentReply.task!.dueAt)} 前完成。` }
    : undefined
  return <div className="stack operations-page">
    <PageHeader eyebrow="收发任务" title="今天，先照顾好这一封。" description="信件依次经过打印、实际交付与回信。每一步都由你确认后才会进入下一站。" />
    {next ? <section className="operations-next panel stack" aria-label="现在最需要处理的任务">
      <p className="eyebrow">现在最需要处理</p><h2>{next.label}</h2><p><strong>{next.letter.title}</strong> · {nameOf(state, next.letter.authorId)}写给{nameOf(state, recipientForLetter(state, next.letter))}</p><p className="muted">{next.description}</p>
      <Link className="btn" to={`/teacher/tasks/${next.stage}?letter=${encodeURIComponent(next.letter.id)}`}>查看并处理这封信<ArrowRight size={17} aria-hidden="true" /></Link>
    </section> : <section className="panel stack"><h2>今天没有需要立即处理的信</h2><p className="muted">审核通过的纸质信会出现在待打印列表。也可以查看以往的收发记录。</p><Link className="btn secondary" to="/teacher/history">查看处理记录</Link></section>}
    <section className="stack" aria-label="三步收发任务"><div className="section-title"><h2>按步骤查看任务</h2></div><div className="teacher-stage-cards">{teacherStages.map(stage => <Link className="teacher-stage-card" to={`/teacher/tasks/${stage.key}`} key={stage.key}><span className="eyebrow">{stage.key === 'print' ? '第一步' : stage.key === 'deliver' ? '第二步' : '第三步'}</span><strong>{stage.label}<span className="teacher-stage-count">{queues[stage.key].length}</span></strong><span>{stage.description}</span><span className="teacher-stage-link">进入{stage.label}<ArrowRight size={16} aria-hidden="true" /></span></Link>)}</div></section>
    <Link className="text-button" to="/teacher/history">查看以往处理记录<ArrowRight size={16} aria-hidden="true" /></Link>
  </div>
}

export function TeacherQueuePage(props: Props) {
  const { stage } = useParams()
  if (stage !== 'print' && stage !== 'deliver' && stage !== 'reply') return <Empty title="没有这项收发任务" description="请从收发任务首页选择打印、交付或回传。"><Link className="btn secondary" to="/space">返回收发任务</Link></Empty>
  return <TeacherStageWorkspace {...props} stage={stage} />
}

export function TeacherHistoryPage({ state, actor }: Props) {
  const [searchParams, setSearchParams] = useSearchParams()
  useFocusedDetail(searchParams.get('letter') ?? '')
  if (actor.role !== 'teacher') return <Empty title="这项任务需要老师身份" />
  const pairIds = new Set(state.pairs.filter(pair => pair.teacherId === actor.id && pair.channel === 'paper').map(pair => pair.id))
  const letters = state.letters.filter(letter => pairIds.has(letter.pairId) && letter.moderation === 'approved').sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  const detail = letters.find(letter => letter.id === searchParams.get('letter'))
  return <div className="stack operations-page">
    <Link className="back-link" to={detail ? '/teacher/history' : '/space'}><ArrowLeft size={16} aria-hidden="true" />{detail ? '返回处理记录' : '返回收发任务'}</Link>
    <PageHeader eyebrow="老师处理记录" title={detail ? detail.title : '每一步，都有记录。'} description={detail ? '这里分别记录审核、打印、交付与阅读。' : '已打印不等于已交付；信件仍需由老师确认实际交给收件人。'} />
    {detail ? <section className="panel stack"><p>{nameOf(state, detail.authorId)} → {nameOf(state, recipientForLetter(state, detail))}</p><LetterPaper state={state} letter={detail} /><LetterTimeline state={state} letter={detail} /></section>
      : <section className="panel stack task-list" aria-label="历史信件列表">{letters.length ? letters.map(letter => { const delivery = state.deliveries.find(item => item.letterId === letter.id); return <button className="operation-letter-row letter-select" type="button" key={letter.id} onClick={() => setSearchParams({ letter: letter.id })}><strong>{letter.title}</strong><span>{nameOf(state, letter.authorId)} → {nameOf(state, recipientForLetter(state, letter))}</span><span className="letter-row-meta">{delivery?.deliveredAt ? '已交付' : delivery?.printedAt ? '已打印，待交付' : '待打印'} · {formatDate(letter.updatedAt)}</span></button> }) : <Empty title="还没有纸质书信记录" description="审核通过的纸质信件会按收发进度记录在这里。" />}</section>}
  </div>
}

function ReviewQueue({ state, actor, notify }: Props) {
  const [mode, setMode] = useState<'pending' | 'history'>('pending')
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('letter') ?? ''
  useFocusedDetail(selectedId)
  const [note, setNote] = useState('')
  const [validation, setValidation] = useState('')
  const [confirmApprove, setConfirmApprove] = useState(false)
  const { run, busy, error } = useAction(notify)
  const letters = state.letters.filter(letter => mode === 'pending' ? letter.moderation === 'pending' : ['approved', 'returned'].includes(letter.moderation))
  const letter = letters.find(item => item.id === selectedId)
  const pair = state.pairs.find(item => item.id === letter?.pairId)
  useEffect(() => { setNote(''); setValidation(''); setConfirmApprove(false) }, [letter?.id])
  async function review(decision: 'approved' | 'returned') {
    if (!letter) return
    if (decision === 'returned' && note.trim().length < 4) { setValidation('请写下至少 4 个字的具体修改建议。'); document.getElementById('review-note')?.focus(); return }
    const success = decision === 'returned' ? '已退回修改，原信与修改建议均已保留。' : pair?.status === 'paused' ? '审核通过，陪伴恢复后安排投递。' : pair?.channel === 'paper' ? '审核通过，已进入老师的待打印列表。' : '审核通过，已送到收件人的信箱。'
    const ok = await run(() => dispatch(actor.id, { type: 'review-letter', id: letter.id, decision, note: note.trim() }), success)
    if (ok) { setNote(''); setConfirmApprove(false); setSearchParams({}) }
  }
  return <div className="stack">{letter && <Link className="back-link" to="/operator/review" onClick={event => { event.preventDefault(); setSearchParams({}) }}><ArrowLeft size={16} aria-hidden="true" />返回审核列表</Link>}
    {!letter && <div className="toolbar"><button type="button" className={`btn small ${mode === 'pending' ? '' : 'secondary'}`} aria-pressed={mode === 'pending'} onClick={() => { setMode('pending'); setSearchParams({}) }}>等待审核</button><button type="button" className={`btn small ${mode === 'history' ? '' : 'secondary'}`} aria-pressed={mode === 'history'} onClick={() => { setMode('history'); setSearchParams({}) }}>已审记录</button></div>}
    <div className="operation-focus">{!letter && <section className="panel stack task-list"><div className="section-title"><h2>{mode === 'pending' ? '每一封都值得认真读' : '保留每一次审核记录'}</h2><span className="muted">{letters.length} 封</span></div>{!letters.length && <Empty title={mode === 'pending' ? '待审信件已处理完' : '暂时没有已审信件'} description="新的来信和回信提交后会出现在这里。" />}<div className="stack compact">{letters.map(item => <button key={item.id} type="button" className="operation-letter-row letter-select" onClick={() => setSearchParams({ letter: item.id })}><strong>{item.title}</strong><span>{nameOf(state, item.authorId)} · {item.replyTo ? '回信' : '来信'}</span><span className="letter-row-meta">{moderationLabel[item.moderation]} · {formatDate(item.updatedAt)}</span></button>)}</div></section>}
      {letter && pair && <section className="panel stack"><div className="section-title"><h2>{mode === 'pending' ? '阅读与审核' : '信件与审核记录'}</h2><Badge>{letter.authorId === pair.childId ? '孩子写给志愿者' : '志愿者写给孩子'}</Badge></div><p className="muted">{nameOf(state, letter.authorId)} → {nameOf(state, recipientForLetter(state, letter))} · {pair.channel === 'paper' ? '纸质' : '线上'}往来</p><LetterPaper state={state} letter={letter} />{(letter.submissionVersions?.length ?? 0) > 1 && <details className="version-history"><summary>查看以前提交的版本（{letter.submissionVersions!.length} 次）</summary>{letter.submissionVersions!.slice(0,-1).map(version => <article key={version.revision}><p className="muted small-text">第 {version.revision} 版 · {formatDate(version.submittedAt)}</p><h3>{version.title}</h3><p className="preserve-lines">{version.body}</p></article>)}</details>}{mode === 'pending' ? <>
        <Notice>留意私人联系方式、具体住址及不适合分享的内容。表达难过或求助时，请用下方「跟进」中的受限流程给予支持。</Notice>
        {pair.status === 'ended' && <Notice tone="warning">这段结对已经结束。请退回尚未寄出的信件，并向写信人说明后续安排。</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        <div className="field"><label htmlFor="review-note">审核备注 / 修改建议（退回时必填）</label><textarea id="review-note" rows={3} value={note} onChange={event => { setNote(event.target.value); setValidation('') }} aria-invalid={!!validation} aria-describedby="review-note-help review-note-error" /><p id="review-note-help" className="muted small-text">请告诉写信人哪里需要调整、可以怎样写。原信会保留。</p>{validation && <p id="review-note-error" className="field-error">{validation}</p>}</div>
        {confirmApprove ? <div className="pre-submit-check stack"><strong>确认这封信可以送往下一站？</strong><p>{pair.status === 'paused' ? '陪伴暂停中，审核通过后会等待恢复再投递。' : pair.channel === 'paper' ? '通过后由负责老师打印并确认实际交付；回应期限从交付时开始。' : '通过后会送到收件人的信箱。'}如果这封信回应了待办，审核通过后回应任务会完成；投递继续单独记录。</p><div className="toolbar"><button type="button" className="btn" disabled={busy} onClick={() => void review('approved')}>确认通过审核</button><button type="button" className="btn secondary" disabled={busy} onClick={() => setConfirmApprove(false)}>再检查一下</button></div></div> : <div className="toolbar"><button type="button" className="btn secondary" disabled={busy} onClick={() => void review('returned')}>退回修改</button><button type="button" className="btn" disabled={busy || pair.status === 'ended'} onClick={() => setConfirmApprove(true)}><Check size={16} aria-hidden="true" />通过审核</button></div>}
      </> : <LetterTimeline state={state} letter={letter} />}</section>}
    </div>
  </div>
}

function Matching({ state, actor, notify, mode = 'demo' }: Props) {
  const [childId, setChildId] = useState('')
  const [volunteerId, setVolunteerId] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [channel, setChannel] = useState<'online' | 'paper'>('online')
  const [pauseId, setPauseId] = useState('')
  const [pauseReason, setPauseReason] = useState('')
  const [endId, setEndId] = useState('')
  const [endReason, setEndReason] = useState('')
  const [validation, setValidation] = useState('')
  const { run, busy, error } = useAction(notify)
  const children = state.people.filter(person => person.role === 'child' && !state.pairs.some(pair => pair.status !== 'ended' && pair.childId === person.id) && (mode === 'demo' || person.accountStatus === 'active' && person.guardianConsent && person.teacherId))
  const volunteers = state.people.filter(person => person.role === 'volunteer' && !state.pairs.some(pair => pair.status !== 'ended' && pair.volunteerId === person.id) && (mode === 'demo' || person.accountStatus === 'active' && person.volunteerApproved))
  const teachers = state.people.filter(person => person.role === 'teacher' && (mode === 'demo' || person.accountStatus === 'active'))
  const currentChild = children.some(person => person.id === childId) ? childId : children[0]?.id ?? ''
  const currentVolunteer = volunteers.some(person => person.id === volunteerId) ? volunteerId : volunteers[0]?.id ?? ''
  const eligibleTeachers = mode === 'live' && state.people.find(person => person.id === currentChild)?.teacherId ? teachers.filter(person => person.id === state.people.find(child => child.id === currentChild)?.teacherId) : teachers
  const currentTeacher = eligibleTeachers.some(person => person.id === teacherId) ? teacherId : eligibleTeachers[0]?.id ?? ''
  async function match() {
    if (!currentChild || !currentVolunteer || !currentTeacher) return
    await run(() => dispatch(actor.id, { type: 'match', childId: currentChild, volunteerId: currentVolunteer, teacherId: currentTeacher, channel }), '结对已建立，志愿者现在可以写第一封信。')
  }
  async function pause(pair: Pair) {
    if (pauseReason.trim().length < 2) { setValidation('请填写暂停原因，至少 2 个字。'); return }
    const ok = await run(() => dispatch(actor.id, { type: 'pause-pair', id: pair.id, reason: pauseReason.trim() }), '陪伴已暂停，暂停期间停止催办。')
    if (ok) { setPauseId(''); setPauseReason(''); setValidation('') }
  }
  async function end(pair: Pair) {
    if (endReason.trim().length < 2) { setValidation('请填写结束原因，至少 2 个字。'); return }
    const ok = await run(() => dispatch(actor.id, { type: 'end-pair', id: pair.id, reason: endReason.trim() }), '这段结对已结束，历史往来仍归原伙伴查看。可以重新安排结对。')
    if (ok) { setEndId(''); setEndReason(''); setValidation('') }
  }
  return <div className="stack">{error && <Notice tone="error">{error}</Notice>}<div className="matching-grid"><form className="panel stack" onSubmit={event => { event.preventDefault(); void match() }} aria-busy={busy}><div className="section-title"><h2>让一段陪伴开始</h2><HeartHandshake size={21} aria-hidden="true" /></div><p className="muted">每组陪伴由一位孩子、一位志愿者和一位协助老师组成。</p>{children.length && volunteers.length ? <>
      <div className="field"><label htmlFor="match-child">待结对的小朋友</label><select id="match-child" value={currentChild} onChange={event => setChildId(event.target.value)} required>{children.map(person => <option value={person.id} key={person.id}>{person.nickname} · {person.subtitle}</option>)}</select></div>
      <div className="field"><label htmlFor="match-volunteer">可结对的志愿者</label><select id="match-volunteer" value={currentVolunteer} onChange={event => setVolunteerId(event.target.value)} required>{volunteers.map(person => <option value={person.id} key={person.id}>{person.nickname} · {person.subtitle}</option>)}</select></div>
      <div className="field"><label htmlFor="match-teacher">协助老师</label><select id="match-teacher" value={currentTeacher} onChange={event => setTeacherId(event.target.value)} required>{eligibleTeachers.map(person => <option value={person.id} key={person.id}>{person.nickname}</option>)}</select></div>
      <fieldset className="channel-options"><legend>书信送达方式</legend><label><input type="radio" name="channel" value="online" checked={channel === 'online'} onChange={() => setChannel('online')} /><span><strong>线上收信</strong><small>审核通过后，进入孩子的信箱。</small></span></label><label><input type="radio" name="channel" value="paper" checked={channel === 'paper'} onChange={() => setChannel('paper')} /><span><strong>纸质收发</strong><small>老师打印并确认实际交付，再回传回信。</small></span></label></fieldset>
      <div className="pre-submit-check"><p>{nameOf(state, currentChild)} ↔ {nameOf(state, currentVolunteer)}</p><p>由 {nameOf(state, currentTeacher)} 协助，采用{channel === 'online' ? '线上' : '纸质'}往来。</p></div><button type="submit" className="btn" disabled={busy || !currentTeacher}><Users size={17} aria-hidden="true" />{busy ? '正在建立…' : '建立结对'}</button>
    </> : <Empty title={children.length ? '暂时没有可结对的志愿者' : '暂时没有符合条件的待结对孩子'} description={mode === 'live' ? '请在“加入与账号”中检查监护授权、负责老师绑定和志愿者审核状态。' : '暂停中的结对仍保留原来的伙伴关系。'} />}</form>
      <section className="panel stack"><h2>伙伴与结对记录</h2>{!state.pairs.length && <Empty title="还没有结对" description="从左侧选择伙伴，开始第一段陪伴。" />}<div className="stack">{state.pairs.map(pair => <article className="pair-row stack" key={pair.id}><div className="section-title"><strong>{nameOf(state, pair.childId)} ↔ {nameOf(state, pair.volunteerId)}</strong><Badge tone={pair.status === 'active' ? 'success' : 'warning'}>{pair.status === 'paused' ? '暂停中' : pair.status === 'ended' ? '已结束' : '陪伴中'}</Badge></div><p className="muted small-text">{nameOf(state, pair.teacherId)} 协助 · {pair.channel === 'paper' ? '纸质收发' : '线上收信'} · {formatDate(pair.startedAt)} 开始</p>{pair.status === 'paused' && <p className="small-text">暂停原因：{pair.pauseReason}<br />暂停于 {formatDate(pair.pausedAt ?? '')}，恢复后按暂停时长顺延未完成回信期限。</p>}{pair.status === 'ended' && <p className="small-text">{formatDate(pair.endedAt ?? pair.startedAt)} 结束 · {pair.endReason}</p>}{pauseId === pair.id || endId === pair.id ? <div className="stack compact"><div className="field"><label htmlFor={`pair-reason-${pair.id}`}>{pauseId === pair.id ? '暂停原因' : '结束原因'}（必填）</label><input id={`pair-reason-${pair.id}`} value={pauseId === pair.id ? pauseReason : endReason} onChange={event => { pauseId === pair.id ? setPauseReason(event.target.value) : setEndReason(event.target.value); setValidation('') }} placeholder={pauseId === pair.id ? '例如：学校放假，暂时无法收发' : '例如：志愿者无法继续参与'} aria-invalid={!!validation} aria-describedby={validation ? `pair-error-${pair.id}` : undefined} />{validation && <p id={`pair-error-${pair.id}`} className="field-error">{validation}</p>}</div><p className="muted small-text">{pauseId === pair.id ? '暂停期间停止催办，已有信件和记录会保留。' : '结束后停止新信往来，原伙伴仍可查看自己的历史。'}</p><div className="toolbar"><button className="btn small" type="button" disabled={busy} onClick={() => pauseId === pair.id ? void pause(pair) : void end(pair)}>{pauseId === pair.id ? '确认暂停' : '确认结束结对'}</button><button className="btn secondary small" type="button" onClick={() => { setPauseId(''); setEndId(''); setValidation('') }}>取消</button></div></div> : pair.status !== 'ended' && <div className="toolbar"><button className="btn secondary small" type="button" disabled={busy} onClick={() => pair.status === 'paused' ? void run(() => dispatch(actor.id, { type: 'resume-pair', id: pair.id }), '陪伴已恢复，未完成回信期限已按暂停时长顺延。') : (setPauseId(pair.id), setEndId(''), setPauseReason(''), setValidation(''))}>{pair.status === 'paused' ? '恢复陪伴' : '暂停 / 假期'}</button><button className="btn secondary small" type="button" disabled={busy} onClick={() => { setEndId(pair.id); setPauseId(''); setEndReason(''); setValidation('') }}>结束结对</button></div>}</article>)}</div></section>
    </div></div>
}

function FollowupQueue({ state, actor, notify, mode = 'demo' }: Props) {
  const [filter, setFilter] = useState<'open' | 'resolved'>('open')
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('item') ?? ''
  useFocusedDetail(selectedId)
  const [resolution, setResolution] = useState('')
  const [validation, setValidation] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [nextDate, setNextDate] = useState('')
  const [extensionDate, setExtensionDate] = useState('')
  const [extensionReason, setExtensionReason] = useState('')
  const { run, busy, error } = useAction(notify)
  const items = state.followups.filter(item => item.status === filter && (item.kind === 'help' ? hasPermission(actor, 'safeguarding') : hasPermission(actor, 'administration')))
    .sort((a, b) => (a.kind === 'help' ? 0 : 1) - (b.kind === 'help' ? 0 : 1) || Date.parse(a.createdAt) - Date.parse(b.createdAt))
  const selected = items.find(item => item.id === selectedId)
  const pair = state.pairs.find(item => item.id === selected?.pairId)
  const task = state.tasks.find(item => item.id === selected?.taskId)
  useEffect(() => { setResolution(''); setValidation(''); setOwnerId(selected?.ownerId || ''); setNextDate(''); setExtensionDate(''); setExtensionReason('') }, [selected?.id])
  const nextFollowupAt = nextDate ? new Date(`${nextDate}T09:00:00+08:00`).toISOString() : undefined
  async function resolve() {
    if (!selected) return
    if (resolution.trim().length < 4) { setValidation('请至少写 4 个字，记录采取了什么行动。'); return }
    const ok = await run(() => dispatch(actor.id, { type: 'resolve-followup', id: selected.id, note: resolution.trim(), nextFollowupAt }), '处理结果已保存，可以在已处理记录中查看。')
    if (ok) setSearchParams({})
  }
  async function assign() {
    if (!selected || !ownerId) return
    await run(() => dispatch(actor.id, { type: 'assign-followup', id: selected.id, ownerId, nextFollowupAt }), '负责人和下次跟进时间已保存。')
  }
  async function reopen() {
    if (!selected || resolution.trim().length < 4) { setValidation('请至少写 4 个字，说明重新跟进的原因。'); return }
    const ok = await run(() => dispatch(actor.id, { type: 'reopen-followup', id: selected.id, note: resolution.trim(), nextFollowupAt }), '事项已重新打开。')
    if (ok) setSearchParams({})
  }
  async function extend() {
    if (!task || extensionReason.trim().length < 2 || !extensionDate) { setValidation('请选择新期限，并写明延期原因。'); return }
    await run(() => dispatch(actor.id, { type: 'extend-task', id: task.id, dueAt: new Date(`${extensionDate}T23:59:00+08:00`).toISOString(), reason: extensionReason.trim() }), '回应期限已顺延，原因已记录。')
  }
  const owners = state.people.filter(person => person.role === 'operator' && hasPermission(person, selected?.kind === 'help' ? 'safeguarding' : 'administration'))
  return <div className="stack">
    {selected && <Link className="back-link" to="/operator/followups" onClick={event => { event.preventDefault(); setSearchParams({}) }}><ArrowLeft size={16} aria-hidden="true" />返回跟进列表</Link>}
    {!selected && <div className="toolbar">
      <button type="button" className={`btn small ${filter === 'open' ? '' : 'secondary'}`} aria-pressed={filter === 'open'} onClick={() => { setFilter('open'); setSearchParams({}) }}>等待跟进</button>
      <button type="button" className={`btn small ${filter === 'resolved' ? '' : 'secondary'}`} aria-pressed={filter === 'resolved'} onClick={() => { setFilter('resolved'); setSearchParams({}) }}>已处理记录</button>
    </div>}
    <div className="operation-focus">
      {!selected && <section className="panel stack task-list">
        <h2>{filter === 'open' ? '需要多一份留意' : '已经做过的照顾'}</h2>
        {!items.length && <Empty title={filter === 'open' ? '目前没有待跟进事项' : '还没有处理记录'} description="求助与达到期限的回应任务会形成跟进事项。" />}
        <div className="stack compact">{items.map(item => <button key={item.id} type="button" className="operation-letter-row letter-select" onClick={() => setSearchParams({ item: item.id })}>
          <strong>{item.kind === 'help' ? '一份需要认真倾听的求助' : '书信回应进度'}</strong>
          <span>{item.requesterId ? nameOf(state, item.requesterId) : nameOf(state, state.pairs.find(pair => pair.id === item.pairId)?.childId)}</span>
          <span className="letter-row-meta">{formatDate(item.createdAt)} · {item.status === 'resolved' ? '已处理' : '待跟进'}</span>
        </button>)}</div>
      </section>}
      {selected && <section className="panel stack">
        <div className="section-title"><h2>{selected.kind === 'help' ? '先听听发生了什么' : '了解书信的进展'}</h2><Badge tone={selected.kind === 'help' ? 'warning' : undefined}>{selected.kind === 'help' ? '仅有求助权限的运营可见' : '回应待跟进'}</Badge></div>
        {pair && <p className="muted">{nameOf(state, pair.childId)} ↔ {nameOf(state, pair.volunteerId)} · {nameOf(state, pair.teacherId)} 协助</p>}
        <div className="followup-note">{selected.note}</div>
        {task && <p>回应期限：{formatDate(task.dueAt)}；当前状态：{task.status === 'completed' ? '回应已完成' : task.status === 'review' ? '信件审核中' : pair?.status === 'paused' ? '陪伴暂停中' : '等待回应'}。</p>}
        {selected.kind === 'help' && <Notice>这是受限的求助记录。先理解表达，再安排合适的人处理；不要自动分享给被反映的人。</Notice>}
        <div className="inline-operation">
          <div className="field"><label htmlFor="followup-owner">负责运营</label><select id="followup-owner" value={ownerId} onChange={event => setOwnerId(event.target.value)}><option value="">请选择负责人</option>{owners.map(person => <option key={person.id} value={person.id}>{person.nickname}</option>)}</select></div>
          <div className="field"><label htmlFor="followup-next">下次跟进日期（可选）</label><input id="followup-next" type="date" value={nextDate} onChange={event => setNextDate(event.target.value)} /></div>
          <div className="toolbar"><button className="btn secondary small" type="button" disabled={busy || !ownerId} onClick={() => void assign()}>保存负责人和日期</button></div>
        </div>
        {selected.status === 'resolved' && <div className="pre-submit-check"><h3>处理结果</h3><p className="preserve-lines">{selected.resolution}</p><p className="muted small-text">记录于 {formatDate(selected.updatedAt)}</p></div>}
        {selected.history?.length ? <details className="version-history"><summary>查看处理记录（{selected.history.length} 条）</summary>{selected.history.map((item, index) => <article key={index}><p className="muted small-text">{nameOf(state, item.actorId)} · {formatDate(item.at)}</p><p className="preserve-lines">{item.note}</p></article>)}</details> : null}
        {error && <Notice tone="error">{error}</Notice>}
        {task && task.status !== 'completed' && hasPermission(actor, 'administration') && <div className="inline-operation">
          <div className="field"><label htmlFor="extension-date">新的回应期限</label><input id="extension-date" type="date" value={extensionDate} onChange={event => setExtensionDate(event.target.value)} /></div>
          <div className="field"><label htmlFor="extension-reason">延期原因</label><input id="extension-reason" value={extensionReason} onChange={event => setExtensionReason(event.target.value)} placeholder="例如学校假期暂时不能收发" /></div>
          <div className="toolbar"><button className="btn secondary small" type="button" disabled={busy} onClick={() => void extend()}>记录延期</button></div>
        </div>}
        <div className="field"><label htmlFor="followup-resolution">{selected.status === 'resolved' ? '重新跟进的原因' : '处理结果与下一步'}</label><textarea id="followup-resolution" rows={5} value={resolution} onChange={event => { setResolution(event.target.value); setValidation('') }} aria-invalid={!!validation} aria-describedby="followup-help followup-error" /><p id="followup-help" className="muted small-text">记录采取的行动，至少 4 个字。{mode === 'demo' ? '演示中仅填写合成信息。' : '请只记录处理所需的信息。'}</p>{validation && <p id="followup-error" className="field-error" role="alert">{validation}</p>}</div>
        <button type="button" className="btn" disabled={busy || !resolution.trim()} onClick={() => selected.status === 'resolved' ? void reopen() : void resolve()}>{selected.status === 'resolved' ? '重新打开事项' : '保存处理结果'}</button>
      </section>}
    </div>
  </div>
}

export function OperatorPage({ state, actor, mode = 'demo' }: Props) {
  if (actor.role !== 'operator') return <Empty title="这项任务需要运营身份" />
  const canHelp = hasPermission(actor, 'safeguarding')
  const canAdmin = hasPermission(actor, 'administration')
  const canReview = hasPermission(actor, 'review')
  if (!canHelp && !canAdmin && !canReview) return <Empty title="当前身份还没有运营任务权限" description="请联系管理员分配对应职责。" />
  const help = canHelp ? state.followups.filter(item => item.kind === 'help' && item.status === 'open') : []
  const overdue = canAdmin ? state.followups.filter(item => item.kind === 'overdue' && item.status === 'open') : []
  const reviews = canReview ? state.letters.filter(letter => letter.moderation === 'pending').sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt)) : []
  const unmatched = canAdmin ? state.people.filter(person => person.role === 'child' && !state.pairs.some(pair => pair.status !== 'ended' && pair.childId === person.id) && (mode === 'demo' || person.accountStatus === 'active' && person.guardianConsent && person.teacherId)) : []
  const priorities = [
    ...(canHelp ? [{ key: 'help', label: '需要回应的求助', count: help.length, to: help[0] ? `/operator/followups?item=${encodeURIComponent(help[0].id)}` : '/operator/followups', queue: '/operator/followups', description: '受限记录，请先倾听并安排合适的负责人。' }] : []),
    ...(canAdmin ? [{ key: 'overdue', label: '需要了解的逾期', count: overdue.length, to: overdue[0] ? `/operator/followups?item=${encodeURIComponent(overdue[0].id)}` : '/operator/followups', queue: '/operator/followups', description: '了解是否遇到困难，再决定延期或暂停。' }] : []),
    ...(canReview ? [{ key: 'review', label: '等待逐封审核', count: reviews.length, to: reviews[0] ? `/operator/review?letter=${encodeURIComponent(reviews[0].id)}` : '/operator/review', queue: '/operator/review', description: '阅读信件并决定通过或给出具体修改建议。' }] : []),
    ...(canAdmin ? [{ key: 'pair', label: '等待安排结对', count: unmatched.length, to: '/operator/pairs', queue: '/operator/pairs', description: '核对伙伴与协助老师，建立一段陪伴。' }] : []),
  ]
  const first = priorities.find(item => item.count > 0)
  return <div className="stack operations-page">
    <PageHeader eyebrow="运营待处理" title="照顾好每一次往来。" description="先看需要及时回应的事，再处理审核、结对与日常跟进。" />
    {first ? <section className="operations-next panel stack"><p className="eyebrow">现在最需要处理</p><h2>{first.label}</h2><p className="muted">{first.description}</p><Link className="btn" to={first.to}>查看并处理<ArrowRight size={17} aria-hidden="true" /></Link></section>
      : <section className="panel stack"><h2>眼下没有待处理事项</h2><p className="muted">新的求助、逾期、信件或待结对伙伴出现时，会在下面的列表中更新。</p></section>}
    <section className="stack" aria-label="运营任务分类"><h2>按优先顺序查看</h2><div className="operator-priority-list">{priorities.map(item => <Link className="operator-priority-item" key={item.key} to={item.queue}><span className="operator-priority-count">{item.count}</span><span><strong>{item.label}</strong><small>{item.description}</small></span><ArrowRight size={18} aria-hidden="true" /></Link>)}</div></section>
    {canHelp && canAdmin && <p className="muted small-text">求助记录只在具有求助处理权限的运营视图中显示，不会自动分享给被反映的人。</p>}
  </div>
}

export function OperatorReviewPage(props: Props) {
  const [searchParams] = useSearchParams()
  if (props.actor.role !== 'operator' || !hasPermission(props.actor, 'review')) return <Empty title="这项任务需要内容审核权限" />
  return <div className="stack operations-page">{!searchParams.has('letter') && <Link className="back-link" to="/space"><ArrowLeft size={16} aria-hidden="true" />返回运营待处理</Link>}<PageHeader eyebrow="内容审核" title="逐封读，认真回应。" description="先阅读完整来信，再决定送往下一站或写下具体修改建议。" /><ReviewQueue {...props} /></div>
}

export function OperatorPairsPage(props: Props) {
  if (props.actor.role !== 'operator' || !hasPermission(props.actor, 'administration')) return <Empty title="这项任务需要结对管理权限" />
  return <div className="stack operations-page"><Link className="back-link" to="/space"><ArrowLeft size={16} aria-hidden="true" />返回运营待处理</Link><PageHeader eyebrow="结对管理" title="把合适的伙伴联系起来。" description="核对人员与收发方式。暂停、恢复或结束都保留处理记录。" /><Matching {...props} /></div>
}

export function OperatorFollowupPage(props: Props) {
  const [searchParams] = useSearchParams()
  if (props.actor.role !== 'operator' || !(hasPermission(props.actor, 'administration') || hasPermission(props.actor, 'safeguarding'))) return <Empty title="这项任务需要跟进权限" />
  return <div className="stack operations-page">{!searchParams.has('item') && <Link className="back-link" to="/space"><ArrowLeft size={16} aria-hidden="true" />返回运营待处理</Link>}<PageHeader eyebrow="持续跟进" title="先了解情况，再记录下一步。" description="求助记录仅向有相应职责的运营展示；回应逾期需要具体了解原因。" /><FollowupQueue {...props} /></div>
}
