import { getLocale, t, localePath } from "./locale.js";

const isZh = getLocale() === "zh";
const registry = isZh
  ? await import("./tool-registry.js")
  : await import("./tool-registry-en.js");
const { getToolById, TOOLS } = registry;

const parts = location.pathname.split("/").filter(Boolean);
const slug = parts[parts.length - 1]?.replace(".html", "");
const tool = getToolById(slug);
const home = localePath("/");

if (!tool) {
  document.body.innerHTML = `<div class="container" style="padding:64px 24px;text-align:center"><h1>${t("toolNotFound")}</h1><p><a href="${home}">${t("backHome")}</a></p></div>`;
} else {
  init(tool);
}

function init(tool) {
  document.title = `${tool.name} - Sitp GPT`;
  document.getElementById("tool-title").textContent = tool.name;
  document.getElementById("tool-desc").textContent = tool.desc;
  document.getElementById("submit-btn").textContent = getActionLabel(tool);
  document.getElementById("reset-btn").textContent = t("reset");
  document.getElementById("copy-btn").textContent = t("copyResult");

  const form = document.getElementById("tool-form");
  const fieldsEl = document.getElementById("form-fields");

  for (const field of tool.fields) {
    fieldsEl.appendChild(renderField(field));
  }

  renderOtherTools(tool.id);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await runTool(tool);
  });

  document.getElementById("reset-btn").addEventListener("click", () => {
    form.reset();
    hideResults();
    hideError();
  });

  document.getElementById("copy-btn")?.addEventListener("click", copyResult);
}

function getActionLabel(tool) {
  if (tool.category === "converter") return t("convert");
  if (tool.category === "ai-chat") return t("send");
  if (tool.id.includes("generator") || tool.id.includes("calculator")) return t("generate");
  if (tool.id.includes("checker") || tool.id.includes("validator") || tool.id.includes("analyzer")) return t("analyze");
  return t("run");
}

function renderField(field) {
  const div = document.createElement("div");
  div.className = "form-group";
  const label = document.createElement("label");
  label.htmlFor = field.id;
  label.textContent = field.label;
  div.appendChild(label);

  let input;
  if (field.type === "textarea") {
    input = document.createElement("textarea");
    input.rows = field.rows || 5;
  } else if (field.type === "select") {
    input = document.createElement("select");
    for (const opt of field.options) {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      if (opt === field.default) o.selected = true;
      input.appendChild(o);
    }
  } else if (field.type === "file") {
    input = document.createElement("input");
    input.type = "file";
    if (field.accept) input.accept = field.accept;
  } else {
    input = document.createElement("input");
    input.type = field.type || "text";
    if (field.placeholder) input.placeholder = field.placeholder;
    if (field.default != null) input.value = field.default;
  }
  input.id = field.id;
  input.name = field.id;
  if (field.required) input.required = true;
  div.appendChild(input);
  return div;
}

function collectData(tool) {
  const data = {};
  const files = {};
  for (const field of tool.fields) {
    const el = document.getElementById(field.id);
    if (field.type === "file") {
      if (el.files[0]) files[field.id] = el.files[0];
    } else if (field.type === "number") {
      data[field.id] = el.value ? Number(el.value) : field.default;
    } else {
      data[field.id] = el.value;
    }
  }
  let payload = tool.preprocess ? tool.preprocess(data) : data;
  return { payload, files };
}

async function runTool(tool) {
  const btn = document.getElementById("submit-btn");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> ${isZh ? "处理中..." : "Processing..."}`;
  hideError();
  hideResults();

  try {
    const { payload, files } = collectData(tool);
    let res;

    if (tool.multipart) {
      const fd = new FormData();
      for (const [k, v] of Object.entries(payload)) {
        if (v != null && v !== "") fd.append(k, v);
      }
      for (const [k, v] of Object.entries(files)) fd.append(k, v);
      res = await fetch(tool.api, { method: "POST", body: fd });
    } else {
      res = await fetch(tool.api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    const data = await res.json();
    if (!data.success) {
      showError(data.error || (isZh ? "操作失败" : "Request failed"));
      return;
    }
    renderResult(tool, data);
  } catch (err) {
    showError((isZh ? "网络错误: " : "Network error: ") + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = getActionLabel(tool);
  }
}

function renderResult(tool, data) {
  const el = document.getElementById("result-content");
  el.innerHTML = "";
  window._lastResult = "";

  switch (tool.result) {
    case "markdown":
      window._lastResult = data.markdown || "";
      el.innerHTML = `<pre class="raw-content">${esc(data.markdown)}</pre>`;
      break;
    case "xml":
    case "text":
      window._lastResult = data.content || data.result || data.signature || data.markdown || "";
      el.innerHTML = `<pre class="raw-content">${esc(window._lastResult)}</pre>`;
      break;
    case "chat":
      window._lastResult = data.reply || "";
      el.innerHTML = `<div class="alert alert-success"><strong>${isZh ? "AI 回复:" : "AI reply:"}</strong><br><br>${esc(data.reply).replace(/\n/g, "<br>")}</div>`;
      if (!data.ai) el.innerHTML += `<p class="hint">${isZh ? "提示: 设置 OPENAI_API_KEY 获得更好效果" : "Tip: set OPENAI_API_KEY for better AI results"}</p>`;
      break;
    case "faq":
      renderFAQs(el, data);
      break;
    case "sitemap-list":
      el.innerHTML = data.sitemaps?.length
        ? `<table class="rules-table"><thead><tr><th>Sitemap URL</th><th>${isZh ? "有效" : "Valid"}</th><th>${isZh ? "URL 数" : "URLs"}</th><th>${isZh ? "类型" : "Type"}</th></tr></thead><tbody>${data.sitemaps.map((s) => `<tr><td><a href="${esc(s.url)}" target="_blank">${esc(s.url)}</a></td><td>${s.valid ? "✓" : "✗"}</td><td>${s.urlCount}</td><td>${s.isIndex ? "Index" : "URLset"}</td></tr>`).join("")}</tbody></table>`
        : `<div class="alert alert-error">${isZh ? "未找到 sitemap" : "No sitemap found"}</div>`;
      break;
    case "validation":
      el.innerHTML = `<div class="stats-grid"><div class="stat-card"><div class="stat-value">${data.score}</div><div class="stat-label">${isZh ? "评分" : "Score"}</div></div><div class="stat-card"><div class="stat-value">${data.urlCount}</div><div class="stat-label">${isZh ? "URL 数" : "URLs"}</div></div><div class="stat-card"><div class="stat-value">${data.valid ? "✓" : "✗"}</div><div class="stat-label">${isZh ? "有效" : "Valid"}</div></div></div>${renderIssues(data.issues)}`;
      break;
    case "url-list":
      window._lastResult = (data.urls || []).map((u) => typeof u === "string" ? u : u.loc || u.url).join("\n");
      el.innerHTML = `<p><strong>${isZh ? "共" : "Total"} ${data.count} URL${data.count === 1 ? "" : "s"}</strong></p><pre class="raw-content" style="max-height:400px">${esc(window._lastResult)}</pre>`;
      break;
    case "compare":
      el.innerHTML = `<div class="stats-grid"><div class="stat-card"><div class="stat-value" style="color:var(--success)">+${data.addedCount}</div><div class="stat-label">${isZh ? "新增" : "Added"}</div></div><div class="stat-card"><div class="stat-value" style="color:var(--error)">-${data.removedCount}</div><div class="stat-label">${isZh ? "移除" : "Removed"}</div></div><div class="stat-card"><div class="stat-value">${data.unchangedCount}</div><div class="stat-label">${isZh ? "未变" : "Unchanged"}</div></div></div>
        <h3>${isZh ? "新增 URL" : "Added URLs"}</h3><pre class="raw-content">${esc(data.added.join("\n") || (isZh ? "(无)" : "(none)"))}</pre>
        <h3>${isZh ? "移除 URL" : "Removed URLs"}</h3><pre class="raw-content">${esc(data.removed.join("\n") || (isZh ? "(无)" : "(none)"))}</pre>`;
      break;
    case "split-merge":
      if (data.files) {
        el.innerHTML = data.files.map((f) => `<h3>${esc(f.name)} (${f.content.match(/<loc>/g)?.length || 0} URLs)</h3><pre class="raw-content">${esc(f.content)}</pre>`).join("");
      } else {
        window._lastResult = data.content;
        el.innerHTML = `<p>${isZh ? "合并共" : "Merged"} ${data.totalUrls} URL${data.totalUrls === 1 ? "" : "s"}</p><pre class="raw-content">${esc(data.content)}</pre>`;
      }
      break;
    case "analytics":
    case "frequency":
      el.innerHTML = `<pre class="raw-content">${esc(JSON.stringify(data, null, 2))}</pre>`;
      break;
    case "robots":
      renderRobots(el, data);
      break;
    case "roi":
      el.innerHTML = `<div class="stats-grid">${Object.entries(data).filter(([k]) => k !== "success").map(([k, v]) => `<div class="stat-card"><div class="stat-value" style="font-size:1.2rem">${esc(String(v))}</div><div class="stat-label">${esc(k)}</div></div>`).join("")}</div>`;
      break;
    default:
      window._lastResult = data.result || JSON.stringify(data, null, 2);
      el.innerHTML = `<pre class="raw-content">${esc(window._lastResult)}</pre>`;
  }

  if (data.note) el.innerHTML += `<p class="hint">${esc(data.note)}</p>`;
  if (data.ai === false && tool.category.startsWith("ai")) {
    el.innerHTML += `<p class="hint">${isZh ? "AI 未启用 — 使用模板生成。设置 OPENAI_API_KEY 启用完整 AI 功能。" : "AI disabled — using templates. Set OPENAI_API_KEY for full AI."}</p>`;
  }

  appendPoweredByBranding(el);

  document.getElementById("results").classList.add("visible");
}

const POWERED_BY_TEXT = "\n\n---\nPowered by Sitp GPT — https://yoursite.asia";
const POWERED_BY_HTML = `<p class="powered-by-sitp" style="margin-top:16px;padding:10px 14px;background:var(--primary-light,#ecfdf5);border-radius:8px;font-size:0.85rem;color:var(--primary,#0d9488);">Powered by <a href="https://yoursite.asia" target="_blank" rel="noopener">Sitp GPT</a></p>`;

function shouldShowPoweredBy() {
  try {
    const params = new URLSearchParams(location.search);
    if (params.get("pro") === "1") return false;
    if (localStorage.getItem("sitp_pro") === "1") return false;
  } catch (_) {}
  return true;
}

function appendPoweredByBranding(el) {
  if (!shouldShowPoweredBy()) return;
  if (window._lastResult) window._lastResult += POWERED_BY_TEXT;
  el.insertAdjacentHTML("beforeend", POWERED_BY_HTML);
}

function renderFAQs(el, data) {
  const faqs = data.faqs || [];
  window._lastResult = faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");
  el.innerHTML = faqs.map((f, i) => `<div class="result-section"><h3>Q${i + 1}: ${esc(f.question)}</h3><p>${esc(f.answer)}</p></div>`).join("");
}

function renderRobots(el, data) {
  const totalRules = data.groups?.reduce((s, g) => s + g.rules.length, 0) || 0;
  el.innerHTML = `<div class="stats-grid">
    <div class="stat-card"><div class="stat-value">${data.score}</div><div class="stat-label">${isZh ? "评分" : "Score"}</div></div>
    <div class="stat-card"><div class="stat-value">${data.groups?.length || 0}</div><div class="stat-label">${isZh ? "User-agent 组" : "User-agent groups"}</div></div>
    <div class="stat-card"><div class="stat-value">${totalRules}</div><div class="stat-label">${isZh ? "规则" : "Rules"}</div></div>
    <div class="stat-card"><div class="stat-value">${data.sitemaps?.length || 0}</div><div class="stat-label">Sitemap</div></div>
  </div>${renderIssues(data.issues)}
  ${data.pathTest ? `<div class="alert ${data.pathTest.allowed ? "alert-success" : "alert-error"}">${isZh ? "路径" : "Path"} ${esc(data.pathTest.path)}: ${data.pathTest.allowed ? (isZh ? "允许" : "Allowed") : (isZh ? "禁止" : "Blocked")}</div>` : ""}
  <pre class="raw-content">${esc(data.content)}</pre>`;
}

function renderIssues(issues) {
  if (!issues?.length) return "";
  return `<ul class="issue-list">${issues.map((i) => `<li class="issue-item ${i.severity}">${esc(i.message)}</li>`).join("")}</ul>`;
}

function renderOtherTools(currentId) {
  const others = TOOLS.filter((t) => t.id !== currentId).sort(() => Math.random() - 0.5).slice(0, 6);
  const grid = document.getElementById("other-tools-grid");
  const prefix = isZh ? "/zh/tools" : "/tools";
  grid.innerHTML = others.map((t) => `<article class="tool-card"><h2>${esc(t.name)}</h2><p>${esc(t.desc)}</p><a href="${prefix}/${t.id}" class="btn btn-primary">${t("useTool")}</a></article>`).join("");
}

function showError(msg) { const el = document.getElementById("error-alert"); el.textContent = msg; el.style.display = "block"; }
function hideError() { document.getElementById("error-alert").style.display = "none"; }
function hideResults() { document.getElementById("results").classList.remove("visible"); }

async function copyResult() {
  if (!window._lastResult) return;
  await navigator.clipboard.writeText(window._lastResult);
  document.getElementById("copy-btn").textContent = isZh ? "已复制!" : "Copied!";
  setTimeout(() => { document.getElementById("copy-btn").textContent = t("copyResult"); }, 2000);
}

function esc(s) { const d = document.createElement("div"); d.textContent = s ?? ""; return d.innerHTML; }
