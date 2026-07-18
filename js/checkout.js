const params = new URLSearchParams(location.search);
const planId = params.get("plan") || "growth";
const cycle = params.get("cycle") || "monthly";

const PRICES = {
  starter: { monthly: 39, yearly: 468, name: "Starter" },
  growth: { monthly: 79, yearly: 948, name: "Growth" },
  scale: { monthly: 259, yearly: 3108, name: "Scale" },
};

const plan = PRICES[planId];
if (!plan) location.href = "/pricing.html";

document.getElementById("checkout-title").textContent = `Subscribe to ${plan.name}`;
document.getElementById("checkout-subtitle").textContent =
  cycle === "yearly" ? `Billed yearly · save ~40%` : `Billed monthly`;
document.getElementById("sum-plan").textContent = plan.name;
document.getElementById("sum-cycle").textContent = cycle === "yearly" ? "Yearly" : "Monthly";

function getAddons() {
  const addons = [];
  if (document.getElementById("addon-branding").checked) addons.push("remove-branding");
  if (document.getElementById("addon-messages").checked) addons.push("extra-messages");
  return addons;
}

function getTotal() {
  let total = cycle === "yearly" ? plan.yearly : plan.monthly;
  if (document.getElementById("addon-branding").checked) total += cycle === "yearly" ? 468 : 39;
  if (document.getElementById("addon-messages").checked) total += cycle === "yearly" ? 468 : 39;
  return total;
}

function updateSummary() {
  document.getElementById("sum-total").textContent = `$${getTotal()} (after trial)`;
}

document.getElementById("addon-branding").addEventListener("change", updateSummary);
document.getElementById("addon-messages").addEventListener("change", updateSummary);
updateSummary();

function translatePayPalError(msg) {
  const m = String(msg || "");
  if (/merchant account is restricted/i.test(m)) {
    return "PayPal 商户账户受限，暂时无法收款。请登录 PayPal 完成企业认证并解除限制：\nhttps://www.paypal.com/businessmanage/account/aboutBusiness\n\n认证完成前，只能使用「7 天免费试用」（不经过 PayPal）。";
  }
  if (/tunnel|503|502|unavailable/i.test(m)) {
    return "公网隧道未连接，请稍后再试或联系站长保持 Tunnel 窗口运行。";
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

/** 手机 / 百度 / 微信等内置浏览器常拦截 PayPal 弹窗，需用整页跳转 */
function isRestrictedBrowser() {
  const ua = navigator.userAgent || "";
  return /Mobile|Android|iPhone|iPad|iPod|Baidu|baiduboxapp|MicroMessenger|WeChat|QQ\//i.test(ua);
}

async function checkSiteOnline() {
  try {
    const r = await fetch("/api/health", { cache: "no-store" });
    if (!r.ok) throw new Error("offline");
  } catch {
    showError(
      "支付服务暂时不可用（503 隧道未连接）。请让站长保持电脑上的 Sitp GPT Tunnel 窗口运行，稍后再试。"
    );
    document.getElementById("btn-trial").disabled = true;
    document.getElementById("btn-pay").disabled = true;
    return false;
  }
  return true;
}

function setPayButtonsBusy(busy, label) {
  for (const id of ["btn-trial", "btn-pay", "btn-paypal-mobile"]) {
    const b = document.getElementById(id);
    if (!b) continue;
    b.disabled = busy;
    if (busy && label) b.textContent = label;
  }
  if (!busy) {
    const trial = document.getElementById("btn-trial");
    const pay = document.getElementById("btn-pay");
    const mob = document.getElementById("btn-paypal-mobile");
    if (trial) trial.textContent = "Start 7-day free trial";
    if (pay) pay.textContent = "Subscribe now (PayPal)";
    if (mob) mob.textContent = "前往 PayPal 付款";
  }
}

async function checkout(mode) {
  const email = document.getElementById("email").value.trim();
  if (!isValidEmail(email)) {
    showError("请填写完整邮箱，例如 name@outlook.com");
    return;
  }
  hideError();
  setPayButtonsBusy(true, mode === "trial" ? "处理中…" : "正在跳转 PayPal…");

  try {
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
    if (data.approveUrl) {
      window.location.assign(data.approveUrl);
      return;
    }
    if (data.subscription) {
      window.location.assign(`/account.html?email=${encodeURIComponent(email)}&welcome=1`);
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

document.getElementById("btn-trial").addEventListener("click", () => checkout("trial"));
document.getElementById("btn-pay").addEventListener("click", () => checkout("subscribe"));

if (params.get("cancelled")) showError("Payment cancelled");

const saved = localStorage.getItem("subscriber_email");
if (saved) document.getElementById("email").value = saved;

function renderMobilePayPalFallback() {
  const container = document.getElementById("paypal-button-container");
  if (!container) return;
  container.innerHTML = `
    <p class="hint" style="margin-bottom:12px">手机内置浏览器（百度/微信等）无法使用下方黄色 PayPal 按钮，请点这里：</p>
    <button type="button" class="btn btn-primary" id="btn-paypal-mobile" style="width:100%;padding:14px;font-size:16px">前往 PayPal 付款</button>
    <p class="hint" style="margin-top:8px">或使用 Safari / Chrome 打开本站后再试黄色按钮。</p>
  `;
  document.getElementById("btn-paypal-mobile").addEventListener("click", () => checkout("subscribe"));
}

async function initPayPalButtons() {
  const cfg = await fetch("/api/paypal/config").then((r) => r.json());
  if (!cfg.sdkUrl || !cfg.hasClientId) return;

  const container = document.getElementById("paypal-button-container");
  if (!container) return;

  if (!cfg.readyForPayments) {
    container.innerHTML = `<p class="hint">PayPal Client ID 已配置。请打开 <a href="https://developer.paypal.com/dashboard/applications/live" target="_blank" rel="noopener">PayPal Live 应用</a>，复制 <strong>Secret</strong> 后在本机运行：<br><code>.\setup-paypal.ps1 -ClientSecret "你的Secret" -Environment live -Restart</code></p>`;
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
        if (!isValidEmail(email)) throw new Error("请先填写完整邮箱（含 .com 等后缀）");
        const res = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            planId,
            cycle,
            addons: getAddons(),
            mode: "subscribe",
          }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "创建订单失败");
        if (!data.orderId) throw new Error("未创建订单");
        return data.orderId;
      },
      onApprove: async (data) => {
        const email = document.getElementById("email").value.trim();
        const cap = await fetch("/api/paypal/capture-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: data.orderID }),
        }).then((r) => r.json());
        if (!cap.success) throw new Error(cap.error);
        const act = await fetch("/api/billing/activate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: data.orderID, email, planId, cycle }),
        }).then((r) => r.json());
        if (act.success) {
          localStorage.setItem("subscriber_email", email);
          location.href = `/account.html?email=${encodeURIComponent(email)}&welcome=1`;
        } else {
          showError(act.error);
        }
      },
      onError: (err) => showError(err?.message || "PayPal 出错，请使用上方「Subscribe now」按钮"),
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
