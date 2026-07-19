let plans = [];

async function load() {
  const res = await fetch("/api/billing/plans");
  const data = await res.json();
  plans = data.plans || [];
  render();
}

function render() {
  const grid = document.getElementById("pricing-grid");
  if (!plans.length) {
    grid.innerHTML = "<p>暂无方案</p>";
    return;
  }

  grid.innerHTML = plans.map((plan) => `
    <article class="pricing-card${plan.featured ? " featured" : ""}">
      ${plan.featured ? '<span class="badge-popular">推荐</span>' : ""}
      <h3>${plan.nameZh || plan.name} · ${plan.cycle === "yearly" ? "年付" : "月付"}</h3>
      <p style="font-size:14px;color:var(--muted);margin:0">${plan.descriptionZh || plan.description}</p>
      <div class="price">${plan.priceLabelCny || plan.priceLabel}<span>${plan.periodLabelZh || plan.periodLabel}</span></div>
      <p style="font-size:13px;color:var(--muted);margin:0 0 8px">海外 ${plan.priceLabel}${plan.periodLabel} · 银行卡 ¥${plan.amountCny}</p>
      ${plan.savingsZh ? `<p style="font-size:13px;color:#16a34a;margin:0 0 8px">${plan.savingsZh}</p>` : ""}
      <ul>${(plan.featuresZh || plan.features).map((f) => `<li>${f}</li>`).join("")}</ul>
      <a href="/checkout.html?plan=pro&cycle=${plan.cycle}" class="btn-primary" style="text-align:center;display:block">
        订阅 ${plan.priceLabelCny || plan.priceLabel}${plan.periodLabelZh || plan.periodLabel}
      </a>
    </article>
  `).join("");
}

const params = new URLSearchParams(location.search);
const emailFromUrl = params.get("email");
if (emailFromUrl) sessionStorage.setItem("pzhisen_checkout_email", emailFromUrl);

load();
