#!/usr/bin/env python3
"""Generate the deterministic Sitp GPT SEO resource library."""

from html import escape
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "search"
BASE = "https://yoursite.asia"

TOOLS = [
    ("AI Customer Support Chatbot", "answer recurring customer questions from approved business content"),
    ("AI Chatbot for Shopify", "help shoppers with products, delivery, orders, and returns"),
    ("AI Customer Support Automation", "route, answer, collect, and escalate support conversations"),
    ("PDF Chatbot", "turn manuals, policies, and guides into conversational answers"),
    ("Website AI Assistant", "give every website visitor a fast and contextual response"),
    ("AI FAQ Generator", "turn source material and real questions into a useful FAQ"),
    ("Sitemap Generator", "create a crawlable map of important website URLs"),
    ("AI Knowledge Base Builder", "organize approved answers into maintainable support knowledge"),
    ("AI Help Desk Assistant", "support agents with suggested answers and useful context"),
    ("AI Live Chat", "provide immediate first-line responses on a website"),
    ("Customer Service Chatbot", "resolve simple service questions and hand off exceptions"),
    ("AI Email Support", "draft consistent email replies from trusted policies"),
    ("AI Ticket Triage", "classify and route incoming support requests"),
    ("AI Support Analytics", "measure resolution, gaps, demand, and customer satisfaction"),
    ("AI Answer Generator", "produce grounded answers for recurring customer questions"),
    ("AI Product Description Generator", "create structured product copy for store catalogs"),
    ("AI Meta Description Generator", "draft concise search snippets for important pages"),
    ("AI Title Generator", "create clear page and content titles"),
    ("AI Blog Outline Generator", "plan useful educational content around customer intent"),
    ("AI Content Rewriter", "improve clarity and consistency while preserving meaning"),
    ("AI Grammar Checker", "find grammar and readability issues in business content"),
    ("AI Summarizer", "reduce long documents into practical highlights"),
    ("AI Paraphrasing Tool", "restate content for a new format or reading level"),
    ("AI Translator", "prepare multilingual drafts for human review"),
    ("AI Tone Changer", "adapt messages to a consistent support voice"),
    ("AI Social Post Generator", "turn business updates into channel-ready drafts"),
    ("AI Email Generator", "draft outreach, follow-up, and service emails"),
    ("AI Landing Page Generator", "structure benefit-led campaign pages"),
    ("AI Call to Action Generator", "create specific next-step prompts"),
    ("AI Value Proposition Generator", "explain a product outcome for a target customer"),
    ("AI Persona Generator", "document customer goals, objections, and context"),
    ("AI Business Name Generator", "explore memorable names for a new offer"),
    ("AI Slogan Generator", "generate concise brand-line directions"),
    ("AI Product Name Generator", "create naming options for products and features"),
    ("AI Review Response Generator", "draft thoughtful responses to customer reviews"),
    ("AI Survey Question Generator", "create focused questions for customer research"),
    ("AI Lead Qualification Assistant", "collect context and route suitable prospects"),
    ("AI Sales Assistant", "answer pre-sale questions and prepare human follow-up"),
    ("AI Onboarding Assistant", "guide new customers through setup steps"),
    ("AI Employee Assistant", "help staff find approved policies and process guidance"),
    ("AI HR Policy Chatbot", "answer routine employee policy questions"),
    ("AI Training Assistant", "make learning material easier to navigate"),
    ("AI SOP Generator", "turn process notes into structured operating procedures"),
    ("AI Meeting Summary Generator", "capture decisions, owners, and next actions"),
    ("AI Proposal Generator", "prepare structured service proposal drafts"),
    ("AI Invoice Description Generator", "write clear line-item and service descriptions"),
    ("AI Policy Generator", "draft policy structures for expert review"),
    ("AI Terms Generator", "prepare terms outlines for qualified legal review"),
    ("AI Privacy Policy Generator", "prepare privacy-policy inputs for legal review"),
    ("AI Accessibility Checker", "identify common content accessibility improvements"),
    ("AI SEO Audit", "review discoverability, page structure, and content gaps"),
    ("Keyword Clustering Tool", "group related search intents into useful content themes"),
    ("Robots.txt Generator", "prepare crawler instructions for a website"),
    ("Schema Markup Generator", "create structured-data starting points for key pages"),
    ("Open Graph Generator", "prepare social sharing metadata"),
    ("UTM Builder", "create consistent campaign tracking links"),
    ("Word Counter", "measure content length and basic readability inputs"),
    ("Character Counter", "check copy against channel and metadata limits"),
    ("Slug Generator", "turn titles into clean human-readable URL paths"),
    ("JSON Formatter", "make JSON payloads easier to inspect"),
    ("Markdown Converter", "convert simple content between HTML and Markdown"),
    ("QR Code Content Builder", "prepare useful destination text for QR campaigns"),
    ("FAQ Schema Generator", "structure eligible FAQ content for machines"),
    ("Support Cost Calculator", "estimate support demand, automation, and labor impact"),
]

INDUSTRIES = [
    ("ecommerce", "ecommerce teams", "delivery, product, order, and return questions"),
    ("saas", "SaaS companies", "onboarding, billing, account, and product questions"),
    ("customer-support", "customer support teams", "repetitive requests, handoffs, and quality review"),
    ("education", "education organizations", "course, enrollment, policy, and learning questions"),
    ("healthcare", "healthcare organizations", "service navigation and approved non-clinical information"),
    ("real-estate", "real estate teams", "property, viewing, location, and lead questions"),
    ("financial-services", "financial services teams", "product navigation and approved service information"),
    ("travel", "travel businesses", "booking, itinerary, policy, and destination questions"),
    ("hospitality", "hospitality teams", "reservation, amenity, check-in, and local questions"),
    ("professional-services", "professional services firms", "service, qualification, process, and scheduling questions"),
    ("manufacturing", "manufacturers", "product, distributor, maintenance, and documentation questions"),
    ("nonprofits", "nonprofit organizations", "program, eligibility, volunteer, and donation questions"),
    ("marketplaces", "online marketplaces", "buyer, seller, listing, transaction, and policy questions"),
    ("agencies", "agencies", "service, project, reporting, and lead questions"),
    ("local-business", "local businesses", "service area, availability, pricing, and booking questions"),
]


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def combination_slug(tool_name: str, industry_slug: str) -> str:
    tool_slug = slugify(tool_name)
    separator = "-" if "-for-" in tool_slug else "-for-"
    return f"{tool_slug}{separator}{industry_slug}"


def page_html(tool, industry=None, related=()):
    name, capability = tool
    tool_slug = slugify(name)
    if industry:
        industry_slug, audience, questions = industry
        title = f"{name} for {audience.title()} | Sitp GPT"
        heading = f"{name} for {audience}"
        description = f"Learn how {audience} can use {name.lower()} to {capability}, with workflow, launch, and measurement guidance."
        slug = combination_slug(name, industry_slug)
        context = (
            f"For {audience}, the most useful starting point is a recurring, well-documented task. "
            f"Common demand includes {questions}. A focused workflow gives the team enough evidence "
            "to compare answer quality, customer experience, and human effort before expanding."
        )
    else:
        title = f"{name}: Guide, Workflow, and Free Test | Sitp GPT"
        heading = name
        description = f"Learn how to use {name.lower()} to {capability}. Review a practical workflow, launch checklist, and success measures."
        slug = tool_slug
        context = (
            f"{name} can help teams {capability}. The strongest implementations begin with a specific "
            "job, trusted inputs, clear boundaries, and a person accountable for quality."
        )
    canonical = f"{BASE}/search/{slug}.html"
    related_links = "".join(
        f'<a href="/search/{escape(other)}.html">{escape(other.replace("-", " ").title())}</a>'
        for other in related
    )
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(title)}</title><meta name="description" content="{escape(description)}">
<link rel="canonical" href="{canonical}"><link rel="stylesheet" href="../styles.css">
<script type="application/ld+json">{{"@context":"https://schema.org","@type":"Article","headline":"{escape(heading)}","publisher":{{"@type":"Organization","name":"Sitp GPT"}}}}</script></head>
<body><header class="site-header"><div class="wrap nav"><a class="logo" href="/">Sitp GPT</a><nav class="nav-links"><a href="/search/">SEO library</a><a href="/resources.html">Resources</a><a href="/pricing.html">Pricing</a><a class="button" href="/demo.html">Demo</a></nav></div></header>
<main class="seo-page"><section class="hero"><div class="wrap"><div class="breadcrumbs"><a href="/">Home</a> / <a href="/search/">AI tools</a> / {escape(name)}</div><p class="eyebrow">Free AI implementation guide</p><h1>{escape(heading)}</h1><p class="lead">{escape(description)}</p><div class="actions"><a class="button" href="/pricing.html">Try 10 AI answers free</a><a class="button secondary" href="/sitpgpt.html">Explore existing tools</a></div></div></section>
<section class="section"><article class="wrap"><h2>Where this tool creates value</h2><p>{escape(context)}</p><p>Use the tool to reduce repetitive preparation, not to remove ownership. Keep approved sources current and require human review wherever an error could create financial, legal, privacy, safety, or customer-trust harm.</p>
<h2>A practical four-step workflow</h2><div class="grid-2"><div class="card"><h3>1. Define the job</h3><p>Choose one outcome, document the current process, and record a baseline for volume, time, quality, and escalation.</p></div><div class="card"><h3>2. Prepare inputs</h3><p>Collect current source material, remove contradictions, and identify the person responsible for future updates.</p></div><div class="card"><h3>3. Test boundaries</h3><p>Test normal requests, vague wording, edge cases, and prohibited actions. Make uncertain or sensitive cases easy to escalate.</p></div><div class="card"><h3>4. Review results</h3><p>Measure usefulness, accuracy, adoption, time saved, and exceptions. Improve the source process before expanding scope.</p></div></div>
<h2>Launch checklist</h2><ul class="checklist"><li>One clearly defined user and business outcome</li><li>Approved, current, and owned source material</li><li>Realistic examples and edge-case tests</li><li>Human handoff and failure rules</li><li>Privacy, access, and retention review</li><li>A weekly quality and improvement owner</li></ul>
<div class="callout"><strong>Free starting point:</strong> Sitp GPT includes 10 AI customer support tests, one knowledge base, and training for up to 100 website pages.</div>
<h2>Related AI resources</h2><div class="resource-list">{related_links}<a href="/guides/ai-automation-tutorial.html">AI automation tutorial</a><a href="/case-study.html">Ecommerce AI support case study</a></div></article></section></main>
<footer class="site-footer"><div class="wrap"><strong>Sitp GPT</strong> · <a href="/">Home</a> · <a href="/resources.html">Resources</a> · <a href="/pricing.html">Pricing</a></div></footer></body></html>"""


def main():
    OUT.mkdir(exist_ok=True)
    for old_page in OUT.glob("*.html"):
        old_page.unlink()
    pages = []

    # 64 primary tool pages.
    for index, tool in enumerate(TOOLS):
        slug = slugify(tool[0])
        related = [slugify(TOOLS[(index + offset) % len(TOOLS)][0]) for offset in (1, 2, 3)]
        (OUT / f"{slug}.html").write_text(page_html(tool, related=related), encoding="utf-8")
        pages.append(slug)

    # 896 pages: every tool for the first 14 audiences.
    for tool_index, tool in enumerate(TOOLS):
        for industry in INDUSTRIES[:14]:
            slug = combination_slug(tool[0], industry[0])
            related = [
                slugify(tool[0]),
                combination_slug(TOOLS[(tool_index + 1) % len(TOOLS)][0], industry[0]),
                combination_slug(TOOLS[(tool_index + 2) % len(TOOLS)][0], industry[0]),
            ]
            (OUT / f"{slug}.html").write_text(page_html(tool, industry, related), encoding="utf-8")
            pages.append(slug)

    # 40 pages for the fifteenth audience, producing exactly 1,000 pages.
    for tool_index, tool in enumerate(TOOLS[:40]):
        industry = INDUSTRIES[14]
        slug = combination_slug(tool[0], industry[0])
        related = [slugify(tool[0]), combination_slug(TOOLS[(tool_index + 1) % 40][0], industry[0])]
        (OUT / f"{slug}.html").write_text(page_html(tool, industry, related), encoding="utf-8")
        pages.append(slug)

    assert len(pages) == 1000
    cards = "".join(
        f'<a class="card" href="/search/{slug}.html"><h3>{escape(slug.replace("-", " ").title())}</h3><p>Implementation guide, workflow, checklist, and free starting point.</p></a>'
        for slug in pages
    )
    index_html = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>1,000 AI Tool and Automation Guides | Sitp GPT</title><meta name="description" content="Browse 1,000 practical guides for AI customer support, chatbots, content, SEO, and business automation."><link rel="canonical" href="{BASE}/search/"><link rel="stylesheet" href="../styles.css"></head><body><header class="site-header"><div class="wrap nav"><a class="logo" href="/">Sitp GPT</a><nav class="nav-links"><a href="/resources.html">Resources</a><a href="/pricing.html">Pricing</a><a class="button" href="/demo.html">Demo</a></nav></div></header><main><section class="hero"><div class="wrap"><p class="eyebrow">AI search library</p><h1>1,000 practical AI tool and automation guides.</h1><p class="lead">Explore 64 tool categories across customer support, content, SEO, operations, and industry workflows.</p></div></section><section class="section"><div class="wrap grid-3">{cards}</div></section></main><footer class="site-footer"><div class="wrap"><a href="/">Home</a> · <a href="/resources.html">Resources</a></div></footer></body></html>"""
    (OUT / "index.html").write_text(index_html, encoding="utf-8")

    static_pages = [
        "", "sitpgpt.html", "pricing.html", "case-study.html", "resources.html",
        "install-service.html", "demo.html", "guides/ai-customer-support-tools.html",
        "guides/ai-automation-tutorial.html", "guides/business-ai-cases.html",
        "guides/ai-employee-playbook.html", "search/",
    ]
    urls = [f"{BASE}/{path}" for path in static_pages]
    urls.extend(f"{BASE}/search/{slug}.html" for slug in pages)
    sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    sitemap += "".join(f"  <url><loc>{escape(url)}</loc></url>\n" for url in urls)
    sitemap += "</urlset>\n"
    (ROOT / "sitemap.xml").write_text(sitemap, encoding="utf-8")
    (ROOT / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {BASE}/sitemap.xml\n", encoding="utf-8")
    print(f"Generated {len(pages)} SEO pages and {len(urls)} sitemap URLs.")


if __name__ == "__main__":
    main()
