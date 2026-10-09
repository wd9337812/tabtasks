# 0.5.0 · 2026-10-08

## 0.5.1 · 2026-10-09

- Official website: https://tabtasks.tabplugins.top/
- Billing origin: https://pay-tabtasks.tabplugins.top; original workers.dev address and Stripe webhook remain available.
- Billing 2.1.1 adds custom-domain policy/support links.
- Existing local data and Pro signing configuration are preserved.

免费版支持 30 个活动任务、2 个列表、网页和选区收集、备注、子任务、到期日及日历导出。Pro 支持无限活动任务和列表、标签、可读取网页的摘要、JSON 备份及可选 AI 助手。AI 支持 OpenAI Chat Completions 与 Anthropic Messages 兼容接口，可自定义服务地址、模型和 API Key；包含 OpenAI、Anthropic、DeepSeek 预设。免费版可配置并测试连接。

- 增加服务端核对的自动激活与购买恢复入口，备用授权码折叠。
- 新增 Billing 2.1.0 和兼容原订单的增量迁移。
- 保留原授权与旧数据；更新隐私与支持说明。

# Worker Billing 2.0.0（2026-10-05）

- Worker 用现有 Stripe Price 创建独立 Checkout Session，替换新购买的 Payment Link 跳转；默认英文，支持中文。
- 新增独立 D1 订单库、经过签名验证的付款／退款回调与管理员订单后台，支持核对、授权找回、搜索分页及关闭未付款订单。
- 保留旧 Payment Link 订单、原授权签名与现有扩展版本；加入付款前说明，更新隐私和支持页面。
- 退款会记录并阻止重新领取 Key；已激活的离线授权不自动撤销。没有自动授权邮件。

# TabTasks 0.4.0

发布日期：2026-10-04。

- 采用 shadcn/ui 重构侧栏，更新 Logo；默认英文，支持中英文切换并记住选择；提供浅色、深色及跟随系统主题；优化任务详情与 AI 预览。兼容原有数据和 Pro 授权。
- 修复弹窗内操作提示及无障碍状态反馈；窄侧栏支持键盘 Esc 关闭弹窗。
- 保留后台串行写入、导入完整校验和原授权签名配置。
- 提供中英文商店截图、新图标与官网素材。

# TabTasks 0.3.1

发布日期：2026-10-04。

- 快捷键和右键选区在侧栏关闭时也会保存；已打开的侧栏实时同步。
- 后台串行写入，避免多个窗口互相覆盖。
- 修复 AI Pro 开关、可选域名权限、操作校验和批量应用；支持更新到期日、标签和备注。
- 导入完整校验；失败不污染原数据；旧异常记录在修改前保留恢复备份。
- 所有新增入口统一检查免费额度；暂存选区在保存成功后才消费。
- 生产扩展忽略 demo 参数；预览代码移到独立文件，消除内联脚本错误。
- 付款服务同时核对支付状态、正式模式及本商品的 Stripe Payment Link。
- 保持已有数据键和 HMAC Key 格式兼容；本次没有轮换授权密钥。
