const params = new URLSearchParams(location.search);
let companyId = params.get("company");

const api = (path, options = {}) => fetch(path, { credentials: "include", ...options });

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
  if (!iso) return "--:--";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}

function renderLogs(logs) {
  const body = document.getElementById("log-body");
  if (!logs?.length) {
    body.innerHTML = `<div class="log-line"><span class="agent">[System]</span> No activity yet. Run daily standup to deploy agents.</div>`;
    return;
  }
  body.innerHTML = logs
    .map(
      (l) => `
    <div class="log-line${l.ai ? " ai" : ""}">
      <span class="time">${formatTime(l.at)}</span>
      <span class="agent">[${escapeHtml(l.agent)}]</span>
      ${escapeHtml(l.message)}
      ${l.ai ? '<span class="badge">AI</span>' : ""}
    </div>`
    )
    .join("");
  body.scrollTop = body.scrollHeight;
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
  if (!companyId) {
    window.location.href = "/login.html";
    return;
  }

  const res = await api(`/api/companies/${companyId}`);
  if (res.status === 401) {
    window.location.href = "/login.html";
    return;
  }
  const data = await res.json();
  if (!data.success) {
    alert(data.errorZh || data.error || "Company not found");
    window.location.href = "/login.html";
    return;
  }

  company = data.company;
  if (data.checkoutUrl) checkoutUrl = data.checkoutUrl;
  document.getElementById("company-name").textContent = company.name;
  document.getElementById("company-idea").textContent = company.idea;
  localStorage.setItem("pzhisen_company_id", company.id);
  if (company.email) localStorage.setItem("pzhisen_email", company.email);
  renderLogs(data.logs);
  updateSubscriptionUi(Boolean(data.subscriptionActive), data.subscription, {
    onTrial: data.onTrial,
    trialDays: data.trialDays,
    trialDaysLeft: data.trialDaysLeft,
  });
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

  const respEl = document.getElementById("chat-response");
  respEl.classList.add("visible");
  respEl.textContent = "AI 智能体正在处理…";
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
    const logsRes = await api(`/api/companies/${companyId}/logs`);
    const logsData = await logsRes.json();
    if (logsData.success) renderLogs(logsData.logs);
  } catch (err) {
    respEl.textContent = `Error: ${err.message}`;
  }
});

document.getElementById("btn-logout")?.addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST" });
  localStorage.removeItem("pzhisen_company_id");
  location.href = "/login.html";
});

renderAgentList();
loadConfig();
loadCompany();

setInterval(async () => {
  if (!companyId) return;
  const res = await api(`/api/companies/${companyId}`);
  const data = await res.json();
  if (data.success) updateSubscriptionUi(Boolean(data.subscriptionActive), data.subscription);
}, 10000);

setInterval(async () => {
  if (!companyId) return;
  const res = await api(`/api/companies/${companyId}/logs`);
  const data = await res.json();
  if (data.success) renderLogs(data.logs);
}, 15000);
