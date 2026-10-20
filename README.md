# 谜语书信 · 四角色 Demo · V2 体验打磨

V1 提供四角色互动 Demo。当前 V2 规划先重做身份入口、角色导航、首页任务层级和四条核心流程，再整理手机可用性、业务状态与错误恢复。所有人物和信件均为虚构内容，数据保存在当前浏览器，不跨设备同步。

## 本地运行

需要 Node.js 24 与 npm。

```powershell
npm ci
npm run dev
```

页面提供首页身份入口和“先体验 Demo”。进入演示后可切换小朋友、志愿者、老师、运营身份，调整演示日期并重置合成数据。

| 演示角色 | 推荐身份 | 可体验流程 |
| --- | --- | --- |
| 小朋友 | 小禾 | 收信、猜谜、写第一封介绍或回信、保存草稿 |
| 志愿者 | 林语 | 看伙伴来信、写信、保存草稿、按修改建议重提 |
| 老师 | 周老师 | A4 打印、确认纸质交付、代录回信并请孩子核对 |
| 运营人员 | 小满 | 结对、逐封审核、暂停恢复、处理求助与跟进 |

## 状态边界

- 身份选择只帮助进入页面，不授予真实权限；Demo 中的角色切换仅为合成场景视图。
- 登录与注册界面当前明确显示正式账号服务未连接，不会伪装成登录成功。
- 演示数据只存在当前浏览器的 IndexedDB。请勿输入真实儿童的姓名、联系方式、信件或照片。
- `server/` 与 `cloudfunctions/` 内是未配置的 CloudBase 技术原型，不属于当前 V2 运行路径，不应发布或作为跨设备能力证明。
- V3 再评估 Cloudflare Pages Functions + D1，以及独立的成人账号、儿童邀请登录、私有附件、服务端授权和备份设计。

## 检查

```powershell
npm test
npm run build
npm run e2e
```

`npm run e2e` 包含桌面与手机项目。首次运行如未安装浏览器，可执行 `npx playwright install chromium --only-shell`。

## Cloudflare 部署状态

当前 Pages 项目为 [riddle-letters.pages.dev](https://riddle-letters.pages.dev/)，连接仓库 `xxxdrizzle2-commits/riddle-letters`。只读核对显示生产分支是 `main` 且自动部署开启；非生产分支均生成 Preview，Preview 默认公开。构建命令为 `npm run build`，输出目录为 `dist`，Node 版本为 24。Production 和 Preview 当前均没有 D1 绑定或业务 API 变量。

V2 本地修改尚未推送。推送 `main` 会直接触发生产部署；经授权后应先推送到非生产分支并核对公开 Preview，再决定是否更新生产。
