import { getLogs, loadJson } from "./store.js";
import { ALL_MARKETING_METHODS } from "./marketing-launch-all.js";
import { getMarketingDashboard } from "./marketing-dashboard.js";
import { getContentMarketingDashboard } from "./content-marketing-dashboard.js";
import {
  getRealOrderMetrics,
  getCompanyMarketingActivity,
  buildRealSalesBlock,
} from "./marketing-real-metrics.js";

const LAUNCH_STORE = "marketing-launch-log.json";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function methodSearchTerms(method) {
  return [
    method.id,
    method.category,
    ...method.label.split(/[\s/()（）、·]+/).filter((w) => w.length > 1),
  ].map((t) => t.toLowerCase());
}

function textMatchesMethod(text, method) {
  const hay = (text || "").toLowerCase();
  return methodSearchTerms(method).some((t) => t.length > 2 && hay.includes(t));
}

function logMatchesMethod(log, method) {
  const text = `${log.agent || ""} ${log.message || ""} ${log.question || ""}`;
  return textMatchesMethod(text, method);
}

function inferDeliverableType(method, log) {
  const id = method.id;
  const map = {
    seo_articles: "SEO文章",
    blog: "博客",
    landing_pages: "落地页",
    social_posts: "社媒帖子",
    meta_seo: "Meta/结构化SEO",
    free_seo: "站内SEO",
    organic_social: "有机社媒",
    google_business: "Google Business",
    free_directories: "目录提交",
    zero_spend: "零花费合规",
    cold_email: "冷邮件",
    directory_submit: "目录批量提交",
    community: "社区推广",
    haro: "HARO公关",
    referral: "口碑推荐",
  };
  if (map[id]) return map[id];
  if (id.startsWith("platform_")) return "平台有机推广";
  if (id.startsWith("channel_")) return "免费渠道";
  if ((log.agent || "").toLowerCase().includes("marketing")) return "营销推广";
  return method.category;
}

function deliverableFromLog(log, method) {
  const body = log.message || log.question || "";
  if (!body.trim()) return null;
  return {
    id: `log-${log.at}-${method.id}`.replace(/[^a-zA-Z0-9_-]/g, "_"),
    methodId: method.id,
    methodLabel: method.label,
    category: method.category,
    type: inferDeliverableType(method, log),
    title: body.slice(0, 80) + (body.length > 80 ? "…" : ""),
    body,
    agent: log.agent || "System",
    at: log.at,
    date: (log.at || "").slice(0, 10),
    status: "published",
    isReal: true,
    source: "company_activity_log",
  };
}

function deliverableFromLaunchAgent(result, launch, method) {
  const body = result.content || result.preview || "";
  if (!body.trim()) return null;
  return {
    id: `launch-${launch.at}-${result.agentId}-${method.id}`.replace(/[^a-zA-Z0-9_-]/g, "_"),
    methodId: method.id,
    methodLabel: method.label,
    category: method.category,
    type: inferDeliverableType(method, { agent: result.agentName }),
    title: `${result.agentName || result.agentId} · 一键启动输出`,
    body,
    agent: result.agentName || result.agentId,
    at: launch.at || launch.startedAt,
    date: (launch.at || launch.startedAt || "").slice(0, 10),
    status: "published",
    websiteUrl: launch.websiteUrl || null,
    ai: Boolean(result.ai),
    isReal: true,
    source: "launch_agent_output",
  };
}

function deliverableFromTask(task, method) {
  return {
    id: task.id || `task-${method.id}-${task.title}`,
    methodId: method.id,
    methodLabel: method.label,
    category: method.category,
    type: task.output || task.method || "任务产出",
    title: task.title,
    body: `${task.title} — ${task.method || ""} · 进度 ${task.progress || 0}% · 状态 ${task.status || "scheduled"}`,
    agent: task.platform || task.pillarTitle || "Marketing",
    at: task.dueAt || task.updatedAt || new Date().toISOString(),
    date: (task.dueAt || task.updatedAt || "").slice(0, 10) || todayIso(),
    status: task.status === "completed" ? "published" : task.status === "in_progress" ? "running" : "scheduled",
    progress: task.progress || 0,
    isReal: true,
    source: "marketing_task_state",
  };
}

function findRelatedTasks(method, marketing, contentMarketing) {
  const label = method.label.toLowerCase();
  const all = [
    ...(marketing?.tasks?.items || []).map((t) => ({ ...t, _from: "marketing" })),
    ...(contentMarketing?.tasks?.items || []).map((t) => ({ ...t, _from: "content" })),
  ];
  return all.filter((t) => {
    const text = `${t.title || ""} ${t.method || ""} ${t.platform || ""} ${t.output || ""}`.toLowerCase();
    return (
      textMatchesMethod(text, method) ||
      label.slice(0, 4).length >= 2 && text.includes(label.slice(0, 4))
    );
  });
}

function statusFromProgress(progress, status) {
  if (status === "completed" || progress >= 100) return "已完成";
  if (status === "in_progress" || progress > 0) return "进行中";
  return "待启动";
}

function timelineFromLaunch(launch) {
  return {
    id: `tl-launch-${launch.at}`,
    kind: "launch",
    at: launch.at || launch.startedAt,
    date: (launch.at || launch.startedAt || "").slice(0, 10),
    title: "一键启动全渠道推广",
    body: `部署 ${launch.methodsTotal || ALL_MARKETING_METHODS.length} 种零成本推广 · 目标网站 ${launch.websiteUrl || "—"}`,
    agent: "System",
    methodsCount: launch.methodsTotal || ALL_MARKETING_METHODS.length,
    websiteUrl: launch.websiteUrl,
    isReal: true,
    source: "marketing_launch_log",
  };
}

function timelineFromLog(log) {
  const body = log.message || log.question || "";
  if (!body.trim()) return null;
  return {
    id: `tl-log-${log.at}-${(log.agent || "").slice(0, 8)}`,
    kind: log.type === "question" ? "question" : log.role === "agent" ? "agent" : "activity",
    at: log.at,
    date: (log.at || "").slice(0, 10),
    title: log.agent || "System",
    body,
    agent: log.agent || "System",
    ai: log.ai,
    isReal: true,
    source: "company_activity_log",
  };
}

function getCompanyLaunches(companyId) {
  const data = loadJson(LAUNCH_STORE, { launches: [] });
  return (data.launches || []).filter((l) => l.companyId === companyId);
}

export function getMarketingOperationsDashboard(companyId, company = null, userEmail = null) {
  const today = todayIso();
  const logs = getLogs(companyId, 500);
  const orders = getRealOrderMetrics();
  const activity = getCompanyMarketingActivity(companyId);
  const marketing = getMarketingDashboard(companyId, company, userEmail);
  const contentMarketing = getContentMarketingDashboard(companyId, company, userEmail);
  const launches = getCompanyLaunches(companyId);
  const realSales = buildRealSalesBlock(
    marketing.sales?.goal || { revenueTarget: 5000, currency: "USD" },
    userEmail || company?.email
  );

  const methods = ALL_MARKETING_METHODS.map((method) => {
    const tasks = findRelatedTasks(method, marketing, contentMarketing);
    const progress = tasks.length
      ? Math.round(tasks.reduce((s, t) => s + (t.progress || 0), 0) / tasks.length)
      : 0;
    const status = tasks.some((t) => t.status === "in_progress")
      ? "in_progress"
      : tasks.some((t) => t.status === "completed")
        ? tasks.every((t) => t.status === "completed")
          ? "completed"
          : "in_progress"
        : progress > 0
          ? "in_progress"
          : "scheduled";

    const logDeliverables = logs
      .filter((l) => logMatchesMethod(l, method))
      .map((l) => deliverableFromLog(l, method))
      .filter(Boolean);

    const launchDeliverables = [];
    for (const launch of launches) {
      for (const result of launch.agentResults || []) {
        const d = deliverableFromLaunchAgent(result, launch, method);
        if (d) launchDeliverables.push(d);
      }
    }

    const taskDeliverables = tasks
      .filter((t) => (t.progress || 0) > 0 || t.status !== "scheduled")
      .map((t) => deliverableFromTask(t, method));

    const deliverables = [...logDeliverables, ...launchDeliverables, ...taskDeliverables]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 50);

    const executionsToday = logs.filter(
      (l) => (l.at || "").slice(0, 10) === today && logMatchesMethod(l, method)
    ).length;

    return {
      id: method.id,
      category: method.category,
      label: method.label,
      progress,
      status: statusFromProgress(progress, status),
      statusKey: status,
      executionsToday,
      executionsTotal: logDeliverables.length,
      deliverablesCount: deliverables.length,
      tasks,
      deliverables,
      mediaSpend: 0,
      currency: "USD",
      isReal: true,
    };
  });

  const contentFeed = methods
    .flatMap((m) => m.deliverables)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 200);

  const running = methods
    .flatMap((m) =>
      (m.tasks || [])
        .filter((t) => t.status === "in_progress" || ((t.progress || 0) > 0 && (t.progress || 0) < 100))
        .map((t) => ({
          methodId: m.id,
          methodLabel: m.label,
          taskId: t.id,
          title: t.title,
          progress: t.progress || 0,
          status: t.status,
          dueAt: t.dueAt,
          isReal: true,
          source: "marketing_task_state",
        }))
    )
    .slice(0, 30);

  const timeline = [
    ...launches.map(timelineFromLaunch),
    ...logs.map(timelineFromLog).filter(Boolean),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 300);

  const launchHistory = launches
    .slice()
    .reverse()
    .map((l) => ({
      at: l.at || l.startedAt,
      websiteUrl: l.websiteUrl,
      methodsTotal: l.methodsTotal || ALL_MARKETING_METHODS.length,
      agentsLaunched: l.agentsLaunched || [],
      agentResults: (l.agentResults || []).map((r) => ({
        agentId: r.agentId,
        agentName: r.agentName,
        ai: r.ai,
        content: r.content || r.preview || "",
        preview: (r.content || r.preview || "").slice(0, 200),
        etaDays: r.etaDays,
      })),
      marketingProgress: l.marketingProgress,
      contentMarketingProgress: l.contentMarketingProgress,
      isReal: true,
      source: "marketing_launch_log",
    }));

  const byDay = {};
  for (const item of contentFeed) {
    const d = item.date || today;
    if (!byDay[d]) byDay[d] = { date: d, items: [], count: 0 };
    byDay[d].items.push(item);
    byDay[d].count += 1;
  }

  const byCategory = {};
  for (const m of methods) {
    if (!byCategory[m.category]) {
      byCategory[m.category] = { category: m.category, methods: 0, deliverables: 0, progress: 0 };
    }
    byCategory[m.category].methods += 1;
    byCategory[m.category].deliverables += m.deliverablesCount;
    byCategory[m.category].progress += m.progress;
  }
  const categories = Object.values(byCategory).map((c) => ({
    ...c,
    avgProgress: c.methods ? Math.round(c.progress / c.methods) : 0,
  }));

  return {
    companyId,
    date: today,
    methodsTotal: ALL_MARKETING_METHODS.length,
    dataSource: "real",
    zeroCostNote: "真实数据：内容/执行记录=公司活动日志+一键启动记录+任务状态；收益=客户付款订单",
    isReal: true,
    summary: {
      methodsTotal: ALL_MARKETING_METHODS.length,
      activeMethods: methods.filter((m) => m.status === "进行中").length,
      completedMethods: methods.filter((m) => m.status === "已完成").length,
      deliverablesTotal: contentFeed.length,
      runningTasks: running.length,
      agentRunsToday: activity.agentRunsToday,
      agentRunsTotal: activity.agentRunsTotal,
      launchesToday: activity.launchesToday,
      launchesTotal: activity.launchesTotal,
      lastLaunchAt: activity.lastLaunchAt,
      ordersToday: orders.orderCountToday,
      revenueTodayUsd: orders.todayUsd,
      revenueTodayCny: orders.todayCny,
      customersToday: orders.customersToday,
      avgProgress: methods.length
        ? Math.round(methods.reduce((s, m) => s + m.progress, 0) / methods.length)
        : 0,
      mediaSpend: 0,
    },
    orders,
    activity,
    realSales,
    methods,
    categories,
    contentFeed,
    running,
    timeline,
    launchHistory,
    byDay: Object.values(byDay).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30),
    updatedAt: new Date().toISOString(),
  };
}
