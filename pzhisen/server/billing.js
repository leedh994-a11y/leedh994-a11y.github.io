import { getPlan, listPlans, getAmount, isValidCycle, DEFAULT_PLAN_ID, DEFAULT_CYCLE, formatPrice } from "./plans.js";
import {
  createPendingOrder,
  getOrder,
  updateOrder,
  activateSubscription,
  activateLifetime,
  getSubscriptionByEmail,
  isSubscriptionActive,
  getOrders,
  ensureGrandfatheredLifetimeAccess,
} from "./billing-store.js";
import {
  isPayPalConfigured,
  getPayPalPublicConfig,
  createPayPalOrder,
  capturePayPalOrder,
  verifyPayPalAuth,
} from "./paypal.js";
import {
  getBankAccountConfig,
  isBankTransferConfigured,
  makeTransferCode,
  isAdminAuthorized,
} from "./bank-transfer.js";
import { findCompanyByEmail } from "./store.js";

const PUBLIC_URL = process.env.PUBLIC_URL || "http://localhost:3000";

function maskAccount(num) {
  if (num.length <= 8) return num;
  return num.slice(0, 4) + " **** **** " + num.slice(-4);
}

function formatExpiry(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
}

export async function getBillingConfig() {
  const bank = getBankAccountConfig();
  if (isPayPalConfigured()) await verifyPayPalAuth();
  const paypal = getPayPalPublicConfig();
  return {
    success: true,
    providers: {
      paypal: isPayPalConfigured(),
      bankCard: isBankTransferConfigured(),
    },
    publicUrl: PUBLIC_URL,
    paypal,
    bankAccount: bank.configured
      ? { bankName: bank.bankName, accountName: bank.accountName, accountNumberMask: maskAccount(bank.accountNumber) }
      : null,
    defaultPlanId: DEFAULT_PLAN_ID,
    defaultCycle: DEFAULT_CYCLE,
    noteZh: "专业版按月 ¥699 / 年 ¥6999（银行卡转账），或 PayPal $99/月、$999/年。订阅到期后需续费方可继续使用。",
    noteEn: "Pro plan: ¥699/mo or ¥6999/yr (bank transfer), or $99/mo / $999/yr (PayPal). Renew when your subscription expires.",
  };
}

function activationPayload(email) {
  const company = findCompanyByEmail(email);
  const sub = getSubscriptionByEmail(email);
  return {
    companyId: company?.id || null,
    dashboardUrl: company ? `/dashboard.html?company=${company.id}` : "/dashboard.html",
    expiresAt: sub?.expiresAt || null,
    expiresAtLabel: formatExpiry(sub?.expiresAt),
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
    const { email, planId = DEFAULT_PLAN_ID, cycle = DEFAULT_CYCLE, provider, method } = req.body || {};
    if (!email?.includes("@")) {
      return res.status(400).json({ success: false, error: "Valid email required" });
    }
    if (!isValidCycle(cycle)) {
      return res.status(400).json({ success: false, error: "Invalid plan cycle. Use monthly or annual." });
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
      const cycleLabel = cycle === "annual" ? "Annual" : "Monthly";
      const desc = `Pzhisen Pro ${cycleLabel} — $${amount}`;
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
      if (!isBankTransferConfigured()) {
        return res.status(503).json({
          success: false,
          error: "银行卡收款信息未配置。请在 Render 设置 BANK_ACCOUNT_NAME、BANK_NAME、BANK_ACCOUNT_NUMBER。",
        });
      }
      const { amount, currency } = getAmount(planId, cycle, "cny");
      const order = createPendingOrder({
        email, planId, cycle, amount, currency, provider: "bankcard",
      });
      const transferCode = makeTransferCode(order.id);
      updateOrder(order.id, { status: "awaiting_transfer", transferCode });

      const bank = getBankAccountConfig();
      return res.json({
        success: true,
        orderId: order.id,
        provider: "bankcard",
        transferCode,
        amount,
        currency,
        cycle,
        bankAccount: {
          accountName: bank.accountName,
          bankName: bank.bankName,
          accountNumber: bank.accountNumber,
          branch: bank.branch,
        },
        instructions: `请转账 ¥${amount} 至以下账户，备注填写：${transferCode}`,
      });
    }

    return res.status(400).json({
      success: false,
      error: "Invalid provider. Use bank (China) or paypal.",
    });
  } catch (err) {
    console.error("checkout error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

function completeOrder(order, externalId) {
  const sub = activateSubscription({
    email: order.email,
    planId: order.planId,
    cycle: order.cycle,
    provider: order.provider,
    externalId,
  });
  updateOrder(order.id, { status: "completed" });
  return sub;
}

export function confirmBankTransferHandler(req, res) {
  const { orderId } = req.body || {};
  const order = getOrder(orderId);
  if (!order) return res.status(404).json({ success: false, error: "Order not found" });
  if (order.provider !== "bankcard") {
    return res.status(400).json({ success: false, error: "Not a bank transfer order" });
  }
  if (order.status === "completed") {
    const sub = getSubscriptionByEmail(order.email);
    return res.json({
      success: true,
      message: "订阅已开通",
      order,
      active: true,
      subscription: sub,
      ...activationPayload(order.email),
    });
  }

  updateOrder(order.id, { status: "paid", confirmedAt: new Date().toISOString() });
  const sub = completeOrder(order, order.transferCode);
  res.json({
    success: true,
    message: `订阅已开通，有效期至 ${formatExpiry(sub.expiresAt)}。`,
    order: getOrder(order.id),
    subscription: sub,
    active: true,
    ...activationPayload(order.email),
  });
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

  updateOrder(order.id, { status: "paid" });
  const sub = completeOrder(order, order.transferCode);
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
    const sub = completeOrder(order, cap.captureId);

    res.json({
      success: true,
      order: getOrder(order.id),
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
        const sub = completeOrder(order, cap.captureId);
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

export function grantLifetimeHandler(req, res) {
  const key = req.query.key || req.body?.key || req.headers["x-admin-key"];
  if (!isAdminAuthorized(key)) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  const email = (req.body?.email || "").trim().toLowerCase();
  if (!email?.includes("@")) {
    return res.status(400).json({ success: false, error: "Valid email required" });
  }
  const sub = activateLifetime({
    email,
    provider: "admin_grant",
    note: req.body?.note || "Admin granted lifetime access",
  });
  res.json({
    success: true,
    message: `已为 ${email} 恢复终身版权限`,
    subscription: sub,
    active: true,
    ...activationPayload(email),
  });
}

export { formatPrice, formatExpiry };
