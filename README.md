# leedh994-a11y.github.io

Static site for Sitp GPT (yoursite.asia) — no backend, no build step.

## Pages

- `sitpgpt.html` — homepage (original tools, AI chat, PayPal demo — unchanged)
- `pricing.html` — Free / Pro / Business plans + $599 one-time AI setup service
- `case-study.html` — e-commerce case study (80% AI-resolved, $2,000/mo saved)
- `enterprise-ai-cases.html` — enterprise AI case studies across industries
- `ai-tools-guide.html` — AI customer support tools guide
- `ai-automation-tutorials.html` — AI automation tutorials
- `ai-employee-guide.html` — how to use your AI employee
- `video-demo.html` — product walkthrough video
- `tools/` — 60+ dedicated SEO landing pages, one per AI tool
- `seo/` — 1000 programmatic SEO pages (30 keyword clusters × ~34 long-tail variations)
- `sitemap.xml` / `robots.txt` — SEO indexing

## Regenerating the SEO/tools pages

```
python3 scripts/generate_pages.py
```

This reads `scripts/data/tools.json`, `scripts/data/seo_seeds.json`, and
`scripts/data/seo_modifiers.json` and regenerates every file under `tools/`,
`seo/`, and `sitemap.xml`. It never touches `sitpgpt.html` or other hand-written
pages.

## Running locally

```
python3 -m http.server 8000
```

Then open `http://localhost:8000/sitpgpt.html`.

