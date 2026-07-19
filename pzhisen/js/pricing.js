let cycle = "monthly";
let plans = [];
let billingConfig = null;

const CYCLE_LABELS = { monthly: "月付", yearly: "年付" };

async function load() {
  const [plansRes, cfgRes] = await Promise.all([
    fetch("/api/billing/plans"),
    fetch("/api/billing/config"),
  ]);
  const plansData = await plansRes.json();
  billingConfig = await cfgRes.json();
  plans = plansData.plans || [];
  render();
}

function formatPrice(plan) {
  const cny = plan.priceCny[cycle];
  const usd = plan.priceUsd[cycle];
  return {
    cny: `¥${cny}`,
    usd: `$${usd}`,
    per: cycle === "yearly" ? "/年" : "/月",
  };
}

function render() {
  const grid = document.getElementById("pricing-grid");
  if (!plans.length) {
    grid.innerHTML = "<p>暂无方案</p>";
    return;
  }

  grid.innerHTML = plans.map((plan, i) => {
    const p = formatPrice(plan);
    const featured = plan.id === "pro" ? " featured" : "";
    return `
      <article class="pricing-card${featured}">
        <h3>${plan.nameZh || plan.name}</h3>
        <p style="font-size:14px;color:var(--muted);margin:0">${plan.descriptionZh || plan.description}</p>
        <div class="price">${p.cny}<span>${p.per}</span></div>
        <p style="font-size:13px;color:var(--muted);margin:0 0 8px">海外 ${p.usd}${p.per}</p>
        <ul>${(plan.featuresZh || plan.features).map((f) => `<li>${f}</li>`).join("")}</ul>
        <a href="/checkout.html?plan=${plan.id}&cycle=${cycle}" class="btn-primary" style="text-align:center">立即订阅</a>
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
