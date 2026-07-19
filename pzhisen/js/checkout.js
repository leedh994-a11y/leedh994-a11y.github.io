const params = new URLSearchParams(location.search);
const planId = params.get("plan") || "pro";
const cycle = params.get("cycle") || "monthly";

let billingConfig = null;
let plan = null;

function showError(msg) {
  const el = document.getElementById("checkout-error");
  el.hidden = !msg;
  el.textContent = msg || "";
}

function setBusy(busy) {
  document.getElementById("btn-pay").disabled = busy;
  document.getElementById("btn-pay").textContent = busy ? "Processing…" : "Pay with PayPal";
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
  document.getElementById("pay-hint").textContent =
    billingConfig.noteEn || "Pay securely with PayPal.";

  if (!billingConfig.providers?.paypal) {
    showError("PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET on the server.");
    document.getElementById("btn-pay").disabled = true;
    return;
  }

  if (billingConfig.paypal?.sdkUrl) {
    loadPayPalSdk(billingConfig.paypal.sdkUrl);
  }
}

function renderSummary() {
  const usd = plan.priceUsd[cycle];
  document.getElementById("checkout-title").textContent = `Subscribe to ${plan.name}`;
  document.getElementById("checkout-subtitle").textContent = plan.description;
  document.getElementById("sum-plan").textContent = plan.name;
  document.getElementById("sum-cycle").textContent = cycle === "yearly" ? "Yearly" : "Monthly";
  document.getElementById("sum-total").textContent = `$${usd} USD`;
}

function loadPayPalSdk(url) {
  if (document.querySelector("script[data-paypal]")) return;
  const s = document.createElement("script");
  s.src = url;
  s.dataset.paypal = "1";
  s.onload = initPayPalButtons;
  document.head.appendChild(s);
}

function initPayPalButtons() {
  if (!window.paypal) return;
  const container = document.getElementById("paypal-button-container");
  container.innerHTML = "";
  window.paypal.Buttons({
    style: { layout: "vertical", color: "gold", shape: "rect" },
    createOrder: async () => {
      const email = document.getElementById("checkout-email").value.trim();
      if (!email.includes("@")) throw new Error("Please enter a valid email");
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
      else throw new Error(cap.error || "Payment failed");
    },
    onError: (err) => showError(err?.message || "PayPal error"),
  }).render("#paypal-button-container");
}

async function startCheckout(email) {
  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, planId, cycle, provider: "paypal" }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Could not create order");
  return data;
}

async function pay() {
  showError("");
  const email = document.getElementById("checkout-email").value.trim();
  if (!email.includes("@")) {
    showError("Please enter a valid email");
    return;
  }

  setBusy(true);
  try {
    const data = await startCheckout(email);
    if (data.approveUrl) {
      location.href = data.approveUrl;
      return;
    }
    throw new Error("No PayPal payment link received");
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
