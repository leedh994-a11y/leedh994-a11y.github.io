const PLAN_PRICES = {
  starter: { monthly: 39, yearly: 468 },
  growth: { monthly: 79, yearly: 948 },
  scale: { monthly: 259, yearly: 3108 },
};

let billingCycle = "monthly";
let calcPlan = "growth";
let miniPercent = 50;

function initToggle() {
  document.getElementById("cycle-yearly").addEventListener("change", (e) => {
    billingCycle = e.target.checked ? "yearly" : "monthly";
    document.getElementById("cycle-monthly").checked = !e.target.checked;
    document.getElementById("save-badge").style.display = billingCycle === "yearly" ? "inline" : "none";
    updatePrices();
  });
  document.getElementById("cycle-monthly").addEventListener("change", (e) => {
    billingCycle = e.target.checked ? "monthly" : "yearly";
    document.getElementById("cycle-yearly").checked = !e.target.checked;
    document.getElementById("save-badge").style.display = billingCycle === "yearly" ? "inline" : "none";
    updatePrices();
  });
}

function updatePrices() {
  document.querySelectorAll("[data-plan]").forEach((card) => {
    const id = card.dataset.plan;
    const p = PLAN_PRICES[id];
    if (!p) return;
    const perMonth = billingCycle === "yearly" ? Math.round(p.yearly / 12) : p.monthly;
    card.querySelector(".price-amount").textContent = `$${perMonth}`;
    const billed = card.querySelector(".price-billed");
    if (billingCycle === "yearly") {
      const save = Math.round((1 - p.yearly / (p.monthly * 12)) * 100);
      billed.textContent = `按年计费 $${p.yearly} · 省 ${save}%`;
    } else {
      billed.textContent = "按月计费";
    }
    const link = card.querySelector(".checkout-link");
    if (link) link.href = `/checkout.html?plan=${id}&cycle=${billingCycle}`;
  });

  document.querySelectorAll("[data-addon]").forEach((el) => {
    const monthly = 39;
    const yearly = 468;
    el.querySelector(".addon-price").textContent =
      billingCycle === "yearly" ? `+$${Math.round(yearly / 12)}/月` : `+$${monthly}/月`;
  });
}

function initCalculator() {
  document.querySelectorAll(".calc-plans button").forEach((btn) => {
    btn.addEventListener("click", () => {
      calcPlan = btn.dataset.plan;
      document.querySelectorAll(".calc-plans button").forEach((b) => b.classList.toggle("active", b === btn));
      updateCalculator();
    });
  });
  document.querySelector(".calc-plans button[data-plan='growth']")?.classList.add("active");

  const slider = document.getElementById("model-slider");
  slider.addEventListener("input", () => {
    miniPercent = Number(slider.value);
    document.getElementById("slider-label").textContent = `${100 - miniPercent}% GPT-4.1 · ${miniPercent}% GPT-4.1-mini`;
    updateCalculator();
  });
  updateCalculator();
}

async function updateCalculator() {
  const res = await fetch(`/api/billing/calculator?planId=${calcPlan}&miniPercent=${miniPercent}`);
  const { quota } = await res.json();
  document.getElementById("calc-gpt41").textContent = quota.gpt41.toLocaleString();
  document.getElementById("calc-mini").textContent = quota.gpt41mini.toLocaleString();
  document.getElementById("calc-total").textContent = quota.total.toLocaleString();
  const p = PLAN_PRICES[calcPlan];
  const price = billingCycle === "yearly" ? p.yearly : p.monthly;
  document.getElementById("calc-cta").href = `/checkout.html?plan=${calcPlan}&cycle=${billingCycle}`;
  document.getElementById("calc-cta-price").textContent =
    billingCycle === "yearly" ? `$${price}/年` : `$${price}/月`;
}

initToggle();
initCalculator();
updatePrices();
