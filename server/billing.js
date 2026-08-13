import { getPlan, getAmount, isValidCycle, TRIAL_DAYS } from "./plans.js";
import {
  createPendingOrder,
  getOrder,
  updateOrder,
  activateSubscription,
  activateTrial,
  getSubscriptionByEmail,
  isSubscriptionActive,
  cancelSubscription,
} from "./billing-store.js";
import {
  isPayPalConfigured,
  createPayPalOrder,
  capturePayPalOrder,
} from "./paypal.js";
import {
  notifyOrderEvent,
  isOrderNotifyConfigured,
  getOrderNotifyEmails,
  sendNotifyTestEmail,
  isMailConfigured,
  isSmtpConfigured,
  isGithubNotifyConfigured,
} from "./mail.js";
import {
  INSTALLATION_PLAN,
  isInstallationPlan,
  handleInstallationCheckout,
  handleInstallationActivate,
} from "./billing-installation.js";

const PUBLIC_URL = process.env.PUBLIC_URL || "https://yoursite.asia";
const ADMIN_SECRET = (process.env.BILLING_ADMIN_SECRET || "").trim();

function fireNotify(event, order, extra) {
  notifyOrderEvent(event, order, extra).catch((err) => {
    console.error("order notify error:", err.message);
  });
}

function isAdminAuthorized(key) {
  return Boolean(ADMIN_SECRET && key === ADMIN_SECRET);
}

function planDisplayName(planId) {
  const plan = getPlan(planId);
  return plan?.name || planId;
}

function addonTotal(addons = [], cycle) {
  let extra = 0;
  for (const addon of addons) {
    if (addon === "remove-branding" || addon === "extra-messages") {
      extra += cycle === "yearly" ? 468 : 39;
    }
  }
  return extra;
}

export async function getBillingConfig(_req, res) {
  res.json({
    success: true,
    publicUrl: PUBLIC_URL,
    orderNotify: {
      configured: isOrderNotifyConfigured(),
      smtpReady: isSmtpConfigured(),
      githubBridge: isGithubNotifyConfigured(),
      destinationHint: getOrderNotifyEmails().length ? getOrderNotifyEmails()[0] : null,
    },
    trialDays: TRIAL_DAYS,
  });
}

export function getSubscriptionHandler(req, res) {
  const email = (req.query.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ success: false, error: "Email required" });

  const subscription = getSubscriptionByEmail(email);
  const allowed = isSubscriptionActive(email);

  res.json({
    success: true,
    subscription,
    access: {
      allowed,
      reason: allowed ? "active" : subscription ? "expired" : "no_subscription",
    },
  });
}

export async function checkoutHandler(req, res) {
  try {
    const {
      email,
      planId = "growth",
      cycle = "monthly",
      mode,
      addons = [],
    } = req.body || {};

    if (!email?.includes("@")) {
      return res.status(400).json({ success: false, error: "Valid email required" });
    }

    if (mode === "trial") {
      if (isInstallationPlan(planId)) {
        return res.status(400).json({ success: false, error: "Installation plan does not support trial" });
      }
      const sub = activateTrial({ email, planId, cycle });
      fireNotify("trial", {
        email,
        planId,
        cycle,
        amount: 0,
        currency: "USD",
        provider: "trial",
        status: "trialing",
        id: sub.id,
      }, { message: `全球用户开始 ${TRIAL_DAYS} 天免费试用` });
      return res.json({
        success: true,
        subscription: sub,
        redirectUrl: `/account.html?email=${encodeURIComponent(email)}&welcome=1`,
      });
    }

    if (isInstallationPlan(planId)) {
      const result = await handleInstallationCheckout({
        email,
        createPayPalOrder: async ({ amount, currency, description }) => {
          const pp = await createPayPalOrder({
            amount,
            currency,
            description,
            email,
            planId,
            returnUrl: `${PUBLIC_URL}/account.html?email=${encodeURIComponent(email)}&installation=1`,
            cancelUrl: `${PUBLIC_URL}/checkout.html?plan=installation`,
          });
          createPendingOrder({
            email,
            planId,
            cycle: "onetime",
            amount,
            currency,
            provider: "paypal",
            externalId: pp.orderId,
          });
          return { orderId: pp.orderId, approveUrl: pp.approveUrl };
        },
      });
      if (result.success) {
        fireNotify("created", {
          email,
          planId,
          cycle: "onetime",
          amount: INSTALLATION_PLAN.amount,
          currency: "USD",
          provider: "paypal",
          status: "pending",
          externalId: result.orderId,
          id: result.orderId,
        });
      }
      return res.json(result);
    }

    if (!isValidCycle(cycle)) {
      return res.status(400).json({ success: false, error: "Invalid cycle" });
    }

    const pricing = getAmount(planId, cycle);
    if (!pricing) return res.status(400).json({ success: false, error: "Invalid plan" });

    if (!isPayPalConfigured()) {
      return res.status(503).json({ success: false, error: "PayPal not configured" });
    }

    const amount = pricing.amount + addonTotal(addons, cycle);
    const desc = `Sitp GPT ${planDisplayName(planId)} ${cycle === "yearly" ? "Yearly" : "Monthly"} — $${amount}`;

    const pp = await createPayPalOrder({
      amount,
      currency: "USD",
      description: desc,
      email,
      planId,
      returnUrl: `${PUBLIC_URL}/account.html?email=${encodeURIComponent(email)}&welcome=1`,
      cancelUrl: `${PUBLIC_URL}/checkout.html?plan=${planId}&cycle=${cycle}`,
    });

    const order = createPendingOrder({
      email,
      planId,
      cycle,
      amount,
      currency: "USD",
      provider: "paypal",
      externalId: pp.orderId,
      meta: { addons },
    });

    fireNotify("created", order, { message: "全球用户已发起 PayPal 支付，等待完成扣款" });

    res.json({
      success: true,
      mode: "payment",
      orderId: pp.orderId,
      approveUrl: pp.approveUrl,
      amount,
      plan: planDisplayName(planId),
      cycle,
      internalOrderId: order.id,
    });
  } catch (err) {
    console.error("checkout error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function activateHandler(req, res) {
  try {
    const { orderId, email, planId, cycle } = req.body || {};
    if (!orderId || !email) {
      return res.status(400).json({ success: false, error: "缺少参数" });
    }

    if (isInstallationPlan(planId)) {
      const result = await handleInstallationActivate({
        orderId,
        email,
        captureOrder: async (id) => capturePayPalOrder(id),
        savePurchase: () => {},
      });
      if (result.success) {
        fireNotify("paid", {
          email,
          planId,
          cycle: "onetime",
          amount: INSTALLATION_PLAN.amount,
          currency: "USD",
          provider: "paypal",
          status: "completed",
          externalId: orderId,
          id: orderId,
        }, { message: "全球用户完成 $599 安装套餐付款" });
      }
      return res.json(result);
    }

    const cap = await capturePayPalOrder(orderId);
    if (!cap.success) {
      return res.status(400).json({ success: false, error: cap.error || "PayPal 扣款失败" });
    }

    let order = getOrder(orderId);
    if (!order) {
      order = createPendingOrder({
        email,
        planId: planId || "growth",
        cycle: cycle || "monthly",
        amount: getAmount(planId || "growth", cycle || "monthly")?.amount || 0,
        currency: "USD",
        provider: "paypal",
        externalId: orderId,
      });
    }

    updateOrder(order.id, { status: "paid", captureId: cap.captureId, externalId: orderId });

    const sub = activateSubscription({
      email: order.email || email,
      planId: order.planId || planId || "growth",
      cycle: order.cycle || cycle || "monthly",
      provider: "paypal",
      externalId: cap.captureId,
    });

    const completed = updateOrder(order.id, { status: "completed" });
    fireNotify("paid", completed || order, {
      expiresAt: sub?.currentPeriodEnd,
      message: "全球 PayPal 支付已扣款成功，订阅已开通",
    });

    res.json({
      success: true,
      subscription: sub,
      redirectUrl: `/account.html?email=${encodeURIComponent(email)}&welcome=1`,
    });
  } catch (err) {
    console.error("activate error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function captureOrderHandler(req, res) {
  try {
    const { orderId } = req.body || {};
    const cap = await capturePayPalOrder(orderId);
    if (!cap.success) return res.status(400).json(cap);

    const order = getOrder(orderId);
    if (order && order.status !== "completed") {
      updateOrder(order.id, { status: "paid", captureId: cap.captureId });
      const sub = activateSubscription({
        email: order.email,
        planId: order.planId,
        cycle: order.cycle,
        provider: "paypal",
        externalId: cap.captureId,
      });
      const completed = updateOrder(order.id, { status: "completed" });
      fireNotify("paid", completed || order, {
        expiresAt: sub?.currentPeriodEnd,
        message: "PayPal capture-order 成功，订阅已开通",
      });
    }

    res.json({ success: true, captureId: cap.captureId, status: cap.status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export function cancelHandler(req, res) {
  const { email } = req.body || {};
  if (!email?.includes("@")) {
    return res.status(400).json({ success: false, error: "Email required" });
  }
  const sub = cancelSubscription(email);
  if (!sub) return res.status(404).json({ success: false, error: "No subscription" });
  res.json({ success: true, subscription: sub });
}

export function notifyStatusHandler(req, res) {
  const key = req.query.key || req.headers["x-admin-key"];
  if (!isAdminAuthorized(key)) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  res.json({
    success: true,
    configured: isOrderNotifyConfigured(),
    recipients: getOrderNotifyEmails(),
    smtp: isSmtpConfigured(),
    githubBridge: isGithubNotifyConfigured(),
  });
}

export async function notifyTestHandler(req, res) {
  const key = req.query.key || req.body?.key || req.headers["x-admin-key"];
  if (!isAdminAuthorized(key)) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  try {
    const result = await sendNotifyTestEmail();
    res.json({ success: true, ...result, recipients: getOrderNotifyEmails() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
