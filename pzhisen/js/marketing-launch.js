/* global companyId, api, subscriptionActive, checkoutUrl, renderMarketingDashboard, renderContentMarketingDashboard, renderLogs, fetchLogs */

let launchCatalog = null;

function renderMethodChips(methods) {
  const el = document.getElementById("launch-methods-preview");
  if (!el || !methods?.length) return;
  const shown = methods.slice(0, 12);
  const more = methods.length - shown.length;
  el.innerHTML =
    shown.map((m) => `<span class="launch-chip" title="${m.category}">${m.label}</span>`).join("") +
    (more > 0 ? `<span class="launch-chip launch-chip--more">+${more} 更多方式</span>` : "");
}

async function loadLaunchCatalog() {
  if (!companyId) return;
  try {
    const res = await api(`/api/companies/${companyId}/marketing/launch-catalog`);
    const data = await res.json();
    if (data.success && data.catalog) {
      launchCatalog = data.catalog;
      renderMethodChips(data.catalog.methods);
    }
  } catch (_) {
    /* ignore */
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
  el.innerHTML = `
    <div class="launch-all-result__inner">
      <h3>✅ 已启动 ${launch.methodsTotal} 种推广方式</h3>
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

  const btn = document.getElementById("btn-launch-all-marketing");
  if (!btn || btn.disabled) return;

  btn.disabled = true;
  btn.classList.add("launch-all-btn--loading");
  setLaunchStatus("正在一键部署并启动所有推广营销方式，请稍候…", "loading");

  try {
    const res = await api(`/api/companies/${companyId}/marketing/launch-all`, { method: "POST" });
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
    if (data.logs) renderLogs(data.logs);
    else await fetchLogs();

    showLaunchResult(data.launch);
    setLaunchStatus(`✅ 已成功启动全部 ${data.launch?.methodsTotal || ""} 种推广方式！`, "success");
  } catch (err) {
    setLaunchStatus(`启动失败：${err.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.classList.remove("launch-all-btn--loading");
  }
}

function setupMarketingLaunch() {
  document.getElementById("btn-launch-all-marketing")?.addEventListener("click", launchAllMarketing);
  loadLaunchCatalog();
}

window.setupMarketingLaunch = setupMarketingLaunch;
window.launchAllMarketing = launchAllMarketing;
window.loadLaunchCatalog = loadLaunchCatalog;
