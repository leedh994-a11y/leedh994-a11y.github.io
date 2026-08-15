import { loadJson, saveJson, getLogs } from "./store.js";
import { ALL_MARKETING_METHODS } from "./marketing-launch-all.js";
import { getMarketingDashboard } from "./marketing-dashboard.js";
import { getContentMarketingDashboard } from "./content-marketing-dashboard.js";
import {
  getRealOrderMetrics,
  getCompanyMarketingActivity,
  countMethodActivity,
  buildRealSalesBlock,
} from "./marketing-real-metrics.js";

const STORE = "marketing-analytics.json";

function loadStore() {
  return loadJson(STORE, { companies: {} });
}

function saveStore(data) {
  saveJson(STORE, data);
}

function getState(companyId) {
  const data = loadStore();
  if (!data.companies[companyId]) {
    data.companies[companyId] = { companyId, history: [], lastSync: null };
    saveStore(data);
  }
  return data.companies[companyId];
}

function saveState(state) {
  const data = loadStore();
  data.companies[state.companyId] = state;
  saveStore(data);
}

function findTaskProgress(method, marketing, contentMarketing) {
  const label = method.label.toLowerCase();
  const allTasks = [
    ...(marketing?.tasks?.items || []),
    ...(contentMarketing?.tasks?.items || []),
  ];
  const match = allTasks.find(
    (t) =>
      (t.method || "").toLowerCase().includes(label.slice(0, 4)) ||
      (t.title || "").toLowerCase().includes(label.slice(0, 6)) ||
      (t.platform || "").toLowerCase().includes(label.slice(0, 4))
  );
  if (match) return { progress: match.progress, status: match.status };
  return { progress: 0, status: "scheduled" };
}

function statusZh(status, progress) {
  if (status === "completed" || progress >= 100) return "已完成";
  if (status === "in_progress" || progress > 0) return "进行中";
  return "待启动";
}

function buildDailyRows(companyId, date, marketing, contentMarketing, logs, orders) {
  return ALL_MARKETING_METHODS.map((method) => {
    const task = findTaskProgress(method, marketing, contentMarketing);
    const agentExecutions = countMethodActivity(logs, method, date);
    const progress = task.progress || 0;
    return {
      methodId: method.id,
      category: method.category,
      label: method.label,
      date,
      progress,
      status: statusZh(task.status, progress),
      mediaSpend: 0,
      currency: "USD",
      agentExecutions,
      ordersToday: orders.orderCountToday,
      revenueToday: orders.todayUsd,
      revenueTodayCny: orders.todayCny,
      customersToday: orders.customersToday,
      isReal: true,
    };
  });
}

function aggregateAnalysis(rows, history, orders, activity) {
  const today = rows;
  const totals = {
    methods: today.length,
    active: today.filter((r) => r.status === "进行中").length,
    completed: today.filter((r) => r.status === "已完成").length,
    agentExecutions: today.reduce((s, r) => s + r.agentExecutions, 0),
    ordersToday: orders.orderCountToday,
    ordersPaid: orders.orderCountPaid,
    revenueTodayUsd: orders.todayUsd,
    revenueTodayCny: orders.todayCny,
    revenueTotalUsd: orders.totalUsd,
    customersToday: orders.customersToday,
    customerCount: orders.customerCount,
    avgProgress: today.length ? Math.round(today.reduce((s, r) => s + r.progress, 0) / today.length) : 0,
    mediaSpend: 0,
    launchesToday: activity.launchesToday,
    agentRunsToday: activity.agentRunsToday,
  };

  const byCategory = {};
  for (const r of today) {
    if (!byCategory[r.category]) {
      byCategory[r.category] = { category: r.category, count: 0, agentExecutions: 0, progress: 0 };
    }
    const c = byCategory[r.category];
    c.count += 1;
    c.agentExecutions += r.agentExecutions;
    c.progress += r.progress;
  }
  const categories = Object.values(byCategory).map((c) => ({
    ...c,
    avgProgress: c.count ? Math.round(c.progress / c.count) : 0,
    ordersToday: orders.orderCountToday,
    revenueToday: orders.todayUsd,
  }));

  const topPerformers = [...today]
    .sort((a, b) => b.agentExecutions - a.agentExecutions || b.progress - a.progress)
    .slice(0, 5);

  const needsAttention = [...today]
    .filter((r) => r.progress < 30 && r.status !== "已完成")
    .sort((a, b) => a.progress - b.progress)
    .slice(0, 5);

  const trend = (history || []).slice(-7).map((h) => ({
    date: h.date,
    orders: h.totals?.ordersToday || 0,
    revenueUsd: h.totals?.revenueTodayUsd || 0,
    agentRuns: h.totals?.agentRunsToday || 0,
    avgProgress: h.totals?.avgProgress || 0,
  }));

  const yesterday = history?.length >= 2 ? history[history.length - 2]?.totals : null;
  const growth = {
    orders: yesterday?.ordersToday
      ? Math.round(((totals.ordersToday - yesterday.ordersToday) / Math.max(yesterday.ordersToday, 1)) * 100)
      : totals.ordersToday > 0 ? 100 : 0,
    revenue: yesterday?.revenueTodayUsd
      ? Math.round(((totals.revenueTodayUsd - yesterday.revenueTodayUsd) / Math.max(yesterday.revenueTodayUsd, 1)) * 100)
      : totals.revenueTodayUsd > 0 ? 100 : 0,
    progress: yesterday?.avgProgress ? totals.avgProgress - yesterday.avgProgress : 0,
  };

  const insights = [];
  insights.push(`今日真实付款订单 ${totals.ordersToday} 笔，累计 ${totals.ordersPaid} 笔已付款。`);
  insights.push(`今日真实收益 $${totals.revenueTodayUsd} / ¥${totals.revenueTodayCny}（来自客户付款订单）。`);
  insights.push(`今日 AI 推广执行 ${totals.agentRunsToday} 次，一键启动 ${totals.launchesToday} 次。`);
  if (topPerformers[0]?.agentExecutions > 0) {
    insights.push(`最活跃渠道：${topPerformers[0].label}（${topPerformers[0].agentExecutions} 次 AI 执行记录）。`);
  } else if (needsAttention[0]) {
    insights.push(`建议点击「一键启动」推进：${needsAttention[0].label}（进度 ${needsAttention[0].progress}%）。`);
  }
  insights.push("全部渠道媒体花费 $0/¥0 — 零成本有机推广。");

  return { totals, categories, topPerformers, needsAttention, trend, growth, insights };
}

export function getMarketingAnalyticsDashboard(companyId, company = null, userEmail = null) {
  const today = new Date().toISOString().slice(0, 10);
  const marketing = getMarketingDashboard(companyId, company, userEmail);
  const contentMarketing = getContentMarketingDashboard(companyId, company, userEmail);
  const logs = getLogs(companyId, 500);
  const orders = getRealOrderMetrics();
  const activity = getCompanyMarketingActivity(companyId);
  const rows = buildDailyRows(companyId, today, marketing, contentMarketing, logs, orders);

  const state = getState(companyId);
  const totals = {
    ordersToday: orders.orderCountToday,
    revenueTodayUsd: orders.todayUsd,
    revenueTodayCny: orders.todayCny,
    agentRunsToday: activity.agentRunsToday,
    avgProgress: rows.length ? Math.round(rows.reduce((s, r) => s + r.progress, 0) / rows.length) : 0,
  };
  let dayEntry = state.history.find((h) => h.date === today);
  if (!dayEntry) {
    dayEntry = { date: today, totals };
    state.history.push(dayEntry);
  } else {
    dayEntry.totals = totals;
  }
  state.history = state.history.slice(-30);
  state.lastSync = new Date().toISOString();
  saveState(state);

  const analysis = aggregateAnalysis(rows, state.history, orders, activity);
  const realSales = buildRealSalesBlock(
    marketing.sales?.goal || { revenueTarget: 5000, currency: "USD" },
    userEmail || company?.email
  );

  return {
    companyId,
    date: today,
    methodsTotal: ALL_MARKETING_METHODS.length,
    dataSource: "real",
    zeroCostNote: "真实数据：收益=客户付款订单，执行次数=AI活动日志，进度=实际任务状态",
    orders,
    activity,
    realSales,
    data: { rows, summary: analysis.totals },
    analysis,
    updatedAt: new Date().toISOString(),
  };
}
