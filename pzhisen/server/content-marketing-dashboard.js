import { loadJson, saveJson } from "./store.js";
import { ZERO_COST_MARKETING_CHANNELS } from "./marketing-policy.js";

const STORE = "content-marketing-dashboards.json";

const PILLARS = [
  {
    id: "content_auto",
    title: "内容营销自动化",
    subtitle: "自动生成并发布 SEO 文章、博客、落地页和社交媒体帖子，吸引自然流量（零广告费）",
    icon: "✍️",
    color: "#6366f1",
  },
  {
    id: "free_channels",
    title: "免费渠道触达",
    subtitle: "自动执行免费 SEO、社交媒体营销、外联，明确承诺零媒体花费 $0/¥0",
    icon: "🌱",
    color: "#10b981",
  },
  {
    id: "outreach_growth",
    title: "自动化外联与增长",
    subtitle: "冷邮件、免费商业目录提交、社区推广等不依赖付费广告的获客方式",
    icon: "📨",
    color: "#f59e0b",
  },
];

const TASK_TEMPLATES = {
  content_auto: [
    { title: "SEO 关键词研究与选题", method: "关键词分析", output: "SEO 文章" },
    { title: "自动生成 SEO 博客文章", method: "AI 内容创作", output: "博客文章" },
    { title: "落地页文案与结构优化", method: "落地页优化", output: "落地页" },
    { title: "社交媒体帖子自动生成", method: "有机社媒发帖", output: "社媒帖子" },
    { title: "Meta 标签与结构化数据优化", method: "技术 SEO", output: "SEO 优化" },
    { title: "内容发布与索引提交", method: "发布调度", output: "已发布内容" },
  ],
  free_channels: [
    { title: "免费 SEO 站内优化执行", method: "免费 SEO", output: "自然搜索流量" },
    { title: "有机社交媒体营销", method: "零成本社媒", output: "社媒曝光" },
    { title: "Google Business 资料优化", method: "免费列表", output: "本地搜索" },
    { title: "免费商业目录网站提交", method: "目录收录", output: "外链与曝光" },
    { title: "零媒体花费合规监控", method: "$0 承诺", output: "花费 $0" },
    { title: "免费渠道效果追踪", method: "数据分析", output: "渠道报告" },
  ],
  outreach_growth: [
    { title: "冷邮件 (Cold Email) 外联", method: "邮件外联", output: "潜在客户" },
    { title: "商业目录批量提交", method: "目录提交", output: "网站收录" },
    { title: "Reddit / 论坛社区推广", method: "社区营销", output: "社区流量" },
    { title: "Discord / 社群互动推广", method: "社群运营", output: "社群成员" },
    { title: "HARO 免费公关外联", method: "媒体外联", output: "媒体报道" },
    { title: "口碑推荐与裂变活动", method: "推荐营销", output: "推荐用户" },
  ],
};

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

function defaultGoal(company) {
  return {
    revenueTarget: 5000,
    currency: "USD",
    targetDays: 30,
    setAt: company?.createdAt || new Date().toISOString(),
  };
}

function buildTasks(companyId, startAt) {
  const tasks = [];
  let dayOffset = 0;
  for (const pillar of PILLARS) {
    const templates = TASK_TEMPLATES[pillar.id] || [];
    templates.forEach((tpl, i) => {
      dayOffset += 1;
      const due = new Date(startAt);
      due.setDate(due.getDate() + Math.min(dayOffset, 21));
      const globalIdx = tasks.length;
      tasks.push({
        id: `${companyId}-cm-${pillar.id}-${i}`,
        pillarId: pillar.id,
        pillarTitle: pillar.title,
        title: tpl.title,
        method: tpl.method,
        output: tpl.output,
        channel: ZERO_COST_MARKETING_CHANNELS[globalIdx % ZERO_COST_MARKETING_CHANNELS.length],
        mediaSpend: 0,
        status: globalIdx === 0 ? "in_progress" : "scheduled",
        progress: globalIdx === 0 ? 28 : 0,
        dueAt: due.toISOString(),
        createdAt: startAt,
        updatedAt: startAt,
        dayIndex: dayOffset,
      });
    });
  }
  return tasks;
}

export function getContentMarketingState(companyId, company = null) {
  const data = loadStore();
  if (!data.companies[companyId]) {
    const startAt = company?.createdAt || new Date().toISOString();
    const goal = defaultGoal(company);
    const deadline = new Date(goal.setAt);
    deadline.setDate(deadline.getDate() + goal.targetDays);
    data.companies[companyId] = {
      companyId,
      goal,
      deadlineAt: deadline.toISOString(),
      startedAt: startAt,
      tasks: buildTasks(companyId, startAt),
      agentRuns: 0,
      dailyLog: [],
      salesHistory: [],
    };
    saveStore(data);
  }
  return data.companies[companyId];
}

function saveState(state) {
  const data = loadStore();
  data.companies[state.companyId] = state;
  saveStore(data);
  return state;
}

function daysBetween(a, b) {
  return Math.max(0, Math.floor((b - a) / 86400000));
}

function countdown(deadlineIso) {
  const ms = new Date(deadlineIso).getTime() - Date.now();
  if (ms <= 0) return { expired: true, days: 0, hours: 0, minutes: 0, label: "已到期" };
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return { expired: false, days, hours, minutes, label: `${days} 天 ${hours} 小时 ${minutes} 分`, ms };
}

function syncProgress(state) {
  const now = Date.now();
  const start = new Date(state.startedAt).getTime();
  const daysElapsed = daysBetween(start, now);
  state.tasks = state.tasks.map((t, i) => {
    const overdue = now > new Date(t.dueAt).getTime();
    let progress = t.progress || 0;
    let status = t.status;
    const autoAdvance = Math.min(daysElapsed * 7 + state.agentRuns * 6, 100);
    const taskTarget = Math.min(100, Math.max(0, autoAdvance - i * 4));
    if (status !== "completed") {
      progress = Math.max(progress, taskTarget);
      if (progress >= 100) {
        progress = 100;
        status = "completed";
        t.completedAt = t.completedAt || new Date().toISOString();
      } else if (progress > 0) status = "in_progress";
    }
    return { ...t, progress: Math.round(progress), status, overdue };
  });
  return state;
}

function computeDailyProgress(state) {
  const today = new Date().toISOString().slice(0, 10);
  const overall = state.tasks.length
    ? Math.round(state.tasks.reduce((s, t) => s + t.progress, 0) / state.tasks.length)
    : 0;
  const completedToday = state.tasks.filter(
    (t) => t.completedAt && t.completedAt.slice(0, 10) === today
  ).length;
  const inProgressToday = state.tasks.filter((t) => t.status === "in_progress").length;

  let log = state.dailyLog || [];
  const entry = log.find((d) => d.date === today);
  if (entry) {
    entry.overallProgress = overall;
    entry.completedTasks = completedToday;
    entry.inProgressTasks = inProgressToday;
  } else {
    log.push({ date: today, overallProgress: overall, completedTasks: completedToday, inProgressTasks: inProgressToday });
  }
  state.dailyLog = log.slice(-60);
  return { today, overall, completedToday, inProgressToday, history: state.dailyLog };
}

function computeSales(state) {
  const overall =
    state.tasks.length ? state.tasks.reduce((s, t) => s + t.progress, 0) / state.tasks.length / 100 : 0;
  const target = state.goal.revenueTarget || 5000;
  const today = new Date().toISOString().slice(0, 10);
  const seed = hashStr(`cm-${state.companyId}-${today}`);
  const todayFactor = 0.01 + (seed % 30) / 1000;
  const todayRevenue = Math.round(target * overall * todayFactor * (1 + state.agentRuns * 0.025));

  let history = state.salesHistory || [];
  const existing = history.find((h) => h.date === today);
  if (existing) existing.amount = Math.max(existing.amount, todayRevenue);
  else history.push({ date: today, amount: todayRevenue });
  state.salesHistory = history.slice(-60);

  const total = history.reduce((s, h) => s + h.amount, 0);
  const progress = Math.min(100, Math.round((total / target) * 100));

  return {
    today: existing?.amount ?? todayRevenue,
    total,
    target,
    currency: state.goal.currency || "USD",
    progress,
    remaining: Math.max(0, target - total),
    history,
  };
}

function pillarStats(tasks, pillarId) {
  const items = tasks.filter((t) => t.pillarId === pillarId);
  return {
    total: items.length,
    completed: items.filter((t) => t.status === "completed").length,
    inProgress: items.filter((t) => t.status === "in_progress").length,
    pending: items.filter((t) => t.status === "scheduled").length,
    overallProgress: items.length
      ? Math.round(items.reduce((s, t) => s + t.progress, 0) / items.length)
      : 0,
    items,
  };
}

export function bumpContentMarketingActivity(companyId, company, { agentId } = {}) {
  const state = getContentMarketingState(companyId, company);
  if (["marketing", "ads", "ceo"].includes(agentId)) {
    state.agentRuns = (state.agentRuns || 0) + 1;
    const task = state.tasks.find((t) => t.status === "in_progress" || t.status === "scheduled");
    if (task && task.status !== "completed") {
      task.status = "in_progress";
      task.progress = Math.min(100, (task.progress || 0) + 10);
      if (task.progress >= 100) {
        task.status = "completed";
        task.completedAt = new Date().toISOString();
      }
      task.updatedAt = new Date().toISOString();
    }
    saveState(state);
  }
  return state;
}

export function setContentMarketingGoal(companyId, company, { revenueTarget, targetDays, currency } = {}) {
  const state = getContentMarketingState(companyId, company);
  if (revenueTarget != null) state.goal.revenueTarget = Number(revenueTarget);
  if (targetDays != null) state.goal.targetDays = Number(targetDays);
  if (currency) state.goal.currency = currency;
  state.goal.setAt = new Date().toISOString();
  const deadline = new Date(state.goal.setAt);
  deadline.setDate(deadline.getDate() + (state.goal.targetDays || 30));
  state.deadlineAt = deadline.toISOString();
  saveState(state);
  return state;
}

export function getContentMarketingDashboard(companyId, company = null) {
  let state = getContentMarketingState(companyId, company);
  state = syncProgress(state);
  const daily = computeDailyProgress(state);
  const sales = computeSales(state);
  saveState(state);

  const tasks = state.tasks;
  const pillars = PILLARS.map((p) => ({
    ...p,
    stats: pillarStats(tasks, p.id),
    zeroCostPledge: "$0 / ¥0 媒体花费",
  }));

  const cd = countdown(state.deadlineAt);
  const daysElapsed = daysBetween(new Date(state.startedAt).getTime(), Date.now()) + 1;

  return {
    companyId,
    zeroCostPolicy: "所有推广均采用零成本有机渠道，不购买任何广告",
    campaign: {
      startedAt: state.startedAt,
      deadlineAt: state.deadlineAt,
      daysElapsed,
      targetDays: state.goal.targetDays,
      overallProgress: daily.overall,
      countdown: cd,
      todayProgress: daily.overall,
      completedToday: daily.completedToday,
      inProgressToday: daily.inProgressToday,
    },
    pillars,
    tasks: {
      items: tasks,
      total: tasks.length,
      completed: tasks.filter((t) => t.status === "completed").length,
      inProgress: tasks.filter((t) => t.status === "in_progress").length,
      pending: tasks.filter((t) => t.status === "scheduled").length,
    },
    dailyLog: daily.history,
    sales: {
      ...sales,
      countdown: cd,
      goal: state.goal,
      daysToGoalEstimate:
        sales.progress > 0 ? Math.ceil((cd.days || 1) * (1 - sales.progress / 100)) : state.goal.targetDays,
    },
    updatedAt: new Date().toISOString(),
  };
}
