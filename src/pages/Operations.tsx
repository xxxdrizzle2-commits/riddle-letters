/* finesse · register=product · A=paper+postal-green · B=Chinese-sans+Songti · C=task-workbench · D=CSS-feedback · E=correspondence · SOUL=7 SPECTACLE=2 DENSITY=6 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, ArrowRight, Check, HeartHandshake, Printer, Send, Users } from 'lucide-react'
import { dispatch, formatDate, groupedResponseTasks, hasPermission, isOverdue, recipientForLetter, riddles } from '../data'
import type { AppState, DisputeDecision, HelpCase, Letter, Pair, Person, Role, TeacherScope } from '../types'
import { BackLink, Badge, ContextLink, Empty, LetterBadge, LetterPaper, Notice, PageHeader, useAction } from '../ui'
import { cloudConfigured, cloudHelpCase, cloudLetter } from '../services/cloud'
import { detectContentSafetySignals } from '../safety-signals'
import { checkInvariants } from '../invariants'
import { grantIsActive, hasSchoolSeat, teacherScope } from '../policy'
import './Operations.css'

type Props = { state: AppState; actor: Person; notify: (message: string) => void; setDirty?: (dirty: boolean) => void; registerSaveDraft?: (save?:()=>Promise<boolean>)=>void; mode?: 'demo' | 'live' }
type TeacherTab = 'print' | 'deliver' | 'reply'
const nameOf = (state: AppState, id?: string) => state.people.find(person => person.id === id)?.nickname ?? '未指定'
const moderationLabel = { draft: '草稿', pending: '等待审核', returned: '需修改', approved: '审核通过' }
const roleLabels: Record<Role,string> = { child: '小朋友', volunteer: '志愿者', teacher: '老师', operator: '运营人员' }
const roleEntryPath = (role: Role, mode: 'demo' | 'live') => mode === 'demo' ? `/demo/start/${role}` : `/login/${role}`
const roleEntryAction = (role: Role, mode: 'demo' | 'live') => mode === 'demo' ? `切换到${roleLabels[role]}演示身份继续` : `请${roleLabels[role]}成人测试者登录继续`
const letterRoute = (state: AppState, letter: Letter) => letter.deliveryRoute || (state.pairs.find(pair => pair.id === letter.pairId)?.childId === letter.authorId ? 'online' : state.pairs.find(pair => pair.id === letter.pairId)?.channel === 'paper' ? 'school-paper' : 'online')
function teacherPairs(state: AppState, actor: Person, scope: 'status' | 'capture' | 'paper-delivery') {
  return state.pairs.filter(pair => pair.status !== 'ended' && teacherScope(state, actor.id, pair.childId, scope, state.clock))
}

function useFocusedDetail(key: string) {
  useEffect(() => { if (key) document.getElementById('main-content')?.focus({ preventScroll: true }) }, [key])
}

function WorkflowOutcome({ title, status, next, to, actionLabel }: { title: string; status: string; next: string; to?: string; actionLabel?: string }) {
  return <section className="workflow-outcome" role="status"><div><p className="eyebrow">刚刚完成</p><h2>{title}</h2><p><strong>现在：</strong>{status}</p><p><strong>下一步：</strong>{next}</p></div>{to && actionLabel && <Link className="btn secondary small" to={to}>{actionLabel}<ArrowRight size={16} aria-hidden="true" /></Link>}</section>
}

const teacherStages: { key: TeacherTab; label: string; description: string }[] = [
  { key: 'print', label: '待打印', description: '预览并核对审核通过的信纸' },
  { key: 'deliver', label: '待交付', description: '实际交给收件人后再记录' },
  { key: 'reply', label: '待拍摄 / 回传', description: '孩子主动请求时，先选准结对，再私有保存合成纸信或忠实代录' },
]

function teacherQueues(state: AppState, actor: Person): Record<TeacherTab, Letter[]> {
  const pairs = teacherPairs(state, actor, 'paper-delivery')
  const letters = state.letters.filter(letter => pairs.some(pair => pair.id === letter.pairId && letter.authorId === pair.volunteerId && recipientForLetter(state, letter) === pair.childId) && letter.moderation === 'approved' && letterRoute(state, letter) === 'school-paper')
  return {
    print: letters.filter(letter => !state.deliveries.find(item => item.letterId === letter.id)?.printedAt && !state.deliveries.find(item => item.letterId === letter.id)?.deliveredAt),
    deliver: letters.filter(letter => { const delivery = state.deliveries.find(item => item.letterId === letter.id); return !!delivery?.printedAt && !delivery.deliveredAt }),
    reply: letters.filter(letter => state.deliveries.some(item => item.letterId === letter.id && item.deliveredAt) && state.tasks.some(task => task.letterId === letter.id && task.status === 'awaiting'))
      .sort((a, b) => Date.parse(state.tasks.find(task => task.letterId === a.id && task.status === 'awaiting')?.dueAt ?? state.clock) - Date.parse(state.tasks.find(task => task.letterId === b.id && task.status === 'awaiting')?.dueAt ?? state.clock)),
  }
}

function LetterTimeline({ state, letter }: { state: AppState; letter: Letter }) {
  const delivery = state.deliveries.find(item => item.letterId === letter.id)
  const review = state.reviews.filter(item => item.letterId === letter.id)
  return <ol className="letter-timeline" aria-label="信件进度">
    <li><span>信件写成</span><time>{formatDate(letter.createdAt)}</time></li>
    {review.map(item => <li key={item.id}><span>{item.decision === 'approved' ? '审核通过' : '退回修改'}</span><time>{formatDate(item.createdAt)}</time></li>)}
    {delivery?.printedAt && <li><span>已记录打印</span><time>{formatDate(delivery.printedAt)}</time></li>}
    {delivery?.deliveredAt && <li><span>{letterRoute(state, letter) === 'school-paper' ? '已实际交给孩子' : '已在线送达'}</span><time>{formatDate(delivery.deliveredAt)}</time></li>}
    {delivery?.readAt && <li><span>已打开阅读</span><time>{formatDate(delivery.readAt)}</time></li>}
    {delivery?.witnessedReadAt && <li><span>老师见证孩子自愿阅读</span><time>{formatDate(delivery.witnessedReadAt)}</time></li>}
  </ol>
}

const replySchema = z.object({ title: z.string().trim().max(60, '标题请控制在 60 个字以内。'), body: z.string().max(6000, '正文请控制在 6000 个字以内。') })
type ReplyValues = z.infer<typeof replySchema>

function TeacherReplyForm({ state, actor, original, pair, notify, onDirtyChange, onRegisterSave, onSubmitComplete }: Props & { original: Letter; pair: Pair; onDirtyChange: (dirty: boolean) => void; onRegisterSave?: (save?:()=>Promise<boolean>)=>void; onSubmitComplete?:()=>void }) {
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

  async function save(submit: boolean): Promise<boolean> {
    if (fileError || locked) return false
    if (submit && !(await form.trigger())) return false
    const values = form.getValues()
    if (submit && paused) return false
    if (submit && !childConfirmed) { form.setError('body', { message: '请先让小朋友核对代录内容，并确认。' }); return false }
    if (submit && !values.body.trim() && !file && !(attachment && !removeAttachment)) { form.setError('body', { message: '代录一点想说的话，或选择手写回信图片，就可以提交。' }); return false }
    const ok = await run(async () => {
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
    }, submit ? '合成纸信回传已提交处理；审核通过前志愿者看不到原稿或转写。' : '已私有保存为待处理草稿，不表示已经寄出。')
    if (ok && submit) onSubmitComplete?.()
    return ok
  }

  useEffect(() => { onRegisterSave?.(() => save(false)); return () => onRegisterSave?.(undefined) }, [onRegisterSave, dirty, file, removeAttachment, childConfirmed, form])

  if (childSubmission) return <section className="panel stack"><h3>回信已经提交</h3><Badge>等待审核</Badge><p>孩子已从自己的信箱提交回信。请等待运营审核，这里无需重复代录。</p></section>
  if (locked) return <section className="panel stack"><h3>孩子的回信</h3><LetterBadge state={state} letter={existing}/><p>{existing.moderation === 'pending' ? '回信正在等待运营审核，通过后才会安排投递。' : '回信已通过审核，请继续查看投递和送达进度。'}</p><LetterPaper state={state} letter={existing} /></section>

  return <form className="panel stack" onSubmit={event => { event.preventDefault(); void save(true) }} aria-busy={busy}>
    <div><h3>选择准确结对，协助拍摄或忠实代录</h3><p className="muted">仅用于成人合成内容演示。孩子主动请求当次协助后，先私有保存；保存、提交处理和远端志愿者可读是三个不同状态。{cloudConfigured ? '当前成人试测站暂不开放图片上传，请先用合成文字验证流程。' : '图片只使用合成信纸，不上传个人照片或真实私人信息。'}</p></div>
    {paused && <Notice>这组陪伴已暂停。可以先保存草稿，恢复后再提交审核。</Notice>}
    {existing?.moderation === 'returned' && <Notice tone="warning">修改意见：{existing.moderationNote}</Notice>}
    {error && <Notice tone="error">{error}</Notice>}
    <div className="field"><label htmlFor="teacher-reply-title">回信标题（选填）</label><input id="teacher-reply-title" {...form.register('title', { onChange: () => setChildConfirmed(false) })} aria-invalid={!!form.formState.errors.title} aria-describedby={form.formState.errors.title ? 'teacher-title-error' : undefined} />{form.formState.errors.title && <p className="field-error" id="teacher-title-error">{form.formState.errors.title.message}</p>}</div>
    <div className="field"><label htmlFor="teacher-reply-body">代录正文（与图片至少填写一项）</label><textarea id="teacher-reply-body" rows={9} {...form.register('body', { onChange: () => setChildConfirmed(false) })} aria-invalid={!!form.formState.errors.body} aria-describedby="teacher-body-hint teacher-body-error" /><p className="muted small-text" id="teacher-body-hint">一句话也可以，最多 6000 字；未写完可以先保存草稿。</p>{form.formState.errors.body && <p className="field-error" id="teacher-body-error">{form.formState.errors.body.message}</p>}</div>
    {!cloudConfigured && <div className="field"><label htmlFor="teacher-reply-file">手写回信图片（选填）</label><input id="teacher-reply-file" type="file" accept="image/png,image/jpeg" aria-invalid={!!fileError} aria-describedby="teacher-upload-hint teacher-upload-error" onChange={event => { setChildConfirmed(false); const next = event.target.files?.[0]; if (!next) { setFile(undefined); setFileError(''); return } if (!['image/png', 'image/jpeg'].includes(next.type)) { setFile(undefined); setFileError('请选择 PNG 或 JPG 图片。'); return } if (next.size > 3 * 1024 * 1024) { setFile(undefined); setFileError('图片超过 3 MiB，请压缩后再选择。'); return } setFile(next); setFileError(''); setRemoveAttachment(false) }} /><p className="muted small-text" id="teacher-upload-hint">PNG / JPG，最大 3 MiB。只上传信纸或小画，也可以只代录文字。</p>{fileError && <p className="field-error" id="teacher-upload-error">{fileError}</p>}{file && <p>已选择：{file.name}</p>}{attachment && !file && <label className="checkbox-row"><input type="checkbox" checked={removeAttachment} onChange={event => { setRemoveAttachment(event.target.checked); setChildConfirmed(false) }} />移除已保存的附件：{attachment.name}</label>}</div>}
    <div className="pre-submit-check"><strong>提交前，核对结对与忠实性</strong><p>收件伙伴：{nameOf(state, pair.volunteerId)}</p><p>标题：{watchTitle.trim() || `给${nameOf(state, pair.volunteerId)}的回信`}</p><p className="preserve-lines">忠实转写：{watchBody.trim() || '使用合成手写图片'}</p>{file && <p>合成原稿：{file.name}</p>}<p>保存后仍是私有待处理；审核通过前，原稿、转写和缩略图都不会进入志愿者可读范围。</p><label className="checkbox-row"><input type="checkbox" checked={childConfirmed} onChange={event => setChildConfirmed(event.target.checked)} />作者已核对：没有擅自润色、补字或改变语气</label></div>
    <div className="toolbar"><button className="btn secondary" type="button" disabled={busy} onClick={() => void save(false)}>私有保存，待后续处理</button><button className="btn" type="submit" disabled={busy || paused || !childConfirmed}>{busy ? '正在保存…' : '提交合法且必要处理'}<Send size={16} aria-hidden="true" /></button></div>
    {existing && <p className="muted small-text">上次保存：{formatDate(existing.updatedAt)}</p>}
  </form>
}

function TeacherStageWorkspace({ state, actor, notify, setDirty, registerSaveDraft, mode = 'demo', stage }: Props & { stage: TeacherTab }) {
  const tab = stage
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const [selected, setSelected] = useState<string[]>([])
  const detailId = searchParams.get('letter') ?? ''
  useFocusedDetail(detailId)
  const [printOpened, setPrintOpened] = useState(false)
  const [printError, setPrintError] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [authorizedLetters, setAuthorizedLetters] = useState<Record<string, Letter>>({})
  const [contentError, setContentError] = useState('')
  const [draftDirty, setDraftDirty] = useState(false)
  const [stopOpen, setStopOpen] = useState(false)
  const [stopReason, setStopReason] = useState('')
  const reportDirty = useCallback((value: boolean) => { setDraftDirty(value); setDirty?.(value) }, [setDirty])
  const { run, busy, error } = useAction(notify)
  const pairs = teacherPairs(state, actor, 'paper-delivery')
  const queues = teacherQueues(state, actor)
  const current = queues[tab]
  const detail = current.find(letter => letter.id === detailId)
  const detailContent = detail && state.pairs.find(pair => pair.id === detail.pairId)?.status === 'active' && (mode === 'live' ? authorizedLetters[detail.id] : detail)
  const detailReplyTask = detail && tab === 'reply' ? state.tasks.find(item => item.letterId === detail.id) : undefined
  const completedLetter = !detail && detailId ? state.letters.find(letter => letter.id === detailId && pairs.some(pair => pair.id === letter.pairId)) : undefined
  const completedDelivery = state.deliveries.find(item => item.letterId === completedLetter?.id)
  const completedTask = state.tasks.find(item => item.letterId === completedLetter?.id)
  const resultLetter = state.letters.find(letter => letter.id === searchParams.get('last'))
  const resultRecipientParam = searchParams.get('recipient')
  const resultRecipient: Role | 'mixed' = resultRecipientParam === 'volunteer' || resultRecipientParam === 'mixed' ? resultRecipientParam : 'child'
  const deliveryStatus = '老师已记录实际交到孩子手中；孩子是否阅读另行记录。'
  const deliveryNext = '孩子可以自愿阅读或回信，老师可记录见证阅读。'
  const selectedIds = detail ? state.pairs.find(pair => pair.id === detail.pairId)?.status === 'active' ? [detail.id] : [] : selected.filter(id => current.some(letter => letter.id === id && state.pairs.find(pair => pair.id === letter.pairId)?.status === 'active'))
  const detailPair = pairs.find(pair => pair.id === detail?.pairId)
  const printableMetadata = queues.print.filter(letter => selectedIds.includes(letter.id))
  const printable = mode === 'live'
    ? printableMetadata.map(letter => authorizedLetters[letter.id]).filter((letter): letter is Letter => !!letter)
    : printableMetadata
  const selectable = current.filter(letter => pairs.find(pair => pair.id === letter.pairId)?.status === 'active')

  useEffect(() => { setSelected([]); setConfirmed(false); setPrintOpened(false); setPrintError(''); setContentError(''); setStopOpen(false); setStopReason('') }, [tab, detailId])
  useEffect(() => {
    if (mode !== 'live' || tab !== 'print' || !selectedIds.length) return
    let cancelled = false
    const missing = selectedIds.filter(id => !authorizedLetters[id])
    if (!missing.length) return
    setContentError('')
    void Promise.all(missing.map(id => cloudLetter(id))).then(fullLetters => {
      if (!cancelled) setAuthorizedLetters(old => ({ ...old, ...Object.fromEntries(fullLetters.map(letter => [letter.id, letter])) }))
    }).catch(err => { if (!cancelled) setContentError(err instanceof Error ? err.message : '暂时无法取得获准打印版。') })
    return () => { cancelled = true }
  }, [mode, tab, selectedIds.join('|')])
  const focusDetail = (id: string) => `teacher-letter-${id}`
  function openLetter(id: string) {
    const current = `${location.pathname}${location.search}`
    const label = `返回${teacherStages.find(item => item.key === tab)?.label ?? '收发'}列表`
    setSearchParams({ ...Object.fromEntries(searchParams), letter: id }, { state: { returnContext: { to: `/teacher/tasks/${tab}`, label, sourcePath: current, sourceKey: location.key, focusId: focusDetail(id), historyBack: true } } })
  }
  function changeSelection(ids: string[]) { setSelected(ids); setConfirmed(false); setPrintOpened(false); setPrintError('') }
  async function openPrint() {
    setPrintError('')
    if (mode === 'live' && printable.length !== selectedIds.length) { setPrintError(contentError || '获准打印版仍在载入，请稍后重试。'); return }
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
    const ids = [...selectedIds]
    const recipients = new Set(ids.map(id => state.letters.find(letter => letter.id === id)).filter((letter): letter is Letter => !!letter).map(letter => state.people.find(person => person.id === recipientForLetter(state, letter))?.role))
    const recipient = recipients.size === 1 && recipients.has('volunteer') ? 'volunteer' : recipients.size > 1 ? 'mixed' : 'child'
    const ok = await run(() => dispatch(actor.id, { type, ids: selectedIds }), type === 'print' ? '已记录打印，下一步请在实际交给收件人后确认交付。' : '已确认实际交付，收件人的回应期限从今天开始计算。')
    if (ok) { setSelected([]); setConfirmed(false); setPrintOpened(false); setSearchParams({ result: type, count: String(ids.length), last: ids.at(-1) ?? '', recipient }, { replace: true }) }
  }
  async function stopSchoolDelivery(pair: Pair) {
    if (stopReason.trim().length < 2) return
    const ok = await run(() => dispatch(actor.id, { type: 'pause-pair', id: pair.id, reason: stopReason.trim() }), '本校交付已立即停止，并已建立受限保护个案与双签名争议；恢复须经学校和平台分别确认。')
    if (ok) { setStopOpen(false); setStopReason('') }
  }
  if (actor.role !== 'teacher') return <Empty title="这项任务需要老师身份" />

  return <div className="stack operations-page">
    <BackLink fallbackTo={detailId ? `/teacher/tasks/${tab}` : '/space'} fallbackLabel={detailId ? `返回${teacherStages.find(item => item.key === tab)?.label}列表` : '返回收发任务'} />
    <PageHeader eyebrow="老师收发任务" title={detail ? '这封信的收发任务' : teacherStages.find(item => item.key === tab)?.label ?? '收发任务'} description={detail ? `${nameOf(state, detail.authorId)}写给${nameOf(state, recipientForLetter(state, detail))}。请先核对，再记录这一站。` : teacherStages.find(item => item.key === tab)?.description ?? ''} />
    {searchParams.get('result') === 'print' && <WorkflowOutcome title={`已记录 ${searchParams.get('count') || '1'} 封信打印`} status="这些信件现在处于待交付状态；打印不等于已经交到收件人手里。" next="老师在实际交付后确认；送达时间才会启动收件人的回应期限。" to={`/teacher/tasks/deliver${searchParams.get('last') ? `?letter=${encodeURIComponent(searchParams.get('last')!)}` : ''}`} actionLabel="去待交付" />}
    {searchParams.get('result') === 'deliver' && <WorkflowOutcome title={`已确认 ${searchParams.get('count') || '1'} 封信实际交付`} status={deliveryStatus} next={deliveryNext} to={resultRecipient === 'mixed' ? undefined : roleEntryPath(resultRecipient, mode)} actionLabel={resultRecipient === 'mixed' ? undefined : roleEntryAction(resultRecipient, mode)} />}
    {searchParams.get('result') === 'deliver' && resultRecipient === 'child' && searchParams.get('last') && <p className="workflow-next-owner">老师之后需要协助回信时：<Link className="text-button" to={`/teacher/tasks/reply?letter=${encodeURIComponent(searchParams.get('last')!)}`}>查看待回传<ArrowRight size={16} aria-hidden="true" /></Link></p>}
    {searchParams.get('result') === 'reply-submitted' && <WorkflowOutcome title="孩子核对后的回信已提交审核" status="回信等待运营审核，通过前志愿者看不到正文。" next={mode === 'demo' ? '运营演示身份检查这封回信。' : '下一位由运营人员成人测试账号登录并审核。'} to={roleEntryPath('operator', mode)} actionLabel={roleEntryAction('operator', mode)} />}
    {completedLetter && tab === 'print' && completedDelivery?.printedAt && <Notice>这封信已记录打印。下一步请在实际交给收件人后确认交付。<Link className="text-button" to={`/teacher/tasks/deliver?letter=${encodeURIComponent(completedLetter.id)}`}>去待交付<ArrowRight size={16} aria-hidden="true" /></Link></Notice>}
    {completedLetter && tab === 'deliver' && completedDelivery?.deliveredAt && <Notice>已确认实际交付。收件人现在可以阅读或准备回信。{state.people.find(person => person.id === recipientForLetter(state, completedLetter))?.role === 'child' && <>孩子的纸质回信可在待回传中协助提交审核。<Link className="text-button" to="/teacher/tasks/reply">查看待回传<ArrowRight size={16} aria-hidden="true" /></Link></>}</Notice>}
    {completedLetter && tab === 'reply' && completedTask?.status === 'review' && <Notice>回信正在等待运营审核，通过后才会安排投递。<Link className="text-button" to="/teacher/history">查看处理记录<ArrowRight size={16} aria-hidden="true" /></Link></Notice>}
    {error && <Notice tone="error">{error}</Notice>}
    <div className="teacher-stage-body">
      {!detail && <section className="panel task-list stack" aria-label="信件任务列表">
        <div className="section-title"><h2>{tab === 'print' ? '准备好信纸' : tab === 'deliver' ? '确认实际交付' : '等待孩子的回信'}</h2><span className="muted">{current.length} 封</span></div>
        {tab !== 'reply' && current.length > 0 && <label className="checkbox-row"><input type="checkbox" checked={selectable.length > 0 && selectedIds.length === selectable.length} onChange={event => changeSelection(event.target.checked ? selectable.map(letter => letter.id) : [])} disabled={selectable.length === 0} />全选可处理的信件</label>}
        {current.length === 0 && <Empty title="这一步暂时没有待办" description={tab === 'print' ? '审核通过的纸质信件会出现在这里。' : tab === 'deliver' ? '记录已打印后，就可以在这里确认交付。' : '交给孩子的来信会进入这里，等待孩子回信。'} />}
        <div className="stack compact">{current.map(letter => { const pair = pairs.find(item => item.id === letter.pairId)!; const task = state.tasks.find(item => item.letterId === letter.id); return <div key={letter.id} className="operation-letter-row">
          {tab !== 'reply' && <input type="checkbox" aria-label={`选择${nameOf(state, recipientForLetter(state, letter))}的纸质来信`} checked={selectedIds.includes(letter.id)} disabled={pair.status === 'paused' || busy} onChange={event => changeSelection(event.target.checked ? [...selectedIds, letter.id] : selectedIds.filter(id => id !== letter.id))} />}
          <button id={focusDetail(letter.id)} className="letter-select" type="button" onClick={() => openLetter(letter.id)}><strong>纸质来信</strong><span>{nameOf(state, letter.authorId)} → {nameOf(state, recipientForLetter(state, letter))}</span><span className="letter-row-meta">{pair.status === 'paused' ? '陪伴已暂停' : task && tab === 'reply' ? `回应期限 ${formatDate(task.dueAt)}` : '审核已通过'}{task?.status === 'review' ? ' · 回信审核中' : task && isOverdue(state, task) ? ' · 已逾期，运营将跟进' : ''}</span></button>
        </div> })}</div>
      </section>}
      {detail && detailPair && <div className="stack teacher-detail">
        {detailReplyTask && <Notice>孩子的回应期限：{formatDate(detailReplyTask.dueAt)}。老师协助收回纸质回信，提交前请让孩子核对内容。</Notice>}
        <section className="panel stack"><div className="section-title"><h2>{tab === 'print' ? '本次获准打印版' : '这封信的任务信息'}</h2><Badge>{letterRoute(state, detail) === 'school-paper' ? '学校纸质交付' : '线上投递'}</Badge></div>
          {tab === 'print' ? detailContent ? <LetterPaper state={state} letter={detailContent} /> : <p role="status" className="muted">{detailPair.status === 'active' ? '正在按本次打印任务取得获准版本…' : '交付已暂停，当前不能读取打印版。'}</p> : <Notice>这里仅显示完成当前任务所需的状态。老师不会因此获得历史信件全文检索权限。</Notice>}
          {contentError && <Notice tone="error">{contentError}</Notice>}
          <LetterTimeline state={state} letter={detail} />
        </section>
        {detailPair.status === 'active' && <section className="panel stack"><h2>需要立即停止交付？</h2><p className="muted">负责老师可以先停止这组在学校和平台的后续投递，再由未涉事负责人核实。停止不会把风险当作已经查实，老师也不能自行恢复。</p>{stopOpen ? <><div className="field"><label htmlFor="teacher-stop-reason">停止原因</label><input id="teacher-stop-reason" value={stopReason} onChange={event => setStopReason(event.target.value)} placeholder="例如：收件人或内容需要保护性核实" /></div><div className="toolbar"><button className="btn danger" type="button" disabled={busy || stopReason.trim().length < 2} onClick={() => void stopSchoolDelivery(detailPair)}>确认停止并上报异常</button><button className="btn secondary" type="button" disabled={busy} onClick={() => { setStopOpen(false); setStopReason('') }}>取消</button></div></> : <button className="btn secondary" type="button" disabled={busy} onClick={() => setStopOpen(true)}>停止本校交付并上报异常</button>}</section>}
        {detailPair.status === 'paused' && <Notice>这组陪伴已暂停。可以阅读记录并保存代录草稿，恢复后再提交或继续投递。</Notice>}
        {tab === 'reply' && <>
          <section className="panel stack"><h2>阅读与回信分别记录</h2>{state.deliveries.find(item => item.letterId === detail.id)?.witnessedReadAt ? <p>已记录老师见证孩子自愿阅读。孩子仍可自行决定是否回信。</p> : <><p className="muted">只有在孩子已经自愿阅读、且老师亲自见证后，才记录这一事件。实际交付本身不能推断为已阅读。</p><button className="btn secondary" type="button" disabled={busy || !state.deliveries.find(item => item.letterId === detail.id)?.deliveredAt} onClick={() => void run(() => dispatch(actor.id, { type: 'witness-read', id: detail.id }), '已记录见证阅读；这不表示孩子承诺回信。')}>记录见证阅读</button></>}</section>
          <TeacherReplyForm key={detail.id} state={state} actor={actor} notify={notify} original={detail} pair={detailPair} onDirtyChange={reportDirty} onRegisterSave={registerSaveDraft} onSubmitComplete={() => setSearchParams({ letter: detail.id, result: 'reply-submitted' }, { replace: true })} />
        </>}
      </div>}
      {tab !== 'reply' && selectedIds.length > 0 && <section className="panel batch-actions stack">
          <h2>{detail ? '记录这一封信' : `批量处理 ${selectedIds.length} 封信`}</h2>
          <p>{tab === 'print' ? '请先预览 A4 信纸，核对打印结果。' : '请在实际交给收件人后确认。'}</p>
          {tab === 'print' && <button className="btn secondary" type="button" disabled={!selectedIds.length || busy} onClick={() => void openPrint()}><Printer size={17} aria-hidden="true" />打开打印预览</button>}
          {printError && <p className="field-error" role="alert">{printError}</p>}
          <label className="checkbox-row"><input type="checkbox" checked={confirmed} disabled={!selectedIds.length || (tab === 'print' && !printOpened)} onChange={event => setConfirmed(event.target.checked)} />{tab === 'print' ? '我已核对这些信件的打印结果' : '我确认已把这些信件交给对应收件人'}</label>
          <button className="btn" type="button" disabled={busy || !selectedIds.length || !confirmed || (tab === 'print' && !printOpened)} onClick={() => void recordBatch(tab)}>{busy ? '正在记录…' : tab === 'print' ? '记录已打印' : '确认实际交付'}</button>
          <p className="muted small-text">{tab === 'print' ? '打开打印窗口不会自动记为打印完成。已打印也不代表已交付。' : '请在真实交付后记录。交付日期将作为回信期限的起点。'}</p>
        </section>}
    </div>
    {printable.length > 0 && createPortal(<div className="teacher-print-area" aria-hidden="true">{printable.map(letter => <article className="print-letter" key={letter.id}><p className="print-label">谜语书信 · {mode === 'demo' ? '演示书信 / 合成内容' : '书信陪伴计划'}</p><p>亲爱的 {nameOf(state, recipientForLetter(state, letter))}：</p><LetterPaper state={state} letter={letter} /><p className="print-signature">来自 {nameOf(state, letter.authorId)}<br />{formatDate(letter.createdAt)}</p></article>)}</div>, document.body)}
  </div>
}

function TeacherAssignmentPanel({ state, actor, notify }: Props) {
  const coordinateAssignments = (state.teacherAssignments ?? []).filter(item => item.teacherId === actor.id && item.scope.includes('school-coordinate') && Date.parse(item.startsAt) <= Date.parse(state.clock) && (!item.endsAt || Date.parse(state.clock) < Date.parse(item.endsAt)) && !item.revokedAt && (!state.schools?.length || state.schools.some(school => school.id === item.schoolId && school.status === 'active')))
  const schoolIds = new Set(coordinateAssignments.map(item => item.schoolId))
  const children = state.people.filter(person => person.role === 'child' && person.schoolId && schoolIds.has(person.schoolId))
  const teachers = state.people.filter(person => person.role === 'teacher' && person.id !== actor.id && person.accountStatus !== 'disabled' && (!person.schoolId || schoolIds.has(person.schoolId)))
  const manageable = (state.teacherAssignments ?? []).filter(item => schoolIds.has(item.schoolId) && !item.scope.includes('school-coordinate') && !item.revokedAt)
  const [childId, setChildId] = useState(children[0]?.id ?? '')
  const [teacherId, setTeacherId] = useState(teachers[0]?.id ?? '')
  const [startsAt, setStartsAt] = useState(state.clock.slice(0, 10))
  const [endsAt, setEndsAt] = useState('')
  const [scope, setScope] = useState<TeacherScope[]>(['status', 'paper-delivery'])
  const { run, busy, error } = useAction(notify)
  if (!coordinateAssignments.length) return null
  const child = children.find(person => person.id === childId) ?? children[0]
  const schoolId = child?.schoolId ?? coordinateAssignments[0]?.schoolId
  const toggle = (value: TeacherScope) => setScope(old => old.includes(value) ? old.filter(item => item !== value) : [...old, value])
  async function assign() {
    if (!schoolId || !teacherId || !child || !scope.length) return
    await run(() => dispatch(actor.id, { type: 'assign-teacher', schoolId, teacherId, childId: child.id, scope, startsAt: new Date(`${startsAt}T00:00:00+08:00`).toISOString(), endsAt: endsAt ? new Date(`${endsAt}T23:59:59+08:00`).toISOString() : undefined }), '老师授权已保存，并会按学校、孩子、职责和期限判权。')
  }
  return <section className="panel stack"><div className="section-title"><h2>校内老师授权与替补</h2><Badge>协调老师</Badge></div><p className="muted">只能为本校其他老师分配具体孩子、职责和期限；不能给自己扩权，也不能转授“协调老师”。</p>{error && <Notice tone="error">{error}</Notice>}<div className="inline-operation"><div className="field"><label htmlFor="assignment-child">孩子</label><select id="assignment-child" value={child?.id ?? ''} onChange={event => setChildId(event.target.value)}>{children.map(person => <option key={person.id} value={person.id}>{person.nickname}</option>)}</select></div><div className="field"><label htmlFor="assignment-teacher">老师 / 替补</label><select id="assignment-teacher" value={teacherId} onChange={event => setTeacherId(event.target.value)}>{teachers.map(person => <option key={person.id} value={person.id}>{person.nickname}</option>)}</select></div></div><fieldset className="channel-options"><legend>授权职责</legend>{([['status','查看结对与状态'],['capture','当次合成纸信协助'],['paper-delivery','纸质打印与交付'],['protect','校内保护个案']] as [TeacherScope,string][]).map(([value,label]) => <label key={value}><input type="checkbox" checked={scope.includes(value)} onChange={() => toggle(value)}/><span><strong>{label}</strong></span></label>)}</fieldset><div className="inline-operation"><div className="field"><label htmlFor="assignment-start">开始日期</label><input id="assignment-start" type="date" value={startsAt} onChange={event => setStartsAt(event.target.value)}/></div><div className="field"><label htmlFor="assignment-end">结束日期（必填为佳）</label><input id="assignment-end" type="date" value={endsAt} onChange={event => setEndsAt(event.target.value)}/></div><button className="btn" type="button" disabled={busy || !child || !teacherId || !scope.length} onClick={() => void assign()}>保存限期授权</button></div><div className="stack compact">{manageable.map(item => <div className="operation-letter-row" key={item.id}><span><strong>{nameOf(state, item.teacherId)} → {nameOf(state, item.childId)}</strong><small className="muted">{item.scope.join('、')} · {formatDate(item.startsAt)} 至 {item.endsAt ? formatDate(item.endsAt) : '未设结束日期'}</small></span><button className="btn secondary small" type="button" disabled={busy} onClick={() => void run(() => dispatch(actor.id, { type: 'revoke-teacher-assignment', id: item.id }), '授权已撤销；新查询会立即被拒绝。')}>撤销授权</button></div>)}</div></section>
}

export function TeacherPage({ state, actor, notify, mode }: Props) {
  if (actor.role !== 'teacher') return <Empty title="这项任务需要老师身份" />
  const queues = teacherQueues(state, actor)
  const statusPairs = teacherPairs(state, actor, 'status')
  const childGroups = [...new Set(statusPairs.map(pair => pair.childId))].map(childId => ({
    childId,
    pairs: statusPairs.filter(pair => pair.childId === childId),
  }))
  const urgentReply = queues.reply.map(letter => ({ letter, task: state.tasks.find(task => task.letterId === letter.id && task.status === 'awaiting') }))
    .filter(item => item.task && state.pairs.find(pair => pair.id === item.letter.pairId)?.status === 'active')
    .sort((a, b) => Date.parse(a.task!.dueAt) - Date.parse(b.task!.dueAt))[0]
  const soon = urgentReply && Date.parse(urgentReply.task!.dueAt) - Date.parse(state.clock) <= 3 * 24 * 60 * 60 * 1000
  const next = soon ? { stage: 'reply' as const, letter: urgentReply.letter, label: isOverdue(state, urgentReply.task!) ? '先协助这封逾期回信' : '先协助这封临近期限的回信', description: `回应约定于 ${formatDate(urgentReply.task!.dueAt)} 前完成。先了解孩子是否需要帮助。` }
    : queues.deliver[0] ? { stage: 'deliver' as const, letter: queues.deliver[0], label: '先确认这一封是否已交付', description: '信件已打印，请在实际交给收件人后记录交付。' }
    : queues.print[0] ? { stage: 'print' as const, letter: queues.print[0], label: '先准备打印这一封信', description: '审核已通过。预览 A4 信纸并核对后，再记录打印。' }
    : urgentReply ? { stage: 'reply' as const, letter: urgentReply.letter, label: '留意这封信的回信', description: `回应约定于 ${formatDate(urgentReply.task!.dueAt)} 前完成。` }
    : undefined
  const supportTasks = (state.supportTasks ?? []).filter(task => task.ownerTeacherId === actor.id && task.status === 'open')
  const protectionCases = (state.helpCases ?? []).filter(item => item.schoolOwnerId === actor.id && item.status !== 'resolved')
  const submittedCases = (state.helpCases ?? []).filter(item => item.requesterId === actor.id).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  const { run: runGuard, busy: guardBusy, error: guardError } = useAction(notify)
  const [supportNote, setSupportNote] = useState<Record<string, string>>({})
  const [reportPairId, setReportPairId] = useState('')
  const [reportBody, setReportBody] = useState('')
  const [reportDone, setReportDone] = useState(false)
  const schoolDisputes = (state.disputeCases ?? []).filter(item => item.schoolId === actor.schoolId && item.status !== 'decided')
  const canSignDispute = !!actor.schoolId && hasSchoolSeat(state, actor.id, actor.schoolId, state.clock)
  const [disputeChoice, setDisputeChoice] = useState<Record<string, DisputeDecision>>({})
  const [disputeReason, setDisputeReason] = useState<Record<string, string>>({})
  async function signDispute(id: string) {
    const choice = disputeChoice[id]
    const reason = (disputeReason[id] ?? '').trim()
    if (!choice || reason.length < 3) return
    await runGuard(() => dispatch(actor.id, { type: 'decide-dispute', id, decision: choice, reason }), '已记录学校侧签名。平台侧签名完成且方向一致后，才允许恢复结对。')
  }
  async function completeSupportTask(id: string) {
    const note = (supportNote[id] ?? '').trim()
    if (note.length < 3) return
    await runGuard(() => dispatch(actor.id, { type: 'complete-support-task', id, note }), '支持任务已记录完成；这不表示个案已经查实或关闭。')
  }
  async function reportAbnormal() {
    const pair = statusPairs.find(item => item.id === reportPairId)
    if (!pair || reportBody.trim().length < 2) return
    const ok = await runGuard(() => dispatch(actor.id, { type: 'help', pairId: pair.id, reportedParty: 'volunteer', reportedPersonId: pair.volunteerId, body: reportBody.trim() }), '已保存到受限保护队列，等待独立保护负责人接手；这不表示已上报学校或外部机构。')
    if (ok) { setReportBody(''); setReportPairId(''); setReportDone(true) }
  }
  return <div className="stack operations-page">
    <PageHeader eyebrow="收发任务" title="今天，先照顾好这一封。" description="信件依次经过打印、实际交付与回信。每一步都由你确认后才会进入下一站。" />
    <section className="stack" aria-label="保护与异常">
      <div className="section-title"><h2>保护与异常</h2><Badge tone={protectionCases.length ? 'warning' : undefined}>{protectionCases.length ? `${protectionCases.length} 件由保护负责人跟进` : '暂无待处理个案'}</Badge></div>
      {supportTasks.length > 0 && <div className="stack compact">{supportTasks.map(task => <article className="panel stack" key={task.id}><div><strong>联系孩子，确认近况与需要的支持</strong><small className="muted"> · {nameOf(state, task.childId)} · {formatDate(task.dueAt)} 前</small></div><div className="field"><label htmlFor={`support-${task.id}`}>已完成的支持动作</label><input id={`support-${task.id}`} value={supportNote[task.id] ?? ''} onChange={event => setSupportNote(old => ({ ...old, [task.id]: event.target.value }))} placeholder="例如：已联系孩子，本周状态平稳" /></div><button className="btn secondary small" type="button" disabled={guardBusy || (supportNote[task.id] ?? '').trim().length < 3} onClick={() => void completeSupportTask(task.id)}>记录已完成</button></article>)}</div>}
      {protectionCases.length > 0 && <div className="stack compact">{protectionCases.map(item => <Link className="operation-letter-row" to={`/teacher/safeguarding?item=${encodeURIComponent(item.id)}`} key={item.id}><span><strong>保护个案 · {item.severity === 'high' ? '高严重度' : '一般'}</strong><small className="muted">{formatDate(item.createdAt)} · {item.status === 'open' ? '尚待接手' : '处理中'}</small></span><span className="letter-row-meta">进入受限流程处理</span></Link>)}</div>}
      {submittedCases.length > 0 && <details className="letter-options"><summary>查看我提交的异常进度（{submittedCases.length}）</summary><div className="stack compact">{submittedCases.map(item => <div className="operation-letter-row" key={`submitted-${item.id}`}><span><strong>异常记录 · {item.status === 'resolved' ? '已处理' : item.status === 'claimed' ? '处理中' : '等待接手'}</strong><small className="muted">提交于 {formatDate(item.createdAt)} · 更新于 {formatDate(item.updatedAt)}</small></span><span className="letter-row-meta">{item.status === 'resolved' ? '处理流程已关闭' : '受限保护流程处理中'}</span></div>)}</div></details>}
      {statusPairs.length > 0 && (reportDone ? <Notice>异常已保存到受限保护队列，等待独立保护负责人接手。这不表示已上报学校或外部机构。</Notice> : <details className="letter-options" open><summary>上报当次收发异常</summary><div className="stack"><div className="field"><label htmlFor="report-pair">涉及哪组结对</label><select id="report-pair" value={reportPairId} onChange={event => setReportPairId(event.target.value)}><option value="">请选择</option>{statusPairs.map(pair => <option key={pair.id} value={pair.id}>{nameOf(state, pair.childId)} ↔ {nameOf(state, pair.volunteerId)}</option>)}</select></div><div className="field"><label htmlFor="report-body">发生了什么（不写孩子的隐私细节）</label><textarea id="report-body" rows={3} value={reportBody} onChange={event => setReportBody(event.target.value)} /></div><button className="btn secondary" type="button" disabled={guardBusy || !reportPairId || reportBody.trim().length < 2} onClick={() => void reportAbnormal()}>保存异常记录</button>{guardError && <p className="field-error" role="alert">{guardError}</p>}</div></details>)}
    </section>
    {canSignDispute && schoolDisputes.length > 0 && <section className="stack" aria-label="学校侧争议签名">
      <div className="section-title"><h2>学校侧争议签名</h2><Badge tone="warning">{schoolDisputes.length} 件待学校签名</Badge></div>
      <p className="muted small-text">安全暂停必须由学校负责人与平台当值保护岗分别签名，且方向一致，才会解除。这里只记录裁决，不代替与家长和孩子的沟通。</p>
      {schoolDisputes.map(item => <article className="panel stack" key={item.id}>
        <div><strong>{item.topic === 'pause' ? '暂停与处理方式' : item.topic === 'delivery' ? '纸质交付' : item.topic === 'pairing' ? '结对安排' : item.topic === 'release' ? '信息发布' : '数据访问'}</strong><p className="muted small-text">{formatDate(item.openedAt)} · 学校签名：{item.schoolDecisionBy ? nameOf(state, item.schoolDecisionBy) : '未签名'} · 平台签名：{item.platformDecisionBy ? nameOf(state, item.platformDecisionBy) : '未签名'}</p></div>
        {item.reason && <p className="preserve-lines">{item.reason}</p>}
        {!item.schoolDecisionBy ? <div className="stack"><div className="field"><label htmlFor={`school-dispute-choice-${item.id}`}>学校侧裁决方向</label><select id={`school-dispute-choice-${item.id}`} value={disputeChoice[item.id] ?? ''} onChange={event => setDisputeChoice(old => ({ ...old, [item.id]: event.target.value as DisputeDecision }))}><option value="" disabled>请选择</option><option value="uphold-school">支持学校方案</option><option value="uphold-platform">支持平台方案</option><option value="compromise">折中方案</option></select></div><div className="field"><label htmlFor={`school-dispute-reason-${item.id}`}>学校签名理由</label><input id={`school-dispute-reason-${item.id}`} value={disputeReason[item.id] ?? ''} onChange={event => setDisputeReason(old => ({ ...old, [item.id]: event.target.value }))} /></div><button className="btn secondary small" type="button" disabled={guardBusy || !disputeChoice[item.id] || (disputeReason[item.id] ?? '').trim().length < 3} onClick={() => void signDispute(item.id)}>记录学校签名</button></div> : <Notice>学校侧已完成签名，等待平台当值保护岗签名。</Notice>}
      </article>)}
      {guardError && <p className="field-error" role="alert">{guardError}</p>}
    </section>}
    {next ? <section className="operations-next panel stack" aria-label="现在最需要处理的任务">
      <p className="eyebrow">现在最需要处理</p><h2>{next.label}</h2><p><strong>纸质来信</strong> · {nameOf(state, next.letter.authorId)}写给{nameOf(state, recipientForLetter(state, next.letter))}</p><p className="muted">{next.description}</p>
      <ContextLink className="btn" to={`/teacher/tasks/${next.stage}?letter=${encodeURIComponent(next.letter.id)}`} returnTo={`/teacher/tasks/${next.stage}`} returnLabel={`返回${teacherStages.find(item => item.key === next.stage)?.label}列表`} historyBack={false}>查看并处理这封信<ArrowRight size={17} aria-hidden="true" /></ContextLink>
    </section> : <section className="panel stack"><h2>今天没有需要立即处理的信</h2><p className="muted">审核通过的纸质信会出现在待打印列表。也可以查看以往的收发记录。</p><Link className="btn secondary" to="/teacher/history">查看处理记录</Link></section>}
    <section className="stack" aria-label="负责孩子与独立结对">
      <div className="section-title"><h2>我负责的孩子与每组结对</h2><span className="muted">{childGroups.length} 名孩子 · {statusPairs.length} 组结对</span></div>
      {childGroups.length ? childGroups.map(group => <article className="panel stack" key={group.childId}>
        <div className="section-title"><h3>{nameOf(state, group.childId)}</h3><Badge>{group.pairs.filter(pair => pair.status === 'active').length} 组进行中</Badge></div>
        <div className="stack compact">{group.pairs.map(pair => {
          const pairLetters = state.letters.filter(letter => letter.pairId === pair.id)
          const awaiting = state.tasks.filter(task => task.pairId === pair.id && task.status === 'awaiting').length
          const paperPending = pairLetters.filter(letter => letter.authorId === pair.volunteerId && letterRoute(state, letter) === 'school-paper' && letter.moderation === 'approved' && !state.deliveries.find(item => item.letterId === letter.id)?.deliveredAt).length
          return <div className="operation-letter-row" key={pair.id}><span><strong>{nameOf(state, pair.volunteerId)}</strong><small className="muted">独立结对 · {pair.status === 'paused' ? '已暂停' : pair.status === 'ended' ? '已结束' : '进行中'}</small></span><span className="letter-row-meta">{paperPending ? `${paperPending} 封待收发` : '无待交付纸信'} · {awaiting ? `${awaiting} 项待回应` : '无待回应'}</span></div>
        })}</div>
      </article>) : <Empty title="当前没有有效的孩子指派" description="校方负责人完成限期授权后，老师才能看到相应孩子的结对和任务状态。" />}
    </section>
    <section className="stack" aria-label="三步收发任务"><div className="section-title"><h2>按步骤查看任务</h2></div><div className="teacher-stage-cards">{teacherStages.map(stage => <Link className="teacher-stage-card" to={`/teacher/tasks/${stage.key}`} key={stage.key}><span className="eyebrow">{stage.key === 'print' ? '第一步' : stage.key === 'deliver' ? '第二步' : '第三步'}</span><strong>{stage.label}<span className="teacher-stage-count">{queues[stage.key].length}</span></strong><span>{stage.description}</span><span className="teacher-stage-link">进入{stage.label}<ArrowRight size={16} aria-hidden="true" /></span></Link>)}</div></section>
    <Notice>儿童出站纸信的拍摄、OCR 与人工查阅在真实试点中仍是法律闸门。当前入口只验证成人合成内容，点击保存只会形成私有待处理草稿，不代表已审核或已送达。</Notice>
    <TeacherAssignmentPanel state={state} actor={actor} notify={notify} mode={mode} />
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
  const location = useLocation()
  useFocusedDetail(searchParams.get('letter') ?? '')
  if (actor.role !== 'teacher') return <Empty title="这项任务需要老师身份" />
  const pairIds = new Set(teacherPairs(state, actor, 'status').map(pair => pair.id))
  const letters = state.letters.filter(letter => pairIds.has(letter.pairId) && letterRoute(state, letter) === 'school-paper' && letter.moderation === 'approved').sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  const detail = letters.find(letter => letter.id === searchParams.get('letter'))
  return <div className="stack operations-page">
    <BackLink fallbackTo={detail ? '/teacher/history' : '/space'} fallbackLabel={detail ? '返回处理记录' : '返回收发任务'} />
    <PageHeader eyebrow="老师处理记录" title={detail ? '这封信的收发记录' : '每一步，都有记录。'} description={detail ? '这里分别记录审核、打印、交付与阅读。' : '已打印不等于已交付；信件仍需由老师确认实际交给收件人。'} />
    {detail ? <section className="panel stack"><p>{nameOf(state, detail.authorId)} → {nameOf(state, recipientForLetter(state, detail))} · 记录编号 {detail.id}</p><LetterTimeline state={state} letter={detail} /></section>
      : <section className="panel stack task-list" aria-label="历史信件列表">{letters.length ? letters.map(letter => { const delivery = state.deliveries.find(item => item.letterId === letter.id); return <button id={`teacher-history-${letter.id}`} className="operation-letter-row letter-select" type="button" key={letter.id} onClick={() => setSearchParams({ letter: letter.id }, { state: { returnContext: { to: '/teacher/history', label: '返回处理记录', sourcePath: `${location.pathname}${location.search}`, sourceKey: location.key, focusId: `teacher-history-${letter.id}`, historyBack: true } } })}><strong>纸质来信 · {formatDate(letter.createdAt)}</strong><span>{nameOf(state, letter.authorId)} → {nameOf(state, recipientForLetter(state, letter))} · 编号 {letter.id}</span><span className="letter-row-meta">{delivery?.deliveredAt ? '已交付' : delivery?.printedAt ? '已打印，待交付' : '待打印'} · {formatDate(letter.updatedAt)}</span></button> }) : <Empty title="还没有纸质书信记录" description="审核通过的纸质信件会按收发进度记录在这里。" />}</section>}
  </div>
}

function ReviewQueue({ state, actor, notify, mode: dataMode = 'demo' }: Props) {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const mode = searchParams.get('view') === 'history' ? 'history' : 'pending'
  const selectedId = searchParams.get('letter') ?? ''
  useFocusedDetail(selectedId)
  const [note, setNote] = useState('')
  const [validation, setValidation] = useState('')
  const [confirmApprove, setConfirmApprove] = useState(false)
  const [transcriptFaithfulConfirmed, setTranscriptFaithfulConfirmed] = useState(false)
  const [imagePrivacyConfirmed, setImagePrivacyConfirmed] = useState(false)
  const [authorizedLetters, setAuthorizedLetters] = useState<Record<string, Letter>>({})
  const [contentError, setContentError] = useState('')
  const { run, busy, error } = useAction(notify)
  const letters = state.letters.filter(letter => {
    const inQueue = mode === 'pending' ? letter.moderation === 'pending' : ['approved', 'returned'].includes(letter.moderation)
    if (!inQueue || dataMode !== 'live') return inQueue
    return mode === 'pending' ? letter.reviewAssigneeId === actor.id : state.reviews.some(review => review.letterId === letter.id && review.operatorId === actor.id)
  })
  const letterMetadata = letters.find(item => item.id === selectedId)
  const letter = letterMetadata && (dataMode === 'live' ? authorizedLetters[letterMetadata.id] : letterMetadata)
  const pair = state.pairs.find(item => item.id === letterMetadata?.pairId)
  useEffect(() => { setNote(''); setValidation(''); setConfirmApprove(false); setTranscriptFaithfulConfirmed(false); setImagePrivacyConfirmed(false); setContentError('') }, [letterMetadata?.id])
  useEffect(() => {
    if (dataMode !== 'live' || !letterMetadata || authorizedLetters[letterMetadata.id]) return
    let cancelled = false
    void cloudLetter(letterMetadata.id).then(full => { if (!cancelled) setAuthorizedLetters(old => ({ ...old, [full.id]: full })) }).catch(cause => { if (!cancelled) setContentError(cause instanceof Error ? cause.message : '无法取得这封信的被分派审核版本。') })
    return () => { cancelled = true }
  }, [dataMode, letterMetadata?.id])
  async function review(decision: 'approved' | 'returned') {
    if (!letterMetadata || (dataMode === 'live' && !letter)) return
    if (decision === 'returned' && note.trim().length < 4) { setValidation('请写下至少 4 个字的具体修改建议。'); document.getElementById('review-note')?.focus(); return }
    const success = decision === 'returned' ? '已退回修改，原信与修改建议均已保留。' : pair?.status === 'paused' ? '审核通过，陪伴恢复后仍需逐封复核。' : letter && letterRoute(state, letter) === 'school-paper' ? '审核通过，已进入老师的待打印列表。' : '审核通过，已送到指定收件人的信箱。'
    const ok = await run(() => dispatch(actor.id, { type: 'review-letter', id: letterMetadata.id, decision, note: note.trim(), transcriptFaithfulConfirmed, imagePrivacyConfirmed }), success)
    if (ok) { setNote(''); setConfirmApprove(false); setSearchParams({ view: 'pending', result: decision, last: letterMetadata.id }, { replace: true }) }
  }
  const resultKind = searchParams.get('result')
  const resultLetter = state.letters.find(item => item.id === searchParams.get('last'))
  const resultPair = state.pairs.find(item => item.id === resultLetter?.pairId)
  const resultDelivery = state.deliveries.find(item => item.letterId === resultLetter?.id)
  const author = state.people.find(person => person.id === resultLetter?.authorId)
  const recipient = resultLetter ? state.people.find(person => person.id === recipientForLetter(state, resultLetter)) : undefined
  const nextRole = resultKind === 'returned' ? author?.role : resultLetter && letterRoute(state, resultLetter) === 'school-paper' ? 'teacher' : recipient?.role
  const selectedRiddle = letter?.riddleId ? riddles.find(item => item.id === letter.riddleId) : undefined
  const safetySignals = letter ? detectContentSafetySignals({ title: letter.title, body: letter.body, riddleQuestion: selectedRiddle?.question, riddleHint: selectedRiddle?.hint, riddleAnswer: selectedRiddle?.answer, hasImage: !!letter.attachmentId || !!letter.manuscriptAssetId }) : []
  const needsManuscriptApproval = !!letter && !!pair && letter.authorId === pair.childId && !!letter.attachmentId
  return <div className="stack">{letterMetadata && <BackLink fallbackTo={`/operator/review?view=${mode}`} fallbackLabel={mode === 'history' ? '返回已审记录' : '返回待审核列表'} />}
    {!letterMetadata && <div className="toolbar"><button type="button" className={`btn small ${mode === 'pending' ? '' : 'secondary'}`} aria-pressed={mode === 'pending'} onClick={() => setSearchParams({}, { replace: true })}>等待审核</button><button type="button" className={`btn small ${mode === 'history' ? '' : 'secondary'}`} aria-pressed={mode === 'history'} onClick={() => setSearchParams({ view: 'history' }, { replace: true })}>已审记录</button></div>}
    {!letterMetadata && resultKind && resultLetter && <WorkflowOutcome title={resultKind === 'approved' ? '这封信已通过审核' : '这封信已退回修改'} status={resultKind === 'returned' ? `原文和修改建议已保留；当前状态为“需要修改”。${searchParams.get('last') ? ` 信件：${resultLetter.title}。` : ''}` : resultPair?.status === 'paused' ? '审核通过，陪伴暂停期间暂缓投递。' : resultDelivery?.deliveredAt ? '线上信件已经送达收件人信箱。' : letterRoute(state, resultLetter) === 'school-paper' ? '信件已进入老师的待打印列表；打印和实际交付分别记录。' : '信件已通过审核，正在进入收件人的信箱。'} next={resultKind === 'returned' ? `${author?.nickname || '写信人'}查看建议并重新提交。` : resultLetter && letterRoute(state, resultLetter) === 'school-paper' ? '老师预览并打印，实际交付后再记录。' : `${recipient?.nickname || '收件人'}打开来信并回应。`} to={nextRole ? roleEntryPath(nextRole, dataMode) : undefined} actionLabel={nextRole ? roleEntryAction(nextRole, dataMode) : undefined} />}
    <div className="operation-focus">{!letterMetadata && <section className="panel stack task-list"><div className="section-title"><h2>{mode === 'pending' ? '只处理分派给我的信' : '保留每一次审核记录'}</h2><span className="muted">{letters.length} 封</span></div>{!letters.length && <Empty title={mode === 'pending' ? '待审信件已处理完' : '暂时没有已审信件'} description="新的来信由审核负责人逐件分派，不因运营身份自动开放全文。" />}<div className="stack compact">{letters.map(item => <button id={`operator-review-${item.id}`} key={item.id} type="button" className="operation-letter-row letter-select" onClick={() => setSearchParams({ ...(mode === 'history' ? { view: 'history' } : {}), letter: item.id }, { state: { returnContext: { to: mode === 'history' ? '/operator/review?view=history' : '/operator/review', label: mode === 'history' ? '返回已审记录' : '返回待审核列表', sourcePath: `${location.pathname}${location.search}`, sourceKey: location.key, focusId: `operator-review-${item.id}`, historyBack: true } } })}><strong>{item.title}</strong><span>{nameOf(state, item.authorId)} · {item.replyTo ? '回信' : '来信'}</span><span className="letter-row-meta">{moderationLabel[item.moderation]} · {formatDate(item.updatedAt)}</span></button>)}</div></section>}
      {letterMetadata && !letter && <section className="panel stack" aria-live="polite"><h2>正在取得被分派的审核版本</h2><p className="muted">普通任务快照不携带正文；本次读取会按对象授权并记录访问。</p>{contentError && <Notice tone="error">{contentError}</Notice>}</section>}
      {letter && pair && <section className="panel stack"><div className="section-title"><h2>{mode === 'pending' ? '阅读与审核' : '信件与审核记录'}</h2><Badge>{letter.authorId === pair.childId ? '孩子写给志愿者' : '志愿者写给孩子'}</Badge></div><p className="muted">{nameOf(state, letter.authorId)} → {nameOf(state, recipientForLetter(state, letter))} · {letterRoute(state, letter) === 'school-paper' ? '学校纸质交付' : '线上投递'}</p><LetterPaper state={state} letter={letter} />{(letter.submissionVersions?.length ?? 0) > 1 && <details className="version-history"><summary>查看以前提交的版本（{letter.submissionVersions!.length} 次）</summary>{letter.submissionVersions!.slice(0,-1).map(version => <article key={version.revision}><p className="muted small-text">第 {version.revision} 版 · {formatDate(version.submittedAt)}</p><h3>{version.title}</h3><p className="preserve-lines">{version.body}</p></article>)}</details>}{mode === 'pending' ? <>
        <Notice>人工检查正文、谜语题面、提示和答案，以及附件里的文字、二维码和边角信息。重点识别索要联系方式、诱导转微信或私聊、要求保密、送礼、见面和回应压力。自动提示只能辅助，未命中不代表安全；表达难过或求助本身不是违规。</Notice>
        <section className="pre-submit-check stack" aria-label="辅助风险提示"><h3>辅助风险提示</h3>{safetySignals.length ? <ul>{safetySignals.map(signal => <li key={signal.kind}><strong>{signal.label}</strong><br/><span className="muted small-text">{signal.evidence}</span></li>)}</ul> : <p>未发现规则提示。这不代表内容安全，仍需逐字段和图片人工检查。</p>}</section>
        {pair.status === 'ended' && <Notice tone="warning">这段结对已经结束。请退回尚未寄出的信件，并向写信人说明后续安排。</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        <div className="field"><label htmlFor="review-note">审核备注 / 修改建议（退回时必填）</label><textarea id="review-note" rows={3} value={note} onChange={event => { setNote(event.target.value); setValidation('') }} aria-invalid={!!validation} aria-describedby="review-note-help review-note-error" /><p id="review-note-help" className="muted small-text">请告诉写信人哪里需要调整、可以怎样写。原信会保留。</p>{validation && <p id="review-note-error" className="field-error">{validation}</p>}</div>
        {confirmApprove ? <div className="pre-submit-check stack"><strong>确认这封信可以送往下一站？</strong><p>{pair.status === 'paused' ? '陪伴暂停中，审核通过后仍需复核当前收件人和版本，不能自动投递。' : letterRoute(state, letter) === 'school-paper' ? '通过后由负责老师打印并确认实际交付；回应期限从交付时开始。' : '通过后只会送到这封信固定的唯一收件人。'}如果这封信回应了待办，审核通过后回应任务会完成；投递继续单独记录。</p>{needsManuscriptApproval && <><label className="checkbox-row"><input type="checkbox" checked={transcriptFaithfulConfirmed} onChange={event => setTranscriptFaithfulConfirmed(event.target.checked)} />已逐行核对忠实转写，没有补写、润色或改变孩子语气</label><label className="checkbox-row"><input type="checkbox" checked={imagePrivacyConfirmed} onChange={event => setImagePrivacyConfirmed(event.target.checked)} />已检查图像四周、二维码和元数据；合成样本无需遮盖或已完成必要处理</label><Notice tone="warning">真实儿童流程仍关闭。当前只会为成年合成样本生成与私有原稿分离的获准图像副本。</Notice></>}<div className="toolbar"><button type="button" className="btn" disabled={busy || needsManuscriptApproval && (!transcriptFaithfulConfirmed || !imagePrivacyConfirmed)} onClick={() => void review('approved')}>确认通过审核</button><button type="button" className="btn secondary" disabled={busy} onClick={() => setConfirmApprove(false)}>再检查一下</button></div></div> : <div className="toolbar"><button type="button" className="btn secondary" disabled={busy} onClick={() => void review('returned')}>退回修改</button><button type="button" className="btn" disabled={busy || pair.status === 'ended'} onClick={() => setConfirmApprove(true)}><Check size={16} aria-hidden="true" />通过审核</button></div>}
      </> : <LetterTimeline state={state} letter={letter} />}</section>}
    </div>
  </div>
}

function Matching({ state, actor, notify, mode = 'demo' }: Props) {
  const [childId, setChildId] = useState('')
  const [volunteerId, setVolunteerId] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [pauseId, setPauseId] = useState('')
  const [pauseReason, setPauseReason] = useState('')
  const [endId, setEndId] = useState('')
  const [endReason, setEndReason] = useState('')
  const [validation, setValidation] = useState('')
  const { run, busy, error } = useAction(notify)
  const children = state.people.filter(person => person.role === 'child' && (mode === 'demo' || person.accountStatus === 'active' && person.guardianConsent && person.teacherId))
  const allVolunteers = state.people.filter(person => person.role === 'volunteer' && (mode === 'demo' || person.accountStatus === 'active' && person.volunteerApproved))
  const teachers = state.people.filter(person => person.role === 'teacher' && (mode === 'demo' || person.accountStatus === 'active'))
  const currentChild = children.some(person => person.id === childId) ? childId : children[0]?.id ?? ''
  const volunteers = allVolunteers.filter(person => !state.pairs.some(pair => pair.status !== 'ended' && pair.childId === currentChild && pair.volunteerId === person.id))
  const currentVolunteer = volunteers.some(person => person.id === volunteerId) ? volunteerId : volunteers[0]?.id ?? ''
  const eligibleTeachers = mode === 'live' && (state.teacherAssignments?.length ?? 0) > 0
    ? teachers.filter(person => teacherScope(state, person.id, currentChild, 'status', state.clock))
    : mode === 'live' && state.people.find(person => person.id === currentChild)?.teacherId
      ? teachers.filter(person => person.id === state.people.find(child => child.id === currentChild)?.teacherId)
      : teachers
  const currentTeacher = eligibleTeachers.some(person => person.id === teacherId) ? teacherId : eligibleTeachers[0]?.id ?? ''
  async function match() {
    if (!currentChild || !currentVolunteer || !currentTeacher) return
    await run(() => dispatch(actor.id, { type: 'match', childId: currentChild, volunteerId: currentVolunteer, teacherId: currentTeacher, channel: 'online' }), '独立结对已建立；每封信仍需明确选择这组结对和逐封投递方式。')
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
      <div className="pre-submit-check"><p>{nameOf(state, currentChild)} ↔ {nameOf(state, currentVolunteer)}</p><p>由 {nameOf(state, currentTeacher)} 在授权范围内监管。结对不锁定投递方式；志愿者每封信分别选择线上或学校纸质交付，孩子出站纸信固定在线到达指定志愿者。</p></div><button type="submit" className="btn" disabled={busy || !currentTeacher || !currentVolunteer}><Users size={17} aria-hidden="true" />{busy ? '正在建立…' : '建立独立结对'}</button>
    </> : <Empty title={children.length ? '暂时没有可结对的志愿者' : '暂时没有符合条件的待结对孩子'} description={mode === 'live' ? '请在“加入与账号”中检查监护授权、负责老师绑定和志愿者审核状态。' : '暂停中的结对仍保留原来的伙伴关系。'} />}</form>
      <section className="panel stack"><h2>伙伴与结对记录</h2>{!state.pairs.length && <Empty title="还没有结对" description="从左侧选择伙伴，开始第一段陪伴。" />}<div className="stack">{state.pairs.map(pair => <article className="pair-row stack" key={pair.id}><div className="section-title"><strong>{nameOf(state, pair.childId)} ↔ {nameOf(state, pair.volunteerId)}</strong><Badge tone={pair.status === 'active' ? 'success' : 'warning'}>{pair.status === 'paused' ? '暂停中' : pair.status === 'ended' ? '已结束' : '陪伴中'}</Badge></div><p className="muted small-text">{nameOf(state, pair.teacherId)} 协助 · 每封信单独选择投递方式 · {formatDate(pair.startedAt)} 开始</p>{pair.status === 'paused' && <p className="small-text">暂停原因：{pair.pauseReason}<br />暂停于 {formatDate(pair.pausedAt ?? '')}；恢复后积压信件仍需逐封复核，不会自动投递。</p>}{pair.status === 'ended' && <p className="small-text">{formatDate(pair.endedAt ?? pair.startedAt)} 结束 · {pair.endReason}</p>}{pauseId === pair.id || endId === pair.id ? <div className="stack compact"><div className="field"><label htmlFor={`pair-reason-${pair.id}`}>{pauseId === pair.id ? '暂停原因' : '结束原因'}（必填）</label><input id={`pair-reason-${pair.id}`} value={pauseId === pair.id ? pauseReason : endReason} onChange={event => { pauseId === pair.id ? setPauseReason(event.target.value) : setEndReason(event.target.value); setValidation('') }} placeholder={pauseId === pair.id ? '例如：学校放假，暂时无法收发' : '例如：志愿者无法继续参与'} aria-invalid={!!validation} aria-describedby={validation ? `pair-error-${pair.id}` : undefined} />{validation && <p id={`pair-error-${pair.id}`} className="field-error">{validation}</p>}</div><p className="muted small-text">{pauseId === pair.id ? '暂停期间停止催办，已有信件和记录会保留。' : '结束后停止新信往来，原伙伴仍可查看自己的历史。'}</p><div className="toolbar"><button className="btn small" type="button" disabled={busy} onClick={() => pauseId === pair.id ? void pause(pair) : void end(pair)}>{pauseId === pair.id ? '确认暂停' : '确认结束结对'}</button><button className="btn secondary small" type="button" onClick={() => { setPauseId(''); setEndId(''); setValidation('') }}>取消</button></div></div> : pair.status !== 'ended' && <div className="toolbar"><button className="btn secondary small" type="button" disabled={busy} onClick={() => pair.status === 'paused' ? void run(() => dispatch(actor.id, { type: 'resume-pair', id: pair.id }), '陪伴已恢复；积压信件仍需逐封复核后再放行。') : (setPauseId(pair.id), setEndId(''), setPauseReason(''), setValidation(''))}>{pair.status === 'paused' ? '恢复陪伴' : '暂停这一组'}</button><button className="btn secondary small" type="button" disabled={busy} onClick={() => { setEndId(pair.id); setPauseId(''); setEndReason(''); setValidation('') }}>结束结对</button></div>}</article>)}</div></section>
    </div></div>
}

function HelpCaseQueue({ state, actor, notify, mode = 'demo' }: Props) {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const filter = searchParams.get('status') === 'resolved' ? 'resolved' : 'open'
  const selectedId = searchParams.get('item') ?? ''
  const [authorizedCases, setAuthorizedCases] = useState<Record<string, HelpCase>>({})
  const [contentError, setContentError] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [resolution, setResolution] = useState('')
  const [validation, setValidation] = useState('')
  const [pauseAllConfirm, setPauseAllConfirm] = useState(false)
  const [pauseAllReason, setPauseAllReason] = useState('')
  const [triageSeverity, setTriageSeverity] = useState<'low' | 'medium' | 'high'>('medium')
  const [triageReportRequired, setTriageReportRequired] = useState(false)
  const [triageNote, setTriageNote] = useState('')
  const [reportAuthority, setReportAuthority] = useState('')
  const [reportReceipt, setReportReceipt] = useState('')
  const [reportReason, setReportReason] = useState('')
  const { run, busy, error } = useAction(notify)
  useFocusedDetail(selectedId)
  const grantedCaseIds = new Set((state.accessGrants ?? []).filter(grant => grant.actorId === actor.id && grant.targetType === 'help-case' && ['audit-review', 'data-request'].includes(grant.purpose) && grantIsActive(grant, state.clock)).map(grant => grant.targetId))
  const reportReviewCaseIds = new Set((state.accessGrants ?? []).filter(grant => grant.actorId === actor.id && grant.targetType === 'help-case' && grant.purpose === 'audit-review' && grantIsActive(grant, state.clock)).map(grant => grant.targetId))
  const visible = (state.helpCases ?? []).filter(item => !item.excludedActorIds.includes(actor.id) && (
    actor.role === 'teacher' ? item.schoolOwnerId === actor.id
      : actor.role === 'operator' && (hasPermission(actor, 'safeguarding') && (item.ownerId === actor.id || item.backupOwnerId === actor.id)
        || hasPermission(actor, 'privacy') && grantedCaseIds.has(item.id))
  ))
  const items = visible.filter(item => filter === 'resolved' ? item.status === 'resolved' : item.status !== 'resolved').sort((a, b) => {
    const aOverdue = a.status !== 'resolved' && !!a.slaDueAt && Date.parse(a.slaDueAt) < Date.parse(state.clock)
    const bOverdue = b.status !== 'resolved' && !!b.slaDueAt && Date.parse(b.slaDueAt) < Date.parse(state.clock)
    return Number(bOverdue) - Number(aOverdue) || Date.parse(a.slaDueAt ?? a.createdAt) - Date.parse(b.slaDueAt ?? b.createdAt)
  })
  const selectedMetadata = visible.find(item => item.id === selectedId)
  const selected = selectedMetadata && (mode === 'live' ? authorizedCases[selectedMetadata.id] : selectedMetadata)
  const canHandleCase = !!selectedMetadata && (actor.role === 'teacher' && selectedMetadata.schoolOwnerId === actor.id
    || actor.role === 'operator' && hasPermission(actor, 'safeguarding') && (selectedMetadata.ownerId === actor.id || selectedMetadata.backupOwnerId === actor.id))
  const isPrivacyReviewer = actor.role === 'operator' && hasPermission(actor, 'privacy')
  const hasRestrictedGrant = isPrivacyReviewer && !!selectedMetadata && grantedCaseIds.has(selectedMetadata.id)
  const canPrivacyReview = isPrivacyReviewer && !!selectedMetadata && reportReviewCaseIds.has(selectedMetadata.id)
  const queuePath = actor.role === 'teacher'
    ? `/teacher/safeguarding${filter === 'resolved' ? '?status=resolved' : ''}`
    : `/operator/followups?kind=help${filter === 'resolved' ? '&status=resolved' : ''}`
  const owners = state.people.filter(person => person.role === 'operator' && person.accountStatus !== 'disabled' && hasPermission(person, 'safeguarding') && selectedMetadata && person.id !== selectedMetadata.reportedPersonId && !selectedMetadata.excludedActorIds.includes(person.id))
  useEffect(() => { setOwnerId(selectedMetadata?.ownerId ?? ''); setResolution(''); setValidation(''); setContentError(''); setPauseAllConfirm(false); setPauseAllReason(''); setTriageSeverity(selectedMetadata?.severity ?? 'medium'); setTriageReportRequired(!!selectedMetadata?.reportRequired); setTriageNote(''); setReportAuthority(''); setReportReceipt(''); setReportReason('') }, [selectedMetadata?.id])
  useEffect(() => {
    if (mode !== 'live' || !selectedMetadata || authorizedCases[selectedMetadata.id]) return
    let cancelled = false
    void cloudHelpCase(selectedMetadata.id).then(full => { if (!cancelled) setAuthorizedCases(old => ({ ...old, [full.id]: full })) }).catch(cause => { if (!cancelled) setContentError(cause instanceof Error ? cause.message : '无法取得这个保护个案的受限内容。') })
    return () => { cancelled = true }
  }, [mode, selectedMetadata?.id])
  async function claim() {
    if (!selectedMetadata) return
    await run(() => dispatch(actor.id, { type: 'claim-help-case', id: selectedMetadata.id }), '已记录接手；这不表示个案已经查实或处理完成。')
  }
  async function assign() {
    if (!selectedMetadata || !ownerId) return
    await run(() => dispatch(actor.id, { type: 'assign-help-case', id: selectedMetadata.id, ownerId }), '已转派给未涉事的保护处理人，并保留交接记录。')
  }
  async function resolve() {
    if (!selectedMetadata || resolution.trim().length < 4) { setValidation('请至少写 4 个字，记录实际采取的保护行动或外部报告。'); return }
    const ok = await run(() => dispatch(actor.id, { type: 'resolve-help-case', id: selectedMetadata.id, note: resolution.trim() }), '处理记录已保存；关闭站内个案不替代依法报告或后续支持。')
    if (ok) setSearchParams({ kind: 'help', status: 'resolved', item: selectedMetadata.id }, { replace: true })
  }
  async function triage() {
    if (!selectedMetadata || triageNote.trim().length < 3) { setValidation('请至少写 3 个字，记录分诊依据。'); return }
    const required = triageSeverity === 'high' ? true : triageReportRequired
    await run(() => dispatch(actor.id, { type: 'triage-help-case', id: selectedMetadata.id, severity: triageSeverity, reportRequired: required, note: triageNote.trim() }), '严重度、处理时限和报告要求已记录。')
  }
  async function recordReport() {
    if (!selectedMetadata || !reportAuthority.trim() || !reportReceipt.trim()) { setValidation('请填写报告机关和回执编号。'); return }
    await run(() => dispatch(actor.id, { type: 'update-help-report', id: selectedMetadata.id, reportDecision: 'reported', reportAuthority: reportAuthority.trim(), reportReceipt: reportReceipt.trim() }), '外部报告机关与回执已记录。')
  }
  async function recordNotRequired() {
    if (!selectedMetadata || reportReason.trim().length < 3) { setValidation('请至少写 3 个字，记录独立复核理由。'); return }
    await run(() => dispatch(actor.id, { type: 'update-help-report', id: selectedMetadata.id, reportDecision: 'not-required', reportReason: reportReason.trim() }), '独立免报告复核已保存；本结论不会撤销正文读取审计。')
  }
  async function pauseAllVolunteerPairs(selected: HelpCase) {
    if (!selected.reportedPersonId || pauseAllReason.trim().length < 4) { setValidation('请至少写 4 个字，说明为何需要保护性暂停全部结对。'); return }
    const ok = await run(() => dispatch(actor.id, { type: 'pause-volunteer', volunteerId: selected.reportedPersonId!, reason: pauseAllReason.trim() }), '平台已保护性暂停该志愿者的全部活跃结对和后续投递；这不表示个案已经查实。')
    if (ok) { setPauseAllConfirm(false); setPauseAllReason('') }
  }
  return <div className="stack">
    {selectedMetadata && <BackLink fallbackTo={queuePath} fallbackLabel={filter === 'resolved' ? '返回已处理保护个案' : '返回待接手保护个案'} />}
    {!selectedMetadata && <div className="toolbar"><button type="button" className={`btn small ${filter === 'open' ? '' : 'secondary'}`} aria-pressed={filter === 'open'} onClick={() => setSearchParams({ kind: 'help' }, { replace: true })}>待接手 / 处理中</button><button type="button" className={`btn small ${filter === 'resolved' ? '' : 'secondary'}`} aria-pressed={filter === 'resolved'} onClick={() => setSearchParams({ kind: 'help', status: 'resolved' }, { replace: true })}>已处理记录</button></div>}
    <div className="operation-focus">
      {!selectedMetadata && <section className="panel stack task-list">
        <h2>{isPrivacyReviewer ? '经授权的审计个案' : filter === 'open' ? '分派给我的保护个案' : '我处理过的保护个案'}</h2>
        <p className="muted small-text">列表只显示接手状态和必要摘要；求助全文在点开具体个案后逐次授权读取。</p>
        {!items.length && <Empty title={filter === 'open' ? '当前没有分派或授权给你的保护个案' : '还没有已处理记录'} description="无人接手不等于安全，值守与外部升级由预设负责人另行保障。" />}
        <div className="stack compact">{items.map(item => {
          const slaOverdue = item.status !== 'resolved' && !!item.slaDueAt && Date.parse(item.slaDueAt) < Date.parse(state.clock)
          return <button id={`operator-help-case-${item.id}`} key={item.id} type="button" className="operation-letter-row letter-select" onClick={() => setSearchParams({ kind: 'help', ...(filter === 'resolved' ? { status: 'resolved' } : {}), item: item.id }, { state: { returnContext: { to: queuePath, label: '返回保护个案', sourcePath: `${location.pathname}${location.search}`, sourceKey: location.key, focusId: `operator-help-case-${item.id}`, historyBack: true } } })}>
            <strong>{slaOverdue ? '已超过处理时限 · ' : ''}受限保护个案</strong>
            <span>涉及：{item.reportedParty === 'volunteer' ? '志愿者' : item.reportedParty === 'teacher' ? '老师' : item.reportedParty === 'operator' ? '运营人员' : '其他／未说明'}</span>
            <span className="letter-row-meta">{item.slaDueAt ? `处理时限 ${formatDate(item.slaDueAt)} · ` : ''}{item.status === 'open' ? '尚待接手' : item.status === 'claimed' ? '处理中' : '已处理'}</span>
          </button>
        })}</div>
      </section>}
      {selectedMetadata && !selected && <section className="panel stack" aria-live="polite"><h2>正在取得受限个案内容</h2><p className="muted">普通任务快照不含求助全文；本次读取会校验回避关系并记录审计。</p>{contentError && <Notice tone="error">{contentError}</Notice>}</section>}
      {selected && <section className="panel stack">
        <div className="section-title"><h2>保护个案</h2><Badge tone="warning">{selected.status === 'open' ? '尚待接手' : selected.status === 'claimed' ? '处理中' : '已处理'}</Badge></div>
        <p className="muted small-text">涉及对象：{selected.reportedParty === 'volunteer' ? '志愿者' : selected.reportedParty === 'teacher' ? '老师' : selected.reportedParty === 'operator' ? '运营人员' : '其他／不方便说'}{selected.reportedPersonId ? ` · ${nameOf(state, selected.reportedPersonId)}` : ' · 未要求孩子知道姓名'}</p>
        <div className="followup-note preserve-lines">{selected.body}</div>
        <Notice>{hasRestrictedGrant ? '本次正文读取来自双签审计或数据授权，只能用于批准的目的；读取与决定都会留痕。' : '先安排孩子安全与支持，避免反复询问。被反映者和回避名单中的人员不能读取、转派或关闭；疑似侵害或危险不得等待平台内部查实后才报告。'}</Notice>
        {canHandleCase && selected.status === 'open' && <button className="btn secondary" type="button" disabled={busy} onClick={() => void claim()}>记录我已接手</button>}
        {canHandleCase && selected.status !== 'resolved' && selected.reportedParty === 'volunteer' && selected.reportedPersonId && (pauseAllConfirm ? <section className="pre-submit-check stack" aria-label="暂停全部结对确认"><h3>保护性暂停该志愿者全部结对</h3><p>这会立即阻断平台侧全部活跃结对和后续投递，不等待个案查实。操作结果必须写成“保护性暂停”，不能当作事实认定。</p><div className="field"><label htmlFor="pause-all-reason">暂停依据</label><input id="pause-all-reason" value={pauseAllReason} onChange={event => { setPauseAllReason(event.target.value); setValidation('') }} placeholder="例如：出现可信的跨结对站外联系诱导" /></div><div className="toolbar"><button className="btn" type="button" disabled={busy || pauseAllReason.trim().length < 4} onClick={() => void pauseAllVolunteerPairs(selected)}>确认暂停全部结对</button><button className="btn secondary" type="button" disabled={busy} onClick={() => { setPauseAllConfirm(false); setPauseAllReason('') }}>取消</button></div></section> : <button className="btn secondary" type="button" disabled={busy} onClick={() => setPauseAllConfirm(true)}>保护性暂停该志愿者全部结对</button>)}
        {actor.role === 'operator' && hasPermission(actor, 'safeguarding') && <div className="inline-operation"><div className="field"><label htmlFor="help-case-owner">转派给未涉事保护处理人</label><select id="help-case-owner" value={ownerId} onChange={event => setOwnerId(event.target.value)}>{owners.map(person => <option key={person.id} value={person.id}>{person.nickname}</option>)}</select></div><button className="btn secondary small" type="button" disabled={busy || !ownerId || ownerId === selected.ownerId} onClick={() => void assign()}>保存转派</button></div>}
        {selected.history.length > 0 && <details className="version-history"><summary>查看个案处理记录（{selected.history.length} 条）</summary>{selected.history.map((entry, index) => <article key={`${entry.at}-${index}`}><p className="muted small-text">{nameOf(state, entry.actorId)} · {formatDate(entry.at)}</p><p className="preserve-lines">{entry.note}</p></article>)}</details>}
        {canHandleCase && selected.status !== 'resolved' && <div className="field"><label htmlFor="help-case-resolution">实际行动、外部报告与后续支持</label><textarea id="help-case-resolution" rows={5} value={resolution} onChange={event => { setResolution(event.target.value); setValidation('') }} aria-invalid={!!validation}/>{validation && <p className="field-error" role="alert">{validation}</p>}</div>}
        {error && <Notice tone="error">{error}</Notice>}
        {canHandleCase && selected.status !== 'resolved' && <button className="btn" type="button" disabled={busy || resolution.trim().length < 4} onClick={() => void resolve()}>保存处理并关闭站内个案</button>}
        {selected.status === 'resolved' && <div className="pre-submit-check"><h3>处理结果</h3><p className="preserve-lines">{selected.resolution}</p></div>}
      </section>}
      {selected && canHandleCase && selected.status !== 'resolved' && <section className="panel stack" aria-label="个案分诊与报告记录">
        <div className="section-title"><h2>分诊与报告记录</h2><Badge tone={selected.severity === 'high' ? 'warning' : undefined}>{selected.triagedAt ? `${selected.severity === 'high' ? '高' : selected.severity === 'low' ? '低' : '中'}严重度` : '待确认分诊'}</Badge></div>
        <div className="inline-operation"><div className="field"><label htmlFor="help-case-severity">严重度</label><select id="help-case-severity" value={triageSeverity} onChange={event => { const value = event.target.value as 'low' | 'medium' | 'high'; setTriageSeverity(value); if (value === 'high') setTriageReportRequired(true) }}><option value="low">低</option><option value="medium">中</option><option value="high">高</option></select></div><label className="checkbox-row"><input type="checkbox" checked={triageReportRequired || triageSeverity === 'high'} disabled={triageSeverity === 'high'} onChange={event => setTriageReportRequired(event.target.checked)} />进入法定报告记录要求</label></div>
        <div className="field"><label htmlFor="help-case-triage-note">分诊依据</label><input id="help-case-triage-note" value={triageNote} onChange={event => setTriageNote(event.target.value)} placeholder="记录风险、时限和需要立即采取的保护动作" /></div>
        <button className="btn secondary small" type="button" disabled={busy || triageNote.trim().length < 3} onClick={() => void triage()}>保存分诊</button>
        {selected.reportRequired && !selected.reportedAt && <div className="pre-submit-check stack"><h3>记录实际外部报告</h3><p>负责人不能把报告要求直接改为“无需报告”。本演示只允许记录已经完成的报告；免报告结论须由未参与处理的隐私复核人另行确认。</p><div className="inline-operation"><div className="field"><label htmlFor="help-report-authority">报告机关</label><input id="help-report-authority" value={reportAuthority} onChange={event => setReportAuthority(event.target.value)} /></div><div className="field"><label htmlFor="help-report-receipt">回执编号</label><input id="help-report-receipt" value={reportReceipt} onChange={event => setReportReceipt(event.target.value)} /></div></div><button className="btn secondary small" type="button" disabled={busy || !reportAuthority.trim() || !reportReceipt.trim()} onClick={() => void recordReport()}>保存报告记录</button></div>}
        {selected.reportedAt && <Notice>已记录向“{selected.reportAuthority}”报告，回执：{selected.reportReceipt}。</Notice>}
      </section>}
      {selected && canPrivacyReview && selected.status !== 'resolved' && selected.reportRequired && !selected.reportedAt && <section className="panel stack" aria-label="独立免报告复核">
        <div className="section-title"><h2>独立免报告复核</h2><Badge tone="warning">双签审计授权</Badge></div>
        <p className="muted small-text">只有在已经读取本个案必要内容、本人不属于处理负责人且有明确依据时，才能记录“不构成报告”。</p>
        <div className="field"><label htmlFor="help-report-reason">复核理由（至少 3 字）</label><textarea id="help-report-reason" rows={4} value={reportReason} onChange={event => { setReportReason(event.target.value); setValidation('') }} /></div>
        {validation && <p className="field-error" role="alert">{validation}</p>}
        {error && <Notice tone="error">{error}</Notice>}
        <button className="btn secondary small" type="button" disabled={busy || reportReason.trim().length < 3} onClick={() => void recordNotRequired()}>保存独立复核结论</button>
      </section>}
    </div>
  </div>
}

function FollowupQueue({ state, actor, notify, mode = 'demo' }: Props) {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const filter = searchParams.get('status') === 'resolved' ? 'resolved' : 'open'
  const selectedId = searchParams.get('item') ?? ''
  useFocusedDetail(selectedId)
  const [resolution, setResolution] = useState('')
  const [validation, setValidation] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [nextDate, setNextDate] = useState('')
  const [extensionDate, setExtensionDate] = useState('')
  const [extensionReason, setExtensionReason] = useState('')
  const { run, busy, error } = useAction(notify)
  const canHelp = hasPermission(actor, 'safeguarding') && actor.accountStatus !== 'disabled'
  const canAdmin = hasPermission(actor, 'administration') && actor.accountStatus !== 'disabled'
  const canView = (item: AppState['followups'][number]) => item.kind === 'help'
    ? canHelp && item.reportedPersonId !== actor.id
    : canAdmin
  const visibleItems = state.followups.filter(item => item.status === filter && canView(item))
  const selected = visibleItems.find(item => item.id === selectedId)
  const kind = selected?.kind ?? (searchParams.get('kind') === 'help' && canHelp ? 'help' : canAdmin ? 'overdue' : 'help')
  const items = visibleItems.filter(item => item.kind === kind).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
  const queuePath = `/operator/followups?kind=${kind}${filter === 'resolved' ? '&status=resolved' : ''}`
  const pair = state.pairs.find(item => item.id === selected?.pairId)
  const task = state.tasks.find(item => item.id === selected?.taskId)
  useEffect(() => { setResolution(''); setValidation(''); setOwnerId(selected?.ownerId || ''); setNextDate(''); setExtensionDate(''); setExtensionReason('') }, [selected?.id])
  const nextFollowupAt = nextDate ? new Date(`${nextDate}T09:00:00+08:00`).toISOString() : undefined
  async function resolve() {
    if (!selected) return
    if (resolution.trim().length < 4) { setValidation('请至少写 4 个字，记录采取了什么行动。'); return }
    const ok = await run(() => dispatch(actor.id, { type: 'resolve-followup', id: selected.id, note: resolution.trim(), nextFollowupAt }), '处理结果已保存，可以在已处理记录中查看。')
    if (ok) setSearchParams({ kind, status: 'open', result: 'resolved', last: selected.id }, { replace: true })
  }
  async function assign() {
    if (!selected || !ownerId) return
    const ok = await run(() => dispatch(actor.id, { type: 'assign-followup', id: selected.id, ownerId, nextFollowupAt }), '负责人和下次跟进时间已保存。')
    if (ok) setSearchParams({ kind, status: filter, item: selected.id, result: 'assigned', last: selected.id }, { replace: true })
  }
  async function reopen() {
    if (!selected || resolution.trim().length < 4) { setValidation('请至少写 4 个字，说明重新跟进的原因。'); return }
    const ok = await run(() => dispatch(actor.id, { type: 'reopen-followup', id: selected.id, note: resolution.trim(), nextFollowupAt }), '事项已重新打开。')
    if (ok) setSearchParams({ kind, status: 'open', result: 'reopened', last: selected.id }, { replace: true })
  }
  async function extend() {
    if (!selected || !task || extensionReason.trim().length < 2 || !extensionDate) { setValidation('请选择新期限，并写明延期原因。'); return }
    const ok = await run(() => dispatch(actor.id, { type: 'extend-task', id: task.id, dueAt: new Date(`${extensionDate}T23:59:00+08:00`).toISOString(), reason: extensionReason.trim() }), '回应期限已顺延，原因已记录。')
    if (ok) setSearchParams({ kind, status: filter, item: selected.id, result: 'extended', last: selected.id }, { replace: true })
  }
  const owners = state.people.filter(person => person.role === 'operator' && person.accountStatus !== 'disabled' && person.id !== selected?.reportedPersonId && hasPermission(person, selected?.kind === 'help' ? 'safeguarding' : 'administration'))
  const result = searchParams.get('result')
  const resultItem = state.followups.find(item => item.id === searchParams.get('last') && canView(item))
  const resultOwner = state.people.find(person => person.id === (resultItem?.ownerId || ownerId))
  return <div className="stack">
    {selected && <BackLink fallbackTo={queuePath} fallbackLabel={filter === 'resolved' ? '返回已处理记录' : kind === 'help' ? '返回保护求助' : '返回回应进度'} />}
    {!selected && canHelp && canAdmin && <nav className="toolbar" aria-label="跟进事项类别">
      <button type="button" className={`btn small ${kind === 'help' ? '' : 'secondary'}`} aria-pressed={kind === 'help'} onClick={() => setSearchParams({ kind: 'help', ...(filter === 'resolved' ? { status: 'resolved' } : {}) }, { replace: true })}>保护求助</button>
      <button type="button" className={`btn small ${kind === 'overdue' ? '' : 'secondary'}`} aria-pressed={kind === 'overdue'} onClick={() => setSearchParams({ kind: 'overdue', ...(filter === 'resolved' ? { status: 'resolved' } : {}) }, { replace: true })}>回应进度</button>
    </nav>}
    {!selected && <div className="toolbar">
      <button type="button" className={`btn small ${filter === 'open' ? '' : 'secondary'}`} aria-pressed={filter === 'open'} onClick={() => setSearchParams({ kind }, { replace: true })}>等待跟进</button>
      <button type="button" className={`btn small ${filter === 'resolved' ? '' : 'secondary'}`} aria-pressed={filter === 'resolved'} onClick={() => setSearchParams({ kind, status: 'resolved' }, { replace: true })}>已处理记录</button>
    </div>}
    {result && resultItem && resultItem.kind === kind && <WorkflowOutcome title={result === 'resolved' ? '跟进结果已保存' : result === 'reopened' ? '事项已重新打开' : result === 'assigned' ? '负责人和下次时间已保存' : '回应期限已顺延'} status={resultItem.status === 'resolved' ? `已处理：${resultItem.resolution || '处理记录已保存。'}` : resultItem.ownerId ? `当前负责人：${resultOwner?.nickname || '已指定运营人员'}。` : '事项等待运营继续处理。'} next={result === 'resolved' ? '如果约定了下次联系，由指定运营按时继续跟进。' : '运营负责人继续处理，并记录下一步。'} to={`/operator/followups?kind=${kind}${result === 'resolved' ? '&status=resolved' : ''}`} actionLabel={result === 'resolved' ? '查看已处理记录' : '回到待跟进列表'} />}
    <div className="operation-focus">
      {!selected && <section className="panel stack task-list">
        <h2>{kind === 'help' ? filter === 'open' ? '待处理的保护求助' : '已处理的保护求助' : filter === 'open' ? '待跟进的回应进度' : '已处理的回应进度'}</h2>
        <p className="muted small-text">{kind === 'help' ? '仅供适格的保护处理者查看，求助正文不会进入普通逾期队列。' : '这里仅显示书信回应逾期事项。'}</p>
        {!items.length && <Empty title={filter === 'open' ? kind === 'help' ? '目前没有待处理求助' : '目前没有待跟进的回应' : '还没有处理记录'} description={kind === 'help' ? '新的保护求助会在此单独显示。' : '达到回应期限的任务会在此形成进度事项。'} />}
        <div className="stack compact">{items.map(item => <button id={`operator-followup-${item.id}`} key={item.id} type="button" className="operation-letter-row letter-select" onClick={() => setSearchParams({ kind, ...(filter === 'resolved' ? { status: 'resolved' } : {}), item: item.id }, { state: { returnContext: { to: queuePath, label: filter === 'resolved' ? '返回已处理记录' : kind === 'help' ? '返回保护求助' : '返回回应进度', sourcePath: `${location.pathname}${location.search}`, sourceKey: location.key, focusId: `operator-followup-${item.id}`, historyBack: true } } })}>
          <strong>{kind === 'help' ? '一份需要认真倾听的求助' : '书信回应进度'}</strong>
          <span>{item.requesterId ? nameOf(state, item.requesterId) : nameOf(state, state.pairs.find(pair => pair.id === item.pairId)?.childId)}</span>
          <span className="letter-row-meta">{formatDate(item.createdAt)} · {item.status === 'resolved' ? '已处理' : '待跟进'}</span>
        </button>)}</div>
      </section>}
      {selected && <section className="panel stack">
        <div className="section-title"><h2>{selected.kind === 'help' ? '先听听发生了什么' : '了解书信的进展'}</h2><Badge tone={selected.kind === 'help' ? 'warning' : undefined}>{selected.kind === 'help' ? '仅有求助权限的运营可见' : '回应待跟进'}</Badge></div>
        {pair && <p className="muted">{nameOf(state, pair.childId)} ↔ {nameOf(state, pair.volunteerId)} · {nameOf(state, pair.teacherId)} 协助</p>}
        {selected.kind === 'help' && <p className="muted small-text">涉及对象：{selected.reportedParty === 'volunteer' ? '书信伙伴' : selected.reportedParty === 'teacher' ? '协助老师' : selected.reportedParty === 'operator' ? '运营人员' : selected.reportedParty === 'other' ? '其他／不方便说' : '未说明'}{selected.reportedPersonId ? ` · ${nameOf(state, selected.reportedPersonId)}` : ''}</p>}
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
  const canHelp = hasPermission(actor, 'safeguarding') && actor.accountStatus !== 'disabled'
  const canAdmin = hasPermission(actor, 'administration') && actor.accountStatus !== 'disabled'
  const canReview = hasPermission(actor, 'review')
  const canMatch = hasPermission(actor, 'matching') && actor.accountStatus !== 'disabled'
  const canPrivacy = hasPermission(actor, 'privacy') && actor.accountStatus !== 'disabled'
  if (!canHelp && !canAdmin && !canReview && !canMatch && !canPrivacy) return <Empty title="当前身份还没有运营任务权限" description="请联系管理员分配对应职责。" />
  const help = canHelp ? (state.helpCases ?? []).filter(item => item.status !== 'resolved' && !item.excludedActorIds.includes(actor.id) && (item.ownerId === actor.id || item.backupOwnerId === actor.id)) : []
  const overdueHelp = help.filter(item => item.slaDueAt && Date.parse(item.slaDueAt) < Date.parse(state.clock))
  const auditCaseIds = new Set((state.accessGrants ?? []).filter(grant => grant.actorId === actor.id && grant.targetType === 'help-case' && ['audit-review', 'data-request'].includes(grant.purpose) && grantIsActive(grant, state.clock)).map(grant => grant.targetId))
  const auditCases = canPrivacy ? (state.helpCases ?? []).filter(item => auditCaseIds.has(item.id)) : []
  const overdue = canAdmin ? state.followups.filter(item => item.kind === 'overdue' && item.status === 'open') : []
  const reviews = canReview ? state.letters.filter(letter => letter.moderation === 'pending' && (mode === 'demo' || letter.reviewAssigneeId === actor.id)).sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt)) : []
  const eligibleVolunteers = state.people.filter(person => person.role === 'volunteer' && (mode === 'demo' || person.accountStatus === 'active' && person.volunteerApproved))
  const unmatched = canAdmin || canMatch ? state.people.filter(person => person.role === 'child' && (mode === 'demo' || person.accountStatus === 'active' && person.guardianConsent && person.teacherId) && eligibleVolunteers.some(volunteer => !state.pairs.some(pair => pair.status !== 'ended' && pair.childId === person.id && pair.volunteerId === volunteer.id))) : []
  const priorities = [
    ...(canHelp ? [{ key: 'help', label: overdueHelp.length ? `保护个案（${overdueHelp.length} 个已超时）` : '需要回应的求助', count: help.length, to: (overdueHelp[0] ?? help[0]) ? `/operator/followups?kind=help&item=${encodeURIComponent((overdueHelp[0] ?? help[0]).id)}` : '/operator/followups?kind=help', queue: '/operator/followups?kind=help', description: overdueHelp.length ? '先处理已经超过分诊或处置时限的个案。' : '受限记录，请先倾听并安排合适的负责人。' }] : []),
    ...(canPrivacy && auditCases.length ? [{ key: 'case-audit', label: '经双签授权的个案复核', count: auditCases.length, to: `/operator/followups?kind=help&item=${encodeURIComponent(auditCases[0].id)}`, queue: '/operator/followups?kind=help', description: '仅在授权期限和目的内读取必要内容并记录复核结论。' }] : []),
    ...(canAdmin ? [{ key: 'overdue', label: '需要了解的逾期', count: overdue.length, to: overdue[0] ? `/operator/followups?kind=overdue&item=${encodeURIComponent(overdue[0].id)}` : '/operator/followups?kind=overdue', queue: '/operator/followups?kind=overdue', description: '了解是否遇到困难，再决定延期或暂停。' }] : []),
    ...(canReview ? [{ key: 'review', label: '等待逐封审核', count: reviews.length, to: reviews[0] ? `/operator/review?letter=${encodeURIComponent(reviews[0].id)}` : '/operator/review', queue: '/operator/review', description: '阅读信件并决定通过或给出具体修改建议。' }] : []),
    ...(canAdmin || canMatch ? [{ key: 'pair', label: '等待安排结对', count: unmatched.length, to: '/operator/pairs', queue: '/operator/pairs', description: '核对伙伴与协助老师，建立一段陪伴。' }] : []),
    ...(canPrivacy ? [{ key: 'privacy', label: '隐私复核与闭环自检', count: (state.accessGrants ?? []).filter(grant => grant.emergency && !grant.reviewedAt).length + checkInvariants(state).filter(item => item.severity === 'high').length, to: '/operator/system-check', queue: '/operator/system-check', description: '复核紧急破窗、超时个案和闭环不变量。' }] : []),
  ]
  const first = priorities.find(item => item.count > 0)
  return <div className="stack operations-page">
    <PageHeader eyebrow="运营待处理" title="照顾好每一次往来。" description="先看需要及时回应的事，再处理审核、结对与日常跟进。" />
    {first ? <section className="operations-next panel stack"><p className="eyebrow">现在最需要处理</p><h2>{first.label}</h2><p className="muted">{first.description}</p><ContextLink className="btn" to={first.to} returnTo={first.queue} returnLabel={first.key === 'review' ? '返回待审核列表' : first.key === 'pair' ? '返回结对列表' : first.key === 'help' ? '返回保护求助' : '返回回应进度'} historyBack={false}>查看并处理<ArrowRight size={17} aria-hidden="true" /></ContextLink></section>
      : <section className="panel stack"><h2>眼下没有待处理事项</h2><p className="muted">新的求助、逾期、信件或待结对伙伴出现时，会在下面的列表中更新。</p></section>}
    <section className="stack" aria-label="运营任务分类"><h2>按优先顺序查看</h2><div className="operator-priority-list">{priorities.map(item => <Link className="operator-priority-item" key={item.key} to={item.queue}><span className="operator-priority-count">{item.count}</span><span><strong>{item.label}</strong><small>{item.description}</small></span><ArrowRight size={18} aria-hidden="true" /></Link>)}</div></section>
    {canHelp && canAdmin && <p className="muted small-text">求助记录只在具有求助处理权限的运营视图中显示，不会自动分享给被反映的人。</p>}
  </div>
}

export function OperatorReviewPage(props: Props) {
  const [searchParams] = useSearchParams()
  if (props.actor.role !== 'operator' || !hasPermission(props.actor, 'review')) return <Empty title="这项任务需要内容审核权限" />
  return <div className="stack operations-page">{!searchParams.has('letter') && <BackLink fallbackTo="/space" fallbackLabel="返回运营待处理" />}<PageHeader eyebrow="内容审核" title="逐封读，认真回应。" description="先阅读完整来信，再决定送往下一站或写下具体修改建议。" /><ReviewQueue {...props} /></div>
}

export function OperatorPairsPage(props: Props) {
  if (props.actor.role !== 'operator' || !(hasPermission(props.actor, 'administration') || hasPermission(props.actor, 'matching'))) return <Empty title="这项任务需要结对管理权限" />
  return <div className="stack operations-page"><BackLink fallbackTo="/space" fallbackLabel="返回运营待处理" /><PageHeader eyebrow="结对管理" title="把合适的伙伴联系起来。" description="核对人员与收发方式。暂停、恢复或结束都保留处理记录。" /><Matching {...props} /></div>
}

export function OperatorFollowupPage(props: Props) {
  const [searchParams] = useSearchParams()
  const hasGrantedCase = hasPermission(props.actor, 'privacy') && (props.state.accessGrants ?? []).some(grant => grant.actorId === props.actor.id && grant.targetType === 'help-case' && ['audit-review', 'data-request'].includes(grant.purpose) && grantIsActive(grant, props.state.clock))
  if (props.actor.role !== 'operator' || props.actor.accountStatus === 'disabled' || !(hasPermission(props.actor, 'administration') || hasPermission(props.actor, 'safeguarding') || hasGrantedCase)) return <Empty title="这项任务需要跟进或审计授权" />
  const help = searchParams.get('kind') === 'help'
  return <div className="stack operations-page">{!searchParams.has('item') && <BackLink fallbackTo="/space" fallbackLabel="返回运营待处理" />}<PageHeader eyebrow={help ? '受限保护个案' : '持续跟进'} title={help ? '先保护，再记录与交接。' : '先了解情况，再记录下一步。'} description={help ? '个案独立于结对；被反映者和利益冲突者不能读取或处理。' : '这里仅处理书信回应进度，不混入求助全文。'} />{help ? <HelpCaseQueue {...props} /> : <FollowupQueue {...props} />}</div>
}

const riskKindLabels: Record<string, string> = {
  'contact-request': '索要联系方式',
  secrecy: '要求保密',
  gift: '礼物或交换',
  meetup: '私下见面',
  'duplicate-script': '跨结对重复话术',
  'external-link': '站外链接',
}
const severityLabels = { low: '低', medium: '中', high: '高' } as const

function RiskSignalPanel({ state, actor, notify }: Props) {
  const [notes, setNotes] = useState<Record<string, string>>({})
  const { run, busy, error } = useAction(notify)
  const signals = (state.riskSignals ?? []).filter(item => item.status === 'open' || item.status === 'reviewing')
  const act = (id: string, action: 'dismiss' | 'pause-volunteer' | 'open-case', message: string) =>
    run(() => dispatch(actor.id, { type: 'review-risk-signal', id, action, note: notes[id] ?? '' }), message)
  return <section className="panel stack" aria-label="风险信号">
    <div className="section-title"><h2>风险信号</h2><Badge tone={signals.length ? 'warning' : undefined}>{signals.length ? `${signals.length} 条待复核` : '暂无待复核'}</Badge></div>
    <p className="muted small-text">自动检测只作提示，不代表事实结论。处置必须由未涉事的保护岗人工复核并记录理由。</p>
    {signals.map(signal => <article className="panel stack" key={signal.id}>
      <div><strong>{riskKindLabels[signal.kind] ?? signal.kind} · 严重度{severityLabels[signal.severity]}</strong><p className="muted small-text">{nameOf(state, signal.volunteerId)} · 涉及 {signal.pairIds.length} 组结对、{signal.letterIds.length} 封信 · {formatDate(signal.createdAt)}</p></div>
      <div className="field"><label htmlFor={`risk-note-${signal.id}`}>复核说明（至少 5 字）</label><textarea id={`risk-note-${signal.id}`} rows={3} value={notes[signal.id] ?? ''} onChange={event => setNotes(old => ({ ...old, [signal.id]: event.target.value }))} /></div>
      <div className="toolbar">
        <button className="btn secondary small" type="button" disabled={busy || (notes[signal.id] ?? '').trim().length < 5} onClick={() => void act(signal.id, 'dismiss', '已记录排除理由；这只是本次信号的人工结论。')}>排除并记录理由</button>
        <button className="btn secondary small" type="button" disabled={busy || (notes[signal.id] ?? '').trim().length < 5} onClick={() => void act(signal.id, 'open-case', '已建立保护个案，等待独立保护人员接手。')}>建立保护个案</button>
        <button className="btn small" type="button" disabled={busy || (notes[signal.id] ?? '').trim().length < 5} onClick={() => void act(signal.id, 'pause-volunteer', '已保护性暂停该志愿者的活跃结对，并为受影响孩子建立支持任务。')}>保护性暂停并建支持任务</button>
      </div>
    </article>)}
    {error && <p className="field-error" role="alert">{error}</p>}
  </section>
}

function DutyPanel({ state }: { state: AppState }) {
  const shifts = (state.dutyShifts ?? []).filter(shift => shift.startsAt <= state.clock && shift.endsAt > state.clock)
  return <section className="panel stack" aria-label="当前值班">
    <div className="section-title"><h2>当前值班</h2><Badge>{shifts.length ? `${shifts.length} 段在岗` : '未配置值班'}</Badge></div>
    <p className="muted small-text">合成演示值班表只用于验证升级路径；真实试点前需由学校和平台确认值守时段与替补。未配置值班时不承诺回应时限。</p>
    {shifts.length ? <div className="stack compact">{shifts.map(shift => <div className="operation-letter-row" key={shift.id}><span><strong>{shift.scope === 'platform' ? '平台值班' : `学校值班 · ${nameOf(state, shift.userId)}`}</strong><small className="muted">{shift.scope === 'school' ? '' : nameOf(state, shift.userId)} · 替补 {nameOf(state, shift.backupUserId)}</small></span><span className="letter-row-meta">{formatDate(shift.startsAt)} 至 {formatDate(shift.endsAt)}</span></div>)}</div> : <Empty title="当前没有已配置的值班" description="求助仍可保存，但升级与回应依赖现实中的人工值守。" />}
  </section>
}

export function OperatorSafeguardingPage(props: Props) {
  const { state, actor } = props
  if (actor.role !== 'operator' || actor.accountStatus === 'disabled' || !hasPermission(actor, 'safeguarding')) return <Empty title="这项任务需要保护权限" description="普通审核队列不能读取求助全文与风险信号。"><Link className="btn secondary" to="/space">返回待处理</Link></Empty>
  return <div className="stack operations-page">
    <BackLink fallbackTo="/space" fallbackLabel="返回运营待处理" />
    <PageHeader eyebrow="保护与风险" title="先保护，再记录与交接。" description="个案全文逐次授权读取；风险信号只是提示，处置必须由未涉事保护岗人工复核。" />
    <nav className="toolbar" aria-label="保护相关页面"><Link className="btn secondary small" to="/operator/disputes">争议裁决与双签名</Link><Link className="btn secondary small" to="/operator/system-check">闭环自检</Link></nav>
    <DutyPanel state={state} />
    <RiskSignalPanel {...props} />
    <HelpCaseQueue {...props} />
  </div>
}

export function TeacherSafeguardingPage(props: Props) {
  const { actor } = props
  if (actor.role !== 'teacher') return <Empty title="这项任务需要学校保护负责人身份" />
  return <div className="stack operations-page">
    <PageHeader eyebrow="校内保护个案" title="先分诊，再记录处置与支持。" description="仅显示正式分派给当前学校保护负责人的个案；未分诊个案不能结案。" />
    <HelpCaseQueue {...props} />
  </div>
}

export function OperatorDisputePage(props: Props) {
  const { state, actor, notify } = props
  const [pairId, setPairId] = useState('')
  const [topic, setTopic] = useState<'pairing' | 'release' | 'delivery' | 'pause' | 'data'>('pause')
  const [openReason, setOpenReason] = useState('')
  const [signReason, setSignReason] = useState<Record<string, string>>({})
  const [decision, setDecision] = useState<Record<string, 'uphold-school' | 'uphold-platform' | 'compromise'>>({})
  const { run, busy, error } = useAction(notify)
  if (actor.role !== 'operator' || !(hasPermission(actor, 'safeguarding') || hasPermission(actor, 'matching'))) return <Empty title="这项任务需要结对或保护权限" description="争议用于跨学校与平台的共同裁决。"><Link className="btn secondary" to="/space">返回待处理</Link></Empty>
  const pairs = state.pairs.filter(pair => pair.status !== 'ended')
  const disputes = [...(state.disputeCases ?? [])].sort((a, b) => Date.parse(b.openedAt) - Date.parse(a.openedAt))
  async function openDispute() {
    const pair = pairs.find(item => item.id === pairId)
    if (!pair?.schoolId || openReason.trim().length < 3) return
    const ok = await run(() => dispatch(actor.id, { type: 'open-dispute', schoolId: pair.schoolId!, topic, pairId: pair.id, reason: openReason.trim() }), '争议已保存。涉及暂停、交付或结对的争议会立即暂停该组陪伴，等待双方签名。')
    if (ok) { setOpenReason(''); setPairId('') }
  }
  async function sign(id: string) {
    const reason = (signReason[id] ?? '').trim()
    const choice = decision[id]
    if (!choice || reason.length < 3) return
    await run(() => dispatch(actor.id, { type: 'decide-dispute', id, decision: choice, reason }), '已记录平台侧签名。双方签名由不同负责人完成且方向一致后，才允许恢复结对。')
  }
  return <div className="stack operations-page">
    <BackLink fallbackTo="/space" fallbackLabel="返回运营待处理" />
    <PageHeader eyebrow="争议裁决" title="分歧要写下来，也要有双方签名。" description="学校负责人与平台负责人分别签名；任一侧未签名时，安全暂停不能解除。" />
    <section className="panel stack" aria-label="开启争议">
      <h2>开启争议</h2>
      <p className="muted small-text">结对、交付、暂停与数据议题都可以记录。涉及安全的分歧会先暂停该组陪伴。</p>
      <div className="field"><label htmlFor="dispute-pair">涉及哪组结对</label><select id="dispute-pair" value={pairId} onChange={event => setPairId(event.target.value)}><option value="">请选择</option>{pairs.map(pair => <option key={pair.id} value={pair.id}>{nameOf(state, pair.childId)} ↔ {nameOf(state, pair.volunteerId)}</option>)}</select></div>
      <div className="field"><label htmlFor="dispute-topic">议题</label><select id="dispute-topic" value={topic} onChange={event => setTopic(event.target.value as typeof topic)}><option value="pause">暂停与处理方式</option><option value="delivery">纸质交付</option><option value="pairing">结对安排</option><option value="release">信息发布</option><option value="data">数据访问</option></select></div>
      <div className="field"><label htmlFor="dispute-reason">分歧说明（至少 3 字）</label><textarea id="dispute-reason" rows={3} value={openReason} onChange={event => setOpenReason(event.target.value)} /></div>
      <button className="btn secondary" type="button" disabled={busy || !pairId || openReason.trim().length < 3} onClick={() => void openDispute()}>保存争议</button>
    </section>
    <section className="panel stack" aria-label="争议列表">
      <h2>进行中与已裁决的争议</h2>
      {disputes.length ? <div className="stack compact">{disputes.map(item => <article className="panel stack" key={item.id}>
        <div><strong>{item.topic === 'pause' ? '暂停与处理方式' : item.topic === 'delivery' ? '纸质交付' : item.topic === 'pairing' ? '结对安排' : item.topic === 'release' ? '信息发布' : '数据访问'} · {item.status === 'decided' ? '已裁决' : item.status === 'joint-review' ? '共同审查中' : '待处理'}</strong><p className="muted small-text">{formatDate(item.openedAt)} · 学校签名：{item.schoolDecisionBy ? nameOf(state, item.schoolDecisionBy) : '未签名'} · 平台签名：{item.platformDecisionBy ? nameOf(state, item.platformDecisionBy) : '未签名'}</p></div>
        <p className="preserve-lines">{item.reason}</p>
        {item.status !== 'decided' && !item.platformDecisionBy && <div className="stack"><div className="field"><label htmlFor={`dispute-decision-${item.id}`}>平台侧裁决方向</label><select id={`dispute-decision-${item.id}`} value={decision[item.id] ?? ''} onChange={event => setDecision(old => ({ ...old, [item.id]: event.target.value as 'uphold-school' }))}><option value="" disabled>请选择</option><option value="uphold-school">支持学校方案</option><option value="uphold-platform">支持平台方案</option><option value="compromise">折中方案</option></select></div><div className="field"><label htmlFor={`dispute-sign-${item.id}`}>平台签名理由</label><input id={`dispute-sign-${item.id}`} value={signReason[item.id] ?? ''} onChange={event => setSignReason(old => ({ ...old, [item.id]: event.target.value }))} /></div><button className="btn secondary small" type="button" disabled={busy || !decision[item.id] || (signReason[item.id] ?? '').trim().length < 3} onClick={() => void sign(item.id)}>记录平台签名</button></div>}
        {item.status === 'decided' && <Notice>双方签名已完成。恢复结对需在结对页按暂停原因处理，且不会自动补投暂停期间的信件。</Notice>}
      </article>)}</div> : <Empty title="当前没有争议记录" description="出现跨学校与平台的分歧时，可在这里留下双方都能复核的裁决。" />}
      {error && <p className="field-error" role="alert">{error}</p>}
    </section>
  </div>
}

export function OperatorSystemCheckPage({ state, actor }: Props) {
  if (actor.role !== 'operator' || !hasPermission(actor, 'privacy')) return <Empty title="这项任务需要隐私与审计权限" description="系统自检只对隐私与审计授权包开放。"><Link className="btn secondary" to="/space">返回待处理</Link></Empty>
  const violations = checkInvariants(state)
  const pending = (state.accessGrants ?? []).filter(grant => grant.emergency && !grant.reviewedAt)
  return <div className="stack operations-page">
    <BackLink fallbackTo="/space" fallbackLabel="返回运营待处理" />
    <PageHeader eyebrow="系统自检" title="把规则写成可以检查的条目。" description="这里只读展示闭环不变量与待复核的紧急访问，不替代人工判断。" />
    <section className="panel stack" aria-label="闭环不变量">
      <div className="section-title"><h2>闭环不变量</h2><Badge tone={violations.length ? 'warning' : undefined}>{violations.length ? `${violations.length} 条待复核` : '当前为 0 违规'}</Badge></div>
      {violations.length ? <ul className="stack compact">{violations.map((violation, index) => <li key={`${violation.rule}-${index}`} className="operation-letter-row"><span><strong>{violation.rule} · {violation.severity === 'high' ? '高' : '中'}</strong><small className="muted">{violation.message}</small></span><span className="letter-row-meta">{violation.refs.join('、')}</span></li>)}</ul> : <p className="muted small-text">种子数据的结对、信本身份、纸信事件顺序、报告字段、回避关系、授权生命周期、破窗复核、暂停期间投递、结对唯一性、暂停说明和风险信号处置均未发现违规。</p>}
    </section>
    <BreakGlassReview grants={pending} state={state} actor={actor} />
  </div>
}

function BreakGlassReview({ grants, state, actor }: { grants: NonNullable<AppState['accessGrants']>; state: AppState; actor: Person }) {
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [decision, setDecision] = useState<Record<string, 'upheld' | 'revoked'>>({})
  const { run, busy, error } = useAction(() => {})
  return <section className="panel stack" aria-label="待复核的紧急访问">
    <div className="section-title"><h2>待复核的紧急访问</h2><Badge tone={grants.length ? 'warning' : undefined}>{grants.length ? `${grants.length} 条` : '暂无'}</Badge></div>
    <p className="muted small-text">紧急破窗只作用于单个对象，最长 2 小时，并须在 24 小时内由未开启该访问的隐私岗复核。</p>
    {grants.length ? <div className="stack compact">{grants.map(grant => <article className="panel stack" key={grant.id}>
      <div><strong>{grant.targetType === 'letter' ? '信件' : grant.targetType === 'attachment' ? '图片' : grant.targetType === 'help-case' ? '保护个案' : '概况'} · {grant.targetId}</strong><p className="muted small-text">申请人 {nameOf(state, grant.actorId)} · {formatDate(grant.startsAt)} 至 {formatDate(grant.expiresAt)} · 复核期限 {grant.reviewDueAt ? formatDate(grant.reviewDueAt) : '未记录'}</p></div>
      <p className="preserve-lines">{grant.reason}</p>
      {grant.actorId === actor.id ? <Notice>不能复核自己开启的紧急访问，请交给另一位隐私岗。</Notice> : <div className="stack"><div className="field"><label htmlFor={`grant-decision-${grant.id}`}>复核结论</label><select id={`grant-decision-${grant.id}`} value={decision[grant.id] ?? ''} onChange={event => setDecision(old => ({ ...old, [grant.id]: event.target.value as 'upheld' }))}><option value="" disabled>请选择</option><option value="upheld">维持：访问确有必要</option><option value="revoked">撤销：访问不当</option></select></div><div className="field"><label htmlFor={`grant-note-${grant.id}`}>复核说明（至少 3 字）</label><input id={`grant-note-${grant.id}`} value={notes[grant.id] ?? ''} onChange={event => setNotes(old => ({ ...old, [grant.id]: event.target.value }))} /></div><button className="btn secondary small" type="button" disabled={busy || !decision[grant.id] || (notes[grant.id] ?? '').trim().length < 3} onClick={() => void run(() => dispatch(actor.id, { type: 'review-emergency-access', id: grant.id, decision: decision[grant.id], note: notes[grant.id] }), '紧急访问复核已记录。')}>保存复核结论</button></div>}
    </article>)}</div> : <Empty title="没有待复核的紧急访问" description="开启记录与复核结论都会进入审计。" />}
    {error && <p className="field-error" role="alert">{error}</p>}
  </section>
}
