let cycle = "monthly";
let plans = [];

async function load() {
  const plansRes = await fetch("/api/billing/plans");
  const plansData = await plansRes.json();
  plans = plansData.plans || [];
  render();
}

function formatPrice(plan) {
  const usd = plan.priceUsd[cycle];
  return {
    usd: `$${usd}`,
    per: cycle === "yearly" ? "/yr" : "/mo",
  };
}

function render() {
  const grid = document.getElementById("pricing-grid");
  if (!plans.length) {
    grid.innerHTML = "<p>No plans available</p>";
    return;
  }

  grid.innerHTML = plans.map((plan) => {
    const p = formatPrice(plan);
    const featured = plan.id === "pro" ? " featured" : "";
    return `
      <article class="pricing-card${featured}">
        <h3>${plan.name}</h3>
        <p style="font-size:14px;color:var(--muted);margin:0">${plan.description}</p>
        <div class="price">${p.usd}<span>${p.per}</span></div>
        <ul>${plan.features.map((f) => `<li>${f}</li>`).join("")}</ul>
        <a href="/checkout.html?plan=${plan.id}&cycle=${cycle}" class="btn-primary" style="text-align:center">Subscribe</a>
      </article>
    `;
  }).join("");
}

document.querySelectorAll(".billing-toggle button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".billing-toggle button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    cycle = btn.dataset.cycle;
    render();
  });
});

load();
