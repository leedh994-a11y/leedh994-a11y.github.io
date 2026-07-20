const api = (path, options = {}) => fetch(path, { credentials: "include", ...options });

let videoSessionId = null;
let oauthState = { platforms: [], connections: [] };
let mp4PollTimer = null;
const messages = [];

function getCompanyId() {
  return new URLSearchParams(location.search).get("company");
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => {
    const status = document.getElementById("video-chat-status");
    if (status) status.textContent = "已复制到剪贴板";
  });
}

function mp4StatusLabel(project) {
  const map = {
    pending: "MP4 排队中…",
    rendering: "MP4 渲染中…",
    ready: "MP4 已就绪",
    failed: "MP4 渲染失败",
  };
  return map[project.mp4Status] || "MP4 未生成";
}

function renderVideoScript(video) {
  if (!video) return "";
  const scenes = (video.scenes || [])
    .map(
      (s) =>
        `  ${s.time}: [画面] ${s.visual}\n     [旁白] ${s.voiceover}\n     [字幕] ${s.textOverlay || ""}`
    )
    .join("\n");
  return `时长: ${video.duration || "30s"} | 格式: ${video.format || "9:16"}
开场: ${video.hook || ""}
${scenes}
CTA: ${video.cta || ""}`;
}

function renderMessages() {
  const el = document.getElementById("video-chat-messages");
  if (!el) return;
  if (!messages.length) {
    el.innerHTML = `<div class="video-chat-welcome">
      <p>👋 我是<strong>视频推广智能体</strong>。直接输入指令，我会全自动生成真实 MP4 推广视频，并发布到各平台。</p>
      <p class="checkout-hint">例如：「帮我做一个30秒抖音推广视频，主题是新品上线，发布到抖音、快手、小红书、YouTube」</p>
    </div>`;
    return;
  }
  el.innerHTML = messages
    .map(
      (m) => `
    <div class="video-chat-msg video-chat-msg--${m.role}">
      <div class="video-chat-msg__bubble">${escapeHtml(m.content).replace(/\n/g, "<br>")}</div>
    </div>`
    )
    .join("");
  el.scrollTop = el.scrollHeight;
}

function renderOAuthPanel() {
  const el = document.getElementById("video-oauth-list");
  if (!el) return;
  const connected = new Map(oauthState.connections.map((c) => [c.platformId, c]));

  el.innerHTML = oauthState.platforms
    .map((p) => {
      const conn = connected.get(p.id);
      const status = conn
        ? `<span class="oauth-badge oauth-badge--on">已连接 ${escapeHtml(conn.accountName || "")}</span>`
        : p.configured
          ? `<span class="oauth-badge">未连接</span>`
          : `<span class="oauth-badge oauth-badge--off">待配置</span>`;
      const btn = conn
        ? `<button type="button" class="video-quick-cmd oauth-disconnect" data-platform="${p.id}">断开</button>`
        : p.configured
          ? `<button type="button" class="video-quick-cmd oauth-connect" data-platform="${p.id}">连接 ${escapeHtml(p.nameZh)}</button>`
          : `<span class="checkout-hint">需配置 API</span>`;
      return `<div class="oauth-row">${status}<span>${escapeHtml(p.nameZh)}</span>${btn}</div>`;
    })
    .join("");

  el.querySelectorAll(".oauth-connect").forEach((btn) => {
    btn.addEventListener("click", () => connectOAuth(btn.dataset.platform));
  });
  el.querySelectorAll(".oauth-disconnect").forEach((btn) => {
    btn.addEventListener("click", () => disconnectOAuth(btn.dataset.platform));
  });
}

async function loadOAuthStatus() {
  const companyId = getCompanyId();
  if (!companyId) return;
  const res = await api(`/api/companies/${companyId}/oauth/status`);
  const data = await res.json();
  if (!data.success) return;
  oauthState = { platforms: data.platforms || [], connections: data.connections || [] };
  renderOAuthPanel();
}

async function connectOAuth(platformId) {
  const companyId = getCompanyId();
  if (!companyId) return alert("请先登录");
  const res = await api(`/api/companies/${companyId}/oauth/${platformId}/connect`, { method: "POST" });
  const data = await res.json();
  if (!data.success) return alert(data.errorZh || data.error || "连接失败");
  window.location.href = data.authUrl;
}

async function disconnectOAuth(platformId) {
  const companyId = getCompanyId();
  if (!companyId) return;
  await api(`/api/companies/${companyId}/oauth/${platformId}`, { method: "DELETE" });
  await loadOAuthStatus();
}

function renderProject(project) {
  const panel = document.getElementById("video-project-panel");
  if (!panel || !project) return;

  const scriptText = renderVideoScript(project.video);
  const mp4Ready = project.mp4Status === "ready" && project.mp4Url;
  const mp4BadgeClass =
    project.mp4Status === "ready" ? "mkt-badge--done" : project.mp4Status === "failed" ? "oauth-badge--off" : "";

  const platformCards = (project.platforms || [])
    .map((p) => {
      const published = p.status === "published";
      const modeLabel = p.uploadMode === "oauth" ? "OAuth 自动上传" : "手动上传";
      const publishBtn = p.remoteUrl
        ? `<a href="${p.remoteUrl}" target="_blank" rel="noopener" class="btn-primary studio-publish-btn">查看已发布内容</a>`
        : p.publishUrl
          ? `<a href="${p.publishUrl}" target="_blank" rel="noopener" class="btn-primary studio-publish-btn">打开 ${escapeHtml(p.name)} 上传</a>`
          : "";
      return `
      <article class="mkt-card video-platform-card">
        <header class="mkt-card__head">
          <h4>${escapeHtml(p.name)}</h4>
          <span class="mkt-badge ${published ? "mkt-badge--done" : ""}">${published ? modeLabel : "待发布"}</span>
        </header>
        <pre>${escapeHtml(p.copy || "")}</pre>
        <button type="button" class="studio-copy-btn">复制文案</button>
        ${publishBtn}
        ${p.publishNote ? `<p class="checkout-hint">${escapeHtml(p.publishNote)}</p>` : ""}
      </article>`;
    })
    .join("");

  panel.hidden = false;
  panel.innerHTML = `
    <div class="video-project-header">
      <div>
        <h4>${escapeHtml(project.title)}</h4>
        <p class="checkout-hint">
          ${project.platforms?.length || 0} 个平台 ·
          <span class="mkt-badge ${mp4BadgeClass}">${mp4StatusLabel(project)}</span> ·
          ${new Date(project.createdAt).toLocaleString("zh-CN")}
        </p>
        ${project.mp4Error ? `<p class="checkout-hint oauth-badge--off">${escapeHtml(project.mp4Error)}</p>` : ""}
      </div>
      <div class="video-project-actions">
        ${project.previewUrl ? `<a href="${project.previewUrl}" target="_blank" rel="noopener" class="btn-primary">HTML 预览</a>` : ""}
        ${mp4Ready ? `<a href="${project.mp4Url}" download class="btn-primary">下载 MP4</a>` : ""}
        ${!mp4Ready ? `<button type="button" class="btn-primary" id="btn-video-render" data-id="${project.id}">生成 MP4</button>` : ""}
        <button type="button" class="btn-primary" id="btn-video-publish-all" data-id="${project.id}">一键发布到全部平台</button>
      </div>
    </div>
    ${mp4Ready ? `<video class="video-mp4-player" src="${project.mp4Url}" controls playsinline></video>` : ""}
    <div class="mkt-block mkt-video-script">
      <strong>视频脚本</strong>
      <pre>${escapeHtml(scriptText)}</pre>
      <button type="button" class="studio-copy-btn" id="btn-copy-video-script">复制视频脚本</button>
    </div>
    <div class="mkt-grid">${platformCards}</div>
  `;

  document.getElementById("btn-copy-video-script")?.addEventListener("click", () => copyText(scriptText));
  panel.querySelectorAll(".video-platform-card .studio-copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pre = btn.closest(".mkt-card")?.querySelector("pre");
      if (pre) copyText(pre.textContent);
    });
  });
  document.getElementById("btn-video-publish-all")?.addEventListener("click", () => publishProject(project.id));
  document.getElementById("btn-video-render")?.addEventListener("click", () => renderMp4(project.id));

  if (project.mp4Status === "pending" || project.mp4Status === "rendering") {
    scheduleMp4Poll(project.id);
  } else {
    clearMp4Poll();
  }
}

function scheduleMp4Poll(projectId) {
  clearMp4Poll();
  mp4PollTimer = setInterval(async () => {
    const companyId = getCompanyId();
    if (!companyId) return;
    const res = await api(`/api/companies/${companyId}/video/projects/${projectId}`);
    const data = await res.json();
    if (!data.success) return;
    renderProject(data.project);
    if (data.project.mp4Status === "ready" || data.project.mp4Status === "failed") {
      clearMp4Poll();
    }
  }, 3000);
}

function clearMp4Poll() {
  if (mp4PollTimer) {
    clearInterval(mp4PollTimer);
    mp4PollTimer = null;
  }
}

async function renderMp4(projectId) {
  const companyId = getCompanyId();
  const status = document.getElementById("video-chat-status");
  status.textContent = "正在渲染 MP4 视频…";
  const res = await api(`/api/companies/${companyId}/video/projects/${projectId}/render`, { method: "POST" });
  const data = await res.json();
  if (!data.success) {
    status.textContent = `MP4 渲染失败: ${data.error}`;
    return;
  }
  renderProject(data.project);
  status.textContent = data.project.mp4Status === "ready" ? "MP4 已生成，可下载或一键发布。" : "MP4 渲染中，请稍候…";
}

async function publishProject(projectId, platformIds = null) {
  const companyId = getCompanyId();
  if (!companyId) return;

  const status = document.getElementById("video-chat-status");
  status.textContent = "正在发布到各平台（OAuth 自动上传或手动指引）…";

  try {
    const res = await api(`/api/companies/${companyId}/video/projects/${projectId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platformIds }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    renderProject(data.project);
    const oauthCount = (data.published || []).filter((p) => p.uploadMode === "oauth").length;
    status.textContent = oauthCount
      ? `已完成：${oauthCount} 个平台 OAuth 自动上传，其余平台请按指引手动发布。`
      : `已处理 ${data.published?.length || 0} 个平台，请下载 MP4 并在各平台上传页发布。`;
  } catch (e) {
    status.textContent = `发布失败: ${e.message}`;
  }
}

async function sendMessage(text) {
  const companyId = getCompanyId();
  if (!companyId) return alert("请先登录并进入 Dashboard");

  const input = document.getElementById("video-chat-input");
  const btn = document.getElementById("btn-video-chat-send");
  const status = document.getElementById("video-chat-status");
  const autoPublish = document.getElementById("video-auto-publish")?.checked ?? true;

  const message = (text || input?.value || "").trim();
  if (!message) return;

  messages.push({ role: "user", content: message });
  renderMessages();
  if (input) input.value = "";
  btn.disabled = true;
  status.textContent = "AI 智能体正在生成推广视频与 MP4…";

  try {
    const res = await api(`/api/companies/${companyId}/video/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, sessionId: videoSessionId, autoPublish }),
    });
    const data = await res.json();
    if (res.status === 402) {
      alert(data.errorZh || "请先订阅专业版");
      location.href = data.checkoutUrl || "/checkout.html";
      return;
    }
    if (!data.success) throw new Error(data.error);

    videoSessionId = data.sessionId;
    messages.push({ role: "assistant", content: data.reply });
    renderMessages();

    if (data.project) {
      renderProject(data.project);
      status.textContent = data.published
        ? `视频已生成，正在/已完成发布到 ${data.publishTargets?.length || data.project.platforms?.length || 0} 个平台。`
        : "视频已生成，MP4 渲染中，完成后可一键发布。";
    } else {
      status.textContent = data.ai ? "AI 已回复" : "已处理";
    }
  } catch (e) {
    status.textContent = `失败: ${e.message}`;
    messages.push({ role: "assistant", content: `出错了：${e.message}` });
    renderMessages();
  } finally {
    btn.disabled = false;
  }
}

function handleOAuthCallback() {
  const params = new URLSearchParams(location.search);
  const oauth = params.get("oauth");
  if (!oauth) return;
  const status = document.getElementById("video-chat-status");
  if (oauth === "connected") {
    const platform = params.get("platform") || "";
    if (status) status.textContent = `${platform} 账号已连接，发布时将自动上传 MP4。`;
  } else if (oauth === "error") {
    if (status) status.textContent = `OAuth 连接失败: ${params.get("msg") || "unknown"}`;
  }
  params.delete("oauth");
  params.delete("platform");
  params.delete("msg");
  const qs = params.toString();
  history.replaceState({}, "", `${location.pathname}${qs ? `?${qs}` : ""}`);
}

function initVideoChat() {
  const form = document.getElementById("video-chat-form");

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    sendMessage();
  });

  document.querySelectorAll(".video-quick-cmd").forEach((btn) => {
    if (!btn.classList.contains("oauth-connect") && !btn.classList.contains("oauth-disconnect")) {
      btn.addEventListener("click", () => sendMessage(btn.dataset.cmd));
    }
  });

  renderMessages();
  handleOAuthCallback();
  loadOAuthStatus();

  const companyId = getCompanyId();
  if (companyId) {
    api(`/api/companies/${companyId}/video/projects`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.projects?.length) renderProject(data.projects[0]);
      })
      .catch(() => {});
  }
}

initVideoChat();
