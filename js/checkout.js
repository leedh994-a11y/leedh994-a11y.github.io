const params = new URLSearchParams(location.search);
const planId = params.get("plan") || "growth";
const cycle = params.get("cycle") || "monthly";

const PRICES = {
  starter: { monthly: 39, yearly: 468, name: "Starter" },
  growth: { monthly: 79, yearly: 948, name: "Growth" },
  scale: { monthly: 259, yearly: 3108, name: "Scale" },
};

const INSTALLATION = {
  planId: "installation",
  amount: 599,
  name: "AI Installation Service",
  description:
    "Sitp GPT AI customer support installation — training, widget setup, FAQ, workflow optimization",
};

const isInstallation = planId === INSTALLATION.planId;
const plan = isInstallation ? INSTALLATION : PRICES[planId];

if (!plan) location.href = "/pricing.html";

const trialRow = document.querySelector("#summary .checkout-line:nth-child(3)");
const addonBranding = document.getElementById("addon-branding")?.closest("label");
const addonMessages = document.getElementById("addon-messages")?.closest("label");
const btnTrial = document.getElementById("btn-trial");

function setupInstallationUI() {
  document.getElementById("checkout-title").textContent = "AI Installation Service — $599";
  document.getElementById("checkout-subtitle").textContent =
    "One-time payment · includes training, widget install, FAQ setup & workflow optimization";
  document.getElementById("sum-plan").textContent = INSTALLATION.name;
  document.getElementById("sum-cycle").textContent = "One-time";
  if (trialRow) trialRow.style.display = "none";
  if (addonBranding) addonBranding.style.display = "none";
  if (addonMessages) addonMessages.style.display = "none";
  if (btnTrial) btnTrial.style.display = "none";
  document.getElementById("sum-total").textContent = `$${INSTALLATION.amount}`;
  document.getElementById("btn-pay").textContent = "Pay $599 with PayPal";
}

function setupSubscriptionUI() {
  document.getElementById("checkout-title").textContent = `Subscribe to ${plan.name}`;
  document.getElementById("checkout-subtitle").textContent =
    cycle === "yearly" ? `Billed yearly · save ~40%` : `Billed monthly`;
  document.getElementById("sum-plan").textContent = plan.name;
  document.getElementById("sum-cycle").textContent = cycle === "yearly" ? "Yearly" : "Monthly";
  updateSummary();
}

if (isInstallation) setupInstallationUI();
else setupSubscriptionUI();

function getAddons() {
  if (isInstallation) return [];
  const addons = [];
  if (document.getElementById("addon-branding")?.checked) addons.push("remove-branding");
  if (document.getElementById("addon-messages")?.checked) addons.push("extra-messages");
  return addons;
}

function getTotal() {
  if (isInstallation) return INSTALLATION.amount;
  let total = cycle === "yearly" ? plan.yearly : plan.monthly;
  if (document.getElementById("addon-branding")?.checked) total += cycle === "yearly" ? 468 : 39;
  if (document.getElementById("addon-messages")?.checked) total += cycle === "yearly" ? 468 : 39;
  return total;
}

function updateSummary() {
  document.getElementById("sum-total").textContent = `$${getTotal()} (after trial)`;
}

if (!isInstallation) {
  document.getElementById("addon-branding").addEventListener("change", updateSummary);
  document.getElementById("addon-messages").addEventListener("change", updateSummary);
}

function translatePayPalError(msg) {
  const m = String(msg || "");
  if (/merchant account is restricted/i.test(m)) {
    return "PayPal 商户账户受限，暂时无法收款。请登录 PayPal 完成企业认证并解除限制：\nhttps://www.paypal.com/businessmanage/account/aboutBusiness";
  }
  if (/tunnel|503|502|unavailable/i.test(m)) {
    return "公网隧道未连接，请稍后再试或联系站长保持 Tunnel 窗口运行。";
  }
  if (/无效套餐/i.test(m) && isInstallation) {
    return "服务器尚未启用安装套餐 API，正在尝试备用 PayPal 通道…";
  }
  return m;
}

function showError(msg) {
  const el = document.getElementById("error-alert");
  el.textContent = translatePayPalError(msg);
  el.style.display = "block";
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function isRestrictedBrowser() {
  const ua = navigator.userAgent || "";
  return /Mobile|Android|iPhone|iPad|iPod|Baidu|baiduboxapp|MicroMessenger|WeChat|QQ\//i.test(ua);
}

async function checkSiteOnline() {
  try {
    const r = await fetch("/api/health", { cache: "no-store" });
    if (!r.ok) throw new Error("offline");
  } catch {
    showError("支付服务暂时不可用（503 隧道未连接）。请稍后再试。");
    document.getElementById("btn-trial")?.setAttribute("disabled", "true");
    document.getElementById("btn-pay")?.setAttribute("disabled", "true");
    return false;
  }
  return true;
}

function setPayButtonsBusy(busy, label) {
  for (const id of ["btn-trial", "btn-pay", "btn-paypal-mobile"]) {
    const b = document.getElementById(id);
    if (!b || b.style.display === "none") continue;
    b.disabled = busy;
    if (busy && label) b.textContent = label;
  }
  if (!busy) {
    const trial = document.getElementById("btn-trial");
    const pay = document.getElementById("btn-pay");
    const mob = document.getElementById("btn-paypal-mobile");
    if (trial && trial.style.display !== "none") trial.textContent = "Start 7-day free trial";
    if (pay) pay.textContent = isInstallation ? "Pay $599 with PayPal" : "Subscribe now (PayPal)";
    if (mob) mob.textContent = isInstallation ? "前往 PayPal 支付 $599" : "前往 PayPal 付款";
  }
}

async function createPayPalOrder(email) {
  const billingRes = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      planId,
      cycle: isInstallation ? "onetime" : cycle,
      addons: getAddons(),
      mode: "subscribe",
    }),
  });
  const billingData = await billingRes.json().catch(() => ({}));
  if (billingRes.ok && billingData.success && (billingData.orderId || billingData.approveUrl)) {
    return billingData;
  }

  if (!isInstallation) {
    throw new Error(billingData.error || `请求失败 (${billingRes.status})`);
  }

  const orderRes = await fetch("/api/paypal/create-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: INSTALLATION.amount,
      currency: "USD",
      description: INSTALLATION.description,
      email,
      planId: INSTALLATION.planId,
    }),
  });
  const orderData = await orderRes.json().catch(() => ({}));
  if (!orderRes.ok || !orderData.success) {
    throw new Error(orderData.error || billingData.error || "无法创建 PayPal 订单");
  }
  return {
    success: true,
    mode: "payment",
    orderId: orderData.orderId,
    approveUrl: orderData.approveUrl,
    amount: INSTALLATION.amount,
    plan: INSTALLATION.name,
    cycle: "onetime",
    viaFallback: true,
  };
}

async function finalizePayment(orderId, email) {
  const cap = await fetch("/api/paypal/capture-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId }),
  }).then((r) => r.json());
  if (!cap.success) throw new Error(cap.error || "PayPal 扣款失败");

  const act = await fetch("/api/billing/activate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId,
      email,
      planId,
      cycle: isInstallation ? "onetime" : cycle,
    }),
  }).then((r) => r.json());

  if (act.success) {
    localStorage.setItem("subscriber_email", email);
    if (isInstallation) {
      localStorage.setItem("sitp_installation_paid", orderId);
      localStorage.setItem("sitp_pro", "1");
    }
    const extra = isInstallation ? "&installation=1" : "";
    location.href = act.redirectUrl || `/account.html?email=${encodeURIComponent(email)}&welcome=1${extra}`;
    return;
  }

  if (isInstallation && cap.success) {
    localStorage.setItem("subscriber_email", email);
    localStorage.setItem("sitp_installation_paid", orderId);
    localStorage.setItem("sitp_pro", "1");
    location.href = `/account.html?email=${encodeURIComponent(email)}&welcome=1&installation=1&order=${encodeURIComponent(orderId)}`;
    return;
  }

  throw new Error(act.error || "激活失败，请联系 support@yoursite.asia");
}

async function checkout(mode) {
  if (isInstallation && mode === "trial") {
    showError("安装套餐为一次性付款，请使用 PayPal 支付 $599。");
    return;
  }

  const email = document.getElementById("email").value.trim();
  if (!isValidEmail(email)) {
    showError("请填写完整邮箱，例如 name@outlook.com");
    return;
  }
  hideError();
  setPayButtonsBusy(true, mode === "trial" ? "处理中…" : "正在跳转 PayPal…");

  try {
    if (mode === "trial") {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, planId, cycle, addons: getAddons(), mode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || `请求失败 (${res.status})`);
      if (data.redirectUrl) {
        window.location.assign(data.redirectUrl);
        return;
      }
      if (data.subscription) {
        window.location.assign(`/account.html?email=${encodeURIComponent(email)}&welcome=1`);
        return;
      }
      throw new Error("试用开通失败，请稍后重试");
    }

    const data = await createPayPalOrder(email);
    if (data.redirectUrl) {
      window.location.assign(data.redirectUrl);
      return;
    }
    if (data.approveUrl) {
      window.location.assign(data.approveUrl);
      return;
    }
    throw new Error("未获得 PayPal 支付链接，请稍后重试");
  } catch (e) {
    showError(e.message);
    setPayButtonsBusy(false);
  }
}

function hideError() {
  document.getElementById("error-alert").style.display = "none";
}

document.getElementById("btn-trial")?.addEventListener("click", () => checkout("trial"));
document.getElementById("btn-pay").addEventListener("click", () => checkout("subscribe"));

if (params.get("cancelled")) showError("Payment cancelled");

const saved = localStorage.getItem("subscriber_email");
if (saved) document.getElementById("email").value = saved;

function renderMobilePayPalFallback() {
  const container = document.getElementById("paypal-button-container");
  if (!container) return;
  const label = isInstallation ? "前往 PayPal 支付 $599" : "前往 PayPal 付款";
  container.innerHTML = `
    <p class="hint" style="margin-bottom:12px">手机内置浏览器（百度/微信等）无法使用下方黄色 PayPal 按钮，请点这里：</p>
    <button type="button" class="btn btn-primary" id="btn-paypal-mobile" style="width:100%;padding:14px;font-size:16px">${label}</button>
  `;
  document.getElementById("btn-paypal-mobile").addEventListener("click", () => checkout("subscribe"));
}

async function initPayPalButtons() {
  const cfg = await fetch("/api/paypal/config").then((r) => r.json());
  if (!cfg.sdkUrl || !cfg.hasClientId) return;

  const container = document.getElementById("paypal-button-container");
  if (!container) return;

  if (!cfg.readyForPayments) {
    container.innerHTML = `<p class="hint">PayPal 未就绪，请配置 Client Secret 后重启服务。</p>`;
    return;
  }

  if (isRestrictedBrowser()) {
    renderMobilePayPalFallback();
    return;
  }

  try {
    await new Promise((resolve, reject) => {
      if (window.paypal) return resolve();
      const s = document.createElement("script");
      s.src = cfg.sdkUrl;
      s.onload = resolve;
      s.onerror = reject;
      document.body.appendChild(s);
    });

    await window.paypal.Buttons({
      style: { layout: "vertical", color: "gold", shape: "rect", label: "paypal" },
      createOrder: async () => {
        const email = document.getElementById("email").value.trim();
        if (!isValidEmail(email)) throw new Error("请先填写完整邮箱");
        const data = await createPayPalOrder(email);
        if (!data.orderId) throw new Error("未创建订单");
        return data.orderId;
      },
      onApprove: async (data) => {
        const email = document.getElementById("email").value.trim();
        setPayButtonsBusy(true, "确认付款中…");
        try {
          await finalizePayment(data.orderID, email);
        } catch (e) {
          showError(e.message);
          setPayButtonsBusy(false);
        }
      },
      onError: (err) => showError(err?.message || "PayPal 出错"),
      onCancel: () => showError("已取消 PayPal 付款"),
    }).render("#paypal-button-container");
  } catch (e) {
    showError(e.message || "无法加载 PayPal 按钮");
    renderMobilePayPalFallback();
  }
}

checkSiteOnline().then((ok) => {
  if (ok) initPayPalButtons();
});
