const API = "/api/saas";
let token = localStorage.getItem("saas_token") || "";
let me = null;
let bots = [];

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

async function api(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API + path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove("hidden");
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s || "";
  return d.innerHTML;
}

// ── Auth ──────────────────────────────────────────────────────────

$("#tab-login").onclick = () => {
  $("#tab-login").classList.add("active");
  $("#tab-register").classList.remove("active");
  $("#login-form").classList.remove("hidden");
  $("#register-form").classList.add("hidden");
};
$("#tab-register").onclick = () => {
  $("#tab-register").classList.add("active");
  $("#tab-login").classList.remove("active");
  $("#register-form").classList.remove("hidden");
  $("#login-form").classList.add("hidden");
};

$("#login-form").onsubmit = async (e) => {
  e.preventDefault();
  $("#auth-error").classList.add("hidden");
  try {
    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: $("#login-email").value,
        password: $("#login-password").value,
      }),
    });
    token = data.token;
    localStorage.setItem("saas_token", token);
    await bootApp();
  } catch (err) {
    showError($("#auth-error"), err.message);
  }
};

$("#register-form").onsubmit = async (e) => {
  e.preventDefault();
  $("#auth-error").classList.add("hidden");
  try {
    const data = await api("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: $("#reg-email").value,
        password: $("#reg-password").value,
        name: $("#reg-name").value,
      }),
    });
    token = data.token;
    localStorage.setItem("saas_token", token);
    await bootApp();
  } catch (err) {
    showError($("#auth-error"), err.message);
  }
};

$("#btn-logout").onclick = async () => {
  try { await api("/auth/logout", { method: "POST", body: "{}" }); } catch {}
  token = "";
  localStorage.removeItem("saas_token");
  $("#app").classList.add("hidden");
  $("#auth-screen").classList.remove("hidden");
};

// ── Navigation ────────────────────────────────────────────────────

const titles = {
  overview: "Overview",
  bots: "Chatbots",
  conversations: "Conversations",
  analytics: "Analytics",
  team: "Team",
  integrations: "Integrations",
  webhooks: "Webhooks",
  settings: "Settings",
};

$$(".nav-item").forEach((btn) => {
  btn.onclick = () => {
    $$(".nav-item").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const view = btn.dataset.view;
    $("#view-title").textContent = titles[view] || view;
    $$(".view").forEach((v) => v.classList.add("hidden"));
    $(`#view-${view}`).classList.remove("hidden");
    loadView(view);
  };
});

async function loadView(view) {
  if (view === "overview") renderOverview();
  else if (view === "bots") await loadBots();
  else if (view === "conversations") await loadConversations();
  else if (view === "analytics") await loadAnalytics();
  else if (view === "team") await loadTeam();
  else if (view === "integrations") await loadIntegrations();
  else if (view === "webhooks") await loadWebhooks();
  else if (view === "settings") renderSettings();
}

// ── Boot ──────────────────────────────────────────────────────────

async function bootApp() {
  me = await api("/auth/me");
  $("#auth-screen").classList.add("hidden");
  $("#app").classList.remove("hidden");
  $("#user-email").textContent = me.account.email;
  $("#plan-badge").textContent = `${me.plan?.name || "—"} plan`;
  await refreshBotsQuiet();
  renderOverview();
  showOnboardingIfNeeded();
}

async function init() {
  if (!token) return;
  try {
    await bootApp();
  } catch {
    token = "";
    localStorage.removeItem("saas_token");
  }
}

// ── Overview ──────────────────────────────────────────────────────

function renderOverview() {
  const u = me?.usage;
  if (!u) return;
  $("#stats-grid").innerHTML = `
    <div class="stat-card"><div class="label">Messages this month</div><div class="value">${u.messages.used}</div><div class="sub">of ${u.messages.limit.toLocaleString()}</div></div>
    <div class="stat-card"><div class="label">Pages trained</div><div class="value">${u.pages.used}</div><div class="sub">of ${u.pages.limit.toLocaleString()}</div></div>
    <div class="stat-card"><div class="label">Chatbots</div><div class="value">${u.chatbots.used}</div><div class="sub">of ${u.chatbots.limit}</div></div>
    <div class="stat-card"><div class="label">Team members</div><div class="value">${u.members.used}</div><div class="sub">of ${u.members.limit}</div></div>
  `;
  renderSetupSteps();
}

async function refreshBotsQuiet() {
  try {
    const data = await api("/bots");
    bots = data.bots || [];
  } catch { bots = []; }
}

function renderSetupSteps() {
  const hasBot = bots.length > 0;
  const trained = bots.some((b) => (b.knowledge?.pageCount || 0) > 0);
  const embedded = bots.some((b) => b.knowledge?.vectorSearch);
  const steps = [
    { title: "Create Bot", desc: "Set name & website URL", done: hasBot, active: !hasBot },
    { title: "Train Website", desc: "Crawl & index content", done: trained, active: hasBot && !trained },
    { title: "Vector Embeddings", desc: "AI semantic search enabled", done: embedded, active: trained && !embedded },
    { title: "Deploy Widget", desc: "Embed on your site", done: false, active: trained },
  ];
  $("#setup-steps").innerHTML = steps.map((s, i) => `
    <div class="setup-step ${s.done ? "done" : s.active ? "active" : ""}">
      <div class="step-num">Step ${i + 1}</div>
      <h4>${s.done ? "✓ " : ""}${s.title}</h4>
      <p>${s.desc}</p>
    </div>`).join("");

  const banner = $("#onboarding-banner");
  if (!hasBot) {
    banner.classList.remove("hidden");
    banner.innerHTML = `<p>👋 Welcome! Create your first AI chatbot to get started.</p><button class="btn-primary btn-sm" id="banner-create-bot">Create Chatbot</button>`;
    $("#banner-create-bot").onclick = () => {
      $$(".nav-item").forEach((b) => b.classList.remove("active"));
      $(`.nav-item[data-view="bots"]`).classList.add("active");
      $$(".view").forEach((v) => v.classList.add("hidden"));
      $("#view-bots").classList.remove("hidden");
      $("#view-title").textContent = "Chatbots";
      loadBots();
      $("#btn-new-bot").click();
    };
  } else if (!trained) {
    banner.classList.remove("hidden");
    banner.innerHTML = `<p>📚 Train your bot on your website to enable AI answers.</p><button class="btn-primary btn-sm" id="banner-train">Go to Chatbots</button>`;
    $("#banner-train").onclick = () => {
      $$(".nav-item").forEach((b) => b.classList.remove("active"));
      $(`.nav-item[data-view="bots"]`).classList.add("active");
      $$(".view").forEach((v) => v.classList.add("hidden"));
      $("#view-bots").classList.remove("hidden");
      $("#view-title").textContent = "Chatbots";
      loadBots();
    };
  } else {
    banner.classList.add("hidden");
  }
}

// ── Onboarding wizard ─────────────────────────────────────────────

const WIZARD_STEPS = [
  { title: "Welcome to Sitp GPT SaaS", body: "Build AI customer support chatbots trained on your website. Let's walk through the basics." },
  { title: "Create your first Bot", body: "Give it a name and enter your website URL. Each bot gets a unique embed code." },
  { title: "Train with Vector Embeddings", body: "We crawl your site and generate semantic embeddings for accurate, context-aware answers." },
  { title: "Deploy & Preview", body: "Test in Live Preview, then paste the embed code on your site. Monitor conversations in Analytics." },
];

function showOnboardingIfNeeded() {
  if (localStorage.getItem("saas_onboarding_done")) return;
  let step = 0;
  const overlay = $("#onboarding-overlay");
  const content = $("#wizard-content");
  const bar = $("#wizard-bar");

  function render() {
    bar.style.width = `${((step + 1) / WIZARD_STEPS.length) * 100}%`;
    const s = WIZARD_STEPS[step];
    content.innerHTML = `
      <div class="wizard-step">
        <h2>${s.title}</h2>
        <p>${s.body}</p>
        <div class="wizard-actions">
          ${step > 0 ? '<button class="btn-ghost" id="wiz-back">Back</button>' : '<button class="btn-ghost" id="wiz-skip">Skip</button>'}
          <button class="btn-primary" id="wiz-next">${step < WIZARD_STEPS.length - 1 ? "Next" : "Get Started"}</button>
        </div>
      </div>`;
    $("#wiz-skip").onclick = finish;
    $("#wiz-back")?.addEventListener("click", () => { step--; render(); });
    $("#wiz-next").onclick = () => {
      if (step < WIZARD_STEPS.length - 1) { step++; render(); }
      else finish();
    };
  }

  function finish() {
    localStorage.setItem("saas_onboarding_done", "1");
    overlay.classList.add("hidden");
    if (!bots.length) $("#btn-new-bot")?.click();
  }

  overlay.classList.remove("hidden");
  render();
}

// ── Bots ──────────────────────────────────────────────────────────

async function loadBots() {
  const data = await api("/bots");
  bots = data.bots || [];
  $("#bot-detail").classList.add("hidden");
  $("#bots-list").innerHTML = bots.length
    ? bots.map((b) => `
      <div class="bot-card" data-bot="${esc(b.botId)}">
        <h4>${esc(b.name)} ${b.knowledge?.vectorSearch ? '<span class="vector-badge">Vector</span>' : ""}</h4>
        <div class="meta">${esc(b.websiteUrl || "No URL")} · ${b.knowledge?.pageCount || 0} pages · ${b.knowledge?.embeddedChunks || 0} vectors</div>
        <span class="bot-status ${esc(b.trainingStatus)}">${esc(b.trainingStatus)}</span>
      </div>`).join("")
    : `<div class="card"><p>No chatbots yet. <button class="btn-primary btn-sm" id="empty-create-bot">Create your first bot</button></p></div>`;

  $("#empty-create-bot")?.addEventListener("click", () => $("#btn-new-bot").click());

  $$(".bot-card").forEach((card) => {
    card.onclick = () => showBotDetail(card.dataset.bot);
  });
  renderSetupSteps();
}

function showBotDetail(botId) {
  const bot = bots.find((b) => b.botId === botId);
  if (!bot) return;
  const color = bot.primaryColor || "#111111";
  const vecBadge = bot.knowledge?.vectorSearch
    ? '<span class="vector-badge">Vector AI</span>'
    : '<span class="vector-badge" style="opacity:0.6">Keyword only</span>';

  $("#bot-detail").classList.remove("hidden");
  $("#bot-detail").innerHTML = `
    <div class="bot-detail-layout">
      <div class="bot-settings">
        <div class="card">
          <h3>${esc(bot.name)} ${vecBadge} <small style="color:var(--muted)">(${esc(bot.botId)})</small></h3>
          <div class="form-row">
            <label class="field">Bot Name<input id="edit-name" value="${esc(bot.name)}" /></label>
            <label class="field">Website URL<input id="edit-url" value="${esc(bot.websiteUrl)}" placeholder="https://yoursite.com" /></label>
          </div>
          <div class="form-row">
            <label class="field">Welcome Message<textarea id="edit-welcome">${esc(bot.welcomeMessage)}</textarea></label>
            <div>
              <label class="field">Primary Color<input type="color" class="color-input" id="edit-color" value="${esc(color)}" /></label>
              <label class="field">Position
                <select id="edit-position"><option value="right" ${bot.position !== "left" ? "selected" : ""}>Right</option><option value="left" ${bot.position === "left" ? "selected" : ""}>Left</option></select>
              </label>
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
            <button class="btn-primary btn-sm" id="btn-save-bot">Save Settings</button>
            <button class="btn-primary btn-sm" id="btn-train">Train on Website</button>
            <button class="btn-ghost btn-sm" id="btn-reindex">Re-index Vectors</button>
            <button class="btn-ghost btn-sm" id="btn-delete-bot">Delete</button>
          </div>
          <h4>Embed Code</h4>
          <div class="embed-box" id="embed-code">${esc(bot.embedCode)}</div>
          <button class="btn-ghost btn-sm" id="btn-copy-embed">Copy Embed Code</button>
          <p style="margin-top:12px;font-size:0.8rem;color:var(--muted)">
            ${bot.knowledge?.pageCount || 0} pages · ${bot.knowledge?.chunkCount || 0} chunks ·
            ${bot.knowledge?.embeddedChunks || 0} embedded ·
            Last trained: ${bot.lastTrainedAt ? new Date(bot.lastTrainedAt).toLocaleString() : "Never"}
          </p>
        </div>
      </div>
      <div class="bot-preview-panel">
        <div class="card" style="padding:12px">
          <h3 style="margin-bottom:12px;font-size:0.95rem">Live Preview</h3>
          <div class="preview-widget" id="preview-widget">
            <div class="preview-header" id="preview-header" style="background:${esc(color)}">
              <span id="preview-title">${esc(bot.name)}</span>
              <span style="opacity:0.7;font-size:0.8rem">Preview</span>
            </div>
            <div class="preview-messages" id="preview-messages">
              <div class="preview-msg bot">${esc(bot.welcomeMessage)}</div>
            </div>
            <div class="preview-input-row">
              <input id="preview-input" placeholder="Test your bot…" />
              <button id="preview-send" style="background:${esc(color)}">➤</button>
            </div>
          </div>
          <p class="preview-meta">Preview uses vector embeddings · does not count toward message quota</p>
        </div>
      </div>
    </div>`;

  const previewHistory = [];

  function updatePreviewStyle() {
    const c = $("#edit-color").value;
    $("#preview-header").style.background = c;
    $("#preview-send").style.background = c;
    $("#preview-title").textContent = $("#edit-name").value || bot.name;
  }

  $("#edit-color").oninput = updatePreviewStyle;
  $("#edit-name").oninput = updatePreviewStyle;

  async function sendPreview() {
    const text = ($("#preview-input").value || "").trim();
    if (!text) return;
    $("#preview-input").value = "";
    const msgs = $("#preview-messages");
    const userEl = document.createElement("div");
    userEl.className = "preview-msg user";
    userEl.style.background = $("#edit-color").value;
    userEl.textContent = text;
    msgs.appendChild(userEl);
    const typing = document.createElement("div");
    typing.className = "preview-msg bot";
    typing.textContent = "…";
    msgs.appendChild(typing);
    msgs.scrollTop = msgs.scrollHeight;
    try {
      const data = await api(`/bots/${botId}/preview-chat`, {
        method: "POST",
        body: JSON.stringify({ message: text, history: previewHistory }),
      });
      typing.remove();
      const botEl = document.createElement("div");
      botEl.className = "preview-msg bot";
      botEl.textContent = data.reply;
      if (data.sources?.length) {
        const src = document.createElement("div");
        src.className = "preview-sources";
        src.textContent = `Sources: ${data.sources.map((s) => s.title || s.url).join(", ")} · ${data.confidence} confidence`;
        botEl.appendChild(src);
      }
      msgs.appendChild(botEl);
      previewHistory.push({ role: "user", content: text });
      previewHistory.push({ role: "assistant", content: data.reply });
    } catch (e) {
      typing.textContent = "Error: " + e.message;
    }
    msgs.scrollTop = msgs.scrollHeight;
  }

  $("#preview-send").onclick = sendPreview;
  $("#preview-input").onkeydown = (e) => { if (e.key === "Enter") sendPreview(); };

  $("#btn-save-bot").onclick = async () => {
    await api(`/bots/${botId}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: $("#edit-name").value,
        websiteUrl: $("#edit-url").value,
        welcomeMessage: $("#edit-welcome").value,
        primaryColor: $("#edit-color").value,
        position: $("#edit-position").value,
      }),
    });
    await loadBots();
    showBotDetail(botId);
  };

  $("#btn-train").onclick = async () => {
    const url = $("#edit-url").value;
    if (!url) return alert("Enter a website URL first");
    $("#btn-train").textContent = "Training…";
    $("#btn-train").disabled = true;
    try {
      const result = await api(`/bots/${botId}/train`, {
        method: "POST",
        body: JSON.stringify({ url }),
      });
      alert(`Training complete!\n${result.pagesIndexed} pages · ${result.chunkCount} chunks · ${result.embeddedChunks || 0} vectors`);
      await loadBots();
      me = await api("/auth/me");
      showBotDetail(botId);
    } catch (e) {
      alert(e.message);
    } finally {
      $("#btn-train").textContent = "Train on Website";
      $("#btn-train").disabled = false;
    }
  };

  $("#btn-reindex").onclick = async () => {
    $("#btn-reindex").textContent = "Indexing…";
    $("#btn-reindex").disabled = true;
    try {
      const result = await api(`/bots/${botId}/reindex`, { method: "POST", body: "{}" });
      alert(`Re-indexed ${result.embeddedChunks} vector embeddings.`);
      await loadBots();
      showBotDetail(botId);
    } catch (e) {
      alert(e.message);
    } finally {
      $("#btn-reindex").textContent = "Re-index Vectors";
      $("#btn-reindex").disabled = false;
    }
  };

  $("#btn-delete-bot").onclick = async () => {
    if (!confirm("Delete this bot and all its training data?")) return;
    await api(`/bots/${botId}`, { method: "DELETE" });
    $("#bot-detail").classList.add("hidden");
    await loadBots();
    me = await api("/auth/me");
    renderOverview();
  };

  $("#btn-copy-embed").onclick = () => {
    navigator.clipboard.writeText(bot.embedCode);
    $("#btn-copy-embed").textContent = "Copied!";
    setTimeout(() => { $("#btn-copy-embed").textContent = "Copy Embed Code"; }, 2000);
  };
}

$("#btn-new-bot").onclick = () => {
  showModal(`
    <h3>Create Chatbot</h3>
    <label class="field">Bot Name<input id="new-name" placeholder="My Support Bot" /></label>
    <label class="field">Website URL<input id="new-url" placeholder="https://yoursite.com" /></label>
    <label class="field">Welcome Message<textarea id="new-welcome">Hi! How can I help you today?</textarea></label>
    <div class="modal-actions">
      <button class="btn-ghost" id="modal-cancel">Cancel</button>
      <button class="btn-primary" id="modal-create">Create</button>
    </div>`,
    async () => {
      await api("/bots", {
        method: "POST",
        body: JSON.stringify({
          name: $("#new-name").value,
          websiteUrl: $("#new-url").value,
          welcomeMessage: $("#new-welcome").value,
        }),
      });
      hideModal();
      await loadBots();
      me = await api("/auth/me");
    }
  );
};

// ── Conversations ─────────────────────────────────────────────────

async function loadConversations() {
  const data = await api("/conversations");
  const convs = data.conversations || [];
  $("#conversation-detail").classList.add("hidden");
  $("#conversations-list").innerHTML = convs.length
    ? `<table><thead><tr><th>Bot</th><th>Host</th><th>Messages</th><th>Last</th><th>Gaps</th></tr></thead><tbody>
      ${convs.map((c) => `<tr class="conv-row" data-id="${esc(c.id)}" style="cursor:pointer">
        <td>${esc(c.botId)}</td><td>${esc(c.host)}</td><td>${c.messageCount}</td>
        <td>${esc(c.lastMessage?.slice(0, 60) || "")}</td><td>${c.knowledgeGaps?.length || 0}</td>
      </tr>`).join("")}
    </tbody></table>`
    : `<div class="card"><p>No conversations yet. Deploy your widget to start receiving messages.</p></div>`;

  $$(".conv-row").forEach((row) => {
    row.onclick = async () => {
      const d = await api(`/conversations/${row.dataset.id}`);
      const conv = d.conversation;
      $("#conversation-detail").classList.remove("hidden");
      $("#conversation-detail").innerHTML = `
        <h3>Conversation · ${esc(conv.host)}</h3>
        <div class="msg-list">${conv.messages.map((m) =>
          `<div class="msg ${m.role}">${esc(m.content)}</div>`).join("")}</div>
        ${conv.knowledgeGaps?.length ? `<div class="gap-list"><h4>Knowledge Gaps</h4>${conv.knowledgeGaps.map((g) => `<div class="gap-item">${esc(g)}</div>`).join("")}</div>` : ""}`;
    };
  });
}

// ── Analytics ─────────────────────────────────────────────────────

async function loadAnalytics() {
  const data = await api("/analytics?days=30");
  const a = data.analytics;
  $("#analytics-content").innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="label">Conversations (30d)</div><div class="value">${a.conversations}</div></div>
      <div class="stat-card"><div class="label">Total Messages</div><div class="value">${a.totalMessages}</div></div>
      <div class="stat-card"><div class="label">User Messages</div><div class="value">${a.userMessages}</div></div>
      <div class="stat-card"><div class="label">Knowledge Gaps</div><div class="value">${a.knowledgeGapCount}</div></div>
    </div>
    <div class="card">
      <h3>Top Visitor Hosts</h3>
      ${a.topHosts?.length ? `<table><thead><tr><th>Host</th><th>Conversations</th></tr></thead><tbody>
        ${a.topHosts.map((h) => `<tr><td>${esc(h.host)}</td><td>${h.count}</td></tr>`).join("")}
      </tbody></table>` : "<p>No data yet.</p>"}
    </div>
    <div class="card">
      <h3>Knowledge Gaps (unanswered questions)</h3>
      <div class="gap-list">
        ${a.knowledgeGaps?.length ? a.knowledgeGaps.map((g) =>
          `<div class="gap-item"><strong>${esc(g.botId)}</strong>: ${esc(g.question)}</div>`).join("")
          : "<p>No knowledge gaps detected yet.</p>"}
      </div>
    </div>`;
}

// ── Team ──────────────────────────────────────────────────────────

async function loadTeam() {
  const data = await api("/team");
  const members = data.members || [];
  $("#team-list").innerHTML = `<table><thead><tr><th>Email</th><th>Role</th><th>Joined</th><th></th></tr></thead><tbody>
    ${members.map((m) => `<tr><td>${esc(m.email)}</td><td>${esc(m.role)}</td><td>${new Date(m.createdAt).toLocaleDateString()}</td>
      <td>${m.role !== "owner" ? `<button class="btn-ghost btn-sm rm-member" data-id="${esc(m.id)}">Remove</button>` : ""}</td></tr>`).join("")}
  </tbody></table>`;

  $$(".rm-member").forEach((btn) => {
    btn.onclick = async () => {
      await api(`/team/${btn.dataset.id}`, { method: "DELETE" });
      await loadTeam();
    };
  });
}

$("#btn-add-member").onclick = () => {
  showModal(`
    <h3>Invite Team Member</h3>
    <label class="field">Email<input id="member-email" type="email" /></label>
    <label class="field">Role<select id="member-role"><option value="member">Member</option><option value="admin">Admin</option></select></label>
    <div class="modal-actions"><button class="btn-ghost" id="modal-cancel">Cancel</button><button class="btn-primary" id="modal-create">Invite</button></div>`,
    async () => {
      await api("/team", { method: "POST", body: JSON.stringify({ email: $("#member-email").value, role: $("#member-role").value }) });
      hideModal();
      await loadTeam();
    }
  );
};

// ── Integrations ──────────────────────────────────────────────────

async function loadIntegrations() {
  const data = await api("/integrations");
  const items = data.integrations || [];
  const types = [
    { id: "slack", name: "Slack", desc: "Get notified in Slack when visitors chat" },
    { id: "crisp", name: "Crisp", desc: "Sync with Crisp live chat" },
    { id: "whatsapp", name: "WhatsApp", desc: "Connect via WhatsApp Business API" },
  ];

  $("#integrations-grid").innerHTML = types.map((t) => {
    const existing = items.find((i) => i.type === t.id);
    return `<div class="integration-card">
      <h4>${t.name}</h4><p>${t.desc}</p>
      <p style="font-size:0.8rem;color:var(--muted)">${existing ? "✓ Configured" : "Not configured"}</p>
      <button class="btn-primary btn-sm setup-int" data-type="${t.id}">Configure</button>
    </div>`;
  }).join("");

  $$(".setup-int").forEach((btn) => {
    btn.onclick = () => {
      const type = btn.dataset.type;
      const fields = type === "slack"
        ? `<label class="field">Slack Webhook URL<input id="int-webhook" placeholder="https://hooks.slack.com/..." /></label>`
        : type === "crisp"
          ? `<label class="field">Crisp Website ID<input id="int-website" /></label><label class="field">Crisp Token<input id="int-token" /></label>`
          : `<label class="field">Phone Number ID<input id="int-phone" /></label><label class="field">Access Token<input id="int-token" /></label>`;

      showModal(`<h3>Configure ${type}</h3>${fields}
        <div class="modal-actions"><button class="btn-ghost" id="modal-cancel">Cancel</button><button class="btn-primary" id="modal-create">Save</button></div>`,
        async () => {
          const config = type === "slack"
            ? { webhookUrl: $("#int-webhook").value }
            : type === "crisp"
              ? { websiteId: $("#int-website").value, token: $("#int-token").value }
              : { phoneNumberId: $("#int-phone").value, token: $("#int-token").value };
          await api("/integrations", { method: "POST", body: JSON.stringify({ type, config }) });
          hideModal();
          await loadIntegrations();
        }
      );
    };
  });
}

// ── Webhooks ──────────────────────────────────────────────────────

async function loadWebhooks() {
  const data = await api("/webhooks");
  const hooks = data.webhooks || [];
  $("#webhooks-list").innerHTML = hooks.length
    ? `<table><thead><tr><th>URL</th><th>Events</th><th>Last Triggered</th><th></th></tr></thead><tbody>
      ${hooks.map((w) => `<tr><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${esc(w.url)}</td>
        <td>${w.events.join(", ")}</td><td>${w.lastTriggeredAt ? new Date(w.lastTriggeredAt).toLocaleString() : "Never"}</td>
        <td><button class="btn-ghost btn-sm test-wh" data-id="${esc(w.id)}">Test</button>
        <button class="btn-ghost btn-sm del-wh" data-id="${esc(w.id)}">Delete</button></td></tr>`).join("")}
    </tbody></table>`
    : `<div class="card"><p>No webhooks configured.</p></div>`;

  $$(".test-wh").forEach((btn) => {
    btn.onclick = async () => {
      await api(`/webhooks/${btn.dataset.id}/test`, { method: "POST", body: "{}" });
      alert("Test webhook sent!");
    };
  });
  $$(".del-wh").forEach((btn) => {
    btn.onclick = async () => {
      await api(`/webhooks/${btn.dataset.id}`, { method: "DELETE" });
      await loadWebhooks();
    };
  });
}

$("#btn-add-webhook").onclick = () => {
  showModal(`
    <h3>Add Webhook</h3>
    <label class="field">Endpoint URL<input id="wh-url" placeholder="https://your-server.com/webhook" /></label>
    <label class="field">Events (comma-separated)<input id="wh-events" value="message.created,knowledge.gap" /></label>
    <div class="modal-actions"><button class="btn-ghost" id="modal-cancel">Cancel</button><button class="btn-primary" id="modal-create">Add</button></div>`,
    async () => {
      await api("/webhooks", {
        method: "POST",
        body: JSON.stringify({
          url: $("#wh-url").value,
          events: $("#wh-events").value.split(",").map((s) => s.trim()),
        }),
      });
      hideModal();
      await loadWebhooks();
    }
  );
};

// ── Settings ──────────────────────────────────────────────────────

function renderSettings() {
  $("#api-key-display").textContent = me?.account?.apiKey || "—";
}

$("#btn-regen-key").onclick = async () => {
  if (!confirm("Regenerate API key? Old key will stop working.")) return;
  const data = await api("/auth/api-key/regenerate", { method: "POST", body: "{}" });
  me.account = data.account;
  renderSettings();
};

$("#password-form").onsubmit = async (e) => {
  e.preventDefault();
  await api("/auth/password", { method: "POST", body: JSON.stringify({ password: $("#new-password").value }) });
  alert("Password updated!");
  $("#new-password").value = "";
};

// ── Modal ─────────────────────────────────────────────────────────

let modalCallback = null;

function showModal(html, onCreate) {
  $("#modal-content").innerHTML = html;
  $("#modal-overlay").classList.remove("hidden");
  modalCallback = onCreate;
  $("#modal-cancel").onclick = hideModal;
  $("#modal-create").onclick = async () => {
    try { await modalCallback(); } catch (e) { alert(e.message); }
  };
}

function hideModal() {
  $("#modal-overlay").classList.add("hidden");
  modalCallback = null;
}

$("#modal-overlay").onclick = (e) => {
  if (e.target === $("#modal-overlay")) hideModal();
};

init();
