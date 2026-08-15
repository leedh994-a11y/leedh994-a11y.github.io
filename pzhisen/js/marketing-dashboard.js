/* global companyId, api */

if (typeof window !== "undefined") {
  window.api = window.api || ((path, options = {}) => fetch(path, { credentials: "include", ...options }));
}

let marketingData = null;
let countdownTimer = null;

function fmtMoney(amount, currency = "USD") {
  const sym = currency === "CNY" ? "¥" : "$";
  return `${sym}${Number(amount || 0).toLocaleString()}`;
}

function statusLabel(status) {
  const map = {
    completed: "已完成",
    in_progress: "进行中",
    scheduled: "待开始",
    pending: "待开始",
  };
  return map[status] || status;
}

function statusClass(status) {
  if (status === "completed") return "mkt-status--done";
  if (status === "in_progress") return "mkt-status--active";
  return "mkt-status--pending";
}

function taskCountdown(dueAt) {
  const ms = new Date(dueAt).getTime() - Date.now();
  if (ms <= 0) return { label: "已到期", expired: true };
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return { label: `${days}天 ${hours}时 ${minutes}分`, days, hours, minutes, expired: false };
}

function renderCountdownDigits(prefix, cd) {
  const days = document.getElementById(`${prefix}-days`);
  const hours = document.getElementById(`${prefix}-hours`);
  const mins = document.getElementById(`${prefix}-mins`);
  if (!days) return;
  if (!cd || cd.expired) {
    days.textContent = "0";
    hours.textContent = "0";
    mins.textContent = "0";
    return;
  }
  days.textContent = String(cd.days ?? 0);
  hours.textContent = String(cd.hours ?? 0);
  mins.textContent = String(cd.minutes ?? 0);
}

function renderSteps(steps) {
  const el = document.getElementById("mkt-steps");
  if (!el) return;
  el.innerHTML = (steps || [])
    .map(
      (s) => `
    <li class="mkt-step mkt-step--${s.status}">
      <div class="mkt-step__head">
        <span class="mkt-step__title">${s.title}</span>
        <span class="mkt-step__pct">${s.progress}%</span>
      </div>
      <div class="mkt-bar mkt-bar--thin"><div class="mkt-bar__fill" style="width:${s.progress}%"></div></div>
    </li>`
    )
    .join("");
}

function renderTaskTable(tasks) {
  const tbody = document.getElementById("mkt-task-tbody");
  if (!tbody) return;
  const items = tasks?.items || [];
  tbody.innerHTML = items
    .map((t, i) => {
      const cd = taskCountdown(t.dueAt);
      return `
      <tr class="${t.overdue && t.status !== "completed" ? "mkt-row--overdue" : ""}">
        <td>${i + 1}</td>
        <td><strong>${t.platform}</strong></td>
        <td>${t.method}</td>
        <td>${t.channel || "—"}</td>
        <td>
          <div class="mkt-cell-progress">
            <div class="mkt-bar mkt-bar--thin"><div class="mkt-bar__fill" style="width:${t.progress}%"></div></div>
            <span>${t.progress}%</span>
          </div>
        </td>
        <td><span class="mkt-status ${statusClass(t.status)}">${statusLabel(t.status)}</span></td>
        <td class="${cd.expired ? "mkt-countdown-cell--expired" : ""}">${cd.label}</td>
      </tr>`;
    })
    .join("");
}

function renderMarketingDashboard(data) {
  if (!data) return;
  marketingData = data;

  const { campaign, tasks, sales } = data;

  const dayEl = document.getElementById("mkt-campaign-day");
  if (dayEl) dayEl.textContent = `第 ${campaign.daysElapsed} 天 / 共 ${campaign.targetDays} 天`;

  const overallPct = document.getElementById("mkt-overall-pct");
  const overallBar = document.getElementById("mkt-overall-bar");
  if (overallPct) overallPct.textContent = `${campaign.overallProgress}%`;
  if (overallBar) overallBar.style.width = `${campaign.overallProgress}%`;

  renderCountdownDigits("mkt-cd", campaign.countdown);
  renderSteps(campaign.steps);

  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setText("mkt-task-total", tasks.total);
  setText("mkt-task-done", tasks.completed);
  setText("mkt-task-active", tasks.inProgress);
  setText("mkt-task-pending", tasks.pending ?? tasks.scheduled);
  renderTaskTable(tasks);

  const cur = sales.currency || "USD";
  setText("mkt-today-revenue", fmtMoney(sales.today, cur));
  setText("mkt-target-revenue", fmtMoney(sales.target, cur));
  setText("mkt-total-revenue", fmtMoney(sales.total, cur));
  setText("mkt-remaining-revenue", fmtMoney(sales.remaining, cur));
  setText("mkt-revenue-pct", `${sales.progress}%`);

  const revBar = document.getElementById("mkt-revenue-bar");
  if (revBar) revBar.style.width = `${sales.progress}%`;

  renderCountdownDigits("mkt-rev", sales.countdown);

  const est = document.getElementById("mkt-days-estimate");
  if (est) {
    const days = sales.daysToGoalEstimate ?? campaign.targetDays;
    est.textContent = `按当前进度估算约需 ${days} 天完成目标收益`;
  }

  renderSettlement(data.settlement);
}

function renderSettlement(settlement) {
  const list = document.getElementById("mkt-settlement-list");
  const disclaimer = document.getElementById("mkt-settlement-disclaimer");
  const status = document.getElementById("mkt-settlement-status");
  if (!list || !settlement) return;

  if (disclaimer) disclaimer.textContent = settlement.disclaimerZh || "";

  if (status) {
    status.textContent = settlement.ready
      ? `已接入 ${settlement.configuredCount}/${settlement.totalCount} 个账户`
      : "待配置收款账户";
    status.className = settlement.ready ? "mkt-badge mkt-badge--live" : "mkt-badge mkt-badge--warn";
  }

  list.innerHTML = (settlement.accounts || [])
    .map((a) => {
      const icon = a.type === "paypal" ? "💳" : "🏦";
      const detail =
        a.type === "paypal"
          ? `<div class="mkt-settle-detail">${a.emailMask ? `账户：${a.emailMask}` : "PayPal API 已配置"}${a.mode ? ` · ${a.mode === "live" ? "正式环境" : "沙盒"}` : ""}</div>`
          : `<div class="mkt-settle-detail">${a.bankName || ""} ${a.accountNumberMask || ""} · ${a.accountName || ""}</div>`;
      const channels = (a.channels || []).map((c) => `<span class="mkt-settle-tag">${c}</span>`).join("");
      return `
      <div class="mkt-settle-item ${a.configured ? "mkt-settle-item--ok" : "mkt-settle-item--pending"}">
        <div class="mkt-settle-item__head">
          <span class="mkt-settle-item__icon">${icon}</span>
          <strong>${a.label}</strong>
          <span class="mkt-status ${a.configured ? "mkt-status--done" : "mkt-status--pending"}">${a.configured ? "已接入" : "未配置"}</span>
        </div>
        ${detail}
        <div class="mkt-settle-tags">${channels}</div>
        <p class="mkt-settle-note">${a.settlementNote || ""}</p>
      </div>`;
    })
    .join("");
}

function tickLocalCountdowns() {
  if (!marketingData) return;
  const { campaign, tasks } = marketingData;

  renderCountdownDigits("mkt-cd", countdown(campaign.deadlineAt));
  renderCountdownDigits("mkt-rev", countdown(campaign.deadlineAt));

  const tbody = document.getElementById("mkt-task-tbody");
  if (tbody && tasks?.items) {
    const cells = tbody.querySelectorAll("tr td:last-child");
    tasks.items.forEach((t, i) => {
      const cd = taskCountdown(t.dueAt);
      if (cells[i]) {
        cells[i].textContent = cd.label;
        cells[i].className = cd.expired ? "mkt-countdown-cell--expired" : "";
      }
    });
  }
}

function countdown(deadlineIso) {
  const ms = new Date(deadlineIso).getTime() - Date.now();
  if (ms <= 0) return { expired: true, days: 0, hours: 0, minutes: 0 };
  return {
    expired: false,
    days: Math.floor(ms / 86400000),
    hours: Math.floor((ms % 86400000) / 3600000),
    minutes: Math.floor((ms % 3600000) / 60000),
  };
}

async function loadMarketingDashboard(options = {}) {
  const id = window.getCompanyId?.() || window.companyId || companyId;
  if (!id) return false;
  try {
    const suffix = options.refresh ? `?_=${Date.now()}` : "";
    const res = await window.api(`/api/companies/${id}/marketing/dashboard${suffix}`, {
      cache: options.refresh ? "no-store" : "default",
      headers: options.refresh ? { "Cache-Control": "no-cache", Pragma: "no-cache" } : undefined,
    });
    const data = await res.json();
    if (data.success && data.marketing) {
      renderMarketingDashboard(data.marketing);
      return true;
    }
    throw new Error(data.errorZh || data.error || "加载失败");
  } catch (err) {
    if (options.refresh) throw err;
    return false;
  }
}

function setupMarketingDashboard() {
  const dialog = document.getElementById("mkt-goal-dialog");
  const form = document.getElementById("mkt-goal-form");

  document.getElementById("btn-edit-goal")?.addEventListener("click", () => {
    if (!marketingData) return;
    const g = marketingData.sales?.goal || {};
    document.getElementById("mkt-goal-amount").value = g.revenueTarget || 5000;
    document.getElementById("mkt-goal-days").value = g.targetDays || 30;
    document.getElementById("mkt-goal-currency").value = g.currency || "USD";
    dialog?.showModal();
  });

  document.getElementById("btn-goal-cancel")?.addEventListener("click", () => dialog?.close());

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!companyId) return;
    const revenueTarget = Number(document.getElementById("mkt-goal-amount").value);
    const targetDays = Number(document.getElementById("mkt-goal-days").value);
    const currency = document.getElementById("mkt-goal-currency").value;
    try {
      const res = await window.api(`/api/companies/${companyId}/marketing/goal`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revenueTarget, targetDays, currency }),
      });
      const data = await res.json();
      if (data.success) {
        renderMarketingDashboard(data.marketing);
        dialog?.close();
      }
    } catch (_) {
      /* ignore */
    }
  });

  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(tickLocalCountdowns, 30000);
}

window.loadMarketingDashboard = loadMarketingDashboard;
window.renderMarketingDashboard = renderMarketingDashboard;
window.setupMarketingDashboard = setupMarketingDashboard;
