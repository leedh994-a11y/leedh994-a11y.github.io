import { getOrders } from "./billing-store.js";
import { getLogs, loadJson } from "./store.js";
import { getOrderNotifyEmails } from "./mail.js";
import { isEnvMerchant, isPersistedMerchant } from "./merchant-owners-store.js";

const PAID = new Set(["completed", "paid"]);

export function isMerchantUser(email) {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (isEnvMerchant(normalized)) return true;
  if (isPersistedMerchant(normalized)) return true;
  return false;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function sumOrders(orders, currency) {
  return orders
    .filter((o) => PAID.has(o.status) && (o.currency || "USD").toUpperCase() === currency.toUpperCase())
    .reduce((s, o) => s + Number(o.amount || 0), 0);
}

/** Real payment order metrics from billing system. */
export function getRealOrderMetrics() {
  const all = getOrders().orders || [];
  const paid = all.filter((o) => PAID.has(o.status));
  const today = todayIso();
  const todayPaid = paid.filter((o) => (o.createdAt || "").slice(0, 10) === today);

  const byDayMap = {};
  for (const o of paid) {
    const date = (o.createdAt || "").slice(0, 10);
    if (!date) continue;
    if (!byDayMap[date]) byDayMap[date] = { date, count: 0, totalUsd: 0, totalCny: 0 };
    byDayMap[date].count += 1;
    if ((o.currency || "USD").toUpperCase() === "CNY") byDayMap[date].totalCny += Number(o.amount || 0);
    else byDayMap[date].totalUsd += Number(o.amount || 0);
  }

  return {
    totalUsd: sumOrders(paid, "USD"),
    totalCny: sumOrders(paid, "CNY"),
    todayUsd: sumOrders(todayPaid, "USD"),
    todayCny: sumOrders(todayPaid, "CNY"),
    orderCountTotal: all.length,
    orderCountPaid: paid.length,
    orderCountToday: todayPaid.length,
    customerCount: new Set(paid.map((o) => o.email)).size,
    customersToday: new Set(todayPaid.map((o) => o.email)).size,
    byDay: Object.values(byDayMap).sort((a, b) => b.date.localeCompare(a.date)),
    isReal: true,
    source: "payment_orders",
  };
}

/** Real marketing activity from company logs and launch records. */
export function getCompanyMarketingActivity(companyId) {
  const logs = getLogs(companyId, 500);
  const today = todayIso();
  const marketingPattern = /marketing|growth|ads|ceo|推广|营销|seo|外联|内容/i;
  const todayLogs = logs.filter((l) => (l.at || "").slice(0, 10) === today);
  const marketingLogsToday = todayLogs.filter(
    (l) => marketingPattern.test(l.agent || "") || marketingPattern.test(l.message || "")
  );

  const launchData = loadJson("marketing-launch-log.json", { launches: [] });
  const companyLaunches = (launchData.launches || []).filter((l) => l.companyId === companyId);
  const launchesToday = companyLaunches.filter((l) => (l.at || "").slice(0, 10) === today);

  const allMarketingLogs = logs.filter(
    (l) => marketingPattern.test(l.agent || "") || marketingPattern.test(l.message || "")
  );

  return {
    agentRunsToday: marketingLogsToday.length,
    agentRunsTotal: allMarketingLogs.length,
    launchesToday: launchesToday.length,
    launchesTotal: companyLaunches.length,
    lastLaunchAt: companyLaunches.length ? companyLaunches[companyLaunches.length - 1].at : null,
    isReal: true,
    source: "activity_logs",
  };
}

/** Build real sales block for marketing dashboard panels. */
export function buildRealSalesBlock(goal, userEmail) {
  const orders = getRealOrderMetrics();
  const merchant = isMerchantUser(userEmail);
  const currency = goal?.currency || "USD";
  const target = goal?.revenueTarget || 5000;
  const total = currency === "CNY" ? orders.totalCny : orders.totalUsd;
  const today = currency === "CNY" ? orders.todayCny : orders.todayUsd;
  const progress = target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0;

  const history = orders.byDay.slice(0, 60).map((d) => ({
    date: d.date,
    amount: currency === "CNY" ? d.totalCny : d.totalUsd,
    orders: d.count,
  }));

  return {
    today,
    total,
    target,
    currency,
    progress,
    remaining: Math.max(0, target - total),
    history,
    orderCountToday: orders.orderCountToday,
    orderCountPaid: orders.orderCountPaid,
    customerCount: orders.customerCount,
    customersToday: orders.customersToday,
    isReal: true,
    dataSource: "真实客户付款订单",
    merchantVisible: merchant,
  };
}

/** Count log entries related to a marketing method today. */
export function countMethodActivity(logs, method, date) {
  const todayLogs = logs.filter((l) => (l.at || "").slice(0, 10) === date);
  const terms = [
    method.id,
    method.category,
    ...method.label.split(/[\s/()（）、]+/).filter((w) => w.length > 1),
  ].map((t) => t.toLowerCase());

  return todayLogs.filter((l) => {
    const text = `${l.agent || ""} ${l.message || ""}`.toLowerCase();
    return terms.some((t) => t.length > 2 && text.includes(t));
  }).length;
}

export function countdownFromDeadline(deadlineIso) {
  const ms = new Date(deadlineIso).getTime() - Date.now();
  if (ms <= 0) return { expired: true, days: 0, hours: 0, minutes: 0, label: "已到期" };
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return { expired: false, days, hours, minutes, label: `${days} 天 ${hours} 小时 ${minutes} 分`, ms };
}
