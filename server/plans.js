/** Sitp GPT pricing — matches checkout.js */
export const PLANS = {
  starter: {
    id: "starter",
    name: "Starter",
    monthly: 39,
    yearly: 468,
  },
  growth: {
    id: "growth",
    name: "Growth",
    monthly: 79,
    yearly: 948,
  },
  scale: {
    id: "scale",
    name: "Scale",
    monthly: 259,
    yearly: 3108,
  },
  installation: {
    id: "installation",
    name: "AI Installation Service",
    onetime: 599,
  },
};

export const TRIAL_DAYS = 7;

export function getPlan(planId) {
  return PLANS[planId] || null;
}

export function isValidCycle(cycle) {
  return cycle === "monthly" || cycle === "yearly" || cycle === "onetime";
}

export function getAmount(planId, cycle) {
  const plan = getPlan(planId);
  if (!plan) return null;
  if (planId === "installation" || cycle === "onetime") {
    return { amount: plan.onetime, currency: "USD", plan, cycle: "onetime" };
  }
  const amount = cycle === "yearly" ? plan.yearly : plan.monthly;
  if (amount == null) return null;
  return { amount, currency: "USD", plan, cycle };
}

export function listPlans() {
  return Object.values(PLANS);
}
