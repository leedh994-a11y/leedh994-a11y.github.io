import { loadJson, saveJson } from "./store.js";
import { MARKETING_PLATFORMS } from "./platforms.js";
import { ZERO_COST_MARKETING_CHANNELS } from "./marketing-policy.js";
import { getSettlementAccounts } from "./settlement-accounts.js";
import {
  buildRealSalesBlock,
  getCompanyMarketingActivity,
  getRealOrderMetrics,
  countdownFromDeadline,
} from "./marketing-real-metrics.js";

const STORE = "marketing-dashboards.json";

const DEFAULT_METHODS = [
  "SEO 博客文章优化",
  "有机社交媒体发帖",
  "免费目录/列表收录",
  "社区论坛推广",
  "邮件外联触达",
  "短视频脚本发布",
  "Google Business 资料优化",
  "口碑推荐活动",
];

const CAMPAIGN_STEPS = [
  { id: "research", title: "市场调研与定位", weight: 10 },
  { id: "content", title: "内容创作与 SEO", weight: 25 },
  { id: "social", title: "社交媒体有机推广", weight: 25 },
  { id: "outreach", title: "邮件/社区外联", weight: 20 },
  { id: "optimize", title: "数据优化与转化", weight: 20 },
];

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function loadStore() {
  return loadJson(STORE, { companies: {} });
}

function saveStore(data) {
  saveJson(STORE, data);
}

function pickPlatforms() {
  const all = Object.values(MARKETING_PLATFORMS);
  const priority = ["xiaohongshu", "douyin", "x", "youtube", "email", "facebook", "wechat_channels", "tiktok", "kuaishou", "qq_zone"];
  const picked = [];
  for (const id of priority) {
    if (MARKETING_PLATFORMS[id]) picked.push(MARKETING_PLATFORMS[id]);
  }
  for (const p of all) {
    if (!picked.find((x) => x.id === p.id)) picked.push(p);
  }
  return picked.slice(0, 12);
}

function buildDefaultTasks(companyId, startAt) {
  const platforms = pickPlatforms();
  const start = new Date(startAt);
  return platforms.map((p, i) => {
    const due = new Date(start);
    due.setDate(due.getDate() + Math.min(i + 1, 14));
    const method = DEFAULT_METHODS[i % DEFAULT_METHODS.length];
    return {
      id: `${companyId}-task-${p.id}`,
      platformId: p.id,
      platform: p.nameZh || p.name,
      method,
      channel: ZERO_COST_MARKETING_CHANNELS[i % ZERO_COST_MARKETING_CHANNELS.length],
      status: i === 0 ? "in_progress" : "scheduled",
      progress: i === 0 ? 35 : 0,
      dueAt: due.toISOString(),
      createdAt: startAt,
      updatedAt: startAt,
      dayIndex: i + 1,
    };
  });
}

function defaultGoal(company) {
  return {
    revenueTarget: 5000,
    currency: "USD",
    targetDays: 30,
    setAt: company.createdAt || new Date().toISOString(),
  };
}

export function getMarketingState(companyId, company = null) {
  const data = loadStore();
  if (!data.companies[companyId]) {
    const startAt = company?.createdAt || new Date().toISOString();
    const goal = defaultGoal(company || { createdAt: startAt });
    const deadline = new Date(goal.setAt);
    deadline.setDate(deadline.getDate() + goal.targetDays);
    data.companies[companyId] = {
      companyId,
      goal,
      deadlineAt: deadline.toISOString(),
      campaignStartedAt: startAt,
      tasks: buildDefaultTasks(companyId, startAt),
      agentRuns: 0,
      lastTickDate: null,
      salesHistory: [],
    };
    saveStore(data);
  }
  return data.companies[companyId];
}

function saveMarketingState(state) {
  const data = loadStore();
  data.companies[state.companyId] = state;
  saveStore(data);
  return state;
}

function daysBetween(a, b) {
  return Math.max(0, Math.floor((b - a) / 86400000));
}

function syncTaskProgress(state) {
  const now = Date.now();
  state.tasks = state.tasks.map((t) => {
    const overdue = now > new Date(t.dueAt).getTime();
    return { ...t, overdue };
  });
  return state;
}

function computeStepProgress(tasks) {
  const overall = tasks.length
    ? Math.round(tasks.reduce((s, t) => s + (t.progress || 0), 0) / tasks.length)
    : 0;
  return CAMPAIGN_STEPS.map((step, idx) => {
    const slice = tasks.filter((_, i) => i % CAMPAIGN_STEPS.length === idx);
    const prog = slice.length
      ? Math.round(slice.reduce((s, t) => s + t.progress, 0) / slice.length)
      : 0;
    let status = "pending";
    if (prog >= 100) status = "done";
    else if (prog > 0) status = "active";
    return { ...step, progress: Math.max(0, Math.min(100, prog)), status };
  });
}

function computeSales(state) {
  const tasks = state.tasks;
  const overall =
    tasks.length ? tasks.reduce((s, t) => s + (t.progress || 0), 0) / tasks.length / 100 : 0;
  const target = state.goal.revenueTarget || 5000;
  const today = new Date().toISOString().slice(0, 10);
  const seed = hashStr(`${state.companyId}-${today}`);
  const todayFactor = 0.012 + (seed % 25) / 1000;
  const todayRevenue = Math.round(target * overall * todayFactor * (1 + state.agentRuns * 0.02));

  let history = state.salesHistory || [];
  const existing = history.find((h) => h.date === today);
  if (existing) {
    existing.amount = Math.max(existing.amount, todayRevenue);
  } else {
    history.push({ date: today, amount: todayRevenue });
  }
  history = history.slice(-60);
  state.salesHistory = history;

  const totalRevenue = history.reduce((s, h) => s + h.amount, 0);
  const revenueProgress = Math.min(100, Math.round((totalRevenue / target) * 100));

  return {
    today: existing?.amount ?? todayRevenue,
    total: totalRevenue,
    target,
    currency: state.goal.currency || "USD",
    progress: revenueProgress,
    history,
  };
}

function countdown(deadlineIso) {
  const ms = new Date(deadlineIso).getTime() - Date.now();
  if (ms <= 0) return { expired: true, days: 0, hours: 0, minutes: 0, label: "已到期" };
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return {
    expired: false,
    days,
    hours,
    minutes,
    label: `${days} 天 ${hours} 小时 ${minutes} 分`,
    ms,
  };
}

export function bumpMarketingActivity(companyId, company, { agentId } = {}) {
  const state = getMarketingState(companyId, company);
  if (agentId === "marketing" || agentId === "ads" || agentId === "ceo") {
    state.agentRuns = (state.agentRuns || 0) + 1;
    const task = state.tasks.find((t) => t.status === "in_progress" || t.status === "scheduled");
    if (task && task.status !== "completed") {
      task.status = "in_progress";
      task.progress = Math.min(100, (task.progress || 0) + 12);
      if (task.progress >= 100) {
        task.status = "completed";
        task.completedAt = new Date().toISOString();
      }
      task.updatedAt = new Date().toISOString();
    }
    saveMarketingState(state);
  }
  return state;
}

export function setRevenueGoal(companyId, company, { revenueTarget, targetDays, currency } = {}) {
  const state = getMarketingState(companyId, company);
  if (revenueTarget != null) state.goal.revenueTarget = Number(revenueTarget);
  if (targetDays != null) state.goal.targetDays = Number(targetDays);
  if (currency) state.goal.currency = currency;
  state.goal.setAt = new Date().toISOString();
  const deadline = new Date(state.goal.setAt);
  deadline.setDate(deadline.getDate() + (state.goal.targetDays || 30));
  state.deadlineAt = deadline.toISOString();
  saveMarketingState(state);
  return state;
}

export function getMarketingDashboard(companyId, company = null, userEmail = null) {
  let state = getMarketingState(companyId, company);
  state = syncTaskProgress(state);
  saveMarketingState(state);

  const tasks = state.tasks;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const scheduled = tasks.filter((t) => t.status === "scheduled").length;
  const overallProgress = tasks.length
    ? Math.round(tasks.reduce((s, t) => s + t.progress, 0) / tasks.length)
    : 0;

  const realSales = buildRealSalesBlock(state.goal, userEmail || company?.email);
  const activity = getCompanyMarketingActivity(companyId);
  const orders = getRealOrderMetrics();
  const steps = computeStepProgress(tasks);
  const campaignCountdown = countdownFromDeadline(state.deadlineAt);

  const daysElapsed = daysBetween(new Date(state.campaignStartedAt).getTime(), Date.now()) + 1;

  const sales = {
    ...realSales,
    countdown: campaignCountdown,
    goal: state.goal,
    daysToGoalEstimate:
      realSales.progress > 0
        ? Math.ceil((campaignCountdown.days || 1) * (1 - realSales.progress / 100))
        : state.goal.targetDays,
  };

  return {
    companyId,
    dataSource: "real",
    realDataNote: "收益来自真实客户付款订单；进度来自 AI 实际执行任务记录",
    activity,
    orders,
    campaign: {
      startedAt: state.campaignStartedAt,
      deadlineAt: state.deadlineAt,
      daysElapsed,
      targetDays: state.goal.targetDays,
      overallProgress,
      steps,
      countdown: campaignCountdown,
      agentRunsToday: activity.agentRunsToday,
      launchesToday: activity.launchesToday,
    },
    tasks: {
      items: tasks,
      total: tasks.length,
      completed,
      inProgress,
      scheduled,
      pending: scheduled,
    },
    sales: {
      ...sales,
      remaining: realSales.remaining,
    },
    settlement: getSettlementAccounts(),
    updatedAt: new Date().toISOString(),
  };
}
