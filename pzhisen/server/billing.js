import { getPlan, listPlans, getAmount, isValidCycle, CYCLE_LABELS } from "./plans.js";
import {
  createPendingOrder,
  getOrder,
  updateOrder,
  activateSubscription,
  getSubscriptionByEmail,
  isSubscriptionActive,
  getOrders,
} from "./billing-store.js";
import { isPayPalConfigured, getPayPalPublicConfig, createPayPalOrder, capturePayPalOrder } from "./paypal.js";
import { isAdminAuthorized } from "./bank-transfer.js";
import { findCompanyByEmail } from "./store.js";

const PUBLIC_URL = process.env.PUBLIC_URL || "http://localhost:3000";

export function getBillingConfig() {
  return {
    success: true,
    providers: {
      paypal: isPayPalConfigured(),
      bankCard: false,
    },
    publicUrl: PUBLIC_URL,
    paypal: getPayPalPublicConfig(),
    bankAccount: null,
    noteZh: "月付 $99 或年付 $999，PayPal 支付后立即可用。订阅到期后需续费。",
    noteEn: "Monthly $99 or yearly $999 via PayPal — instant access while subscribed. Renew when your plan expires.",
  };
}

function activationPayload(email) {
  const company = findCompanyByEmail(email);
  return {
    companyId: company?.id || null,
    dashboardUrl: company ? `/dashboard.html?company=${company.id}` : "/dashboard.html",
  };
}

function cycleLabel(cycle, lang = "en") {
  const labels = CYCLE_LABELS[cycle];
  if (!labels) return cycle;
  return lang === "zh" ? labels.zh : labels.en;
}

export function getPlansHandler(_req, res) {
  res.json({ success: true, plans: listPlans() });
}

export function getSubscriptionStatus(req, res) {
  const email = (req.query.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ success: false, error: "Email required" });
  const sub = getSubscriptionByEmail(email);
  const active = isSubscriptionActive(email);
  res.json({ success: true, active, subscription: sub });
}

export async function checkoutHandler(req, res) {
  try {
    const { email, planId = "pro", cycle = "monthly", provider, method } = req.body || {};
    if (!email?.includes("@")) {
      return res.status(400).json({ success: false, error: "Valid email required" });
    }
    if (!isValidCycle(cycle)) {
      return res.status(400).json({ success: false, error: "Invalid cycle. Use monthly or yearly." });
    }
    const plan = getPlan(planId);
    if (!plan) return res.status(400).json({ success: false, error: "Invalid plan" });

    const payProvider = provider || method || "paypal";
    const returnUrl = `${PUBLIC_URL}/checkout-success.html?order=`;
    const cancelUrl = `${PUBLIC_URL}/checkout.html?plan=${planId}&cycle=${cycle}`;

    if (payProvider === "paypal") {
      if (!isPayPalConfigured()) {
        return res.status(503).json({ success: false, error: "PayPal not configured on server" });
      }
      const { amount, currency } = getAmount(planId, cycle, "usd");
      const order = createPendingOrder({
        email, planId, cycle, amount, currency, provider: "paypal",
      });
      const desc = `Pzhisen Pro — ${cycleLabel(cycle)} ($${amount})`;
      const pp = await createPayPalOrder({
        orderId: order.id,
        amount,
        currency,
        description: desc,
        returnUrl: returnUrl + order.id,
        cancelUrl,
      });
      updateOrder(order.id, { externalId: pp.paypalOrderId, approveUrl: pp.approveUrl });
      return res.json({
        success: true,
        orderId: order.id,
        provider: "paypal",
        approveUrl: pp.approveUrl,
        paypalOrderId: pp.paypalOrderId,
      });
    }

    if (payProvider === "bank" || payProvider === "bankcard") {
      return res.status(400).json({
        success: false,
        error: "Bank transfer is not available. Please pay with PayPal.",
      });
    }

    return res.status(400).json({
      success: false,
      error: "Invalid provider. Use PayPal.",
    });
  } catch (err) {
    console.error("checkout error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

export function confirmBankTransferHandler(req, res) {
  res.status(400).json({ success: false, error: "Bank transfer is not available. Please pay with PayPal." });
}

export function listPendingBankOrdersHandler(req, res) {
  const key = req.query.key || req.headers["x-admin-key"];
  if (!isAdminAuthorized(key)) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  const { orders } = getOrders();
  const pending = orders.filter((o) =>
    o.provider === "bankcard" && o.status === "awaiting_transfer"
  );
  res.json({ success: true, orders: pending });
}

export function approveBankOrderHandler(req, res) {
  const key = req.query.key || req.body?.key || req.headers["x-admin-key"];
  if (!isAdminAuthorized(key)) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  const { orderId } = req.body || {};
  const order = getOrder(orderId);
  if (!order) return res.status(404).json({ success: false, error: "Order not found" });

  if (order.status === "completed") {
    return res.json({ success: true, subscription: getSubscriptionByEmail(order.email) });
  }

  if (!isValidCycle(order.cycle)) {
    return res.status(400).json({ success: false, error: "Invalid order cycle" });
  }

  updateOrder(order.id, { status: "paid" });
  const sub = activateSubscription({
    email: order.email,
    planId: order.planId,
    cycle: order.cycle,
    provider: "bankcard",
    externalId: order.transferCode,
  });
  updateOrder(order.id, { status: "completed" });
  res.json({
    success: true,
    order: getOrder(order.id),
    subscription: sub,
    active: true,
    ...activationPayload(order.email),
  });
}

export async function capturePayPalHandler(req, res) {
  try {
    const { orderId, paypalOrderId } = req.body || {};
    const order = getOrder(orderId);
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });

    const ppId = paypalOrderId || order.externalId;
    const cap = await capturePayPalOrder(ppId);
    if (!cap.success) {
      return res.status(400).json({ success: false, error: "Payment not completed" });
    }

    updateOrder(order.id, { status: "paid", captureId: cap.captureId });
    const sub = activateSubscription({
      email: order.email,
      planId: order.planId,
      cycle: order.cycle,
      provider: "paypal",
      externalId: cap.captureId,
    });

    res.json({
      success: true,
      order: updateOrder(order.id, { status: "completed" }),
      subscription: sub,
      active: true,
      ...activationPayload(order.email),
    });
  } catch (err) {
    console.error("capture error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function orderStatusHandler(req, res) {
  const order = getOrder(req.params.orderId);
  if (!order) return res.status(404).json({ success: false, error: "Order not found" });

  if (order.status === "pending" && order.provider === "paypal" && order.externalId) {
    try {
      const cap = await capturePayPalOrder(order.externalId);
      if (cap.success) {
        updateOrder(order.id, { status: "paid", captureId: cap.captureId });
        const sub = activateSubscription({
          email: order.email,
          planId: order.planId,
          cycle: order.cycle,
          provider: "paypal",
          externalId: cap.captureId,
        });
        updateOrder(order.id, { status: "completed" });
        return res.json({
          success: true,
          order: getOrder(order.id),
          subscription: sub,
          active: true,
          ...activationPayload(order.email),
        });
      }
    } catch {
      /* still pending */
    }
  }

  const active = isSubscriptionActive(order.email);
  res.json({
    success: true,
    order,
    active,
    subscription: getSubscriptionByEmail(order.email),
    ...activationPayload(order.email),
  });
}
