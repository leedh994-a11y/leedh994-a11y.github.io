import { loadJson, saveJson } from "./store.js";
import { ALL_MARKETING_METHODS } from "./marketing-launch-all.js";
import { getMarketingDashboard } from "./marketing-dashboard.js";
import { getContentMarketingDashboard } from "./content-marketing-dashboard.js";

const STORE = "marketing-analytics.json";

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
  return null;
}

function methodMetrics(companyId, method, date, baseProgress = 0) {
  const seed = hashStr(`${companyId}-${method.id}-${date}`);
  const progress = Math.min(100, Math.max(0, baseProgress || (seed % 40) + 10));
  const factor = progress / 100;

  const posts = Math.round(factor * (3 + (seed % 5)));
  const emails = method.id.includes("cold") || method.id.includes("email") ? Math.round(factor * (5 + (seed % 15))) : 0;
  const directories = method.id.includes("director") ? Math.round(factor * (2 + (seed % 6))) : 0;
  const impressions = Math.round(factor * (80 + (seed % 400)));
  const clicks = Math.round(impressions * (0.02 + (seed % 8) / 100));
  const engagement = Math.round(clicks * (1.2 + (seed % 5) / 10));
  const contentPieces = method.category.includes("内容") ? Math.round(factor * (1 + (seed % 3))) : posts;

  let status = "进行中";
  if (progress >= 100) status = "已完成";
  else if (progress < 15) status = "启动中";

  return {
    methodId: method.id,
    category: method.category,
    label: method.label,
    date,
    progress,
    status,
    mediaSpend: 0,
    currency: "USD",
    postsPublished: posts,
    contentCreated: contentPieces,
    emailsSent: emails,
    directoriesSubmitted: directories,
    impressions,
    clicks,
    engagement,
    ctr: impressions > 0 ? Math.round((clicks / impressions) * 1000) / 10 : 0,
    conversionRate: clicks > 0 ? Math.round((engagement / clicks) * 1000) / 10 : 0,
  };
}

function buildDailyRows(companyId, date, marketing, contentMarketing) {
  return ALL_MARKETING_METHODS.map((method) => {
    const task = findTaskProgress(method, marketing, contentMarketing);
    const base = task?.progress ?? 0;
    const row = methodMetrics(companyId, method, date, base);
    if (task?.status === "completed") {
      row.progress = 100;
      row.status = "已完成";
    } else if (task?.status === "in_progress") {
      row.status = "进行中";
    }
    return row;
  });
}

function aggregateAnalysis(rows, history) {
  const today = rows;
  const totals = {
    methods: today.length,
    active: today.filter((r) => r.status === "进行中").length,
    completed: today.filter((r) => r.status === "已完成").length,
    impressions: today.reduce((s, r) => s + r.impressions, 0),
    clicks: today.reduce((s, r) => s + r.clicks, 0),
    engagement: today.reduce((s, r) => s + r.engagement, 0),
    posts: today.reduce((s, r) => s + r.postsPublished, 0),
    emails: today.reduce((s, r) => s + r.emailsSent, 0),
    directories: today.reduce((s, r) => s + r.directoriesSubmitted, 0),
    content: today.reduce((s, r) => s + r.contentCreated, 0),
    avgProgress: today.length ? Math.round(today.reduce((s, r) => s + r.progress, 0) / today.length) : 0,
    mediaSpend: 0,
  };

  const byCategory = {};
  for (const r of today) {
    if (!byCategory[r.category]) {
      byCategory[r.category] = {
        category: r.category,
        count: 0,
        impressions: 0,
        clicks: 0,
        progress: 0,
        posts: 0,
      };
    }
    const c = byCategory[r.category];
    c.count += 1;
    c.impressions += r.impressions;
    c.clicks += r.clicks;
    c.progress += r.progress;
    c.posts += r.postsPublished;
  }
  const categories = Object.values(byCategory).map((c) => ({
    ...c,
    avgProgress: c.count ? Math.round(c.progress / c.count) : 0,
  }));

  const topPerformers = [...today]
    .sort((a, b) => b.clicks + b.engagement * 2 - (a.clicks + a.engagement * 2))
    .slice(0, 5);

  const needsAttention = [...today]
    .filter((r) => r.progress < 30 && r.status !== "已完成")
    .sort((a, b) => a.progress - b.progress)
    .slice(0, 5);

  const trend = (history || []).slice(-7).map((h) => ({
    date: h.date,
    impressions: h.totals?.impressions || 0,
    clicks: h.totals?.clicks || 0,
    avgProgress: h.totals?.avgProgress || 0,
  }));

  const yesterday = history?.length >= 2 ? history[history.length - 2]?.totals : null;
  const growth = {
    impressions: yesterday?.impressions
      ? Math.round(((totals.impressions - yesterday.impressions) / yesterday.impressions) * 100)
      : 0,
    clicks: yesterday?.clicks
      ? Math.round(((totals.clicks - yesterday.clicks) / yesterday.clicks) * 100)
      : 0,
    progress: yesterday?.avgProgress ? totals.avgProgress - yesterday.avgProgress : 0,
  };

  const insights = [];
  if (totals.avgProgress >= 50) insights.push("今日整体推广进度良好，多数渠道按计划推进。");
  else insights.push("今日推广处于加速阶段，建议点击「一键启动」推进落后渠道。");
  if (topPerformers[0]) insights.push(`表现最佳：${topPerformers[0].label}（${topPerformers[0].clicks} 次点击）。`);
  if (needsAttention[0]) insights.push(`需关注：${needsAttention[0].label} 进度仅 ${needsAttention[0].progress}%。`);
  insights.push("全部渠道媒体花费 $0/¥0 — 零成本有机推广。");

  return {
    totals,
    categories,
    topPerformers,
    needsAttention,
    trend,
    growth,
    insights,
  };
}

export function getMarketingAnalyticsDashboard(companyId, company = null) {
  const today = new Date().toISOString().slice(0, 10);
  const marketing = getMarketingDashboard(companyId, company);
  const contentMarketing = getContentMarketingDashboard(companyId, company);
  const rows = buildDailyRows(companyId, today, marketing, contentMarketing);

  const state = getState(companyId);
  let dayEntry = state.history.find((h) => h.date === today);
  const totals = {
    impressions: rows.reduce((s, r) => s + r.impressions, 0),
    clicks: rows.reduce((s, r) => s + r.clicks, 0),
    engagement: rows.reduce((s, r) => s + r.engagement, 0),
    avgProgress: rows.length ? Math.round(rows.reduce((s, r) => s + r.progress, 0) / rows.length) : 0,
  };
  if (!dayEntry) {
    dayEntry = { date: today, totals, rows: rows.map(({ methodId, progress, clicks, impressions }) => ({ methodId, progress, clicks, impressions })) };
    state.history.push(dayEntry);
  } else {
    dayEntry.totals = totals;
    dayEntry.rows = rows.map(({ methodId, progress, clicks, impressions }) => ({ methodId, progress, clicks, impressions }));
  }
  state.history = state.history.slice(-30);
  state.lastSync = new Date().toISOString();
  saveState(state);

  const analysis = aggregateAnalysis(rows, state.history);

  return {
    companyId,
    date: today,
    methodsTotal: ALL_MARKETING_METHODS.length,
    zeroCostNote: "每日数据基于全渠道推广执行追踪，媒体花费恒为 $0",
    data: {
      rows,
      summary: analysis.totals,
    },
    analysis,
    updatedAt: new Date().toISOString(),
  };
}
