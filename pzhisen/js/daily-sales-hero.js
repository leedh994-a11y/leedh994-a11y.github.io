/* global api */

let dshTimer = null;
let dshBound = false;

/** Capture dashboard helper before this file defines any globals. */
const getDashboardCompanyId =
  typeof window.getCompanyId === "function" ? window.getCompanyId.bind(window) : null;

function fmtUsd(amount) {
  return `$${Number(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setBar(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = `${Math.min(100, Math.max(0, pct || 0))}%`;
}

function resolveDshCompanyId() {
  if (getDashboardCompanyId) {
    try {
      const id = getDashboardCompanyId();
      if (id) return id;
    } catch (_) {
      /* dashboard helper unavailable */
    }
  }
  const fromUrl = new URLSearchParams(location.search).get("company");
  if (fromUrl) return fromUrl;
  if (window.companyId) return window.companyId;
  try {
    return localStorage.getItem("pzhisen_company_id") || null;
  } catch (_) {
    return null;
  }
}

function showDshToast(message, type = "info") {
  if (typeof window.showDashboardRefreshToast === "function") {
    window.showDashboardRefreshToast(message, type);
    return;
  }
  const el = document.getElementById("dashboard-refresh-toast");
  if (el) {
    el.hidden = false;
    el.textContent = message;
    el.className = `dashboard-refresh-toast dashboard-refresh-toast--${type}`;
    return;
  }
  alert(message);
}

function renderDailySalesHero(data) {
  if (!data) return;

  const today = data.today || {};
  const goal = data.goal || {};
  const time = data.time || {};
  const est = data.estimate || {};

  setText("dsh-today-revenue", fmtUsd(today.revenueUsd));
  setText("dsh-today-revenue-side", fmtUsd(today.revenueUsd));
  setText("dsh-revenue-pct", `${today.progress || 0}%`);
  setBar("dsh-revenue-bar", today.progress);
  setText("dsh-target-display", fmtUsd(goal.dailyTargetUsd));
  setText("dsh-goal-current", fmtUsd(goal.dailyTargetUsd));
  setText("dsh-remaining", fmtUsd(today.remainingUsd));
  setText("dsh-today-orders", `${today.orderCount || 0} 笔订单 · ${today.customersToday || 0} 位客户`);

  setText("dsh-time-pct", `${time.progressPct || 0}%`);
  setBar("dsh-time-bar", time.progressPct);
  const eod = time.endOfDay || {};
  setText(
    "dsh-eod-countdown",
    eod.expired ? "今日已结束" : `${eod.hours ?? 0} 时 ${eod.minutes ?? 0} 分 ${eod.seconds ?? 0} 秒`
  );

  setText("dsh-pace-pct", `${est.paceProgress || 0}%`);
  setBar("dsh-pace-bar", est.paceProgress);
  setText(
    "dsh-hours-needed",
    today.progress >= 100 ? "0（已达成）" : est.hours != null ? `${est.hours}` : "—"
  );
  setText(
    "dsh-pace-label",
    today.progress >= 100
      ? "恭喜！今日销售收益目标已达成"
      : est.hours != null
        ? `按当前 $${est.pacePerHour || 0}/小时 增速，预计还需 ${est.hours} 小时完成今日 $${goal.dailyTargetUsd} 目标`
        : "今日尚无销售记录，启动推广后可查看达标预估"
  );

  const statusEl = document.getElementById("dsh-status-badge");
  if (statusEl) {
    if (today.progress >= 100) {
      statusEl.textContent = "今日目标已达成";
      statusEl.className = "dsh-status-badge dsh-status-badge--done";
    } else if (est.onTrack) {
      statusEl.textContent = "进度良好 · 有望今日达标";
      statusEl.className = "dsh-status-badge dsh-status-badge--good";
    } else if ((today.revenueUsd || 0) > 0) {
      statusEl.textContent = "需加速推广以达成目标";
      statusEl.className = "dsh-status-badge dsh-status-badge--warn";
    } else {
      statusEl.textContent = "等待首笔销售";
      statusEl.className = "dsh-status-badge dsh-status-badge--idle";
    }
  }

  const input = document.getElementById("dsh-goal-input");
  if (input && document.activeElement !== input) {
    input.value = goal.dailyTargetUsd || 500;
  }

  const updated = document.getElementById("dsh-updated-at");
  if (updated && data.updatedAt) {
    updated.textContent = `更新于 ${new Date(data.updatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
  }
}

async function loadDailySalesHero(options = {}) {
  const id = resolveDshCompanyId();
  if (!id) return;
  const suffix = options.refresh ? `?_=${Date.now()}` : "";
  const fetchApi = window.api || api;
  try {
    const res = await fetchApi(`/api/companies/${id}/marketing/daily-sales${suffix}`, {
      cache: options.refresh ? "no-store" : "default",
      headers: options.refresh ? { "Cache-Control": "no-cache", Pragma: "no-cache" } : undefined,
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.success && data.dailySales) {
      renderDailySalesHero(data.dailySales);
    }
  } catch (_) {
    /* non-blocking */
  }
}

async function saveDailySalesGoal(e) {
  e?.preventDefault?.();
  e?.stopPropagation?.();

  const id = resolveDshCompanyId();
  if (!id) {
    showDshToast("无法保存：缺少公司 ID，请刷新页面或重新登录", "error");
    return;
  }

  const input = document.getElementById("dsh-goal-input");
  const btn = document.getElementById("dsh-goal-submit");
  const amount = Number(String(input?.value || "").trim());

  if (!Number.isFinite(amount) || amount < 1) {
    showDshToast("请输入大于 0 的每日目标金额（美元）", "error");
    input?.focus();
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "保存中…";
  }

  const fetchApi = window.api || api;
  try {
    const res = await fetchApi(`/api/companies/${id}/marketing/daily-sales/goal`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dailyTargetUsd: amount }),
    });

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(res.status === 401 ? "登录已过期，请重新登录" : `保存失败（HTTP ${res.status}）`);
    }

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || data.errorZh || "保存失败");
    }

    renderDailySalesHero(data.dailySales);
    showDshToast(`每日目标已保存：${fmtUsd(amount)}`, "success");
  } catch (err) {
    showDshToast(err.message || "保存每日目标失败，请稍后重试", "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "保存每日目标";
    }
  }
}

function setupDailySalesHero() {
  if (dshBound) return;
  const form = document.getElementById("dsh-goal-form");
  const btn = document.getElementById("dsh-goal-submit");
  const refreshBtn = document.getElementById("btn-dsh-refresh");
  if (!form && !btn) return;

  dshBound = true;
  form?.setAttribute("novalidate", "novalidate");
  form?.addEventListener("submit", saveDailySalesGoal);
  btn?.addEventListener("click", saveDailySalesGoal);
  refreshBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    loadDailySalesHero({ refresh: true });
  });

  if (dshTimer) clearInterval(dshTimer);
  dshTimer = setInterval(() => loadDailySalesHero(), 15000);
}

window.loadDailySalesHero = loadDailySalesHero;
window.renderDailySalesHero = renderDailySalesHero;
window.setupDailySalesHero = setupDailySalesHero;
window.saveDailySalesGoal = saveDailySalesGoal;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupDailySalesHero);
} else {
  setupDailySalesHero();
}
