const params = new URLSearchParams(location.search);
const companyId = params.get("company");

const AGENTS = [
  { id: "ceo", name: "CEO Agent", icon: "◆" },
  { id: "engineering", name: "Engineering Agent", icon: "⌘" },
  { id: "marketing", name: "Marketing Agent", icon: "✦" },
  { id: "ads", name: "Ads Agent", icon: "▶" },
  { id: "support", name: "Support Agent", icon: "◎" },
  { id: "ops", name: "Ops Agent", icon: "⚡" },
];

let activeAgent = "ceo";
let company = null;
let subscriptionActive = false;
let checkoutUrl = "/checkout.html?plan=lifetime&cycle=lifetime";

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
      document.getElementById("chat-title").textContent = `Ask ${agent.name}`;
    });
  });
}

function updateSubscriptionUi(active) {
  subscriptionActive = active;
  const banner = document.getElementById("paywall-banner");
  const layout = document.querySelector(".dashboard-layout");
  const pricingBtn = document.querySelector('a[href="/pricing.html"]');

  if (active) {
    banner.hidden = true;
    layout?.classList.remove("locked");
    if (pricingBtn) pricingBtn.textContent = "✓ Lifetime";
  } else {
    banner.hidden = false;
    layout?.classList.add("locked");
    const cta = document.getElementById("paywall-cta");
    if (cta) cta.href = checkoutUrl;
    if (pricingBtn) pricingBtn.textContent = "¥1 / $1 Lifetime";
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
  if (!companyId) {
    window.location.href = "/#signin";
    return;
  }

  const res = await fetch(`/api/companies/${companyId}`);
  const data = await res.json();
  if (!data.success) {
    alert(data.error || "Company not found");
    window.location.href = "/";
    return;
  }

  company = data.company;
  if (data.checkoutUrl) checkoutUrl = data.checkoutUrl;
  document.getElementById("company-name").textContent = company.name;
  document.getElementById("company-idea").textContent = company.idea;
  localStorage.setItem("pzhisen_company_id", company.id);
  if (company.email) localStorage.setItem("pzhisen_email", company.email);
  renderLogs(data.logs);
  updateSubscriptionUi(Boolean(data.subscriptionActive));
}

async function runDaily() {
  if (!subscriptionActive) {
    alert("Please pay $1 (PayPal) or ¥1 to unlock all features.");
    location.href = checkoutUrl;
    return;
  }

  const btn = document.getElementById("btn-run-daily");
  const btnAll = document.getElementById("btn-run-all");
  btn.disabled = true;
  btnAll.disabled = true;
  btn.textContent = "Agents working…";

  try {
    const res = await fetch(`/api/companies/${companyId}/run-daily`, { method: "POST" });
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
    alert("Please pay $1 (PayPal) or ¥1 to unlock all features.");
    location.href = checkoutUrl;
    return;
  }

  const input = document.getElementById("chat-input");
  const message = input.value.trim();
  if (!message || !companyId) return;

  const respEl = document.getElementById("chat-response");
  respEl.classList.add("visible");
  respEl.textContent = "Thinking…";
  input.value = "";

  try {
    const res = await fetch(`/api/companies/${companyId}/agents/${activeAgent}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    if (res.status === 402) throw new Error(handleSubscriptionError(data));
    if (!data.success) throw new Error(data.error);
    respEl.textContent = data.result.content;
    const logsRes = await fetch(`/api/companies/${companyId}/logs`);
    const logsData = await logsRes.json();
    if (logsData.success) renderLogs(logsData.logs);
  } catch (err) {
    respEl.textContent = `Error: ${err.message}`;
  }
});

renderAgentList();
loadConfig();
loadCompany();

setInterval(async () => {
  if (!companyId) return;
  const res = await fetch(`/api/companies/${companyId}`);
  const data = await res.json();
  if (data.success) updateSubscriptionUi(Boolean(data.subscriptionActive));
}, 10000);

setInterval(async () => {
  if (!companyId) return;
  const res = await fetch(`/api/companies/${companyId}/logs`);
  const data = await res.json();
  if (data.success) renderLogs(data.logs);
}, 15000);
