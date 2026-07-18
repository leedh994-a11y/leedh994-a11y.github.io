#!/usr/bin/env python3
"""
Sitp GPT — SEO page generator.

Generates (all additive, never touches existing pages):
  * seo/       — 1,000 keyword landing pages (programmatic SEO) + seo/index.html hub
  * tools/     — 62 tool landing pages (one SEO entry per free tool) + tools/index.html hub
  * sitemap.xml, robots.txt

Run from the repository root:  python3 scripts/generate_seo_pages.py
Re-running regenerates the same deterministic output.
"""

import hashlib
import os
import re

SITE = "https://yoursite.asia"
OUT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---------------------------------------------------------------- topics

TOPICS = [
    ("ai-customer-service-bot", "AI Customer Service Bot (AI客服机器人)",
     "an AI customer service bot that answers customer questions instantly, 24/7, trained on your own content"),
    ("ai-chatbot-for-shopify", "AI Chatbot for Shopify",
     "an AI chatbot built for Shopify stores that answers order, shipping and product questions automatically"),
    ("ai-customer-support-automation", "AI Customer Support Automation",
     "AI customer support automation that resolves up to 80% of tickets without human agents"),
    ("pdf-chatbot", "PDF Chatbot",
     "a PDF chatbot that lets customers and teams chat with PDF documents and get instant answers"),
    ("website-ai-assistant", "Website AI Assistant",
     "a website AI assistant that greets visitors, answers questions and captures leads on any site"),
    ("ai-faq-generator", "AI FAQ Generator",
     "an AI FAQ generator that turns your pages and docs into ready-to-publish FAQ sections"),
    ("sitemap-generator", "Sitemap Generator",
     "a free sitemap generator that builds XML sitemaps for better search-engine indexing"),
]

INTENTS = [
    ("best", "Best {t} in 2026"), ("free", "Free {t}"), ("top", "Top {t} Picks"),
    ("how-to-use", "How to Use {t}"), ("what-is", "What Is {t}?"),
    ("pricing", "{t} Pricing"), ("alternatives", "{t} Alternatives"),
    ("review", "{t} Review"), ("guide", "{t} — Complete Guide"),
    ("tutorial", "{t} Tutorial"), ("examples", "{t} Examples"),
    ("no-code", "No-Code {t}"),
]

PLATFORMS = [
    "shopify", "wordpress", "wix", "squarespace", "webflow", "woocommerce",
    "magento", "bigcommerce", "prestashop", "opencart", "ghost", "hubspot",
    "salesforce", "zendesk", "intercom", "crisp", "whatsapp", "slack",
    "telegram", "messenger", "instagram", "facebook", "gmail", "outlook",
    "notion", "airtable", "zapier", "stripe", "paypal", "etsy",
    "amazon-sellers", "ebay-sellers", "godaddy", "framer", "bubble",
]

INDUSTRIES = [
    "ecommerce", "saas", "real-estate", "healthcare", "education", "travel",
    "hotels", "restaurants", "law-firms", "agencies", "finance", "insurance",
    "automotive", "fitness", "beauty-salons", "dental-clinics", "logistics",
    "recruitment", "nonprofits", "gaming", "fashion", "electronics",
    "furniture", "food-delivery", "b2b", "startups", "small-business",
    "freelancers", "consultants", "photographers", "event-planning",
    "property-management", "medical-clinics", "veterinary", "pharmacies",
    "banking", "crypto", "marketplaces", "subscription-boxes", "coaching",
    "online-courses", "publishers", "news-sites", "blogs", "portfolios",
    "landing-pages", "local-business", "restaurants-delivery", "car-rental",
    "home-services",
]

USE_CASES = [
    "lead-generation", "faq-automation", "order-tracking",
    "appointment-booking", "multilingual-support", "after-hours-support",
    "ticket-deflection", "customer-onboarding", "sales-assistant",
    "feedback-collection", "abandoned-cart-recovery", "product-recommendations",
    "returns-and-refunds", "shipping-questions", "knowledge-base-search",
    "live-chat-replacement", "email-capture", "customer-analytics",
    "seo-content", "documentation-search",
]

AUDIENCES = [
    "small-teams", "enterprises", "developers", "marketers", "founders",
    "support-managers", "sales-teams", "customer-success", "solopreneurs",
    "online-stores", "service-businesses", "b2c-brands",
]

COMPETITORS = [
    "chatbase", "intercom-fin", "tidio", "zendesk-ai", "drift", "crisp-chat",
    "botpress", "chatfuel", "manychat", "ada-cx", "freshchat", "tawk-to",
    "livechat", "hubspot-chatbot", "kommunicate",
]

# ---------------------------------------------------------------- tools (62)

TOOLS = [
    ("sitemap-generator", "Sitemap Generator", "Instantly generate an XML sitemap for any website."),
    ("visual-sitemap-builder", "Visual Sitemap Builder", "Draw and export visual sitemaps for site planning."),
    ("sitemap-validator", "Sitemap Validator", "Validate XML sitemaps against search-engine rules."),
    ("sitemap-to-csv", "Sitemap to CSV Converter", "Convert XML sitemaps into spreadsheet-ready CSV."),
    ("robots-txt-generator", "Robots.txt Generator", "Create a correct robots.txt file in seconds."),
    ("broken-link-checker", "Broken Link Checker", "Find broken links across your website."),
    ("meta-tag-generator", "Meta Tag Generator", "Generate SEO title and description meta tags."),
    ("open-graph-generator", "Open Graph Generator", "Create OG tags for rich social sharing previews."),
    ("schema-markup-generator", "Schema Markup Generator", "Generate JSON-LD structured data for rich results."),
    ("keyword-density-checker", "Keyword Density Checker", "Analyze keyword usage on any page."),
    ("serp-snippet-preview", "SERP Snippet Preview", "Preview how your page appears in Google results."),
    ("page-speed-analyzer", "Page Speed Analyzer", "Get quick page performance insights and tips."),
    ("redirect-checker", "Redirect Checker", "Trace 301/302 redirect chains for any URL."),
    ("canonical-tag-checker", "Canonical Tag Checker", "Verify canonical tags across your pages."),
    ("hreflang-generator", "Hreflang Tag Generator", "Generate hreflang tags for multilingual sites."),
    ("ai-copywriter", "AI Copywriter", "Generate landing-page copy with AI."),
    ("ai-headline-generator", "AI Headline Generator", "Create high-converting headlines instantly."),
    ("ai-product-descriptions", "AI Product Description Writer", "Write compelling e-commerce product descriptions."),
    ("ai-email-writer", "AI Email Writer", "Draft support and marketing emails with AI."),
    ("ai-blog-outline", "AI Blog Outline Generator", "Turn a topic into a full blog outline."),
    ("ai-meta-description", "AI Meta Description Writer", "Generate click-worthy meta descriptions."),
    ("ai-ad-copy", "AI Ad Copy Generator", "Create Google and Facebook ad variations."),
    ("ai-slogan-maker", "AI Slogan Maker", "Generate brand slogans and taglines."),
    ("ai-cta-generator", "AI CTA Generator", "Write call-to-action button and banner text."),
    ("ai-social-posts", "AI Social Post Generator", "Turn articles into social media posts."),
    ("ai-faq-generator", "AI FAQ Generator", "Turn your pages and docs into ready-to-publish FAQs."),
    ("ai-chatbot-builder", "AI Chatbot Builder", "Build a website AI chatbot trained on your content."),
    ("pdf-chatbot", "PDF Chatbot", "Chat with any PDF and get instant answers."),
    ("docx-chatbot", "DOCX Chatbot", "Ask questions about Word documents."),
    ("website-ai-assistant", "Website AI Assistant", "Add an AI assistant to any website page."),
    ("knowledge-base-builder", "Knowledge Base Builder", "Turn scattered docs into a searchable knowledge base."),
    ("ai-support-reply", "AI Support Reply Generator", "Draft customer support replies with AI."),
    ("ai-review-responder", "AI Review Responder", "Generate professional responses to customer reviews."),
    ("ai-translation", "AI Translator (95+ Languages)", "Translate support content into 95+ languages."),
    ("ai-summarizer", "AI Text Summarizer", "Summarize long documents into key points."),
    ("ai-paraphraser", "AI Paraphraser", "Rewrite text while keeping the meaning."),
    ("ai-grammar-checker", "AI Grammar Checker", "Fix grammar and style issues instantly."),
    ("ai-tone-adjuster", "AI Tone Adjuster", "Rewrite text as friendly, formal or concise."),
    ("ai-name-generator", "AI Business Name Generator", "Generate available brand name ideas."),
    ("ai-persona-builder", "AI Customer Persona Builder", "Create detailed buyer personas from a description."),
    ("pdf-to-text", "PDF to Text Converter", "Extract clean text from PDF files."),
    ("docx-to-markdown", "DOCX to Markdown Converter", "Convert Word documents to Markdown."),
    ("html-to-markdown", "HTML to Markdown Converter", "Turn web pages into Markdown."),
    ("markdown-to-html", "Markdown to HTML Converter", "Render Markdown as clean HTML."),
    ("csv-to-json", "CSV to JSON Converter", "Convert spreadsheets to JSON."),
    ("json-formatter", "JSON Formatter & Validator", "Pretty-print and validate JSON."),
    ("url-encoder", "URL Encoder / Decoder", "Encode or decode URL strings."),
    ("base64-tool", "Base64 Encoder / Decoder", "Convert text and files to and from Base64."),
    ("uuid-generator", "UUID Generator", "Generate universally unique identifiers."),
    ("password-generator", "Strong Password Generator", "Create secure random passwords."),
    ("qr-code-generator", "QR Code Generator", "Generate QR codes for links and text."),
    ("utm-builder", "UTM Link Builder", "Build campaign tracking URLs."),
    ("word-counter", "Word & Character Counter", "Count words, characters and reading time."),
    ("lorem-ipsum", "Lorem Ipsum Generator", "Generate placeholder text."),
    ("favicon-generator", "Favicon Generator", "Create favicons from text or emoji."),
    ("color-palette", "Color Palette Generator", "Generate brand color palettes."),
    ("invoice-generator", "Invoice Generator", "Create simple PDF-ready invoices."),
    ("pricing-table-builder", "Pricing Table Builder", "Design pricing tables with embed code."),
    ("roi-calculator", "Support ROI Calculator", "Estimate savings from AI support automation."),
    ("email-signature", "Email Signature Generator", "Create professional email signatures."),
    ("privacy-policy-generator", "Privacy Policy Generator", "Generate a starter privacy policy."),
    ("terms-generator", "Terms of Service Generator", "Generate starter terms of service."),
]

# ---------------------------------------------------------------- helpers

NAV = """    <nav class="site-nav">
        <a href="../sitpgpt.html">Home</a>
        <a href="../pricing.html">Pricing</a>
        <a href="../install-service.html">$599 Setup Service</a>
        <a href="../case-study.html">Case Study</a>
        <a href="../guides/ai-customer-service-tools.html">AI Tools Guide</a>
        <a href="../tools/index.html">60+ Free Tools</a>
        <a href="../seo/index.html">Explore Topics</a>
    </nav>"""

FOOTER = """    <footer class="site-footer">
        <p><a href="../sitpgpt.html">Sitp GPT Home</a> · <a href="../pricing.html">Pricing</a> · <a href="../install-service.html">$599 Setup Service</a> · <a href="../case-study.html">Case Study</a> · <a href="../tools/index.html">All Tools</a> · <a href="../seo/index.html">Topics</a></p>
        <p>Contact: support@yoursite.asia · @XZZ13340061411 on X</p>
    </footer>
    <script src="../assets/powered-by.js"></script>"""


def h(s):
    return int(hashlib.md5(s.encode()).hexdigest(), 16)


def words(slug):
    return slug.replace("-", " ")


def title_case(slug):
    small = {"for", "and", "of", "to", "in", "the", "vs", "a", "an", "on", "with"}
    parts = words(slug).split()
    out = []
    for i, p in enumerate(parts):
        if p in ("ai", "faq", "pdf", "seo", "b2b", "b2c", "cx", "roi", "xml", "cta", "utm", "qr"):
            out.append(p.upper())
        elif i > 0 and p in small:
            out.append(p)
        else:
            out.append(p.capitalize())
    return " ".join(out)


def page_shell(title, description, canonical_path, body):
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <meta name="description" content="{description}">
    <link rel="canonical" href="{SITE}/{canonical_path}">
    <link rel="stylesheet" href="../assets/site.css">
</head>
<body>
    <header class="site-header">
        <h1>Sitp GPT</h1>
        <p>Replace your first-line customer support team with AI.</p>
    </header>
{NAV}

    <main class="site-main">
{body}
    </main>

{FOOTER}
</body>
</html>
"""


# ---------------------------------------------------------------- SEO pages


def build_seo_entries():
    """Return list of dicts: slug, h1, desc, topic (slug), kind."""
    entries = []
    seen = set()

    def add(slug, h1, desc, topic):
        slug = re.sub(r"-+", "-", slug.strip("-"))
        if slug in seen:
            return
        seen.add(slug)
        entries.append({"slug": slug, "h1": h1, "desc": desc, "topic": topic})

    for t_slug, t_name, t_desc in TOPICS:
        add(t_slug + "-overview", t_name, f"Everything about {t_name.lower()}: {t_desc}.", t_slug)

        for i_slug, i_tpl in INTENTS:
            add(f"{i_slug}-{t_slug}", i_tpl.format(t=t_name),
                f"{i_tpl.format(t=t_name)} — try Sitp GPT, {t_desc}. Free plan available.", t_slug)

        for p in PLATFORMS:
            add(f"{t_slug}-for-{p}", f"{t_name} for {title_case(p)}",
                f"Add {t_desc} to {title_case(p)}. Setup in minutes, free plan included.", t_slug)

        for ind in INDUSTRIES:
            add(f"{t_slug}-for-{ind}", f"{t_name} for {title_case(ind)}",
                f"How {title_case(ind)} businesses use {t_desc}. Real results and free tools.", t_slug)

        for u in USE_CASES:
            add(f"{t_slug}-{u}", f"{t_name} for {title_case(u)}",
                f"Use {t_desc} for {words(u)}. Step-by-step with Sitp GPT.", t_slug)

        for a in AUDIENCES:
            add(f"{t_slug}-for-{a}", f"{t_name} for {title_case(a)}",
                f"{t_name} built for {words(a)}: {t_desc}.", t_slug)

        for c in COMPETITORS:
            add(f"{t_slug}-vs-{c}", f"Sitp GPT {t_name} vs {title_case(c)}",
                f"Compare Sitp GPT's {t_name.lower()} with {title_case(c)}: features, pricing and free plan.", t_slug)

    return entries[:1000]


INTRO_VARIANTS = [
    "Customers expect instant answers. {h1} is one of the most searched solutions in 2026 — and Sitp GPT delivers it with a free plan you can try in minutes, no signup required.",
    "Looking for {h1_lower}? Sitp GPT combines {t_desc} with 60+ free SaaS and SEO tools, so you can start today without a credit card.",
    "Support teams are drowning in repetitive questions. {h1} solves this: Sitp GPT provides {t_desc}, with AI handling up to 80% of tickets automatically.",
    "{h1} doesn't have to be complicated or expensive. With Sitp GPT you get {t_desc} — free to start, and a one-time $599 done-for-you setup if you want experts to handle everything.",
]

BENEFIT_SETS = [
    ["✅ Unlimited AI support answers on paid plans",
     "✅ Auto-sync: the AI retrains when your website content changes",
     "✅ WhatsApp / Slack integration built in",
     "✅ Customer email capture turns chats into leads",
     "✅ Enterprise analytics reports every week"],
    ["✅ Free plan: 10 AI support test replies, 1 knowledge base, 100 pages trained",
     "✅ Answers in under 3 seconds, 24/7, in 95+ languages",
     "✅ Train on web pages, PDFs, DOCX and pasted text",
     "✅ Smart escalation to humans with full conversation context",
     "✅ Works with Shopify, WordPress, Wix, Webflow and custom sites"],
]


def seo_page_body(entry, all_entries_by_topic, tool_slugs):
    slug, h1, topic = entry["slug"], entry["h1"], entry["topic"]
    hv = h(slug)
    intro = INTRO_VARIANTS[hv % len(INTRO_VARIANTS)]
    t_desc = next(d for s, n, d in TOPICS if s == topic)
    # Lowercase the leading letter only for normal words (keep acronyms like "AI" intact).
    h1_lower = h1[0].lower() + h1[1:] if len(h1) > 1 and h1[1].islower() else h1
    intro = intro.format(h1=h1, h1_lower=h1_lower, t_desc=t_desc)
    benefits = BENEFIT_SETS[hv % len(BENEFIT_SETS)]

    siblings = all_entries_by_topic[topic]
    idx = next(i for i, e in enumerate(siblings) if e["slug"] == slug)
    related = [siblings[(idx + k * 7 + 1) % len(siblings)] for k in range(8)]
    related = [r for r in related if r["slug"] != slug][:8]
    tool = tool_slugs[hv % len(tool_slugs)]

    rel_links = "\n".join(
        f'            <li><a href="{r["slug"]}.html">{r["h1"]}</a></li>' for r in related)
    benefits_html = "\n".join(f"            <li>{b}</li>" for b in benefits)

    return f"""        <div class="breadcrumb"><a href="../sitpgpt.html">Home</a> › <a href="index.html">Topics</a> › {h1}</div>
        <h1 class="page-title">{h1}</h1>
        <p class="subtitle">{intro}</p>

        <h2>Why teams choose Sitp GPT</h2>
        <ul>
{benefits_html}
        </ul>

        <h2>How it works</h2>
        <ol>
            <li><strong>Train:</strong> paste your website URL or upload PDFs/DOCX — Sitp GPT builds your knowledge base automatically.</li>
            <li><strong>Install:</strong> add one embed snippet to your site (Shopify, WordPress, Wix, Webflow, custom).</li>
            <li><strong>Automate:</strong> the AI answers customer questions instantly and escalates complex cases to your team.</li>
        </ol>
        <p>Prefer a done-for-you setup? The one-time <a href="../install-service.html">$599 installation service</a> covers AI training, bot installation, FAQ setup and workflow optimization — and includes everything in the paid plans.</p>

        <h2>Proof it works</h2>
        <p>An e-commerce client went from 100 support questions a day to AI handling 80% of them, saving <strong>$2,000 in labor costs every month</strong>. <a href="../case-study.html">Read the full case study →</a></p>

        <h2>Try the related free tool</h2>
        <p>Start with the free <a href="../tools/{tool[0]}.html">{tool[1]}</a> — one of 60+ free tools on Sitp GPT, no signup required.</p>

        <h2>Related topics</h2>
        <ul class="related-links">
{rel_links}
        </ul>

        <div class="cta-band">
            <h2>Start free today</h2>
            <p>10 AI support test replies · 1 knowledge base · 100 pages of website training. Upgrade anytime for unlimited answers, WhatsApp/Slack, email capture and analytics.</p>
            <a class="btn" href="../pricing.html">See Pricing</a>
        </div>"""


# ---------------------------------------------------------------- tool pages


def tool_page_body(slug, name, desc, all_tools):
    hv = h(slug)
    others = [t for t in all_tools if t[0] != slug]
    related = [others[(hv + k * 11) % len(others)] for k in range(6)]
    seen, rel = set(), []
    for r in related:
        if r[0] not in seen:
            seen.add(r[0])
            rel.append(r)
    rel_links = "\n".join(
        f'            <li><a href="{r[0]}.html">{r[1]}</a> — {r[2]}</li>' for r in rel[:6])

    return f"""        <div class="breadcrumb"><a href="../sitpgpt.html">Home</a> › <a href="index.html">All Tools</a> › {name}</div>
        <h1 class="page-title">{name} — Free Online Tool</h1>
        <p class="subtitle">{desc} Part of Sitp GPT's 60+ free SaaS &amp; SEO tools. No signup, no credit card — runs right in your browser.</p>

        <p><a class="btn" href="../sitpgpt.html">Open {name} on the Homepage →</a></p>

        <h2>About this tool</h2>
        <p>{name} is 100% free on Sitp GPT. {desc} Use it as often as you like — and when you're ready for AI-powered customer support, the same platform gives you an AI chatbot trained on your own content.</p>

        <h2>Why it's free</h2>
        <p>Sitp GPT offers 60+ free tools as a public utility. Our business runs on <a href="../pricing.html">AI customer-support subscriptions</a> (from $29/mo) and the one-time <a href="../install-service.html">$599 done-for-you setup service</a>. Content generated on the free plan carries a small "Powered by Sitp GPT" badge.</p>

        <h2>Related free tools</h2>
        <ul class="related-links">
{rel_links}
        </ul>

        <div class="cta-band">
            <h2>Need AI customer support too?</h2>
            <p>Replace your first-line customer support team with AI — free plan includes 10 test replies, 1 knowledge base and 100 pages of training.</p>
            <a class="btn" href="../pricing.html">See Pricing</a>
        </div>"""


# ---------------------------------------------------------------- hubs & sitemap


def write(path, content):
    full = os.path.join(OUT_ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)


def main():
    entries = build_seo_entries()
    assert len(entries) == 1000, f"expected 1000 SEO pages, got {len(entries)}"

    by_topic = {}
    for e in entries:
        by_topic.setdefault(e["topic"], []).append(e)

    tool_list = [(s, n) for s, n, _ in TOOLS]

    # --- SEO pages
    for e in entries:
        body = seo_page_body(e, by_topic, tool_list)
        title = f'{e["h1"]} | Sitp GPT'
        write(f'seo/{e["slug"]}.html', page_shell(title, e["desc"], f'seo/{e["slug"]}.html', body))

    # --- SEO hub
    sections = []
    for t_slug, t_name, _ in TOPICS:
        links = "\n".join(
            f'            <li><a href="{e["slug"]}.html">{e["h1"]}</a></li>'
            for e in by_topic[t_slug])
        sections.append(
            f'        <h2 id="{t_slug}">{t_name}</h2>\n        <ul class="related-links">\n{links}\n        </ul>')
    toc = " · ".join(f'<a href="#{t_slug}">{t_name}</a>' for t_slug, t_name, _ in TOPICS)
    hub_body = f"""        <div class="breadcrumb"><a href="../sitpgpt.html">Home</a> › Topics</div>
        <h1 class="page-title">Explore 1,000 AI support &amp; SEO topics</h1>
        <p class="subtitle">Guides and landing pages for every platform, industry and use case — all powered by Sitp GPT's free tools and AI customer support.</p>
        <p>{toc}</p>
{chr(10).join(sections)}"""
    write("seo/index.html", page_shell(
        "Explore 1,000 AI Customer Support & SEO Topics | Sitp GPT",
        "Browse 1,000 guides: AI customer service bots, AI chatbots for Shopify, customer support automation, PDF chatbots, website AI assistants, FAQ generators and sitemap tools.",
        "seo/index.html", hub_body))

    # --- Tool pages
    for slug, name, desc in TOOLS:
        title = f"{name} — Free Online Tool | Sitp GPT"
        write(f"tools/{slug}.html", page_shell(
            title, f"{desc} Free, no signup — one of 60+ free SaaS & SEO tools on Sitp GPT.",
            f"tools/{slug}.html", tool_page_body(slug, name, desc, TOOLS)))

    # --- Tools hub
    cards = "\n".join(
        f'            <div class="card"><h3><a href="{s}.html">{n}</a></h3><p>{d}</p></div>'
        for s, n, d in TOOLS)
    tools_hub_body = f"""        <div class="breadcrumb"><a href="../sitpgpt.html">Home</a> › All Tools</div>
        <h1 class="page-title">60+ Free SaaS &amp; SEO Tools</h1>
        <p class="subtitle">Every tool is free, runs in your browser, and needs no signup. Each tool also has its own landing page — {len(TOOLS)} SEO entry points to Sitp GPT.</p>
        <div class="grid">
{cards}
        </div>
        <div class="cta-band">
            <h2>Want AI customer support too?</h2>
            <p>Replace your first-line customer support team with AI. Free plan available.</p>
            <a class="btn" href="../pricing.html">See Pricing</a>
        </div>"""
    write("tools/index.html", page_shell(
        "60+ Free SaaS & SEO Tools | Sitp GPT",
        "Directory of 60+ free tools: sitemap generators, SEO tools, AI copywriting, converters, chatbots and utilities. No signup required.",
        "tools/index.html", tools_hub_body))

    # --- sitemap.xml
    urls = ["", "sitpgpt.html", "pricing.html", "case-study.html", "install-service.html",
            "guides/ai-customer-service-tools.html", "guides/ai-automation-tutorial.html",
            "guides/enterprise-ai-cases.html", "guides/ai-employee-guide.html",
            "tools/index.html", "seo/index.html"]
    urls += [f"tools/{s}.html" for s, _, _ in TOOLS]
    urls += [f'seo/{e["slug"]}.html' for e in entries]
    url_xml = "\n".join(
        f"  <url><loc>{SITE}/{u}</loc><changefreq>weekly</changefreq></url>" for u in urls)
    write("sitemap.xml",
          '<?xml version="1.0" encoding="UTF-8"?>\n'
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
          f"{url_xml}\n</urlset>\n")

    # --- robots.txt
    write("robots.txt", f"User-agent: *\nAllow: /\n\nSitemap: {SITE}/sitemap.xml\n")

    print(f"Generated: {len(entries)} SEO pages, {len(TOOLS)} tool pages, "
          f"2 hub pages, sitemap.xml ({len(urls)} URLs), robots.txt")


if __name__ == "__main__":
    main()
