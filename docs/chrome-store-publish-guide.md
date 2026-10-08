# TabTasks 0.5.0 更新发布指南

这次更新在原商店条目中上传，保留原扩展 ID；不要新建条目、卸载旧扩展或轮换授权配置。Chrome 商店上架完成后，将真实商店地址填入官网安装按钮。

## 上传文件

- 代码包：tabtasks-0.5.0.zip。manifest 位于根目录。
- 商店图标：icons/icon-128.png，128×128 PNG；图形位于中间 96×96，四边各 16px 透明边距。
- 必填小型宣传图：440×280 PNG。
- 可选横幅：1400×560 PNG。
- 英文和简体中文截图：每种语言 5 张，1280×800 PNG，保存在 docs/assets/en 与 docs/assets/zh；截图含 Pro 功能与示例数据。
- 1200×630 社交分享图用于官网 / 社交分享，不是商店截图规格。

Chrome 图片要求见 [官方图片说明](https://developer.chrome.com/docs/webstore/images)。

## 商店文字与审核

默认语言设为英文，并添加简体中文本地化。采用 shadcn/ui 重构侧栏，更新 Logo；默认英文，支持中英文切换并记住选择；提供浅色、深色及跟随系统主题；优化任务详情与 AI 预览。兼容原有数据和 Pro 授权。

免费额度和 Pro 功能按 README 填写。免费版支持 30 个活动任务、2 个列表、网页和选区收集、备注、子任务、到期日及日历导出。Pro 支持无限活动任务和列表、标签、可读取网页的摘要、JSON 备份及可选 AI 助手。AI 支持 OpenAI Chat Completions 与 Anthropic Messages 兼容接口，可自定义服务地址、模型和 API Key；包含 OpenAI、Anthropic、DeepSeek 预设。免费版可配置并测试连接。

审核授权 Key 只写入开发者后台私密审核备注，勿提交到公开仓库、截图或发布描述。正常使用无需账号。安装后点击工具栏图标打开侧栏；在设置 → 了解 Pro → 已有授权码？中粘贴审核授权码并激活。测试完成可在设置中解除本设备授权。

## 不变的公开链接

- 官网：https://wd9337812.github.io/tabtasks/
- 隐私政策：https://wd9337812.github.io/tabtasks/PRIVACY.html
- 支持：https://wd9337812.github.io/tabtasks/SUPPORT.html

更新包完成上传后，核对新版版本号、两种语言的图片、Pro 功能披露和隐私信息，然后提交审核。源码和官网更新不会自动更新 Chrome 商店。

## 此次新增披露

付款服务新增购买邮箱摘要、自动激活配对和可选验证码邮件；更新 PRIVACY.html 已说明。AI 按所选服务申请可选联网权限，支持两种兼容协议；用户主动使用时向其所选服务发送已披露任务快照。发布前按新版界面替换 Pro／设置相关截图。生产验收前阅读 worker/DEPLOY.md。
