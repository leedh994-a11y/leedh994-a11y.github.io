/* Shared chrome for additive Sitp GPT marketing pages */
(function () {
  const NAV_LINKS = [
    { href: "/pricing.html", label: "Pricing" },
    { href: "/case-study.html", label: "Case Study" },
    { href: "/install-service.html", label: "Install Service" },
    { href: "/learn/ai-customer-support.html", label: "AI Support" },
    { href: "/learn/ai-automation-tutorials.html", label: "Tutorials" },
    { href: "/learn/demos.html", label: "Demos" },
    { href: "/seo/", label: "SEO Hub" },
    { href: "/free-demo.html", label: "Powered by Demo" },
    { href: "https://yoursite.asia/", label: "Live Tools", external: true },
  ];

  function navHtml() {
    return `
<header class="sg-nav">
  <div class="sg-wrap sg-nav-inner">
    <a class="sg-logo" href="/">
      <img src="/img/sitp-robot-logo.png" alt="Sitp GPT" width="32" height="32">
      Sitp GPT
    </a>
    <nav class="sg-nav-links">
      ${NAV_LINKS.map((l) =>
        `<a href="${l.href}"${l.external ? ' target="_blank" rel="noopener"' : ""}>${l.label}</a>`
      ).join("")}
    </nav>
    <a class="sg-btn sg-btn-primary" href="/pricing.html">Start free</a>
  </div>
</header>`;
  }

  function footerHtml() {
    return `
<footer class="sg-footer">
  <div class="sg-wrap sg-footer-grid">
    <div>
      <strong>Sitp GPT</strong>
      <p style="color:var(--sg-muted);margin:8px 0 0;">Replace your first-line customer support team with AI. 60+ free SaaS tools at yoursite.asia.</p>
    </div>
    <div>
      <h4>Product</h4>
      <a href="/pricing.html">Pricing</a>
      <a href="/install-service.html">$599 Install Service</a>
      <a href="/case-study.html">Case Study</a>
      <a href="https://yoursite.asia/install.html" target="_blank" rel="noopener">Embed Code</a>
    </div>
    <div>
      <h4>Learn</h4>
      <a href="/learn/ai-customer-support.html">AI Support Intro</a>
      <a href="/learn/ai-automation-tutorials.html">Automation Tutorials</a>
      <a href="/learn/enterprise-ai-cases.html">Enterprise Cases</a>
      <a href="/learn/ai-employee-guide.html">AI Employee Guide</a>
      <a href="/learn/demos.html">Video Demos</a>
    </div>
    <div>
      <h4>SEO & Tools</h4>
      <a href="/seo/">SEO Hub (1000 pages)</a>
      <a href="/tools/">60+ Tool SEO Entries</a>
      <a href="https://yoursite.asia/" target="_blank" rel="noopener">All Live Tools</a>
      <a href="/sitpgpt.html">Classic Demo</a>
    </div>
  </div>
  <div class="sg-wrap sg-footer-bottom">Sitp GPT · yousite.asia · support@yoursite.asia</div>
</footer>`;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const navMount = document.getElementById("sg-nav-mount");
    const footerMount = document.getElementById("sg-footer-mount");
    if (navMount) navMount.outerHTML = navHtml();
    if (footerMount) footerMount.outerHTML = footerHtml();
  });
})();
