import { loadJson, saveJson } from "./store.js";
import { getRealOrderMetrics } from "./marketing-real-metrics.js";

const GOALS_FILE = "daily-sales-goals.json";

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

function estimateHoursToComplete(remainingUsd, todayUsd) {
  const start = startOfLocalDay().getTime();
  const hoursElapsed = Math.max(0.25, (Date.now() - start) / 3600000);
  if (remainingUsd <= 0) {
    return { hours: 0, label: "已达成今日目标", onTrack: true, pacePerHour: todayUsd / hoursElapsed };
  }
  if (todayUsd <= 0) {
    return {
      hours: null,
      label: "暂无销售增速，建议加大推广",
      onTrack: false,
      pacePerHour: 0,
    };
  }
  const pacePerHour = todayUsd / hoursElapsed;
  const hoursNeeded = remainingUsd / pacePerHour;
  const eod = countdownToEndOfDay();
  const onTrack = !eod.expired && hoursNeeded <= eod.hours + eod.minutes / 60;
  const hoursRounded = Math.max(0.1, Math.round(hoursNeeded * 10) / 10);
  return {
    hours: hoursRounded,
    label: `${hoursRounded} 小时`,
    onTrack,
    pacePerHour: Math.round(pacePerHour * 100) / 100,
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
  const estimate = estimateHoursToComplete(remainingUsd, todayRevenueUsd);
  const expectedProgress = timeProgress;
  const paceProgress =
    progress >= 100
      ? 100
      : expectedProgress > 0
        ? Math.min(100, Math.round((progress / expectedProgress) * 100))
        : 0;

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
    source: "payment_orders",
    updatedAt: new Date().toISOString(),
  };
}
