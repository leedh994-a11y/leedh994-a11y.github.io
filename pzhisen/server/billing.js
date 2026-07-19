import { getPlan, listPlans, getAmount } from "./plans.js";
import {
  createPendingOrder,
  getOrder,
  updateOrder,
  activateSubscription,
  getSubscriptionByEmail,
  isSubscriptionActive,
  subscriptionDaysForCycle,
} from "./billing-store.js";
import { isPayPalConfigured, getPayPalPublicConfig, createPayPalOrder, capturePayPalOrder } from "./paypal.js";

const PUBLIC_URL = process.env.PUBLIC_URL || "http://localhost:3000";

export function getBillingConfig() {
  return {
    success: true,
    providers: {
      paypal: isPayPalConfigured(),
    },
    publicUrl: PUBLIC_URL,
    paypal: getPayPalPublicConfig(),
    noteEn: "Pay securely with PayPal — credit card or PayPal balance.",
    noteZh: "使用 PayPal 安全付款 — 支持信用卡或 PayPal 余额。",
  };
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
    const { email, planId, cycle = "monthly", provider } = req.body || {};
    if (!email?.includes("@")) {
      return res.status(400).json({ success: false, error: "Valid email required" });
    }
    const plan = getPlan(planId);
    if (!plan) return res.status(400).json({ success: false, error: "Invalid plan" });
    if (!["monthly", "yearly"].includes(cycle)) {
      return res.status(400).json({ success: false, error: "Invalid billing cycle" });
    }

    const payProvider = provider || "paypal";
    if (payProvider !== "paypal") {
      return res.status(400).json({ success: false, error: "Only PayPal is supported" });
    }
    if (!isPayPalConfigured()) {
      return res.status(503).json({ success: false, error: "PayPal not configured on server" });
    }

    const returnUrl = `${PUBLIC_URL}/checkout-success.html?order=`;
    const cancelUrl = `${PUBLIC_URL}/checkout.html?plan=${planId}&cycle=${cycle}`;
    const { amount, currency } = getAmount(planId, cycle, "usd");
    const order = createPendingOrder({
      email, planId, cycle, amount, currency, provider: "paypal",
    });
    const desc = `Pzhisen ${plan.name} (${cycle})`;
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
  } catch (err) {
    console.error("checkout error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
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
    const days = subscriptionDaysForCycle(order.cycle);
    const sub = activateSubscription({
      email: order.email,
      planId: order.planId,
      cycle: order.cycle,
      provider: "paypal",
      externalId: cap.captureId,
      days,
    });

    res.json({ success: true, order: updateOrder(order.id, { status: "completed" }), subscription: sub });
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
          days: subscriptionDaysForCycle(order.cycle),
        });
        updateOrder(order.id, { status: "completed" });
        return res.json({ success: true, order: getOrder(order.id), subscription: sub, active: true });
      }
    } catch {
      /* still pending */
    }
  }

  const active = isSubscriptionActive(order.email);
  res.json({ success: true, order, active, subscription: getSubscriptionByEmail(order.email) });
}
