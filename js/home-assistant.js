/**
 * Sitp GPT homepage assistant — chat widgets, FAQ Ask, Book demo
 */
(function () {
  const historyByChat = new Map();

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatReply(text) {
    return escapeHtml(text).replace(/\n/g, "<br>");
  }

  function getHistory(chatId) {
    if (!historyByChat.has(chatId)) historyByChat.set(chatId, []);
    return historyByChat.get(chatId);
  }

  function appendMessage(container, role, text) {
    const el = document.createElement("div");
    el.className = role === "user" ? "chat-msg chat-msg-user" : "chat-msg chat-msg-bot";
    el.innerHTML = formatReply(text);
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  function setLoading(container, on) {
    let el = container.querySelector(".chat-msg-loading");
    if (on && !el) {
      el = document.createElement("div");
      el.className = "chat-msg chat-msg-bot chat-msg-loading";
      el.textContent = "Thinking… 思考中…";
      container.appendChild(el);
      container.scrollTop = container.scrollHeight;
    } else if (!on && el) {
      el.remove();
    }
  }

  async function sendMessage(chatEl, text) {
    const chatId = chatEl.dataset.chatId || "default";
    const messagesEl = chatEl.querySelector(".chat-messages");
    const input = chatEl.querySelector(".chat-input");
    const sendBtn = chatEl.querySelector(".chat-send");
    const msg = text.trim();
    if (!msg || !messagesEl) return;

    appendMessage(messagesEl, "user", msg);
    if (input) input.value = "";
    if (sendBtn) sendBtn.disabled = true;
    if (input) input.disabled = true;
    setLoading(messagesEl, true);

    const history = getHistory(chatId);
    try {
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history }),
      });
      const data = await res.json();
      setLoading(messagesEl, false);
      if (!data.success) throw new Error(data.error || "Request failed");
      appendMessage(messagesEl, "bot", data.reply);
      history.push({ role: "user", content: msg });
      history.push({ role: "assistant", content: data.reply });
    } catch (err) {
      setLoading(messagesEl, false);
      appendMessage(messagesEl, "bot", `Sorry, something went wrong. Email support@yoursite.asia\n\n抱歉，出错了。请发邮件至 support@yoursite.asia\n(${err.message})`);
    } finally {
      if (sendBtn) sendBtn.disabled = false;
      if (input) input.disabled = false;
      if (input) input.focus();
    }
  }

  function initChatWidget(chatEl) {
    if (chatEl.dataset.chatReady) return;
    chatEl.dataset.chatReady = "1";
    if (!chatEl.dataset.chatId) chatEl.dataset.chatId = "chat-" + Math.random().toString(36).slice(2, 8);

    const input = chatEl.querySelector(".chat-input");
    const sendBtn = chatEl.querySelector(".chat-send");

    sendBtn?.addEventListener("click", () => sendMessage(chatEl, input?.value || ""));
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage(chatEl, input.value);
      }
    });

    chatEl.querySelectorAll(".chat-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const q = chip.dataset.question || chip.textContent.split("?")[0].trim() + (chip.textContent.includes("?") ? "?" : "");
        sendMessage(chatEl, q.replace(/\s*[\u4e00-\u9fff].*$/, "").trim() || chip.textContent.trim());
      });
    });
  }

  function openAssistantPanel(prefill) {
    const panel = document.getElementById("sitp-assistant-panel");
    if (!panel) return;
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    const chatEl = panel.querySelector(".sitp-chat");
    if (chatEl) {
      initChatWidget(chatEl);
      if (prefill) {
        const input = chatEl.querySelector(".chat-input");
        if (input) {
          input.value = prefill;
          input.focus();
        }
        sendMessage(chatEl, prefill);
      } else {
        chatEl.querySelector(".chat-input")?.focus();
      }
    }
  }

  function closeAssistantPanel() {
    const panel = document.getElementById("sitp-assistant-panel");
    if (!panel) return;
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
  }

  function initDemoModal() {
    const modal = document.getElementById("demo-modal");
    const form = document.getElementById("demo-form");
    const success = document.getElementById("demo-success");
    if (!modal || !form) return;

    function openModal() {
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
      form.hidden = false;
      if (success) success.hidden = true;
      form.querySelector('[name="name"]')?.focus();
    }

    function closeModal() {
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
    }

    document.querySelectorAll("[data-book-demo]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        openModal();
      });
    });

    modal.querySelectorAll("[data-demo-close]").forEach((el) => {
      el.addEventListener("click", closeModal);
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal.querySelector(".demo-modal-backdrop")) closeModal();
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      const payload = Object.fromEntries(new FormData(form));
      try {
        const res = await fetch("/api/demo/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Submit failed");
        form.hidden = true;
        if (success) {
          success.hidden = false;
          success.innerHTML = `<p><strong>${escapeHtml(data.message)}</strong></p><p>${escapeHtml(data.messageZh || "")}</p>`;
        }
        form.reset();
      } catch (err) {
        alert("提交失败 / Submit failed: " + err.message);
      } finally {
        btn.disabled = false;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".sitp-chat").forEach(initChatWidget);

    document.querySelectorAll(".faq-ask-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const q = btn.dataset.question || btn.closest(".faq-item")?.querySelector("summary")?.textContent?.replace(/Ask\s*问/g, "").trim();
        openAssistantPanel(q);
      });
    });

    document.getElementById("float-chat-btn")?.addEventListener("click", (e) => {
      e.preventDefault();
      openAssistantPanel();
    });

    document.getElementById("sitp-panel-close")?.addEventListener("click", closeAssistantPanel);

    initDemoModal();
  });

  window.SitpAssistant = { open: openAssistantPanel, send: sendMessage };
})();
