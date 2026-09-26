# Cloudflare Worker 部署手册（付费闭环配置清单）

目标：`扩展购买按钮 → Worker /buy → Stripe 结账 → 成功页自动展示 License Key → 粘贴激活`

## 需要配置的参数（共 4 处，务必两两一致）

| # | 位置 | 参数 | 填什么 |
|---|------|------|--------|
| 1 | Worker secret | `LIC_SECRET` | 随机长串，如 `openssl rand -hex 24` 的输出 |
| 2 | Worker vars（wrangler.toml） | `STRIPE_PAYMENT_LINK` | Stripe Payment Link 完整 URL |
| 3 | Stripe 后台（Payment Link → Confirmation page） | Success URL | `https://<你的worker域名>/success?sid={CHECKOUT_SESSION_ID}` |
| 4 | 扩展 config.js | `SECRET` / `STRIPE_PAYMENT_LINK` | = 参数1 / = `https://<你的worker域名>/buy` |

> 一致性规则：**1 = 4 的 SECRET**（否则验签失败）；**3 的域名 = 部署后实际域名**。

## 步骤

### A. Stripe（约 3 分钟）
1. https://dashboard.stripe.com → **Payment links** → + Create a payment link
2. 选/建一个 One-time 产品，价格 $6 → 创建
   - ✅ **一个链接可无限次复用**（官方文档：可被多个客户重复付款；
     别勾选 "Limit the number of payments" 这个可选限购开关即可）
3. 编辑该链接 → *After payment* → 选 **Take customers to a custom URL**，填：
   `https://<worker域名>/success?sid={CHECKOUT_SESSION_ID}`
   - 若你的 Stripe 界面不支持该占位符，直接填 `https://<worker域名>/success` 也可以——
     Payment Link 会自动在 URL 后追加 `?reference=cs_xxx`，Worker 两种参数都认
4. 复制 Payment Link URL → 填 wrangler.toml 的参数 2

### B. Cloudflare Worker（约 3 分钟）
```bash
cd worker
npm login --scope=whatever 2>/dev/null   # 不需要，npx 直接可用
npx wrangler login          # 弹出浏览器授权你的 CF 账号（免费账号即可）
npx wrangler secret put LIC_SECRET        # 粘贴参数 1 生成的随机串
npx wrangler deploy
```
部署完输出 `https://tabtasks-pro-api.<你的子域>.workers.dev` —— 这就是 `<worker域名>`。

### C. 回填两处域名
1. Stripe Payment Link 的 Success URL 改成真实 worker 域名（A-3）
2. 扩展 `config.js`：
```js
SECRET: "<参数1>",
STRIPE_PAYMENT_LINK: "https://<worker域名>/buy",
```
3. `chrome://extensions` 重载扩展

### D. 端到端验证（2 分钟）
1. 浏览器开 `https://<worker域名>/health` → 应返回 `ok`
2. 扩展点「购买 Pro」→ 到 Stripe 结账页
3. 用测试卡 `4242 4242 4242 4242` / 任意未来日期 / CVC `123` 付款
   （测试模式 Payment Link 可用测试卡；正式收款需在 Settings 激活真实账户并 Live 模式重建链接）
4. 成功页出现 `✅ 付款成功` + License Key → 复制
5. 扩展 ⚙ 粘贴 → 激活 → 角标变 PRO、标签/摘要/导出解锁
6. 同浏览器再访问成功页刷新 → Key 不变（确定性派生）；换个 sid 的 Key 不通用

## 常见问题
- **激活提示「Key 格式不对」**：粘贴时带了空格/换行？或 config.js 的 SECRET 和 Worker 的 LIC_SECRET 不一致
- **成功页提示未找到付款编号**：Stripe Success URL 没带 `?sid={CHECKOUT_SESSION_ID}`
- **收不到钱/要实名**：Stripe 账户完成入驻（中国大陆可用境外主体/香港公司收款，个人常见替代是 Lemon Squeezy/Paddle，Worker 方案不变，只换 Payment Link）
- **CF 免费额度**：Workers free plan 10 万请求/天，本 Worker 每次购买只产生 2-3 个请求
