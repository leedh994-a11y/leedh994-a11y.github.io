#!/usr/bin/env python3
"""Build Pzhisen Chinese promo MP4: Ken Burns scenes + ZH burned-in subtitles + narration."""
from __future__ import annotations

import math
import re
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFont

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
FRAMES = ROOT / "frames-zh"
OUT_DIR = ROOT
W, H = 1920, 1080
FPS = 24

# Scene windows are filled after reading narration duration; ratios mirror EN pacing.
SCENE_SPEC = [
    # (fraction_start, fraction_end, image, title overlay)
    (0.000, 0.049, "zh-businessman-hero.png", "认识陈总"),
    (0.049, 0.118, "zh-businessman-talk.png", "Pzhisen · pzhisen.online"),
    (0.118, 0.229, "zh-businessman-desk.png", "几分钟即可部署"),
    (0.229, 0.346, "zh-businessman-walk.png", "全年 · 每天24小时 · 从不休息"),
    (0.346, 0.442, "zh-businessman-desk.png", "推文 · 视频 · 文案"),
    (0.442, 0.506, "zh-businessman-talk.png", "全球主流邮箱群发"),
    (0.506, 0.562, "zh-businessman-hero.png", "自动客服回复"),
    (0.562, 0.666, "zh-success-office.png", "市场 · 销售 · 行业趋势"),
    (0.666, 0.771, "zh-platforms-bg.png", "YouTube · 抖音 · 小红书 · 更多"),
    (0.771, 0.846, "zh-businessman-desk.png", "个人站与企业站"),
    (0.846, 0.945, "zh-success-office.png", "一个月 · 100万美元收益"),
    (0.945, 1.000, "zh-businessman-hero.png", "今晚开始 · pzhisen.online"),
]


def load_duration() -> float:
    path = ASSETS / "narration-zh.duration.txt"
    if path.exists():
        return float(path.read_text(encoding="utf-8").strip())
    out = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=nw=1:nk=1",
            str(ASSETS / "narration-zh.mp3"),
        ],
        text=True,
    ).strip()
    return float(out)


def build_scenes(duration: float) -> list[tuple[float, float, str, str]]:
    scenes = []
    for a, b, img, title in SCENE_SPEC:
        scenes.append((a * duration, b * duration, img, title))
    # snap last end exactly to duration
    last = scenes[-1]
    scenes[-1] = (last[0], duration, last[2], last[3])
    return scenes


def find_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    # Prefer CJK-capable fonts for Chinese titles
    candidates = [
        "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
        "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc" if bold else "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc" if bold else "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def find_subtitle_font_name() -> str:
    for path in (
        "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
        "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
    ):
        if Path(path).exists():
            return path
    return "DejaVu Sans"


def cover_resize(img: Image.Image, tw: int, th: int) -> Image.Image:
    scale = max(tw / img.width, th / img.height)
    nw, nh = int(img.width * scale), int(img.height * scale)
    img = img.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - tw) // 2
    top = (nh - th) // 2
    return img.crop((left, top, left + tw, top + th))


def ken_burns(img: Image.Image, progress: float, zoom_in: bool = True) -> Image.Image:
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
    ox = max(0, min(ox, base.width - sw))
    oy = max(0, min(oy, base.height - sh))
    crop = base.crop((ox, oy, ox + sw, oy + sh)).resize((W, H), Image.Resampling.LANCZOS)
    return crop


def gradient_overlay(draw: ImageDraw.ImageDraw) -> None:
    for y in range(H - 280, H):
        a = int(210 * ((y - (H - 280)) / 280))
        draw.rectangle([0, y, W, y + 1], fill=(8, 12, 22, a))
    for y in range(0, 160):
        a = int(120 * (1 - y / 160))
        draw.rectangle([0, y, W, y + 1], fill=(8, 12, 22, a))


def wrap_text(text: str, font: ImageFont.ImageFont, max_width: int, draw: ImageDraw.ImageDraw) -> list[str]:
    # Chinese often has no spaces — wrap by character when needed
    if " " in text and not re.search(r"[\u4e00-\u9fff]", text):
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

    lines = []
    cur = ""
    for ch in text:
        test = cur + ch
        if draw.textlength(test, font=font) <= max_width:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = ch
    if cur:
        lines.append(cur)
    return lines


def draw_title_bar(base: Image.Image, title: str) -> Image.Image:
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    gradient_overlay(draw)

    font_sm = find_font(28, bold=True)
    font_lg = find_font(52, bold=True)
    chip = "PZHISEN"
    pad_x, pad_y = 22, 12
    tw = int(draw.textlength(chip, font=font_sm))
    chip_box = (64, 56, 64 + tw + pad_x * 2, 56 + 28 + pad_y * 2)
    draw.rounded_rectangle(chip_box, radius=8, fill=(255, 255, 255, 34))
    draw.text((64 + pad_x, 56 + pad_y), chip, font=font_sm, fill=(245, 247, 250, 235))

    lines = wrap_text(title, font_lg, W - 160, draw)
    y = 140
    for line in lines[:2]:
        draw.text((72, y), line, font=font_lg, fill=(255, 255, 255, 245))
        y += 66

    font_url = find_font(30, bold=True)
    draw.text((72, H - 120), "pzhisen.online", font=font_url, fill=(180, 210, 255, 230))

    composed = Image.alpha_composite(base.convert("RGBA"), overlay)
    return composed.convert("RGB")


def scene_for_t(t: float, scenes: list[tuple[float, float, str, str]]) -> tuple[str, str, float, bool]:
    for i, (a, b, img, title) in enumerate(scenes):
        if t < b or i == len(scenes) - 1:
            progress = 0 if b == a else (t - a) / (b - a)
            return img, title, max(0.0, min(1.0, progress)), (i % 2 == 0)
    img, title = scenes[-1][2], scenes[-1][3]
    return img, title, 1.0, True


def render_frames(duration: float, scenes: list[tuple[float, float, str, str]]) -> None:
    FRAMES.mkdir(parents=True, exist_ok=True)
    for old in FRAMES.glob("*.jpg"):
        old.unlink()

    cache: dict[str, Image.Image] = {}
    total = int(math.ceil(duration * FPS))
    print(f"Rendering {total} frames @ {FPS}fps ({duration:.2f}s)…")
    for i in range(total):
        t = i / FPS
        name, title, progress, zoom_in = scene_for_t(t, scenes)
        if name not in cache:
            cache[name] = Image.open(ASSETS / name).convert("RGB")
        frame = ken_burns(cache[name], progress, zoom_in=zoom_in)
        frame = ImageEnhance.Contrast(frame).enhance(1.05)
        frame = ImageEnhance.Color(frame).enhance(1.04)
        frame = draw_title_bar(frame, title)
        frame.save(FRAMES / f"frame_{i:05d}.jpg", quality=90, optimize=True)
        if i % (FPS * 5) == 0:
            print(f"  {i}/{total} ({100 * i / total:.0f}%)")
    print("Frames done.")


def burn_subtitles(duration: float) -> None:
    srt = ASSETS / "narration-zh.srt"
    # escape path for ffmpeg subtitles filter
    font_path = find_subtitle_font_name()
    srt_esc = str(srt).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
    font_esc = font_path.replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
    # FontName for TTC can be tricky; use Fontname via fontsdir + FontName=WenQuanYi Micro Hei
    style = (
        "FontName=WenQuanYi Micro Hei,FontSize=24,PrimaryColour=&H00FFFFFF,"
        "OutlineColour=&H80000000,BorderStyle=3,Outline=2,Shadow=0,"
        "MarginV=52,Alignment=2,Bold=0"
    )
    fontsdir = str(Path(font_path).parent).replace("\\", "/").replace(":", "\\:")
    cmd = [
        "ffmpeg",
        "-y",
        "-framerate",
        str(FPS),
        "-i",
        str(FRAMES / "frame_%05d.jpg"),
        "-i",
        str(ASSETS / "narration-zh.mp3"),
        "-vf",
        f"subtitles={srt_esc}:fontsdir={fontsdir}:force_style='{style}'",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-t",
        f"{duration:.3f}",
        "-movflags",
        "+faststart",
        str(OUT_DIR / "pzhisen-promo-zh.mp4"),
    ]
    print("Encoding Chinese MP4…")
    subprocess.run(cmd, check=True)
    print("Wrote", OUT_DIR / "pzhisen-promo-zh.mp4")


def main() -> None:
    duration = load_duration()
    scenes = build_scenes(duration)
    render_frames(duration, scenes)
    burn_subtitles(duration)


if __name__ == "__main__":
    main()
