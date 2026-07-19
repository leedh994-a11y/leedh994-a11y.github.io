import { getPlan, listPlans, getAmount } from "./plans.js";
import {
  createPendingOrder,
  getOrder,
  updateOrder,
  activateLifetime,
  getSubscriptionByEmail,
  isSubscriptionActive,
  getOrders,
} from "./billing-store.js";
import { isPayPalConfigured, getPayPalPublicConfig, createPayPalOrder, capturePayPalOrder } from "./paypal.js";
import {
  getBankAccountConfig,
  isBankTransferConfigured,
  makeTransferCode,
  isAdminAuthorized,
} from "./bank-transfer.js";
import { findCompanyByEmail } from "./store.js";

const PUBLIC_URL = process.env.PUBLIC_URL || "http://localhost:3000";

export function getBillingConfig() {
  const bank = getBankAccountConfig();
  return {
    success: true,
    providers: {
      paypal: isPayPalConfigured(),
      bankCard: isBankTransferConfigured(),
    },
    publicUrl: PUBLIC_URL,
    paypal: getPayPalPublicConfig(),
    bankAccount: bank.configured
      ? { bankName: bank.bankName, accountName: bank.accountName, accountNumberMask: maskAccount(bank.accountNumber) }
      : null,
    noteZh: "仅需支付 ¥1 即可永久使用全部功能。银行卡转账或 PayPal 支付后立即可用。",
    noteEn: "Pay ¥1 (bank transfer) or $1 (PayPal) once — instant lifetime access worldwide.",
  };
}

function maskAccount(num) {
  if (num.length <= 8) return num;
  return num.slice(0, 4) + " **** **** " + num.slice(-4);
}

function activationPayload(email) {
  const company = findCompanyByEmail(email);
  return {
    companyId: company?.id || null,
    dashboardUrl: company ? `/dashboard.html?company=${company.id}` : "/dashboard.html",
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
    const { email, planId = "lifetime", cycle = "lifetime", provider, method } = req.body || {};
    if (!email?.includes("@")) {
      return res.status(400).json({ success: false, error: "Valid email required" });
    }
    const plan = getPlan(planId);
    if (!plan) return res.status(400).json({ success: false, error: "Invalid plan" });
    if (isSubscriptionActive(email)) {
      return res.json({ success: true, alreadyActive: true, message: "您已开通终身版", subscription: getSubscriptionByEmail(email) });
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
      const desc = `Pzhisen Lifetime — one-time payment`;
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
      error: "Invalid provider. Use: bank (China) or paypal (international)",
    });
  } catch (err) {
    console.error("checkout error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
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
  const sub = activateLifetime({
    email: order.email,
    planId: order.planId,
    provider: "bankcard",
    externalId: order.transferCode,
  });
  updateOrder(order.id, { status: "completed" });
  res.json({
    success: true,
    message: "订阅已开通，可立即使用全部功能。",
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
  const sub = activateLifetime({
    email: order.email,
    planId: order.planId,
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
    const sub = activateLifetime({
      email: order.email,
      planId: order.planId,
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
        const sub = activateLifetime({
          email: order.email,
          planId: order.planId,
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
