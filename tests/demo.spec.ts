import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const originalTitle = '把秋天装进信封里'
const paperTitle = '今晚的月亮像一艘小船'

async function settings(page: Page) {
  if (!(await page.getByLabel('演示角色', { exact: true }).isVisible())) await page.locator('summary').filter({ hasText: '演示设置' }).click()
  await expect(page.getByLabel('演示角色', { exact: true })).toBeVisible()
}

async function openHistoryLetter(page: Page, title: string) {
  await page.getByRole('link', { name: '看看我们的信', exact: false }).click()
  await page.locator('.letter-row').filter({ has: page.getByText(title, { exact: true }) }).click()
}

async function openDirectRoute(page: Page, route: string) {
  const direct = await page.context().newPage()
  await direct.addInitScript(() => sessionStorage.setItem('riddle-v1-mode', 'demo'))
  await direct.goto(new URL(`/#${route}`, page.url()).origin + `/#${route}`)
  return direct
}

async function as(page: Page, role: 'child' | 'volunteer' | 'teacher' | 'operator', id: string) {
  await settings(page)
  await page.getByLabel('演示角色', { exact: true }).selectOption(role)
  await settings(page)
  await page.getByLabel('演示人物', { exact: true }).selectOption(id)
  await page.locator('summary').filter({ hasText: '演示设置' }).click()
  await expect(page).toHaveURL(/#\/space$/)
  await expect(page.locator('summary').filter({ hasText: '演示设置' })).toBeVisible()
  await expect(page.locator('main .page-header h1')).toBeVisible()
}

async function fillLetter(page: Page, title: string, body: string) {
  await page.locator('details.letter-options').evaluate((element: HTMLDetailsElement) => { element.open = true })
  await page.getByLabel('信的名字（不填也可以）', { exact: true }).fill(title)
  await page.getByLabel('想说的话', { exact: false }).fill(body)
}

async function submitLetter(page: Page) {
  await page.getByRole('button', { name: '检查并寄出', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '提交审核', exact: true }).click()
  await expect(page).toHaveURL(/#\/letters\//)
  await expect(page.getByRole('heading', { name: '已提交审核' })).toBeVisible()
  await expect(page.getByText('现在还不能写这封信')).toHaveCount(0)
}

async function openWrite(page: Page, pairId = 'p1') {
  await page.locator('main').getByRole('link', { name: '写一封信', exact: true }).click()
  const partner = page.locator(`main a[href="#/write?pair=${pairId}"]`)
  if (await partner.count()) await partner.click()
  await expect(page).toHaveURL(new RegExp(`#/write\\?pair=${pairId}$`))
}

async function approve(page: Page, title: string) {
  await as(page, 'operator', 'op1')
  await page.getByRole('link', { name: '审核', exact: true }).click()
  const row = page.getByRole('button').filter({ has: page.getByText(title, { exact: true }) })
  await row.click()
  await page.getByRole('button', { name: '通过审核', exact: true }).click()
  const transcriptCheck = page.getByLabel('已逐行核对忠实转写，没有补写、润色或改变孩子语气', { exact: true })
  if (await transcriptCheck.count()) {
    await transcriptCheck.check()
    await page.getByLabel('已检查图像四周、二维码和元数据；合成样本无需遮盖或已完成必要处理', { exact: true }).check()
  }
  await page.getByRole('button', { name: '确认通过审核', exact: true }).click()
  await expect(page.getByRole('button').filter({ has: page.getByText(title, { exact: true }) })).toHaveCount(0)
}

async function advanceWeek(page: Page) {
  await settings(page)
  await page.getByRole('button', { name: '前进 7 天', exact: true }).click()
  await page.locator('summary').filter({ hasText: '演示设置' }).click()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/#/demo/start/child')
  await expect(page.locator('summary').filter({ hasText: '演示设置' })).toBeVisible()
  await expect(page.locator('main .page-header h1')).toBeVisible()
})

test('线上完整闭环：保存、审核、阅读、回信审核与持久化', async ({ page }) => {
  const title = '今天的云像一只小船', replyTitle = '我的天空是淡蓝色'
  await as(page, 'volunteer', 'v1')
  await openWrite(page, 'p1')
  await fillLetter(page, title, '小禾，你好！今天回来的路上，我发现云朵像一只小船，想把这件小事分享给你。你今天看到了什么颜色的天空呢？')
  await page.getByLabel('附上一道小谜语', { exact: false }).selectOption('r2')
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '已保存到此浏览器' }).first()).toBeVisible()
  await submitLetter(page)
  const originalPath = new URL(page.url()).hash.slice(1)
  expect(originalPath).not.toBe('/letters/l3')
  await page.getByRole('link', { name: '书信往来', exact: true }).click()
  await page.locator('.letter-row').filter({ has: page.getByText('一颗种子的慢慢旅行', { exact: true }) }).click()
  await page.locator('details.letter-options').evaluate((element: HTMLDetailsElement) => { element.open = true })
  await expect(page.getByLabel('信的名字（不填也可以）', { exact: true })).toHaveValue('一颗种子的慢慢旅行')
  await expect(page.getByLabel('想说的话', { exact: false })).toHaveValue(/楼下花盆里冒出了一片小叶子/)

  await as(page, 'child', 'c1')
  await expect(page.getByRole('heading', { name: title, exact: true })).toHaveCount(0)
  await approve(page, title)
  await as(page, 'child', 'c1')
  await page.getByRole('link', { name: '打开来信', exact: true }).click()
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  await expect(page.getByText('这封信已打开阅读。')).toBeVisible()
  await expect(page.getByText('已确认送达：', { exact: false })).toBeVisible()
  await expect(page.getByText('已打开阅读：', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: '给我一点提示', exact: true }).click()
  await expect(page.getByText('小提示：它有好几种颜色。', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: '给 TA 回信', exact: false }).first().click()
  await fillLetter(page, replyTitle, '林语，你好！我今天抬头看到了淡蓝色的天空，也画了一只白色的小船。谢谢你告诉我这么有趣的小发现。')
  await submitLetter(page)
  const replyPath = new URL(page.url()).hash.slice(1)
  await as(page, 'volunteer', 'v1')
  const unauthorized = await openDirectRoute(page, replyPath)
  await expect(unauthorized.getByRole('heading', { name: '这封信暂时不能打开', exact: true })).toBeVisible()
  await unauthorized.close()
  await approve(page, replyTitle)
  await as(page, 'volunteer', 'v1')
  await page.getByRole('link', { name: '书信往来', exact: true }).click()
  await page.locator('.letter-row').filter({ has: page.getByText(replyTitle, { exact: true }) }).click()
  await expect(page.getByRole('heading', { name: replyTitle, exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: replyTitle, exact: true })).toBeVisible()
  await as(page, 'child', 'c1')
  await openHistoryLetter(page, title)
  await expect(page.getByRole('heading', { name: '已经收到回应', exact: true })).toBeVisible()
})

test('纸质完整闭环：打印、确认交付、代录和图片回传、审核后阅读', async ({ page }, testInfo) => {
  await as(page, 'teacher', 't2')
  await page.getByRole('link', { name: /进入待打印/ }).click()
  await expect(page.getByText(paperTitle, { exact: true })).toHaveCount(0)
  await page.locator('.teacher-stage-body .letter-select').first().click()
  await page.evaluate(() => { window.print = () => { document.documentElement.dataset.printCalls = '1' } })
  await page.getByRole('button', { name: '打开打印预览', exact: false }).click()
  await expect(page.locator('html')).toHaveAttribute('data-print-calls', '1')
  await expect(page.locator('.teacher-print-area')).toContainText(paperTitle)
  await page.getByLabel('我已核对这些信件的打印结果', { exact: true }).check()
  await page.getByRole('button', { name: '记录已打印', exact: true }).click()
  await expect(page.getByRole('heading', { name: '已记录 1 封信打印', exact: true })).toBeVisible()
  await page.getByRole('link', { name: '去待交付' }).click()
  await page.getByLabel('我确认已把这些信件交给对应收件人', { exact: true }).check()
  await page.getByRole('button', { name: '确认实际交付', exact: true }).click()
  await page.getByRole('link', { name: '查看待回传' }).click()
  await expect(page.getByText('孩子的回应期限：11月2日', { exact: false })).toBeVisible()
  await page.getByLabel('回信标题（选填）', { exact: true }).fill('给许舟的月亮小发现')
  await page.getByLabel('代录正文（与图片至少填写一项）', { exact: true }).fill('许舟，你好！我把弯弯的月亮画在纸船旁边。今天想和你分享这张合成小画，也想知道月亮明天会不会变得更圆。')
  const syntheticManuscript = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 900; canvas.height = 1100
    const context = canvas.getContext('2d')!
    context.fillStyle = '#fffaf0'; context.fillRect(0, 0, canvas.width, canvas.height)
    context.strokeStyle = '#d9d2bd'; context.lineWidth = 2
    for (let y = 190; y < 1000; y += 130) { context.beginPath(); context.moveTo(70, y); context.lineTo(830, y); context.stroke() }
    context.fillStyle = '#2f3d35'; context.font = '40px "KaiTi", "STKaiti", sans-serif'
    for (const [line, y] of [['许舟，你好！', 155], ['我把弯弯的月亮画在纸船旁边。', 285], ['今天想和你分享这张合成小画，', 415], ['也想知道月亮明天会不会变得更圆。', 545]] as const) context.fillText(line, 85, y)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await page.getByLabel('手写回信图片（选填）', { exact: true }).setInputFiles({
    name: 'synthetic-moon.png', mimeType: 'image/png',
    buffer: Buffer.from(syntheticManuscript, 'base64'),
  })
  await page.getByRole('button', { name: '私有保存，待后续处理', exact: true }).click()
  await expect(page.getByText('已私有保存为待处理草稿，不表示已经寄出。', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('回信标题（选填）', { exact: true })).toHaveValue('给许舟的月亮小发现')
  await expect(page.getByLabel('移除已保存的附件：synthetic-moon.png', { exact: true })).toBeVisible()
  await page.getByLabel('作者已核对：没有擅自润色、补字或改变语气', { exact: true }).check()
  await page.getByRole('button', { name: '提交合法且必要处理', exact: true }).click()
  await expect(page.getByText('回信正在等待运营审核，通过后才会安排投递。', { exact: false })).toBeVisible()
  await approve(page, '给许舟的月亮小发现')
  await as(page, 'volunteer', 'v2')
  await page.getByRole('link', { name: '书信往来', exact: true }).click()
  await page.locator('.letter-row').filter({ has: page.getByText('给许舟的月亮小发现', { exact: true }) }).click()
  await expect(page.getByRole('button', { name: '清晰转写', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText(/我把弯弯的月亮画在纸船旁边/)).toBeVisible()
  if (process.env.PW_EVIDENCE_DIR) await page.screenshot({ path: `${process.env.PW_EVIDENCE_DIR}/ocr-transcript-${testInfo.project.name}.png`, fullPage: true })
  await page.locator('.handwriting-line').first().click()
  await expect(page.getByRole('button', { name: '手写原稿', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.handwriting-image-panel')).toBeFocused()
  await expect(page.locator('.handwriting-highlight')).toBeVisible()
  await expect(page.getByRole('img', { name: '已获准展示的手写原稿遮盖副本', exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: '手写信附件：synthetic-moon.png', exact: true })).toHaveCount(0)
  if (process.env.PW_EVIDENCE_DIR) await page.screenshot({ path: `${process.env.PW_EVIDENCE_DIR}/ocr-original-${testInfo.project.name}.png`, fullPage: true })
})

test('负责老师可立即停止本校交付，但不能自行恢复', async ({ page }, testInfo) => {
  await as(page, 'teacher', 't2')
  await page.getByRole('link', { name: /进入待打印/ }).click()
  await page.locator('.teacher-stage-body .letter-select').first().click()
  await page.getByRole('button', { name: '停止本校交付并上报异常', exact: true }).click()
  await page.getByLabel('停止原因', { exact: true }).fill('需要保护性核实')
  await page.getByRole('button', { name: '确认停止并上报异常', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '本校交付已立即停止' }).first()).toBeVisible()
  await expect(page.getByText('这组陪伴已暂停。', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: '恢复陪伴', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '打开打印预览', exact: false })).toHaveCount(0)
  if (process.env.PW_EVIDENCE_DIR) await page.screenshot({ path: `${process.env.PW_EVIDENCE_DIR}/teacher-stop-delivery-${testInfo.project.name}.png`, fullPage: true })
})

test('老师历史记录只显示收发状态', async ({ page }) => {
  await as(page, 'teacher', 't2')
  await page.getByRole('link', { name: '查看以往处理记录', exact: true }).click()
  await page.getByRole('button', { name: /纸质来信/ }).first().click()
  await expect(page.getByRole('heading', { name: '这封信的收发记录' })).toBeVisible()
  await expect(page.locator('.letter-paper')).toHaveCount(0)
  await expect(page.getByText('阿川，你好呀！', { exact: false })).toHaveCount(0)
})

test('退回修改保留原文和意见，可修改后再次审核', async ({ page }) => {
  const title = '一次可以慢慢回应的故事邀请'
  await as(page, 'volunteer', 'v1')
  await page.getByRole('link', { name: /修改后重新提交/ }).click()
  await expect(page.locator('.notice').filter({ hasText: '审核建议' })).toBeVisible()
  await fillLetter(page, title, '小禾，你好！最近读到一个小狐狸的故事，想和你分享。有空的时候，也欢迎告诉我你喜欢的故事。不着急，我们可以慢慢聊。')
  await submitLetter(page)
  await as(page, 'operator', 'op1')
  await page.getByRole('link', { name: '审核', exact: true }).click()
  await page.getByRole('button').filter({ has: page.getByText(title, { exact: true }) }).click()
  await page.getByLabel('审核备注 / 修改建议（退回时必填）', { exact: true }).fill('再补充一个小狐狸故事里的细节，让邀请更具体。')
  await page.getByRole('button', { name: '退回修改', exact: true }).click()
  await as(page, 'volunteer', 'v1')
  await page.locator('.task-action').filter({ hasText: title }).click()
  await expect(page.getByText(/再补充一个小狐狸故事里的细节/)).toBeVisible()
  await expect(page.getByLabel('想说的话', { exact: false })).toHaveValue(/不着急/)
  await page.getByLabel('想说的话', { exact: false }).fill('小禾，你好！故事里的小狐狸把落叶当作书签，我也准备试试看。等你有空时，也欢迎告诉我你喜欢的小故事。我们慢慢聊。')
  await submitLetter(page)
  await approve(page, title)
  await as(page, 'child', 'c1')
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
})

test('暂停时仍可阅读和写草稿，恢复后孩子端不显示逾期评价', async ({ page }) => {
  await as(page, 'operator', 'op1')
  await page.getByRole('link', { name: '结对', exact: true }).click()
  const pair = page.locator('.pair-row').filter({ hasText: '小禾 ↔ 林语' })
  await pair.getByRole('button', { name: '暂停这一组', exact: true }).click()
  await page.getByLabel('暂停原因（必填）', { exact: true }).fill('学校秋假，暂时休息')
  await page.getByRole('button', { name: '确认暂停', exact: true }).click()
  await expect(pair.getByText('暂停中', { exact: true })).toBeVisible()
  await as(page, 'volunteer', 'v1')
  await openWrite(page, 'p1')
  await expect(page.getByText(/陪伴暂停中，可以写和保存草稿/)).toBeVisible()
  await expect(page.getByRole('button', { name: '检查并寄出', exact: true })).toBeDisabled()
  await as(page, 'child', 'c1')
  await openHistoryLetter(page, originalTitle)
  await expect(page.getByRole('heading', { name: originalTitle, exact: true })).toBeVisible()
  await expect(page.locator('#letter-reply-top')).toBeVisible()
  await as(page, 'operator', 'op1')
  await advanceWeek(page)
  await page.getByRole('link', { name: '结对', exact: true }).click()
  await page.locator('.pair-row').filter({ hasText: '小禾 ↔ 林语' }).getByRole('button', { name: '恢复陪伴', exact: true }).click()
  await as(page, 'child', 'c1')
  await openHistoryLetter(page, originalTitle)
  await expect(page.getByRole('heading', { name: '给回应留一点时间', exact: true })).toBeVisible()
  await expect(page.locator('#letter-reply-top')).toBeVisible()
})

test('演示日期驱动唯一逾期跟进，处理结果可回查', async ({ page }) => {
  const title = '请志愿者慢慢回应的合成来信'
  await as(page, 'child', 'c1')
  await openWrite(page, 'p1')
  await fillLetter(page, title, '林语，你好！这是用于验证成人回应期限的一封合成来信，有空时再写给我。')
  await submitLetter(page)
  await approve(page, title)
  for (let week = 0; week < 3; week++) await advanceWeek(page)
  await page.getByRole('link', { name: '跟进', exact: true }).click()
  const childFollowup = page.getByRole('button').filter({ hasText: '书信回应进度' }).filter({ hasText: '小禾' })
  await expect(childFollowup).toHaveCount(1)
  await childFollowup.click()
  await page.getByLabel('处理结果与下一步', { exact: true }).fill('已在演示中了解收发情况，记录下周再问候一次。')
  await page.getByRole('button', { name: '保存处理结果', exact: true }).click()
  await page.getByRole('button', { name: '已处理记录', exact: true }).click()
  await page.getByRole('button').filter({ hasText: '书信回应进度' }).filter({ hasText: '小禾' }).click()
  await expect(page.locator('.pre-submit-check').getByText('已在演示中了解收发情况，记录下周再问候一次。', { exact: true })).toBeVisible()
})

test('运营可安排新结对；孩子求助只进入运营处理流程', async ({ page }, testInfo) => {
  await as(page, 'operator', 'op1')
  await page.getByRole('link', { name: '结对', exact: true }).click()
  await page.getByLabel('待结对的小朋友', { exact: true }).selectOption('c3')
  await page.getByLabel('可结对的志愿者', { exact: true }).selectOption('v3')
  await page.getByLabel('协助老师', { exact: true }).selectOption('t1')
  await page.getByRole('button', { name: '建立独立结对', exact: true }).click()
  await expect(page.locator('.pair-row').filter({ hasText: '芽芽 ↔ 苏宁' })).toBeVisible()
  if (process.env.PW_EVIDENCE_DIR) await page.screenshot({ path: `${process.env.PW_EVIDENCE_DIR}/pair-nn-list-${testInfo.project.name}.png`, fullPage: true })
  await as(page, 'child', 'c3')
  await page.getByRole('link', { name: '找人帮忙' }).click()
  await page.getByLabel('这件事主要与谁有关？').selectOption('other')
  await expect(page.getByLabel('与哪组书信有关？（可不选）')).toHaveValue('')
  await page.getByLabel('想说的话', { exact: true }).fill('我还不知道第一封信可以聊些什么，想请你帮我想一想。')
  await page.getByRole('button', { name: '提交到演示受限队列', exact: true }).click()
  await expect(page.locator('main .notice').filter({ hasText: '可切换未涉事的保护运营演示身份' })).toBeVisible()
  await as(page, 'operator', 'op1')
  await page.getByRole('link', { name: '跟进', exact: true }).click()
  await page.getByRole('button', { name: '保护求助', exact: true }).click()
  await page.getByRole('button').filter({ hasText: '受限保护个案' }).click()
  await expect(page.getByRole('heading', { name: '保护个案', exact: true })).toBeVisible()
  await expect(page.getByText(/我还不知道第一封信可以聊些什么/)).toBeVisible()
  await page.getByLabel('分诊依据', { exact: true }).fill('一般支持请求，安排老师提供可自由选择的话题。')
  await page.getByRole('button', { name: '保存分诊', exact: true }).click()
  await page.getByLabel('实际行动、外部报告与后续支持', { exact: true }).fill('已记录想法，演示中安排老师提供三个可自由选择的话题。')
  await page.getByRole('button', { name: '保存处理并关闭站内个案', exact: true }).click()
  await page.getByRole('link', { name: '返回已处理保护个案', exact: true }).click()
  await page.getByRole('button').filter({ hasText: '受限保护个案' }).click()
  await expect(page.locator('.pre-submit-check').getByText(/已记录想法，演示中安排老师/)).toBeVisible()
})

test('求助表单先选涉及对象，匿名运营投诉绕开全部运营并交给校方保护负责人', async ({ page }, testInfo) => {
  await page.getByRole('link', { name: '找人帮忙' }).click()
  await expect(page.getByLabel('这件事主要与谁有关？')).toHaveValue('')
  await expect(page.getByLabel('想说的话', { exact: true })).toHaveCount(0)
  await page.getByLabel('这件事主要与谁有关？').selectOption('operator')
  await expect(page.locator('.notice').filter({ hasText: '绕开普通运营队列' })).toBeVisible()
  await page.getByLabel('想说的话', { exact: true }).fill('我想反映一位运营人员的处理方式，但不希望普通运营队列看到。')
  await page.getByRole('button', { name: '提交到演示受限队列', exact: true }).click()
  await expect(page.locator('.notice').filter({ hasText: '状态为“尚待接手”' })).toBeVisible()

  const helpQueue = new URL('/#/operator/followups?kind=help', page.url()).toString()
  await as(page, 'operator', 'op2')
  await page.goto(helpQueue)
  await expect(page.getByRole('heading', { name: '分派给我的保护个案', exact: true })).toBeVisible()
  await expect(page.getByRole('button').filter({ hasText: '涉及：运营人员' })).toHaveCount(0)

  await as(page, 'teacher', 't1')
  await page.goto('/#/teacher/safeguarding')
  await expect(page.getByRole('heading', { name: '分派给我的保护个案', exact: true })).toBeVisible()
  await page.getByRole('button').filter({ hasText: '涉及：运营人员' }).click()
  await expect(page.getByRole('heading', { name: '保护个案', exact: true })).toBeVisible()
  await expect(page.getByText(/我想反映一位运营人员的处理方式/)).toBeVisible()
  if (process.env.PW_EVIDENCE_DIR) await page.screenshot({ path: `${process.env.PW_EVIDENCE_DIR}/help-case-operator-complaint-${testInfo.project.name}.png`, fullPage: true })

  await as(page, 'operator', 'op1')
  await page.goto(helpQueue)
  await expect(page.getByRole('heading', { name: '分派给我的保护个案', exact: true })).toBeVisible()
  await expect(page.getByText(/我想反映一位运营人员的处理方式/)).toHaveCount(0)

  await as(page, 'child', 'c1')
  await page.getByRole('link', { name: '找人帮忙' }).click()
  await page.getByLabel('这件事主要与谁有关？').selectOption('teacher')
  await expect(page.getByLabel('与哪组书信有关？（可不选）')).toHaveValue('')
  await expect(page.getByLabel('涉及哪位人员？（可不选）')).toHaveValue('')
  await page.getByLabel('想说的话', { exact: true }).fill('短')
  await expect(page.getByRole('button', { name: '提交到演示受限队列' })).toBeDisabled()
  await page.getByLabel('想说的话', { exact: true }).fill('我需要帮助。')
  await expect(page.getByRole('button', { name: '提交到演示受限队列' })).toBeEnabled()
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(accessibility.violations).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
})

test('陪伴计划和隐私说明明确成年试测与儿童试点边界', async ({ page }) => {
  await page.goto('/#/plan')
  await expect(page.getByText('当前网站只供成年人以合成身份和内容试测', { exact: false })).toBeVisible()
  await expect(page.getByRole('heading', { name: '当前成年合成试测的一封信' })).toBeVisible()
  await expect(page.getByText('儿童出站信的拍摄、文字识别和常态审阅', { exact: false })).toBeVisible()
  await page.goto('/#/privacy')
  await expect(page.getByText('V2 Demo 在当前浏览器保存合成数据', { exact: false })).toBeVisible()
  await expect(page.getByText('V3 成年账号试测使用独立的 Cloudflare Pages Functions 与 D1 数据库', { exact: false })).toBeVisible()
  await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).resolves.toBe(true)
})

test('重置需确认，重建种子并恢复已调整的演示数据', async ({ page }) => {
  await as(page, 'operator', 'op1')
  await advanceWeek(page)
  await settings(page)
  await page.getByRole('button', { name: '重置演示数据', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: '确认重置', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await as(page, 'child', 'c1')
  await openHistoryLetter(page, originalTitle)
  await expect(page.getByRole('heading', { name: '给回应留一点时间', exact: true })).toBeVisible()
  await page.locator('summary').filter({ hasText: '演示设置' }).click()
  await expect(page.getByLabel('演示日期：10月19日', { exact: true })).toHaveValue('2026-10-19')
})

test('手输回信地址不会泄露他人未审核的正文', async ({ page }) => {
  await as(page, 'volunteer', 'v1')
  const volunteerTamper = await openDirectRoute(page, '/write?replyTo=l4')
  await expect(volunteerTamper.getByRole('heading', { name: '现在还不能写这封信', exact: true })).toBeVisible()
  await expect(volunteerTamper.getByText(/上次你说想做一艘更大的纸船/)).toHaveCount(0)
  await expect(volunteerTamper.getByLabel('想说的话', { exact: false })).toHaveCount(0)
  await volunteerTamper.close()
  await as(page, 'child', 'c1')
  const childTamper = await openDirectRoute(page, '/write?pair=p2&replyTo=l4')
  await expect(childTamper.getByRole('heading', { name: '现在还不能写这封信', exact: true })).toBeVisible()
  await expect(childTamper.getByText(/上次你说想做一艘更大的纸船/)).toHaveCount(0)
  await childTamper.close()
})

test('四角色工作台满足自动无障碍检查，手机无横向溢出', async ({ page }) => {
  for (const [role, id] of [['child', 'c1'], ['volunteer', 'v1'], ['teacher', 't2'], ['operator', 'op1']] as const) {
    await as(page, role, id)
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect.soft(results.violations, `${role}: ${JSON.stringify(results.violations, null, 2)}`).toEqual([])
    expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${role} 不应产生横向溢出`).toBe(true)
  }
})

test('写信与长信可访问，减少动态模式保持可阅读和可操作', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await as(page, 'volunteer', 'v1')
  await page.getByRole('link', { name: '书信往来', exact: true }).click()
  await page.locator('.letter-row').filter({ has: page.getByText('一颗种子的慢慢旅行', { exact: true }) }).click()
  const composition = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect.soft(composition.violations, JSON.stringify(composition.violations, null, 2)).toEqual([])
  await page.getByLabel('想说的话', { exact: false }).focus()
  await expect(page.getByLabel('想说的话', { exact: false })).toBeFocused()
  await as(page, 'child', 'c1')
  await openHistoryLetter(page, originalTitle)
  await expect(page.getByRole('heading', { name: originalTitle, exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length)).toBe(0)
  const reading = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(reading.violations, JSON.stringify(reading.violations, null, 2)).toEqual([])
})

const operatorRoute = (page: Page, route: string) => `${new URL(page.url()).origin}/#${route}`

test('风险信号经保护岗复核后保护性暂停，老师收到孩子的支持任务', async ({ page }) => {
  await as(page, 'operator', 'op2')
  await page.getByRole('link', { name: '保护', exact: true }).click()
  const panel = page.locator('section[aria-label="风险信号"]')
  await expect(panel.getByRole('heading', { name: '风险信号', exact: true })).toBeVisible()
  const signal = panel.locator('article').filter({ hasText: '跨结对重复话术' })
  await expect(signal).toHaveCount(1)
  await signal.getByLabel('复核说明（至少 5 字）').fill('两组信件出现高度相似话术，先保护性暂停并联系孩子。')
  await signal.getByRole('button', { name: '保护性暂停并建支持任务', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '已保护性暂停该志愿者的活跃结对' })).toBeVisible()
  await expect(panel.getByText('暂无待复核')).toBeVisible()

  await as(page, 'teacher', 't1')
  await expect(page.getByRole('heading', { name: '保护与异常', exact: true })).toBeVisible()
  await expect(page.getByText('联系孩子，确认近况与需要的支持')).toBeVisible()
  await page.getByLabel('已完成的支持动作').fill('已联系孩子，本周状态平稳，并由老师陪同继续写信。')
  await page.getByRole('button', { name: '记录已完成', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '支持任务已记录完成' })).toBeVisible()
})

test('争议先暂停交付，学校与平台双签名后才能恢复结对', async ({ page }) => {
  const reason = '阿川这一组的纸信交付方式需要学校和平台共同确认。'
  await as(page, 'operator', 'op3')
  await page.goto(operatorRoute(page, '/operator/disputes'))
  await expect(page.getByRole('heading', { name: '分歧要写下来，也要有双方签名。', exact: true })).toBeVisible()
  await page.getByLabel('涉及哪组结对').selectOption('p2')
  await page.getByLabel('议题').selectOption('delivery')
  await page.getByLabel('分歧说明（至少 3 字）').fill(reason)
  await page.getByRole('button', { name: '保存争议', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '争议已保存' })).toBeVisible()

  await as(page, 'teacher', 't2')
  const teacherPair = page.locator('.operation-letter-row').filter({ hasText: '许舟' })
  await expect(teacherPair).toContainText('已暂停')
  const schoolCard = page.locator('section[aria-label="学校侧争议签名"] article').filter({ hasText: '纸质交付' })
  await schoolCard.getByLabel('学校侧裁决方向').selectOption('uphold-school')
  await schoolCard.getByLabel('学校签名理由').fill('学校已与家长沟通，同意继续按原方式交付。')
  await schoolCard.getByRole('button', { name: '记录学校签名', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '已记录学校侧签名' })).toBeVisible()
  await expect(schoolCard.getByText('等待平台当值保护岗签名')).toBeVisible()

  await as(page, 'operator', 'op1')
  await page.goto(operatorRoute(page, '/operator/disputes'))
  const platformCard = page.locator('section[aria-label="争议列表"] article').filter({ hasText: '纸质交付' })
  await platformCard.getByLabel('平台侧裁决方向').selectOption('uphold-school')
  await platformCard.getByLabel('平台签名理由').fill('平台已复核交付记录，同意学校方案。')
  await platformCard.getByRole('button', { name: '记录平台签名', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '已记录平台侧签名' })).toBeVisible()
  await expect(platformCard.getByText('双方签名已完成')).toBeVisible()

  await as(page, 'operator', 'op3')
  await page.getByRole('link', { name: '结对', exact: true }).click()
  const matchRow = page.locator('.pair-row').filter({ hasText: '阿川 ↔ 许舟' })
  await matchRow.getByRole('button', { name: '恢复陪伴', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '陪伴已恢复' })).toBeVisible()
  await expect(matchRow).toContainText('陪伴中')
})

test('未完成培训的志愿者先完成培训，培训闸门才解除', async ({ page }) => {
  await as(page, 'volunteer', 'v4')
  const gate = page.getByTestId('volunteer-training-gate')
  await expect(gate).toBeVisible()
  await expect(gate.getByRole('heading', { name: '先完成本期行为边界培训', exact: true })).toBeVisible()
  await gate.getByRole('button', { name: '完成培训', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '培训记录已保存到此浏览器' })).toBeVisible()
  await expect(page.getByTestId('volunteer-training-gate')).toHaveCount(0)
})

