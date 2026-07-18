#!/usr/bin/env python3
"""
Generates the programmatic SEO expansion for https://yoursite.asia/:
  - /tools/*.html            60+ dedicated SEO landing pages, one per existing AI tool
  - /tools/index.html        hub page linking every tool page
  - /seo/hub-<seed>.html     30 keyword-cluster hub pages
  - /seo/<seed>-<modifier>.html   ~1000 long-tail programmatic SEO pages
  - /seo/index.html          hub page linking every keyword cluster
  - /sitemap.xml             sitemap covering every page above + core pages

This script is idempotent — re-running it regenerates all output files from the
JSON data files in scripts/data/. It does NOT touch sitpgpt.html or any other
existing page; it only adds new files under /tools/, /seo/, and /sitemap.xml.
"""
import json
import os
import re
import textwrap

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "scripts", "data")
TOOLS_DIR = os.path.join(ROOT, "tools")
SEO_DIR = os.path.join(ROOT, "seo")
DOMAIN = "https://yoursite.asia"
TARGET_SEO_PAGE_COUNT = 1000

NAV_LINKS = [
    ("sitpgpt.html", "首页 Home"),
    ("pricing.html", "Pricing 定价"),
    ("case-study.html", "Case Study"),
    ("enterprise-ai-cases.html", "企业AI案例"),
    ("ai-tools-guide.html", "AI客服工具介绍"),
    ("ai-automation-tutorials.html", "AI自动化教程"),
    ("ai-employee-guide.html", "AI员工使用方法"),
    ("video-demo.html", "功能视频演示"),
    ("tools/index.html", "60+ AI工具"),
    ("seo/index.html", "SEO资源库"),
]


def slugify(text):
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def nav_html(prefix, active_href=None):
    items = []
    for href, label in NAV_LINKS:
        full = prefix + href
        cls = ' class="active"' if href == active_href else ""
        items.append(f'    <a href="{full}"{cls}>{label}</a>')
    return "<nav class=\"spg-nav\">\n" + "\n".join(items) + "\n  </nav>"


def page_shell(prefix, title, description, canonical_path, active_href, breadcrumb, body_html):
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<meta name="description" content="{description}">
<link rel="canonical" href="{DOMAIN}/{canonical_path}">
<link rel="stylesheet" href="{prefix}assets/site.css">
</head>
<body class="spg-page">
  <header class="spg-header">
    <h1>Sitp GPT</h1>
    <p>Replace your first-line customer support team with AI.</p>
  </header>

{nav_html(prefix, active_href)}

  <main class="spg-main">
    <div class="spg-breadcrumb">{breadcrumb}</div>
{body_html}
  </main>

  <footer class="spg-footer">
    <p>Contact: support@yoursite.asia · <a href="{prefix}sitpgpt.html">返回首页</a> · <a href="{prefix}pricing.html">Pricing</a></p>
  </footer>
  <script src="{prefix}assets/site.js"></script>
</body>
</html>
"""


def write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def gen_tools():
    with open(os.path.join(DATA, "tools.json"), encoding="utf-8") as f:
        tools = json.load(f)

    urls = []
    for t in tools:
        prefix = "../"
        body = f"""
    <div class="spg-hero">
      <h2>{t['name']}</h2>
      <p class="lead">{t['desc']}</p>
      <span class="spg-badge-included">{t['cat']}</span>
    </div>

    <div class="spg-grid">
      <div class="spg-card">
        <h3>为什么使用 {t['name']}？</h3>
        <p>{t['desc']} 作为 Sitp GPT 60+ 免费工具的一部分，{t['name']} 无需注册即可在浏览器内直接试用，帮助你的团队更快完成日常工作。</p>
      </div>
      <div class="spg-card">
        <h3>如何使用</h3>
        <ol>
          <li>打开工具，输入你的内容或需求</li>
          <li>点击运行，几秒内获得 AI 生成结果</li>
          <li>直接复制使用，或升级 Pro 解锁无限次数与自动化</li>
        </ol>
      </div>
      <div class="spg-card">
        <h3>与 AI 客服结合使用</h3>
        <p>把 {t['name']} 生成的内容直接接入你的 Sitp GPT AI 客服知识库，让 AI 客服自动使用最新内容回答客户问题。</p>
      </div>
    </div>

    <div id="toolOutput" class="spg-card" style="margin-top:10px;">
      <button class="spg-btn" onclick="runToolDemo()">▶ Try {t['name']} Now</button>
      <div id="toolResult" style="margin-top:14px;"></div>
    </div>

    <p style="text-align:center;margin-top:24px;">
      <a class="spg-btn-outline" href="index.html">← 返回全部 60+ 工具</a>
      &nbsp;
      <a class="spg-btn" href="../pricing.html">升级 Pro 解锁无限次数 →</a>
    </p>

    <script>
      function runToolDemo() {{
        const el = document.getElementById('toolResult');
        el.innerHTML = '<p>✅ {t["name"]} 已生成结果！（浏览器内模拟运行，无需服务器）</p>';
        spgAttachWatermark(el);
      }}
    </script>
"""
        html = page_shell(
            prefix=prefix,
            title=f"{t['name']} — Free AI Tool | Sitp GPT",
            description=f"{t['desc']} Try {t['name']} free, no signup required, part of Sitp GPT's 60+ AI tools.",
            canonical_path=f"tools/{t['slug']}.html",
            active_href="tools/index.html",
            breadcrumb=f'<a href="../sitpgpt.html">首页</a> / <a href="index.html">60+ AI工具</a> / {t["name"]}',
            body_html=body,
        )
        write(os.path.join(TOOLS_DIR, f"{t['slug']}.html"), html)
        urls.append(f"tools/{t['slug']}.html")

    # Category grouped index
    cats = {}
    for t in tools:
        cats.setdefault(t["cat"], []).append(t)

    cards = []
    for cat, items in cats.items():
        cards.append(f'<h3 style="margin-top:26px;">{cat}</h3><div class="spg-grid">')
        for t in items:
            cards.append(
                f'<div class="spg-card"><h3><a href="{t["slug"]}.html" style="color:inherit;text-decoration:none;">{t["name"]}</a></h3>'
                f'<p>{t["desc"]}</p><p><a href="{t["slug"]}.html">Try tool →</a></p></div>'
            )
        cards.append("</div>")

    body = f"""
    <div class="spg-hero">
      <h2>60+ Free AI Tools</h2>
      <p class="lead">All {len(tools)} tools are free to try — no signup required. Each tool is also a dedicated SEO landing page you can share or rank on Google.</p>
    </div>
    {''.join(cards)}
    <p style="text-align:center;margin-top:20px;">
      <a class="spg-btn" href="../pricing.html">Upgrade for unlimited usage →</a>
    </p>
"""
    html = page_shell(
        prefix="../",
        title="60+ Free AI Tools Directory — Sitp GPT",
        description="Browse all 60+ free AI tools from Sitp GPT: SEO tools, AI copywriting, content generators, AI studio, customer support automation, and billing tools.",
        canonical_path="tools/index.html",
        active_href="tools/index.html",
        breadcrumb='<a href="../sitpgpt.html">首页</a> / 60+ AI工具',
        body_html=body,
    )
    write(os.path.join(TOOLS_DIR, "index.html"), html)
    urls.append("tools/index.html")
    return urls


ARTICLE_TEMPLATES = [
    "{modifier} {seed} 已经成为越来越多企业解决客服压力的首选方案。通过 Sitp GPT，你可以在几分钟内训练一个了解你产品的 AI 客服，无需写一行代码。",
    "如果你正在寻找 {modifier_en} {seed_en}，Sitp GPT 提供开箱即用的方案：上传文档、连接网站，AI 客服立即上线，7x24 小时自动回答访客问题。",
    "很多团队在评估 {modifier_en} {seed_en} 时最关心三点：训练是否简单、能否接入现有渠道、以及成本是否可控。Sitp GPT 在这三方面都提供了免费起步方案。",
]

WHY_POINTS = [
    "无需代码即可上线，几分钟内完成训练与部署",
    "支持网站、WhatsApp、Slack 等多渠道统一接入",
    "自动收集客户邮箱，帮助你建立营销与复购渠道",
    "企业分析报告帮你持续优化客服流程",
    "从 Free 到 Business，按需升级，成本透明可控",
]


def gen_seo():
    with open(os.path.join(DATA, "seo_seeds.json"), encoding="utf-8") as f:
        seeds = json.load(f)
    with open(os.path.join(DATA, "seo_modifiers.json"), encoding="utf-8") as f:
        modifiers = json.load(f)

    all_pages = []  # (seed, modifier, slug)
    for seed in seeds:
        for mod in modifiers:
            all_pages.append((seed, mod))
    all_pages = all_pages[:TARGET_SEO_PAGE_COUNT]

    # group by seed for per-seed hub pages
    pages_by_seed = {}
    for seed, mod in all_pages:
        pages_by_seed.setdefault(seed["kw"], []).append((seed, mod))

    generated_urls = []

    for seed_kw, items in pages_by_seed.items():
        seed = items[0][0]
        seed_slug = slugify(seed_kw)
        for idx, (seed, mod) in enumerate(items):
            mod_slug = slugify(mod["mod"])
            page_slug = f"{seed_slug}--{mod_slug}"
            title_en = f"{mod['mod']} {seed['kw']}".strip()
            title_zh = f"{mod['zh']}{seed['zh']}"
            article = ARTICLE_TEMPLATES[idx % len(ARTICLE_TEMPLATES)].format(
                modifier=mod["zh"], seed=seed["zh"], modifier_en=mod["mod"], seed_en=seed["kw"]
            )
            related_tool = None
            body = f"""
    <div class="spg-hero">
      <h2>{title_en}</h2>
      <p class="lead">{title_zh} — Powered by Sitp GPT</p>
    </div>

    <div class="spg-card">
      <p>{article}</p>
    </div>

    <div class="spg-grid">
      <div class="spg-card">
        <h3>为什么选择 Sitp GPT 做 {seed['zh']}</h3>
        <ul>
          {''.join(f'<li>{p}</li>' for p in WHY_POINTS)}
        </ul>
      </div>
      <div class="spg-card">
        <h3>免费开始</h3>
        <p>免费版包含 10 次 AI 客服测试、1 个知识库、100 页网站训练。升级 Pro/Business 解锁无限客服回答、WhatsApp/Slack 接入、企业分析报告。</p>
        <p><a class="spg-btn" href="../pricing.html">查看定价 →</a></p>
      </div>
      <div class="spg-card">
        <h3>相关资源</h3>
        <p><a href="hub-{seed_slug}.html">查看更多关于「{seed['zh']}」的文章 →</a></p>
        <p><a href="../case-study.html">阅读真实客户案例 →</a></p>
        <p><a href="../tools/index.html">浏览 60+ 免费 AI 工具 →</a></p>
      </div>
    </div>

    <div id="seoDemo" class="spg-card">
      <button class="spg-btn-outline" onclick="runSeoDemo()">▶ 免费体验 AI 客服问答</button>
      <div id="seoDemoOutput" style="margin-top:12px;"></div>
    </div>
    <script>
      function runSeoDemo() {{
        const el = document.getElementById('seoDemoOutput');
        el.innerHTML = '<p>🤖 Sitp GPT: 关于 "{seed["kw"]}"，我已经生成了一份示例回答！（浏览器内模拟，无需服务器）</p>';
        spgAttachWatermark(el);
      }}
    </script>
"""
            html = page_shell(
                prefix="../",
                title=f"{title_en} | Sitp GPT",
                description=f"{title_en} — {seed['kw']} guide by Sitp GPT. Free AI customer support tools, no signup required.",
                canonical_path=f"seo/{page_slug}.html",
                active_href="seo/index.html",
                breadcrumb=f'<a href="../sitpgpt.html">首页</a> / <a href="index.html">SEO资源库</a> / <a href="hub-{seed_slug}.html">{seed["zh"]}</a> / {mod["zh"]}',
                body_html=body,
            )
            write(os.path.join(SEO_DIR, f"{page_slug}.html"), html)
            generated_urls.append(f"seo/{page_slug}.html")

        # hub page for this seed
        links = "\n".join(
            f'<a href="{slugify(seed_kw)}--{slugify(mod["mod"])}.html">{mod["mod"]} {seed_kw}</a>'
            for seed, mod in items
        )
        hub_body = f"""
    <div class="spg-hero">
      <h2>{seed_kw} — {seed['zh']}</h2>
      <p class="lead">{len(items)} 篇关于「{seed_kw}」的免费指南与资源，由 Sitp GPT 提供。</p>
    </div>
    <div class="spg-toc">
      {links}
    </div>
    <p style="text-align:center;margin-top:20px;">
      <a class="spg-btn" href="../pricing.html">立即开始使用 Sitp GPT →</a>
    </p>
"""
        hub_html = page_shell(
            prefix="../",
            title=f"{seed_kw} Resources & Guides | Sitp GPT",
            description=f"All guides and resources about {seed_kw} from Sitp GPT — free AI customer support tools.",
            canonical_path=f"seo/hub-{seed_slug}.html",
            active_href="seo/index.html",
            breadcrumb=f'<a href="../sitpgpt.html">首页</a> / <a href="index.html">SEO资源库</a> / {seed["zh"]}',
            body_html=hub_body,
        )
        write(os.path.join(SEO_DIR, f"hub-{seed_slug}.html"), hub_html)
        generated_urls.append(f"seo/hub-{seed_slug}.html")

    # master SEO index
    hub_links = "\n".join(
        f'<a href="hub-{slugify(seed["kw"])}.html">{seed["kw"]} ({seed["zh"]})</a>'
        for seed in seeds
    )
    idx_body = f"""
    <div class="spg-hero">
      <h2>SEO资源库 — {len(generated_urls) - len(seeds)} Free Guides</h2>
      <p class="lead">Sitp GPT 的免费 SEO 内容库，覆盖 AI客服机器人、AI chatbot for Shopify、AI customer support automation、PDF chatbot、Website AI assistant、AI FAQ generator、Sitemap generator 等 {len(seeds)} 个主题集群，共 {TARGET_SEO_PAGE_COUNT} 篇长尾指南。</p>
    </div>
    <div class="spg-toc">
      {hub_links}
    </div>
    <p style="text-align:center;margin-top:20px;">
      <a class="spg-btn-outline" href="../tools/index.html">浏览 60+ 免费 AI 工具 →</a>
      &nbsp;
      <a class="spg-btn" href="../pricing.html">立即开始 →</a>
    </p>
"""
    idx_html = page_shell(
        prefix="../",
        title=f"SEO资源库 — {TARGET_SEO_PAGE_COUNT}+ Free AI Customer Support Guides | Sitp GPT",
        description="Browse 1000+ free guides on AI customer service bots, AI chatbots for Shopify, PDF chatbots, website AI assistants, and more — powered by Sitp GPT.",
        canonical_path="seo/index.html",
        active_href="seo/index.html",
        breadcrumb='<a href="../sitpgpt.html">首页</a> / SEO资源库',
        body_html=idx_body,
    )
    write(os.path.join(SEO_DIR, "index.html"), idx_html)
    generated_urls.append("seo/index.html")

    return generated_urls


def gen_sitemap(tool_urls, seo_urls):
    core_urls = [
        "sitpgpt.html",
        "pricing.html",
        "case-study.html",
        "enterprise-ai-cases.html",
        "ai-tools-guide.html",
        "ai-automation-tutorials.html",
        "ai-employee-guide.html",
        "video-demo.html",
    ]
    all_urls = core_urls + tool_urls + seo_urls
    entries = "\n".join(
        f"  <url><loc>{DOMAIN}/{u}</loc></url>" for u in all_urls
    )
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{entries}
</urlset>
"""
    write(os.path.join(ROOT, "sitemap.xml"), xml)
    print(f"Sitemap contains {len(all_urls)} URLs")


def main():
    tool_urls = gen_tools()
    seo_urls = gen_seo()
    gen_sitemap(tool_urls, seo_urls)
    print(f"Generated {len(tool_urls)} tool pages and {len(seo_urls)} SEO pages.")


if __name__ == "__main__":
    main()
