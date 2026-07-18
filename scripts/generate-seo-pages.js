#!/usr/bin/env node
/**
 * Generates 1000+ SEO landing pages for Sitp GPT.
 * Run: node scripts/generate-seo-pages.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SEO_DIR = path.join(ROOT, "seo");
const SITE = "https://yoursite.asia";

const BASE_KEYWORDS = [
  { en: "AI Customer Support Bot", zh: "AI客服机器人", tool: "ai-chat-with-your-website-data" },
  { en: "AI Chatbot for Shopify", zh: "Shopify AI聊天机器人", tool: "ai-chat-with-your-website-data" },
  { en: "AI Customer Support Automation", zh: "AI客服自动化", tool: "customer-service-script-generator" },
  { en: "PDF Chatbot", zh: "PDF聊天机器人", tool: "ai-chat-with-your-pdf-document-data" },
  { en: "Website AI Assistant", zh: "网站AI助手", tool: "ai-chat-with-your-website-data" },
  { en: "AI FAQ Generator", zh: "AI FAQ生成器", tool: "ai-faq-generator" },
  { en: "Sitemap Generator", zh: "Sitemap生成器", tool: "sitemap-generator" },
];

const MODIFIERS = [
  "free", "best", "online", "for-small-business", "for-enterprise", "for-ecommerce",
  "for-saas", "for-shopify", "for-woocommerce", "for-wordpress", "for-magento",
  "for-startups", "for-agencies", "2026", "guide", "tutorial", "how-to-setup",
  "pricing", "comparison", "review", "alternative", "vs-human-support",
  "multilingual", "24-7", "whatsapp", "slack", "embed", "widget",
  "no-code", "self-hosted", "cloud", "api", "roi", "case-study",
  "implementation", "onboarding", "training", "knowledge-base", "automation",
  "deflection", "ticket-reduction", "cost-savings", "lead-capture",
  "email-collection", "analytics", "reporting", "integration", "plugin",
  "chrome-extension", "mobile", "b2b", "b2c", "healthcare", "finance",
  "education", "travel", "real-estate", "legal", "retail", "manufacturing",
];

const { TOOLS } = await import(path.join(ROOT, "js/tool-registry-en.js"));

const INDUSTRIES = [
  "ecommerce", "saas", "fintech", "healthcare", "education", "travel",
  "real-estate", "legal", "insurance", "logistics", "hospitality",
  "media", "gaming", "nonprofit", "government", "automotive",
];

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pageHtml({ title, description, h1, body, related, canonical }) {
  const relatedHtml = related?.length
    ? `<section class="seo-related container"><h2>Related guides</h2><ul>${related
        .map((r) => `<li><a href="/seo/${r.slug}.html">${esc(r.title)}</a></li>`)
        .join("")}</ul></section>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} — Sitp GPT</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${canonical}">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css">
  <link rel="stylesheet" href="/css/seo.css">
</head>
<body>
  <header class="site-header">
    <div class="container header-inner">
      <a href="/" class="logo"><span class="logo-icon">◆</span> Sitp GPT</a>
      <nav class="nav-links">
        <a href="/">Tools</a>
        <a href="/pricing.html">Pricing</a>
        <a href="/case-study.html">Case Study</a>
        <a href="/resources/">Resources</a>
      </nav>
    </div>
  </header>
  <main>
    <section class="seo-hero container">
      <span class="hero-badge">AI Customer Support</span>
      <h1>${esc(h1)}</h1>
      <p class="hint">${esc(description)}</p>
    </section>
    <article class="seo-content container">${body}</article>
    <section class="seo-cta container">
      <h2>Try Sitp GPT free</h2>
      <p>60+ AI tools, free tier with 10 AI support tests, and Pro plans from $39/mo.</p>
      <div class="btn-row" style="justify-content:center;gap:12px;margin-top:16px;">
        <a href="/pricing.html" class="btn btn-primary">View pricing</a>
        <a href="/case-study.html" class="btn btn-secondary">Read case study</a>
      </div>
    </section>
    ${relatedHtml}
  </main>
  <footer class="site-footer"><div class="container"><p>Sitp GPT · <a href="/">Home</a> · <a href="/pricing.html">Pricing</a></p></div></footer>
</body>
</html>`;
}

function buildBody(keyword, toolId, extra = "") {
  const toolLink = toolId ? `/tools/${toolId}` : "/";
  return `
    <p>Sitp GPT helps businesses deploy <strong>${esc(keyword)}</strong> without hiring a large support team. Train on your website, PDFs, and FAQs — then answer customers 24/7 on web, WhatsApp, and Slack.</p>
    <h2>Why ${esc(keyword)}?</h2>
    <ul>
      <li>Deflect 70–80% of repetitive support tickets automatically</li>
      <li>Collect visitor emails and route complex issues to humans</li>
      <li>Auto-refresh training when your site content changes (Pro)</li>
      <li>Enterprise analytics on questions, gaps, and ROI</li>
    </ul>
    <h2>Get started</h2>
    <p>Use our <a href="${toolLink}">free ${esc(keyword)} tool</a> or start the <a href="/pricing.html">Free plan</a> (10 AI support tests, 1 knowledge base, 100 pages training). Need hands-on help? Our <a href="/pricing.html#installation">$599 installation package</a> includes setup, FAQ tuning, and workflow optimization.</p>
    ${extra ? `<p>${esc(extra)}</p>` : ""}
    <p class="powered-by-badge">Powered by Sitp GPT — <a href="/">yoursite.asia</a></p>`;
}

function collectPages() {
  const pages = [];
  const seen = new Set();

  function add(slug, data) {
    if (seen.has(slug) || !slug) return;
    seen.add(slug);
    pages.push({ slug, ...data });
  }

  // Base keywords × modifiers (~350)
  for (const kw of BASE_KEYWORDS) {
    add(slugify(kw.en), {
      title: kw.en,
      h1: kw.en,
      description: `Free ${kw.en} by Sitp GPT. Train AI on your site, automate support, and save on labor costs.`,
      body: buildBody(kw.en, kw.tool),
      tool: kw.tool,
    });
    add(slugify(kw.zh), {
      title: kw.zh,
      h1: kw.zh,
      description: `免费${kw.zh} — Sitp GPT AI客服平台，支持网站训练、WhatsApp/Slack接入。`,
      body: buildBody(kw.zh, kw.tool),
      tool: kw.tool,
    });
    for (const mod of MODIFIERS) {
      const title = `${kw.en} ${mod.replace(/-/g, " ")}`;
      add(slugify(title), {
        title,
        h1: title,
        description: `${title} — Sitp GPT AI customer support platform with free tools and Pro plans.`,
        body: buildBody(title, kw.tool, `Optimized for ${mod.replace(/-/g, " ")} use cases.`),
        tool: kw.tool,
      });
    }
  }

  // 60+ tool SEO landing pages × variations (~600+)
  for (const tool of TOOLS) {
    add(`tool-${tool.id}`, {
      title: `Free ${tool.name}`,
      h1: `${tool.name} — Free Online Tool`,
      description: tool.desc,
      body: buildBody(tool.name, tool.id, tool.desc),
      tool: tool.id,
    });
    for (const mod of ["free", "online", "ai", "best", "2026", "guide", "tutorial", "for-business", "no-signup", "instant"]) {
      const title = `${tool.name} ${mod.replace(/-/g, " ")}`;
      add(slugify(`sitp-${tool.id}-${mod}`), {
        title,
        h1: title,
        description: `${title}. ${tool.desc}`,
        body: buildBody(tool.name, tool.id),
        tool: tool.id,
      });
    }
    for (const ind of INDUSTRIES.slice(0, 8)) {
      const title = `${tool.name} for ${ind}`;
      add(slugify(`sitp-${tool.id}-${ind}`), {
        title,
        h1: title,
        description: `${title} — ${tool.desc}`,
        body: buildBody(`${tool.name} (${ind})`, tool.id, `Built for ${ind} teams.`),
        tool: tool.id,
      });
    }
  }

  // Industry + keyword combos to reach 1000
  const extras = [
    "ai-support-bot", "chatbot-widget", "live-chat-ai", "helpdesk-automation",
    "customer-self-service", "ai-ticket-routing", "support-copilot", "ai-agent-workforce",
  ];
  let i = 0;
  while (pages.length < 1000) {
    const ind = INDUSTRIES[i % INDUSTRIES.length];
    const kw = BASE_KEYWORDS[i % BASE_KEYWORDS.length];
    const ex = extras[i % extras.length];
    const title = `${kw.en} for ${ind} — ${ex.replace(/-/g, " ")}`;
    add(slugify(`${ex}-${ind}-${i}`), {
      title,
      h1: title,
      description: `${title}. Sitp GPT — replace first-line support with AI.`,
      body: buildBody(title, kw.tool),
      tool: kw.tool,
    });
    i++;
  }

  return pages.slice(0, 1000);
}

function main() {
  fs.mkdirSync(SEO_DIR, { recursive: true });
  const pages = collectPages();
  const manifest = [];

  for (const p of pages) {
    const canonical = `${SITE}/seo/${p.slug}.html`;
    const related = pages
      .filter((x) => x.slug !== p.slug && x.tool === p.tool)
      .slice(0, 8)
      .map((x) => ({ slug: x.slug, title: x.title }));
    const html = pageHtml({ ...p, related, canonical });
    fs.writeFileSync(path.join(SEO_DIR, `${p.slug}.html`), html);
    manifest.push({ slug: p.slug, title: p.title, canonical });
  }

  fs.writeFileSync(path.join(SEO_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`Generated ${pages.length} SEO pages in ${SEO_DIR}`);

  // Append to sitemap
  const sitemapPath = path.join(ROOT, "sitemap.xml");
  let sitemap = fs.readFileSync(sitemapPath, "utf8");
  const insertBefore = "</urlset>";
  const newUrls = manifest
    .map(
      (p) => `  <url>
    <loc>${p.canonical}</loc>
    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`
    )
    .join("\n");
  if (!sitemap.includes("/seo/")) {
    sitemap = sitemap.replace(insertBefore, `${newUrls}\n${insertBefore}`);
    fs.writeFileSync(sitemapPath, sitemap);
    console.log("Updated sitemap.xml with SEO pages");
  }
}

main();
