"""Generate the additive, indexable Sitp GPT tool and search landing pages."""
from pathlib import Path
from html import escape
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://yoursite.asia"
TOOLS = [
    "AI Customer Support Bot", "AI Chatbot for Shopify", "AI Customer Support Automation",
    "PDF Chatbot", "Website AI Assistant", "AI FAQ Generator", "Sitemap Generator",
    "AI Knowledge Base Builder", "Customer Email Collector", "WhatsApp Support Bot",
    "Slack Support Assistant", "Support Ticket Summarizer", "AI Reply Generator",
    "Ecommerce Returns Assistant", "Order Tracking Chatbot", "Product Description Writer",
    "SEO Meta Description Generator", "SEO Title Generator", "Schema Markup Generator",
    "Robots.txt Generator", "Internal Link Planner", "Keyword Cluster Generator",
    "Blog Outline Generator", "FAQ Schema Generator", "AI Landing Page Writer",
    "Customer Persona Generator", "Review Response Generator", "Churn Survey Generator",
    "Onboarding Email Generator", "Feature Announcement Writer", "Help Center Article Writer",
    "Support Macro Generator", "Sentiment Analyzer", "Conversation Tagger",
    "Lead Qualification Bot", "Appointment Booking Assistant", "Contact Form Builder",
    "Website Accessibility Checker", "Broken Link Checker", "Page Speed Checklist",
    "Privacy Policy Generator", "Terms Generator", "Refund Policy Generator",
    "Competitor FAQ Analyzer", "Product Comparison Writer", "Use Case Generator",
    "AI Sales Objection Handler", "Customer Success Playbook", "NPS Response Generator",
    "Support Analytics Report", "Knowledge Gap Finder", "Website Content Updater",
    "Multilingual Support Translator", "AI Agent Handoff Planner", "Live Chat Script Generator",
    "Support Workflow Mapper", "Ecommerce FAQ Builder", "SaaS FAQ Builder",
    "B2B Support Assistant", "AI Support ROI Calculator",
]
TOPICS = [
    "AI customer support", "AI chatbot for Shopify", "customer support automation",
    "PDF chatbot", "website AI assistant", "AI FAQ generator", "sitemap generator",
    "knowledge base AI", "WhatsApp customer support", "Slack customer support",
    "ecommerce support chatbot", "SaaS support automation", "support ticket automation",
    "website chatbot", "AI sales assistant", "customer email collection",
    "help center automation", "AI support analytics", "FAQ software", "support workflow",
]
AUDIENCES = [
    "for Shopify stores", "for ecommerce teams", "for SaaS companies", "for small businesses",
    "for support leaders", "for online stores", "for B2B teams", "for startup founders",
    "for marketing teams", "for customer success teams",
]

def slug(value):
    return "-".join("".join(c.lower() if c.isalnum() else " " for c in value).split())

def layout(title, description, body, canonical, schema_type="WebPage"):
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(title)} | Sitp GPT</title><meta name="description" content="{escape(description)}"><link rel="canonical" href="{canonical}">
<meta property="og:title" content="{escape(title)} | Sitp GPT"><meta property="og:description" content="{escape(description)}"><link rel="stylesheet" href="/assets/css/site.css">
<script type="application/ld+json">{{"@context":"https://schema.org","@type":"{schema_type}","name":"{escape(title)}","description":"{escape(description)}","url":"{canonical}"}}</script></head>
<body><header class="site-header"><nav class="container nav"><a class="logo" href="/">Sitp <i>GPT</i></a><div class="nav-links"><a href="/tools/">AI Tools</a><a href="/pricing.html">Pricing</a><a href="/case-studies.html">Case studies</a><a href="/resources.html">Resources</a></div><a class="button small" href="/pricing.html">Start free</a></nav></header><main>{body}</main>
<footer class="site-footer"><div class="container footer-grid"><div><a class="logo" href="/">Sitp <i>GPT</i></a><br><small>AI customer support and free SaaS tools.</small></div><div class="footer-links"><a href="/tools/">Tools</a><a href="/pricing.html">Pricing</a><a href="/resources.html">Resources</a></div></div></footer></body></html>"""

def write(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")

def main():
    resources = {
        "ai-customer-support-tools.html": ("AI customer support tools", "An introduction to knowledge sources, answer quality, handoffs, channels, and analytics.", ["Choose approved sources", "Test high-volume questions", "Set a clear human handoff", "Review answer coverage weekly"]),
        "ai-automation-tutorials.html": ("AI automation tutorials", "A practical rollout tutorial for automating repetitive customer-support work.", ["Map repeat questions", "Create and verify FAQs", "Train and test the assistant", "Launch, measure, and iterate"]),
        "enterprise-ai-cases.html": ("Enterprise AI cases", "A framework for reviewing enterprise AI customer-support use cases.", ["Define the business outcome", "Protect sensitive data", "Assign human ownership", "Measure quality and impact"]),
        "ai-employee-guide.html": ("How to use AI employees", "A guide to defining the role, boundaries, and review loop for AI teammates.", ["Give the AI a bounded role", "Write escalation rules", "Audit outputs regularly", "Improve source material"]),
    }
    for filename, (title, description, steps) in resources.items():
        items = "".join(f"<li>{step}</li>" for step in steps)
        body = f'''<section class="page-hero"><div class="container"><div class="breadcrumbs"><a href="/">Home</a> / <a href="/resources.html">Resources</a> / {title}</div><span class="eyebrow">Sitp GPT learning center</span><h1>{title}</h1><p>{description}</p></div></section><article class="article"><h2>A reliable AI workflow starts with clear boundaries.</h2><p>Customer-facing automation works best when it uses approved information, has a clear owner, and routes uncertain cases to people. Treat AI as a focused teammate—not an unreviewed replacement for judgment.</p><h2>Recommended workflow</h2><ol>{items}</ol><h2>Put it into practice</h2><p>Start with the free plan to test ten customer questions against one knowledge base and up to 100 website pages. Paid plans add unlimited answers, content updates, integrations, email collection, and enterprise reporting.</p><div class="callout"><div><h2>See the workflow in action</h2><p>Explore interactive product demonstrations.</p></div><a class="button" href="/demos.html">Open demos</a></div></article>'''
        write(ROOT / filename, layout(title, description, body, f"{SITE}/{filename}", "Article"))
    cards = []
    for tool in TOOLS:
        tool_slug = slug(tool)
        cards.append(f'<article class="tool-card"><span class="tool-type">Free AI tool</span><h2>{escape(tool)}</h2><p>Use AI to create a clearer, faster customer experience.</p><a href="/tools/{tool_slug}.html">Open guide →</a></article>')
        body = f'''<section class="page-hero"><div class="container"><div class="breadcrumbs"><a href="/">Home</a> / <a href="/tools/">AI tools</a> / {escape(tool)}</div><span class="eyebrow">Free AI tool</span><h1>{escape(tool)}</h1><p>Create a practical first draft, then connect it to your Sitp GPT customer-support workflow.</p><a class="button" href="/pricing.html">Try AI support free</a></div></section>
<article class="article"><h2>What is {escape(tool)}?</h2><p>{escape(tool)} helps teams turn repeatable support and website tasks into a consistent customer experience. Start with your existing content, review the result, and publish only when it meets your standards.</p><h2>How to use it</h2><ol><li>Gather the pages, documents, or customer questions you want to improve.</li><li>Use the tool to create a structured first draft.</li><li>Review the output and add it to your knowledge base or website.</li></ol><h2>Connect it to AI support</h2><p>On a paid Sitp GPT plan, you can pair this workflow with unlimited AI answers, website content updates, WhatsApp and Slack integrations, email collection, and enterprise analytics.</p><div class="callout"><div><h2>Need help installing it?</h2><p>Our $599 installation service trains your AI, installs the widget, and sets up FAQs.</p></div><a class="button" href="/pricing.html#installation">See service</a></div></article>'''
        write(ROOT / "tools" / f"{tool_slug}.html", layout(tool, f"Learn how to use {tool} with Sitp GPT.", body, f"{SITE}/tools/{tool_slug}.html", "SoftwareApplication"))
    index_body = f'''<section class="page-hero"><div class="container"><span class="eyebrow">60+ free AI tools</span><h1>Useful AI tools for better customer support and website growth.</h1><p>Explore focused guides for FAQs, ecommerce, websites, SEO, and customer communication.</p></div></section><section class="section"><div class="container"><div class="tool-grid">{''.join(cards)}</div></div></section>'''
    write(ROOT / "tools" / "index.html", layout("60+ free AI tools", "Free AI tools for customer support, ecommerce, FAQ creation, SEO, and website operations.", index_body, f"{SITE}/tools/"))

    urls = ["/", "/pricing.html", "/case-studies.html", "/resources.html", "/demos.html", "/tools/"]
    urls += [f"/tools/{slug(t)}.html" for t in TOOLS]
    for index in range(1000):
        topic = TOPICS[index % len(TOPICS)]
        audience = AUDIENCES[(index // len(TOPICS)) % len(AUDIENCES)]
        qualifier = ["guide", "examples", "checklist", "best practices", "template"][index % 5]
        page_slug = f"{slug(topic)}-{slug(audience)}-{slug(qualifier)}-{index + 1}"
        title = f"{topic.title()} {audience.title()} — {qualifier.title()}"
        description = f"A practical {qualifier} for {topic} {audience}, including setup steps and customer-support considerations."
        body = f'''<section class="page-hero"><div class="container"><div class="breadcrumbs"><a href="/">Home</a> / <a href="/search/">Guides</a> / {escape(topic)}</div><span class="eyebrow">AI support guide</span><h1>{escape(title)}</h1><p>{escape(description)}</p><a class="button" href="/pricing.html">Start 10 free AI tests</a></div></section><article class="article"><h2>Why teams use {escape(topic)} {escape(audience)}</h2><p>Customers expect a fast, accurate answer before they open a ticket. A trained AI assistant can handle routine questions while giving people a clear route to a human when the issue needs judgment.</p><h2>Setup checklist</h2><ul><li>Choose the pages and documents that reflect your current policy.</li><li>Test representative customer questions before publishing.</li><li>Review unanswered questions and improve your knowledge base regularly.</li></ul><h2>Measure what changes</h2><p>Track answer coverage, handoffs, opt-in email leads, and the topics customers ask about. Paid Sitp GPT plans include unlimited answers, website content updates, WhatsApp and Slack access, email collection, and enterprise analytics.</p><div class="callout"><div><h2>Build your AI support workflow</h2><p>Start on the free plan with one knowledge base and 100 training pages.</p></div><a class="button" href="/pricing.html">View plans</a></div></article>'''
        target = ROOT / "search" / f"{page_slug}.html"
        write(target, layout(title, description, body, f"{SITE}/search/{page_slug}.html", "Article"))
        urls.append(f"/search/{page_slug}.html")
    links = "".join(f'<li><a href="{url}">{escape(url.strip("/") or "Home").replace("-", " ").title()}</a></li>' for url in urls[66:266])
    search_body = f'''<section class="page-hero"><div class="container"><span class="eyebrow">Support and growth library</span><h1>1,000 practical AI customer-support guides.</h1><p>Find setup checklists, examples, and best practices for your team.</p></div></section><section class="section"><div class="container"><ul class="seo-list">{links}</ul></div></section>'''
    write(ROOT / "search" / "index.html", layout("AI customer support guide library", "Browse 1,000 guides for AI customer support, chatbots, ecommerce, and website automation.", search_body, f"{SITE}/search/"))
    urls.append("/search/")
    sitemap = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    sitemap.extend(f"  <url><loc>{SITE}{url}</loc></url>" for url in urls)
    sitemap.append("</urlset>")
    write(ROOT / "sitemap.xml", "\n".join(sitemap) + "\n")
    print(f"Generated {len(urls)} URLs.")

if __name__ == "__main__":
    main()
