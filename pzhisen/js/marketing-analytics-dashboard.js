/* global companyId, api */

let analyticsData = null;

function fmtNum(n) {
  return Number(n || 0).toLocaleString();
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
  const maxImp = Math.max(...trend.map((t) => t.impressions), 1);
  el.innerHTML = trend
    .map((t) => {
      const h = Math.round((t.impressions / maxImp) * 100);
      const d = t.date.slice(5);
      return `<div class="analytics-trend-bar" title="${d}: ${fmtNum(t.impressions)} 曝光, ${t.clicks} 点击">
        <div class="analytics-trend-bar__fill" style="height:${h}%"></div>
        <span class="analytics-trend-bar__label">${d}</span>
      </div>`;
    })
    .join("");
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
  set("kpi-impressions", fmtNum(s.impressions));
  set("kpi-clicks", fmtNum(s.clicks));
  set("kpi-engagement", fmtNum(s.engagement));
  set("kpi-posts", fmtNum(s.posts));
  set("kpi-emails", fmtNum(s.emails));
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
        <td>${fmtNum(r.impressions)}</td>
        <td>${fmtNum(r.clicks)}</td>
        <td>${fmtNum(r.engagement)}</td>
        <td>${r.ctr}%</td>
        <td>${r.contentCreated || r.postsPublished}</td>
        <td class="analytics-zero">$0</td>
      </tr>`
      )
      .join("");
  }

  const g = data.analysis?.growth || {};
  const growthEl = document.getElementById("analytics-growth");
  if (growthEl) {
    growthEl.innerHTML =
      growthHtml(g.impressions, "曝光增长") +
      growthHtml(g.clicks, "点击增长") +
      `<div class="analytics-growth-item"><span>进度变化</span><strong>${g.progress >= 0 ? "+" : ""}${g.progress || 0}%</strong></div>`;
  }

  const catEl = document.getElementById("analytics-categories");
  if (catEl) {
    catEl.innerHTML = (data.analysis?.categories || [])
      .map(
        (c) => `
      <div class="analytics-cat-row">
        <strong>${c.category}</strong>
        <span>${c.count} 种方式 · 进度 ${c.avgProgress}%</span>
        <span>${fmtNum(c.impressions)} 曝光 · ${fmtNum(c.clicks)} 点击</span>
      </div>`
      )
      .join("");
  }

  const topEl = document.getElementById("analytics-top");
  if (topEl) {
    topEl.innerHTML = (data.analysis?.topPerformers || [])
      .map((t) => `<li><strong>${t.label}</strong> — ${t.clicks} 点击 · ${t.engagement} 互动 · ${t.progress}%</li>`)
      .join("") || "<li>暂无数据</li>";
  }

  const attEl = document.getElementById("analytics-attention");
  if (attEl) {
    attEl.innerHTML = (data.analysis?.needsAttention || [])
      .map((t) => `<li><strong>${t.label}</strong> — 进度仅 ${t.progress}%，建议加强</li>`)
      .join("") || "<li>所有渠道运行良好</li>";
  }

  renderTrend(data.analysis?.trend);

  const insEl = document.getElementById("analytics-insights");
  if (insEl) {
    insEl.innerHTML = (data.analysis?.insights || []).map((i) => `<li>${i}</li>`).join("");
  }
}

async function loadMarketingAnalytics() {
  if (!companyId) return;
  try {
    const res = await api(`/api/companies/${companyId}/marketing/analytics/daily`);
    const data = await res.json();
    if (data.success && data.analytics) renderAnalyticsDashboard(data.analytics);
  } catch (_) {
    /* ignore */
  }
}

function setupMarketingAnalytics() {
  document.getElementById("btn-analytics-refresh")?.addEventListener("click", loadMarketingAnalytics);
}

window.loadMarketingAnalytics = loadMarketingAnalytics;
window.renderAnalyticsDashboard = renderAnalyticsDashboard;
window.setupMarketingAnalytics = setupMarketingAnalytics;
