const params = new URLSearchParams(location.search);
let companyId = params.get("company") || window.companyId;
window.companyId = companyId;

window.api = window.api || ((path, options = {}) => fetch(path, { credentials: "include", ...options }));
const api = window.api;

function getCompanyId() {
  return window.companyId || companyId || new URLSearchParams(location.search).get("company");
}

function setCompanyId(id) {
  companyId = id;
  window.companyId = id;
}

let refreshToastTimer = null;

function showDashboardRefreshToast(message, type = "info") {
  const el = document.getElementById("dashboard-refresh-toast");
  if (!el || !message) return;
  el.hidden = false;
  el.textContent = message;
  el.className = `dashboard-refresh-toast dashboard-refresh-toast--${type}`;
  if (refreshToastTimer) clearTimeout(refreshToastTimer);
  if (type !== "loading") {
    refreshToastTimer = setTimeout(() => {
      el.hidden = true;
    }, 2800);
  }
}

function setPanelRefreshLoading(buttonId, loading) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.disabled = loading;
  btn.classList.toggle("is-refreshing", loading);
  btn.setAttribute("aria-busy", loading ? "true" : "false");
  if (loading) {
    btn.dataset.defaultLabel = btn.dataset.defaultLabel || btn.textContent;
    btn.textContent = "刷新中…";
  } else {
    btn.textContent = btn.dataset.defaultLabel || "↻ 刷新";
  }
}

async function runPanelRefresh(buttonId, label, loader) {
  const id = getCompanyId();
  if (!id) {
    showDashboardRefreshToast("缺少公司 ID，请从仪表盘链接进入", "error");
    return false;
  }
  setPanelRefreshLoading(buttonId, true);
  showDashboardRefreshToast(`正在刷新${label}…`, "loading");
  try {
    const ok = await loader({ refresh: true });
    showDashboardRefreshToast(`${label}已刷新`, "success");
    return ok !== false;
  } catch (err) {
    showDashboardRefreshToast(err.message || `${label}刷新失败`, "error");
    return false;
  } finally {
    setPanelRefreshLoading(buttonId, false);
  }
}

const AGENTS = [
  { id: "ceo", name: "CEO Agent", icon: "◆" },
  { id: "engineering", name: "Engineering Agent", icon: "⌘" },
  { id: "marketing", name: "Marketing Agent", icon: "✦" },
  { id: "ads", name: "Growth Agent", icon: "▶" },
  { id: "support", name: "Support Agent", icon: "◎" },
  { id: "ops", name: "Ops Agent", icon: "⚡" },
];

let activeAgent = "ceo";
let company = null;
let subscriptionActive = false;
let checkoutUrl = "/checkout.html?plan=pro&cycle=monthly";
let allLogs = [];
let historySearch = "";
let historyFilter = "qa";

function isUserLog(l) {
  return l.role === "user" || l.type === "question" || l.agent === "You";
}

function isAnswerLog(l) {
  return l.role === "agent" || l.type === "answer" || (l.ai && !isUserLog(l));
}

function pairLogsIntoItems(logs) {
  const items = [];
  let i = 0;
  while (i < logs.length) {
    const log = logs[i];
    if (isUserLog(log)) {
      const next = logs[i + 1];
      if (next && isAnswerLog(next)) {
        items.push({ kind: "qa", question: log, answer: next });
        i += 2;
        continue;
      }
      items.push({ kind: "question-only", log });
      i += 1;
      continue;
    }
    items.push({ kind: "log", log });
    i += 1;
  }
  return items;
}

function formatEtaBadge(etaDays) {
  if (!etaDays) return "";
  const label = etaDays.label || (etaDays.min === etaDays.max ? `${etaDays.min} 天` : `${etaDays.min}-${etaDays.max} 天`);
  return `<span class="qa-eta-badge" title="预计完成时间">⏱ 预计 ${escapeHtml(label)} 完成</span>`;
}

function renderQaCard(q, a) {
  const agentName = a?.agent || q?.agentName || "AI";
  const eta = a?.etaDays ? formatEtaBadge(a.etaDays) : "";
  const answerText = a?.message || "（等待 AI 回复…）";
  const waiting = !a;
  return `
  <article class="qa-card${waiting ? " qa-card--waiting" : ""}">
    <header class="qa-card__header">
      <span class="qa-card__time">${formatDateTime(q.at)}</span>
      <span class="qa-card__agent">${escapeHtml(agentName)}</span>
      ${eta}
    </header>
    <div class="qa-card__question">
      <span class="qa-card__label">您的问题 / 指令</span>
      <p class="qa-card__text">${escapeHtml(q.message?.replace(/^→\s*[^:]+:\s*/, "") || q.message || "")}</p>
    </div>
    <div class="qa-card__answer">
      <span class="qa-card__label">AI 完整回复 ${a?.ai ? '<span class="badge">AI</span>' : ""}</span>
      <pre class="qa-card__text qa-card__text--answer">${escapeHtml(answerText)}</pre>
    </div>
  </article>`;
}

function agentClass(agent, role) {
  if (role === "user" || agent === "You") return "log-line--user";
  const a = (agent || "").toLowerCase();
  if (a.includes("system")) return "log-line--system";
  if (a.includes("ceo")) return "log-line--ceo";
  if (a.includes("engineering")) return "log-line--engineering";
  if (a.includes("marketing")) return "log-line--marketing";
  if (a.includes("growth") || a.includes("ads")) return "log-line--growth";
  if (a.includes("support")) return "log-line--support";
  if (a.includes("ops")) return "log-line--ops";
  return "";
}

function formatDateLabel(iso) {
  if (!iso) return "未知日期";
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return "今天";
  if (sameDay(d, yesterday)) return "昨天";
  return d.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

function formatDateTime(iso) {
  if (!iso) return "--:--";
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function filterLogs(logs, search, filter) {
  let list = [...logs];
  if (filter === "user") {
    list = list.filter((l) => isUserLog(l));
  } else if (filter === "qa") {
    // keep all for pairing; qa view filters in buildLogHtml
  } else if (filter !== "all") {
    list = list.filter((l) => l.agent === filter);
  }
  const q = (search || "").trim().toLowerCase();
  if (q) {
    list = list.filter(
      (l) =>
        (l.message || "").toLowerCase().includes(q) ||
        (l.agent || "").toLowerCase().includes(q) ||
        (l.question || "").toLowerCase().includes(q)
    );
  }
  return list;
}

function buildLogHtml(logs) {
  if (!logs?.length) {
    return `<div class="log-line empty-history">暂无历史记录。在下方输入问题或指令，AI 完整回复与预计完成天数将显示在这里。</div>`;
  }

  if (historyFilter === "qa") {
    const items = pairLogsIntoItems(logs).filter((item) => item.kind === "qa" || item.kind === "question-only");
    if (!items.length) {
      return `<div class="log-line empty-history">暂无问答对话。发送第一个问题开始吧。</div>`;
    }
    const groups = new Map();
    for (const item of items) {
      const key = formatDateLabel((item.question || item.log)?.at);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    let html = "";
    for (const [label, entries] of groups) {
      html += `<div class="history-date-group"><div class="history-date-label">${escapeHtml(label)} · ${entries.length} 条对话</div>`;
      html += entries
        .map((item) => {
          if (item.kind === "qa") return renderQaCard(item.question, item.answer);
          return renderQaCard(item.log, null);
        })
        .join("");
      html += `</div>`;
    }
    return html;
  }

  const groups = new Map();
  for (const l of logs) {
    const key = formatDateLabel(l.at);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(l);
  }
  let html = "";
  for (const [label, entries] of groups) {
    html += `<div class="history-date-group"><div class="history-date-label">${escapeHtml(label)}</div>`;
    html += entries
      .map((l) => {
        const cls = agentClass(l.agent, l.role);
        return `
    <div class="log-line ${cls}${l.ai ? " ai" : ""}">
      <span class="time">${formatDateTime(l.at)}</span>
      <span class="agent">[${escapeHtml(l.agent)}]</span>
      <span class="log-line__message">${escapeHtml(l.message)}</span>
      ${l.ai ? '<span class="badge">AI</span>' : ""}
    </div>`;
      })
      .join("");
    html += `</div>`;
  }
  return html;
}

function updateHistoryCount(shown, total) {
  const el = document.getElementById("history-count");
  if (!el) return;
  if (historyFilter === "qa") {
    const qaCount = pairLogsIntoItems(allLogs).filter(
      (i) => i.kind === "qa" || i.kind === "question-only"
    ).length;
    el.textContent = `${qaCount} 条问答对话`;
    return;
  }
  if (shown === total) {
    el.textContent = `${total} 条记录`;
  } else {
    el.textContent = `显示 ${shown} / ${total} 条`;
  }
}

function renderLogs(logs, { scrollTo = "bottom", targetId = "log-body" } = {}) {
  allLogs = logs || [];
  const filtered = filterLogs(allLogs, historySearch, historyFilter);
  const html = buildLogHtml(filtered);
  const body = document.getElementById(targetId);
  if (!body) return;
  const prevScroll = body.scrollTop;
  const wasAtBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 48;
  body.innerHTML = html;
  if (targetId === "log-body") {
    updateHistoryCount(filtered.length, allLogs.length);
    const modalBody = document.getElementById("log-body-modal");
    if (modalBody && document.getElementById("history-modal")?.open) {
      modalBody.innerHTML = html;
    }
  }
  if (scrollTo === "bottom" || wasAtBottom) {
    body.scrollTop = body.scrollHeight;
  } else if (scrollTo === "top") {
    body.scrollTop = 0;
  } else {
    body.scrollTop = prevScroll;
  }
}

function syncHistoryControls() {
  const modal = document.getElementById("history-modal");
  const searchModal = document.getElementById("history-search-modal");
  const filterModal = document.getElementById("history-filter-modal");
  if (searchModal) searchModal.value = historySearch;
  if (filterModal) filterModal.value = historyFilter;
  document.getElementById("history-search").value = historySearch;
  document.getElementById("history-filter").value = historyFilter;
  renderLogs(allLogs);
  if (modal?.open) {
    const filtered = filterLogs(allLogs, historySearch, historyFilter);
    document.getElementById("log-body-modal").innerHTML = buildLogHtml(filtered);
    document.getElementById("log-body-modal").scrollTop =
      document.getElementById("log-body-modal").scrollHeight;
  }
}

function setupHistoryUi() {
  const onSearch = (e) => {
    historySearch = e.target.value;
    document.getElementById("history-search").value = historySearch;
    document.getElementById("history-search-modal").value = historySearch;
    syncHistoryControls();
  };
  const onFilter = (e) => {
    historyFilter = e.target.value;
    document.getElementById("history-filter").value = historyFilter;
    document.getElementById("history-filter-modal").value = historyFilter;
    syncHistoryControls();
  };

  document.getElementById("history-search")?.addEventListener("input", onSearch);
  document.getElementById("history-search-modal")?.addEventListener("input", onSearch);
  document.getElementById("history-filter")?.addEventListener("change", onFilter);
  document.getElementById("history-filter-modal")?.addEventListener("change", onFilter);

  document.getElementById("btn-history-top")?.addEventListener("click", () => {
    const body = document.getElementById("log-body");
    body.scrollTop = 0;
  });
  document.getElementById("btn-history-bottom")?.addEventListener("click", () => {
    const body = document.getElementById("log-body");
    body.scrollTop = body.scrollHeight;
  });

  const modal = document.getElementById("history-modal");
  document.getElementById("btn-history-fullscreen")?.addEventListener("click", () => {
    syncHistoryControls();
    modal?.showModal();
    const modalBody = document.getElementById("log-body-modal");
    if (modalBody) modalBody.scrollTop = modalBody.scrollHeight;
  });
  document.getElementById("btn-history-close")?.addEventListener("click", () => modal?.close());
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) modal.close();
  });
}

function formatExpiry(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" });
}

function subscriptionLabel(sub) {
  if (!sub) return "专业版";
  if (sub.cycle === "lifetime" || sub.planId === "lifetime" || sub.lifetime) {
    return "✓ 终身版";
  }
  if (sub.cycle === "trial") {
    return `✓ 免费体验中 · 至 ${formatExpiry(sub.expiresAt)}`;
  }
  const cycle = sub.cycle === "annual" ? "年付" : "月付";
  return `✓ ${cycle} · 至 ${formatExpiry(sub.expiresAt)}`;
}

function formatTime(iso) {
  return formatDateTime(iso);
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}

async function fetchLogs() {
  const id = getCompanyId();
  if (!id) return;
  const res = await api(`/api/companies/${id}/logs?limit=500&_=${Date.now()}`, {
    cache: "no-store",
  });
  const data = await res.json();
  if (data.success) renderLogs(data.logs);
}

function renderAgentList() {
  const ul = document.getElementById("agent-list");
  ul.innerHTML = AGENTS.map(
    (a) => `
    <li>
      <button type="button" class="agent-btn${a.id === activeAgent ? " active" : ""}" data-agent="${a.id}">
        <span class="icon">${a.icon}</span> ${a.name}
      </button>
    </li>`
  ).join("");

  ul.querySelectorAll(".agent-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeAgent = btn.dataset.agent;
      renderAgentList();
      const agent = AGENTS.find((a) => a.id === activeAgent);
      document.getElementById("chat-title").textContent = `全自动AI智能体对话 · ${agent.name}`;
    });
  });
}

function updateSubscriptionUi(active, subscription, meta = {}) {
  subscriptionActive = active;
  const banner = document.getElementById("paywall-banner");
  const layout = document.querySelector(".dashboard-layout");
  const pricingBtn = document.querySelector('a[href="/pricing.html"]');
  const trialBanner = document.getElementById("trial-banner");

  if (active) {
    banner.hidden = true;
    layout?.classList.remove("locked");
    if (pricingBtn) pricingBtn.textContent = subscriptionLabel(subscription);
    if (trialBanner) {
      const onTrial = subscription?.cycle === "trial" || meta.onTrial;
      trialBanner.hidden = !onTrial;
      if (onTrial) {
        const days = meta.trialDaysLeft ?? "";
        trialBanner.innerHTML = `
          <strong>免费 ${meta.trialDays || 3} 天全功能体验进行中</strong>
          <span>剩余约 ${days} 天 · 到期后请订阅月付或年付以继续使用</span>
          <a href="${checkoutUrl}" class="btn-primary" style="height:36px;padding:0 14px;font-size:12px">提前订阅</a>
        `;
      }
    }
  } else {
    banner.hidden = false;
    layout?.classList.add("locked");
    if (trialBanner) trialBanner.hidden = true;
    const title = document.querySelector("#paywall-banner strong");
    const desc = document.querySelector("#paywall-banner p");
    const trialEnded = subscription?.cycle === "trial" || subscription?.trialUsed;
    if (title) {
      title.textContent = trialEnded
        ? "免费 3 天体验已结束"
        : "订阅专业版后即可使用全部功能";
    }
    if (desc) {
      desc.textContent = trialEnded
        ? "订阅月付或年付后可继续使用全部 AI Agent 功能。中国内地银行卡转账，海外 PayPal。"
        : "月付 ¥699 / $99，年付 ¥6999 / $999。中国内地可用银行卡转账，海外用户可用 PayPal。";
    }
    const cta = document.getElementById("paywall-cta");
    if (cta) cta.href = checkoutUrl;
    if (pricingBtn) pricingBtn.textContent = "订阅专业版";
  }
}

function handleSubscriptionError(data) {
  if (data.checkoutUrl) checkoutUrl = data.checkoutUrl;
  updateSubscriptionUi(false);
  return data.errorZh || data.error || "Subscription required";
}

async function loadConfig() {
  const res = await fetch("/api/config");
  const cfg = await res.json();
  const el = document.getElementById("ai-status");
  if (cfg.aiEnabled) {
    el.textContent = "● AI agents live";
    el.classList.remove("offline");
  } else {
    el.textContent = "○ Template mode — add OPENROUTER_API_KEY";
    el.classList.add("offline");
  }
}

async function loadCompany() {
  const meRes = await api("/api/auth/me");
  if (!meRes.ok) {
    window.location.href = "/login.html";
    return;
  }
  const me = await meRes.json();
  if (!companyId && me.company?.id) {
    window.location.replace(`/dashboard.html?company=${me.company.id}`);
    return;
  }
  if (!getCompanyId()) {
    window.location.href = "/login.html";
    return;
  }

  setCompanyId(getCompanyId());

  await refreshCompanySnapshot({ redirectOnFail: true });
  loadMarketingDashboard();
  loadRealRevenueDashboard();
  loadBankRevenueDashboard();
  loadContentMarketingDashboard();
  loadLaunchCatalog();
  loadMarketingAnalytics();
}

let dashboardRefreshing = false;

function setDashboardRefreshLoading(loading) {
  const btn = document.getElementById("btn-dashboard-refresh");
  if (!btn) return;
  btn.disabled = loading;
  btn.classList.toggle("is-refreshing", loading);
  btn.setAttribute("aria-busy", loading ? "true" : "false");
  if (loading) {
    btn.dataset.defaultLabel = btn.dataset.defaultLabel || btn.textContent;
    btn.textContent = "刷新中…";
  } else {
    btn.textContent = btn.dataset.defaultLabel || "↻ 刷新";
  }
}

async function refreshCompanySnapshot({ redirectOnFail = false } = {}) {
  const id = getCompanyId();
  if (!id) return false;

  const res = await api(`/api/companies/${id}?_=${Date.now()}`, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
  });
  if (res.status === 401) {
    if (redirectOnFail) window.location.href = "/login.html";
    return false;
  }
  const data = await res.json();
  if (!data.success) {
    if (redirectOnFail) {
      alert(data.errorZh || data.error || "Company not found");
      window.location.href = "/login.html";
    }
    throw new Error(data.errorZh || data.error || "刷新失败");
  }

  company = data.company;
  setCompanyId(company.id);
  if (data.checkoutUrl) checkoutUrl = data.checkoutUrl;
  document.getElementById("company-name").textContent = company.name;
  document.getElementById("company-idea").textContent = company.idea;
  localStorage.setItem("pzhisen_company_id", company.id);
  if (company.email) localStorage.setItem("pzhisen_email", company.email);
  if (company.websiteUrl && typeof prefillLaunchWebsiteUrl === "function") {
    prefillLaunchWebsiteUrl(company.websiteUrl);
  }
  renderLogs(data.logs);
  updateSubscriptionUi(Boolean(data.subscriptionActive), data.subscription, {
    onTrial: data.onTrial,
    trialDays: data.trialDays,
    trialDaysLeft: data.trialDaysLeft,
  });
  return true;
}

async function refreshAllDashboards() {
  const id = getCompanyId();
  if (dashboardRefreshing || !id) {
    if (!id) showDashboardRefreshToast("缺少公司 ID，无法刷新", "error");
    return;
  }
  dashboardRefreshing = true;
  setDashboardRefreshLoading(true);
  showDashboardRefreshToast("正在刷新全部仪表盘数据…", "loading");

  try {
    await Promise.all([
      loadConfig(),
      refreshCompanySnapshot(),
      fetchLogs(),
      typeof loadMarketingDashboard === "function" ? loadMarketingDashboard({ refresh: true }) : null,
      typeof loadRealRevenueDashboard === "function" ? loadRealRevenueDashboard({ refresh: true }) : null,
      typeof loadBankRevenueDashboard === "function" ? loadBankRevenueDashboard({ refresh: true }) : null,
      typeof loadContentMarketingDashboard === "function" ? loadContentMarketingDashboard({ refresh: true }) : null,
      typeof loadLaunchCatalog === "function" ? loadLaunchCatalog({ refresh: true }) : null,
      typeof loadMarketingAnalytics === "function" ? loadMarketingAnalytics({ refresh: true }) : null,
    ]);
    const btn = document.getElementById("btn-dashboard-refresh");
    if (btn) {
      const time = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
      btn.title = `刷新全部仪表盘数据 · 最后更新 ${time}`;
    }
    showDashboardRefreshToast("全部仪表盘数据已刷新", "success");
  } catch (err) {
    showDashboardRefreshToast(err.message || "刷新失败，请稍后重试", "error");
  } finally {
    dashboardRefreshing = false;
    setDashboardRefreshLoading(false);
  }
}

async function runDaily() {
  if (!subscriptionActive) {
    alert("请先订阅专业版（月付或年付）后使用全部功能。");
    location.href = checkoutUrl;
    return;
  }

  const btn = document.getElementById("btn-run-daily");
  const btnAll = document.getElementById("btn-run-all");
  btn.disabled = true;
  btnAll.disabled = true;
  btn.textContent = "Agents working…";

  try {
    const res = await api(`/api/companies/${companyId}/run-daily`, { method: "POST" });
    const data = await res.json();
    if (res.status === 402) throw new Error(handleSubscriptionError(data));
    if (!data.success) throw new Error(data.error);
    renderLogs(data.logs);
    if (data.marketing) renderMarketingDashboard(data.marketing);
    if (data.contentMarketing) renderContentMarketingDashboard(data.contentMarketing);
    if (data.analytics) renderAnalyticsDashboard(data.analytics);
  } catch (e) {
    alert(e.message);
  } finally {
    btn.disabled = false;
    btnAll.disabled = false;
    btn.textContent = "Run daily standup";
  }
}

document.getElementById("btn-run-daily").addEventListener("click", runDaily);
document.getElementById("btn-run-all").addEventListener("click", runDaily);

document.getElementById("chat-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!subscriptionActive) {
    alert("请先订阅专业版（月付或年付）后使用全部功能。");
    location.href = checkoutUrl;
    return;
  }

  const input = document.getElementById("chat-input");
  const message = input.value.trim();
  if (!message || !companyId) return;

  const agentName = AGENTS.find((a) => a.id === activeAgent)?.name || activeAgent;
  const now = new Date().toISOString();
  renderLogs([
    ...allLogs,
    {
      agent: "You",
      role: "user",
      type: "question",
      agentName,
      message,
      at: now,
    },
    {
      agent: agentName,
      role: "agent",
      type: "answer",
      message: "AI 智能体正在认真分析您的问题，请稍候…",
      at: now,
      ai: true,
      pending: true,
    },
  ]);

  const respEl = document.getElementById("chat-response");
  respEl.classList.add("visible");
  respEl.textContent = "AI 正在生成完整回复（含预计完成天数）…";
  input.value = "";

  try {
    const res = await api(`/api/companies/${companyId}/agents/${activeAgent}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    if (res.status === 402) throw new Error(handleSubscriptionError(data));
    if (!data.success) throw new Error(data.error);
    respEl.textContent = data.result.content;
    if (data.marketing) renderMarketingDashboard(data.marketing);
    if (data.contentMarketing) renderContentMarketingDashboard(data.contentMarketing);
    if (data.analytics) renderAnalyticsDashboard(data.analytics);
    historyFilter = "qa";
    document.getElementById("history-filter").value = "qa";
    document.getElementById("history-filter-modal").value = "qa";
    await fetchLogs();
    const body = document.getElementById("log-body");
    if (body) body.scrollTop = body.scrollHeight;
  } catch (err) {
    respEl.textContent = `Error: ${err.message}`;
  }
});

document.getElementById("btn-logout")?.addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST" });
  localStorage.removeItem("pzhisen_company_id");
  location.href = "/login.html";
});

window.getCompanyId = getCompanyId;
window.setCompanyId = setCompanyId;
window.showDashboardRefreshToast = showDashboardRefreshToast;
window.runPanelRefresh = runPanelRefresh;
window.refreshAllDashboards = refreshAllDashboards;

renderAgentList();
setupHistoryUi();
setupMarketingDashboard();
setupMarketingLaunch();
setupMarketingAnalytics();
setupRealRevenueDashboard();
setupBankRevenueDashboard();
setupContentMarketingDashboard();
loadConfig();
loadCompany();

setInterval(async () => {
  const id = getCompanyId();
  if (!id) return;
  const res = await api(`/api/companies/${id}`);
  const data = await res.json();
  if (data.success) updateSubscriptionUi(Boolean(data.subscriptionActive), data.subscription);
}, 10000);

setInterval(fetchLogs, 15000);
setInterval(loadMarketingDashboard, 45000);
setInterval(loadRealRevenueDashboard, 30000);
setInterval(loadBankRevenueDashboard, 30000);
setInterval(loadContentMarketingDashboard, 45000);
setInterval(loadMarketingAnalytics, 60000);
