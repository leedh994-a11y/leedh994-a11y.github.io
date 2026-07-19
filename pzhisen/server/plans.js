/** Single lifetime plan — ¥1 one-time payment for permanent access. */
export const PLANS = {
  lifetime: {
    id: "lifetime",
    name: "Lifetime",
    nameZh: "终身版",
    description: "Pay once (¥1), use all features forever.",
    descriptionZh: "仅需支付 1 元，永久使用全部功能。",
    features: [
      "All 6 AI agents",
      "Unlimited daily standups",
      "Unlimited agent chats",
      "Full dashboard access",
      "Lifetime access — pay once",
    ],
    featuresZh: [
      "全部 6 个 AI Agent",
      "无限每日站会",
      "无限 Agent 对话",
      "完整 Dashboard 功能",
      "一次付费，终身使用",
    ],
    priceCny: { lifetime: 1 },
    priceUsd: { lifetime: 1 },
    lifetime: true,
  },
};

export function getPlan(planId) {
  return PLANS[planId] || PLANS.lifetime;
}

export function isValidCycle(cycle) {
  return cycle === "lifetime";
}

export function listPlans() {
  return [PLANS.lifetime];
}

export function getAmount(planId, cycle = "lifetime", currency = "cny") {
  const plan = getPlan(planId);
  if (!plan || !isValidCycle(cycle)) return null;
  const isCny = currency === "cny";
  const amount = isCny ? plan.priceCny.lifetime : plan.priceUsd.lifetime;
  return {
    amount,
    currency: isCny ? "CNY" : "USD",
    plan,
    cycle: "lifetime",
  };
}
