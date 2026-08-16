/* global companyId, api */

if (typeof window !== "undefined") {
  window.api = window.api || ((path, options = {}) => fetch(path, { credentials: "include", ...options }));
}

let analyticsData = null;

function fmtNum(n) {
  return Number(n || 0).toLocaleString();
}

function fmtMoney(amount, currency = "USD") {
  const sym = currency === "CNY" ? "¥" : "$";
  return `${sym}${Number(amount || 0).toLocaleString()}`;
}

function growthHtml(val, label) {
  const up = val > 0;
  const down = val < 0;
  const cls = up ? "analytics-growth--up" : down ? "analytics-growth--down" : "";
  const arrow = up ? "↑" : down ? "↓" : "→";
  return `<div class="analytics-growth-item ${cls}"><span>${label}</span><strong>${arrow} ${Math.abs(val)}%</strong></div>`;
}

function renderTrend(trend) {
  const el = document.getElementById("analytics-trend");
  if (!el || !trend?.length) return;
  const maxVal = Math.max(...trend.map((t) => t.revenueUsd || t.orders || 0), 1);
  el.innerHTML = trend
    .map((t) => {
      const val = t.revenueUsd || t.orders || 0;
      const h = Math.round((val / maxVal) * 100);
      const d = t.date.slice(5);
      return `<div class="analytics-trend-bar" title="${d}: $${val} 收益, ${t.orders || 0} 订单">
        <div class="analytics-trend-bar__fill" style="height:${h}%"></div>
        <span class="analytics-trend-bar__label">${d}</span>
      </div>`;
    })
    .join("");
}

function fmtAttributed(n) {
  return n == null ? "—" : fmtNum(n);
}

function fmtAttributedMoney(amount, currency = "USD") {
  return amount == null ? "—" : fmtMoney(amount, currency);
}

function renderAnalyticsDashboard(data) {
  if (!data) return;
  analyticsData = data;

  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };

  set("analytics-methods-count", data.methodsTotal);
  set("analytics-date", data.date);

  const s = data.data?.summary || data.analysis?.totals || {};
  const site = data.siteOrders || data.orders || {};
  set("kpi-impressions", fmtNum(site.ordersToday ?? s.ordersToday));
  set("kpi-clicks", fmtNum(s.agentRunsToday));
  set("kpi-engagement", fmtNum(s.customersToday));
  set("kpi-posts", fmtNum(s.agentExecutions));
  set("kpi-emails", fmtNum(s.launchesToday));
  set("kpi-avg-progress", `${s.avgProgress || 0}%`);

  const tbody = document.getElementById("analytics-data-tbody");
  if (tbody) {
    tbody.innerHTML = (data.data?.rows || [])
      .map(
        (r) => `
      <tr>
        <td><strong>${r.label}</strong></td>
        <td><span class="analytics-cat-tag">${r.category}</span></td>
        <td>
          <div class="analytics-cell-progress">
            <div class="analytics-bar"><div class="analytics-bar__fill" style="width:${r.progress}%"></div></div>
            <span>${r.progress}%</span>
          </div>
        </td>
        <td><span class="analytics-status analytics-status--${r.status === "已完成" ? "done" : r.status === "进行中" ? "active" : "start"}">${r.status}</span></td>
        <td>${fmtNum(r.agentExecutions)}</td>
        <td>${fmtAttributed(r.ordersToday)}</td>
        <td>${fmtAttributedMoney(r.revenueToday, "USD")}</td>
        <td>${fmtAttributed(r.customersToday)}</td>
        <td class="analytics-zero">$0</td>
      </tr>`
      )
      .join("");
  }

  const g = data.analysis?.growth || {};
  const growthEl = document.getElementById("analytics-growth");
  if (growthEl) {
    growthEl.innerHTML =
      growthHtml(g.orders, "订单增长") +
      growthHtml(g.revenue, "收益增长") +
      `<div class="analytics-growth-item"><span>进度变化</span><strong>${g.progress >= 0 ? "+" : ""}${g.progress || 0}%</strong></div>`;
  }

  const catEl = document.getElementById("analytics-categories");
  if (catEl) {
    catEl.innerHTML = (data.analysis?.categories || [])
      .map(
        (c) => `
      <div class="analytics-cat-row">
        <strong>${c.category}</strong>
        <span>${c.count} 种 · 进度 ${c.avgProgress}% · AI执行 ${c.agentExecutions} 次</span>
        <span>全站今日 ${site.ordersToday ?? 0} 订单 · $${site.revenueTodayUsd ?? 0} 收益（各渠道行不可归因）</span>
      </div>`
      )
      .join("");
  }

  const topEl = document.getElementById("analytics-top");
  if (topEl) {
    topEl.innerHTML = (data.analysis?.topPerformers || [])
      .map((t) => `<li><strong>${t.label}</strong> — AI执行 ${t.agentExecutions} 次 · 进度 ${t.progress}%</li>`)
      .join("") || "<li>暂无执行记录，请点击一键启动</li>";
  }

  const attEl = document.getElementById("analytics-attention");
  if (attEl) {
    attEl.innerHTML = (data.analysis?.needsAttention || [])
      .map((t) => `<li><strong>${t.label}</strong> — 进度仅 ${t.progress}%，建议一键启动</li>`)
      .join("") || "<li>所有渠道运行良好</li>";
  }

  renderTrend(data.analysis?.trend);

  const insEl = document.getElementById("analytics-insights");
  if (insEl) {
    insEl.innerHTML = (data.analysis?.insights || []).map((i) => `<li>${i}</li>`).join("");
  }
}

async function loadMarketingAnalytics(options = {}) {
  const id = window.getCompanyId?.() || window.companyId || companyId;
  if (!id) return false;
  try {
    const suffix = options.refresh ? `?_=${Date.now()}` : "";
    const res = await window.api(`/api/companies/${id}/marketing/analytics/daily${suffix}`, {
      cache: options.refresh ? "no-store" : "default",
      headers: options.refresh ? { "Cache-Control": "no-cache", Pragma: "no-cache" } : undefined,
    });
    const data = await res.json();
    if (data.success && data.analytics) {
      renderAnalyticsDashboard(data.analytics);
      return true;
    }
    throw new Error(data.errorZh || data.error || "加载失败");
  } catch (err) {
    if (options.refresh) throw err;
    return false;
  }
}

function setupMarketingAnalytics() {
}

window.loadMarketingAnalytics = loadMarketingAnalytics;
window.renderAnalyticsDashboard = renderAnalyticsDashboard;
window.setupMarketingAnalytics = setupMarketingAnalytics;
