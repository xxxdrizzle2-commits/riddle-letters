import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Check, ClipboardCheck, HeartHandshake, Mail, Printer, Send, Users } from 'lucide-react'
import { dispatch, formatDate, isOverdue } from '../data'
import type { AppState, Letter, Pair, Person } from '../types'
import { Badge, Empty, LetterPaper, Notice, PageHeader, useAction } from '../ui'
import './Operations.css'

type Props = { state: AppState; actor: Person; notify: (message: string) => void; setDirty?: (dirty: boolean) => void }
type TeacherTab = 'print' | 'deliver' | 'reply'
const nameOf = (state: AppState, id?: string) => state.people.find(person => person.id === id)?.nickname ?? '未指定'
const moderationLabel = { draft: '草稿', pending: '等待审核', returned: '需修改', approved: '审核通过' }

function WorkspaceTabs<T extends string>({ value, onChange, items, label }: { value: T; onChange: (value: T) => void; items: { value: T; label: string; count?: number }[]; label: string }) {
  return <nav className="workspace-tabs" aria-label={label}>{items.map(item => <button type="button" key={item.value} aria-pressed={value === item.value} className={value === item.value ? 'workspace-tab active' : 'workspace-tab'} onClick={() => onChange(item.value)}>{item.label}{item.count !== undefined && <span className="tab-count">{item.count}</span>}</button>)}</nav>
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

const replySchema = z.object({ title: z.string().trim().min(2, '标题至少写 2 个字。').max(60, '标题请控制在 60 个字以内。'), body: z.string().trim().max(5000, '正文请控制在 5000 个字以内。') })
type ReplyValues = z.infer<typeof replySchema>

function TeacherReplyForm({ state, actor, original, pair, notify, onDirtyChange }: Props & { original: Letter; pair: Pair; onDirtyChange: (dirty: boolean) => void }) {
  const existing = state.letters.find(letter => letter.replyTo === original.id && letter.authorId === pair.childId && letter.createdBy === actor.id)
  const childSubmission = state.letters.find(letter => letter.replyTo === original.id && letter.createdBy !== actor.id && letter.moderation === 'pending')
  const [draftId, setDraftId] = useState(existing?.id)
  const [file, setFile] = useState<File>()
  const [fileError, setFileError] = useState('')
  const [removeAttachment, setRemoveAttachment] = useState(false)
  const { run, busy, error } = useAction(notify)
  const form = useForm<ReplyValues>({ resolver: zodResolver(replySchema), mode: 'onBlur', defaultValues: { title: existing?.title ?? `给${nameOf(state, pair.volunteerId)}的回信`, body: existing?.body ?? '' } })
  const locked = existing?.moderation === 'pending' || existing?.moderation === 'approved'
  const attachment = state.attachments.find(item => item.id === existing?.attachmentId)
  const paused = pair.status === 'paused'
  const watchTitle = form.watch('title')
  const watchBody = form.watch('body')
  const baseline = useRef(JSON.stringify({ title: existing?.title ?? `给${nameOf(state, pair.volunteerId)}的回信`, body: existing?.body ?? '' }))
  const dirty = JSON.stringify({ title: watchTitle, body: watchBody }) !== baseline.current || !!file || removeAttachment
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false) }, [dirty, onDirtyChange])

  async function save(submit: boolean) {
    if (fileError || paused || locked) return
    if (submit && !(await form.trigger())) return
    const values = form.getValues()
    if (submit && values.body.trim().length < 10 && !file && !(attachment && !removeAttachment)) { form.setError('body', { message: '请代录至少 10 个字，或选择一张演示手写回信图片。' }); return }
    await run(async () => {
      const id = await dispatch(actor.id, { type: 'save-letter', id: draftId, pairId: pair.id, replyTo: original.id, title: values.title, body: values.body, file, removeAttachment })
      baseline.current = JSON.stringify(values)
      setDraftId(id)
      setFile(undefined)
      setRemoveAttachment(false)
      if (submit) await dispatch(actor.id, { type: 'submit-letter', id })
    }, submit ? '回信已提交审核，通过后志愿者才能阅读。' : '代录草稿已保存，可以稍后继续。')
  }

  if (childSubmission) return <section className="panel stack"><h3>回信已经提交</h3><Badge>等待审核</Badge><p>孩子已从自己的信箱提交回信。请等待运营审核，这里无需重复代录。</p></section>
  if (locked) return <section className="panel stack"><h3>孩子的回信</h3><Badge>{moderationLabel[existing.moderation]}</Badge><p>{existing.moderation === 'pending' ? '回信正在等待运营审核，审核通过后会送到志愿者的信箱。' : '这封回信已经审核通过，本轮信件往来已完成。'}</p><LetterPaper state={state} letter={existing} /></section>

  return <form className="panel stack" onSubmit={event => { event.preventDefault(); void save(true) }} aria-busy={busy}>
    <div><h3>把手写回信带回来</h3><p className="muted">请忠实代录孩子的表达。附件仅使用合成内容，不上传真实孩子的照片或私人信息。</p></div>
    {paused && <Notice>这组陪伴已暂停。恢复后可以继续保存和提交回信。</Notice>}
    {existing?.moderation === 'returned' && <Notice tone="warning">修改意见：{existing.moderationNote}</Notice>}
    {error && <Notice tone="error">{error}</Notice>}
    <div className="field"><label htmlFor="teacher-reply-title">回信标题（必填）</label><input id="teacher-reply-title" {...form.register('title')} aria-invalid={!!form.formState.errors.title} aria-describedby={form.formState.errors.title ? 'teacher-title-error' : undefined} />{form.formState.errors.title && <p className="field-error" id="teacher-title-error">{form.formState.errors.title.message}</p>}</div>
    <div className="field"><label htmlFor="teacher-reply-body">代录正文（与图片至少填写一项）</label><textarea id="teacher-reply-body" rows={9} {...form.register('body')} aria-invalid={!!form.formState.errors.body} aria-describedby="teacher-body-hint teacher-body-error" /><p className="muted small-text" id="teacher-body-hint">选择文字代录时至少 10 字，最多 5000 字；可以先保存未完成的草稿。</p>{form.formState.errors.body && <p className="field-error" id="teacher-body-error">{form.formState.errors.body.message}</p>}</div>
    <div className="field"><label htmlFor="teacher-reply-file">演示手写回信图片（选填）</label><input id="teacher-reply-file" type="file" accept="image/png,image/jpeg" aria-invalid={!!fileError} aria-describedby="teacher-upload-hint teacher-upload-error" onChange={event => { const next = event.target.files?.[0]; if (!next) { setFile(undefined); setFileError(''); return } if (!['image/png', 'image/jpeg'].includes(next.type)) { setFile(undefined); setFileError('请选择 PNG 或 JPG 图片。'); return } if (next.size > 3 * 1024 * 1024) { setFile(undefined); setFileError('图片超过 3 MiB，请压缩后再选择。'); return } setFile(next); setFileError(''); setRemoveAttachment(false) }} /><p className="muted small-text" id="teacher-upload-hint">PNG / JPG，最大 3 MiB。也可以只代录正文，无需图片。</p>{fileError && <p className="field-error" id="teacher-upload-error">{fileError}</p>}{file && <p>已选择：{file.name}</p>}{attachment && !file && <label className="checkbox-row"><input type="checkbox" checked={removeAttachment} onChange={event => setRemoveAttachment(event.target.checked)} />移除已保存的附件：{attachment.name}</label>}</div>
    <div className="pre-submit-check"><strong>提交前看一眼</strong><p>{watchTitle.trim().length >= 2 ? '✓' : '○'} 标题：{watchTitle.trim() || '还没有填写'}</p><p>{watchBody.trim().length >= 10 ? '✓' : '○'} 正文：已代录 {watchBody.trim().length} 字</p><p>审核通过前，这封回信不会进入志愿者的可读范围。</p></div>
    <div className="toolbar"><button className="btn secondary" type="button" disabled={busy || paused} onClick={() => void save(false)}>保存代录草稿</button><button className="btn" type="submit" disabled={busy || paused}>{busy ? '正在保存…' : '提交回信审核'}<Send size={16} aria-hidden="true" /></button></div>
    {existing && <p className="muted small-text">上次保存：{formatDate(existing.updatedAt)}</p>}
  </form>
}

export function TeacherPage({ state, actor, notify, setDirty }: Props) {
  const [tab, setTab] = useState<TeacherTab>('print')
  const [selected, setSelected] = useState<string[]>([])
  const [detailId, setDetailId] = useState('')
  const [printOpened, setPrintOpened] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [draftDirty, setDraftDirty] = useState(false)
  const reportDirty = useCallback((value: boolean) => { setDraftDirty(value); setDirty?.(value) }, [setDirty])
  const { run, busy, error } = useAction(notify)
  const pairs = state.pairs.filter(pair => pair.teacherId === actor.id && pair.channel === 'paper')
  const letters = state.letters.filter(letter => pairs.some(pair => pair.id === letter.pairId && pair.volunteerId === letter.authorId) && letter.moderation === 'approved')
  const queues = {
    print: letters.filter(letter => !state.deliveries.find(item => item.letterId === letter.id)?.printedAt && !state.deliveries.find(item => item.letterId === letter.id)?.deliveredAt),
    deliver: letters.filter(letter => { const d = state.deliveries.find(item => item.letterId === letter.id); return d?.printedAt && !d.deliveredAt }),
    reply: letters.filter(letter => state.deliveries.some(item => item.letterId === letter.id && item.deliveredAt) && state.tasks.some(task => task.letterId === letter.id && task.status !== 'completed')),
  }
  const current = queues[tab]
  const selectedIds = selected.filter(id => current.some(letter => letter.id === id && state.pairs.find(pair => pair.id === letter.pairId)?.status === 'active'))
  const detail = current.find(letter => letter.id === detailId) ?? current[0]
  const detailPair = pairs.find(pair => pair.id === detail?.pairId)
  const printable = queues.print.filter(letter => selectedIds.includes(letter.id))
  const selectable = current.filter(letter => pairs.find(pair => pair.id === letter.pairId)?.status === 'active')

  useEffect(() => { setSelected([]); setConfirmed(false); setPrintOpened(false); setDetailId('') }, [tab])
  function allowLeave() { return !draftDirty || window.confirm('还有未保存的代录内容。切换前建议先保存草稿，仍要离开吗？') }
  function changeTab(value: TeacherTab) { if (value !== tab && allowLeave()) setTab(value) }
  function changeSelection(ids: string[]) { setSelected(ids); setConfirmed(false); setPrintOpened(false) }
  async function recordBatch(type: 'print' | 'deliver') {
    if (!confirmed || !selectedIds.length || (type === 'print' && !printOpened)) return
    const ok = await run(() => dispatch(actor.id, { type, ids: selectedIds }), type === 'print' ? '已记录打印，下一步请在实际交给孩子后确认交付。' : '已确认实际交付，回信期限从今天开始计算。')
    if (ok) { setSelected([]); setConfirmed(false); setPrintOpened(false) }
  }
  if (actor.role !== 'teacher') return <Empty title="请切换到老师演示身份" />

  return <div className="stack operations-page">
    <PageHeader eyebrow="老师收发台" title="让每一封信，稳稳到达。" description="打印、交给孩子，再把他们的回信带回来。每一步都留下清楚的记录。" />
    <WorkspaceTabs label="老师收发任务" value={tab} onChange={changeTab} items={[{ value: 'print', label: '待打印', count: queues.print.length }, { value: 'deliver', label: '待交付', count: queues.deliver.length }, { value: 'reply', label: '待回传', count: queues.reply.length }]} />
    {error && <Notice tone="error">{error}</Notice>}
    <div className="operations-grid">
      <section className="panel task-list stack" aria-label="信件任务列表">
        <div className="section-title"><h2>{tab === 'print' ? '准备好信纸' : tab === 'deliver' ? '确认实际交付' : '等待孩子的回信'}</h2><span className="muted">{current.length} 封</span></div>
        {tab !== 'reply' && current.length > 0 && <label className="checkbox-row"><input type="checkbox" checked={selectable.length > 0 && selectedIds.length === selectable.length} onChange={event => changeSelection(event.target.checked ? selectable.map(letter => letter.id) : [])} disabled={selectable.length === 0} />全选可处理的信件</label>}
        {current.length === 0 && <Empty title="这一步暂时没有待办" description={tab === 'print' ? '运营审核通过的纸质来信会出现在这里。' : tab === 'deliver' ? '记录已打印后，就可以在这里确认交付。' : '确认交付的信件会进入这里，等待回信。'} />}
        <div className="stack compact">{current.map(letter => { const pair = pairs.find(item => item.id === letter.pairId)!; const task = state.tasks.find(item => item.letterId === letter.id); return <div key={letter.id} className={detail?.id === letter.id ? 'operation-letter-row selected' : 'operation-letter-row'}>
          {tab !== 'reply' && <input type="checkbox" aria-label={`选择${letter.title}`} checked={selectedIds.includes(letter.id)} disabled={pair.status === 'paused' || busy} onChange={event => changeSelection(event.target.checked ? [...selectedIds, letter.id] : selectedIds.filter(id => id !== letter.id))} />}
          <button className="letter-select" type="button" aria-pressed={detail?.id === letter.id} onClick={() => { if (detail?.id !== letter.id && allowLeave()) setDetailId(letter.id) }}><strong>{letter.title}</strong><span>{nameOf(state, pair.volunteerId)} → {nameOf(state, pair.childId)}</span><span className="letter-row-meta">{pair.status === 'paused' ? '陪伴已暂停' : task ? `回信期限 ${formatDate(task.dueAt)}` : '审核已通过'}{task?.status === 'review' ? ' · 回信审核中' : task && isOverdue(state, task) ? ' · 已逾期，运营将跟进' : ''}</span></button>
        </div> })}</div>
        {tab !== 'reply' && current.length > 0 && <div className="batch-actions stack">
          <p>已选 {selectedIds.length} 封{tab === 'print' ? ' · A4 纸张' : ''}</p>
          {tab === 'print' && <button className="btn secondary" type="button" disabled={!selectedIds.length || busy} onClick={() => { setPrintOpened(true); setConfirmed(false); window.print() }}><Printer size={17} aria-hidden="true" />打开打印预览</button>}
          <label className="checkbox-row"><input type="checkbox" checked={confirmed} disabled={!selectedIds.length || (tab === 'print' && !printOpened)} onChange={event => setConfirmed(event.target.checked)} />{tab === 'print' ? '我已核对这些信件的打印结果' : '我确认已把这些信件交给对应孩子'}</label>
          <button className="btn" type="button" disabled={busy || !selectedIds.length || !confirmed || (tab === 'print' && !printOpened)} onClick={() => void recordBatch(tab)}>{busy ? '正在记录…' : tab === 'print' ? '记录已打印' : '确认实际交付'}</button>
          <p className="muted small-text">{tab === 'print' ? '打开打印窗口不会自动记为打印完成。已打印也不代表已交付。' : '请在真实交付后记录。交付日期将作为回信期限的起点。'}</p>
        </div>}
      </section>
      <div className="stack">{detail && detailPair ? <>
        <section className="panel stack"><div className="section-title"><h2>这封信的内容</h2><Badge>{detailPair.channel === 'paper' ? '纸质往来' : '线上往来'}</Badge></div><LetterPaper state={state} letter={detail} /><LetterTimeline state={state} letter={detail} /></section>
        {tab === 'reply' && <TeacherReplyForm key={detail.id} state={state} actor={actor} notify={notify} original={detail} pair={detailPair} onDirtyChange={reportDirty} />}
      </> : <section className="panel teacher-guide"><Mail size={34} aria-hidden="true" /><h2>一份小小的收发指南</h2><ol><li>先打印审核通过的信件。</li><li>实际交给孩子后，记录交付。</li><li>孩子写好回信后，代录或上传演示图片。</li><li>提交审核，等待下一次温暖的往来。</li></ol><p className="muted">长假或暂时无法收发时，可联系运营暂停陪伴，暂停期间停止催办。</p></section>}</div>
    </div>
    {printable.length > 0 && createPortal(<div className="teacher-print-area" aria-hidden="true">{printable.map(letter => <article className="print-letter" key={letter.id}><p className="print-label">谜语书信 · 演示书信 / 合成内容</p><p>亲爱的 {nameOf(state, pairs.find(pair => pair.id === letter.pairId)?.childId)}：</p><LetterPaper state={state} letter={letter} /><p className="print-signature">来自 {nameOf(state, letter.authorId)}<br />{formatDate(letter.createdAt)}</p></article>)}</div>, document.body)}
  </div>
}

function ReviewQueue({ state, actor, notify }: Props) {
  const [mode, setMode] = useState<'pending' | 'history'>('pending')
  const [selectedId, setSelectedId] = useState('')
  const [note, setNote] = useState('')
  const [validation, setValidation] = useState('')
  const [confirmApprove, setConfirmApprove] = useState(false)
  const { run, busy, error } = useAction(notify)
  const letters = state.letters.filter(letter => mode === 'pending' ? letter.moderation === 'pending' : ['approved', 'returned'].includes(letter.moderation))
  const letter = letters.find(item => item.id === selectedId) ?? letters[0]
  const pair = state.pairs.find(item => item.id === letter?.pairId)
  useEffect(() => { setNote(''); setValidation(''); setConfirmApprove(false) }, [letter?.id])
  async function review(decision: 'approved' | 'returned') {
    if (!letter) return
    if (decision === 'returned' && note.trim().length < 4) { setValidation('请写下至少 4 个字的具体修改建议。'); document.getElementById('review-note')?.focus(); return }
    const ok = await run(() => dispatch(actor.id, { type: 'review-letter', id: letter.id, decision, note: note.trim() }), decision === 'returned' ? '已退回修改，原信与修改建议均已保留。' : pair?.channel === 'paper' && !letter.replyTo ? '审核通过，已进入老师的待打印列表。' : '审核通过，已送到收件人的信箱。')
    if (ok) { setNote(''); setConfirmApprove(false) }
  }
  return <div className="stack"><div className="toolbar"><button type="button" className={`btn small ${mode === 'pending' ? '' : 'secondary'}`} aria-pressed={mode === 'pending'} onClick={() => { setMode('pending'); setSelectedId('') }}>等待审核</button><button type="button" className={`btn small ${mode === 'history' ? '' : 'secondary'}`} aria-pressed={mode === 'history'} onClick={() => { setMode('history'); setSelectedId('') }}>已审记录</button></div>
    <div className="operations-grid"><section className="panel stack task-list"><div className="section-title"><h2>{mode === 'pending' ? '每一封都值得认真读' : '保留每一次审核记录'}</h2><span className="muted">{letters.length} 封</span></div>{!letters.length && <Empty title={mode === 'pending' ? '待审信件已处理完' : '暂时没有已审信件'} description="新的来信和回信提交后会出现在这里。" />}<div className="stack compact">{letters.map(item => <button key={item.id} type="button" className={letter?.id === item.id ? 'operation-letter-row letter-select selected' : 'operation-letter-row letter-select'} aria-pressed={letter?.id === item.id} onClick={() => setSelectedId(item.id)}><strong>{item.title}</strong><span>{nameOf(state, item.authorId)} · {item.replyTo ? '回信' : '来信'}</span><span className="letter-row-meta">{moderationLabel[item.moderation]} · {formatDate(item.updatedAt)}</span></button>)}</div></section>
      {letter && pair ? <section className="panel stack"><div className="section-title"><h2>{mode === 'pending' ? '阅读与审核' : '信件与审核记录'}</h2><Badge>{letter.replyTo ? '孩子回信' : '志愿者来信'}</Badge></div><p className="muted">{nameOf(state, pair.childId)} 与 {nameOf(state, pair.volunteerId)} · {pair.channel === 'paper' ? '纸质' : '线上'}往来</p><LetterPaper state={state} letter={letter} />{mode === 'pending' ? <>
        <Notice>留意私人联系方式、具体住址及不适合分享的内容。表达难过或求助时，请用下方「跟进」中的受限流程给予支持。</Notice>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="field"><label htmlFor="review-note">审核备注 / 修改建议（退回时必填）</label><textarea id="review-note" rows={3} value={note} onChange={event => { setNote(event.target.value); setValidation('') }} aria-invalid={!!validation} aria-describedby="review-note-help review-note-error" /><p id="review-note-help" className="muted small-text">请告诉写信人哪里需要调整、可以怎样写。原信会保留。</p>{validation && <p id="review-note-error" className="field-error">{validation}</p>}</div>
        {confirmApprove ? <div className="pre-submit-check stack"><strong>确认这封信可以送往下一站？</strong><p>{pair.channel === 'paper' && !letter.replyTo ? '通过后，负责老师可以查看并打印；实际交付后才开始计算回信期限。' : '通过后，收件人即可阅读这封信。'}{letter.replyTo ? '本轮回信任务将完成。' : ''}</p><div className="toolbar"><button type="button" className="btn" disabled={busy} onClick={() => void review('approved')}>确认通过审核</button><button type="button" className="btn secondary" disabled={busy} onClick={() => setConfirmApprove(false)}>再检查一下</button></div></div> : <div className="toolbar"><button type="button" className="btn secondary" disabled={busy} onClick={() => void review('returned')}>退回修改</button><button type="button" className="btn" disabled={busy} onClick={() => setConfirmApprove(true)}><Check size={16} aria-hidden="true" />通过审核</button></div>}
      </> : <LetterTimeline state={state} letter={letter} />}</section> : <section className="panel teacher-guide"><ClipboardCheck size={34} aria-hidden="true" /><h2>审核，是陪伴中的一份照顾。</h2><p className="muted">认真读完，再给出具体、友好的建议。孩子的表达和求助需要被听见。</p></section>}
    </div>
  </div>
}

function Matching({ state, actor, notify }: Props) {
  const [childId, setChildId] = useState('')
  const [volunteerId, setVolunteerId] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [channel, setChannel] = useState<'online' | 'paper'>('online')
  const [pauseId, setPauseId] = useState('')
  const [pauseReason, setPauseReason] = useState('')
  const [validation, setValidation] = useState('')
  const { run, busy, error } = useAction(notify)
  const children = state.people.filter(person => person.role === 'child' && !state.pairs.some(pair => pair.childId === person.id))
  const volunteers = state.people.filter(person => person.role === 'volunteer' && !state.pairs.some(pair => pair.volunteerId === person.id))
  const teachers = state.people.filter(person => person.role === 'teacher')
  const currentChild = children.some(person => person.id === childId) ? childId : children[0]?.id ?? ''
  const currentVolunteer = volunteers.some(person => person.id === volunteerId) ? volunteerId : volunteers[0]?.id ?? ''
  const currentTeacher = teachers.some(person => person.id === teacherId) ? teacherId : teachers[0]?.id ?? ''
  async function match() {
    if (!currentChild || !currentVolunteer || !currentTeacher) return
    await run(() => dispatch(actor.id, { type: 'match', childId: currentChild, volunteerId: currentVolunteer, teacherId: currentTeacher, channel }), '结对已建立，志愿者现在可以写第一封信。')
  }
  async function pause(pair: Pair) {
    if (pauseReason.trim().length < 2) { setValidation('请填写暂停原因，至少 2 个字。'); return }
    const ok = await run(() => dispatch(actor.id, { type: 'pause-pair', id: pair.id, reason: pauseReason.trim() }), '陪伴已暂停，暂停期间停止催办。')
    if (ok) { setPauseId(''); setPauseReason(''); setValidation('') }
  }
  return <div className="stack">{error && <Notice tone="error">{error}</Notice>}<div className="matching-grid"><form className="panel stack" onSubmit={event => { event.preventDefault(); void match() }} aria-busy={busy}><div className="section-title"><h2>让一段陪伴开始</h2><HeartHandshake size={21} aria-hidden="true" /></div><p className="muted">每组陪伴由一位孩子、一位志愿者和一位协助老师组成。</p>{children.length && volunteers.length ? <>
      <div className="field"><label htmlFor="match-child">待结对的小朋友</label><select id="match-child" value={currentChild} onChange={event => setChildId(event.target.value)} required>{children.map(person => <option value={person.id} key={person.id}>{person.nickname} · {person.subtitle}</option>)}</select></div>
      <div className="field"><label htmlFor="match-volunteer">可结对的志愿者</label><select id="match-volunteer" value={currentVolunteer} onChange={event => setVolunteerId(event.target.value)} required>{volunteers.map(person => <option value={person.id} key={person.id}>{person.nickname} · {person.subtitle}</option>)}</select></div>
      <div className="field"><label htmlFor="match-teacher">协助老师</label><select id="match-teacher" value={currentTeacher} onChange={event => setTeacherId(event.target.value)} required>{teachers.map(person => <option value={person.id} key={person.id}>{person.nickname}</option>)}</select></div>
      <fieldset className="channel-options"><legend>书信送达方式</legend><label><input type="radio" name="channel" value="online" checked={channel === 'online'} onChange={() => setChannel('online')} /><span><strong>线上收信</strong><small>审核通过后，进入孩子的信箱。</small></span></label><label><input type="radio" name="channel" value="paper" checked={channel === 'paper'} onChange={() => setChannel('paper')} /><span><strong>纸质收发</strong><small>老师打印并确认实际交付，再回传回信。</small></span></label></fieldset>
      <div className="pre-submit-check"><p>{nameOf(state, currentChild)} ↔ {nameOf(state, currentVolunteer)}</p><p>由 {nameOf(state, currentTeacher)} 协助，采用{channel === 'online' ? '线上' : '纸质'}往来。</p></div><button type="submit" className="btn" disabled={busy || !currentTeacher}><Users size={17} aria-hidden="true" />{busy ? '正在建立…' : '建立结对'}</button>
    </> : <Empty title={children.length ? '暂时没有空闲志愿者' : '待结对的孩子都已安排好'} description="暂停中的结对仍保留原来的伙伴关系。" />}</form>
      <section className="panel stack"><h2>正在同行的伙伴</h2>{!state.pairs.length && <Empty title="还没有结对" description="从左侧选择伙伴，开始第一段陪伴。" />}<div className="stack">{state.pairs.map(pair => <article className="pair-row stack" key={pair.id}><div className="section-title"><strong>{nameOf(state, pair.childId)} ↔ {nameOf(state, pair.volunteerId)}</strong><Badge tone={pair.status === 'paused' ? 'warning' : 'success'}>{pair.status === 'paused' ? '暂停中' : '陪伴中'}</Badge></div><p className="muted small-text">{nameOf(state, pair.teacherId)} 协助 · {pair.channel === 'paper' ? '纸质收发' : '线上收信'} · {formatDate(pair.startedAt)} 开始</p>{pair.status === 'paused' && <p className="small-text">暂停原因：{pair.pauseReason}<br />暂停于 {formatDate(pair.pausedAt ?? '')}，恢复后按暂停时长顺延未完成回信期限。</p>}{pauseId === pair.id ? <div className="stack compact"><div className="field"><label htmlFor={`pause-${pair.id}`}>暂停原因（必填）</label><input id={`pause-${pair.id}`} value={pauseReason} onChange={event => { setPauseReason(event.target.value); setValidation('') }} placeholder="例如：学校放假，暂时无法收发" aria-invalid={!!validation} aria-describedby={validation ? `pause-error-${pair.id}` : undefined} />{validation && <p id={`pause-error-${pair.id}`} className="field-error">{validation}</p>}</div><p className="muted small-text">暂停期间停止催办，已有信件和记录会保留。</p><div className="toolbar"><button className="btn small" type="button" disabled={busy} onClick={() => void pause(pair)}>确认暂停</button><button className="btn secondary small" type="button" onClick={() => setPauseId('')}>取消</button></div></div> : <div className="toolbar"><button className="btn secondary small" type="button" disabled={busy} onClick={() => pair.status === 'paused' ? void run(() => dispatch(actor.id, { type: 'resume-pair', id: pair.id }), '陪伴已恢复，未完成回信期限已按暂停时长顺延。') : (setPauseId(pair.id), setPauseReason(''), setValidation(''))}>{pair.status === 'paused' ? '恢复陪伴' : '暂停 / 假期'}</button></div>}</article>)}</div></section>
    </div></div>
}

function FollowupQueue({ state, actor, notify }: Props) {
  const [filter, setFilter] = useState<'open' | 'resolved'>('open')
  const [selectedId, setSelectedId] = useState('')
  const [resolution, setResolution] = useState('')
  const [validation, setValidation] = useState('')
  const { run, busy, error } = useAction(notify)
  const items = state.followups.filter(item => item.status === filter)
  const selected = items.find(item => item.id === selectedId) ?? items[0]
  const pair = state.pairs.find(item => item.id === selected?.pairId)
  const task = state.tasks.find(item => item.id === selected?.taskId)
  useEffect(() => { setResolution(''); setValidation('') }, [selected?.id])
  async function resolve() {
    if (!selected) return
    if (resolution.trim().length < 4) { setValidation('请至少写 4 个字，记录采取了什么行动。'); return }
    await run(() => dispatch(actor.id, { type: 'resolve-followup', id: selected.id, note: resolution.trim() }), '处理结果已保存，可以在已处理记录中查看。')
  }
  return <div className="stack"><div className="toolbar"><button type="button" className={`btn small ${filter === 'open' ? '' : 'secondary'}`} aria-pressed={filter === 'open'} onClick={() => { setFilter('open'); setSelectedId('') }}>等待跟进</button><button type="button" className={`btn small ${filter === 'resolved' ? '' : 'secondary'}`} aria-pressed={filter === 'resolved'} onClick={() => { setFilter('resolved'); setSelectedId('') }}>已处理记录</button></div><div className="operations-grid"><section className="panel stack task-list"><h2>{filter === 'open' ? '需要多一份留意' : '已经做过的照顾'}</h2>{items.length === 0 && <Empty title={filter === 'open' ? '目前没有待跟进事项' : '还没有处理记录'} description="求助与达到期限的回信任务会形成跟进事项。" />}<div className="stack compact">{items.map(item => <button key={item.id} type="button" className={selected?.id === item.id ? 'operation-letter-row letter-select selected' : 'operation-letter-row letter-select'} aria-pressed={selected?.id === item.id} onClick={() => setSelectedId(item.id)}><strong>{item.kind === 'help' ? '一份需要认真倾听的求助' : '回信进度跟进'}</strong><span>{nameOf(state, state.pairs.find(pair => pair.id === item.pairId)?.childId)}</span><span className="letter-row-meta">{formatDate(item.createdAt)} · {item.status === 'resolved' ? '已处理' : '待跟进'}</span></button>)}</div></section>
    {selected ? <section className="panel stack"><div className="section-title"><h2>{selected.kind === 'help' ? '先听听发生了什么' : '了解书信的进展'}</h2><Badge tone={selected.kind === 'help' ? 'warning' : undefined}>{selected.kind === 'help' ? '仅运营可见' : '回信待跟进'}</Badge></div>{pair && <p className="muted">{nameOf(state, pair.childId)} ↔ {nameOf(state, pair.volunteerId)} · {nameOf(state, pair.teacherId)} 协助</p>}<div className="followup-note">{selected.note}</div>{task && <p>本轮回信期限：{formatDate(task.dueAt)}；当前状态：{task.status === 'completed' ? '回信已完成' : task.status === 'review' ? '回信审核中' : pair?.status === 'paused' ? '陪伴暂停中' : '等待回信'}。</p>}{selected.kind === 'help' && <Notice>这是受限的求助记录。请先理解孩子的表达，由负责运营联系协助老师并记录后续安排。</Notice>}{selected.status === 'resolved' ? <div className="pre-submit-check"><h3>处理结果</h3><p className="preserve-lines">{selected.resolution}</p><p className="muted small-text">记录于 {formatDate(selected.updatedAt)}</p></div> : <>{error && <Notice tone="error">{error}</Notice>}<div className="field"><label htmlFor="followup-resolution">处理结果（必填）</label><textarea id="followup-resolution" rows={5} value={resolution} onChange={event => { setResolution(event.target.value); setValidation('') }} aria-invalid={!!validation} aria-describedby="followup-help followup-error" /><p id="followup-help" className="muted small-text">记录采取的行动和接下来的安排，至少 4 个字。Demo 中请只填写合成信息。</p>{validation && <p id="followup-error" className="field-error">{validation}</p>}</div><button type="button" className="btn" disabled={busy} onClick={() => void resolve()}>保存处理结果</button></>}</section> : <section className="panel teacher-guide"><HeartHandshake size={34} aria-hidden="true" /><h2>陪伴也需要被照顾。</h2><p className="muted">先了解是否遇到了困难，再商量一个合适的下一步。逾期只是一条需要了解近况的提醒。</p></section>}
    </div></div>
}

export function OperatorPage(props: Props) {
  const [tab, setTab] = useState<'review' | 'match' | 'followup'>('review')
  const { state, actor } = props
  const pending = state.letters.filter(letter => letter.moderation === 'pending').length
  const unmatched = state.people.filter(person => person.role === 'child' && !state.pairs.some(pair => pair.childId === person.id)).length
  const open = state.followups.filter(item => item.status === 'open').length
  if (actor.role !== 'operator') return <Empty title="请切换到运营演示身份" />
  return <div className="stack operations-page"><PageHeader eyebrow="运营工作台" title="照顾好每一次往来。" description="认真审核，安排伙伴，也留意那些需要多问候一句的时刻。" /><WorkspaceTabs label="运营工作任务" value={tab} onChange={setTab} items={[{ value: 'review', label: '内容审核', count: pending }, { value: 'match', label: '结对管理', count: unmatched }, { value: 'followup', label: '持续跟进', count: open }]} />{tab === 'review' ? <ReviewQueue {...props} /> : tab === 'match' ? <Matching {...props} /> : <FollowupQueue {...props} />}</div>
}
