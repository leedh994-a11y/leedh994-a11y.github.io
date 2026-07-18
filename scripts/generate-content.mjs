/**
 * Generates the /guides/ content hub: AI customer-support tool intro,
 * AI automation tutorials, enterprise AI case studies, how to use AI
 * employees, and a feature video-demos page. Additive only.
 * Run: `node scripts/generate-content.mjs`
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DIR = join(ROOT, "guides");
mkdirSync(DIR, { recursive: true });

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const HEADER = `  <header class="site-header">
    <div class="container header-inner">
      <a href="/" class="logo"><span class="logo-icon">◆</span> Sitp GPT</a>
      <nav class="nav-links">
        <a href="/">Tools</a>
        <a href="/solutions/">Solutions</a>
        <a href="/case-study.html">Case Study</a>
        <a href="/guides/">Guides</a>
        <a href="/pricing.html">Pricing</a>
        <a href="/zh/" class="lang-switch">中文</a>
      </nav>
    </div>
  </header>`;

const FOOTER = `  <footer class="site-footer"><div class="container">
    <p class="powered-by-sitp">Powered by <a href="/">Sitp GPT</a></p>
    <p>Sitp GPT · <a href="/pricing.html">Pricing</a> · <a href="/case-study.html">Case study</a> · <a href="/solutions/">Solutions</a> · <a href="https://x.com/XZZ13340061411" class="social-x-link" target="_blank" rel="noopener noreferrer">@XZZ13340061411</a></p>
  </div></footer>`;

const WIDGET = `  <script type="text/javascript">
  window.$sitpgpt=window.$sitpgpt||[];
  (function(){var d=document,s=d.createElement("script");s.src="/widget/sitp-main.js";s.async=1;d.getElementsByTagName("head")[0].appendChild(s);})();
  </script>`;

function shell({ title, description, canonical, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${canonical}">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css">
  <link rel="stylesheet" href="/css/seo.css">
</head>
<body>
${HEADER}
  <main>
${body}
  </main>
${FOOTER}
${WIDGET}
</body>
</html>
`;
}

function article({ slug, badge, title, description, lede, sections, ctaTitle }) {
  const body = `    <section class="hero seo-hero"><div class="container">
      <span class="hero-badge">${esc(badge)}</span>
      <h1>${esc(title)}</h1>
      <p class="seo-lede">${esc(lede)}</p>
      <div class="btn-row"><a href="/pricing.html" class="btn btn-primary">Start free</a><a href="/guides/" class="btn btn-secondary">All guides</a></div>
    </div></section>
    <section class="container article-body">
${sections.map((s) => `      <h2>${esc(s.h)}</h2>\n${s.p.map((p) => `      <p>${p}</p>`).join("\n")}${s.list ? `\n      <ul class="check-list">${s.list.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : ""}`).join("\n")}
    </section>
    <section class="container seo-cta"><div class="cta-box">
      <h2>${esc(ctaTitle)}</h2>
      <p>Free plan: 10 AI support tests · 1 knowledge base · 100 pages of training.</p>
      <div class="btn-row"><a href="/pricing.html" class="btn btn-primary">See pricing</a><a href="/install.html#done-for-you" class="btn btn-secondary">$599 install service</a></div>
    </div></section>`;
  writeFileSync(join(DIR, `${slug}.html`),
    shell({ title: `${title} | Sitp GPT`, description, canonical: `https://yoursite.asia/guides/${slug}.html`, body }));
}

// 1) AI customer support tool intro
article({
  slug: "ai-customer-support-tools",
  badge: "Product intro · AI客服工具介绍",
  title: "AI Customer Support Tools: what Sitp GPT does",
  description: "An introduction to Sitp GPT's AI customer support tools — 60+ free tools plus an AI assistant that answers customer questions 24/7.",
  lede: "Sitp GPT turns your website content into a 24/7 AI support agent, backed by 60+ free tools for SEO, content conversion, FAQ generation and more.",
  sections: [
    { h: "What is Sitp GPT?", p: ["Sitp GPT is an AI customer support platform. You train it on your website, PDFs and FAQs, and it answers customer questions instantly on your site, WhatsApp and Slack — replacing your first-line support team with AI."] },
    { h: "The 60+ free tools", p: ["Every account gets access to 60+ free tools across seven categories:"], list: ["Sitemap tools — generate, validate and analyze sitemaps", "Format conversion — PDF, DOCX, HTML, CSV and more to Markdown", "AI chat — chat with your text, website, PDF and Word data", "AI generators — prompts, replies, emails, FAQs, titles and names", "AI studio & business — pricing advisors, ROI and cost calculators", "FAQ generation — turn any page or document into an FAQ", "Utility tools — signatures, scripts and more"] },
    { h: "From free tool to AI employee", p: ["Start with any free tool, then upgrade to train a full AI chatbot on your knowledge base. The AI auto-updates when your content changes, captures customer emails, and sends you enterprise analytics reports."] },
  ],
  ctaTitle: "Try the AI customer support tools free",
});

// 2) AI automation tutorial
article({
  slug: "ai-automation-tutorial",
  badge: "Tutorial · AI自动化教程",
  title: "AI Automation Tutorial: set up 24/7 AI support in 4 steps",
  description: "Step-by-step tutorial to automate customer support with AI using Sitp GPT — train, install, configure FAQs and optimize.",
  lede: "Follow these four steps to automate up to 80% of your customer support with AI.",
  sections: [
    { h: "Step 1 — Add training content", p: ["Paste text, upload PDFs/DOCX, or scrape your website. Sitp GPT builds a knowledge base from your content. The free plan covers up to 100 pages."] },
    { h: "Step 2 — Install the chatbot", p: ["Copy the embed code from the install page and paste it before <code>&lt;/body&gt;</code> on your site, then verify the installation. See <a href=\"/install.html\">/install.html</a>."] },
    { h: "Step 3 — Configure FAQs & quick prompts", p: ["Auto-generate FAQs from your content, then add quick prompts so visitors know what to ask. This deflects the most common tickets automatically."] },
    { h: "Step 4 — Optimize & connect channels", p: ["Connect WhatsApp and Slack, enable email capture, and review enterprise analytics reports to keep improving. Enable auto-refresh so answers stay current as your website changes."] },
    { h: "Prefer done-for-you?", p: ["Our $599 one-time install does all four steps for you — training, installation, FAQ setup and workflow optimization, including everything in the paid plans."] },
  ],
  ctaTitle: "Automate your support today",
});

// 3) Enterprise AI case studies
article({
  slug: "enterprise-ai-case-studies",
  badge: "Case studies · 企业AI案例",
  title: "Enterprise AI Case Studies",
  description: "Real-world examples of businesses automating customer support with Sitp GPT AI — including 80% ticket deflection and $2,000/month saved.",
  lede: "See how teams use Sitp GPT to deflect tickets, cut costs and respond instantly.",
  sections: [
    { h: "Ecommerce: 80% of support automated", p: ["An online store handling ~100 questions/day now lets AI resolve 80% of them automatically, saving about $2,000/month. Read the full <a href=\"/case-study.html\">case study</a>."] },
    { h: "SaaS: instant onboarding answers", p: ["A SaaS company trained Sitp GPT on its docs and changelog. New users get instant setup answers, reducing onboarding tickets and freeing the team for high-value conversations."] },
    { h: "Agencies: AI support for every client", p: ["Agencies deploy a branded AI assistant per client, capturing leads and sending analytics reports — a new recurring revenue line with the $599 install service."] },
    { h: "Common results", p: ["Across use cases, teams report:"], list: ["Up to 80% ticket deflection", "First-response time from hours to seconds", "Thousands saved per month in support labor", "Higher lead capture from support chats"] },
  ],
  ctaTitle: "Bring these results to your business",
});

// 4) How to use AI employees
article({
  slug: "how-to-use-ai-employees",
  badge: "Playbook · AI员工使用方法",
  title: "How to Use AI Employees for Customer Support",
  description: "A practical playbook for deploying AI employees — treat your AI assistant like a first-line support hire that works 24/7.",
  lede: "Treat your AI assistant like a new team member: give it knowledge, a role, and an escalation path.",
  sections: [
    { h: "Give your AI employee knowledge", p: ["Onboard it the way you would a human hire — feed it your product docs, policies and FAQs so it answers accurately from day one."] },
    { h: "Define its role & quick prompts", p: ["Decide what it handles first: order status, returns, pricing, setup. Add quick prompts so customers immediately see what the AI can do."] },
    { h: "Set the escalation path", p: ["Configure when to hand off to a human. The AI resolves the repetitive 80%, and routes the nuanced 20% to your team with full context."] },
    { h: "Review performance", p: ["Use daily email summaries and enterprise analytics reports to see what customers ask, spot knowledge gaps, and keep improving — just like a performance review."] },
  ],
  ctaTitle: "Hire your first AI employee",
});

// 5) Video demos page
const demosBody = `    <section class="hero seo-hero"><div class="container">
      <span class="hero-badge">Demos · 功能视频演示</span>
      <h1>Feature video demos</h1>
      <p class="seo-lede">Watch Sitp GPT in action — see how AI customer support, tools and automation work.</p>
      <div class="btn-row"><a href="/pricing.html" class="btn btn-primary">Start free</a><a href="/guides/" class="btn btn-secondary">All guides</a></div>
    </div></section>
    <section class="container">
      <h2>Product story (English)</h2>
      <div class="video-embed"><iframe src="/promo-video-en.html" title="Sitp GPT product demo (English)" loading="lazy" allowfullscreen></iframe></div>
      <h2>产品故事（中文）</h2>
      <div class="video-embed"><iframe src="/promo-video.html" title="Sitp GPT 产品演示（中文）" loading="lazy" allowfullscreen></iframe></div>
      <p class="hint">Tip: open a demo full screen via <a href="/promo-video-en.html" target="_blank" rel="noopener">/promo-video-en.html</a> or <a href="/promo-video.html" target="_blank" rel="noopener">/promo-video.html</a>.</p>
    </section>
    <section class="container seo-cta"><div class="cta-box"><h2>Ready to try it yourself?</h2><p>Free plan available — no credit card required.</p><div class="btn-row"><a href="/pricing.html" class="btn btn-primary">See pricing</a><a href="/case-study.html" class="btn btn-secondary">Read case study</a></div></div></section>`;
writeFileSync(join(DIR, "video-demos.html"),
  shell({ title: "Feature Video Demos | Sitp GPT", description: "Watch Sitp GPT AI customer support and tool demos.", canonical: "https://yoursite.asia/guides/video-demos.html", body: demosBody }));

// 6) Guides hub
const guides = [
  { slug: "ai-customer-support-tools", t: "AI Customer Support Tools", d: "What Sitp GPT does and its 60+ free tools." },
  { slug: "ai-automation-tutorial", t: "AI Automation Tutorial", d: "Set up 24/7 AI support in 4 steps." },
  { slug: "enterprise-ai-case-studies", t: "Enterprise AI Case Studies", d: "Real results from teams using Sitp GPT." },
  { slug: "how-to-use-ai-employees", t: "How to Use AI Employees", d: "A playbook for deploying AI support agents." },
  { slug: "video-demos", t: "Feature Video Demos", d: "See Sitp GPT in action." },
];
const hubBody = `    <section class="hero seo-hero"><div class="container">
      <span class="hero-badge">Guides</span>
      <h1>Guides, tutorials & AI case studies</h1>
      <p class="seo-lede">Learn how to use Sitp GPT to replace your first-line customer support team with AI.</p>
    </div></section>
    <section class="container">
      <div class="guide-grid">${guides.map((g) => `<article class="guide-card"><h3>${esc(g.t)}</h3><p>${esc(g.d)}</p><a href="/guides/${g.slug}.html" class="btn btn-primary">Read</a></article>`).join("")}</div>
    </section>`;
writeFileSync(join(DIR, "index.html"),
  shell({ title: "Guides, Tutorials & AI Case Studies | Sitp GPT", description: "AI customer support guides, automation tutorials, enterprise case studies and video demos.", canonical: "https://yoursite.asia/guides/", body: hubBody }));

console.log("Generated guides:", guides.map((g) => g.slug).join(", "));
