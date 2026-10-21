# V3 Preview：成人试测本地运行

V3 Preview 与公开 V2 Demo 使用不同构建入口和不同数据库。公开站继续使用浏览器 Dexie 数据；本地 Preview 使用 Cloudflare Pages Functions 和本机 D1。此文档不代表远程 Cloudflare Pages 项目、D1 绑定或 Access 策略已经配置。

## 本机启动

1. 安装依赖后，复制 `.dev.vars.example` 为 `.dev.vars`，设置一个只用于本机的随机 `BETTER_AUTH_SECRET`（至少 32 个随机字符）。`.dev.vars` 已列入 Git 忽略规则。
2. 应用本机 D1 迁移：`npm run db:v3-preview:migrate`。
3. 建立四个成人测试账号和合成角色资料：`npm run v3:seed-test-accounts`。脚本逐个提示邮箱、显示称呼和密码；密码只写入 Better Auth 的密码哈希，不输出或保存到源码。不要输入真实儿童或真实参与者资料。
4. 启动本地 Pages 预览：`npm run dev:v3-preview`，浏览器打开 `http://127.0.0.1:8788`。

本地预览默认仅绑定 `127.0.0.1`，Access JWT 只在本机开发地址绕过验证。不要把本地配置用于远程部署。纸质流程的云端试测只支持老师代录文字，图片上传仍限于独立 Demo。

## 远程 Preview 的前置条件

创建或修改远程资源前，先在 Cloudflare 控制台核对具体 Pages 项目、生产分支、部署设置和现有绑定。本仓库未凭 Dashboard 链接推断这些设置。只有确认项目后，才能在该项目创建**独立的 Preview D1**，配置 `DB` 绑定与迁移，并把 Better Auth 密钥、`V3_MODE=preview`、`V3_ACCESS_TEAM_DOMAIN` 和 `V3_ACCESS_AUD` 作为 Preview 环境变量或密钥保存。

Cloudflare Access 应给 Preview 域名配置成人试测者允许名单；Pages 函数还会验证 Access 注入的 JWT 签名、签发者和 audience。访问保护缺失时服务器拒绝服务。不要在公开生产部署设置 `V3_MODE=preview`，不要把测试 D1 绑定到生产环境，也不要在 Preview 保护和权限验证完成前分享地址。

迁移应通过已核实的 Preview 项目与独立数据库执行。当前 custom Wrangler 配置是 local-only，包含占位数据库 ID，不应用于远程发布。

## 发布与回滚边界

- 本轮不触发 Cloudflare Pages 部署，也不改生产分支。
- 公开 V2 的入口、Dexie 数据与页面构建保持独立。
- 远程 Preview 必须在成人测试账号建好、Access 覆盖应用与 API、恢复方式核实后，才交给三位试用者。
- 四位成人分别持有合成角色账号；不创建真实儿童账号，不导入 Demo 数据，不开放公众注册。
- 回滚时保留 Preview D1 供审计，不将其绑定到 V2 公共站；如需销毁测试数据，先完成备份并逐项核对目标环境。
