(function () {
  const messagesEl = document.getElementById("openrouter-messages");
  const form = document.getElementById("openrouter-form");
  const input = document.getElementById("openrouter-input");
  const sendBtn = document.getElementById("openrouter-send");
  const statusEl = document.getElementById("openrouter-status");
  if (!messagesEl || !form) return;

  let history = [];
  let configured = false;
  let model = "";

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderMarkdownLite(text) {
    let html = escapeHtml(text);
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    html = html.replace(/\n/g, "<br>");
    return html;
  }

  function appendMessage(role, text) {
    const div = document.createElement("div");
    div.className = `openrouter-msg openrouter-msg--${role}`;
    div.innerHTML =
      role === "assistant"
        ? `<strong>AI</strong><div class="openrouter-msg-body">${renderMarkdownLite(text)}</div>`
        : `<strong>您</strong><div class="openrouter-msg-body">${escapeHtml(text)}</div>`;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function loadConfig() {
    try {
      const res = await fetch("/api/openrouter/config");
      const data = await res.json();
      configured = data.configured;
      model = data.model || "";
      if (configured) {
        statusEl.textContent = `已连接 OpenRouter · 模型 ${model}`;
        statusEl.style.color = "var(--success, #059669)";
      } else {
        statusEl.textContent =
          "OpenRouter 尚未配置：请在服务器 .env 设置 OPENROUTER_API_KEY 后重启。";
        statusEl.style.color = "var(--warning, #d97706)";
        sendBtn.disabled = true;
        input.disabled = true;
      }
    } catch {
      statusEl.textContent = "无法加载 OpenRouter 配置";
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = input.value.trim();
    if (!message || !configured) return;

    appendMessage("user", message);
    input.value = "";
    sendBtn.disabled = true;
    sendBtn.textContent = "思考中…";

    const loading = document.createElement("div");
    loading.className = "openrouter-msg openrouter-msg--assistant openrouter-msg--loading";
    loading.textContent = "AI 正在分析方案…";
    messagesEl.appendChild(loading);

    try {
      const res = await fetch("/api/openrouter/pricing-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      const data = await res.json();
      loading.remove();
      if (!data.success) throw new Error(data.error || "请求失败");
      history.push({ role: "user", content: message });
      history.push({ role: "assistant", content: data.reply });
      appendMessage("assistant", data.reply);
    } catch (err) {
      loading.remove();
      appendMessage("assistant", `抱歉，暂时无法回答：${err.message}`);
    } finally {
      sendBtn.disabled = !configured;
      sendBtn.textContent = "询问 AI";
    }
  });

  loadConfig();
})();
