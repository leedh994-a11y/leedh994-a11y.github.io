/*
 * Sitp GPT — in-browser feature demo player.
 * Turns any .video-placeholder[data-demo] element into an animated,
 * video-style walkthrough of an AI support conversation. Runs 100%
 * in the browser — no video hosting or server required.
 */
(function () {
  var DEMOS = {
    support: [
      ["user", "Hi! Where is my order #10382?"],
      ["bot", "Let me check that for you… 📦 Order #10382 shipped yesterday via DHL and arrives Thursday. Tracking: DH829-33-XK."],
      ["user", "Can I still change the delivery address?"],
      ["bot", "Yes — address changes are possible until the package reaches the local hub. I've opened a change request; just reply with the new address."],
      ["note", "⚡ AI answered instantly, 24/7 — no human agent needed."]
    ],
    training: [
      ["user", "Train on https://mystore.com (100 pages) + catalog.pdf"],
      ["bot", "✅ Crawled 100 pages · Parsed catalog.pdf · Knowledge base built in 42s. Your AI now answers questions about products, shipping and returns."],
      ["user", "What happens when I update my website?"],
      ["bot", "On paid plans I automatically re-crawl and retrain when your content changes — your answers never go stale."],
      ["note", "⚡ Auto-sync keeps the AI up to date with zero manual work."]
    ],
    workflow: [
      ["user", "I want a refund but the return window shows an error."],
      ["bot", "Sorry about that! This needs a human. I've escalated to the support team on Slack with your chat history. Meanwhile, may I have your email so we follow up?"],
      ["user", "sure — anna@example.com"],
      ["bot", "✅ Saved. An agent will reach out within 1 hour. Your ticket: #SUP-2291."],
      ["note", "⚡ Smart escalation + email capture: AI handles 80%, humans get context for the rest."]
    ],
    analytics: [
      ["user", "Show me this week's support analytics."],
      ["bot", "📊 Weekly report: 612 questions answered · 81% resolved by AI · Top topics: shipping (34%), returns (21%), sizing (12%) · 47 emails captured · CSAT 4.7/5."],
      ["user", "Email that report to my team every Monday."],
      ["bot", "✅ Done — weekly enterprise analytics reports will be emailed every Monday at 9:00."],
      ["note", "⚡ Enterprise analytics reports show exactly what customers ask about."]
    ]
  };

  function play(placeholder) {
    var demo = DEMOS[placeholder.getAttribute("data-demo")] || DEMOS.support;
    var container = placeholder.parentElement;
    var stage = document.createElement("div");
    stage.style.cssText = "aspect-ratio:16/9;background:#fff;padding:16px;overflow-y:auto;font-size:15px;";
    container.replaceChild(stage, placeholder);

    var i = 0;
    function next() {
      if (i >= demo.length) {
        var replay = document.createElement("button");
        replay.textContent = "↻ Replay demo";
        replay.style.cssText = "margin:12px auto;display:block;background:#ff5a5f;color:#fff;border:none;border-radius:20px;padding:8px 20px;cursor:pointer;";
        replay.onclick = function () { container.replaceChild(placeholder, stage); placeholder.onclick = function () { play(placeholder); }; };
        stage.appendChild(replay);
        return;
      }
      var kind = demo[i][0], text = demo[i][1];
      var div = document.createElement("div");
      if (kind === "user") {
        div.style.cssText = "background:#dcf8c6;margin:8px 0 8px auto;max-width:75%;padding:10px 14px;border-radius:15px;text-align:right;";
      } else if (kind === "bot") {
        div.style.cssText = "background:#f1f1f1;margin:8px auto 8px 0;max-width:75%;padding:10px 14px;border-radius:15px;";
      } else {
        div.style.cssText = "background:#000;color:#fff;margin:14px auto 4px;max-width:90%;padding:10px 14px;border-radius:10px;text-align:center;font-weight:bold;";
      }
      div.textContent = text;
      stage.appendChild(div);
      stage.scrollTop = stage.scrollHeight;
      i++;
      setTimeout(next, kind === "note" ? 400 : 1100);
    }
    next();
  }

  function init() {
    var nodes = document.querySelectorAll(".video-placeholder[data-demo]");
    for (var j = 0; j < nodes.length; j++) {
      (function (node) { node.onclick = function () { play(node); }; })(nodes[j]);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
