(function initDailyQuotaTicker() {
  const DAILY_LIMIT = 50;
  const REMAINING = 2;
  const appliedEl = document.getElementById("quota-applied-count");
  const remainingEl = document.getElementById("quota-remaining-count");
  const track = document.getElementById("quota-marquee-track");
  if (!appliedEl || !remainingEl || !track) return;

  const applied = DAILY_LIMIT - REMAINING;
  appliedEl.textContent = String(applied);
  remainingEl.textContent = String(REMAINING);

  const applicants = [
    "🇺🇸 Alex · New York just applied",
    "🇬🇧 Emma · London just applied",
    "🇩🇪 Lukas · Berlin just applied",
    "🇫🇷 Camille · Paris just applied",
    "🇯🇵 Yuki · Tokyo just applied",
    "🇰🇷 Min-jun · Seoul just applied",
    "🇸🇬 Wei · Singapore just applied",
    "🇦🇺 Olivia · Sydney just applied",
    "🇨🇦 Noah · Toronto just applied",
    "🇧🇷 Lucas · São Paulo just applied",
    "🇮🇳 Aarav · Mumbai just applied",
    "🇦🇪 Omar · Dubai just applied",
    "🇪🇸 Sofia · Madrid just applied",
    "🇮🇹 Marco · Milan just applied",
    "🇳🇱 Lars · Amsterdam just applied",
    "🇨🇳 张先生 · 上海 刚刚申请",
    "🇭🇰 Michelle · Hong Kong just applied",
    "🇹🇼 Chen · Taipei just applied",
    "🇲🇽 Diego · Mexico City just applied",
    "🇿🇦 Thabo · Johannesburg just applied",
  ];

  const items = [...applicants, ...applicants];
  track.innerHTML = items.map((t) => `<span class="quota-marquee-item">${t}</span>`).join("");
})();
