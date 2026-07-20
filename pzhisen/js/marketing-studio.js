const api = (path, options = {}) => fetch(path, { credentials: "include", ...options });

let studioConfig = null;
let selectedContentType = "all";
let selectedPlatforms = new Set();

function getCompanyId() {
  return new URLSearchParams(location.search).get("company");
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}

async function loadConfig() {
  const res = await api("/api/marketing/config");
  const data = await res.json();
  if (!data.success) return;
  studioConfig = data;
  renderContentTypes();
  renderPlatforms();
  selectedPlatforms = new Set(data.platforms.map((p) => p.id));
}

function renderContentTypes() {
  const el = document.getElementById("mkt-content-types");
  el.innerHTML = studioConfig.contentTypes
    .map(
      (t) => `
    <button type="button" class="studio-chip${t.id === selectedContentType ? " active" : ""}" data-type="${t.id}">
      ${t.labelZh}
    </button>`
    )
    .join("");
  el.querySelectorAll(".studio-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedContentType = btn.dataset.type;
      renderContentTypes();
    });
  });
}

function renderPlatforms() {
  const el = document.getElementById("mkt-platforms");
  el.innerHTML = studioConfig.platforms
    .map((p) => {
      const checked = selectedPlatforms.has(p.id) ? "checked" : "";
      return `
      <label class="studio-platform">
        <input type="checkbox" value="${p.id}" ${checked}>
        <span>${p.nameZh}</span>
      </label>`;
    })
    .join("");
  el.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) selectedPlatforms.add(input.value);
      else selectedPlatforms.delete(input.value);
    });
  });
}

document.getElementById("mkt-select-all")?.addEventListener("click", () => {
  selectedPlatforms = new Set(studioConfig.platforms.map((p) => p.id));
  renderPlatforms();
});

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => alert("已复制到剪贴板"));
}

function renderVideoScript(script) {
  if (!script) return "";
  const scenes = (script.scenes || [])
    .map(
      (s) =>
        `  ${s.time}: [画面] ${s.visual}\n     [旁白] ${s.voiceover}\n     [字幕] ${s.textOverlay || ""}`
    )
    .join("\n");
  return `时长: ${script.duration} | 格式: ${script.format}
开场: ${script.hook}
${scenes}
CTA: ${script.cta}`;
}

function renderPlatformCard(id, item) {
  const tags = (item.hashtags || []).map((t) => `#${t}`).join(" ");
  const copyBlock = [item.title, item.copy, tags].filter(Boolean).join("\n\n");
  let extra = "";

  if (item.videoScript) {
    const scriptText = renderVideoScript(item.videoScript);
    extra += `<div class="mkt-block mkt-video-script"><strong>视频脚本</strong><pre>${escapeHtml(scriptText)}</pre>
      <button type="button" class="studio-copy-btn">复制视频脚本</button></div>`;
  }
  if (item.email) {
    const emailText = `主题: ${item.email.subject}\n\n${item.email.bodyText || ""}`;
    extra += `<div class="mkt-block mkt-email"><strong>邮件文案</strong><pre>${escapeHtml(emailText)}</pre>
      <p class="checkout-hint">适用于 Gmail、Outlook、QQ邮箱、163邮箱等全球主流邮箱</p>
      <button type="button" class="studio-copy-btn">复制邮件</button></div>`;
  }

  const steps = (item.publishSteps || []).map((s) => `<li>${escapeHtml(s)}</li>`).join("");
  const publishBtn = item.publishUrl
    ? `<a href="${item.publishUrl}" target="_blank" rel="noopener" class="btn-primary studio-publish-btn">打开 ${escapeHtml(item.platformName)} 发布</a>`
    : "";

  return `
  <article class="mkt-card">
    <header class="mkt-card__head">
      <h4>${escapeHtml(item.platformName || id)}</h4>
      <span class="mkt-badge">待发布 · 零成本</span>
    </header>
    <p class="checkout-hint">${escapeHtml(item.hintZh || "")}</p>
    <div class="mkt-block mkt-copy">
      <strong>推广文案</strong>
      <pre>${escapeHtml(copyBlock)}</pre>
      <button type="button" class="studio-copy-btn">复制文案</button>
    </div>
    ${extra}
    ${steps ? `<ol class="mkt-steps">${steps}</ol>` : ""}
    ${publishBtn}
  </article>`;
}

function renderCampaign(campaign) {
  const el = document.getElementById("mkt-results");
  el.hidden = false;
  const cards = Object.entries(campaign.platforms || {})
    .map(([id, item]) => renderPlatformCard(id, item))
    .join("");
  el.innerHTML = `
    <div class="mkt-summary">
      <strong>${escapeHtml(campaign.summary)}</strong>
      <span>${campaign.ai ? "AI 生成" : "模板生成"} · ${campaign.platformIds.length} 个平台 · ${new Date(campaign.createdAt).toLocaleString("zh-CN")}</span>
    </div>
    <div class="mkt-grid">${cards}</div>
  `;
  el.querySelectorAll(".studio-copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pre = btn.closest(".mkt-block")?.querySelector("pre");
      if (pre) copyText(pre.textContent);
    });
  });
}

document.getElementById("btn-mkt-generate")?.addEventListener("click", async () => {
  const companyId = getCompanyId();
  if (!companyId) return alert("请先登录并进入 Dashboard");

  const status = document.getElementById("mkt-status");
  const btn = document.getElementById("btn-mkt-generate");
  const topic = document.getElementById("mkt-topic").value.trim();
  const platforms = [...selectedPlatforms];

  if (!platforms.length) return alert("请至少选择一个发布平台");

  btn.disabled = true;
  status.textContent = "AI 正在全自动生成各平台推文、视频脚本与邮件文案…";

  try {
    const res = await api(`/api/companies/${companyId}/marketing/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        platforms,
        contentType: selectedContentType,
        language: "zh",
      }),
    });
    const data = await res.json();
    if (res.status === 402) {
      alert(data.errorZh || "请先订阅专业版");
      location.href = data.checkoutUrl || "/checkout.html";
      return;
    }
    if (!data.success) throw new Error(data.error);
    renderCampaign(data.campaign);
    status.textContent = `已生成 ${data.campaign.platformIds.length} 个平台的推广内容，请复制文案或按视频脚本制作后发布。`;
  } catch (e) {
    status.textContent = `生成失败: ${e.message}`;
  } finally {
    btn.disabled = false;
  }
});

loadConfig();
