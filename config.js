// ============================================================
//  config.js  —  唯一的可调配置点（改动这里即可，其它文件不用动）
// ============================================================
//
//  ⚠️ 首次发布请配置 SECRET；已发布产品更新时必须保留原值：
//     - 这是给 Pro License Key 做 HMAC 签名的密钥。
//     - 你签发密钥的 tools/keygen.mjs 必须用「同一个」SECRET。
//     - 首次配置可生成长随机串；不要因更新版本而轮换，否则旧 Key 会失效。
//
//  ⚠️ STRIPE_PAYMENT_LINK 填你自己的 Stripe 收款链接：
//     - Stripe Dashboard → Payment Links → 新建一个 +$X 的一次性付款链接
//     - 付款成功页/邮件里把 License Key 发给用户，用户粘贴回来激活即可。
//     - 目前通过 Worker 核验订单并签发 Key，付款链接指向 Worker 的 /buy。

const CONFIG = {
  SECRET: "CHANGE_ME__paste_a_long_random_secret_here",

  // Stripe 收款链接（结账页/成功页把密钥发给用户）
  STRIPE_PAYMENT_LINK: "https://tabtasks-pro-api.wd933781.workers.dev/buy",

  // 免费 / Pro 功能门控
  FREE: {
    maxActiveTasks: 30,   // 免费可保留的最大未完成活动任务数
    maxLists: 2,          // 免费可创建的列表数
    tags: false,          // 标签（Pro）
    excerpt: false,       // 抓取正文摘要（Pro）
    ai: false,
    export: false         // 导出/导入 JSON（Pro）
  },

  PRO: {
    maxActiveTasks: Infinity,
    maxLists: Infinity,
    tags: true,
    excerpt: true,
    export: true,
    ai: true
  },

  DUE_ENABLED: true // 到期日免费可用
};
