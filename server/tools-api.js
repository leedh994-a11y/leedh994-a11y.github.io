import { Router } from "express";
import multer from "multer";
import { inflateRawSync } from "node:zlib";
import { chatCompletion, getModels, isAiEnabled } from "./openrouter.js";
import { PLANS } from "./plans.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

const FETCH_TIMEOUT_MS = 15000;
const USER_AGENT = "SitpGPT-Tools/1.0 (+https://yoursite.asia)";

function ok(data) {
  return { success: true, ...data };
}

function fail(res, error, status = 400) {
  return res.status(status).json({ success: false, error: String(error) });
}

function wrap(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      console.error("[tools-api]", err);
      fail(res, err.message || "Internal error", 500);
    }
  };
}

function normalizeUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) throw new Error("URL is required");
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return new URL(withProto).href.replace(/\/$/, "");
}

async function fetchText(url, { maxBytes = 2_000_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xml,text/xml,*/*" },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > maxBytes) throw new Error("Response too large");
    return buf.toString("utf8");
  } finally {
    clearTimeout(timer);
  }
}

function extractLocs(xml) {
  const locs = [];
  const re = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(xml))) locs.push(m[1].trim());
  return locs;
}

function isSitemapIndex(xml) {
  return /<sitemapindex[\s>]/i.test(xml);
}

function parseSitemapMeta(xml) {
  const locs = extractLocs(xml);
  const isIndex = isSitemapIndex(xml);
  return { locs, isIndex, urlCount: isIndex ? locs.length : locs.length };
}

function validateSitemapXml(xml) {
  const issues = [];
  let score = 100;
  if (!xml?.trim()) {
    return { valid: false, score: 0, urlCount: 0, issues: [{ severity: "error", message: "Empty sitemap content" }] };
  }
  if (!/<\?xml/i.test(xml) && !/<urlset/i.test(xml) && !/<sitemapindex/i.test(xml)) {
    issues.push({ severity: "error", message: "Missing XML declaration or urlset/sitemapindex root" });
    score -= 40;
  }
  const locs = extractLocs(xml);
  if (!locs.length) {
    issues.push({ severity: "error", message: "No <loc> entries found" });
    score -= 30;
  }
  for (const loc of locs.slice(0, 20)) {
    try {
      new URL(loc);
    } catch {
      issues.push({ severity: "error", message: `Invalid URL: ${loc}` });
      score -= 5;
    }
  }
  if (locs.length > 50000) {
    issues.push({ severity: "warning", message: "Sitemap exceeds 50,000 URL limit" });
    score -= 10;
  }
  return { valid: score >= 60, score: Math.max(0, score), urlCount: locs.length, issues };
}

async function resolveSitemapContent({ url, content }) {
  if (content?.trim()) return content;
  if (!url?.trim()) throw new Error("Sitemap URL or XML content required");
  return fetchText(normalizeUrl(url));
}

async function findSitemaps(siteUrl) {
  const base = normalizeUrl(siteUrl);
  const origin = new URL(base).origin;
  const candidates = new Set([
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap-index.xml`,
    `${origin}/wp-sitemap.xml`,
  ]);

  try {
    const robots = await fetchText(`${origin}/robots.txt`, { maxBytes: 100_000 });
    for (const line of robots.split("\n")) {
      const m = line.match(/^\s*sitemap:\s*(.+)$/i);
      if (m) candidates.add(m[1].trim());
    }
  } catch {
    /* ignore */
  }

  const sitemaps = [];
  for (const smUrl of candidates) {
    try {
      const xml = await fetchText(smUrl, { maxBytes: 5_000_000 });
      const meta = parseSitemapMeta(xml);
      const validation = validateSitemapXml(xml);
      sitemaps.push({
        url: smUrl,
        valid: validation.valid,
        urlCount: meta.urlCount,
        isIndex: meta.isIndex,
      });
    } catch {
      /* skip unreachable */
    }
  }
  return sitemaps;
}

function extractLinks(html, baseUrl) {
  const links = new Set();
  const base = new URL(baseUrl);
  const re = /<a\s[^>]*href\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const href = m[1].trim();
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("javascript:")) continue;
      const abs = new URL(href, base).href.split("#")[0];
      if (abs.startsWith(base.origin)) links.add(abs);
    } catch {
      /* skip */
    }
  }
  return [...links];
}

async function crawlWebsite(startUrl, maxUrls = 200, maxDepth = 3) {
  const origin = new URL(normalizeUrl(startUrl)).origin;
  const queue = [{ url: normalizeUrl(startUrl), depth: 0 }];
  const seen = new Set();
  const urls = [];

  while (queue.length && urls.length < maxUrls) {
    const { url, depth } = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
    if (depth >= maxDepth) continue;
    try {
      const html = await fetchText(url);
      for (const link of extractLinks(html, url)) {
        if (!seen.has(link) && link.startsWith(origin)) queue.push({ url: link, depth: depth + 1 });
      }
    } catch {
      /* skip */
    }
  }
  return urls;
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlToMarkdown(html) {
  let md = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n")
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n#### $1\n")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n")
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**")
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*")
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "*$1*")
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, "\n```\n$1\n```\n")
    .replace(/<[^>]+>/g, "");
  md = md
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return md;
}

function jsonToMarkdown(value, depth = 0) {
  const pad = "  ".repeat(depth);
  if (value === null || value === undefined) return `${pad}- null`;
  if (typeof value !== "object") return `${pad}- ${String(value)}`;
  if (Array.isArray(value)) {
    return value.map((item, i) => `${pad}- [${i}] ${typeof item === "object" ? "\n" + jsonToMarkdown(item, depth + 1) : item}`).join("\n");
  }
  return Object.entries(value)
    .map(([k, v]) => {
      if (v && typeof v === "object") return `${pad}**${k}**\n${jsonToMarkdown(v, depth + 1)}`;
      return `${pad}**${k}**: ${v}`;
    })
    .join("\n");
}

function parseCsvRows(csv) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    const next = csv[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

function csvToMarkdown(csv) {
  const rows = parseCsvRows(csv.trim());
  if (!rows.length) return "";
  const header = rows[0];
  const lines = [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...rows.slice(1).map((r) => `| ${r.map((c) => c.replace(/\|/g, "\\|")).join(" | ")} |`),
  ];
  return lines.join("\n");
}

function xmlToMarkdown(xml) {
  const lines = [];
  const tagRe = /<([a-zA-Z0-9_-]+)(?:\s[^>]*)?>([^<]*)<\/\1>/g;
  let m;
  while ((m = tagRe.exec(xml))) {
    const val = m[2].trim();
    if (val) lines.push(`**${m[1]}**: ${val}`);
  }
  return lines.length ? lines.join("\n") : stripHtml(xml);
}

function rtfToMarkdown(rtf) {
  const plain = rtf
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\'[0-9a-f]{2}/gi, (h) => String.fromCharCode(parseInt(h.slice(2), 16)))
    .replace(/\\[a-z]+\d* ?/gi, "")
    .replace(/[{}]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return plain;
}

function readZipEntry(buffer, targetName) {
  let offset = 0;
  while (offset < buffer.length - 30) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) break;
    const compMethod = buffer.readUInt16LE(offset + 8);
    const compSize = buffer.readUInt32LE(offset + 18);
    const nameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);
    const name = buffer.toString("utf8", offset + 30, offset + 30 + nameLen);
    const dataStart = offset + 30 + nameLen + extraLen;
    const data = buffer.subarray(dataStart, dataStart + compSize);
    if (name === targetName || name.endsWith(`/${targetName}`)) {
      if (compMethod === 0) return data.toString("utf8");
      if (compMethod === 8) return inflateRawSync(data).toString("utf8");
    }
    offset = dataStart + compSize;
  }
  return null;
}

function extractDocxText(buffer) {
  const xml = readZipEntry(buffer, "word/document.xml");
  if (!xml) throw new Error("Could not read DOCX content");
  const text = xml
    .replace(/<w:tab[^/]*\/>/g, "\t")
    .replace(/<w:br[^/]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text;
}

function extractPdfText(buffer) {
  const raw = buffer.toString("latin1");
  const chunks = [];
  const tjRe = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj/g;
  let m;
  while ((m = tjRe.exec(raw))) chunks.push(m[1].replace(/\\([nrtbf()\\])/g, (_, c) => ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\" }[c] || c)));
  if (!chunks.length) {
    const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    while ((m = streamRe.exec(raw))) {
      const s = m[1].replace(/[^\x20-\x7E\n]/g, " ");
      if (s.trim().length > 20) chunks.push(s.trim());
    }
  }
  return chunks.join(" ").replace(/\s+/g, " ").trim() || "No extractable text found in PDF.";
}

function parseRobotsTxt(content) {
  const groups = [];
  const sitemaps = [];
  const issues = [];
  let current = null;
  let score = 100;

  for (const line of content.split("\n")) {
    const trimmed = line.split("#")[0].trim();
    if (!trimmed) continue;
    const [directive, ...rest] = trimmed.split(":");
    const value = rest.join(":").trim();
    const key = directive.toLowerCase();

    if (key === "user-agent") {
      current = { agent: value, rules: [] };
      groups.push(current);
    } else if (key === "disallow" || key === "allow") {
      if (!current) {
        current = { agent: "*", rules: [] };
        groups.push(current);
      }
      current.rules.push({ type: key, path: value || "/" });
    } else if (key === "sitemap") {
      sitemaps.push(value);
    } else if (key === "crawl-delay") {
      if (!current) {
        current = { agent: "*", rules: [] };
        groups.push(current);
      }
      current.crawlDelay = value;
    } else if (!["host"].includes(key)) {
      issues.push({ severity: "warning", message: `Unknown directive: ${directive}` });
      score -= 2;
    }
  }

  if (!groups.length) {
    issues.push({ severity: "warning", message: "No User-agent groups found" });
    score -= 10;
  }
  if (!sitemaps.length) {
    issues.push({ severity: "info", message: "No Sitemap directive found" });
  }

  return { groups, sitemaps, issues, score: Math.max(0, score), content };
}

function testRobotsPath(groups, path) {
  const testPath = path.startsWith("/") ? path : `/${path}`;
  let allowed = true;
  for (const group of groups) {
    if (group.agent !== "*" && group.agent !== "Googlebot") continue;
    for (const rule of group.rules) {
      if (!rule.path || rule.path === "/") continue;
      const prefix = rule.path.endsWith("*") ? rule.path.slice(0, -1) : rule.path;
      if (testPath.startsWith(prefix)) allowed = rule.type === "allow";
    }
  }
  return { path: testPath, allowed };
}

function sitemapAnalytics(xml) {
  const locs = extractLocs(xml);
  const extensions = {};
  const depths = {};
  const protocols = {};
  for (const loc of locs) {
    try {
      const u = new URL(loc);
      protocols[u.protocol] = (protocols[u.protocol] || 0) + 1;
      const depth = u.pathname.split("/").filter(Boolean).length;
      depths[depth] = (depths[depth] || 0) + 1;
      const ext = u.pathname.includes(".") ? u.pathname.split(".").pop().toLowerCase() : "(none)";
      extensions[ext] = (extensions[ext] || 0) + 1;
    } catch {
      /* skip */
    }
  }
  const changefreq = {};
  const priority = {};
  const cfRe = /<changefreq>\s*([^<]+)\s*<\/changefreq>/gi;
  const prRe = /<priority>\s*([^<]+)\s*<\/priority>/gi;
  let m;
  while ((m = cfRe.exec(xml))) changefreq[m[1].trim()] = (changefreq[m[1].trim()] || 0) + 1;
  while ((m = prRe.exec(xml))) priority[m[1].trim()] = (priority[m[1].trim()] || 0) + 1;
  return { totalUrls: locs.length, extensions, depths, protocols, changefreq, priority, sampleUrls: locs.slice(0, 10) };
}

function buildSitemapXml(urls, { priority = "0.5", changefreq = "weekly" } = {}) {
  const entries = urls
    .map(
      (loc) =>
        `  <url>\n    <loc>${loc}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>`;
}

async function aiText(system, user, { maxTokens = 1200 } = {}) {
  const { content, ai } = await chatCompletion({
    model: getModels().default,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    maxTokens,
  });
  return { content, ai };
}

function parseFaqJson(text) {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return null;
  try {
    const arr = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(arr)) return null;
    return arr
      .map((item) => ({
        question: String(item.question || item.q || "").trim(),
        answer: String(item.answer || item.a || "").trim(),
      }))
      .filter((f) => f.question && f.answer);
  } catch {
    return null;
  }
}

function templateFaqs(content, count = 5) {
  const sentences = content.split(/[.!?。！？\n]+/).map((s) => s.trim()).filter((s) => s.length > 20);
  const faqs = [];
  for (let i = 0; i < Math.min(count, sentences.length); i++) {
    const s = sentences[i];
    faqs.push({
      question: `What should I know about: ${s.slice(0, 60)}?`,
      answer: s,
    });
  }
  while (faqs.length < Math.min(count, 3)) {
    faqs.push({
      question: "What is this content about?",
      answer: content.slice(0, 300) || "No content provided.",
    });
  }
  return faqs.slice(0, count);
}

async function generateFaqs(content, count = 10) {
  const system =
    "You generate FAQ pairs from source content. Reply with ONLY a JSON array: [{\"question\":\"...\",\"answer\":\"...\"}]. No markdown fences.";
  const user = `Generate ${count} FAQ pairs from this content:\n\n${content.slice(0, 12000)}`;
  const { content: reply, ai } = await aiText(system, user, { maxTokens: 2000 });
  if (ai && reply) {
    const parsed = parseFaqJson(reply);
    if (parsed?.length) return { faqs: parsed.slice(0, count), ai: true };
  }
  return { faqs: templateFaqs(content, count), ai: false };
}

const GENERATE_PROMPTS = {
  "conversation-analysis": (input) =>
    `Analyze this chatbot conversation log. Identify knowledge gaps, unanswered questions, and improvement suggestions:\n\n${input}`,
  prompt: (input, opts) =>
    `Create an optimized AI prompt using the ${opts?.framework || "APE"} framework for this task:\n${input}`,
  "prompt-optimize": (input, opts) =>
    `Improve this prompt using the ${opts?.framework || "APE"} framework. Return only the improved prompt:\n${input}`,
  reply: (input, opts) => `Write a ${opts?.tone || "professional"} reply to this message:\n\n${input}`,
  answer: (input) => `Provide a clear, accurate answer to this question:\n\n${input}`,
  email: (input, opts) => `Write a ${opts?.tone || "professional"} email response to:\n\n${input}`,
  letter: (input, opts) => `Write a ${opts?.letterType || "general"} letter based on:\n\n${input}`,
  "blog-title": (input, opts) => `Generate ${opts?.count || 10} engaging blog title ideas for: ${input}`,
  "chatbot-name": (input, opts) =>
    `Suggest ${opts?.count || 10} creative chatbot names for brand/product: ${opts?.brand || input || "chatbot"}`,
  "saas-brand": (input, opts) =>
    `Suggest ${opts?.count || 10} SaaS brand names for industry: ${opts?.industry || input || "saas"}`,
  "customer-script": (input) => `Write a customer service script for this scenario:\n\n${input}`,
  "ai-search-visibility": (input, opts) =>
    `Analyze AI search visibility for keyword "${opts?.keyword || input}"${opts?.url ? ` on ${opts.url}` : ""}. Engines: ${opts?.engines || "Perplexity, ChatGPT"}. Content:\n${(opts?.content || "").slice(0, 4000)}`,
  "qa-article": (input, opts) =>
    `Write a structured Q&A article about "${opts?.keyword || input}" in a ${opts?.tone || "professional"} tone.`,
  "vlog-meta": (input, opts) =>
    `Generate ${opts?.count || 5} ${opts?.style || "engaging"} video titles and a full description for:\n\n${input}`,
  "video-chapters": (input) => `Create timestamped video chapters from this transcript:\n\n${input}`,
  "broll-script": (input) => `Create B-roll shot suggestions and scripts for this narration:\n\n${input}`,
  "cs-qa-analysis": (input) => `Analyze this customer service conversation for tone, accuracy, and improvements:\n\n${input}`,
  prd: (input) => `Draft a Product Requirements Document (PRD) for:\n\n${input}`,
  "email-tone": (input, opts) => `Rewrite this email in a ${opts?.tone || "professional"} tone:\n\n${input}`,
  "subscription-pricing": (input, opts) =>
    `Recommend SaaS subscription pricing tiers. Product:\n${input}\nMarket: ${opts?.market || "SMB"}\nCompetitors: ${opts?.competitors || "N/A"}`,
  "vc-simulator": (input, opts) =>
    `Generate a simulated VC term sheet (${opts?.stage || "seed"} stage) for:\n\n${input}`,
};

function templateGenerate(type, input, options) {
  const fn = GENERATE_PROMPTS[type];
  const prompt = fn ? fn(input, options) : `Process this:\n${input}`;
  return `[Template — set OPENROUTER_API_KEY for AI]\n\n${prompt.slice(0, 800)}`;
}

async function handleGenerate({ type, input, options }) {
  if (!input?.trim()) throw new Error("Input is required");
  const fn = GENERATE_PROMPTS[type];
  if (!fn) throw new Error(`Unknown generate type: ${type}`);
  const system = "You are Sitp GPT, a helpful AI assistant for business and marketing tools. Be concise and actionable.";
  const user = fn(input, options || {});
  const { content, ai } = await aiText(system, user, { maxTokens: 2000 });
  return ok({ result: content || templateGenerate(type, input, options), ai: ai && Boolean(content) });
}

const PRICING_CONTEXT = `Sitp GPT plans:
- Free: $0 — basic tools
- Starter: $${PLANS.starter.monthly}/mo (${PLANS.starter.yearly}/yr) — 7-day trial
- Growth: $${PLANS.growth.monthly}/mo (${PLANS.growth.yearly}/yr) — popular, API access
- Scale: $${PLANS.scale.monthly}/mo (${PLANS.scale.yearly}/yr) — high volume
- Installation: $${PLANS.installation.onetime} one-time white-glove setup
Add-ons: Remove branding +$39/mo, Extra 5,000 messages +$39/mo`;

// ─── Sitemap routes ───────────────────────────────────────────────────────────

router.post("/sitemap/checker", wrap(async (req, res) => {
  const { url } = req.body || {};
  if (!url) return fail(res, "Website URL required");
  const sitemaps = await findSitemaps(url);
  res.json(ok({ sitemaps }));
}));

router.post("/sitemap/validator", wrap(async (req, res) => {
  const xml = await resolveSitemapContent(req.body || {});
  const result = validateSitemapXml(xml);
  res.json(ok(result));
}));

router.post("/sitemap/generator", wrap(async (req, res) => {
  const { url, maxUrls = 500, maxDepth = 2, priority = "0.5", changefreq = "weekly" } = req.body || {};
  if (!url) return fail(res, "Website URL required");
  const urls = await crawlWebsite(url, Number(maxUrls), Number(maxDepth));
  const content = buildSitemapXml(urls, { priority, changefreq });
  res.json(ok({ content, count: urls.length }));
}));

router.post("/sitemap/extract", wrap(async (req, res) => {
  const { sitemapUrl, maxUrls = 1000, includePaths, excludePaths } = req.body || {};
  if (!sitemapUrl) return fail(res, "Sitemap URL required");
  const xml = await fetchText(normalizeUrl(sitemapUrl));
  let urls = extractLocs(xml);
  const includes = String(includePaths || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const excludes = String(excludePaths || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  if (includes.length) urls = urls.filter((u) => includes.some((p) => u.includes(p)));
  if (excludes.length) urls = urls.filter((u) => !excludes.some((p) => u.includes(p)));
  urls = urls.slice(0, Number(maxUrls));
  res.json(ok({ urls, count: urls.length }));
}));

router.post("/sitemap/compare", wrap(async (req, res) => {
  const { sitemap1, sitemap2 } = req.body || {};
  if (!sitemap1 || !sitemap2) return fail(res, "Both sitemap XML inputs required");
  const set1 = new Set(extractLocs(sitemap1));
  const set2 = new Set(extractLocs(sitemap2));
  const added = [...set2].filter((u) => !set1.has(u));
  const removed = [...set1].filter((u) => !set2.has(u));
  const unchangedCount = [...set1].filter((u) => set2.has(u)).length;
  res.json(ok({ added, removed, addedCount: added.length, removedCount: removed.length, unchangedCount }));
}));

router.post("/sitemap/split-merge", wrap(async (req, res) => {
  const { action = "split", content, sitemaps, chunkSize = 50000 } = req.body || {};
  if (action === "split") {
    if (!content) return fail(res, "Sitemap XML required for split");
    const locs = extractLocs(content);
    const size = Number(chunkSize) || 50000;
    const files = [];
    for (let i = 0; i < locs.length; i += size) {
      const chunk = locs.slice(i, i + size);
      files.push({ name: `sitemap-${Math.floor(i / size) + 1}.xml`, content: buildSitemapXml(chunk) });
    }
    return res.json(ok({ files }));
  }
  const parts = Array.isArray(sitemaps) ? sitemaps : [];
  if (!parts.length) return fail(res, "Sitemap XML list required for merge");
  const merged = new Set();
  for (const xml of parts) for (const loc of extractLocs(xml)) merged.add(loc);
  const all = [...merged];
  res.json(ok({ content: buildSitemapXml(all), totalUrls: all.length }));
}));

router.post("/sitemap/analytics", wrap(async (req, res) => {
  const { content } = req.body || {};
  if (!content) return fail(res, "Sitemap XML required");
  res.json(ok(sitemapAnalytics(content)));
}));

router.post("/sitemap/index-generator", wrap(async (req, res) => {
  const { sitemapUrls } = req.body || {};
  const urls = String(sitemapUrls || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!urls.length) return fail(res, "At least one sitemap URL required");
  const entries = urls
    .map((loc) => `  <sitemap>\n    <loc>${loc}</loc>\n  </sitemap>`)
    .join("\n");
  const content = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>`;
  res.json(ok({ content }));
}));

router.post("/sitemap/robots-generator", wrap(async (req, res) => {
  const { sitemaps, disallow, allow, crawlDelay, userAgent = "*" } = req.body || {};
  const lines = [`User-agent: ${userAgent || "*"}`];
  for (const p of String(disallow || "").split("\n").map((s) => s.trim()).filter(Boolean)) lines.push(`Disallow: ${p}`);
  for (const p of String(allow || "").split("\n").map((s) => s.trim()).filter(Boolean)) lines.push(`Allow: ${p}`);
  if (crawlDelay) lines.push(`Crawl-delay: ${crawlDelay}`);
  for (const sm of String(sitemaps || "").split("\n").map((s) => s.trim()).filter(Boolean)) lines.push(`Sitemap: ${sm}`);
  res.json(ok({ content: lines.join("\n") }));
}));

router.post("/sitemap/frequency", wrap(async (req, res) => {
  const { content } = req.body || {};
  if (!content) return fail(res, "Sitemap XML required");
  const data = sitemapAnalytics(content);
  res.json(ok({ changefreq: data.changefreq, priority: data.priority, totalUrls: data.totalUrls }));
}));

// ─── Crawl & robots ───────────────────────────────────────────────────────────

router.post("/crawl/website", wrap(async (req, res) => {
  const { url, maxUrls = 200, maxDepth = 3 } = req.body || {};
  if (!url) return fail(res, "Website URL required");
  const urls = await crawlWebsite(url, Number(maxUrls), Number(maxDepth));
  res.json(ok({ urls, count: urls.length }));
}));

router.post("/robots/checker", wrap(async (req, res) => {
  const { url, content, testPath } = req.body || {};
  let robotsContent = content;
  if (!robotsContent?.trim()) {
    if (!url) return fail(res, "Website URL or robots.txt content required");
    robotsContent = await fetchText(`${normalizeUrl(url).replace(/\/$/, "")}/robots.txt`.replace(/([^:]\/)\/+/g, "$1"));
  }
  const parsed = parseRobotsTxt(robotsContent);
  const result = { ...parsed, score: parsed.score };
  if (testPath) result.pathTest = testRobotsPath(parsed.groups, testPath);
  res.json(ok(result));
}));

// ─── Converters ───────────────────────────────────────────────────────────────

router.post("/convert/json", wrap(async (req, res) => {
  const { content } = req.body || {};
  if (!content) return fail(res, "JSON content required");
  const obj = JSON.parse(content);
  res.json(ok({ markdown: jsonToMarkdown(obj) }));
}));

router.post("/convert/csv", wrap(async (req, res) => {
  const { content } = req.body || {};
  if (!content) return fail(res, "CSV content required");
  res.json(ok({ markdown: csvToMarkdown(content) }));
}));

router.post("/convert/html", wrap(async (req, res) => {
  const { content } = req.body || {};
  if (!content) return fail(res, "HTML content required");
  res.json(ok({ markdown: htmlToMarkdown(content) }));
}));

router.post("/convert/xml", wrap(async (req, res) => {
  const { content } = req.body || {};
  if (!content) return fail(res, "XML content required");
  res.json(ok({ markdown: xmlToMarkdown(content) }));
}));

router.post("/convert/rtf", wrap(async (req, res) => {
  const { content } = req.body || {};
  if (!content) return fail(res, "RTF content required");
  res.json(ok({ markdown: rtfToMarkdown(content) }));
}));

router.post("/convert/paste", wrap(async (req, res) => {
  const { content } = req.body || {};
  if (!content) return fail(res, "Content required");
  const md = content.includes("<") ? htmlToMarkdown(content) : content;
  res.json(ok({ markdown: md }));
}));

router.post("/convert/webpage", wrap(async (req, res) => {
  const { url } = req.body || {};
  if (!url) return fail(res, "URL required");
  const html = await fetchText(normalizeUrl(url));
  res.json(ok({ markdown: htmlToMarkdown(html) }));
}));

router.post("/convert/notion", wrap(async (req, res) => {
  const { url } = req.body || {};
  if (!url) return fail(res, "Notion URL required");
  let pageUrl = normalizeUrl(url);
  if (!pageUrl.includes("notion.site") && pageUrl.includes("notion.so")) {
    pageUrl = pageUrl.replace("notion.so", "notion.site");
  }
  const html = await fetchText(pageUrl);
  res.json(ok({ markdown: htmlToMarkdown(html), note: "Converted from public Notion page HTML" }));
}));

router.post("/convert/google-docs", wrap(async (req, res) => {
  const { url } = req.body || {};
  if (!url) return fail(res, "Google Docs URL required");
  const docId = url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1];
  if (!docId) return fail(res, "Could not parse Google Docs ID from URL");
  const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
  const text = await fetchText(exportUrl);
  res.json(ok({ markdown: text }));
}));

router.post("/convert/pdf", upload.single("file"), wrap(async (req, res) => {
  if (!req.file) return fail(res, "PDF file required");
  const text = extractPdfText(req.file.buffer);
  res.json(ok({ markdown: text }));
}));

router.post("/convert/docx", upload.single("file"), wrap(async (req, res) => {
  if (!req.file) return fail(res, "DOCX file required");
  const text = extractDocxText(req.file.buffer);
  res.json(ok({ markdown: text }));
}));

// ─── AI routes ────────────────────────────────────────────────────────────────

router.post("/ai/assistant", wrap(async (req, res) => {
  const { message, history = [] } = req.body || {};
  if (!message?.trim()) return fail(res, "Message required");
  const system =
    "You are Sitp GPT, the AI assistant for yoursite.asia — a platform with 60+ SEO/sitemap/converter/AI tools and chatbot plans (Starter $39, Growth $79, Scale $259/mo). Answer briefly and helpfully about tools, pricing, and setup. Bilingual OK.";
  const messages = [
    { role: "system", content: system },
    ...history.slice(-10).map((h) => ({ role: h.role === "assistant" ? "assistant" : "user", content: h.content })),
    { role: "user", content: message },
  ];
  const { content, ai } = await chatCompletion({ model: getModels().default, messages, maxTokens: 800 });
  const reply =
    content ||
    `Thanks for your question about Sitp GPT! Browse our 60+ free tools at https://yoursite.asia/tools or see pricing at /pricing.html. For AI-powered answers, set OPENROUTER_API_KEY on the server.\n\n您的问题：${message}`;
  res.json(ok({ reply, ai: ai && Boolean(content) }));
}));

router.post("/ai/chat", wrap(async (req, res) => {
  const { context, message } = req.body || {};
  if (!message) return fail(res, "Message required");
  const system = "Answer questions based only on the provided context. If unsure, say so.";
  const user = `Context:\n${(context || "").slice(0, 12000)}\n\nQuestion: ${message}`;
  const { content, ai } = await aiText(system, user);
  res.json(ok({ reply: content || `Based on the text: ${message}`, ai: ai && Boolean(content) }));
}));

router.post("/ai/chat/website", wrap(async (req, res) => {
  const { url, message } = req.body || {};
  if (!url || !message) return fail(res, "URL and message required");
  const html = await fetchText(normalizeUrl(url));
  const context = stripHtml(html).slice(0, 12000);
  const system = "Answer questions based only on the webpage content provided.";
  const user = `Webpage content:\n${context}\n\nQuestion: ${message}`;
  const { content, ai } = await aiText(system, user);
  res.json(ok({ reply: content || `Regarding ${url}: ${message}`, ai: ai && Boolean(content) }));
}));

router.post("/ai/chat/document", upload.single("file"), wrap(async (req, res) => {
  const { message, content: pasted } = req.body || {};
  if (!message) return fail(res, "Message required");
  let context = pasted || "";
  if (req.file) {
    const name = req.file.originalname.toLowerCase();
    if (name.endsWith(".pdf")) context = extractPdfText(req.file.buffer);
    else if (name.endsWith(".docx")) context = extractDocxText(req.file.buffer);
    else context = req.file.buffer.toString("utf8");
  }
  if (!context.trim()) return fail(res, "Document content or file required");
  const system = "Answer questions based only on the document content.";
  const user = `Document:\n${context.slice(0, 12000)}\n\nQuestion: ${message}`;
  const { content, ai } = await aiText(system, user);
  res.json(ok({ reply: content || `About the document: ${message}`, ai: ai && Boolean(content) }));
}));

router.post("/ai/generate", wrap(async (req, res) => {
  const result = await handleGenerate(req.body || {});
  res.json(result);
}));

// ─── FAQ routes ───────────────────────────────────────────────────────────────

router.post("/faq/generate", wrap(async (req, res) => {
  const { content, count = 10 } = req.body || {};
  if (!content) return fail(res, "Content required");
  const { faqs, ai } = await generateFaqs(content, Number(count));
  res.json(ok({ faqs, ai }));
}));

router.post("/faq/website", wrap(async (req, res) => {
  const { urls, count = 10 } = req.body || {};
  const list = String(urls || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);
  if (!list.length) return fail(res, "At least one URL required");
  const parts = [];
  for (const u of list) {
    try {
      const html = await fetchText(normalizeUrl(u));
      parts.push(stripHtml(html).slice(0, 4000));
    } catch {
      /* skip */
    }
  }
  const { faqs, ai } = await generateFaqs(parts.join("\n\n"), Number(count));
  res.json(ok({ faqs, ai }));
}));

router.post("/faq/webpage", wrap(async (req, res) => {
  const { url, count = 10 } = req.body || {};
  if (!url) return fail(res, "URL required");
  const html = await fetchText(normalizeUrl(url));
  const { faqs, ai } = await generateFaqs(stripHtml(html), Number(count));
  res.json(ok({ faqs, ai }));
}));

router.post("/faq/pdf", upload.single("file"), wrap(async (req, res) => {
  if (!req.file) return fail(res, "PDF file required");
  const { count = 10 } = req.body || {};
  const text = extractPdfText(req.file.buffer);
  const { faqs, ai } = await generateFaqs(text, Number(count));
  res.json(ok({ faqs, ai }));
}));

router.post("/faq/docx", upload.single("file"), wrap(async (req, res) => {
  if (!req.file) return fail(res, "DOCX file required");
  const { count = 10 } = req.body || {};
  const text = extractDocxText(req.file.buffer);
  const { faqs, ai } = await generateFaqs(text, Number(count));
  res.json(ok({ faqs, ai }));
}));

router.post("/faq/html", wrap(async (req, res) => {
  const { content, count = 10 } = req.body || {};
  if (!content) return fail(res, "HTML content required");
  const { faqs, ai } = await generateFaqs(stripHtml(content), Number(count));
  res.json(ok({ faqs, ai }));
}));

router.post("/faq/google-docs", wrap(async (req, res) => {
  const { url, count = 10 } = req.body || {};
  if (!url) return fail(res, "Google Docs URL required");
  const docId = url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1];
  if (!docId) return fail(res, "Could not parse Google Docs ID");
  const text = await fetchText(`https://docs.google.com/document/d/${docId}/export?format=txt`);
  const { faqs, ai } = await generateFaqs(text, Number(count));
  res.json(ok({ faqs, ai }));
}));

router.post("/faq/notion", wrap(async (req, res) => {
  const { url, count = 10 } = req.body || {};
  if (!url) return fail(res, "Notion URL required");
  const html = await fetchText(normalizeUrl(url));
  const { faqs, ai } = await generateFaqs(stripHtml(html), Number(count));
  res.json(ok({ faqs, ai }));
}));

// ─── Utility routes ───────────────────────────────────────────────────────────

router.post("/util/roi", wrap(async (req, res) => {
  const { ticketsPerMonth = 1000, avgHandleMinutes = 10, agentHourlyRate = 25, automationRate = 0.7, chatbotCost = 99 } =
    req.body || {};
  const tickets = Number(ticketsPerMonth);
  const minutes = Number(avgHandleMinutes);
  const rate = Number(agentHourlyRate);
  const auto = Number(automationRate);
  const cost = Number(chatbotCost);
  const manualHours = (tickets * minutes) / 60;
  const savedHours = manualHours * auto;
  const savedCost = savedHours * rate;
  const netSavings = savedCost - cost;
  const roi = cost > 0 ? ((netSavings / cost) * 100).toFixed(1) + "%" : "N/A";
  res.json(
    ok({
      monthlyTickets: tickets,
      manualHours: manualHours.toFixed(1),
      hoursSaved: savedHours.toFixed(1),
      costSaved: `$${savedCost.toFixed(2)}`,
      chatbotCost: `$${cost.toFixed(2)}`,
      netMonthlySavings: `$${netSavings.toFixed(2)}`,
      roi,
    })
  );
}));

router.post("/util/saas-cost", wrap(async (req, res) => {
  const {
    monthlyUsers = 1000,
    apiCallsPerMonth = 500000,
    serverCostMonthly = 200,
    apiCostPer1k = 0.002,
    avgRevenuePerUser = 9.99,
  } = req.body || {};
  const users = Number(monthlyUsers);
  const calls = Number(apiCallsPerMonth);
  const server = Number(serverCostMonthly);
  const apiPer1k = Number(apiCostPer1k);
  const arpu = Number(avgRevenuePerUser);
  const apiCost = (calls / 1000) * apiPer1k;
  const totalCost = server + apiCost;
  const revenue = users * arpu;
  const margin = revenue - totalCost;
  const marginPct = revenue > 0 ? ((margin / revenue) * 100).toFixed(1) + "%" : "0%";
  const costPerUser = users > 0 ? (totalCost / users).toFixed(4) : "0";
  res.json(
    ok({
      monthlyRevenue: `$${revenue.toFixed(2)}`,
      serverCost: `$${server.toFixed(2)}`,
      apiCost: `$${apiCost.toFixed(2)}`,
      totalCost: `$${totalCost.toFixed(2)}`,
      grossMargin: `$${margin.toFixed(2)}`,
      marginPercent: marginPct,
      costPerUser: `$${costPerUser}`,
    })
  );
}));

router.post("/util/email-signature", wrap(async (req, res) => {
  const { name, title, company, email, phone, website, linkedin } = req.body || {};
  if (!name) return fail(res, "Name required");
  const lines = [`<strong>${name}</strong>`];
  if (title) lines.push(title);
  if (company) lines.push(company);
  if (email) lines.push(`<a href="mailto:${email}">${email}</a>`);
  if (phone) lines.push(phone);
  if (website) lines.push(`<a href="${website}">${website.replace(/^https?:\/\//, "")}</a>`);
  if (linkedin) lines.push(`<a href="${linkedin}">LinkedIn</a>`);
  const signature = `<table cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:14px;color:#333"><tr><td>${lines.join("<br>")}</td></tr></table>`;
  res.json(ok({ signature, content: signature }));
}));

// ─── OpenRouter routes ────────────────────────────────────────────────────────

router.get("/openrouter/config", (_req, res) => {
  const models = getModels();
  res.json({
    configured: isAiEnabled(),
    model: models.advisor,
    site: process.env.OPENROUTER_SITE_URL || "https://yoursite.asia",
  });
});

router.post("/openrouter/pricing-advisor", wrap(async (req, res) => {
  const { message, history = [] } = req.body || {};
  if (!message?.trim()) return fail(res, "Message required");
  const system = `You are Sitp GPT pricing advisor. ${PRICING_CONTEXT} Recommend a plan based on team size, message volume, and budget. Be specific and mention trial options.`;
  const messages = [
    { role: "system", content: system },
    ...history.slice(-8).map((h) => ({ role: h.role === "assistant" ? "assistant" : "user", content: h.content })),
    { role: "user", content: message },
  ];
  const { content, ai } = await chatCompletion({ model: getModels().advisor, messages, maxTokens: 1000 });
  const reply =
    content ||
    `Based on your question, consider Growth ($${PLANS.growth.monthly}/mo) for most teams or Starter ($${PLANS.starter.monthly}/mo) for smaller volume. Set OPENROUTER_API_KEY for personalized AI advice.\n\n您的问题：${message}`;
  res.json(ok({ reply, ai: ai && Boolean(content) }));
}));

export default router;
