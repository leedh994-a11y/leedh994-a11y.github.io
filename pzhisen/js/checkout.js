const api = (path, options = {}) => fetch(path, { credentials: "include", ...options });

async function ensureLoggedIn() {
  const res = await api("/api/auth/me");
  if (!res.ok) {
    location.href = "/login.html";
    return null;
  }
  const data = await res.json();
  const emailEl = document.getElementById("checkout-email");
  if (data.user?.email && emailEl) {
    emailEl.value = data.user.email;
    emailEl.readOnly = true;
  }
  return data;
}

const params = new URLSearchParams(location.search);
const planId = params.get("plan") || "pro";
let cycle = params.get("cycle") || "monthly";
if (cycle !== "monthly" && cycle !== "annual") cycle = "monthly";

const isChinaUser = () =>
  navigator.language?.startsWith("zh") ||
  Intl.DateTimeFormat().resolvedOptions().timeZone?.includes("Shanghai") ||
  Intl.DateTimeFormat().resolvedOptions().timeZone?.includes("Chongqing");

let selectedProvider = isChinaUser() ? "bank" : "paypal";
let billingConfig = null;
let plan = null;
let currentBankOrder = null;
let pendingPayPalOrder = null;

function cycleLabelZh(c) {
  return c === "annual" ? "年付" : "月付";
}

function getPrices() {
  if (!plan) return { cny: 0, usd: 0 };
  return {
    cny: plan.priceCny?.[cycle] ?? 0,
    usd: plan.priceUsd?.[cycle] ?? 0,
  };
}

function buildMethods() {
  const { cny, usd } = getPrices();
  return [
    {
      id: "bank",
      icon: "🏦",
      name: "银行卡转账",
      desc: `¥${cny} · 手机银行/网银转账，中国内地用户`,
      providerKey: "bankCard",
    },
    {
      id: "paypal",
      icon: "🅿️",
      name: "PayPal",
      desc: `$${usd} · 信用卡/借记卡，全球用户`,
      providerKey: "paypal",
    },
  ];
}

function showError(msg) {
  const el = document.getElementById("checkout-error");
  el.hidden = !msg;
  el.textContent = msg || "";
}

function setBusy(busy) {
  const btn = document.getElementById("btn-pay");
  btn.disabled = busy;
  if (selectedProvider === "bank") {
    btn.textContent = busy ? "处理中…" : (currentBankOrder ? "我已完成转账" : "生成转账信息");
  } else {
    btn.textContent = busy ? "Processing…" : "Pay with PayPal";
  }
}

async function loadPlan() {
  const [plansRes, cfgRes] = await Promise.all([
    fetch("/api/billing/plans"),
    fetch("/api/billing/config"),
  ]);
  billingConfig = await cfgRes.json();
  const { plans } = await plansRes.json();
  plan = plans.find((p) => p.id === planId) || plans[0];
  if (!plan) location.href = "/pricing.html";
  renderSummary();
  renderMethods();
  document.getElementById("pay-hint").textContent = billingConfig.noteZh || "";

  if (billingConfig.paypal?.authOk === false && billingConfig.paypal?.authError) {
    showError(
      `PayPal 服务端配置有误：${billingConfig.paypal.authError}。请改用银行卡转账，或联系管理员修正 Render 中的 PayPal 环境变量。`
    );
  }
}

function renderSummary() {
  const { cny, usd } = getPrices();
  document.getElementById("checkout-title").textContent =
    selectedProvider === "bank"
      ? `支付 ¥${cny} 开通${cycleLabelZh(cycle)}`
      : `Pay $${usd} — ${cycle === "annual" ? "Annual" : "Monthly"} Pro`;
  document.getElementById("checkout-subtitle").textContent = plan.descriptionZh || plan.description;
  document.getElementById("sum-plan").textContent = plan.nameZh || plan.name;
  document.getElementById("sum-cycle").textContent =
    cycle === "annual" ? "年付（365 天）" : "月付（30 天）";
  document.getElementById("sum-total").textContent =
    selectedProvider === "paypal" ? `$${usd} USD` : `¥${cny} CNY`;
  setBusy(false);
}

function renderMethods() {
  const providers = billingConfig?.providers || {};
  const container = document.getElementById("pay-methods");
  const METHODS = buildMethods();
  const available = METHODS.filter((m) => providers[m.providerKey]);

  if (!available.length) {
    container.innerHTML = `<p class="checkout-hint">请配置银行卡信息（BANK_*）或 PayPal 密钥。</p>`;
    document.getElementById("btn-pay").disabled = true;
    return;
  }

  if (!available.find((m) => m.id === selectedProvider)) selectedProvider = available[0].id;

  container.innerHTML = available.map((m) => `
    <label class="pay-method ${m.id === selectedProvider ? "selected" : ""}" data-id="${m.id}">
      <input type="radio" name="pay" value="${m.id}" ${m.id === selectedProvider ? "checked" : ""}>
      <span class="pay-icon">${m.icon}</span>
      <span><strong>${m.name}</strong><br><small style="color:var(--muted)">${m.desc}</small></span>
    </label>
  `).join("");

  container.querySelectorAll(".pay-method").forEach((el) => {
    el.addEventListener("click", () => {
      selectedProvider = el.dataset.id;
      currentBankOrder = null;
      document.getElementById("bank-panel").hidden = true;
      container.querySelectorAll(".pay-method").forEach((l) => l.classList.remove("selected"));
      el.classList.add("selected");
      el.querySelector("input").checked = true;
      renderSummary();
      document.getElementById("paypal-button-container").innerHTML = "";
      document.getElementById("btn-pay").style.display = selectedProvider === "bank" ? "block" : "none";
      if (selectedProvider === "paypal") loadPayPalSdk();
    });
  });

  document.getElementById("btn-pay").style.display = selectedProvider === "bank" ? "block" : "none";
  if (providers.paypal && selectedProvider === "paypal" && billingConfig.paypal?.sdkUrl) loadPayPalSdk();
}

function showBankPanel(data) {
  currentBankOrder = data;
  const panel = document.getElementById("bank-panel");
  panel.hidden = false;
  panel.innerHTML = `
    <div class="checkout-summary" style="margin-top:16px;text-align:left">
      <p style="margin:0 0 12px;font-weight:600">请转账至以下银行卡（手机银行 / 网银均可）：</p>
      <div class="checkout-line"><span>开户名</span><strong>${data.bankAccount.accountName}</strong></div>
      <div class="checkout-line"><span>开户行</span><strong>${data.bankAccount.bankName}</strong></div>
      ${data.bankAccount.branch ? `<div class="checkout-line"><span>支行</span><strong>${data.bankAccount.branch}</strong></div>` : ""}
      <div class="checkout-line"><span>卡号</span><strong style="font-family:monospace;letter-spacing:1px">${data.bankAccount.accountNumber}</strong></div>
      <div class="checkout-line"><span>金额</span><strong style="color:#dc2626">¥${data.amount}</strong></div>
      <div class="checkout-line total"><span>转账备注（必填）</span><strong style="color:#dc2626">${data.transferCode}</strong></div>
    </div>
    <p class="checkout-hint">转账时务必填写备注 <strong>${data.transferCode}</strong>。完成转账后点击下方按钮开通${cycleLabelZh(cycle)}订阅（${cycle === "annual" ? "365" : "30"} 天）。到期后需续费方可继续使用。</p>
  `;
  setBusy(false);
}

function loadPayPalSdk() {
  if (!billingConfig.paypal?.sdkUrl || selectedProvider !== "paypal") return;
  if (document.querySelector("script[data-paypal]")) { initPayPalButtons(); return; }
  const s = document.createElement("script");
  s.src = billingConfig.paypal.sdkUrl;
  s.dataset.paypal = "1";
  s.onload = initPayPalButtons;
  document.head.appendChild(s);
}

function initPayPalButtons() {
  if (!window.paypal || selectedProvider !== "paypal") return;
  document.getElementById("paypal-button-container").innerHTML = "";
  window.paypal.Buttons({
    style: { layout: "vertical", color: "gold", shape: "rect" },
    createOrder: async () => {
      const email = document.getElementById("checkout-email").value.trim();
      if (!email.includes("@")) throw new Error("请填写有效邮箱");
      localStorage.setItem("pzhisen_email", email);
      pendingPayPalOrder = await startCheckout(email);
      return pendingPayPalOrder.paypalOrderId;
    },
    onApprove: async (data) => {
      if (!pendingPayPalOrder?.orderId) throw new Error("订单未找到，请重试");
      const cap = await api("/api/billing/paypal/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: pendingPayPalOrder.orderId,
          paypalOrderId: data.orderID || pendingPayPalOrder.paypalOrderId,
        }),
      }).then((r) => r.json());
      if (cap.success) {
        if (cap.companyId) localStorage.setItem("pzhisen_company_id", cap.companyId);
        location.href = `/checkout-success.html?order=${pendingPayPalOrder.orderId}`;
      } else {
        throw new Error(cap.error || "扣款失败");
      }
    },
    onError: (err) => {
      const msg = err?.message || String(err) || "PayPal 出错";
      if (/authentication|invalid_client|凭证/i.test(msg)) {
        showError(
          "PayPal 认证失败：请确认 Render 中 PAYPAL_CLIENT_ID、PAYPAL_CLIENT_SECRET 来自同一 PayPal 应用，且 PAYPAL_MODE 与密钥环境一致（live 用正式密钥，sandbox 用沙盒密钥）。中国内地用户可先选择「银行卡转账」。"
        );
      } else {
        showError(msg);
      }
    },
  }).render("#paypal-button-container");
}

async function startCheckout(email) {
  const res = await api("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, planId, cycle, provider: selectedProvider }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "创建订单失败");
  return data;
}

async function pay() {
  showError("");
  const email = document.getElementById("checkout-email").value.trim();
  if (!email.includes("@")) { showError("请填写有效邮箱"); return; }

  setBusy(true);
  try {
    if (selectedProvider === "bank") {
      if (!currentBankOrder) {
        const data = await startCheckout(email);
        showBankPanel(data);
        return;
      }
      const res = await api("/api/billing/bank/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: currentBankOrder.orderId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      if (data.companyId) localStorage.setItem("pzhisen_company_id", data.companyId);
      location.href = `/checkout-success.html?order=${currentBankOrder.orderId}`;
      return;
    }

    const data = await startCheckout(email);
    if (data.approveUrl) location.href = data.approveUrl;
    else throw new Error("未获得 PayPal 支付链接");
  } catch (e) {
    showError(e.message);
  } finally {
    setBusy(false);
  }
}

document.getElementById("btn-pay").addEventListener("click", pay);

document.querySelectorAll(".cycle-switch button").forEach((btn) => {
  btn.addEventListener("click", () => {
    cycle = btn.dataset.cycle;
    document.querySelectorAll(".cycle-switch button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentBankOrder = null;
    document.getElementById("bank-panel").hidden = true;
    const url = new URL(location.href);
    url.searchParams.set("cycle", cycle);
    history.replaceState(null, "", url);
    renderSummary();
    renderMethods();
  });
  if (btn.dataset.cycle === cycle) btn.classList.add("active");
});

const saved = localStorage.getItem("pzhisen_email");
const emailFromUrl = params.get("email");
const emailFromSession = sessionStorage.getItem("pzhisen_checkout_email");
if (emailFromUrl) document.getElementById("checkout-email").value = emailFromUrl;
else if (emailFromSession) document.getElementById("checkout-email").value = emailFromSession;
else if (saved) document.getElementById("checkout-email").value = saved;

document.getElementById("checkout-email").addEventListener("change", (e) => {
  localStorage.setItem("pzhisen_email", e.target.value.trim());
});

loadPlan();
ensureLoggedIn();
