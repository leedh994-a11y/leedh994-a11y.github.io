let plans = [];

async function load() {
  const res = await fetch("/api/billing/plans");
  const data = await res.json();
  plans = data.plans || [];
  render();
}

function cycleLabel(cycle) {
  return cycle === "annual" ? "年" : "月";
}

function render() {
  const grid = document.getElementById("pricing-grid");
  const plan = plans.find((p) => p.id === "pro") || plans[0];
  if (!plan) {
    grid.innerHTML = "<p>暂无方案</p>";
    return;
  }

  const cycles = [
    {
      id: "monthly",
      title: "月付套餐",
      priceCny: plan.priceCny?.monthly,
      priceUsd: plan.priceUsd?.monthly,
      badge: null,
      extra: "按 30 天计费，到期续费",
    },
    {
      id: "annual",
      title: "年付套餐",
      priceCny: plan.priceCny?.annual,
      priceUsd: plan.priceUsd?.annual,
      badge: "推荐",
      extra: "按 365 天计费，省约 16%",
    },
  ];

  grid.innerHTML = cycles
    .map((c) => {
      const featured = c.id === "annual" ? " featured" : "";
      return `
    <article class="pricing-card${featured}">
      ${c.badge ? `<span class="badge-popular">${c.badge}</span>` : ""}
      <h3>${c.title}</h3>
      <p style="font-size:14px;color:var(--muted);margin:0">${plan.descriptionZh || plan.description}</p>
      <div class="price">$${c.priceUsd}<span> / ${cycleLabel(c.id)}</span></div>
      <p style="font-size:13px;color:var(--muted);margin:0 0 4px">中国内地银行卡 ¥${c.priceCny} / ${cycleLabel(c.id)}</p>
      <p style="font-size:13px;color:var(--muted);margin:0 0 8px">${c.extra}</p>
      <ul>${(plan.featuresZh || plan.features).map((f) => `<li>${f}</li>`).join("")}</ul>
      <a href="/login.html?register=1&plan=pro&cycle=${c.id}" class="btn-primary" style="text-align:center;display:block">
        注册并订阅
      </a>
      <a href="/checkout.html?plan=pro&cycle=${c.id}" class="btn-primary" style="text-align:center;display:block;margin-top:8px;background:transparent;color:var(--heading);border:1px solid var(--border)">
        已有账号 · 去支付
      </a>
    </article>
  `;
    })
    .join("");
}

const params = new URLSearchParams(location.search);
const emailFromUrl = params.get("email");
if (emailFromUrl) sessionStorage.setItem("pzhisen_checkout_email", emailFromUrl);

load();
