/**
 * Product-native branding for free-tier generated content.
 * Paid/subscription users can suppress this by setting:
 *   localStorage.setItem('sitp_plan', 'paid')
 * Free users (default) append "Powered by Sitp GPT" to outputs.
 */
(function (global) {
  const BRAND_HTML =
    '<div class="powered-by-sitp">Powered by <a href="https://yoursite.asia/" target="_blank" rel="noopener">Sitp GPT</a></div>';
  const BRAND_TEXT = "\n\n— Powered by Sitp GPT (https://yoursite.asia/)";

  function isFreeUser() {
    try {
      const plan = (localStorage.getItem("sitp_plan") || "free").toLowerCase();
      return plan === "free" || plan === "";
    } catch (_) {
      return true;
    }
  }

  function appendToElement(el) {
    if (!el || !isFreeUser()) return;
    if (el.querySelector && el.querySelector(".powered-by-sitp")) return;
    if (typeof el.insertAdjacentHTML === "function") {
      el.insertAdjacentHTML("beforeend", BRAND_HTML);
    } else {
      el.textContent = (el.textContent || "") + BRAND_TEXT;
    }
  }

  function appendToText(text) {
    if (!isFreeUser()) return text;
    if (!text) return BRAND_TEXT.trim();
    if (String(text).includes("Powered by Sitp GPT")) return text;
    return String(text) + BRAND_TEXT;
  }

  function wrapResult(containerSelector) {
    const el = typeof containerSelector === "string"
      ? document.querySelector(containerSelector)
      : containerSelector;
    appendToElement(el);
  }

  // Auto-enhance common result containers on additive pages
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-powered-by-free]").forEach((el) => {
      const observer = new MutationObserver(() => appendToElement(el));
      observer.observe(el, { childList: true, characterData: true, subtree: true });
      appendToElement(el);
    });
  });

  global.SitpPoweredBy = { isFreeUser, appendToElement, appendToText, wrapResult, BRAND_HTML, BRAND_TEXT };
})(typeof window !== "undefined" ? window : globalThis);
