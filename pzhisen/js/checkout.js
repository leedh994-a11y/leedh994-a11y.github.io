const params = new URLSearchParams(location.search);
const planId = params.get("plan") || "pro";
const cycle = params.get("cycle") || "monthly";

let billingConfig = null;
let plan = null;
let pendingPayPalOrder = null;

const CYCLE_ZH = { monthly: "月付（1 个月）", yearly: "年付（12 个月）" };

function showError(msg) {
  const el = document.getElementById("checkout-error");
  el.hidden = !msg;
  el.textContent = msg || "";
}

async function loadPlan() {
  const [plansRes, cfgRes] = await Promise.all([
    fetch("/api/billing/plans"),
    fetch("/api/billing/config"),
  ]);
  billingConfig = await cfgRes.json();
  const { plans } = await plansRes.json();
  const selected = plans.find((p) => p.cycle === cycle);
  plan = selected || plans[0];
  if (!plan) location.href = "/pricing.html";
  renderSummary();
  renderMethods();
  document.getElementById("pay-hint").textContent = billingConfig.noteZh || billingConfig.noteEn || "";
}

function renderSummary() {
  document.getElementById("checkout-title").textContent =
    `订阅 ${plan.nameZh || plan.name} — ${plan.cycle === "yearly" ? "年付" : "月付"}`;
  document.getElementById("checkout-subtitle").textContent = plan.descriptionZh || plan.description;
  document.getElementById("sum-plan").textContent = plan.nameZh || plan.name;
  document.getElementById("sum-cycle").textContent = CYCLE_ZH[plan.cycle] || plan.cycle;
  document.getElementById("sum-total").textContent = `${plan.priceLabel} USD`;
}

function renderMethods() {
  const container = document.getElementById("pay-methods");
  if (!billingConfig?.providers?.paypal) {
    container.innerHTML = `<p class="checkout-hint">PayPal 未配置，请联系管理员。</p>`;
    return;
  }
  container.innerHTML = `
    <label class="pay-method selected">
      <span class="pay-icon">🅿️</span>
      <span><strong>PayPal</strong><br><small style="color:var(--muted)">支付后立即可用，有效期至订阅周期结束</small></span>
    </label>
  `;
  if (billingConfig.paypal?.sdkUrl) loadPayPalSdk();
}

function loadPayPalSdk() {
  if (!billingConfig.paypal?.sdkUrl) return;
  if (document.querySelector("script[data-paypal]")) { initPayPalButtons(); return; }
  const s = document.createElement("script");
  s.src = billingConfig.paypal.sdkUrl;
  s.dataset.paypal = "1";
  s.onload = initPayPalButtons;
  document.head.appendChild(s);
}

function initPayPalButtons() {
  if (!window.paypal) return;
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
      const cap = await fetch("/api/billing/paypal/capture", {
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
    onError: (err) => showError(err?.message || "PayPal 出错"),
  }).render("#paypal-button-container");
}

async function startCheckout(email) {
  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, planId, cycle, provider: "paypal" }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "创建订单失败");
  return data;
}

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
