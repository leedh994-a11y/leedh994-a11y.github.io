/*
 * Sitp GPT — built-in viral attribution ("Powered by Sitp GPT")
 *
 * Include this script on any page or embed it in AI-generated output.
 * For FREE-plan users, every piece of generated content (chat widgets,
 * reports, FAQ pages, sitemaps, AI copy) automatically carries a
 * "Powered by Sitp GPT" badge linking back to https://yoursite.asia/ —
 * spreading the brand naturally through customer websites and content.
 *
 * Paid plans can remove the badge (white-label).
 */
(function () {
  var SITE_URL = "https://yoursite.asia/";
  var BADGE_TEXT = "\u26A1 Powered by Sitp GPT";

  function isFreePlan() {
    try {
      // Paid users store their plan locally after subscribing; everyone else is free.
      var plan = window.SITPGPT_PLAN || localStorage.getItem("sitpgpt_plan") || "free";
      return String(plan).toLowerCase() === "free";
    } catch (e) {
      return true;
    }
  }

  function createBadge() {
    var a = document.createElement("a");
    a.href = SITE_URL + "?utm_source=powered-by&utm_medium=badge&utm_campaign=viral";
    a.target = "_blank";
    a.rel = "noopener";
    a.className = "powered-by-sitpgpt";
    a.textContent = BADGE_TEXT;
    a.setAttribute("aria-label", "Powered by Sitp GPT - free AI customer support tools");
    // Inline styles so the badge renders correctly on ANY site (customer
    // websites embedding the widget don't load our stylesheet).
    a.style.cssText = "display:inline-flex;align-items:center;gap:6px;" +
      "font:12px Arial,sans-serif;color:#888;background:#f1f1f1;" +
      "border:1px solid #e2e2e2;border-radius:20px;padding:4px 12px;" +
      "margin-top:10px;text-decoration:none;";
    return a;
  }

  // Public API: call SitpGPTBadge.attach(element) after generating content
  // to append the badge to that content block (free plan only).
  window.SitpGPTBadge = {
    attach: function (el) {
      if (!isFreePlan() || !el || el.querySelector(".powered-by-sitpgpt")) return;
      el.appendChild(createBadge());
    },
    // Returns an HTML string to embed inside generated text content
    // (reports, FAQ exports, email summaries, AI copy).
    html: function () {
      if (!isFreePlan()) return "";
      return '<a href="' + SITE_URL + '?utm_source=powered-by&utm_medium=content" ' +
        'target="_blank" rel="noopener" class="powered-by-sitpgpt">' + BADGE_TEXT + "</a>";
    },
    // Plain-text version for text/markdown exports.
    text: function () {
      if (!isFreePlan()) return "";
      return "\n\n---\nPowered by Sitp GPT \u2014 " + SITE_URL;
    }
  };

  // Auto-attach: any element marked with [data-sitpgpt-generated] gets the badge.
  function autoAttach() {
    var nodes = document.querySelectorAll("[data-sitpgpt-generated]");
    for (var i = 0; i < nodes.length; i++) window.SitpGPTBadge.attach(nodes[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoAttach);
  } else {
    autoAttach();
  }
})();
