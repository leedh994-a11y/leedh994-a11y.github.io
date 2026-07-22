#!/usr/bin/env python3
"""Build polished Pzhisen EN promo: talking-head cuts + site/UI B-roll + landscape & vertical."""
from __future__ import annotations

import math
import re
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFont

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
SHOTS = ASSETS / "shots"
FRAMES = ROOT / "frames-en-v2"
FRAMES_V = ROOT / "frames-en-v2-vert"
OUT_DIR = ROOT
FPS = 24
DURATION = 128.208

# Landscape
LW, LH = 1920, 1080
# Vertical (Douyin / TikTok / Reels)
VW, VH = 1080, 1920

# Richer edit: more talking-head angles + real site/UI B-roll interleaved with narration beats
SCENES = [
    # start, end, image (relative to ASSETS or shots/), title, kind
    (0.0, 5.0, "title-bg.png", "Pzhisen", "title"),
    (5.0, 12.5, "talk-front-a.png", "Meet Michael", "talk"),
    (12.5, 18.0, "shots/site-index.png", "pzhisen.online", "broll"),
    (18.0, 26.0, "talk-gesture.png", "Deploy in minutes", "talk"),
    (26.0, 32.0, "shots/ui-dashboard.png", "Your AI employee team", "broll"),
    (32.0, 42.0, "talk-emphatic.png", "24/7 · Never sleeps", "talk"),
    (42.0, 50.0, "businessman-desk.png", "Tweets · Videos · Copy", "talk"),
    (50.0, 58.0, "talk-gesture.png", "Email the world", "talk"),
    (58.0, 66.0, "shots/ui-publish.png", "Auto customer support", "broll"),
    (66.0, 78.0, "shots/ui-analytics.png", "Market · Sales · Trends", "broll"),
    (78.0, 92.0, "platforms-bg.png", "YouTube · TikTok · Douyin · more", "broll"),
    (92.0, 102.0, "talk-front-a.png", "Personal & enterprise", "talk"),
    (102.0, 116.0, "success-office.png", "$1,000,000 in one month", "talk"),
    (116.0, 128.3, "talk-emphatic.png", "Start tonight · pzhisen.online", "cta"),
]


def find_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def vtt_to_srt(vtt_path: Path, srt_path: Path) -> None:
    text = vtt_path.read_text(encoding="utf-8")
    text = re.sub(r"^WEBVTT.*?\n+", "", text, flags=re.S)
    blocks = re.split(r"\n\s*\n", text.strip())
    out = []
    n = 1
    for block in blocks:
        lines = [ln for ln in block.splitlines() if ln.strip()]
        if not lines:
            continue
        if re.fullmatch(r"\d+", lines[0].strip()):
            lines = lines[1:]
        if not lines or "-->" not in lines[0]:
            continue
        timing = lines[0].replace(".", ",")

        def fix(t: str) -> str:
            t = t.strip()
            if re.match(r"^\d{2}:\d{2}:\d{2},\d+$", t):
                hms, ms = t.split(",")
                return f"{hms},{ms[:3].ljust(3, '0')}"
            if re.match(r"^\d{2}:\d{2}:\d{2}\.\d+$", t):
                hms, ms = t.split(".")
                return f"{hms},{ms[:3].ljust(3, '0')}"
            return t

        parts = [p.strip() for p in timing.split("-->")]
        timing = f"{fix(parts[0])} --> {fix(parts[1].split()[0])}"
        body = "\n".join(lines[1:]).strip()
        if not body:
            continue
        out.append(f"{n}\n{timing}\n{body}\n")
        n += 1
    srt_path.write_text("\n".join(out) + "\n", encoding="utf-8")


def cover_resize(img: Image.Image, tw: int, th: int) -> Image.Image:
    scale = max(tw / img.width, th / img.height)
    nw, nh = int(img.width * scale), int(img.height * scale)
    img = img.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - tw) // 2
    top = (nh - th) // 2
    return img.crop((left, top, left + tw, top + th))


def contain_blur_bg(img: Image.Image, tw: int, th: int) -> Image.Image:
    """Fit image into frame with blurred cover background (good for vertical UI shots)."""
    bg = cover_resize(img, tw, th).filter(__import__("PIL.ImageFilter", fromlist=["ImageFilter"]).ImageFilter.GaussianBlur(28))
    bg = ImageEnhance.Brightness(bg).enhance(0.45)
    scale = min(tw / img.width, th / img.height) * 0.92
    nw, nh = max(1, int(img.width * scale)), max(1, int(img.height * scale))
    fg = img.resize((nw, nh), Image.Resampling.LANCZOS)
    bg.paste(fg, ((tw - nw) // 2, (th - nh) // 2))
    return bg


def ken_burns(img: Image.Image, progress: float, zoom_in: bool, tw: int, th: int) -> Image.Image:
    base = cover_resize(img, int(tw * 1.18), int(th * 1.18))
    if zoom_in:
        scale = 1.0 + 0.10 * progress
        ox = int((base.width - tw) * (0.15 + 0.7 * progress))
        oy = int((base.height - th) * (0.2 + 0.4 * (1 - progress)))
    else:
        scale = 1.10 - 0.10 * progress
        ox = int((base.width - tw) * (0.85 - 0.7 * progress))
        oy = int((base.height - th) * (0.35 * progress))
    sw, sh = int(tw * scale), int(th * scale)
    ox = max(0, min(ox, base.width - sw))
    oy = max(0, min(oy, base.height - sh))
    return base.crop((ox, oy, ox + sw, oy + sh)).resize((tw, th), Image.Resampling.LANCZOS)


def gradient_overlay(draw: ImageDraw.ImageDraw, tw: int, th: int) -> None:
    band = int(th * 0.28)
    for y in range(th - band, th):
        a = int(220 * ((y - (th - band)) / band))
        draw.rectangle([0, y, tw, y + 1], fill=(8, 12, 22, a))
    for y in range(0, int(th * 0.16)):
        a = int(130 * (1 - y / (th * 0.16)))
        draw.rectangle([0, y, tw, y + 1], fill=(8, 12, 22, a))


def wrap_text(text: str, font: ImageFont.ImageFont, max_width: int, draw: ImageDraw.ImageDraw) -> list[str]:
    words = text.split()
    lines: list[str] = []
    cur = ""
    for w in words:
        test = (cur + " " + w).strip()
        if draw.textlength(test, font=font) <= max_width:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def draw_chrome(base: Image.Image, title: str, kind: str, vertical: bool) -> Image.Image:
    tw, th = base.size
    overlay = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    gradient_overlay(draw, tw, th)

    fs_chip = 22 if vertical else 28
    fs_title = 40 if vertical else 52
    fs_url = 26 if vertical else 30
    font_sm = find_font(fs_chip, bold=True)
    font_lg = find_font(fs_title, bold=True)
    font_url = find_font(fs_url, bold=True)

    chip = "PZHISEN"
    pad_x, pad_y = 18, 10
    chip_w = int(draw.textlength(chip, font=font_sm))
    chip_box = (48, 48, 48 + chip_w + pad_x * 2, 48 + fs_chip + pad_y * 2)
    draw.rounded_rectangle(chip_box, radius=8, fill=(255, 255, 255, 36))
    draw.text((48 + pad_x, 48 + pad_y), chip, font=font_sm, fill=(245, 247, 250, 235))

    max_w = tw - 120
    lines = wrap_text(title, font_lg, max_w, draw)
    y = 110 if not vertical else 130
    if kind == "title":
        y = th // 2 - 80
        lines = wrap_text("AI That Runs Your Company\nWhile You Sleep".replace("\n", " "), font_lg, max_w, draw)
    for line in lines[:3]:
        # soft shadow
        draw.text((52, y + 2), line, font=font_lg, fill=(0, 0, 0, 120))
        draw.text((50, y), line, font=font_lg, fill=(255, 255, 255, 245))
        y += fs_title + 12

    url_y = th - (160 if vertical else 120)
    draw.text((52, url_y + 2), "pzhisen.online", font=font_url, fill=(0, 0, 0, 100))
    draw.text((50, url_y), "pzhisen.online", font=font_url, fill=(180, 210, 255, 235))

    return Image.alpha_composite(base.convert("RGBA"), overlay).convert("RGB")


def scene_for_t(t: float):
    for i, (a, b, img, title, kind) in enumerate(SCENES):
        if t < b or i == len(SCENES) - 1:
            progress = 0 if b == a else (t - a) / (b - a)
            return img, title, kind, max(0.0, min(1.0, progress)), (i % 2 == 0)
    img, title, kind = SCENES[-1][2], SCENES[-1][3], SCENES[-1][4]
    return img, title, kind, 1.0, True


def resolve_path(name: str) -> Path:
    p = ASSETS / name
    if p.exists():
        return p
    p2 = ROOT / name
    if p2.exists():
        return p2
    raise FileNotFoundError(name)


def render(vertical: bool = False) -> Path:
    tw, th = (VW, VH) if vertical else (LW, LH)
    out_frames = FRAMES_V if vertical else FRAMES
    out_frames.mkdir(parents=True, exist_ok=True)
    for old in out_frames.glob("*.jpg"):
        old.unlink()

    cache: dict[str, Image.Image] = {}
    total = int(math.ceil(DURATION * FPS))
    label = "vertical" if vertical else "landscape"
    print(f"Rendering {label}: {total} frames @ {FPS}fps ({tw}x{th})…")
    for i in range(total):
        t = i / FPS
        name, title, kind, progress, zoom_in = scene_for_t(t)
        if name not in cache:
            cache[name] = Image.open(resolve_path(name)).convert("RGB")
        src = cache[name]
        if vertical and kind == "broll" and src.width >= src.height:
            frame = contain_blur_bg(src, tw, th)
            # gentle push-in via slight scale
            scale = 1.0 + 0.04 * progress
            cw, ch = int(tw / scale), int(th / scale)
            ox = (tw - cw) // 2
            oy = (th - ch) // 2
            frame = frame.crop((ox, oy, ox + cw, oy + ch)).resize((tw, th), Image.Resampling.LANCZOS)
        else:
            frame = ken_burns(src, progress, zoom_in=zoom_in, tw=tw, th=th)
        frame = ImageEnhance.Contrast(frame).enhance(1.05)
        frame = ImageEnhance.Color(frame).enhance(1.04)
        frame = draw_chrome(frame, title, kind, vertical=vertical)
        frame.save(out_frames / f"frame_{i:05d}.jpg", quality=88, optimize=True)
        if i % (FPS * 8) == 0:
            print(f"  [{label}] {i}/{total} ({100 * i / total:.0f}%)")
    print(f"Frames done ({label}).")
    return out_frames


def encode(frames_dir: Path, outfile: Path, vertical: bool = False) -> None:
    srt = ASSETS / "narration.srt"
    vtt_to_srt(ASSETS / "narration.vtt", srt)
    srt_esc = str(srt).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
    fontsize = 26 if vertical else 22
    margin_v = 120 if vertical else 48
    style = (
        f"FontName=DejaVu Sans,FontSize={fontsize},PrimaryColour=&H00FFFFFF,"
        f"OutlineColour=&H80000000,BorderStyle=3,Outline=2,Shadow=0,"
        f"MarginV={margin_v},Alignment=2,Bold=0"
    )
    cmd = [
        "ffmpeg", "-y",
        "-framerate", str(FPS),
        "-i", str(frames_dir / "frame_%05d.jpg"),
        "-i", str(ASSETS / "narration.mp3"),
        "-vf", f"subtitles={srt_esc}:force_style='{style}'",
        "-c:v", "libx264", "-preset", "medium", "-crf", "20",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        "-movflags", "+faststart",
        str(outfile),
    ]
    print("Encoding", outfile.name, "…")
    subprocess.run(cmd, check=True)
    print("Wrote", outfile)


def main() -> None:
    # Ensure UI B-roll exists
    ui = SHOTS / "ui-dashboard.png"
    if not ui.exists():
        subprocess.run(["python3", str(ROOT / "make_ui_broll.py")], check=True)

    frames = render(vertical=False)
    encode(frames, OUT_DIR / "pzhisen-promo-en.mp4", vertical=False)

    frames_v = render(vertical=True)
    encode(frames_v, OUT_DIR / "pzhisen-promo-en-vertical.mp4", vertical=True)


if __name__ == "__main__":
    main()
