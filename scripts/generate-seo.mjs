/**
 * Programmatic SEO page generator for Sitp GPT.
 *
 * Generates ~1000 static, self-contained SEO landing pages under /seo/,
 * plus one SEO entry page per tool (60+), a hub index, and a sitemap.
 *
 * These pages ADD free-traffic entry points; they do not modify any
 * existing site page or feature. Run: `node scripts/generate-seo.mjs`
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { TOOLS, TOOL_CATEGORIES } from "../js/tool-registry-en.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SEO_DIR = join(ROOT, "seo");

// ---------------------------------------------------------------------------
// Keyword universe
// ---------------------------------------------------------------------------

// Primary use-cases (search intents). ~25 entries.
const USE_CASES = [
  { slug: "ai-customer-support", label: "AI Customer Support" },
  { slug: "ai-customer-service-automation", label: "AI Customer Service Automation" },
  { slug: "ai-chatbot", label: "AI Chatbot" },
  { slug: "ai-help-desk", label: "AI Help Desk" },
  { slug: "ai-live-chat", label: "AI Live Chat" },
  { slug: "ai-support-agent", label: "AI Support Agent" },
  { slug: "24-7-ai-support", label: "24/7 AI Support" },
  { slug: "ai-ticket-deflection", label: "AI Ticket Deflection" },
  { slug: "ai-faq-assistant", label: "AI FAQ Assistant" },
  { slug: "ai-knowledge-base", label: "AI Knowledge Base" },
  { slug: "website-ai-assistant", label: "Website AI Assistant" },
  { slug: "pdf-chatbot", label: "PDF Chatbot" },
  { slug: "document-ai-chatbot", label: "Document AI Chatbot" },
  { slug: "ai-email-support", label: "AI Email Support" },
  { slug: "ai-whatsapp-support", label: "AI WhatsApp Support" },
  { slug: "ai-slack-support", label: "AI Slack Support" },
  { slug: "ai-lead-capture", label: "AI Lead Capture" },
  { slug: "ai-onboarding-assistant", label: "AI Onboarding Assistant" },
  { slug: "ai-sales-assistant", label: "AI Sales Assistant" },
  { slug: "ai-order-tracking-bot", label: "AI Order Tracking Bot" },
  { slug: "ai-faq-generator", label: "AI FAQ Generator" },
  { slug: "ai-support-automation", label: "AI Support Automation" },
  { slug: "customer-support-chatbot", label: "Customer Support Chatbot" },
  { slug: "self-service-ai-portal", label: "Self-Service AI Portal" },
  { slug: "ai-virtual-agent", label: "AI Virtual Agent" },
];

// Industries / platforms. ~40 entries -> 25 x 40 = 1000 pages.
const INDUSTRIES = [
  "Shopify Stores", "Ecommerce", "SaaS", "WooCommerce", "Startups",
  "Small Business", "Enterprise", "Agencies", "Marketplaces", "Dropshipping",
  "Real Estate", "Healthcare", "Education", "EdTech", "FinTech",
  "Insurance", "Travel", "Hospitality", "Restaurants", "Fitness & Gyms",
  "Beauty & Salons", "Legal Firms", "Accounting", "Consulting", "Nonprofits",
  "Manufacturing", "Logistics", "Automotive", "Telecom", "Gaming",
  "Media & Publishing", "Online Courses", "Coaching", "Subscription Boxes",
  "Digital Products", "Mobile Apps", "B2B", "B2C", "Local Services",
  "WordPress Sites",
];

// The specific high-priority keywords called out by the site owner.
const FEATURED = [
  { slug: "ai-customer-service-bot", h1: "AI 客服机器人 · AI Customer Service Bot",
    kw: "AI customer service bot", zh: "AI 客服机器人" },
  { slug: "ai-chatbot-for-shopify", h1: "AI Chatbot for Shopify", kw: "AI chatbot for Shopify" },
  { slug: "ai-customer-support-automation", h1: "AI Customer Support Automation", kw: "AI customer support automation" },
  { slug: "pdf-chatbot", h1: "PDF Chatbot", kw: "PDF chatbot" },
  { slug: "website-ai-assistant", h1: "Website AI Assistant", kw: "website AI assistant" },
  { slug: "ai-faq-generator", h1: "AI FAQ Generator", kw: "AI FAQ generator" },
  { slug: "sitemap-generator", h1: "Sitemap Generator", kw: "sitemap generator" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slugify = (s) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function pick(arr, seed, n) {
  // deterministic pseudo-random selection for stable output
  const out = [];
  let x = seed * 2654435761 % 2147483647;
  const pool = [...arr];
  for (let i = 0; i < n && pool.length; i++) {
    x = (x * 48271) % 2147483647;
    out.push(pool.splice(x % pool.length, 1)[0]);
  }
  return out;
}

const BENEFITS = [
  "Answer up to 80% of repetitive questions automatically, 24/7.",
  "Cut first-response time from hours to seconds.",
  "Train the AI on your website, PDFs, and FAQs in minutes.",
  "Auto-refresh answers whenever your website content changes.",
  "Capture visitor emails and turn support chats into leads.",
  "Escalate to a human whenever a conversation needs a personal touch.",
  "Deploy on your site, WhatsApp, and Slack from one dashboard.",
  "Save thousands per month on first-line support staffing.",
  "Get enterprise analytics reports on what customers ask most.",
  "Support 95+ languages out of the box.",
];

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

const FOOTER = `  <footer class="site-footer">
    <div class="container">
      <p class="powered-by-sitp">Powered by <a href="/">Sitp GPT</a></p>
      <p>Sitp GPT · <a href="/pricing.html">Pricing</a> · <a href="/case-study.html">Case study</a> · <a href="/guides/">Guides</a> · <a href="/solutions/">All solutions</a> · <a href="https://x.com/XZZ13340061411" class="social-x-link" target="_blank" rel="noopener noreferrer">@XZZ13340061411</a></p>
    </div>
  </footer>`;

const ANALYTICS = `<script type="text/javascript">
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "x0r5cbb7p5");
  </script>
  <script>
  var _hmt = _hmt || [];
  (function() {
    var hm = document.createElement("script");
    hm.src = "https://hm.baidu.com/hm.js?09c617d7b704bf771069f0d8e48fde65";
    var s = document.getElementsByTagName("script")[0];
    s.parentNode.insertBefore(hm, s);
  })();
  </script>`;

const WIDGET = `  <script type="text/javascript">
  window.$sitpgpt=window.$sitpgpt||[];
  (function(){var d=document,s=d.createElement("script");s.src="/widget/sitp-main.js";s.async=1;d.getElementsByTagName("head")[0].appendChild(s);})();
  </script>`;

function toolCard(t, prefix = "/tools") {
  return `<article class="tool-card"><h3>${esc(t.name)}</h3><p>${esc(t.desc)}</p><a href="${prefix}/${t.id}" class="btn btn-primary">Use tool</a></article>`;
}

function page({ title, description, h1, canonical, bodyMain, extraHead = "", faqs = [] }) {
  const faqSchema = faqs.length ? `\n  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  })}</script>` : "";
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
  ${ANALYTICS}${extraHead}${faqSchema}
</head>
<body>
${HEADER}
  <main>
${bodyMain}
  </main>
${FOOTER}
${WIDGET}
</body>
</html>
`;
}

function faqBlock(faqs) {
  return `<section class="container seo-faq"><h2>Frequently asked questions</h2>${faqs.map((f) =>
    `<details class="faq-item"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</section>`;
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------
if (existsSync(SEO_DIR)) rmSync(SEO_DIR, { recursive: true, force: true });
mkdirSync(SEO_DIR, { recursive: true });

const allPages = []; // {loc, priority}
let seed = 1;

// Tools grouped for related-links
const toolsByCat = Object.fromEntries(TOOL_CATEGORIES.map((c) => [c.id, TOOLS.filter((t) => t.category === c.id)]));
const faqTools = toolsByCat["faq"] || [];
const aiChatTools = toolsByCat["ai-chat"] || [];
const genTools = toolsByCat["ai-generator"] || [];

function relatedTools(seedN) {
  return pick(TOOLS, seedN, 6);
}

// 1) Use-case x industry pages -----------------------------------------------
for (const uc of USE_CASES) {
  for (const industry of INDUSTRIES) {
    const iSlug = slugify(industry);
    const slug = `${uc.slug}-for-${iSlug}`;
    const h1 = `${uc.label} for ${industry}`;
    const title = `${h1} | Sitp GPT`;
    const description = `${uc.label} built for ${industry}. Replace your first-line customer support team with AI — train on your site, answer 24/7, capture leads, and cut support costs with Sitp GPT.`;
    const benefits = pick(BENEFITS, seed++, 5);
    const rt = relatedTools(seed++);
    const related = pick(USE_CASES.filter((u) => u.slug !== uc.slug), seed++, 5)
      .map((u) => `<li><a href="/seo/${u.slug}-for-${iSlug}.html">${esc(u.label)} for ${esc(industry)}</a></li>`).join("");
    const faqs = [
      { q: `How does ${uc.label} work for ${industry}?`, a: `Sitp GPT trains an AI assistant on your ${industry} website content, PDFs, and FAQs. It then answers customer questions instantly on your site, WhatsApp, and Slack — handling up to 80% of first-line support automatically.` },
      { q: `Is there a free plan for ${industry}?`, a: `Yes. The free plan includes 10 AI support tests, 1 knowledge base, and training on up to 100 website pages — no credit card required.` },
      { q: `Can the AI collect customer emails?`, a: `Yes. Every paid plan can capture visitor emails during conversations and send you enterprise analytics reports on what customers ask most.` },
    ];
    const body = `    <section class="hero seo-hero"><div class="container">
      <span class="hero-badge">${esc(industry)}</span>
      <h1>${esc(h1)}</h1>
      <p class="seo-lede">Replace your first-line customer support team with AI. Sitp GPT gives ${esc(industry)} an AI assistant that answers customer questions 24/7, learns from your website, and hands off to a human when needed.</p>
      <div class="btn-row">
        <a href="/pricing.html" class="btn btn-primary">Start free — 10 AI tests</a>
        <a href="/install.html" class="btn btn-secondary">Add to your site</a>
      </div>
    </div></section>

    <section class="container seo-benefits"><h2>Why ${esc(industry)} choose Sitp GPT</h2>
      <ul class="check-list">${benefits.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
    </section>

    <section class="container"><h2>Free tools to get started</h2>
      <div class="tools-grid">${rt.map((t) => toolCard(t)).join("")}</div>
    </section>

    ${faqBlock(faqs)}

    <section class="container seo-related"><h2>Related solutions for ${esc(industry)}</h2>
      <ul class="link-list">${related}</ul>
    </section>

    <section class="container seo-cta"><div class="cta-box">
      <h2>Ready to automate ${esc(industry)} support?</h2>
      <p>Try the free plan or book the done-for-you $599 install service.</p>
      <div class="btn-row"><a href="/pricing.html" class="btn btn-primary">See pricing</a><a href="/install.html#done-for-you" class="btn btn-secondary">$599 install service</a></div>
    </div></section>`;
    writeFileSync(join(SEO_DIR, `${slug}.html`),
      page({ title, description, h1, canonical: `https://yoursite.asia/seo/${slug}.html`, bodyMain: body, faqs }));
    allPages.push({ loc: `https://yoursite.asia/seo/${slug}.html`, priority: "0.6" });
  }
}

// 2) One SEO entry per tool (60+) --------------------------------------------
for (const t of TOOLS) {
  const slug = `tool-${t.id}`;
  const h1 = `${t.name} — Free Online Tool`;
  const title = `${t.name} | Free AI Tool by Sitp GPT`;
  const description = `${t.desc} Free ${t.name.toLowerCase()} by Sitp GPT — no signup required. Part of 60+ free AI & SEO tools.`;
  const rt = pick(TOOLS.filter((x) => x.id !== t.id), t.id.length + 7, 6);
  const faqs = [
    { q: `Is ${t.name} free?`, a: `Yes — ${t.name} is one of 60+ free tools on Sitp GPT. No signup required to try it.` },
    { q: `What does ${t.name} do?`, a: t.desc },
    { q: `How do I turn this into a 24/7 AI assistant?`, a: `Upgrade to a Sitp GPT plan to train an AI chatbot on your content and embed it on your website, WhatsApp, and Slack.` },
  ];
  const body = `    <section class="hero seo-hero"><div class="container">
      <span class="hero-badge">Free tool</span>
      <h1>${esc(h1)}</h1>
      <p class="seo-lede">${esc(t.desc)} Try it free, then replace your first-line customer support team with AI using Sitp GPT.</p>
      <div class="btn-row">
        <a href="/tools/${t.id}" class="btn btn-primary">Open ${esc(t.name)}</a>
        <a href="/pricing.html" class="btn btn-secondary">Start free plan</a>
      </div>
    </div></section>

    <section class="container seo-benefits"><h2>What you can do</h2>
      <ul class="check-list">${pick(BENEFITS, t.id.length + 3, 4).map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
    </section>

    <section class="container"><h2>Related free tools</h2>
      <div class="tools-grid">${rt.map((x) => toolCard(x)).join("")}</div>
    </section>

    ${faqBlock(faqs)}

    <section class="container seo-cta"><div class="cta-box">
      <h2>Turn ${esc(t.name)} into a 24/7 AI employee</h2>
      <p>Free: 10 AI support tests · 1 knowledge base · 100 pages of training.</p>
      <div class="btn-row"><a href="/pricing.html" class="btn btn-primary">See pricing</a><a href="/install.html#done-for-you" class="btn btn-secondary">$599 install service</a></div>
    </div></section>`;
  writeFileSync(join(SEO_DIR, `${slug}.html`),
    page({ title, description, h1, canonical: `https://yoursite.asia/seo/${slug}.html`, bodyMain: body, faqs }));
  allPages.push({ loc: `https://yoursite.asia/seo/${slug}.html`, priority: "0.6" });
}

// 3) Featured high-priority keyword pages ------------------------------------
for (const f of FEATURED) {
  const title = `${f.h1} | Sitp GPT`;
  const description = `${f.h1} — replace your first-line customer support team with AI. Train on your website, answer 24/7, and cut support costs with Sitp GPT.`;
  const rt = relatedTools(f.slug.length + 11);
  const faqs = [
    { q: `What is the best ${f.kw}?`, a: `Sitp GPT is a ${f.kw} that trains on your own content and answers customer questions 24/7 across your website, WhatsApp, and Slack.` },
    { q: `Is there a free version?`, a: `Yes — the free plan includes 10 AI support tests, 1 knowledge base, and 100 pages of website training.` },
  ];
  const body = `    <section class="hero seo-hero"><div class="container">
      <span class="hero-badge">Featured</span>
      <h1>${esc(f.h1)}</h1>
      <p class="seo-lede">Replace your first-line customer support team with AI. Sitp GPT is a ${esc(f.kw)} that learns from your website and handles up to 80% of customer questions automatically.</p>
      <div class="btn-row"><a href="/pricing.html" class="btn btn-primary">Start free</a><a href="/install.html" class="btn btn-secondary">Add to your site</a></div>
    </div></section>
    <section class="container seo-benefits"><h2>Highlights</h2><ul class="check-list">${BENEFITS.map((b) => `<li>${esc(b)}</li>`).join("")}</ul></section>
    <section class="container"><h2>Free tools</h2><div class="tools-grid">${rt.map((t) => toolCard(t)).join("")}</div></section>
    ${faqBlock(faqs)}
    <section class="container seo-cta"><div class="cta-box"><h2>Get started with ${esc(f.h1)}</h2><p>Free plan available. $599 done-for-you install service.</p><div class="btn-row"><a href="/pricing.html" class="btn btn-primary">See pricing</a><a href="/case-study.html" class="btn btn-secondary">Read case study</a></div></div></section>`;
  writeFileSync(join(SEO_DIR, `${f.slug}.html`),
    page({ title, description, h1: f.h1, canonical: `https://yoursite.asia/seo/${f.slug}.html`, bodyMain: body, faqs }));
  allPages.push({ loc: `https://yoursite.asia/seo/${f.slug}.html`, priority: "0.8" });
}

// 4) Hub index at /solutions/ (and /seo/index.html) --------------------------
const hubBody = `    <section class="hero seo-hero"><div class="container">
      <span class="hero-badge">Solutions</span>
      <h1>AI customer support solutions & free tools</h1>
      <p class="seo-lede">${allPages.length}+ free entry points to Sitp GPT — explore AI customer support by use case, by industry, and by tool. Replace your first-line customer support team with AI.</p>
      <div class="btn-row"><a href="/pricing.html" class="btn btn-primary">Start free</a><a href="/case-study.html" class="btn btn-secondary">See results</a></div>
    </div></section>

    <section class="container"><h2>By use case</h2>
      <div class="tools-grid">${USE_CASES.map((u) => `<article class="tool-card"><h3>${esc(u.label)}</h3><p>${esc(u.label)} for every industry.</p><a href="/seo/${u.slug}-for-shopify-stores.html" class="btn btn-primary">Explore</a></article>`).join("")}</div>
    </section>

    <section class="container"><h2>By industry</h2>
      <ul class="link-list cols">${INDUSTRIES.map((i) => `<li><a href="/seo/ai-customer-support-for-${slugify(i)}.html">AI customer support for ${esc(i)}</a></li>`).join("")}</ul>
    </section>

    <section class="container"><h2>By tool (60+ free tools)</h2>
      <ul class="link-list cols">${TOOLS.map((t) => `<li><a href="/seo/tool-${t.id}.html">${esc(t.name)}</a></li>`).join("")}</ul>
    </section>

    <section class="container seo-cta"><div class="cta-box"><h2>Popular searches</h2>
      <ul class="link-list cols">${FEATURED.map((f) => `<li><a href="/seo/${f.slug}.html">${esc(f.h1)}</a></li>`).join("")}</ul>
    </div></section>`;
const hubHtml = page({
  title: "AI Customer Support Solutions & 60+ Free Tools | Sitp GPT",
  description: "Explore 1000+ AI customer support solutions by use case, industry, and tool. Replace your first-line support team with AI — free plan available.",
  h1: "AI customer support solutions & free tools",
  canonical: "https://yoursite.asia/solutions/",
  bodyMain: hubBody,
});
mkdirSync(join(ROOT, "solutions"), { recursive: true });
writeFileSync(join(ROOT, "solutions", "index.html"), hubHtml);
writeFileSync(join(SEO_DIR, "index.html"), hubHtml.replace('canonical" href="https://yoursite.asia/solutions/"', 'canonical" href="https://yoursite.asia/seo/"'));
allPages.push({ loc: "https://yoursite.asia/solutions/", priority: "0.9" });

// 5) SEO sitemap -------------------------------------------------------------
const today = new Date().toISOString().slice(0, 10);
const seoSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map((p) => `  <url>\n    <loc>${p.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`).join("\n")}
</urlset>
`;
writeFileSync(join(ROOT, "sitemap-seo.xml"), seoSitemap);

console.log(`Generated ${allPages.length} SEO URLs.`);
console.log(`Files in /seo: use-case x industry = ${USE_CASES.length * INDUSTRIES.length}, tools = ${TOOLS.length}, featured = ${FEATURED.length}.`);
