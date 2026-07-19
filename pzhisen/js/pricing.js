let plans = [];

async function load() {
  const res = await fetch("/api/billing/plans");
  const data = await res.json();
  plans = data.plans || [];
  render();
}

function render() {
  const grid = document.getElementById("pricing-grid");
  const plan = plans[0];
  if (!plan) {
    grid.innerHTML = "<p>暂无方案</p>";
    return;
  }

  grid.innerHTML = `
    <article class="pricing-card featured" style="max-width:480px;margin:0 auto;grid-column:1/-1">
      <h3>${plan.nameZh || plan.name}</h3>
      <p style="font-size:14px;color:var(--muted);margin:0">${plan.descriptionZh || plan.description}</p>
      <div class="price">¥0<span> / 永久</span></div>
      <p style="font-size:13px;color:var(--muted);margin:0 0 8px">$0 forever · 全球免费</p>
      <ul>${(plan.featuresZh || plan.features).map((f) => `<li>${f}</li>`).join("")}</ul>
      <a href="/#signin" class="btn-primary" style="text-align:center;display:block">免费开始使用</a>
    </article>
  `;
}

load();
