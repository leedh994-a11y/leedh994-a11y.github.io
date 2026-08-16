/* global companyId, api, subscriptionActive, checkoutUrl, renderMarketingDashboard, renderContentMarketingDashboard, renderLogs, fetchLogs */

if (typeof window !== "undefined") {
  window.api = window.api || ((path, options = {}) => fetch(path, { credentials: "include", ...options }));
}

const LAUNCH_URL_STORAGE_KEY = "pzhisen_launch_website_url";

let launchCatalog = null;

function normalizeWebsiteUrl(raw) {
  if (!raw || typeof raw !== "string") return null;
  let value = raw.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (!url.hostname || !url.hostname.includes(".")) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function getLaunchWebsiteUrlInput() {
  return document.getElementById("launch-website-url");
}

function getLaunchWebsiteUrl() {
  return normalizeWebsiteUrl(getLaunchWebsiteUrlInput()?.value);
}

function prefillLaunchWebsiteUrl(url) {
  const input = getLaunchWebsiteUrlInput();
  if (!input || !url) return;
  const normalized = normalizeWebsiteUrl(url);
  if (normalized) input.value = normalized;
}

function rememberLaunchWebsiteUrl(url) {
  const normalized = normalizeWebsiteUrl(url);
  if (normalized) localStorage.setItem(LAUNCH_URL_STORAGE_KEY, normalized);
}

function restoreLaunchWebsiteUrl() {
  const saved = localStorage.getItem(LAUNCH_URL_STORAGE_KEY);
  const input = getLaunchWebsiteUrlInput();
  if (saved && input && !input.value) {
    input.value = saved;
  }
}

function renderMethodChips(methods) {
  const el = document.getElementById("launch-methods-preview");
  if (!el || !methods?.length) return;
  const shown = methods.slice(0, 12);
  const more = methods.length - shown.length;
  el.innerHTML =
    shown.map((m) => `<span class="launch-chip" title="${m.category}">${m.label}</span>`).join("") +
    (more > 0 ? `<span class="launch-chip launch-chip--more">+${more} 更多方式</span>` : "");
}

async function loadLaunchCatalog(options = {}) {
  const id = window.getCompanyId?.() || window.companyId || companyId;
  if (!id) return false;
  try {
    const suffix = options.refresh ? `?_=${Date.now()}` : "";
    const res = await window.api(`/api/companies/${id}/marketing/launch-catalog${suffix}`, {
      cache: options.refresh ? "no-store" : "default",
    });
    const data = await res.json();
    if (data.success && data.catalog) {
      launchCatalog = data.catalog;
      renderMethodChips(data.catalog.methods);
      return true;
    }
    return false;
  } catch (_) {
    return false;
  }
}

function setLaunchStatus(msg, type = "") {
  const el = document.getElementById("launch-all-status");
  if (!el) return;
  el.textContent = msg;
  el.className = `launch-all-hub__hint${type ? ` launch-all-hub__hint--${type}` : ""}`;
}

function showLaunchResult(launch) {
  const el = document.getElementById("launch-all-result");
  if (!el || !launch) return;
  el.hidden = false;
  const agents = (launch.agentResults || [])
    .map((a) => `<li><strong>${a.agentName}</strong> ${a.ai ? "✓ AI 已启动" : "已排队"}</li>`)
    .join("");
  const websiteLine = launch.websiteUrl
    ? `<p class="launch-all-result__site">推广网站：<a href="${launch.websiteUrl}" target="_blank" rel="noopener noreferrer">${launch.websiteUrl}</a></p>`
    : "";
  el.innerHTML = `
    <div class="launch-all-result__inner">
      <h3>✅ 已启动 ${launch.methodsTotal} 种推广方式</h3>
      ${websiteLine}
      <p>推广总进度 ${launch.marketingProgress}% · 内容营销 ${launch.contentMarketingProgress}% · ${launch.zeroCostPledge}</p>
      <ul class="launch-all-result__agents">${agents}</ul>
      <p class="launch-all-result__time">启动时间：${new Date(launch.startedAt).toLocaleString("zh-CN")}</p>
    </div>`;
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function launchAllMarketing() {
  if (!companyId) return;
  if (!subscriptionActive) {
    alert("请先订阅专业版后使用一键启动全渠道推广。");
    location.href = checkoutUrl;
    return;
  }

  const websiteUrl = getLaunchWebsiteUrl();
  if (!websiteUrl) {
    const input = getLaunchWebsiteUrlInput();
    input?.focus();
    input?.reportValidity?.();
    setLaunchStatus("请先输入有效的个人或企业网站网址（例如 https://example.com）", "error");
    return;
  }

  const btn = document.getElementById("btn-launch-all-marketing");
  if (!btn || btn.disabled) return;

  rememberLaunchWebsiteUrl(websiteUrl);
  btn.disabled = true;
  btn.classList.add("launch-all-btn--loading");
  setLaunchStatus(`正在为 ${websiteUrl} 一键部署并启动所有推广营销方式，请稍候…`, "loading");

  try {
    const res = await window.api(`/api/companies/${companyId}/marketing/launch-all`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ websiteUrl }),
    });
    const data = await res.json();
    if (res.status === 402) {
      alert(data.errorZh || data.error || "请先订阅专业版");
      location.href = checkoutUrl;
      return;
    }
    if (!data.success) throw new Error(data.error || "启动失败");

    if (data.marketing) renderMarketingDashboard(data.marketing);
    if (data.contentMarketing) renderContentMarketingDashboard(data.contentMarketing);
    if (data.analytics) renderAnalyticsDashboard(data.analytics);
    if (data.operations && typeof window.renderMarketingOperationsDashboard === "function") {
      window.renderMarketingOperationsDashboard(data.operations);
    } else if (typeof window.loadMarketingOperationsDashboard === "function") {
      await window.loadMarketingOperationsDashboard({ refresh: true });
    }
    if (data.logs) renderLogs(data.logs);
    else await fetchLogs();

    if (typeof window.loadDailySalesHero === "function") {
      await window.loadDailySalesHero({ refresh: true });
    } else if (data.dailySales && typeof window.renderDailySalesHero === "function") {
      window.renderDailySalesHero(data.dailySales);
    }

    showLaunchResult(data.launch);
    setLaunchStatus(`✅ 已为 ${websiteUrl} 成功启动全部 ${data.launch?.methodsTotal || ""} 种推广方式！`, "success");
    document.getElementById("dsh-pace-block")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (err) {
    setLaunchStatus(`启动失败：${err.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.classList.remove("launch-all-btn--loading");
  }
}

function setupMarketingLaunch() {
  restoreLaunchWebsiteUrl();
  document.getElementById("btn-launch-all-marketing")?.addEventListener("click", launchAllMarketing);
  getLaunchWebsiteUrlInput()?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      launchAllMarketing();
    }
  });
  loadLaunchCatalog();
}

window.setupMarketingLaunch = setupMarketingLaunch;
window.launchAllMarketing = launchAllMarketing;
window.loadLaunchCatalog = loadLaunchCatalog;
window.prefillLaunchWebsiteUrl = prefillLaunchWebsiteUrl;
