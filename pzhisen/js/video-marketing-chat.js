const api = (path, options = {}) => fetch(path, { credentials: "include", ...options });

let videoSessionId = null;
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
      <p>👋 我是<strong>视频推广智能体</strong>。直接输入指令，我会全自动生成推广视频并发布到各平台。</p>
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

function renderProject(project) {
  const panel = document.getElementById("video-project-panel");
  if (!panel || !project) return;

  const scriptText = renderVideoScript(project.video);
  const platformCards = (project.platforms || [])
    .map((p) => {
      const published = p.status === "published";
      const publishBtn = p.publishUrl
        ? `<a href="${p.publishUrl}" target="_blank" rel="noopener" class="btn-primary studio-publish-btn">打开 ${escapeHtml(p.name)} 上传</a>`
        : "";
      return `
      <article class="mkt-card video-platform-card">
        <header class="mkt-card__head">
          <h4>${escapeHtml(p.name)}</h4>
          <span class="mkt-badge ${published ? "mkt-badge--done" : ""}">${published ? "已加入发布队列" : "待发布"}</span>
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
        <p class="checkout-hint">${project.platforms?.length || 0} 个平台 · ${project.ai !== false ? "AI 生成" : "模板生成"} · ${new Date(project.createdAt).toLocaleString("zh-CN")}</p>
      </div>
      <div class="video-project-actions">
        ${project.previewUrl ? `<a href="${project.previewUrl}" target="_blank" rel="noopener" class="btn-primary">预览视频</a>` : ""}
        <button type="button" class="btn-primary" id="btn-video-publish-all" data-id="${project.id}">一键发布到全部平台</button>
      </div>
    </div>
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
}

async function publishProject(projectId, platformIds = null) {
  const companyId = getCompanyId();
  if (!companyId) return;

  const status = document.getElementById("video-chat-status");
  status.textContent = "正在加入各平台发布队列…";

  try {
    const res = await api(`/api/companies/${companyId}/video/projects/${projectId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platformIds }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    renderProject(data.project);
    status.textContent = `已加入 ${data.published?.length || 0} 个平台的发布队列，请打开各平台上传页完成发布。`;
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
  status.textContent = "AI 智能体正在生成推广视频…";

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
        ? `视频已生成并加入 ${data.publishTargets?.length || data.project.platforms?.length || 0} 个平台发布队列。`
        : "视频已生成，可预览脚本或一键发布到全部平台。";
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

function initVideoChat() {
  const form = document.getElementById("video-chat-form");
  const input = document.getElementById("video-chat-input");

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    sendMessage();
  });

  document.querySelectorAll(".video-quick-cmd").forEach((btn) => {
    btn.addEventListener("click", () => sendMessage(btn.dataset.cmd));
  });

  renderMessages();

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
