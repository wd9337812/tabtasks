# Chrome 应用商店上架操作指南（TabTasks）

> 面向零基础。全程约 1~2 小时（不含 Google 审核等待）。
> 审核时长：首次上架的开发者账号通常 1~5 天，之后更新一般几小时~1 天。

---

## 0. 准备材料清单（先凑齐再开工，5 分钟）

| 材料 | 我们的现状 | 位置 |
|------|-----------|------|
| 扩展代码包 zip | ✅ 已打好 | `5b75f644/tabbtasks-extension-store.zip`（上传商店用这个，**不含**开发文件） |
| 图标 128×128 | ✅ 已有 | 已在 zip 内；商店表单还要单独传一张 |
| 截图 ≥2 张（建议 640×400 以上） | ✅ 已有 3 张 | `side-task-collector/previews/`（pro / free / paywall） |
| 简短描述（≤132 字符） | ✅ 见下文 §3 文案 | 直接复制 |
| 详细描述（≤16000 字符） | ✅ 见下文 §3 文案 | 直接复制 |
| 隐私政策 URL | ✅ 页面已写好，开 Pages 即得 | 见 §2（30 秒 3 次点击） |
| Google 账号 + 银行卡 | 你本人准备 | 注册开发者账号要 $5 |

> 截图尺寸不够？商店允许 128×128 ~ 3840×2160，我们的 380×780 可用；
> 想要更漂亮可以在扩展目录跑：
> `chrome --headless=new --window-size=1280,800 --screenshot=big.png "file:///…/sidepanel.html?demo=pro"`
> 再截图裁剪侧栏区域。

---

## 1. 注册 Chrome 开发者账号（一次性 $5）

1. 打开 https://chrome.google.com/webstore/devconsole
2. 用任意 Google 账号登录 → 提示支付 **$5 一次性注册费**（Visa/Master 信用卡）
   - 国内可用：双币信用卡、或 WildCard/OneKey 等虚拟卡
   - 需要能正常访问 google.com 的网络环境
3. 同意开发者协议 → 完成。此页面即"开发者后台"。

> ⚠️ 注意：这个 $5 是 Google 收的，跟 Stripe/Cloudflare 无关，全行业就这一笔固定成本。

---

## 2. 隐私政策 URL（已备好 ✅）

- **页面已写好**：`docs/PRIVACY.html`（中英双语，如实声明"数据仅本地存储、不收集"）
- **只差开启 GitHub Pages（30 秒，3 次点击）**：
  打开 https://github.com/wd9337812/tabtasks/settings/pages →
  Source 选 **Deploy from a branch** → Branch 选 **main**、文件夹选 **/docs** → Save
- 约 1 分钟后生效，商店里填这个 URL：

```
https://wd9337812.github.io/tabtasks/PRIVACY.html
```

- 验证：浏览器打开上面链接能看到页面即成功（首次可能慢几十秒）。

---

## 3. 商店文案（已按搜索关键词优化，直接复制）

**名称（≤75 字符）**

```
TabTasks: Sidebar To-Do & Page Collector
```

**简短描述（≤132 字符）**

```
Turn any web page into a to-do in one click. A lightweight sidebar task collector with lists, due dates & local storage.
```

**详细描述（要点已埋入搜索词：sidebar to-do / task manager / read later / capture page）**

```
TabTasks puts a to-do list in your browser's side panel — next to the pages you're actually reading.

ONE-CLICK PAGE CAPTURE
Browsing something you need to act on later? Click "Capture current page" (or press Alt+Shift+T) and TabTasks saves the page title + link as a task. No more losing tabs you meant to deal with.

MADE FOR FOCUS
• Side panel — your tasks live beside your work, not in another tab
• Lists & due dates — organize captures into Inbox / Today / Reading
• Quick add — type a task, hit Enter, done
• 100% local — everything stays in your browser, zero accounts, zero tracking

PRO (one-time, lifetime license)
• Unlimited active tasks & lists (free: 30 tasks / 2 lists)
• Tags for cross-list topics
• Auto-extract a page summary when capturing
• Export / import backup

Privacy: TabTasks stores all data locally via chrome.storage. No servers, no analytics, no personal data collection.

Questions? Reach us via the website link below.
```

**类别**：Productivity（生产力）　**语言**：简体中文 + English（界面是中文，两处都填上更稳）

---

## 4. 后台逐项填写（New Item → Upload）

1. devconsole → **New item** → 上传 `tabtasks-extension-store.zip`
2. **Store listing** 标签页：
   - 名称/简述/详述 → 粘贴 §3 文案
   - 上传 5 张以内截图（用 previews/ 三张）+ 1 张图标（icons/icon-128.png）
   - 支持网站 → 填你的 GitHub 仓库地址（或以后换成官网）
   - **Store listing 全语言填完后，把 Visibility 选 Public**
3. **Permission** 标签页：系统会从 manifest 自动读出
   `storage / activeTab / scripting / sidePanel / tabs` + `<all_urls>`。
   商店要求为每个权限写理由（Justification），照抄：
   - *Read your browsing history / tabs*：用于定位当前标签页以便一键收集为任务
   - *Insert or remove content / run scripts*：用于抓取当前页标题与所选文字生成任务内容
   - *Display notifications（如有）*：未使用
4. **Privacy** 标签页：
   - Single purpose（单一用途声明）：
     `Capture web pages as tasks and manage a local to-do list in the browser side panel.`
   - Data access：勾选 **不用于远端传输、不共享**（数据全在本地）
   - Limited use 无需勾选（我们没有收集行为）
   - 填入 §2 准备好的隐私政策 URL
5. 定价：**Free**（Pro 走自己网站收款，见 §6 合规说明）
6. 全部保存 → 状态切到 **Submit for review**

---

## 5. 审核与发布后

- 提交后状态 *Pending* → *Live*（首次 1~5 天常见）
- 上架前**先别在扩展里点「购买 Pro」**测试——商店版 config.js 里 Stripe 链接要已配置好
- 拿到链接：`https://chromewebstore.google.com/detail/<slug>/<id>`
- 建议立刻做：
  1. 把链接挂到 GitHub README 顶部
  2. 发 Product Hunt / V2EX / 即刻 / X 拉首批评价（前 10 条评论决定搜索转化）
  3. 后台盯 Statistics 的 *Installed / Uninstalled*，卸载率高先查权限理由文案

---

## 6. 合规提醒（重要，避免下架）

1. **收款走外链是主流做法**（Grammarly、Loom 均如此）：商店内免费 + 官网 Stripe 卖
   License Key，**不要**在商店描述里放价格促销词，只放"Pro 功能说明 + 官网链接"。
2. 描述里**不要**蹭别家品牌词（"2-b.ai alternative"这种放自己博客，别放商店文案）。
3. 权限最小化原则：我们用了 `<all_urls>`（为任意网页捕获），Justification 必须如实、
   具体，这是机审+人审最容易卡的点。
4. 更新版本 = 后台上传新 zip + 版本号 +0.0.1，重新提交审核。

---

## 7. 自然流量优化（上架后慢慢做）

- 名称/描述每半年根据商店搜索词微调一次（工具：Rankify、Extension Manager 查关键词）
- 核心词：`to-do sidebar`、`capture page`、`read later`、`task manager`、`bookmark organizer`
- 尽快积累 15+ 条五星评价（搜索排序权重最大项之一）
- 做一张 16:9 宣传视频截帧放商店（可用本扩展录屏演示，免费工具 Screen Studio 平替：OBS）

---

### 卡住了怎么办

按顺序检查：zip 是否用了 `tabtasks-extension-store.zip`（不是 repo zip）→ 权限理由是否为空
→ 隐私政策 URL 是否可公开访问 → 商店文案是否含"buy/购买/价格"等促销词。
仍报错就把后台红字截图发给我。
