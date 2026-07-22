#!/usr/bin/env python3
"""Build Pzhisen promo MP4: Ken Burns scenes + EN burned-in subtitles + narration."""
from __future__ import annotations

import math
import re
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
FRAMES = ROOT / "frames"
OUT_DIR = ROOT
W, H = 1920, 1080
FPS = 24
DURATION = 128.208

# Scene windows (start, end, image, title overlay)
SCENES = [
    (0.0, 6.3, "businessman-hero.png", "Meet Michael"),
    (6.3, 15.2, "businessman-talk.png", "Pzhisen · pzhisen.online"),
    (15.2, 29.3, "businessman-desk.png", "Deploy in minutes"),
    (29.3, 44.3, "businessman-walk.png", "24/7 · Never sleeps"),
    (44.3, 56.7, "businessman-desk.png", "Tweets · Videos · Copy"),
    (56.7, 64.9, "businessman-talk.png", "Email to the world"),
    (64.9, 72.0, "businessman-hero.png", "Auto customer support"),
    (72.0, 85.4, "success-office.png", "Market · Sales · Trends"),
    (85.4, 98.9, "platforms-bg.png", "YouTube · TikTok · X · Facebook · Douyin · more"),
    (98.9, 108.5, "businessman-desk.png", "Personal & enterprise sites"),
    (108.5, 121.2, "success-office.png", "$1,000,000 in one month"),
    (121.2, 128.3, "businessman-hero.png", "Start tonight · pzhisen.online"),
]


def find_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        "/usr/share/fonts/truetype/macos/Inter-Bold.ttf" if bold else "/usr/share/fonts/truetype/macos/Inter-Regular.ttf",
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
        # drop cue index if present
        if re.fullmatch(r"\d+", lines[0].strip()):
            lines = lines[1:]
        if not lines or "-->" not in lines[0]:
            continue
        timing = lines[0].replace(".", ",")
        # ensure SRT has milliseconds with 3 digits
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


def ken_burns(img: Image.Image, progress: float, zoom_in: bool = True) -> Image.Image:
    """progress 0..1"""
    base = cover_resize(img, int(W * 1.18), int(H * 1.18))
    if zoom_in:
        scale = 1.0 + 0.12 * progress
        ox = int((base.width - W) * (0.15 + 0.7 * progress))
        oy = int((base.height - H) * (0.25 + 0.35 * (1 - progress)))
    else:
        scale = 1.12 - 0.12 * progress
        ox = int((base.width - W) * (0.85 - 0.7 * progress))
        oy = int((base.height - H) * (0.4 * progress))
    sw, sh = int(W * scale), int(H * scale)
    # clamp crop box
    ox = max(0, min(ox, base.width - sw))
    oy = max(0, min(oy, base.height - sh))
    crop = base.crop((ox, oy, ox + sw, oy + sh)).resize((W, H), Image.Resampling.LANCZOS)
    return crop


def gradient_overlay(draw: ImageDraw.ImageDraw) -> None:
    # bottom gradient for subtitle readability
    for y in range(H - 280, H):
        a = int(210 * ((y - (H - 280)) / 280))
        draw.rectangle([0, y, W, y + 1], fill=(8, 12, 22, a))
    # top vignette
    for y in range(0, 160):
        a = int(120 * (1 - y / 160))
        draw.rectangle([0, y, W, y + 1], fill=(8, 12, 22, a))


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


def draw_title_bar(base: Image.Image, title: str) -> Image.Image:
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    gradient_overlay(draw)

    # brand chip
    font_sm = find_font(28, bold=True)
    font_lg = find_font(54, bold=True)
    chip = "PZHISEN"
    pad_x, pad_y = 22, 12
    tw = int(draw.textlength(chip, font=font_sm))
    chip_box = (64, 56, 64 + tw + pad_x * 2, 56 + 28 + pad_y * 2)
    draw.rounded_rectangle(chip_box, radius=8, fill=(255, 255, 255, 34))
    draw.text((64 + pad_x, 56 + pad_y), chip, font=font_sm, fill=(245, 247, 250, 235))

    # scene title
    lines = wrap_text(title, font_lg, W - 160, draw)
    y = 140
    for line in lines[:2]:
        draw.text((72, y), line, font=font_lg, fill=(255, 255, 255, 245))
        y += 66

    # lower brand URL
    font_url = find_font(30, bold=True)
    draw.text((72, H - 120), "pzhisen.online", font=font_url, fill=(180, 210, 255, 230))

    composed = Image.alpha_composite(base.convert("RGBA"), overlay)
    return composed.convert("RGB")


def scene_for_t(t: float) -> tuple[str, str, float, bool]:
    for i, (a, b, img, title) in enumerate(SCENES):
        if t < b or i == len(SCENES) - 1:
            progress = 0 if b == a else (t - a) / (b - a)
            return img, title, max(0.0, min(1.0, progress)), (i % 2 == 0)
    img, title = SCENES[-1][2], SCENES[-1][3]
    return img, title, 1.0, True


def render_frames() -> None:
    FRAMES.mkdir(parents=True, exist_ok=True)
    for old in FRAMES.glob("*.jpg"):
        old.unlink()

    cache: dict[str, Image.Image] = {}
    total = int(math.ceil(DURATION * FPS))
    print(f"Rendering {total} frames @ {FPS}fps…")
    for i in range(total):
        t = i / FPS
        name, title, progress, zoom_in = scene_for_t(t)
        if name not in cache:
            cache[name] = Image.open(ASSETS / name).convert("RGB")
        frame = ken_burns(cache[name], progress, zoom_in=zoom_in)
        # slight contrast polish
        frame = ImageEnhance.Contrast(frame).enhance(1.05)
        frame = ImageEnhance.Color(frame).enhance(1.04)
        frame = draw_title_bar(frame, title)
        frame.save(FRAMES / f"frame_{i:05d}.jpg", quality=90, optimize=True)
        if i % (FPS * 5) == 0:
            print(f"  {i}/{total} ({100 * i / total:.0f}%)")
    print("Frames done.")


def burn_subtitles() -> None:
    srt = ASSETS / "narration.srt"
    vtt_to_srt(ASSETS / "narration.vtt", srt)
    # escape path for ffmpeg subtitles filter
    srt_esc = str(srt).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
    style = (
        "FontName=DejaVu Sans,FontSize=22,PrimaryColour=&H00FFFFFF,"
        "OutlineColour=&H80000000,BorderStyle=3,Outline=2,Shadow=0,"
        "MarginV=48,Alignment=2,Bold=0"
    )
    cmd = [
        "ffmpeg", "-y",
        "-framerate", str(FPS),
        "-i", str(FRAMES / "frame_%05d.jpg"),
        "-i", str(ASSETS / "narration.mp3"),
        "-vf", f"subtitles={srt_esc}:force_style='{style}'",
        "-c:v", "libx264", "-preset", "medium", "-crf", "20",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        "-movflags", "+faststart",
        str(OUT_DIR / "pzhisen-promo-en.mp4"),
    ]
    print("Encoding MP4…")
    subprocess.run(cmd, check=True)
    print("Wrote", OUT_DIR / "pzhisen-promo-en.mp4")


def main() -> None:
    render_frames()
    burn_subtitles()


if __name__ == "__main__":
    main()
