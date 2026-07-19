/** Pro plan — monthly ($99) or yearly ($999) subscription. */
export const PLANS = {
  pro: {
    id: "pro",
    name: "Pro",
    nameZh: "专业版",
    description: "Full access to all features while your subscription is active.",
    descriptionZh: "订阅有效期内可使用全部功能。",
    features: [
      "All 6 AI agents",
      "Unlimited daily standups",
      "Unlimited agent chats",
      "Full dashboard access",
      "Cancel anytime — access until period ends",
    ],
    featuresZh: [
      "全部 6 个 AI Agent",
      "无限每日站会",
      "无限 Agent 对话",
      "完整 Dashboard 功能",
      "按订阅周期使用，到期需续费",
    ],
    priceUsd: { monthly: 99, yearly: 999 },
    priceCny: { monthly: 699, yearly: 6999 },
  },
};

export const CYCLE_LABELS = {
  monthly: { en: "Monthly", zh: "月付", suffix: "/ month" },
  yearly: { en: "Yearly", zh: "年付", suffix: "/ year" },
};

export function getPlan(planId) {
  return PLANS[planId] || PLANS.pro;
}

export function isValidCycle(cycle) {
  return cycle === "monthly" || cycle === "yearly";
}

export function listPlans() {
  const plan = PLANS.pro;
  return [
    {
      ...plan,
      cycle: "monthly",
      amount: plan.priceUsd.monthly,
      amountCny: plan.priceCny.monthly,
      priceLabel: "$99",
      priceLabelCny: "¥699",
      periodLabel: "/ month",
      periodLabelZh: "/ 月",
    },
    {
      ...plan,
      cycle: "yearly",
      amount: plan.priceUsd.yearly,
      amountCny: plan.priceCny.yearly,
      priceLabel: "$999",
      priceLabelCny: "¥6999",
      periodLabel: "/ year",
      periodLabelZh: "/ 年",
      featured: true,
      savings: "Save $189 vs monthly",
      savingsZh: "比月付节省 ¥1299",
    },
  ];
}

export function getAmount(planId, cycle = "monthly", currency = "usd") {
  const plan = getPlan(planId);
  if (!plan || !isValidCycle(cycle)) return null;
  const isCny = currency === "cny";
  const amount = isCny ? plan.priceCny[cycle] : plan.priceUsd[cycle];
  if (amount == null) return null;
  return {
    amount,
    currency: isCny ? "CNY" : "USD",
    plan,
    cycle,
  };
}
