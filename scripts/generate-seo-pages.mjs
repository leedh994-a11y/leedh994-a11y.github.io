#!/usr/bin/env node
/**
 * Generates ~1000 SEO landing pages + 60 tool SEO entries + hub indexes + sitemap.
 * Additive only — does not modify existing live tool/payment backends.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { TOOLS, TOOL_CATEGORIES } from "../js/tools-data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SEO_DIR = path.join(ROOT, "seo");
const TOOLS_DIR = path.join(ROOT, "tools");

fs.mkdirSync(SEO_DIR, { recursive: true });
fs.mkdirSync(TOOLS_DIR, { recursive: true });

const SLUG_ALIASES = {
  "AI客服机器人": "ai-kefu-jiqiren",
  "AI客服工具介绍": "ai-kefu-tool-intro",
  "AI自动化教程": "ai-automation-tutorial-zh",
  "企业AI案例": "enterprise-ai-case-zh",
  "AI员工使用方法": "ai-employee-usage-zh",
};

function slugify(s) {
  if (SLUG_ALIASES[s]) return SLUG_ALIASES[s];
  return String(s)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[\u4e00-\u9fff]+/g, (m) => `zh-${Buffer.from(m).toString("hex").slice(0, 16)}`)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const CORE_KEYWORDS = [
  "AI客服机器人",
  "AI chatbot for Shopify",
  "AI customer support automation",
  "PDF chatbot",
  "Website AI assistant",
  "AI FAQ generator",
  "Sitemap generator",
  "AI customer support",
  "AI support chatbot",
  "ecommerce AI chatbot",
  "WhatsApp AI customer support",
  "Slack AI support bot",
  "AI knowledge base chatbot",
  "train AI on website",
  "Sitp GPT",
  "AI客服工具介绍",
  "AI自动化教程",
  "企业AI案例",
  "AI员工使用方法",
];

const MODIFIERS = [
  "best",
  "free",
  "online",
  "for ecommerce",
  "for SaaS",
  "for startups",
  "for Shopify",
  "for WordPress",
  "2026",
  "no code",
  "how to use",
  "vs human agents",
  "pricing",
  "setup guide",
  "ROI",
  "examples",
  "template",
  "playbook",
  "checklist",
  "for small business",
  "enterprise",
  "multilingual",
  "24/7",
  "automation",
  "integration",
  "tutorial",
  "benefits",
  "features",
  "use cases",
  "comparison",
  "review",
  "alternative",
  "software",
  "platform",
  "tool",
  "service",
  "agency",
  "white label",
  "API",
  "embed",
  "widget",
  "install",
  "demo",
  "trial",
  "China",
  "Asia",
  "global",
  "B2B",
  "B2C",
  "retail",
  "DTC",
  "helpdesk",
  "ticket deflection",
  "first response time",
  "cost savings",
  "labor cost",
  "self serve",
  "knowledge base",
  "FAQ automation",
  "lead capture",
  "analytics",
  "report",
  "onboarding",
  "CX",
  "customer experience",
];

const EXTRA_TOPICS = [
  "replace first line support with AI",
  "AI employee for customer service",
  "auto update website training content",
  "collect customer emails with chatbot",
  "enterprise AI support analytics",
  "Powered by Sitp GPT branding",
  "AI chatbot install service 599",
  "case study ecommerce AI support",
  "AI handles 80 percent tickets",
  "save 2000 dollars support cost",
];

function pageShell({ title, description, canonical, body, lang = "en" }) {
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | Sitp GPT</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonical}">
  <meta name="robots" content="index,follow">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/site-extra.css">
</head>
<body class="sg-page">
  <div id="sg-nav-mount"></div>
  ${body}
  <div id="sg-footer-mount"></div>
  <script src="/js/site-common.js"></script>
  <script src="/js/powered-by.js"></script>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function seoBody(keyword, related = []) {
  const relatedHtml = related
    .slice(0, 8)
    .map((r) => `<li><a href="/seo/${r.slug}.html">${escapeHtml(r.keyword)}</a></li>`)
    .join("");
  return `
<article class="sg-seo-article">
  <div class="sg-badge">SEO entry · Free traffic hub</div>
  <h1>${escapeHtml(keyword)}</h1>
  <p>Looking for <strong>${escapeHtml(keyword)}</strong>? Sitp GPT helps you replace your first-line customer support team with AI — plus 60+ free tools for sitemaps, FAQ generation, PDF chatbots, and more.</p>
  <p>Start free with 10 AI support tests, 1 knowledge base, and 100 website training pages. Paid plans add unlimited answers, auto content updates, WhatsApp/Slack, email capture, and enterprise analytics.</p>
  <div data-powered-by-free class="sg-panel" style="margin:20px 0;">
    <h2 style="margin-top:0;">Quick answer</h2>
    <p style="margin:0;">Sitp GPT is an AI customer support platform and SaaS toolkit. Use it as a website AI assistant, Shopify chatbot, PDF chatbot, AI FAQ generator, or sitemap generator — then embed the bot on your site.</p>
  </div>
  <h2>Why teams search for ${escapeHtml(keyword)}</h2>
  <ul class="sg-list">
    <li>Reduce repetitive support tickets</li>
    <li>Answer shoppers and users 24/7</li>
    <li>Train AI on real website content</li>
    <li>Keep humans for complex escalations</li>
  </ul>
  <div class="sg-seo-cta">
    <strong>Try Sitp GPT:</strong>
    <a href="/pricing.html">Pricing</a> ·
    <a href="/case-study.html">Case study</a> ·
    <a href="/install-service.html">$599 install</a> ·
    <a href="https://yoursite.asia/" target="_blank" rel="noopener">Live tools</a>
  </div>
  <h2>Related searches</h2>
  <ul class="sg-list">${relatedHtml}</ul>
</article>`;
}

function toolBody(tool) {
  const cat = TOOL_CATEGORIES.find((c) => c.id === tool.category)?.name || "Tools";
  return `
<article class="sg-seo-article">
  <div class="sg-badge">${escapeHtml(cat)} · SEO entry</div>
  <h1>${escapeHtml(tool.name)}</h1>
  <p>${escapeHtml(tool.desc)}</p>
  <p>This page is an SEO doorway for <strong>${escapeHtml(tool.name)}</strong>. The original tool UI and API on the live Sitp GPT site remain unchanged.</p>
  <div data-powered-by-free class="sg-panel">
    <h2 style="margin-top:0;">Open the live tool</h2>
    <p>Use the production tool at yoursite.asia (all features preserved).</p>
    <a class="sg-btn sg-btn-primary" href="https://yoursite.asia/tools/${tool.id}" target="_blank" rel="noopener">Launch ${escapeHtml(tool.name)}</a>
  </div>
  <h2>Also explore</h2>
  <ul class="sg-list">
    <li><a href="/seo/ai-customer-support-automation.html">AI customer support automation</a></li>
    <li><a href="/seo/ai-chatbot-for-shopify.html">AI chatbot for Shopify</a></li>
    <li><a href="/seo/pdf-chatbot.html">PDF chatbot</a></li>
    <li><a href="/pricing.html">Free & paid plans</a></li>
  </ul>
</article>`;
}

// Build keyword list until >= 1000 unique slugs
const entries = [];
const seen = new Set();

function addKeyword(keyword) {
  const slug = slugify(keyword);
  if (!slug || seen.has(slug)) return false;
  seen.add(slug);
  entries.push({ keyword, slug });
  return true;
}

for (const k of CORE_KEYWORDS) addKeyword(k);
for (const t of EXTRA_TOPICS) addKeyword(t);
for (const tool of TOOLS) {
  addKeyword(tool.name);
  addKeyword(`${tool.name} free tool`);
  addKeyword(`${tool.name} online`);
  addKeyword(`best ${tool.name}`);
}

// Combinations to reach 1000
outer: for (const mod of MODIFIERS) {
  for (const k of CORE_KEYWORDS) {
    addKeyword(`${mod} ${k}`);
    addKeyword(`${k} ${mod}`);
    if (entries.length >= 1000) break outer;
  }
  for (const tool of TOOLS) {
    addKeyword(`${mod} ${tool.name}`);
    if (entries.length >= 1000) break outer;
  }
}

// Fill remaining with numbered long-tails if needed
let i = 1;
while (entries.length < 1000) {
  const base = CORE_KEYWORDS[i % CORE_KEYWORDS.length];
  addKeyword(`${base} guide ${i}`);
  i += 1;
  if (i > 5000) break;
}

const finalEntries = entries.slice(0, 1000);

// Write SEO pages
for (let idx = 0; idx < finalEntries.length; idx++) {
  const e = finalEntries[idx];
  const related = [];
  for (let j = 1; j <= 8; j++) related.push(finalEntries[(idx + j) % finalEntries.length]);
  const html = pageShell({
    title: e.keyword,
    description: `${e.keyword} with Sitp GPT — AI customer support, free tools, SEO hub.`,
    canonical: `https://yoursite.asia/seo/${e.slug}.html`,
    body: seoBody(e.keyword, related),
    lang: /[\u4e00-\u9fff]/.test(e.keyword) ? "zh" : "en",
  });
  fs.writeFileSync(path.join(SEO_DIR, `${e.slug}.html`), html);
}

// SEO hub index
const hubLinks = finalEntries
  .map((e) => `<li><a href="/seo/${e.slug}.html">${escapeHtml(e.keyword)}</a></li>`)
  .join("\n");
fs.writeFileSync(
  path.join(SEO_DIR, "index.html"),
  pageShell({
    title: "SEO Hub — 1000 search pages",
    description: "1000 free-traffic SEO entry pages for AI chatbot, Shopify support, PDF chatbot, FAQ generator, sitemap tools, and Sitp GPT.",
    canonical: "https://yoursite.asia/seo/",
    body: `<main class="sg-wrap sg-section"><h1 style="font-family:var(--sg-font-display);">SEO Hub — 1000 search pages</h1><p class="sub">Additive free-traffic entry points. Live tools and payments are unchanged.</p><ol class="sg-list" style="columns:2;gap:24px;">${hubLinks}</ol></main>`,
  })
);

// 60 tool SEO entries
for (const tool of TOOLS) {
  const html = pageShell({
    title: `${tool.name} — Free AI Tool`,
    description: `${tool.desc} SEO entry for Sitp GPT tool ${tool.name}.`,
    canonical: `https://yoursite.asia/tools/${tool.id}.html`,
    body: toolBody(tool),
  });
  fs.writeFileSync(path.join(TOOLS_DIR, `${tool.id}.html`), html);
}

const toolLinks = TOOLS.map(
  (t) => `<li><a href="/tools/${t.id}.html">${escapeHtml(t.name)}</a> — ${escapeHtml(t.desc)}</li>`
).join("\n");
fs.writeFileSync(
  path.join(TOOLS_DIR, "index.html"),
  pageShell({
    title: "60+ AI Tools SEO Entries",
    description: "Each Sitp GPT tool as an SEO entry page linking to the unchanged live tool.",
    canonical: "https://yoursite.asia/tools/",
    body: `<main class="sg-wrap sg-section"><h1 style="font-family:var(--sg-font-display);">60+ AI tools as SEO entries</h1><p class="sub">Doorway pages only — original tool functions stay on the live site.</p><ul class="sg-list">${toolLinks}</ul></main>`,
  })
);

// Manifest for sitemap
const urls = [
  "/",
  "/pricing.html",
  "/case-study.html",
  "/install-service.html",
  "/learn/ai-customer-support.html",
  "/learn/ai-automation-tutorials.html",
  "/learn/enterprise-ai-cases.html",
  "/learn/ai-employee-guide.html",
  "/learn/demos.html",
  "/seo/",
  "/tools/",
  "/sitpgpt.html",
  ...finalEntries.map((e) => `/seo/${e.slug}.html`),
  ...TOOLS.map((t) => `/tools/${t.id}.html`),
];

fs.writeFileSync(
  path.join(ROOT, "scripts/seo-manifest.json"),
  JSON.stringify({ count: finalEntries.length, tools: TOOLS.length, urls }, null, 2)
);

const today = new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>https://yoursite.asia${u}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${u === "/" ? "1.0" : u.startsWith("/seo/") ? "0.6" : "0.8"}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;
fs.writeFileSync(path.join(ROOT, "sitemap-new-pages.xml"), sitemap);

fs.writeFileSync(
  path.join(ROOT, "robots.txt"),
  `User-agent: *
Allow: /
Sitemap: https://yoursite.asia/sitemap-new-pages.xml
Sitemap: https://yoursite.asia/sitemap.xml
`
);

console.log(`Generated ${finalEntries.length} SEO pages + ${TOOLS.length} tool SEO pages`);
console.log(`Total URLs in sitemap-new-pages.xml: ${urls.length}`);
