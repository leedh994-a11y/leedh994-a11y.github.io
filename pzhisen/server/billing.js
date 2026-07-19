import { getPlan, listPlans, getAmount } from "./plans.js";
import {
  createPendingOrder,
  getOrder,
  updateOrder,
  activateSubscription,
  getSubscriptionByEmail,
  isSubscriptionActive,
  subscriptionDaysForCycle,
  getOrders,
} from "./billing-store.js";
import { isPayPalConfigured, getPayPalPublicConfig, createPayPalOrder, capturePayPalOrder } from "./paypal.js";
import {
  getBankAccountConfig,
  isBankTransferConfigured,
  makeTransferCode,
  isAdminAuthorized,
} from "./bank-transfer.js";

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
    noteZh: "国内用户请转账至页面显示的银行卡，完全免费、无第三方手续费。转账后点击「我已完成转账」，您在管理页确认后开通订阅。",
    noteEn: "China users: free bank transfer to the account shown. No third-party fees.",
  };
}

function maskAccount(num) {
  if (num.length <= 8) return num;
  return num.slice(0, 4) + " **** **** " + num.slice(-4);
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
    return res.json({ success: true, message: "Subscription already active", order });
  }

  updateOrder(order.id, { status: "pending_review", confirmedAt: new Date().toISOString() });
  res.json({
    success: true,
    message: "已收到您的确认，我们将在核实转账后 24 小时内开通订阅。",
    order: getOrder(order.id),
  });
}

export function listPendingBankOrdersHandler(req, res) {
  const key = req.query.key || req.headers["x-admin-key"];
  if (!isAdminAuthorized(key)) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  const { orders } = getOrders();
  const pending = orders.filter((o) =>
    o.provider === "bankcard" && (o.status === "pending_review" || o.status === "awaiting_transfer")
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
  const sub = activateSubscription({
    email: order.email,
    planId: order.planId,
    cycle: order.cycle,
    provider: "bankcard",
    externalId: order.transferCode,
    days: subscriptionDaysForCycle(order.cycle),
  });
  updateOrder(order.id, { status: "completed" });
  res.json({ success: true, order: getOrder(order.id), subscription: sub });
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
