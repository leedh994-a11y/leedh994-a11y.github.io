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
import { isXunhuConfigured, createBankCardPayment, verifyXunhuNotify } from "./xunhupay.js";

const PUBLIC_URL = process.env.PUBLIC_URL || "http://localhost:3000";

export function getBillingConfig() {
  return {
    success: true,
    providers: {
      paypal: isPayPalConfigured(),
      bankCard: isXunhuConfigured(),
    },
    publicUrl: PUBLIC_URL,
    paypal: getPayPalPublicConfig(),
    bankGateway: { configured: isXunhuConfigured() },
    noteZh: "国内用户使用银行卡支付（支持工行、建行、农行、中行、招商、交通等全国银行），款项结算至您绑定的国内银行卡。",
    noteEn: "China users pay with domestic bank cards. Funds settle to your linked Chinese bank account.",
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
    const { email, planId, cycle = "monthly", provider, method } = req.body || {};
    if (!email?.includes("@")) {
      return res.status(400).json({ success: false, error: "Valid email required" });
    }
    const plan = getPlan(planId);
    if (!plan) return res.status(400).json({ success: false, error: "Invalid plan" });
    if (!["monthly", "yearly"].includes(cycle)) {
      return res.status(400).json({ success: false, error: "Invalid billing cycle" });
    }

    const payProvider = provider || method;
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
    }

    if (payProvider === "bank" || payProvider === "bankcard") {
      if (!isXunhuConfigured()) {
        return res.status(503).json({
          success: false,
          error: "国内银行卡支付未配置。请在 Render 设置 XUNHU_APP_ID 和 XUNHU_APP_SECRET。",
        });
      }
      const { amount, currency } = getAmount(planId, cycle, "cny");
      const order = createPendingOrder({
        email, planId, cycle, amount, currency, provider: "bankcard",
      });
      const title = `Pzhisen ${plan.nameZh || plan.name} ${cycle === "yearly" ? "年付" : "月付"}`;
      const pay = await createBankCardPayment({
        orderId: order.id,
        amountCny: amount,
        title,
        notifyUrl: `${PUBLIC_URL}/api/billing/webhook/xunhu`,
        returnUrl: returnUrl + order.id,
      });
      updateOrder(order.id, { payUrl: pay.payUrl });
      return res.json({
        success: true,
        orderId: order.id,
        provider: "bankcard",
        payUrl: pay.payUrl,
        qrcodeUrl: pay.qrcodeUrl,
      });
    }

    return res.status(400).json({
      success: false,
      error: "Invalid provider. Use: bank (China) or paypal (international)",
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

export async function xunhuWebhookHandler(req, res) {
  try {
    const body = req.body || {};
    const verified = verifyXunhuNotify(body);
    if (!verified.valid) {
      console.warn("bank webhook invalid:", verified.error);
      return res.status(400).send("fail");
    }
    if (!verified.paid) return res.send("success");

    const order = getOrder(verified.orderId);
    if (!order) return res.send("success");
    if (order.status === "completed") return res.send("success");

    updateOrder(order.id, { status: "paid", externalId: verified.externalId });
    activateSubscription({
      email: order.email,
      planId: order.planId,
      cycle: order.cycle,
      provider: "bankcard",
      externalId: verified.externalId,
      days: subscriptionDaysForCycle(order.cycle),
    });
    updateOrder(order.id, { status: "completed" });
    res.send("success");
  } catch (err) {
    console.error("bank webhook error:", err);
    res.status(500).send("fail");
  }
}
