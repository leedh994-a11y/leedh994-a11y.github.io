/* global companyId, api */

if (typeof window !== "undefined") {
  window.api = window.api || ((path, options = {}) => fetch(path, { credentials: "include", ...options }));
}

let cmData = null;
let cmCountdownTimer = null;

function fmtMoney(amount, currency = "USD") {
  const sym = currency === "CNY" ? "¥" : "$";
  return `${sym}${Number(amount || 0).toLocaleString()}`;
}

function statusLabel(s) {
  return { completed: "已完成", in_progress: "进行中", scheduled: "待开始" }[s] || s;
}

function statusClass(s) {
  if (s === "completed") return "cm-status--done";
  if (s === "in_progress") return "cm-status--active";
  return "cm-status--pending";
}

function taskCountdown(dueAt) {
  const ms = new Date(dueAt).getTime() - Date.now();
  if (ms <= 0) return { label: "已到期", expired: true };
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return { label: `${d}天 ${h}时 ${m}分`, days: d, hours: h, minutes: m, expired: false };
}

function setDigits(prefix, cd) {
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(v ?? 0);
  };
  if (!cd || cd.expired) {
    set(`${prefix}-days`, 0);
    set(`${prefix}-hours`, 0);
    set(`${prefix}-mins`, 0);
    return;
  }
  set(`${prefix}-days`, cd.days);
  set(`${prefix}-hours`, cd.hours);
  set(`${prefix}-mins`, cd.minutes);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function renderPillars(pillars) {
  const el = document.getElementById("cm-pillars");
  if (!el) return;
  el.innerHTML = (pillars || [])
    .map(
      (p) => `
    <article class="cm-pillar" style="--pillar-color:${p.color}">
      <header class="cm-pillar__head">
        <span class="cm-pillar__icon">${p.icon}</span>
        <div>
          <h3>${p.title}</h3>
          <p>${p.subtitle}</p>
        </div>
        <span class="cm-pillar__badge">${p.zeroCostPledge}</span>
      </header>
      <div class="cm-pillar__stats">
        <span><strong>${p.stats.total}</strong> 任务</span>
        <span class="cm-stat--done"><strong>${p.stats.completed}</strong> 完成</span>
        <span class="cm-stat--active"><strong>${p.stats.inProgress}</strong> 进行</span>
        <span class="cm-stat--pending"><strong>${p.stats.pending}</strong> 待办</span>
      </div>
      <div class="cm-pillar__progress">
        <div class="cm-pillar__progress-row">
          <span>板块进度</span>
          <strong>${p.stats.overallProgress}%</strong>
        </div>
        <div class="cm-bar"><div class="cm-bar__fill" style="width:${p.stats.overallProgress}%"></div></div>
      </div>
    </article>`
    )
    .join("");
}

function renderTaskTable(tasks) {
  const tbody = document.getElementById("cm-task-tbody");
  if (!tbody) return;
  tbody.innerHTML = (tasks?.items || [])
    .map((t, i) => {
      const cd = taskCountdown(t.dueAt);
      return `
      <tr class="${t.overdue && t.status !== "completed" ? "cm-row--overdue" : ""}">
        <td>${i + 1}</td>
        <td><span class="cm-pillar-tag">${t.pillarTitle}</span></td>
        <td><strong>${t.title}</strong></td>
        <td>${t.method}</td>
        <td>${t.output || "—"}</td>
        <td>
          <div class="cm-cell-progress">
            <div class="cm-bar cm-bar--thin"><div class="cm-bar__fill" style="width:${t.progress}%"></div></div>
            <span>${t.progress}%</span>
          </div>
        </td>
        <td><span class="cm-status ${statusClass(t.status)}">${statusLabel(t.status)}</span></td>
        <td class="${cd.expired ? "cm-countdown-expired" : ""}">${cd.label}</td>
      </tr>`;
    })
    .join("");
}

function renderContentMarketingDashboard(data) {
  if (!data) return;
  cmData = data;
  const { campaign, tasks, sales, pillars } = data;

  setText("cm-today-progress", `${campaign.todayProgress}%`);
  setText("cm-day-num", campaign.daysElapsed);
  setText("cm-target-days", campaign.targetDays);
  setText("cm-overall-pct", `${campaign.overallProgress}%`);
  setDigits("cm-cd", campaign.countdown);
  setDigits("cm-rev", sales.countdown);

  renderPillars(pillars);

  setText("cm-task-total", tasks.total);
  setText("cm-task-done", tasks.completed);
  setText("cm-task-active", tasks.inProgress);
  setText("cm-task-pending", tasks.pending);
  renderTaskTable(tasks);

  const cur = sales.currency || "USD";
  setText("cm-today-revenue", fmtMoney(sales.today, cur));
  setText("cm-target-revenue", fmtMoney(sales.target, cur));
  setText("cm-total-revenue", fmtMoney(sales.total, cur));
  setText("cm-remaining-revenue", fmtMoney(sales.remaining, cur));
  setText("cm-revenue-pct", `${sales.progress}%`);
  const bar = document.getElementById("cm-revenue-bar");
  if (bar) bar.style.width = `${sales.progress}%`;

  const est = document.getElementById("cm-days-estimate");
  if (est) est.textContent = `按当前进度估算约需 ${sales.daysToGoalEstimate ?? campaign.targetDays} 天完成目标收益`;
}

function tickCmCountdowns() {
  if (!cmData) return;
  setDigits("cm-cd", countdown(cmData.campaign.deadlineAt));
  setDigits("cm-rev", countdown(cmData.campaign.deadlineAt));
  const tbody = document.getElementById("cm-task-tbody");
  if (tbody && cmData.tasks?.items) {
    const cells = tbody.querySelectorAll("tr td:last-child");
    cmData.tasks.items.forEach((t, i) => {
      const cd = taskCountdown(t.dueAt);
      if (cells[i]) {
        cells[i].textContent = cd.label;
        cells[i].className = cd.expired ? "cm-countdown-expired" : "";
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

async function loadContentMarketingDashboard(options = {}) {
  const id = window.getCompanyId?.() || window.companyId || companyId;
  if (!id) return false;
  try {
    const suffix = options.refresh ? `?_=${Date.now()}` : "";
    const res = await window.api(`/api/companies/${id}/content-marketing/dashboard${suffix}`, {
      cache: options.refresh ? "no-store" : "default",
      headers: options.refresh ? { "Cache-Control": "no-cache", Pragma: "no-cache" } : undefined,
    });
    const data = await res.json();
    if (data.success && data.contentMarketing) {
      renderContentMarketingDashboard(data.contentMarketing);
      return true;
    }
    throw new Error(data.errorZh || data.error || "加载失败");
  } catch (err) {
    if (options.refresh) throw err;
    return false;
  }
}

function setupContentMarketingDashboard() {
  const dialog = document.getElementById("cm-goal-dialog");
  const form = document.getElementById("cm-goal-form");

  document.getElementById("btn-cm-goal-edit")?.addEventListener("click", () => {
    if (!cmData?.sales?.goal) return;
    const g = cmData.sales.goal;
    document.getElementById("cm-goal-amount").value = g.revenueTarget || 5000;
    document.getElementById("cm-goal-days").value = g.targetDays || 30;
    document.getElementById("cm-goal-currency").value = g.currency || "USD";
    dialog?.showModal();
  });

  document.getElementById("btn-cm-goal-cancel")?.addEventListener("click", () => dialog?.close());

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      const res = await window.api(`/api/companies/${companyId}/content-marketing/goal`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revenueTarget: Number(document.getElementById("cm-goal-amount").value),
          targetDays: Number(document.getElementById("cm-goal-days").value),
          currency: document.getElementById("cm-goal-currency").value,
        }),
      });
      const data = await res.json();
      if (data.success) {
        renderContentMarketingDashboard(data.contentMarketing);
        dialog?.close();
      }
    } catch (_) {
      /* ignore */
    }
  });

  if (cmCountdownTimer) clearInterval(cmCountdownTimer);
  cmCountdownTimer = setInterval(tickCmCountdowns, 30000);
}

window.loadContentMarketingDashboard = loadContentMarketingDashboard;
window.renderContentMarketingDashboard = renderContentMarketingDashboard;
window.setupContentMarketingDashboard = setupContentMarketingDashboard;
