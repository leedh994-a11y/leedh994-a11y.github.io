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
  listReceivingBankAccounts,
  isBankTransferConfigured,
  makeTransferCode,
  isAdminAuthorized,
} from "./bank-transfer.js";
import { findCompanyByEmail } from "./store.js";
import {
  notifyOrderEvent,
  isOrderNotifyConfigured,
  getOrderNotifyEmails,
  sendNotifyTestEmail,
  isMailConfigured,
  isSmtpConfigured,
  isGithubNotifyConfigured,
} from "./mail.js";

const PUBLIC_URL = process.env.PUBLIC_URL || "http://localhost:3000";

function maskAccount(num) {
  if (!num || num.length <= 8) return num || "";
  return num.slice(0, 4) + " **** **** " + num.slice(-4);
}

function publicBankAccounts() {
  return listReceivingBankAccounts().map((a) => ({
    id: a.id,
    label: a.label,
    network: a.network,
    bankName: a.bankName,
    accountName: a.accountName,
    accountNumber: a.accountNumber,
    accountNumberMask: maskAccount(a.accountNumber),
    branch: a.branch,
    settlementCurrency: a.settlementCurrency || (a.id === "visa" ? "USD" : "CNY"),
  }));
}

function bankAccountsForChannel(channel, accounts = publicBankAccounts()) {
  if (channel === "visa") {
    const visa = accounts.find((a) => a.id === "visa" || a.id === "boc-visa");
    return visa ? [visa] : accounts;
  }
  const boc = accounts.find((a) => a.id === "boc" || a.id === "boc-visa");
  return boc ? [boc] : accounts;
}

function formatTransferAmount(amount, currency) {
  const sym = (currency || "CNY").toUpperCase() === "USD" ? "$" : "¥";
  return `${sym}${amount}`;
}

function fireNotify(event, order, extra) {
  // Never block checkout / capture on email failures
  notifyOrderEvent(event, order, extra).catch((err) => {
    console.error("order notify error:", err.message);
  });
}

function formatExpiry(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
}

export async function getBillingConfig() {
  const bank = getBankAccountConfig();
  const accounts = publicBankAccounts();
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
      ? {
          bankName: bank.bankName,
          accountName: bank.accountName,
          accountNumberMask: maskAccount(bank.accountNumber),
          label: accounts[0]?.label || "中国银行借记卡",
        }
      : null,
    bankAccounts: accounts.map(({ accountNumber, ...rest }) => rest),
    orderNotify: {
      configured: isOrderNotifyConfigured(),
      smtpReady: isSmtpConfigured(),
      githubBridge: isGithubNotifyConfigured(),
      // Do not expose the full mailbox publicly — only that merchant Gmail is the destination
      destinationHint: getOrderNotifyEmails().length ? "merchant Gmail" : null,
    },
    defaultPlanId: DEFAULT_PLAN_ID,
    defaultCycle: DEFAULT_CYCLE,
    noteZh: "全球新用户注册后免费体验 3 天全部功能；之后专业版按月 ¥699 / 年 ¥6999（中国银行/Visa 借记卡），或 PayPal $99/月、$999/年。",
    noteEn: "New global users get 3 days free full access after signup; then Pro at ¥699/mo or ¥6999/yr (BOC/Visa), or $99/mo / $999/yr (PayPal).",
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
      const updated = updateOrder(order.id, { externalId: pp.paypalOrderId, approveUrl: pp.approveUrl });
      fireNotify("created", updated || { ...order, externalId: pp.paypalOrderId, status: "pending" }, {
        message: "全球用户已发起 PayPal 支付，等待完成扣款",
      });
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
          error: "银行卡收款信息未配置。请在 Render 设置 BANK_ACCOUNT_NAME、BANK_NAME、BANK_ACCOUNT_NUMBER（及可选 BANK_VISA_*）。",
        });
      }
      const { userSegment, receivingChannel } = req.body || {};
      let channel = receivingChannel;
      if (!channel && userSegment) {
        channel = userSegment === "china" || userSegment === "cn" ? "boc" : "visa";
      }
      channel = channel || "boc";
      const { amount, currency } = getAmount(planId, cycle, channel === "visa" ? "usd" : "cny");
      const order = createPendingOrder({
        email,
        planId,
        cycle,
        amount,
        currency,
        provider: "bankcard",
        meta: {
          userSegment: userSegment || (channel === "boc" ? "china" : "global"),
          receivingChannel: channel,
        },
      });
      const transferCode = makeTransferCode(order.id);
      const updated = updateOrder(order.id, { status: "awaiting_transfer", transferCode });

      const accounts = bankAccountsForChannel(channel);
      const primaryAccount = accounts[0] || {};
      const amountLabel = formatTransferAmount(amount, currency);
      const accountLabel =
        channel === "visa" ? "中国银行 VISA 借记卡" : primaryAccount.label || "中国银行借记卡";
      fireNotify("awaiting_transfer", updated || { ...order, status: "awaiting_transfer", transferCode }, {
        message:
          channel === "visa"
            ? "全球用户将向 VISA 借记卡转账美元，请留意银行到账短信并核对手注"
            : "用户将向中国银行借记卡转账人民币，请留意银行到账短信并核对手注",
      });
      return res.json({
        success: true,
        orderId: order.id,
        provider: "bankcard",
        transferCode,
        amount,
        currency,
        cycle,
        receivingChannel: channel,
        bankAccount: {
          accountName: primaryAccount.accountName,
          bankName: primaryAccount.bankName,
          accountNumber: primaryAccount.accountNumber,
          branch: primaryAccount.branch,
          label: accountLabel,
          network: primaryAccount.network,
          settlementCurrency: currency,
        },
        bankAccounts: accounts,
        instructions: `请转账 ${amountLabel} ${currency} 至以下${accountLabel}账户，备注填写：${transferCode}`,
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

function completeOrder(order, externalId, notifyExtra = {}) {
  const sub = activateSubscription({
    email: order.email,
    planId: order.planId,
    cycle: order.cycle,
    provider: order.provider,
    externalId,
  });
  const completed = updateOrder(order.id, { status: "completed" });
  fireNotify("paid", completed || { ...order, status: "completed" }, {
    expiresAt: sub?.expiresAt,
    ...notifyExtra,
  });
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
  const sub = completeOrder(order, order.transferCode, {
    message: "用户确认已完成中国银行/Visa 借记卡转账，订阅已开通",
  });
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
  const sub = completeOrder(order, order.transferCode, {
    message: "管理员在收款管理页确认到账并开通",
  });
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
    const sub = completeOrder(order, cap.captureId, {
      message: "全球 PayPal 支付已扣款成功，订阅已开通",
    });

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

/** Admin: inspect notify wiring + send a test email to merchant Gmail. */
export async function notifyStatusHandler(req, res) {
  const key = req.query.key || req.headers["x-admin-key"];
  if (!isAdminAuthorized(key)) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  res.json({
    success: true,
    smtpConfigured: isSmtpConfigured(),
    githubBridgeConfigured: isGithubNotifyConfigured(),
    orderNotifyConfigured: isOrderNotifyConfigured(),
    recipients: getOrderNotifyEmails(),
    bankAccounts: listReceivingBankAccounts().map((a) => ({
      id: a.id,
      label: a.label,
      network: a.network,
      bankName: a.bankName,
      accountName: a.accountName,
      accountNumberMask: maskAccount(a.accountNumber),
      branch: a.branch,
    })),
  });
}

export async function notifyTestHandler(req, res) {
  const key = req.query.key || req.body?.key || req.headers["x-admin-key"];
  if (!isAdminAuthorized(key)) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  try {
    if (!isMailConfigured()) {
      return res.status(503).json({
        success: false,
        error: "邮件未配置。请设置 GITHUB_NOTIFY_TOKEN（推荐，绕过 Render 免费版 SMTP 封锁）或 SMTP_*。",
        recipients: getOrderNotifyEmails(),
      });
    }
    const result = await sendNotifyTestEmail();
    res.json({
      success: true,
      message: `测试邮件已发送至 ${getOrderNotifyEmails().join(", ")}（via ${result.via || "mail"}）`,
      ...result,
      recipients: getOrderNotifyEmails(),
    });
  } catch (err) {
    console.error("notify test error:", err);
    res.status(500).json({ success: false, error: err.message, recipients: getOrderNotifyEmails() });
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
