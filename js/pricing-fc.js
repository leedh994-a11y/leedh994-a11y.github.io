/** 定价页：加载 FC 3.0 ComfyUI 链接 */
(async function initFcLinks() {
  const hint = document.getElementById("fc-url-hint");
  const pricingA = document.getElementById("fc-pricing-link");
  const appA = document.getElementById("fc-app-link");
  if (!pricingA) return;

  try {
    const data = await fetch("/api/fc", { cache: "no-store" }).then((r) => r.json());
    if (!data.success) return;
    pricingA.href = data.pricing;
    appA.href = data.comfyui;
    if (hint) {
      hint.textContent = `FC 直连：${data.pricing}`;
    }
  } catch {
    if (hint) hint.textContent = "FC 配置加载失败，请确认服务已启动。";
  }
})();
