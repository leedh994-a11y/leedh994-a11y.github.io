#!/usr/bin/env python3
"""Compose clean UI B-roll frames for the promo (no browser required)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ASSETS = Path(__file__).resolve().parent / "assets"
SHOTS = ASSETS / "shots"
W, H = 1920, 1080


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for p in paths:
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def rounded(draw: ImageDraw.ImageDraw, box, radius: int, fill) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def make_dashboard() -> Image.Image:
    img = Image.new("RGB", (W, H), (248, 250, 252))
    draw = ImageDraw.Draw(img)

    # Sidebar
    draw.rectangle([0, 0, 280, H], fill=(15, 23, 42))
    draw.text((36, 40), "Pzhisen", font=font(28, True), fill=(248, 250, 252))
    nav = ["Overview", "AI Agents", "Marketing", "Support", "Analytics", "Publish"]
    for i, label in enumerate(nav):
        y = 120 + i * 56
        if i == 1:
            rounded(draw, (24, y - 10, 256, y + 34), 10, (51, 65, 85))
        draw.text((48, y), label, font=font(20), fill=(226, 232, 240))

    # Top bar
    draw.rectangle([280, 0, W, 72], fill=(255, 255, 255))
    draw.line([280, 72, W, 72], fill=(226, 232, 240), width=2)
    draw.text((312, 22), "AI Employee Team · Live", font=font(22, True), fill=(15, 23, 42))
    draw.text((W - 280, 24), "pzhisen.online", font=font(18, True), fill=(79, 70, 229))

    # Agent cards
    cards = [
        ("Marketing Agent", "Writing tweets · 24/7", (16, 185, 129)),
        ("Video Agent", "Rendering promo clips", (59, 130, 246)),
        ("Email Agent", "Sending to Gmail / Outlook", (245, 158, 11)),
        ("Support Agent", "Replying to customers", (236, 72, 153)),
        ("Analyst Agent", "Market & sales scan", (99, 102, 241)),
        ("Publisher", "YouTube · TikTok · 抖音", (14, 165, 233)),
    ]
    for i, (title, sub, color) in enumerate(cards):
        col, row = i % 3, i // 3
        x0 = 312 + col * 520
        y0 = 110 + row * 420
        rounded(draw, (x0, y0, x0 + 490, y0 + 380), 18, (255, 255, 255))
        draw.rectangle([x0, y0, x0 + 8, y0 + 380], fill=color)
        draw.ellipse([x0 + 28, y0 + 28, x0 + 68, y0 + 68], fill=color)
        draw.text((x0 + 88, y0 + 34), title, font=font(26, True), fill=(15, 23, 42))
        draw.text((x0 + 28, y0 + 110), "STATUS", font=font(14, True), fill=(148, 163, 184))
        draw.text((x0 + 28, y0 + 140), "Running", font=font(28, True), fill=color)
        draw.text((x0 + 28, y0 + 210), sub, font=font(22), fill=(71, 85, 105))
        draw.text((x0 + 28, y0 + 280), "Auto · Zero ad spend", font=font(18), fill=(100, 116, 139))
        # progress bar
        rounded(draw, (x0 + 28, y0 + 330, x0 + 450, y0 + 348), 6, (241, 245, 249))
        rounded(draw, (x0 + 28, y0 + 330, x0 + 28 + int(420 * (0.55 + 0.07 * i)), y0 + 348), 6, color)

    return img


def make_publish() -> Image.Image:
    img = Image.new("RGB", (W, H), (15, 23, 42))
    draw = ImageDraw.Draw(img)
    draw.text((80, 60), "Auto-publish across platforms", font=font(42, True), fill=(248, 250, 252))
    draw.text((80, 120), "Pzhisen · one click · global reach", font=font(24), fill=(148, 163, 184))

    platforms = [
        ("YouTube", (255, 0, 0)),
        ("TikTok", (0, 242, 234)),
        ("X", (29, 161, 242)),
        ("Facebook", (24, 119, 242)),
        ("抖音", (17, 24, 39)),
        ("小红书", (255, 36, 66)),
        ("视频号", (7, 193, 96)),
        ("快手", (255, 80, 0)),
    ]
    for i, (name, color) in enumerate(platforms):
        col, row = i % 4, i // 4
        x0 = 80 + col * 450
        y0 = 220 + row * 340
        rounded(draw, (x0, y0, x0 + 410, y0 + 280), 20, (30, 41, 59))
        draw.ellipse([x0 + 30, y0 + 40, x0 + 110, y0 + 120], fill=color)
        draw.text((x0 + 140, y0 + 60), name, font=font(32, True), fill=(248, 250, 252))
        draw.text((x0 + 140, y0 + 120), "Queued · Publishing", font=font(20), fill=(148, 163, 184))
        rounded(draw, (x0 + 30, y0 + 180, x0 + 370, y0 + 220), 10, (51, 65, 85))
        draw.text((x0 + 50, y0 + 188), "AI content ready", font=font(18, True), fill=(226, 232, 240))

    return img


def make_analytics() -> Image.Image:
    img = Image.new("RGB", (W, H), (248, 250, 252))
    draw = ImageDraw.Draw(img)
    draw.text((80, 50), "Market · Sales · Trends", font=font(40, True), fill=(15, 23, 42))
    draw.text((80, 110), "Live competitiveness & revenue signals", font=font(22), fill=(100, 116, 139))

    metrics = [
        ("Revenue (30d)", "$1,000,000+", (16, 185, 129)),
        ("Organic reach", "+482%", (59, 130, 246)),
        ("Tickets auto-closed", "91%", (245, 158, 11)),
        ("Active agents", "6 / 6", (99, 102, 241)),
    ]
    for i, (label, value, color) in enumerate(metrics):
        x0 = 80 + i * 450
        rounded(draw, (x0, 180, x0 + 420, 380), 18, (255, 255, 255))
        draw.text((x0 + 28, 210), label, font=font(18, True), fill=(100, 116, 139))
        draw.text((x0 + 28, 270), value, font=font(40, True), fill=color)

    # Simple bar chart
    rounded(draw, (80, 440, W - 80, H - 60), 18, (255, 255, 255))
    bars = [0.35, 0.48, 0.62, 0.55, 0.78, 0.9, 1.0]
    labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    base_y = H - 120
    max_h = 360
    for i, (h, lab) in enumerate(zip(bars, labels)):
        x0 = 160 + i * 230
        top = base_y - int(max_h * h)
        rounded(draw, (x0, top, x0 + 120, base_y), 10, (79, 70, 229))
        draw.text((x0 + 30, base_y + 16), lab, font=font(18), fill=(100, 116, 139))

    return img


def main() -> None:
    SHOTS.mkdir(parents=True, exist_ok=True)
    make_dashboard().save(SHOTS / "ui-dashboard.png", quality=95)
    make_publish().save(SHOTS / "ui-publish.png", quality=95)
    make_analytics().save(SHOTS / "ui-analytics.png", quality=95)
    print("Wrote UI B-roll to", SHOTS)


if __name__ == "__main__":
    main()
