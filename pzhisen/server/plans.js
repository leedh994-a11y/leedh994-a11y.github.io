/** Pro subscription — monthly $99 / annual $999 (CNY via bank transfer). */
export const CYCLES = {
  monthly: {
    id: "monthly",
    labelZh: "月付",
    labelEn: "Monthly",
    days: 30,
  },
  annual: {
    id: "annual",
    labelZh: "年付",
    labelEn: "Annual",
    days: 365,
  },
};

export const PLANS = {
  pro: {
    id: "pro",
    name: "Pro",
    nameZh: "专业版",
    description: "Full access to all features. Billed monthly or annually.",
    descriptionZh: "使用全部功能，按月或按年订阅。",
    features: [
      "All 6 AI agents",
      "Unlimited daily standups",
      "Unlimited agent chats",
      "Full dashboard access",
      "Renew monthly or annually",
    ],
    featuresZh: [
      "全部 6 个 AI Agent",
      "无限每日站会",
      "无限 Agent 对话",
      "完整 Dashboard 功能",
      "按月或按年续费使用",
    ],
    priceCny: { monthly: 699, annual: 6999 },
    priceUsd: { monthly: 99, annual: 999 },
    cycles: ["monthly", "annual"],
  },
};

export const DEFAULT_PLAN_ID = "pro";
export const DEFAULT_CYCLE = "monthly";

export function getPlan(planId) {
  return PLANS[planId] || PLANS.pro;
}

export function getCycle(cycle) {
  return CYCLES[cycle] || null;
}

export function isValidCycle(cycle) {
  return cycle === "monthly" || cycle === "annual";
}

export function listPlans() {
  return Object.values(PLANS);
}

export function getAmount(planId, cycle = DEFAULT_CYCLE, currency = "cny") {
  const plan = getPlan(planId);
  if (!plan || !isValidCycle(cycle)) return null;
  const isCny = currency === "cny";
  const prices = isCny ? plan.priceCny : plan.priceUsd;
  const amount = prices[cycle];
  if (amount == null) return null;
  return {
    amount,
    currency: isCny ? "CNY" : "USD",
    plan,
    cycle,
    cycleMeta: getCycle(cycle),
  };
}

export function formatPrice(planId, cycle, currency = "cny") {
  const info = getAmount(planId, cycle, currency);
  if (!info) return "—";
  const sym = currency === "cny" ? "¥" : "$";
  return `${sym}${info.amount}`;
}
