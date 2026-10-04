# TabTasks

Chrome 侧边栏扩展，当前版本 0.3.1；需要 Chrome 116 或更新版本。

将网页或选区收集为任务，支持列表、备注、子任务、到期日、日历导出。免费版 30 个活动任务和 2 个列表；Pro 增加标签、可读取页面的摘要、备份导入导出，以及自带 OpenAI API Key 的可选 AI 助手。

## 本地加载与测试

1. 在 chrome://extensions 开启开发者模式，加载本仓库目录。
2. 工具栏点击扩展图标打开侧栏。
3. 回归测试：node tools/regression.mjs。
4. UI 预览仅用于浏览器直接打开 sidepanel.html?demo=pro；真实扩展会忽略 demo 参数。

## 存储与迁移

界面发送具体操作；service worker 串行读取最新数据并持久保存，所有侧栏监听存储变化。旧数据键保留。异常旧记录修改前会保留在 tt_recovery_backup_v1，导入则必须完整通过校验。不要卸载扩展来更新，以免删除已有数据。

## 发布与付款服务

- 扩展 ZIP 只包含 manifest、运行脚本、样式、页面和图标。manifest.json 放在 ZIP 根目录。
- config.js 在公开仓库中保持占位密钥；发布包注入与现有线上服务一致的原密钥，避免老 Key 失效。不要把真实密钥提交到 GitHub。
- Worker 部署：在 worker 目录执行 wrangler deploy --keep-vars，保留现有 LIC_SECRET 和 STRIPE_SECRET_KEY。
- Worker 将 paid、complete、payment 模式的正式 Session 与 STRIPE_PAYMENT_LINK 对应的实际 Payment Link 核对后才签发。测试环境如需测试订单，单独配置 ALLOW_TEST_PAYMENTS=true；生产默认拒绝。
- 当前仍为客户端 HMAC，能读取安装包的技术用户可以取得签名密钥；设备限制和退款撤销并未实现。更强的许可方案应另行迁移到服务端私钥签发或授权记录。

## 隐私

任务通常保存在本机；主动使用 AI 时，任务标题、ID、到期日、完成状态、标签和指令直连发送给 OpenAI。API Key 仅存本机；OpenAI 费用由用户自行承担。 购买页由 Stripe 处理；开发者不接收使用遥测。完整隐私政策见 docs/PRIVACY.html。

修复列表见 CHANGELOG.md。
