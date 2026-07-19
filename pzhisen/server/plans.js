/** Subscription plans — prices in USD (PayPal) and CNY (WeChat / Alipay). */
export const PLANS = {
  pro: {
    id: "pro",
    name: "Pro",
    nameZh: "专业版",
    description: "Unlimited AI agent runs, daily standups, priority models",
    descriptionZh: "无限 AI Agent 运行、每日站会、优先模型",
    features: [
      "All 6 AI agents",
      "Unlimited daily standups",
      "Priority OpenRouter models",
      "Email support",
    ],
    featuresZh: ["全部 6 个 AI Agent", "无限每日站会", "优先 AI 模型", "邮件支持"],
    priceUsd: { monthly: 29, yearly: 290 },
    priceCny: { monthly: 199, yearly: 1990 },
    trialDays: 7,
  },
  team: {
    id: "team",
    name: "Team",
    nameZh: "团队版",
    description: "Everything in Pro + multi-seat & API access",
    descriptionZh: "专业版全部功能 + 多席位与 API",
    features: [
      "Everything in Pro",
      "Up to 5 team seats",
      "API access",
      "Dedicated support",
    ],
    featuresZh: ["专业版全部功能", "最多 5 个席位", "API 访问", "专属客服"],
    priceUsd: { monthly: 79, yearly: 790 },
    priceCny: { monthly: 499, yearly: 4990 },
    trialDays: 7,
  },
};

export function getPlan(planId) {
  return PLANS[planId] || null;
}

export function listPlans() {
  return Object.values(PLANS);
}

export function getAmount(planId, cycle, currency = "usd") {
  const plan = getPlan(planId);
  if (!plan) return null;
  const key = currency === "cny" ? "priceCny" : "priceUsd";
  const amount = plan[key]?.[cycle];
  if (amount == null) return null;
  return { amount, currency: currency === "cny" ? "CNY" : "USD", plan, cycle };
}
