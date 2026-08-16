import { getOrders } from "./billing-store.js";
import { getPlan } from "./plans.js";
import { loadJson, saveJson } from "./store.js";
import { getOrderNotifyEmails } from "./mail.js";

const GOALS_FILE = "real-revenue-goals.json";

const PAID_STATUSES = new Set(["completed", "paid"]);
const PENDING_STATUSES = new Set(["pending", "awaiting_transfer"]);

function loadGoals() {
  return loadJson(GOALS_FILE, { companies: {} });
}

function saveGoals(data) {
  saveJson(GOALS_FILE, data);
}

function maskEmail(email) {
  if (!email || !email.includes("@")) return "—";
  const [local, domain] = email.split("@");
  const visible = local.length <= 2 ? local[0] : local.slice(0, 2);
  return `${visible}***@${domain}`;
}

function isMerchantUser(email) {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const merchants = getOrderNotifyEmails().map((e) => e.toLowerCase());
  if (merchants.includes(normalized)) return true;
  const extra = (process.env.MERCHANT_OWNER_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return extra.includes(normalized);
}

function providerLabel(provider) {
  if (provider === "paypal") return "PayPal";
  if (provider === "bankcard" || provider === "bank") return "银行卡转账";
  if (provider === "admin_grant") return "管理员开通";
  return provider || "—";
}

function statusLabel(status) {
  const map = {
    completed: "已付款",
    paid: "已付款",
    pending: "待支付",
    awaiting_transfer: "待转账确认",
  };
  return map[status] || status;
}

function isPaid(order) {
  return PAID_STATUSES.has(order.status);
}

function defaultGoal() {
  return {
    revenueTarget: 10000,
    currency: "USD",
    targetDays: 90,
    setAt: new Date().toISOString(),
  };
}

function getGoal(companyId) {
  const data = loadGoals();
  return data.companies[companyId] || defaultGoal();
}

export function setRealRevenueGoal(companyId, { revenueTarget, targetDays, currency } = {}) {
  const data = loadGoals();
  const goal = data.companies[companyId] || defaultGoal();
  if (revenueTarget != null) goal.revenueTarget = Number(revenueTarget);
  if (targetDays != null) goal.targetDays = Number(targetDays);
  if (currency) goal.currency = currency;
  goal.setAt = new Date().toISOString();
  data.companies[companyId] = goal;
  saveGoals(data);
  return goal;
}

function sumByCurrency(orders, currency) {
  return orders
    .filter((o) => isPaid(o) && (o.currency || "USD").toUpperCase() === currency.toUpperCase())
    .reduce((s, o) => s + Number(o.amount || 0), 0);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function getRealRevenueDashboard(companyId, company, userEmail) {
  const merchant = isMerchantUser(userEmail);
  const goal = getGoal(companyId);
  const allOrders = getOrders().orders || [];
  const sorted = [...allOrders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (!merchant) {
    return {
      companyId,
      isMerchant: false,
      accessMessage:
        "真实客户付款订单数据仅网站商户账户可见。请使用商户邮箱（ORDER_NOTIFY_EMAIL）登录后查看。",
      summary: null,
      orders: [],
      updatedAt: new Date().toISOString(),
    };
  }

  const paidOrders = sorted.filter(isPaid);
  const pendingOrders = sorted.filter((o) => PENDING_STATUSES.has(o.status));
  const today = todayIso();
  const todayPaid = paidOrders.filter((o) => (o.createdAt || "").slice(0, 10) === today);

  const totalUsd = sumByCurrency(paidOrders, "USD");
  const totalCny = sumByCurrency(paidOrders, "CNY");
  const todayUsd = sumByCurrency(todayPaid, "USD");
  const todayCny = sumByCurrency(todayPaid, "CNY");

  const primaryTotal = goal.currency === "CNY" ? totalCny : totalUsd;
  const primaryToday = goal.currency === "CNY" ? todayCny : todayUsd;
  const target = goal.revenueTarget || 10000;
  const progress = target > 0 ? Math.min(100, Math.round((primaryTotal / target) * 100)) : 0;
  const remaining = Math.max(0, target - primaryTotal);

  const uniqueCustomers = new Set(paidOrders.map((o) => o.email)).size;

  const byProvider = {};
  for (const o of paidOrders) {
    const key = o.provider || "other";
    if (!byProvider[key]) byProvider[key] = { provider: key, label: providerLabel(key), count: 0, totalUsd: 0, totalCny: 0 };
    byProvider[key].count += 1;
    if ((o.currency || "USD").toUpperCase() === "CNY") byProvider[key].totalCny += Number(o.amount || 0);
    else byProvider[key].totalUsd += Number(o.amount || 0);
  }

  const byDayMap = {};
  for (const o of paidOrders) {
    const date = (o.createdAt || "").slice(0, 10);
    if (!date) continue;
    if (!byDayMap[date]) byDayMap[date] = { date, count: 0, totalUsd: 0, totalCny: 0 };
    byDayMap[date].count += 1;
    if ((o.currency || "USD").toUpperCase() === "CNY") byDayMap[date].totalCny += Number(o.amount || 0);
    else byDayMap[date].totalUsd += Number(o.amount || 0);
  }
  const byDay = Object.values(byDayMap)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);

  const orders = sorted.slice(0, 100).map((o) => {
    const plan = getPlan(o.planId);
    return {
      id: o.id,
      date: o.createdAt,
      customerEmailMask: maskEmail(o.email),
      amount: Number(o.amount || 0),
      currency: o.currency || "USD",
      provider: o.provider,
      providerLabel: providerLabel(o.provider),
      status: o.status,
      statusLabel: statusLabel(o.status),
      planLabel: plan.nameZh || plan.name,
      cycle: o.cycle,
      paid: isPaid(o),
    };
  });

  return {
    companyId,
    isMerchant: true,
    websiteName: company?.name || "我的网站",
    summary: {
      totalUsd,
      totalCny,
      todayUsd,
      todayCny,
      primaryCurrency: goal.currency || "USD",
      primaryTotal,
      primaryToday,
      orderCountTotal: sorted.length,
      orderCountPaid: paidOrders.length,
      orderCountPending: pendingOrders.length,
      orderCountToday: todayPaid.length,
      customerCount: uniqueCustomers,
      goal: { ...goal, progress, remaining },
    },
    byProvider: Object.values(byProvider),
    byDay,
    orders,
    updatedAt: new Date().toISOString(),
    isReal: true,
    dataSource: "payment_orders",
  };
}
