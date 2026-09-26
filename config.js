// ============================================================
//  config.js  —  唯一的可调配置点（改动这里即可，其它文件不用动）
// ============================================================
//
//  ⚠️ 发布前一定要改 SECRET：
//     - 这是给 Pro License Key 做 HMAC 签名的密钥。
//     - 你签发密钥的 tools/keygen.mjs 必须用「同一个」SECRET。
//     - 换成任意长随机串，例如：openssl rand -hex 24
//
//  ⚠️ STRIPE_PAYMENT_LINK 填你自己的 Stripe 收款链接：
//     - Stripe Dashboard → Payment Links → 新建一个 +$X 的一次性付款链接
//     - 付款成功页/邮件里把 License Key 发给用户，用户粘贴回来激活即可。
//     - 零后端，全球收款。也可换成 Lemon Squeezy / Paddle / Gumroad。

const CONFIG = {
  SECRET: "CHANGE_ME__paste_a_long_random_secret_here",

  // Stripe 收款链接（结账页/成功页把密钥发给用户）
  STRIPE_PAYMENT_LINK: "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",

  // 免费 / Pro 功能门控
  FREE: {
    maxActiveTasks: 30,   // 免费可保留的最大未完成活动任务数
    maxLists: 2,          // 免费可创建的列表数
    tags: false,          // 标签（Pro）
    excerpt: false,       // 抓取正文摘要（Pro）
    export: false         // 导出/导入 JSON（Pro）
  },

  PRO: {
    maxActiveTasks: Infinity,
    maxLists: Infinity,
    tags: true,
    excerpt: true,
    export: true
  },

  DUE_ENABLED: true // 到期日免费可用
};
