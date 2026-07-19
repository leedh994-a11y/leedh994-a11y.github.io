/** Single plan — free forever, all features included. */
export const PLANS = {
  free: {
    id: "free",
    name: "Free Forever",
    nameZh: "永久免费",
    description: "All features. No payment. Lifetime access for everyone.",
    descriptionZh: "全部功能永久免费，无需付款，终身使用。",
    features: [
      "All 6 AI agents",
      "Unlimited daily standups",
      "Unlimited agent chats",
      "Full dashboard access",
      "Lifetime access — $0 forever",
    ],
    featuresZh: [
      "全部 6 个 AI Agent",
      "无限每日站会",
      "无限 Agent 对话",
      "完整 Dashboard 功能",
      "永久免费 — 终身 $0",
    ],
    priceUsd: { monthly: 0, yearly: 0 },
    priceCny: { monthly: 0, yearly: 0 },
    free: true,
    lifetime: true,
  },
};

export function getPlan(planId) {
  return PLANS[planId] || PLANS.free;
}

export function listPlans() {
  return [PLANS.free];
}

export function getAmount() {
  return { amount: 0, currency: "USD", plan: PLANS.free, cycle: "lifetime" };
}
