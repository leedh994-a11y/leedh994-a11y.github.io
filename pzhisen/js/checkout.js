const params = new URLSearchParams(location.search);
const planId = params.get("plan") || "pro";
const cycle = params.get("cycle") || "monthly";

const isChinaUser = () =>
  navigator.language?.startsWith("zh") ||
  Intl.DateTimeFormat().resolvedOptions().timeZone?.includes("Shanghai") ||
  Intl.DateTimeFormat().resolvedOptions().timeZone?.includes("Chongqing") ||
  Intl.DateTimeFormat().resolvedOptions().timeZone?.includes("Urumqi");

let selectedProvider = isChinaUser() ? "bank" : "paypal";
let billingConfig = null;
let plan = null;

const METHODS = [
  {
    id: "bank",
    icon: "🏦",
    name: "银行卡支付",
    desc: "全国银行储蓄卡/信用卡（工行·建行·农行·中行·招商·交通等）",
    providerKey: "bankCard",
  },
  {
    id: "paypal",
    icon: "🅿️",
    name: "PayPal",
    desc: "海外用户 — 国际信用卡 / PayPal 余额",
    providerKey: "paypal",
  },
];

function showError(msg) {
  const el = document.getElementById("checkout-error");
  el.hidden = !msg;
  el.textContent = msg || "";
}

function setBusy(busy) {
  document.getElementById("btn-pay").disabled = busy;
  document.getElementById("btn-pay").textContent = busy ? "处理中…" : "银行卡支付";
}

async function loadPlan() {
  const [plansRes, cfgRes] = await Promise.all([
    fetch("/api/billing/plans"),
    fetch("/api/billing/config"),
  ]);
  billingConfig = await cfgRes.json();
  const { plans } = await plansRes.json();
  plan = plans.find((p) => p.id === planId);
  if (!plan) {
    location.href = "/pricing.html";
    return;
  }
  renderSummary();
  renderMethods();
  document.getElementById("pay-hint").textContent =
    billingConfig.noteZh || "使用银行卡安全支付，款项进入您绑定的国内银行卡。";
}

function renderSummary() {
  const cny = plan.priceCny[cycle];
  const usd = plan.priceUsd[cycle];
  document.getElementById("checkout-title").textContent = `订阅 ${plan.nameZh || plan.name}`;
  document.getElementById("checkout-subtitle").textContent = plan.descriptionZh || plan.description;
  document.getElementById("sum-plan").textContent = plan.nameZh || plan.name;
  document.getElementById("sum-cycle").textContent = cycle === "yearly" ? "年付" : "月付";
  document.getElementById("sum-total").textContent =
    selectedProvider === "paypal" ? `$${usd} USD` : `¥${cny} CNY`;
  document.getElementById("btn-pay").textContent =
    selectedProvider === "paypal" ? "Pay with PayPal" : "银行卡支付";
}

function renderMethods() {
  const providers = billingConfig?.providers || {};
  const container = document.getElementById("pay-methods");
  const available = METHODS.filter((m) => providers[m.providerKey]);

  if (!available.length) {
    container.innerHTML = `<p class="checkout-hint">支付尚未配置。国内银行卡请设置 XUNHU 密钥；海外请设置 PayPal 密钥。</p>`;
    document.getElementById("btn-pay").disabled = true;
    return;
  }

  if (!available.find((m) => m.id === selectedProvider)) {
    selectedProvider = available[0].id;
  }

  container.innerHTML = available.map((m) => `
    <label class="pay-method ${m.id === selectedProvider ? "selected" : ""}" data-id="${m.id}">
      <input type="radio" name="pay" value="${m.id}" ${m.id === selectedProvider ? "checked" : ""}>
      <span class="pay-icon">${m.icon}</span>
      <span>
        <strong>${m.name}</strong><br>
        <small style="color:var(--muted)">${m.desc}</small>
      </span>
    </label>
  `).join("");

  container.querySelectorAll(".pay-method").forEach((el) => {
    el.addEventListener("click", () => {
      selectedProvider = el.dataset.id;
      container.querySelectorAll(".pay-method").forEach((l) => l.classList.remove("selected"));
      el.classList.add("selected");
      el.querySelector("input").checked = true;
      renderSummary();
      document.getElementById("qr-container").innerHTML = "";
      document.getElementById("paypal-button-container").innerHTML = "";
      if (selectedProvider === "paypal") initPayPalButtons();
    });
  });

  if (providers.paypal && billingConfig.paypal?.sdkUrl) {
    loadPayPalSdk(billingConfig.paypal.sdkUrl);
  }
}

function loadPayPalSdk(url) {
  if (document.querySelector("script[data-paypal]")) {
    if (selectedProvider === "paypal") initPayPalButtons();
    return;
  }
  const s = document.createElement("script");
  s.src = url;
  s.dataset.paypal = "1";
  s.onload = initPayPalButtons;
  document.head.appendChild(s);
}

function initPayPalButtons() {
  if (!window.paypal || selectedProvider !== "paypal") return;
  const container = document.getElementById("paypal-button-container");
  container.innerHTML = "";
  window.paypal.Buttons({
    style: { layout: "vertical", color: "gold", shape: "rect" },
    createOrder: async () => {
      const email = document.getElementById("checkout-email").value.trim();
      if (!email.includes("@")) throw new Error("请填写有效邮箱");
      const data = await startCheckout(email);
      return data.paypalOrderId;
    },
    onApprove: async (data) => {
      const email = document.getElementById("checkout-email").value.trim();
      const orderData = await startCheckout(email);
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
  if (!email.includes("@")) {
    showError("请填写有效邮箱");
    return;
  }

  setBusy(true);
  try {
    const data = await startCheckout(email);

    if (data.provider === "paypal" && data.approveUrl) {
      location.href = data.approveUrl;
      return;
    }

    if (data.payUrl) {
      const qr = document.getElementById("qr-container");
      if (data.qrcodeUrl) {
        qr.innerHTML = `<div class="qr-box"><p>请在支付页面选择您的银行卡完成付款</p><img src="${data.qrcodeUrl}" alt="支付二维码"><p class="checkout-hint" style="margin-top:12px"><a href="${data.payUrl}">点击此处打开支付页面</a></p></div>`;
      }
      location.href = data.payUrl;
      return;
    }

    throw new Error("未获得支付链接");
  } catch (e) {
    showError(e.message);
  } finally {
    setBusy(false);
  }
}

document.getElementById("btn-pay").addEventListener("click", pay);

const savedEmail = localStorage.getItem("pzhisen_email");
if (savedEmail) document.getElementById("checkout-email").value = savedEmail;
document.getElementById("checkout-email").addEventListener("change", (e) => {
  localStorage.setItem("pzhisen_email", e.target.value.trim());
});

loadPlan();
