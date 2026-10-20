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
