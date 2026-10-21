import { expect, test } from '@playwright/test'

test('首页四个身份入口都能直接进入可操作演示', async ({ page }) => {
  await page.goto('/#/')
  await expect(page.getByRole('heading', { name: '你想从哪一步开始？' })).toBeVisible()
  for (const label of ['我是小朋友', '我是志愿者', '我是老师', '我是运营人员']) {
    await expect(page.getByRole('link', { name: new RegExp(label) })).toBeVisible()
  }
  await page.getByRole('link', { name: /我是小朋友/ }).click()
  await expect(page).toHaveURL(/#\/space/)
  await expect(page.locator('main').getByRole('link', { name: '写一封信', exact: true })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '网站导航' })).toHaveCount(0)
  await expect(page.getByText('合成数据演示 · 仅当前浏览器保存')).toBeVisible()
})

test('未结对孩子可先写自我介绍，刷新后仍能接着写', async ({ page }) => {
  await page.goto('/#/demo/start/child')
  await expect(page).toHaveURL(/#\/space/)
  await page.locator('summary').filter({ hasText: '演示设置' }).click()
  await page.getByLabel('演示人物', { exact: true }).selectOption('c3')
  await page.locator('summary').filter({ hasText: '演示设置' }).click()
  await page.locator('main').getByRole('link', { name: '写一封信', exact: true }).click()
  await page.getByLabel('想说的话').fill('你好，我喜欢画画，也喜欢猜关于小动物的谜语。')
  await page.getByRole('button', { name: '保存草稿' }).click()
  await expect(page.getByRole('status').filter({ hasText: '已保存到此浏览器' }).first()).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('想说的话')).toHaveValue('你好，我喜欢画画，也喜欢猜关于小动物的谜语。')
  await expect(page.getByRole('button', { name: '检查并寄出' })).toBeDisabled()
})

test('旧登录地址不伪装账号，退出演示回到身份选择', async ({ page }) => {
  await page.goto('/#/login/child')
  await expect(page.getByRole('heading', { name: /小朋友入口将在正式试用阶段开放/ })).toBeVisible()
  await page.getByRole('link', { name: '选择演示身份' }).click()
  await page.getByRole('link', { name: /我是志愿者/ }).click()
  await expect(page).toHaveURL(/#\/space/)
  await page.locator('summary').filter({ hasText: '演示设置' }).click()
  await page.getByRole('button', { name: '退出演示' }).click()
  await expect(page).toHaveURL(/#\//)
  await expect(page.getByRole('heading', { name: '你想从哪一步开始？' })).toBeVisible()
})

test('孩子从信箱打开来信后，返回键回到信箱并恢复入口焦点', async ({ page }) => {
  await page.goto('/#/demo/start/child')
  await expect(page).toHaveURL(/#\/space/)
  const open = page.getByRole('link', { name: '打开来信', exact: true })
  await open.click()
  await page.getByRole('link', { name: '返回信箱', exact: true }).click()
  await expect(page).toHaveURL(/#\/space$/)
  await expect(page.locator('#child-start-writing')).toBeFocused()
})

test('未保存的信拦截浏览器后退，可保存后离开并继续写', async ({ page }) => {
  await page.goto('/#/demo/start/child')
  await page.locator('main').getByRole('link', { name: '写一封信', exact: true }).click()
  await page.getByLabel('想说的话').fill('这封信还没有保存，我想离开前确认内容不会消失。')
  await page.goBack({ waitUntil: 'commit' })
  const dialog = page.getByRole('dialog', { name: '这封信还没有保存' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: '保存后离开', exact: true }).click()
  await expect(page).toHaveURL(/#\/space$/)
  await expect(page.locator('main').getByRole('link', { name: '接着写', exact: true })).toBeVisible()
  await page.goForward()
  await expect(page).toHaveURL(/#\/write$/)
  await expect(page.getByLabel('想说的话')).toHaveValue('这封信还没有保存，我想离开前确认内容不会消失。')
})

test('运营从已审记录打开信件后，返回保留筛选并恢复原条目焦点', async ({ page }) => {
  await page.goto('/#/demo/start/operator')
  await page.getByRole('link', { name: '审核', exact: true }).click()
  await page.getByRole('button', { name: '已审记录', exact: true }).click()
  await expect(page).toHaveURL(/#\/operator\/review\?view=history/)
  await expect(page.getByRole('button', { name: '已审记录', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('button[id^="operator-review-"]')).toHaveCount(4)
  const row = page.locator('button[id^="operator-review-"]').first()
  const rowId = await row.getAttribute('id')
  await row.click()
  await page.getByRole('link', { name: '返回已审记录', exact: true }).click()
  await expect(page).toHaveURL(/#\/operator\/review\?view=history/)
  await expect(page.locator(`#${rowId}`)).toBeFocused()
})

test('刷新或直接打开审核详情时，返回目的地仍清楚并回到对应列表', async ({ page }) => {
  await page.goto('/#/demo/start/operator')
  await expect(page).toHaveURL(/#\/space/)
  const direct = await page.context().newPage()
  await direct.addInitScript(() => { sessionStorage.setItem('riddle-v1-mode', 'demo'); localStorage.setItem('riddle-demo-actor', 'op1') })
  await direct.goto('/#/operator/review?view=history&letter=l1')
  await expect(direct.getByRole('heading', { name: '信件与审核记录' })).toBeVisible()
  await expect(direct.getByRole('link', { name: '返回已审记录', exact: true })).toBeVisible()
  await direct.reload()
  await expect(direct.getByRole('heading', { name: '信件与审核记录' })).toBeVisible()
  await direct.getByRole('link', { name: '返回已审记录', exact: true }).click()
  await expect(direct).toHaveURL(/#\/operator\/review\?view=history/)
  await expect(direct.getByRole('button', { name: '已审记录', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('从运营首页进入结对任务后，返回名称指向结对列表', async ({ page }) => {
  await page.goto('/#/demo/start/operator')
  await expect(page).toHaveURL(/#\/space/)
  await page.getByRole('link', { name: '跟进', exact: true }).click()
  await page.getByRole('button').filter({ hasText: '书信回应进度' }).filter({ hasText: '阿川' }).click()
  await page.getByLabel('处理结果与下一步', { exact: true }).fill('已在演示中了解情况，后续继续跟进。')
  await page.getByRole('button', { name: '保存处理结果', exact: true }).click()
  await page.getByRole('link', { name: '审核', exact: true }).click()
  await page.getByRole('button', { name: /你的纸船，开到了哪里/ }).click()
  await page.getByRole('button', { name: '通过审核', exact: true }).click()
  await page.getByRole('button', { name: '确认通过审核', exact: true }).click()
  await page.getByRole('link', { name: '待处理', exact: true }).click()
  await expect(page.getByRole('heading', { name: '等待安排结对', exact: true })).toBeVisible()
  await page.getByRole('link', { name: '查看并处理', exact: true }).click()
  await expect(page.getByRole('link', { name: '返回结对列表', exact: true })).toBeVisible()
})

test('直接打开帮助页时，返回名称匹配当前角色的工作台', async ({ page }) => {
  await page.goto('/#/demo/start/volunteer')
  await expect(page).toHaveURL(/#\/space/)
  for (const [actorId, label] of [['c1', '返回信箱'], ['v1', '返回陪伴任务'], ['t1', '返回收发任务'], ['op1', '返回待处理']] as const) {
    const direct = await page.context().newPage()
    await direct.addInitScript(id => { sessionStorage.setItem('riddle-v1-mode', 'demo'); localStorage.setItem('riddle-demo-actor', id) }, actorId)
    await direct.goto('/#/help')
    await expect(direct.getByRole('link', { name: label, exact: true })).toBeVisible()
    await direct.getByRole('link', { name: label, exact: true }).click()
    await expect(direct).toHaveURL(/#\/space/)
    await direct.close()
  }
})

test('旧标签页模块加载失败时只自动刷新一次', async ({ page }) => {
  await page.goto('/#/demo/start/child')
  await expect(page).toHaveURL(/#\/space/)
  const reloaded = page.waitForEvent('load')
  await page.evaluate(() => {
    sessionStorage.removeItem('riddle-chunk-reload-at')
    setTimeout(() => window.dispatchEvent(new Event('vite:preloadError', { cancelable: true })), 0)
  })
  await reloaded
  await expect(page.locator('main .page-header h1')).toBeVisible()
  const firstReload = await page.evaluate(() => Number(sessionStorage.getItem('riddle-chunk-reload-at')))
  expect(firstReload).toBeGreaterThan(0)
  const retriedAgain = await page.evaluate(() => {
    const event = new Event('vite:preloadError', { cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
  })
  expect(retriedAgain).toBe(false)
})
