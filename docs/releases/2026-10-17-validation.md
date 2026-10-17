# TabTasks 0.6.0 验证留档

日期：2026-10-17。功能范围：已确认 v3 的 P0/P1，P2 尚未交付。

- 自动测试：80 项通过，包含扩展数据回归、新工作流、付款校验、自动激活与邮件恢复。
- 最终发布目录的真实 Chromium 验收：7 个场景通过，页面脚本错误为 0。
- 320 / 360 / 400 / 480px，紧凑/标准/大字；真实 Chrome 200% 放大已验收。
- 明暗主题主列表与设置页普通可见文字对比度检查通过；装饰图标和禁用状态不按正文处理。
- 新版 → 原版本源码 → 新版，原内容、新工作流存储键和 Pro 状态保留。
- 运行包与最终源文件逐项一致，含 workflows.js；沿用旧生产签名配置。
- 浏览器权限、允许的服务域名和最低 Chrome 版本与上一正式源码一致。
- 两种语言各 5 张 1280×800 实际界面截图，示例数据与 Pro 标注已包含。

## 浏览器场景

- Free template editor, relative dates, subtasks and real task generation
- Saved view filters original tasks without copying records
- Quota upgrade and returning to Free preserve the template draft
- Verified mocked payment activates Pro and returns to the original operation
- AI sends selected fields, supports choosing individual changes and undo
- Four sidebar widths and three text sizes fit main and settings
- Actual 200% browser zoom keeps text and controls usable

## 发布包

文件：tabtasks-0.6.0.zip

SHA-256：`f1bcf6a29cbfad7d34486a7df6f9ecdb6cc58377c5025b1288283336b7938207`

大小：238761 字节。

验证环境使用独立浏览器配置和模拟支付/AI；没有真实扣款、验证码邮件或收费 AI 调用。上线后仍应完成一次受控生产支付和恢复购买验收。尚未上传或发布商店；新版官网宣传材料待发布窗口同步，支付 Worker/D1 无需变更。
