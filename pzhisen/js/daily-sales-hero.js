/* global companyId, api */

let dshTimer = null;

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

function getCompanyId() {
  return window.getCompanyId?.() || window.companyId || companyId;
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
  const id = getCompanyId();
  if (!id) return;
  const suffix = options.refresh ? `?_=${Date.now()}` : "";
  try {
    const res = await (window.api || api)(`/api/companies/${id}/marketing/daily-sales${suffix}`, {
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
  const id = getCompanyId();
  if (!id) return;
  const input = document.getElementById("dsh-goal-input");
  const btn = document.getElementById("dsh-goal-submit");
  const amount = Number(input?.value);
  if (!Number.isFinite(amount) || amount < 1) {
    alert("请输入大于 0 的每日目标金额（美元）");
    return;
  }
  if (btn) {
    btn.disabled = true;
    btn.textContent = "保存中…";
  }
  try {
    const res = await (window.api || api)(`/api/companies/${id}/marketing/daily-sales/goal`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dailyTargetUsd: amount }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "保存失败");
    renderDailySalesHero(data.dailySales);
  } catch (err) {
    alert(err.message || "保存每日目标失败");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "保存每日目标";
    }
  }
}

function setupDailySalesHero() {
  document.getElementById("dsh-goal-form")?.addEventListener("submit", saveDailySalesGoal);
  document.getElementById("btn-dsh-refresh")?.addEventListener("click", () => loadDailySalesHero({ refresh: true }));

  if (dshTimer) clearInterval(dshTimer);
  dshTimer = setInterval(() => loadDailySalesHero(), 15000);
}

window.loadDailySalesHero = loadDailySalesHero;
window.renderDailySalesHero = renderDailySalesHero;
window.setupDailySalesHero = setupDailySalesHero;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupDailySalesHero);
} else {
  setupDailySalesHero();
}
