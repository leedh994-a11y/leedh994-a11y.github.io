import { loadJson, saveJson } from "./store.js";
import { getRealOrderMetrics, getCompanyMarketingActivity } from "./marketing-real-metrics.js";
import { getMarketingState } from "./marketing-dashboard.js";

const GOALS_FILE = "daily-sales-goals.json";
const LAUNCH_LOG = "marketing-launch-log.json";

function loadGoals() {
  return loadJson(GOALS_FILE, { companies: {} });
}

function saveGoals(data) {
  saveJson(GOALS_FILE, data);
}

function defaultGoal() {
  return {
    dailyTargetUsd: 500,
    currency: "USD",
    setAt: new Date().toISOString(),
  };
}

function getGoal(companyId) {
  const data = loadGoals();
  return data.companies[companyId] || defaultGoal();
}

export function setDailySalesGoal(companyId, { dailyTargetUsd } = {}) {
  const data = loadGoals();
  const goal = data.companies[companyId] || defaultGoal();
  if (dailyTargetUsd != null) {
    const value = Number(dailyTargetUsd);
    if (!Number.isFinite(value) || value < 1) {
      throw new Error("每日目标金额须为大于 0 的数字（美元）");
    }
    goal.dailyTargetUsd = value;
  }
  goal.currency = "USD";
  goal.setAt = new Date().toISOString();
  data.companies[companyId] = goal;
  saveGoals(data);
  return goal;
}

function startOfLocalDay() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function endOfLocalDay() {
  const start = startOfLocalDay();
  return new Date(start.getTime() + 86400000);
}

function dayProgressPct() {
  const start = startOfLocalDay().getTime();
  const end = endOfLocalDay().getTime();
  const now = Date.now();
  return Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
}

function countdownToEndOfDay() {
  const ms = endOfLocalDay().getTime() - Date.now();
  if (ms <= 0) {
    return { expired: true, hours: 0, minutes: 0, seconds: 0, label: "今日已结束", ms: 0 };
  }
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return {
    expired: false,
    hours,
    minutes,
    seconds,
    ms,
    label: `${hours} 小时 ${minutes} 分`,
  };
}

function estimateHoursToComplete(remainingUsd, todayUsd, launchContext = null) {
  const start = startOfLocalDay().getTime();
  const hoursElapsed = Math.max(0.25, (Date.now() - start) / 3600000);
  const eod = countdownToEndOfDay();
  const hoursLeft = eod.hours + eod.minutes / 60 + eod.seconds / 3600;

  if (remainingUsd <= 0) {
    return {
      hours: 0,
      label: "已达成今日目标",
      onTrack: true,
      pacePerHour: todayUsd / hoursElapsed,
      source: "sales",
    };
  }

  if (todayUsd > 0) {
    const pacePerHour = todayUsd / hoursElapsed;
    const hoursNeeded = remainingUsd / pacePerHour;
    const onTrack = !eod.expired && hoursNeeded <= hoursLeft;
    const hoursRounded = Math.max(0.1, Math.round(hoursNeeded * 10) / 10);
    return {
      hours: hoursRounded,
      label: `${hoursRounded} 小时`,
      onTrack,
      pacePerHour: Math.round(pacePerHour * 100) / 100,
      source: "sales",
    };
  }

  if (launchContext?.launchedToday && (launchContext.agentRunsToday > 0 || launchContext.methodsTotal > 0)) {
    const marketingProgress = Math.max(0, launchContext.marketingProgress || 0);
    const hoursSinceLaunch = Math.max(
      0.25,
      (Date.now() - new Date(launchContext.launchedAt).getTime()) / 3600000
    );
    const pacePerHour = (launchContext.dailyTargetUsd * (marketingProgress / 100)) / hoursSinceLaunch;
    const hoursNeeded = Math.min(
      hoursLeft + hoursElapsed,
      Math.max(1, Math.round(((remainingUsd / Math.max(pacePerHour, 0.01)) * 10)) / 10)
    );
    const onTrack = hoursNeeded <= hoursLeft;
    return {
      hours: hoursNeeded,
      label: `${hoursNeeded} 小时`,
      onTrack,
      pacePerHour: Math.round(pacePerHour * 100) / 100,
      source: "marketing",
      marketingProgress,
      launchedAt: launchContext.launchedAt,
      websiteUrl: launchContext.websiteUrl,
    };
  }

  return {
    hours: null,
    label: "—",
    onTrack: false,
    pacePerHour: 0,
    source: "idle",
  };
}

function getTodayLaunchInfo(companyId, dailyTargetUsd) {
  const today = new Date().toISOString().slice(0, 10);
  const activity = getCompanyMarketingActivity(companyId);
  const log = loadJson(LAUNCH_LOG, { launches: [] });
  const todayLaunches = (log.launches || []).filter(
    (l) => l.companyId === companyId && (l.at || l.startedAt || "").slice(0, 10) === today
  );
  const latest = todayLaunches.length ? todayLaunches[todayLaunches.length - 1] : null;
  if (!latest && !activity.launchesToday) return null;

  const state = getMarketingState(companyId);
  const tasks = state.tasks || [];
  const marketingProgress =
    latest?.marketingProgress ??
    (tasks.length
      ? Math.round(tasks.reduce((s, t) => s + (t.progress || 0), 0) / tasks.length)
      : 0);

  return {
    launchedToday: true,
    launchedAt: latest?.startedAt || latest?.at || new Date().toISOString(),
    marketingProgress,
    websiteUrl: latest?.websiteUrl || null,
    methodsTotal: latest?.methodsTotal || latest?.methodsCount || 0,
    dailyTargetUsd,
    agentRunsToday: activity.agentRunsToday || 0,
  };
}

export function getDailySalesDashboard(companyId) {
  const goal = getGoal(companyId);
  const orders = getRealOrderMetrics();
  const dailyTargetUsd = goal.dailyTargetUsd || 500;
  const todayRevenueUsd = orders.todayUsd || 0;
  const remainingUsd = Math.max(0, dailyTargetUsd - todayRevenueUsd);
  const progress = dailyTargetUsd > 0 ? Math.min(100, Math.round((todayRevenueUsd / dailyTargetUsd) * 100)) : 0;
  const timeProgress = dayProgressPct();
  const endOfDay = countdownToEndOfDay();
  const launch = getTodayLaunchInfo(companyId, dailyTargetUsd);
  const estimate = estimateHoursToComplete(remainingUsd, todayRevenueUsd, launch);
  const expectedProgress = timeProgress;
  let paceProgress =
    progress >= 100
      ? 100
      : expectedProgress > 0
        ? Math.min(100, Math.round((progress / expectedProgress) * 100))
        : 0;

  if (estimate.source === "marketing" && launch) {
    paceProgress = Math.min(100, Math.max(paceProgress, launch.marketingProgress || 0));
  }

  return {
    companyId,
    goal: {
      dailyTargetUsd,
      currency: "USD",
      setAt: goal.setAt,
    },
    today: {
      revenueUsd: todayRevenueUsd,
      orderCount: orders.orderCountToday || 0,
      customersToday: orders.customersToday || 0,
      progress,
      remainingUsd,
      targetUsd: dailyTargetUsd,
    },
    launch,
    time: {
      progressPct: timeProgress,
      endOfDay,
      hoursLeft: endOfDay.hours,
      minutesLeft: endOfDay.minutes,
    },
    estimate: {
      ...estimate,
      paceProgress,
      expectedProgress,
      aheadOfSchedule: progress >= expectedProgress,
    },
    isReal: true,
    source: estimate.source === "sales" ? "payment_orders" : estimate.source === "marketing" ? "marketing_launch" : "pending",
    updatedAt: new Date().toISOString(),
  };
}
