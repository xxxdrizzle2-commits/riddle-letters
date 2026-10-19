import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const originalTitle = '把秋天装进信封里'
const paperTitle = '今晚的月亮像一艘小船'

async function settings(page: Page) {
  if (!(await page.getByLabel('演示角色', { exact: true }).isVisible())) await page.getByText('演示设置', { exact: true }).click()
  await expect(page.getByLabel('演示角色', { exact: true })).toBeVisible()
}

async function as(page: Page, role: 'child' | 'volunteer' | 'teacher' | 'operator', id: string) {
  await settings(page)
  await page.getByLabel('演示角色', { exact: true }).selectOption(role)
  await settings(page)
  await page.getByLabel('演示身份', { exact: true }).selectOption(id)
  await page.getByText('演示设置', { exact: true }).click()
  await page.goto('/#/space')
  await expect(page.getByText('演示设置', { exact: true })).toBeVisible()
  await expect(page.locator('main h1')).toBeVisible()
}

async function fillLetter(page: Page, title: string, body: string) {
  await page.getByLabel('信的名字', { exact: false }).fill(title)
  await page.getByLabel('想说的话', { exact: false }).fill(body)
}

async function submitLetter(page: Page) {
  await page.getByRole('button', { name: '提交审核', exact: true }).click()
  await expect(page).toHaveURL(/#\/letters\//)
  await expect(page.getByText('这封信正在等待审核。', { exact: true })).toBeVisible()
}

async function approve(page: Page, title: string) {
  await as(page, 'operator', 'op1')
  const row = page.getByRole('button').filter({ has: page.getByText(title, { exact: true }) })
  await row.click()
  await page.getByRole('button', { name: '通过审核', exact: true }).click()
  await page.getByRole('button', { name: '确认通过审核', exact: true }).click()
  await expect(row).toHaveCount(0)
}

async function advanceWeek(page: Page) {
  await settings(page)
  await page.getByRole('button', { name: '前进 7 天', exact: true }).click()
  await page.getByText('演示设置', { exact: true }).click()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/#/space')
  await expect(page.getByText('演示设置', { exact: true })).toBeVisible()
  await expect(page.locator('main h1')).toBeVisible()
})

test('线上完整闭环：保存、审核、阅读、回信审核与持久化', async ({ page }) => {
  const title = '今天的云像一只小船', replyTitle = '我的天空是淡蓝色'
  await as(page, 'volunteer', 'v1')
  await page.getByRole('link', { name: '写一封信', exact: true }).click()
  await fillLetter(page, title, '小禾，你好！今天回来的路上，我发现云朵像一只小船，想把这件小事分享给你。你今天看到了什么颜色的天空呢？')
  await page.getByLabel('附上一道小谜语', { exact: false }).selectOption('r2')
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await expect(page.getByText('草稿已保存', { exact: true })).toBeVisible()
  await submitLetter(page)
  const originalPath = new URL(page.url()).hash.slice(1)
  expect(originalPath).not.toBe('/letters/l3')
  await page.goto('/#/write/l3')
  await expect(page.getByLabel('信的名字', { exact: false })).toHaveValue('一颗种子的慢慢旅行')
  await expect(page.getByLabel('想说的话', { exact: false })).toHaveValue(/楼下花盆里冒出了一片小叶子/)

  await as(page, 'child', 'c1')
  await expect(page.getByRole('heading', { name: title, exact: true })).toHaveCount(0)
  await approve(page, title)
  await as(page, 'child', 'c1')
  await page.getByRole('link', { name: '打开这封信', exact: false }).click()
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  await expect(page.getByText('已打开阅读', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '给我一点提示', exact: true }).click()
  await expect(page.getByText('小提示：它有好几种颜色。', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: '给这封信写回信', exact: false }).click()
  await fillLetter(page, replyTitle, '林语，你好！我今天抬头看到了淡蓝色的天空，也画了一只白色的小船。谢谢你告诉我这么有趣的小发现。')
  await submitLetter(page)
  const replyPath = new URL(page.url()).hash.slice(1)
  await as(page, 'volunteer', 'v1')
  await page.goto(`/#${replyPath}`)
  await expect(page.getByRole('heading', { name: '这封信暂时不能打开', exact: true })).toBeVisible()
  await approve(page, replyTitle)
  await as(page, 'volunteer', 'v1')
  await page.getByRole('link').filter({ has: page.getByText(replyTitle, { exact: true }) }).click()
  await expect(page.getByRole('heading', { name: replyTitle, exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: replyTitle, exact: true })).toBeVisible()
  await as(page, 'child', 'c1')
  await page.goto(`/#${originalPath}`)
  await expect(page.getByRole('heading', { name: '这一轮，收到回应了', exact: true })).toBeVisible()
})

test('纸质完整闭环：打印、确认交付、代录和图片回传、审核后阅读', async ({ page }) => {
  await as(page, 'teacher', 't2')
  await page.getByLabel(`选择${paperTitle}`, { exact: true }).check()
  await page.evaluate(() => { window.print = () => { document.documentElement.dataset.printCalls = '1' } })
  await page.getByRole('button', { name: '打开打印预览', exact: false }).click()
  await expect(page.locator('html')).toHaveAttribute('data-print-calls', '1')
  await expect(page.locator('.teacher-print-area')).toContainText(paperTitle)
  await page.getByLabel('我已核对这些信件的打印结果', { exact: true }).check()
  await page.getByRole('button', { name: '记录已打印', exact: true }).click()
  await expect(page.getByLabel(`选择${paperTitle}`, { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: /^待交付/ }).click()
  await expect(page.getByRole('button', { name: new RegExp(paperTitle) })).toContainText('审核已通过')
  await page.getByLabel(`选择${paperTitle}`, { exact: true }).check()
  await page.getByLabel('我确认已把这些信件交给对应孩子', { exact: true }).check()
  await page.getByRole('button', { name: '确认实际交付', exact: true }).click()
  await page.getByRole('button', { name: /^待回传/ }).click()
  await page.getByRole('button', { name: new RegExp(paperTitle) }).click()
  await expect(page.getByRole('button', { name: new RegExp(paperTitle) })).toContainText('回信期限 11月2日')
  await page.getByLabel('回信标题（必填）', { exact: true }).fill('给许舟的月亮小发现')
  await page.getByLabel('代录正文（与图片至少填写一项）', { exact: true }).fill('许舟，你好！我把弯弯的月亮画在纸船旁边。今天想和你分享这张合成小画，也想知道月亮明天会不会变得更圆。')
  await page.getByLabel('演示手写回信图片（选填）', { exact: true }).setInputFiles({
    name: 'synthetic-moon.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
  })
  await page.getByRole('button', { name: '保存代录草稿', exact: true }).click()
  await expect(page.getByText('代录草稿已保存，可以稍后继续。', { exact: true })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: /^待回传/ }).click()
  await page.getByRole('button', { name: new RegExp(paperTitle) }).click()
  await expect(page.getByLabel('回信标题（必填）', { exact: true })).toHaveValue('给许舟的月亮小发现')
  await expect(page.getByLabel('移除已保存的附件：synthetic-moon.png', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '提交回信审核', exact: false }).click()
  await expect(page.getByText('回信正在等待运营审核，审核通过后会送到志愿者的信箱。', { exact: true })).toBeVisible()
  await approve(page, '给许舟的月亮小发现')
  await as(page, 'volunteer', 'v2')
  await page.getByRole('link').filter({ has: page.getByText('给许舟的月亮小发现', { exact: true }) }).click()
  await expect(page.getByRole('img', { name: '演示手写回信：synthetic-moon.png', exact: true })).toBeVisible()
})

test('退回修改保留原文和意见，可修改后再次审核', async ({ page }) => {
  const title = '一次可以慢慢回应的故事邀请'
  await as(page, 'volunteer', 'v1')
  await page.goto('/#/write/l5')
  await expect(page.getByText(/运营的修改建议/)).toBeVisible()
  await fillLetter(page, title, '小禾，你好！最近读到一个小狐狸的故事，想和你分享。有空的时候，也欢迎告诉我你喜欢的故事。不着急，我们可以慢慢聊。')
  await submitLetter(page)
  await as(page, 'operator', 'op1')
  await page.getByRole('button').filter({ has: page.getByText(title, { exact: true }) }).click()
  await page.getByLabel('审核备注 / 修改建议（退回时必填）', { exact: true }).fill('再补充一个小狐狸故事里的细节，让邀请更具体。')
  await page.getByRole('button', { name: '退回修改', exact: true }).click()
  await as(page, 'volunteer', 'v1')
  await page.getByRole('link').filter({ has: page.getByText(title, { exact: true }) }).click()
  await expect(page.getByText(/再补充一个小狐狸故事里的细节/)).toBeVisible()
  await expect(page.getByLabel('想说的话', { exact: false })).toHaveValue(/不着急/)
  await page.getByLabel('想说的话', { exact: false }).fill('小禾，你好！故事里的小狐狸把落叶当作书签，我也准备试试看。等你有空时，也欢迎告诉我你喜欢的小故事。我们慢慢聊。')
  await submitLetter(page)
  await approve(page, title)
  await as(page, 'child', 'c1')
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
})

test('假期暂停后顺延七天，暂停时仍可阅读但无法继续写信', async ({ page }) => {
  await as(page, 'operator', 'op1')
  await page.getByRole('button', { name: /^结对管理/ }).click()
  const pair = page.locator('.pair-row').filter({ hasText: '小禾 ↔ 林语' })
  await pair.getByRole('button', { name: '暂停 / 假期', exact: true }).click()
  await page.getByLabel('暂停原因（必填）', { exact: true }).fill('学校秋假，暂时休息')
  await page.getByRole('button', { name: '确认暂停', exact: true }).click()
  await expect(pair.getByText('暂停中', { exact: true })).toBeVisible()
  await as(page, 'volunteer', 'v1')
  await page.getByRole('link', { name: '写一封信', exact: true }).click()
  await expect(page.getByRole('heading', { name: '陪伴正在暂停', exact: true })).toBeVisible()
  await as(page, 'child', 'c1')
  await page.goto('/#/letters/l1')
  await expect(page.getByRole('heading', { name: originalTitle, exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '给这封信写回信', exact: false })).toHaveCount(0)
  await as(page, 'operator', 'op1')
  await advanceWeek(page)
  await page.getByRole('button', { name: /^结对管理/ }).click()
  await page.locator('.pair-row').filter({ hasText: '小禾 ↔ 林语' }).getByRole('button', { name: '恢复陪伴', exact: true }).click()
  await as(page, 'child', 'c1')
  await page.goto('/#/letters/l1')
  await expect(page.getByText(/本轮约定 11月7日 前回信/)).toBeVisible()
  await expect(page.getByRole('link', { name: '给这封信写回信', exact: false })).toBeVisible()
})

test('演示日期驱动唯一逾期跟进，处理结果可回查', async ({ page }) => {
  await as(page, 'operator', 'op1')
  for (let week = 0; week < 3; week++) await advanceWeek(page)
  await page.getByRole('button', { name: /^持续跟进/ }).click()
  const childFollowup = page.getByRole('button').filter({ hasText: '回信进度跟进' }).filter({ hasText: '小禾' })
  await expect(childFollowup).toHaveCount(1)
  await childFollowup.click()
  await page.getByLabel('处理结果（必填）', { exact: true }).fill('已在演示中了解收发情况，记录下周再问候一次。')
  await page.getByRole('button', { name: '保存处理结果', exact: true }).click()
  await page.getByRole('button', { name: '已处理记录', exact: true }).click()
  await expect(page.getByText('已在演示中了解收发情况，记录下周再问候一次。', { exact: true })).toBeVisible()
})

test('运营可安排新结对；孩子求助只进入运营处理流程', async ({ page }) => {
  await as(page, 'operator', 'op1')
  await page.getByRole('button', { name: /^结对管理/ }).click()
  await page.getByLabel('待结对的小朋友', { exact: true }).selectOption('c3')
  await page.getByLabel('可结对的志愿者', { exact: true }).selectOption('v3')
  await page.getByLabel('协助老师', { exact: true }).selectOption('t1')
  await page.getByRole('button', { name: '建立结对', exact: false }).click()
  await expect(page.locator('.pair-row').filter({ hasText: '芽芽 ↔ 苏宁' })).toBeVisible()
  await as(page, 'child', 'c3')
  await page.getByRole('button', { name: '我想找人帮忙', exact: false }).click()
  await page.getByLabel('想告诉运营伙伴什么？', { exact: true }).fill('我还不知道第一封信可以聊些什么，想请你帮我想一想。')
  await page.getByRole('button', { name: '保存求助', exact: true }).click()
  await as(page, 'operator', 'op1')
  await page.getByRole('button', { name: /^持续跟进/ }).click()
  await page.getByRole('button').filter({ hasText: '一份需要认真倾听的求助' }).click()
  await expect(page.getByText('仅运营可见', { exact: true })).toBeVisible()
  await expect(page.getByText(/芽芽：我还不知道第一封信可以聊些什么/)).toBeVisible()
  await page.getByLabel('处理结果（必填）', { exact: true }).fill('已记录想法，演示中安排老师提供三个可自由选择的话题。')
  await page.getByRole('button', { name: '保存处理结果', exact: true }).click()
  await page.getByRole('button', { name: '已处理记录', exact: true }).click()
  await expect(page.getByText(/已记录想法，演示中安排老师/)).toBeVisible()
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
  await page.goto('/#/letters/l1')
  await expect(page.getByText(/本轮约定 10月31日 前回信/)).toBeVisible()
})

test('手输回信地址不会泄露他人未审核的正文', async ({ page }) => {
  await as(page, 'volunteer', 'v1')
  await page.goto('/#/write?replyTo=l4')
  await expect(page.getByRole('heading', { name: '现在还不能写这封信', exact: true })).toBeVisible()
  await expect(page.getByText(/上次你说想做一艘更大的纸船/)).toHaveCount(0)
  await expect(page.getByLabel('想说的话', { exact: false })).toHaveCount(0)
  await as(page, 'child', 'c1')
  await page.goto('/#/write?pair=p2&replyTo=l4')
  await expect(page.getByRole('heading', { name: '现在还不能写这封信', exact: true })).toBeVisible()
  await expect(page.getByText(/上次你说想做一艘更大的纸船/)).toHaveCount(0)
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
  await page.goto('/#/write/l3')
  const composition = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect.soft(composition.violations, JSON.stringify(composition.violations, null, 2)).toEqual([])
  await page.getByLabel('想说的话', { exact: false }).focus()
  await expect(page.getByLabel('想说的话', { exact: false })).toBeFocused()
  await as(page, 'child', 'c1')
  await page.goto('/#/letters/l1')
  await expect(page.getByRole('heading', { name: originalTitle, exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length)).toBe(0)
  const reading = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(reading.violations, JSON.stringify(reading.violations, null, 2)).toEqual([])
})
