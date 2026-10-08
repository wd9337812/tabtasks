# TabTasks

Chrome 侧边栏扩展，版本 0.5.0，需要 Chrome 116+。默认英文，支持简体中文及浅色／深色／跟随系统。

免费版支持 30 个活动任务、2 个列表、网页和选区收集、备注、子任务、到期日及日历导出。Pro 支持无限活动任务和列表、标签、可读取网页的摘要、JSON 备份及可选 AI 助手。AI 支持 OpenAI Chat Completions 与 Anthropic Messages 兼容接口，可自定义服务地址、模型和 API Key；包含 OpenAI、Anthropic、DeepSeek 预设。免费版可配置并测试连接。

## 购买与授权

Pro 为 $6 一次性买断，税费以 Stripe 结账页为准。从插件内发起购买后，Worker 核对 Stripe 的商品、价格与付款状态，再通过本机保存的购买凭证自动激活。关闭付款页也可回到插件检查付款状态。购买管理提供邮箱验证码恢复及折叠的旧授权码入口。邮件恢复需要运营方配置 Resend 发件服务；已有历史订单须经管理员核对或旧成功页访问建立邮箱摘要索引。

Pro 买断不含 AI 用量；服务商单独收费。API Key 仅存本机，不进入备份，仅发往所选服务。模型建议先预览，再由用户确认应用。兼容两种接口的服务需要按其文档填写地址和模型；不承诺所有 AI 产品都能直接接入。

## 本地加载与开发

1. 在 chrome://extensions 开启开发者模式并加载本仓库。公开源码 config.js 使用占位签名配置，测试授权应使用本地同一配置。
2. 点击扩展图标打开侧栏。Alt+Shift+T 收集当前网页。
3. npm ci 后 npm run build 更新本地打包 UI；生成的 sidepanel.js / sidepanel.css 已提交。
4. npm test 执行扩展回归、此次功能测试、付款服务与自动激活测试，需要 Node 22.13+。测试不扣款、不发送真实验证码、不调用收费 AI。

React、Tailwind、shadcn/ui、Motion 与 Lucide 均在本地打包，无运行时 CDN。

## 数据与升级

保留原存储键及旧授权结构，后台串行保存，多个侧栏同步。异常旧记录在修改前保存在本地恢复备份。旧 aiKey / aiModel 设置可读取，新设置保存后迁移为 aiConfig。请直接更新原扩展，不要卸载来升级，以免清除本地数据。

## 发布与隐私

扩展 ZIP 只包含运行文件，manifest 位于根目录。发布时保留现有签名配置，真实配置不提交 GitHub。Worker Billing 2.1.0 的迁移、扩展 ID 与邮件配置见 [worker/DEPLOY.md](worker/DEPLOY.md)。当前 HMAC 离线许可不提供强制撤销或设备数量控制；退款会阻止服务器重新签发，已激活的离线授权不会自动撤销。

任务／会话不上传至付款服务；D1 记录订单信息及购买邮箱摘要，邮件恢复时向 Resend 提交邮箱以投递验证码。详见 [隐私政策](docs/PRIVACY.html)和[支持](docs/SUPPORT.html)。

此次功能与验证说明见 [docs/iteration-2026-10-08.md](docs/iteration-2026-10-08.md)，历史记录见 CHANGELOG.md。
