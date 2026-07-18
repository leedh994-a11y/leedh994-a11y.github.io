/**
 * Sitp GPT — installation plan ($599 one-time) billing extension.
 * Merge into your existing Express billing routes (see server/README.md).
 */

export const INSTALLATION_PLAN = {
  id: "installation",
  name: "AI Installation Service",
  amount: 599,
  currency: "USD",
  cycle: "onetime",
  type: "one_time",
  description:
    "Sitp GPT AI customer support installation — enterprise training, widget setup, FAQ configuration, workflow optimization",
};

/** Add to existing PLANS map */
export function extendPlans(basePlans) {
  return {
    ...basePlans,
    [INSTALLATION_PLAN.id]: INSTALLATION_PLAN,
  };
}

export function isInstallationPlan(planId) {
  return planId === INSTALLATION_PLAN.id;
}

export function getCheckoutAmount(planId, cycle, addons = [], basePlans) {
  if (isInstallationPlan(planId)) {
    return { amount: INSTALLATION_PLAN.amount, planName: INSTALLATION_PLAN.name, cycle: "onetime" };
  }
  const plan = basePlans[planId];
  if (!plan) return null;
  let amount = cycle === "yearly" ? plan.yearly : plan.monthly;
  for (const addon of addons) {
    amount += cycle === "yearly" ? 468 : 39;
  }
  return { amount, planName: plan.name, cycle };
}

/**
 * Handle POST /api/billing/checkout for installation (one-time PayPal order).
 * Call from your existing checkout handler when planId === 'installation'.
 *
 * @param {object} deps - { email, createPayPalOrder, savePendingOrder }
 */
export async function handleInstallationCheckout({ email, createPayPalOrder, savePendingOrder }) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { success: false, error: "请输入有效邮箱" };
  }

  const order = await createPayPalOrder({
    amount: INSTALLATION_PLAN.amount,
    currency: INSTALLATION_PLAN.currency,
    description: INSTALLATION_PLAN.description,
    customId: `installation:${email}`,
  });

  if (savePendingOrder) {
    await savePendingOrder({
      orderId: order.orderId,
      email,
      planId: INSTALLATION_PLAN.id,
      cycle: "onetime",
      amount: INSTALLATION_PLAN.amount,
      type: "one_time",
      status: "pending",
    });
  }

  return {
    success: true,
    mode: "payment",
    orderId: order.orderId,
    approveUrl: order.approveUrl,
    amount: INSTALLATION_PLAN.amount,
    plan: INSTALLATION_PLAN.name,
    cycle: "onetime",
  };
}

/**
 * Handle POST /api/billing/activate after PayPal capture for installation.
 */
export async function handleInstallationActivate({ orderId, email, captureOrder, savePurchase, findPendingOrder }) {
  if (!orderId || !email) {
    return { success: false, error: "缺少参数" };
  }

  const capture = await captureOrder(orderId);
  if (!capture?.success) {
    return { success: false, error: capture?.error || "PayPal 扣款失败" };
  }

  const purchase = {
    id: `inst_${orderId}`,
    email,
    planId: INSTALLATION_PLAN.id,
    cycle: "onetime",
    type: "one_time",
    status: "paid",
    amount: INSTALLATION_PLAN.amount,
    currency: INSTALLATION_PLAN.currency,
    paypalOrderId: orderId,
    paidAt: new Date().toISOString(),
    includes: [
      "Enterprise AI training",
      "Website chatbot installation",
      "FAQ setup",
      "Support workflow optimization",
      "All paid plan features during setup",
    ],
  };

  if (savePurchase) await savePurchase(purchase);
  if (findPendingOrder) await findPendingOrder(orderId);

  return {
    success: true,
    purchase,
    redirectUrl: `/account.html?email=${encodeURIComponent(email)}&welcome=1&installation=1`,
  };
}
