const params = new URLSearchParams(location.search);
const planId = params.get("plan") || "lifetime";
const cycle = params.get("cycle") || "lifetime";

const isChinaUser = () =>
  navigator.language?.startsWith("zh") ||
  Intl.DateTimeFormat().resolvedOptions().timeZone?.includes("Shanghai") ||
  Intl.DateTimeFormat().resolvedOptions().timeZone?.includes("Chongqing");

let selectedProvider = isChinaUser() ? "bank" : "paypal";
let billingConfig = null;
let plan = null;
let currentBankOrder = null;

const METHODS = [
  { id: "bank", icon: "🏦", name: "银行卡转账", desc: "免费 · 转账至商户银行卡（全国银行均可）", providerKey: "bankCard" },
  { id: "paypal", icon: "🅿️", name: "PayPal", desc: "海外用户", providerKey: "paypal" },
];

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
  plan = plans.find((p) => p.id === planId);
  if (!plan) location.href = "/pricing.html";
  renderSummary();
  renderMethods();
  document.getElementById("pay-hint").textContent = billingConfig.noteZh || "";
}

function renderSummary() {
  const cny = plan.priceCny[cycle];
  const usd = plan.priceUsd[cycle];
  document.getElementById("checkout-title").textContent = `订阅 ${plan.nameZh || plan.name}`;
  document.getElementById("checkout-subtitle").textContent = plan.descriptionZh || plan.description;
  document.getElementById("sum-plan").textContent = plan.nameZh || plan.name;
  document.getElementById("sum-cycle").textContent = "终身（一次付费）";
  document.getElementById("sum-total").textContent =
    selectedProvider === "paypal" ? `$1 USD` : `¥1 CNY`;
  setBusy(false);
}

function renderMethods() {
  const providers = billingConfig?.providers || {};
  const container = document.getElementById("pay-methods");
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
      if (selectedProvider === "paypal") loadPayPalSdk();
    });
  });

  if (providers.paypal && billingConfig.paypal?.sdkUrl) loadPayPalSdk();
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
    <p class="checkout-hint">转账时务必填写备注 <strong>${data.transferCode}</strong>，否则无法核对。完成后点击下方按钮。</p>
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
      return (await startCheckout(email)).paypalOrderId;
    },
    onApprove: async (data) => {
      const orderData = await startCheckout(document.getElementById("checkout-email").value.trim());
      const cap = await fetch("/api/billing/paypal/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: orderData.orderId, paypalOrderId: data.orderID }),
      }).then((r) => r.json());
      if (cap.success) location.href = `/checkout-success.html?order=${orderData.orderId}`;
      else throw new Error(cap.error || "扣款失败");
    },
    onError: (err) => showError(err?.message || "PayPal 出错"),
  }).render("#paypal-button-container");
}

async function startCheckout(email) {
  const res = await fetch("/api/billing/checkout", {
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
      const res = await fetch("/api/billing/bank/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: currentBankOrder.orderId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      location.href = `/checkout-success.html?order=${currentBankOrder.orderId}&pending=1`;
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
const saved = localStorage.getItem("pzhisen_email");
if (saved) document.getElementById("checkout-email").value = saved;
document.getElementById("checkout-email").addEventListener("change", (e) => {
  localStorage.setItem("pzhisen_email", e.target.value.trim());
});
loadPlan();
