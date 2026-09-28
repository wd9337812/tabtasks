# Chrome 应用商店上架操作指南（TabTasks）v2

> 面向零基础。对照开发者后台左侧 4 个标签页逐屏填写，所有英文文案可直接粘贴。
> 依据：Google 官方 [cws-dashboard-privacy](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)、
> [best-listing](https://developer.chrome.com/docs/webstore/best-listing)、
> [program-policies](https://developer.chrome.com/docs/webstore/program-policies)。
> 审核时长：新账号首次 1~5 天常见。v0.2.0 已移除 `<all_urls>`，不再触发"发布将被推迟"黄条。

---

## 0. 准备材料（已全部做好 ✅）

| 材料 | 规格（商店硬性要求） | 位置 |
|------|---------------------|------|
| 代码包 zip | manifest 合法、description ≤132 | `5b75f644/tabtasks-extension-store.zip` |
| 屏幕截图 | **必须 1280x800 或 640x400**，JPEG 或 24 位 PNG（无 alpha），1~5 张 | `5b75f644/store-images/shot-pro.jpg` / `shot-free.jpg` / `shot-paywall.jpg` |
| 小型宣传图块 | 440x280，**可选**但建议传 | `5b75f644/store-images/tile-small.jpg` |
| 顶部宣传图块 | 1400x560，可选（用于商店横幅位） | `5b75f644/store-images/tile-top.jpg` |
| **商店图标（必填）** | **正好 128x128 的 PNG**。⚠️ 包内 `icons/` 不等于表单：「图片资源」屏要单独上传一张，传错尺寸会报「错误：图片尺寸不正确」 | `5b75f644/store-images/store-icon-128.png`（无 alpha 兜底：`store-icon-128-rgb.png`） |
| 隐私政策 URL | 公开可访问、无登录墙 | `https://wd9337812.github.io/tabtasks/PRIVACY.html`（需先开 GitHub Pages，见 §2） |
| 支持页面 URL | 建议填 | `https://wd9337812.github.io/tabtasks/SUPPORT.html` |

> ⚠️ 之前"previews/ 里 380x780 可用"的说法是错的，商店只收 1280x800 / 640x400 两种，
> 这就是"图片尺寸不正确"报错的原因。现在 store-images/ 里这批全部合规。

---

## 1. 注册开发者账号（一次性 $5）

chrome.google.com/webstore/devconsole → 登录 → 付 $5 → 同意协议。
$5 是 Google 收的，与 Stripe/Cloudflare 无关。

---

## 2. 开启 GitHub Pages（30 秒，只做一次）

https://github.com/wd9337812/tabtasks/settings/pages →
Source 选 **Deploy from a branch** → 分支 **main** + 文件夹 **/docs** → Save。
约 1 分钟后打开下面两个 URL 能看到页面即成功（隐私政策、支持页都依赖它）：

```
https://wd9337812.github.io/tabtasks/PRIVACY.html
https://wd9337812.github.io/tabtasks/SUPPORT.html
```

---

## 3. 后台标签页 ①「软件包」

上传 `tabtasks-extension-store.zip`。manifest 的 description 已缩到 115 字符（上限 132），
上传后此页应无红字。有红字就截图发我。

---

## 4. 后台标签页 ②「商店信息」

**名称（≤128 字符）**

```
TabTasks: Sidebar To-Do & Page Collector
```

**简短说明（≤132 字符）**

```
Turn any web page into a to-do in one click. A lightweight sidebar task collector with lists, due dates & local storage.
```

**详细描述**（官方建议：首句直给、要点列表、不堆关键词、不蹭别家品牌词）

```
TabTasks puts a to-do list in your browser's side panel — next to the pages you're actually reading.

ONE-CLICK PAGE CAPTURE
Browsing something you need to act on later? Click "Collect current page" (or press Alt+Shift+T) and TabTasks saves the page title + link as a task. No more losing tabs you meant to deal with.

MADE FOR FOCUS
• Side panel — your tasks live beside your work, not in another tab
• Lists & due dates — organize captures into Inbox / Today / Reading
• Quick add — type a task, hit Enter, done
• Notes & one-level subtasks — break a capture into steps without leaving the panel
• Right-click any selected text → "Collect selection as task"; the selection is kept as the task note
• Export due dates as an .ics file and open it in Google / Outlook / Apple Calendar
• 100% local — everything stays in your browser, zero accounts, zero tracking

PRO (one-time, lifetime license)
• Unlimited active tasks & lists (free: 30 tasks / 2 lists)
• Tags for cross-list topics
• Auto-extract a page summary when capturing
• Export / import backup
• AI assistant, bring your own OpenAI key: describe changes in plain language, preview the proposed edits, apply them with one click

Privacy: all data is stored locally via chrome.storage. The extension itself runs no servers, no analytics and collects no personal data. The optional AI assistant is off by default; if you enable it with your own OpenAI API key, only the text you choose to send goes to api.openai.com under your key. Purchasing the optional Pro license is handled entirely on Stripe's hosted checkout.

Support: https://wd9337812.github.io/tabtasks/SUPPORT.html
```

**其余字段**
- 类别：**Productivity / 生产力**
- 语言：默认 English；界面含中文，可点"添加语言"再传一份中文文案（不强制）
- 屏幕截图：传 store-images/ 三张（建议顺序 paywall → pro → free，付费转化位放第一）
- 宣传图块：tile-small.jpg、tile-top.jpg（可选，建议都传）
- 其他字段：首页网址 `https://wd9337812.github.io/tabtasks/`；
  支持信息页面网址 `https://wd9337812.github.io/tabtasks/SUPPORT.html`；
  成人内容：关
- 可见性：**公开**（或先"不公开"拿链接自测，测完再切公开）

---

## 5. 后台标签页 ③「隐私」——本次报错的重灾区，逐格照抄

### 5.1 单一用途声明

```
Capture the page the user is viewing as a to-do task and manage local task lists in the browser side panel.
```

### 5.2 需请求权限的理由（每个权限一格，英文，勿中英混排）

> 官方要求：逐条说明"这个权限对应哪个具体功能"。写错格子（把 tabs 的理由填进
> storage）会被视为披露不实 → 拒审。以下六格一一对应，直接复制；
> 若表单额外出现「可选主机权限」格（来自 optional_permissions 的 api.openai.com），
> 再补最后那一格。

**storage**

```
chrome.storage.local is the extension's only persistence layer: it saves the user's task lists, note text, subtasks, due dates, tags and a pasted License Key on the device so tasks survive browser restarts. Nothing stored is ever transmitted off the device.
```

**activeTab**

```
Grants one-time access to the tab that is active when the user clicks the toolbar icon or presses Alt+Shift+T. This is how TabTasks reads the page for "collect current page" and, for Pro users, extracts an optional text excerpt via scripting. No broad host access is requested.
```

**scripting**

```
Only under the activeTab grant above, chrome.scripting.executeScript runs one small read-only function in that single tab to get the document title and, for Pro users who enabled it, a short excerpt (meta description or current selection). It never runs on other tabs, never modifies pages, never reads forms, cookies or credentials, and its result is only written to local storage.
```

**sidePanel**

```
The sidebar opened via chrome.sidePanel is the extension's entire UI — where the user views, completes and organizes tasks. Without it there is nowhere to show the to-do list.
```

**tabs**

```
Reads the active tab's title and URL to build each captured task (a task is just title + link, so no page access is needed for the core flow), and listens for tab updates so the sidebar badge stays accurate. The extension does not read browsing history and does not enumerate or track other tabs.
```

**contextMenus**

```
Adds a single right-click entry, "Collect selection as task", shown only when the user selects text on a page. Choosing it saves the selected text as the note of a new task in the side panel. No other menu items are added and the permission is not used for anything else.
```

**可选主机权限 https://api.openai.com/*（仅当表单出现该格时填）**

```
Declared as an optional host permission and requested at runtime only when a Pro user turns on the optional AI assistant and pastes their own OpenAI API key. It allows the extension to send the user's own task text to the OpenAI chat completions endpoint and receive proposed edits, which are shown as a preview and applied only after an explicit click. Without the user's key the permission is never requested and no network call is made.
```

> v0.2.0 起已按 Google 官方建议**移除 `<all_urls>` 主机权限**，改用 activeTab：
> 表单里不会再出现「需请求主机权限的理由」这一格；之前那条"发布将被推迟/深入审核"
> 的黄条也会消失，审核速度显著加快。核心捕获（标题+链接）在任何网站照常工作；
> 仅 Pro 的"正文摘要"要求在点击工具栏图标或按 Alt+Shift+T 后的那个标签页里生效
> （拿不到摘要时自动降级为只存标题+链接，不报错）。

### 5.3 远程代码

选 **「不，我并未使用远程代码」**。

事实依据：所有 JS（background/sidepanel/license/config.js）都打在包里；
License 校验是本地 HMAC 计算，不下载、不执行任何外部脚本。
购买时打开的 Cloudflare Worker / Stripe 页面是普通网页跳转，不属于扩展内执行远程代码。
⚠️ 这一项若误选"是"，必须提供技术理由且大概率被拒——我们没有任何远程代码，如实选"不"。

### 5.4 数据使用（收集声明）

TabTasks 所有处理都在本机完成，扩展不向开发者服务器或第三方传输任何用户数据
（购买流程发生在 Stripe 托管页，由 Stripe 处理，扩展本身不经手）。因此：

- 上面的数据类型清单（个人身份/财务/网络记录/网站内容…）：**全部不勾**
- 勾选列表末尾的 **「我的扩展程序不会收集任何用户数据」**（如有此选项）
- 「我确认下列披露信息均属实」三条：**全部勾上**（这是政策硬性要求）

> 若表单不允许勾"不收集"（个别账号 AB 测试），只勾「网站内容」并说明
> "captured page title/URL, stored locally only, never transmitted"——但大概率用不到。

> AI 助手不影响上面的勾法：它是**用户主动开启 + 用户自己的 Key**，扩展开发者
> 不经手、不存储任何请求内容，因此仍属"开发者不收集数据"。若审核员追问，
> 用 §5.2 最后那格可选主机权限的理由原文回复即可。

### 5.5 隐私权政策网址

```
https://wd9337812.github.io/tabtasks/PRIVACY.html
```

必须已按 §2 开启 Pages 且能公开打开。商店会核对政策内容与你的声明是否一致，
我们的 PRIVACY.html 已如实写明"仅本地存储、扩展不收集、Stripe 处理支付"。

---

## 6. 后台标签页 ④「分发」

- 类别：生产力（与 §4 一致）
- 地区：**所有国家/地区**（Stripe 全球收款，无需限制）
- 定价：**免费**
- 语言：默认英语

> 合规：商店内免费 + 扩展内链到自家 Stripe 卖 License 是主流做法（Grammarly、Loom 同款）。
> 商店文案里不要出现促销性价格词堆砌，我们的详述只陈述功能与一次性授权事实，合规。

---

## 7. 提交与审核后

1. 右上角「保存草稿」→ 无红字后「提请审核」
2. 状态 Pending → Live（首次 1~5 天常见）
3. 通过后拿到 `https://chromewebstore.google.com/detail/<slug>/<id>`，发我，我把落地页 "Add to Chrome" 按钮换上
4. 立刻做：README 挂链接 → Product Hunt / V2EX / X 拉首批用户评价（前 10 条评论决定搜索转化）

---

## 8. 常见拒审原因自查（官方口径 + 社区统计）

| 拒审原因 | 我们的状态 |
|----------|-----------|
| 权限理由为空/含糊/与功能对不上 | §5.2 五格逐一对应，具体到触发时机 |
| 请求超出单一用途的权限 | 六项权限全部服务于"捕获当前页为任务/管理本地任务"，已去掉 <all_urls>；openai 主机仅为可选权限 |
| 披露与隐私政策矛盾 | 政策页、数据声明、代码行为三者一致（全本地） |
| 执行远程代码未申报 | 无远程代码，如实申报"不" |
| 截图尺寸不符 | store-images/ 全部 1280x800 JPEG 无 alpha |
| 蹭品牌词/关键词堆砌 | 文案无竞品名、无重复堆词 |
| 功能过于单薄 | 列表/标签/到期日/导出/门控完整 |

---

### 卡住了怎么办

后台任何红字/黄条，原样截图发我。改文案不用重新传包，保存草稿再提审即可。
