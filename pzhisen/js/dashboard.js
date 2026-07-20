const params = new URLSearchParams(location.search);
let companyId = params.get("company");

const api = (path, options = {}) => fetch(path, { credentials: "include", ...options });

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
let checkoutUrl = "/checkout.html?plan=pro&cycle=monthly";
const chatImages = [];
const MAX_CHAT_IMAGES = 10;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function formatExpiry(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" });
}

function subscriptionLabel(sub) {
  if (!sub) return "专业版";
  if (sub.cycle === "lifetime" || sub.planId === "lifetime" || sub.lifetime) {
    return "✓ 终身版";
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
      document.getElementById("chat-title").textContent = `Ask ${agent.name}`;
    });
  });
}

function updateSubscriptionUi(active, subscription) {
  subscriptionActive = active;
  const banner = document.getElementById("paywall-banner");
  const layout = document.querySelector(".dashboard-layout");
  const pricingBtn = document.querySelector('a[href="/pricing.html"]');

  if (active) {
    banner.hidden = true;
    layout?.classList.remove("locked");
    if (pricingBtn) pricingBtn.textContent = subscriptionLabel(subscription);
  } else {
    banner.hidden = false;
    layout?.classList.add("locked");
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
  updateSubscriptionUi(Boolean(data.subscriptionActive), data.subscription);
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

function renderChatImagePreview() {
  const preview = document.getElementById("chat-image-preview");
  if (!chatImages.length) {
    preview.hidden = true;
    preview.innerHTML = "";
    return;
  }
  preview.hidden = false;
  preview.innerHTML = chatImages
    .map(
      (img, idx) => `
    <div class="chat-image-chip">
      <img src="${img.dataUrl}" alt="${escapeHtml(img.name)}">
      <button type="button" data-remove-image="${idx}" aria-label="移除图片">×</button>
    </div>`
    )
    .join("");

  preview.querySelectorAll("[data-remove-image]").forEach((btn) => {
    btn.addEventListener("click", () => {
      chatImages.splice(Number(btn.dataset.removeImage), 1);
      renderChatImagePreview();
    });
  });
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}

async function addChatImages(fileList) {
  const files = [...fileList];
  const errors = [];

  for (const file of files) {
    if (chatImages.length >= MAX_CHAT_IMAGES) {
      errors.push(`最多只能添加 ${MAX_CHAT_IMAGES} 张图片`);
      break;
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      errors.push(`${file.name}：仅支持 JPG、PNG、GIF、WebP`);
      continue;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      errors.push(`${file.name}：超过 5MB 限制`);
      continue;
    }
    try {
      const dataUrl = await readImageFile(file);
      chatImages.push({ name: file.name, dataUrl });
    } catch {
      errors.push(`${file.name}：读取失败`);
    }
  }

  renderChatImagePreview();
  if (errors.length) alert(errors.join("\n"));
}

function clearChatImages() {
  chatImages.length = 0;
  renderChatImagePreview();
  const fileInput = document.getElementById("chat-image-input");
  if (fileInput) fileInput.value = "";
}

document.getElementById("chat-image-input")?.addEventListener("change", async (e) => {
  if (e.target.files?.length) await addChatImages(e.target.files);
  e.target.value = "";
});

document.getElementById("chat-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!subscriptionActive) {
    alert("请先订阅专业版（月付或年付）后使用全部功能。");
    location.href = checkoutUrl;
    return;
  }

  const input = document.getElementById("chat-input");
  const message = input.value.trim();
  if ((!message && !chatImages.length) || !companyId) return;

  const respEl = document.getElementById("chat-response");
  respEl.classList.add("visible");
  respEl.textContent = chatImages.length ? "Analyzing image(s)…" : "Thinking…";
  const imagesToSend = chatImages.map((img) => img.dataUrl);
  input.value = "";
  clearChatImages();

  try {
    const res = await api(`/api/companies/${companyId}/agents/${activeAgent}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, images: imagesToSend }),
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
