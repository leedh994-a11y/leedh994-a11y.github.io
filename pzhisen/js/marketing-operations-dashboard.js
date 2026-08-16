/* global companyId */

if (typeof window !== "undefined") {
  window.api = window.api || ((path, options = {}) => fetch(path, { credentials: "include", ...options }));
}

let opsData = null;
let opsFilter = "all";
let opsMethodFilter = "";
let opsSearch = "";

function opsCompanyId() {
  return (
    window.getCompanyId?.() ||
    window.companyId ||
    companyId ||
    new URLSearchParams(location.search).get("company")
  );
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString();
}

function fmtMoney(amount, currency = "USD") {
  const sym = currency === "CNY" ? "¥" : "$";
  return `${sym}${Number(amount || 0).toLocaleString()}`;
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusClass(status) {
  if (status === "已完成" || status === "published") return "done";
  if (status === "进行中" || status === "running" || status === "in_progress") return "active";
  return "pending";
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderOpsSummary(data) {
  const s = data.summary || {};
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  set("ops-methods-total", fmtNum(s.methodsTotal));
  set("ops-deliverables-total", fmtNum(s.deliverablesTotal));
  set("ops-running-total", fmtNum(s.runningTasks));
  set("ops-launches-total", fmtNum(s.launchesTotal));
  set("ops-agent-runs", fmtNum(s.agentRunsToday));
  set("ops-orders-today", fmtNum(s.ordersToday));
  set("ops-revenue-today", fmtMoney(s.revenueTodayUsd, "USD"));
  set("ops-avg-progress", `${s.avgProgress || 0}%`);
  set("ops-updated-at", fmtDateTime(data.updatedAt));
}

function renderOpsCategories(categories) {
  const el = document.getElementById("ops-categories");
  if (!el) return;
  el.innerHTML = (categories || [])
    .map(
      (c) => `
    <article class="ops-cat-card">
      <h4>${escapeHtml(c.category)}</h4>
      <p><strong>${c.methods}</strong> 种方式 · <strong>${c.deliverables}</strong> 条内容记录</p>
      <div class="ops-cat-card__bar"><div style="width:${c.avgProgress}%"></div></div>
      <span class="ops-cat-card__pct">${c.avgProgress}% 平均进度</span>
    </article>`
    )
    .join("");
}

function renderOpsMethodsGrid(methods) {
  const el = document.getElementById("ops-methods-grid");
  if (!el) return;
  const filtered = (methods || []).filter((m) => !opsMethodFilter || m.id === opsMethodFilter);
  el.innerHTML = filtered
    .map((m) => {
      const latest = m.deliverables?.[0];
      return `
    <article class="ops-method-card" data-method="${m.id}">
      <header class="ops-method-card__head">
        <span class="ops-method-card__cat">${escapeHtml(m.category)}</span>
        <span class="ops-method-card__status ops-method-card__status--${statusClass(m.status)}">${m.status}</span>
      </header>
      <h4 class="ops-method-card__title">${escapeHtml(m.label)}</h4>
      <div class="ops-method-card__progress">
        <div class="ops-bar"><div class="ops-bar__fill" style="width:${m.progress}%"></div></div>
        <span>${m.progress}%</span>
      </div>
      <p class="ops-method-card__meta">
        今日执行 <strong>${m.executionsToday}</strong> · 内容记录 <strong>${m.deliverablesCount}</strong> · 花费 <strong>$0</strong>
      </p>
      ${
        latest
          ? `<details class="ops-method-card__latest">
        <summary>最新内容 · ${fmtDateTime(latest.at)}</summary>
        <p class="ops-method-card__body">${escapeHtml(latest.body).slice(0, 600)}</p>
      </details>`
          : `<p class="ops-method-card__empty">暂无内容记录 — 点击「一键启动全部推广」开始执行</p>`
      }
    </article>`;
    })
    .join("");
}

function renderOpsRunning(running) {
  const el = document.getElementById("ops-running-list");
  if (!el) return;
  if (!running?.length) {
    el.innerHTML = '<p class="ops-empty">当前没有进行中的任务。点击「一键启动全部推广」部署 33 种方式。</p>';
    return;
  }
  el.innerHTML = running
    .map(
      (r) => `
    <article class="ops-running-item">
      <div class="ops-running-item__head">
        <strong>${escapeHtml(r.title)}</strong>
        <span class="ops-method-card__status ops-method-card__status--active">进行中</span>
      </div>
      <p class="ops-running-item__method">${escapeHtml(r.methodLabel)}</p>
      <div class="ops-method-card__progress">
        <div class="ops-bar"><div class="ops-bar__fill" style="width:${r.progress}%"></div></div>
        <span>${r.progress}%</span>
      </div>
      <p class="ops-running-item__due">截止 ${fmtDateTime(r.dueAt)}</p>
    </article>`
    )
    .join("");
}

function filterContentFeed(feed) {
  let items = feed || [];
  if (opsSearch) {
    const q = opsSearch.toLowerCase();
    items = items.filter(
      (i) =>
        (i.title || "").toLowerCase().includes(q) ||
        (i.body || "").toLowerCase().includes(q) ||
        (i.methodLabel || "").toLowerCase().includes(q) ||
        (i.type || "").toLowerCase().includes(q)
    );
  }
  if (opsMethodFilter) {
    items = items.filter((i) => i.methodId === opsMethodFilter);
  }
  return items;
}

function renderOpsContentFeed(feed) {
  const el = document.getElementById("ops-content-feed");
  if (!el) return;
  const items = filterContentFeed(feed);
  if (!items.length) {
    el.innerHTML =
      '<p class="ops-empty">暂无匹配的内容记录。执行「一键启动全部推广」或运行 AI 代理后，真实日志将显示在这里。</p>';
    return;
  }
  el.innerHTML = items
    .map(
      (item) => `
    <article class="ops-content-card" data-method="${item.methodId}">
      <header class="ops-content-card__head">
        <div>
          <span class="ops-content-card__type">${escapeHtml(item.type)}</span>
          <span class="ops-content-card__source">${escapeHtml(item.source)}</span>
        </div>
        <time>${fmtDateTime(item.at)}</time>
      </header>
      <h4 class="ops-content-card__method">${escapeHtml(item.methodLabel)}</h4>
      <p class="ops-content-card__title">${escapeHtml(item.title)}</p>
      <details class="ops-content-card__details">
        <summary>查看完整内容</summary>
        <pre class="ops-content-card__body">${escapeHtml(item.body)}</pre>
      </details>
      <footer class="ops-content-card__foot">
        <span>代理: ${escapeHtml(item.agent)}</span>
        <span class="ops-real-badge">真实记录</span>
      </footer>
    </article>`
    )
    .join("");
}

function renderOpsTimeline(timeline) {
  const el = document.getElementById("ops-timeline");
  if (!el) return;
  const items = (timeline || []).slice(0, 100);
  if (!items.length) {
    el.innerHTML = '<p class="ops-empty">暂无操作时间线记录。</p>';
    return;
  }
  el.innerHTML = items
    .map(
      (t) => `
    <article class="ops-timeline-item ops-timeline-item--${t.kind || "activity"}">
      <time>${fmtDateTime(t.at)}</time>
      <strong>${escapeHtml(t.title || t.agent)}</strong>
      <p>${escapeHtml((t.body || "").slice(0, 400))}${(t.body || "").length > 400 ? "…" : ""}</p>
      <span class="ops-real-badge">${t.source || "真实记录"}</span>
    </article>`
    )
    .join("");
}

function renderOpsLaunchHistory(launches) {
  const el = document.getElementById("ops-launch-history");
  if (!el) return;
  if (!launches?.length) {
    el.innerHTML = '<p class="ops-empty">暂无一键启动历史。使用上方「一键启动全部推广」开始。</p>';
    return;
  }
  el.innerHTML = launches
    .map(
      (l) => `
    <article class="ops-launch-card">
      <header class="ops-launch-card__head">
        <strong>${fmtDateTime(l.at)}</strong>
        <span>${l.methodsTotal} 种方式</span>
      </header>
      <p class="ops-launch-card__url">目标网站: <a href="${escapeHtml(l.websiteUrl)}" target="_blank" rel="noopener">${escapeHtml(l.websiteUrl || "—")}</a></p>
      <p class="ops-launch-card__meta">Marketing ${l.marketingProgress || 0}% · 内容营销 ${l.contentMarketingProgress || 0}%</p>
      <div class="ops-launch-card__agents">
        ${(l.agentResults || [])
          .map(
            (r) => `
          <details class="ops-launch-agent">
            <summary>${escapeHtml(r.agentName || r.agentId)} ${r.ai ? "· AI" : "· 模板"}</summary>
            <pre class="ops-content-card__body">${escapeHtml(r.content || r.preview || "")}</pre>
          </details>`
          )
          .join("")}
      </div>
    </article>`
    )
    .join("");
}

function renderOpsMethodFilter(methods) {
  const sel = document.getElementById("ops-method-filter");
  if (!sel) return;
  const current = opsMethodFilter;
  sel.innerHTML =
    `<option value="">全部 ${methods?.length || 33} 种推广方式</option>` +
    (methods || [])
      .map((m) => `<option value="${m.id}"${m.id === current ? " selected" : ""}>${escapeHtml(m.label)}</option>`)
      .join("");
}

function switchOpsPanel(panel) {
  opsFilter = panel;
  document.querySelectorAll(".ops-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.panel === panel);
  });
  document.querySelectorAll(".ops-panel").forEach((p) => {
    p.hidden = p.dataset.panel !== panel;
  });
}

function renderMarketingOperationsDashboard(data) {
  if (!data) return;
  opsData = data;
  renderOpsSummary(data);
  renderOpsCategories(data.categories);
  renderOpsMethodFilter(data.methods);
  renderOpsMethodsGrid(data.methods);
  renderOpsRunning(data.running);
  renderOpsContentFeed(data.contentFeed);
  renderOpsTimeline(data.timeline);
  renderOpsLaunchHistory(data.launchHistory);
}

async function loadMarketingOperationsDashboard(options = {}) {
  const id = opsCompanyId();
  if (!id) return false;
  const suffix = options.refresh ? `?_=${Date.now()}` : "";
  try {
    const res = await window.api(`/api/companies/${id}/marketing/operations${suffix}`, {
      cache: options.refresh ? "no-store" : "default",
      headers: options.refresh ? { "Cache-Control": "no-cache", Pragma: "no-cache" } : undefined,
    });
    const data = await res.json();
    if (data.success && data.operations) {
      renderMarketingOperationsDashboard(data.operations);
      return true;
    }
  } catch (err) {
    if (options.refresh) throw err;
  }
  return false;
}

function setupMarketingOperationsDashboard() {
  if (window.__opsDashboardBound) return;
  window.__opsDashboardBound = true;

  document.querySelectorAll(".ops-tab").forEach((tab) => {
    tab.addEventListener("click", () => switchOpsPanel(tab.dataset.panel));
  });

  document.getElementById("ops-method-filter")?.addEventListener("change", (e) => {
    opsMethodFilter = e.target.value;
    if (opsData) {
      renderOpsMethodsGrid(opsData.methods);
      renderOpsContentFeed(opsData.contentFeed);
    }
  });

  document.getElementById("ops-search")?.addEventListener("input", (e) => {
    opsSearch = e.target.value.trim();
    if (opsData) renderOpsContentFeed(opsData.contentFeed);
  });
}

window.loadMarketingOperationsDashboard = loadMarketingOperationsDashboard;
window.renderMarketingOperationsDashboard = renderMarketingOperationsDashboard;
window.setupMarketingOperationsDashboard = setupMarketingOperationsDashboard;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupMarketingOperationsDashboard);
} else {
  setupMarketingOperationsDashboard();
}
