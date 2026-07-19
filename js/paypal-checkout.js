let paypalConfig = null;

async function loadConfig() {
  const res = await fetch("/api/paypal/config");
  paypalConfig = await res.json();
  const badge = document.getElementById("config-badge");
  if (paypalConfig.configured) {
    badge.textContent = `${paypalConfig.environment} · 已配置`;
    badge.className = "config-badge ok";
    if (paypalConfig.sdkUrl) loadPayPalSdk(paypalConfig.sdkUrl);
  } else {
    badge.textContent = "未配置";
    badge.className = "config-badge warn";
    showError("PayPal 未配置，请前往 <a href='/paypal-config.html'>配置页面</a>");
  }
}

function loadPayPalSdk(url) {
  if (document.querySelector(`script[src*="paypal.com/sdk"]`)) return;
  const script = document.createElement("script");
  script.src = url;
  script.onload = initPayPalButtons;
  document.body.appendChild(script);
}

function getAmount() {
  return Number(document.getElementById("amount").value).toFixed(2);
}

function getDescription() {
  return document.getElementById("description").value || "Sitp GPT Payment";
}

async function apiCreateOrder() {
  const res = await fetch("/api/paypal/create-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: getAmount(), currency: "USD", description: getDescription() }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data;
}

function showOutput(obj) {
  document.getElementById("order-result").classList.add("visible");
  document.getElementById("order-output").textContent = JSON.stringify(obj, null, 2);
}

function showError(msg) {
  const el = document.getElementById("error-alert");
  el.innerHTML = msg;
  el.style.display = "block";
}

function hideError() {
  document.getElementById("error-alert").style.display = "none";
}

function initPayPalButtons() {
  if (!window.paypal || !paypalConfig?.clientId) return;
  const container = document.getElementById("paypal-button-container");
  container.innerHTML = "";

  window.paypal.Buttons({
    createOrder: async () => {
      const data = await apiCreateOrder();
      showOutput(data);
      return data.orderId;
    },
    onApprove: async (data) => {
      const res = await fetch("/api/paypal/capture-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: data.orderID }),
      });
      const result = await res.json();
      if (result.success) {
        showOutput(result);
        alert("支付成功！");
      } else {
        showError(result.error);
      }
    },
    onError: (err) => showError(err.message || String(err)),
  }).render("#paypal-button-container");
}

document.querySelectorAll(".amount-presets button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.getElementById("amount").value = Number(btn.dataset.amount).toFixed(2);
    document.querySelectorAll(".amount-presets button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  });
});
document.querySelector(".amount-presets button[data-amount='5']")?.classList.add("active");

document.getElementById("pay-link-btn").addEventListener("click", async () => {
  hideError();
  try {
    const data = await apiCreateOrder();
    showOutput(data);
    if (data.approveUrl) window.location.href = data.approveUrl;
    else showError("未获取到 PayPal 付款链接");
  } catch (e) {
    showError(e.message);
  }
});

document.getElementById("create-order-btn").addEventListener("click", async () => {
  hideError();
  try {
    const data = await apiCreateOrder();
    showOutput(data);
  } catch (e) {
    showError(e.message);
  }
});

if (new URLSearchParams(location.search).get("cancelled")) {
  showError("支付已取消");
}

loadConfig();
