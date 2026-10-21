# 谜语书信陪伴平台

四角色书信陪伴网站。当前仓库保留两条相互隔离的运行路径：浏览器本地的 V2 合成数据演示，以及使用四个成人合成账号的 V3 云端试测。项目正在准备冻结 MVP；冻结验收结果以 [MVP 冻结验收清单](./docs/MVP-冻结验收清单.md) 为准。

## 版本与站点

| 版本 | 地址与分支 | 数据和用途 |
| --- | --- | --- |
| V2 Demo | [riddle-letters.pages.dev](https://riddle-letters.pages.dev/)；`main` | 在当前浏览器的 IndexedDB 保存合成数据，可切换小朋友、志愿者、老师和运营演示身份。身份切换不代表正式认证。 |
| V3 成人试测 | [riddle-letters-v3.pages.dev](https://riddle-letters-v3.pages.dev/)；`dev` | 独立 Cloudflare Pages 项目，使用 Pages Functions、D1 和 Better Auth。四个成人分别使用预置合成账号，服务端检查角色权限及数据范围；信件和状态在账号间共享。 |

V3 的主要路径是结对、双方写信、人工审核、线上或老师协助的纸质送达、阅读、回信和跟进。纸质场景分别记录**打印、实际交付、阅读**；提交审核不等于送达。V2 与 V3 不共用业务数据库，不能将 V2 的角色切换当作 V3 权限测试。

V3 网页外壳可直接打开，进入角色后仍须用试测账号登录；当前不依赖 Cloudflare Access 作为使用者登录步骤。账号资料保存在仓库外，禁止提交密码、会话或真实儿童资料。试测只使用虚构人物和合成书信；真实儿童接入、监护授权及正式运营不属于当前 MVP。

## 本地运行

需要 Node.js 24 和 npm，使用仓库锁文件安装依赖：

```powershell
npm ci
```

运行本地 V2 演示：

```powershell
npm run dev
```

运行本地 V3 Pages Functions 与**本机 D1**：

1. 将 `.dev.vars.example` 复制为 `.dev.vars`，设置本机随机的 `BETTER_AUTH_SECRET`（至少 32 个随机字符）。不要提交 `.dev.vars`。
2. 执行以下命令，为本机 D1 建表并按提示创建四个成人合成账号：

```powershell
npm run db:v3-preview:migrate
npm run v3:seed-test-accounts
npm run dev:v3-preview
```

3. 打开 `http://127.0.0.1:8788`。本机账号与线上试测账号相互独立。详细步骤见 [V3 成人试测本地运行说明](./docs/V3-Preview-成人试测本地运行.md)。

## 构建和检查

```powershell
npm test
npm run build
npm run build:v3-preview
npm run e2e
```

`npm run build` 构建 V2 本地 Demo；`npm run build:v3-preview` 使用 `v3-preview` 模式构建 V3 前端并检查 Functions/服务端类型。`npm run e2e` 在本地 Vite 服务上运行桌面和手机视口 Playwright 场景，**不是 V3 真实登录、D1 或跨设备测试**。V3 云端闭环和权限需另用四个独立账号验证，并保存对应版本与证据。首次运行 Playwright 如缺少浏览器，可执行 `npx playwright install chromium --only-shell`。

## 当前 MVP 边界

- V3 试测提供文字书信与老师文字代录。云端图片上传、R2 私有附件和图片转换链尚未配置完成，写信页隐藏上传入口；仓库中的媒体服务代码不等于线上已启用。
- 不开放公众注册、真实儿童账号或儿童数据。志愿者公开申请、邮箱验证、邀请激活、找回密码等正式账号流程尚未交付。
- 内置谜语可供写信时选用；申报书提出的 300+ 谜语库、AI 推荐、AI 写作和情感分析不属于当前已实现功能。
- 早期未启用的 CloudBase 原型已从最终 MVP 工作树移除，历史仍可从 Git 读取。V3 实际后端路径是 `functions/api/`、`server/core.ts`、`server/d1-repository.ts` 和 `migrations/`。
- Cloudflare Pages 代码回滚不会自动回滚 D1 数据。数据清理、迁移与重新播种应先备份，并在冻结清单里记录。

V3 的操作指南和合成账号试用任务见 [V3 成人试测任务单](./docs/V3-成人试测任务单.md)。
