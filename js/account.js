const params = new URLSearchParams(location.search);
const emailInput = document.getElementById("lookup-email");
if (params.get("email")) emailInput.value = params.get("email");
if (localStorage.getItem("subscriber_email")) emailInput.value = localStorage.getItem("subscriber_email");

if (params.get("welcome")) {
  setTimeout(() => loadSubscription(), 300);
}

if (params.get("installation") === "1" || localStorage.getItem("sitp_installation_paid")) {
  showInstallationSuccess(params.get("order") || localStorage.getItem("sitp_installation_paid"));
}

document.getElementById("btn-lookup").addEventListener("click", loadSubscription);

function showInstallationSuccess(orderId) {
  const card = document.getElementById("account-card");
  const none = document.getElementById("no-sub");
  none.style.display = "none";
  card.style.display = "block";

  const statusEl = document.getElementById("sub-status");
  statusEl.textContent = "paid";
  statusEl.className = "status-pill active";

  document.getElementById("sub-plan").textContent = "AI Installation Service";
  document.getElementById("sub-cycle").textContent = "One-time · $599";
  document.getElementById("sub-trial").textContent =
    "Thank you! Our team will contact you within 1 business day to schedule setup.";
  document.getElementById("sub-period").textContent = orderId
    ? `PayPal order: ${orderId}`
    : "";
  document.getElementById("sub-access").textContent =
    "Includes: AI training, widget install, FAQ setup, workflow optimization, and all Pro features during setup.";
  document.getElementById("btn-cancel").style.display = "none";
  document.getElementById("btn-upgrade").style.display = "none";
}

async function loadSubscription() {
  const email = emailInput.value.trim();
  if (!email.includes("@")) return alert("Enter valid email");
  localStorage.setItem("subscriber_email", email);

  const res = await fetch(`/api/billing/subscription?email=${encodeURIComponent(email)}`);
  const data = await res.json();
  const card = document.getElementById("account-card");
  const none = document.getElementById("no-sub");

  if (!data.subscription) {
    card.style.display = "none";
    none.style.display = "block";
    return;
  }

  none.style.display = "none";
  card.style.display = "block";
  const sub = data.subscription;
  const statusEl = document.getElementById("sub-status");
  statusEl.textContent = sub.status;
  statusEl.className = `status-pill ${sub.status}`;

  document.getElementById("sub-plan").textContent =
    sub.planId === "installation"
      ? "AI Installation Service"
      : sub.planId.charAt(0).toUpperCase() + sub.planId.slice(1);
  document.getElementById("sub-cycle").textContent =
    sub.planId === "installation"
      ? "One-time · $599"
      : sub.cycle === "yearly"
        ? "Yearly billing"
        : "Monthly billing";

  if (sub.status === "trialing" && sub.trialEndsAt) {
    document.getElementById("sub-trial").textContent = `Trial ends: ${new Date(sub.trialEndsAt).toLocaleDateString()}`;
    document.getElementById("btn-upgrade").style.display = "inline-flex";
    const p = sub.planId;
    const c = sub.cycle;
    document.getElementById("btn-upgrade").href = `/checkout.html?plan=${p}&cycle=${c}`;
  } else {
    document.getElementById("sub-trial").textContent = "";
    document.getElementById("btn-upgrade").style.display = "none";
  }

  if (sub.currentPeriodEnd) {
    document.getElementById("sub-period").textContent = `Current period ends: ${new Date(sub.currentPeriodEnd).toLocaleDateString()}`;
  }

  document.getElementById("sub-access").textContent = data.access?.allowed
    ? "You have access to premium tools."
    : "Subscription inactive or expired.";

  document.getElementById("btn-cancel").onclick = async () => {
    if (!confirm("Cancel subscription?")) return;
    const r = await fetch("/api/billing/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, subscriptionId: sub.id }),
    });
    const d = await r.json();
    if (d.success) loadSubscription();
    else alert(d.error);
  };
}

if (emailInput.value) loadSubscription();
