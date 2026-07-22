#!/usr/bin/env python3
"""Build polished Pzhisen ZH promo: talking-head cuts + site/UI B-roll + landscape & vertical."""
from __future__ import annotations

import math
import re
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
SHOTS = ASSETS / "shots"
FRAMES = ROOT / "frames-zh-v2"
FRAMES_V = ROOT / "frames-zh-v2-vert"
OUT_DIR = ROOT
FPS = 24
LW, LH = 1920, 1080
VW, VH = 1080, 1920

# Fractions of total narration duration — denser talking-head + B-roll rhythm
SCENE_SPEC = [
    (0.000, 0.040, "title-bg.png", "Pzhisen", "title"),
    (0.040, 0.100, "zh-talk-front.png", "认识陈总", "talk"),
    (0.100, 0.150, "shots/site-index.png", "pzhisen.online", "broll"),
    (0.150, 0.220, "zh-talk-gesture.png", "几分钟即可部署", "talk"),
    (0.220, 0.280, "shots/ui-dashboard.png", "你的 AI 智能体团队", "broll"),
    (0.280, 0.360, "zh-talk-emphatic.png", "全年 · 每天24小时", "talk"),
    (0.360, 0.440, "zh-businessman-desk.png", "推文 · 视频 · 文案", "talk"),
    (0.440, 0.510, "zh-talk-gesture.png", "全球主流邮箱群发", "talk"),
    (0.510, 0.580, "shots/ui-publish.png", "自动客服回复", "broll"),
    (0.580, 0.680, "shots/ui-analytics.png", "市场 · 销售 · 趋势", "broll"),
    (0.680, 0.780, "zh-platforms-bg.png", "YouTube · 抖音 · 小红书", "broll"),
    (0.780, 0.850, "zh-talk-front.png", "个人站与企业站", "talk"),
    (0.850, 0.940, "zh-success-office.png", "一个月 · 100万美元", "talk"),
    (0.940, 1.000, "zh-talk-emphatic.png", "今晚开始 · pzhisen.online", "cta"),
]


def load_duration() -> float:
    path = ASSETS / "narration-zh.duration.txt"
    if path.exists():
        return float(path.read_text(encoding="utf-8").strip())
    out = subprocess.check_output(
        [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=nw=1:nk=1", str(ASSETS / "narration-zh.mp3"),
        ],
        text=True,
    ).strip()
    return float(out)


def build_scenes(duration: float):
    scenes = []
    for a, b, img, title, kind in SCENE_SPEC:
        scenes.append((a * duration, b * duration, img, title, kind))
    last = scenes[-1]
    scenes[-1] = (last[0], duration, last[2], last[3], last[4])
    return scenes


def find_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
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
    bg = cover_resize(img, tw, th).filter(ImageFilter.GaussianBlur(28))
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


def wrap_text(text: str, fnt: ImageFont.ImageFont, max_width: int, draw: ImageDraw.ImageDraw) -> list[str]:
    # Character-aware wrap for Chinese + Latin mix
    lines: list[str] = []
    cur = ""
    for ch in text:
        test = cur + ch
        if draw.textlength(test, font=fnt) <= max_width:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = ch
    if cur:
        lines.append(cur)
    return lines


def draw_chrome(base: Image.Image, title: str, kind: str, vertical: bool) -> Image.Image:
    tw, th = base.size
    overlay = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    gradient_overlay(draw, tw, th)

    fs_chip = 22 if vertical else 28
    fs_title = 38 if vertical else 50
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
    display = "AI 智能体 · 替你昼夜工作" if kind == "title" else title
    lines = wrap_text(display, font_lg, max_w, draw)
    y = th // 2 - 60 if kind == "title" else (130 if vertical else 110)
    for line in lines[:3]:
        draw.text((52, y + 2), line, font=font_lg, fill=(0, 0, 0, 120))
        draw.text((50, y), line, font=font_lg, fill=(255, 255, 255, 245))
        y += fs_title + 12

    url_y = th - (160 if vertical else 120)
    draw.text((52, url_y + 2), "pzhisen.online", font=font_url, fill=(0, 0, 0, 100))
    draw.text((50, url_y), "pzhisen.online", font=font_url, fill=(180, 210, 255, 235))

    return Image.alpha_composite(base.convert("RGBA"), overlay).convert("RGB")


def scene_for_t(t: float, scenes):
    for i, (a, b, img, title, kind) in enumerate(scenes):
        if t < b or i == len(scenes) - 1:
            progress = 0 if b == a else (t - a) / (b - a)
            return img, title, kind, max(0.0, min(1.0, progress)), (i % 2 == 0)
    img, title, kind = scenes[-1][2], scenes[-1][3], scenes[-1][4]
    return img, title, kind, 1.0, True


def resolve_path(name: str) -> Path:
    p = ASSETS / name
    if p.exists():
        return p
    raise FileNotFoundError(name)


def render(scenes, duration: float, vertical: bool = False) -> Path:
    tw, th = (VW, VH) if vertical else (LW, LH)
    out_frames = FRAMES_V if vertical else FRAMES
    out_frames.mkdir(parents=True, exist_ok=True)
    for old in out_frames.glob("*.jpg"):
        old.unlink()

    cache: dict[str, Image.Image] = {}
    total = int(math.ceil(duration * FPS))
    label = "vertical" if vertical else "landscape"
    print(f"Rendering ZH {label}: {total} frames @ {FPS}fps ({tw}x{th})…")
    for i in range(total):
        t = i / FPS
        name, title, kind, progress, zoom_in = scene_for_t(t, scenes)
        if name not in cache:
            cache[name] = Image.open(resolve_path(name)).convert("RGB")
        src = cache[name]
        if vertical and kind == "broll" and src.width >= src.height:
            frame = contain_blur_bg(src, tw, th)
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
            print(f"  [zh-{label}] {i}/{total} ({100 * i / total:.0f}%)")
    print(f"Frames done (zh-{label}).")
    return out_frames


def encode(frames_dir: Path, outfile: Path, vertical: bool = False) -> None:
    srt = ASSETS / "narration-zh.srt"
    vtt_to_srt(ASSETS / "narration-zh.vtt", srt)
    srt_esc = str(srt).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
    # Prefer CJK-capable font for burned-in Chinese subs
    font_name = "WenQuanYi Micro Hei"
    for candidate in [
        "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
        "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
    ]:
        if Path(candidate).exists():
            if "wqy" in candidate:
                font_name = "WenQuanYi Micro Hei"
            else:
                font_name = "Droid Sans Fallback"
            break
    fontsize = 28 if vertical else 24
    margin_v = 120 if vertical else 48
    style = (
        f"FontName={font_name},FontSize={fontsize},PrimaryColour=&H00FFFFFF,"
        f"OutlineColour=&H80000000,BorderStyle=3,Outline=2,Shadow=0,"
        f"MarginV={margin_v},Alignment=2,Bold=0"
    )
    cmd = [
        "ffmpeg", "-y",
        "-framerate", str(FPS),
        "-i", str(frames_dir / "frame_%05d.jpg"),
        "-i", str(ASSETS / "narration-zh.mp3"),
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
    if not (SHOTS / "ui-dashboard.png").exists():
        subprocess.run(["python3", str(ROOT / "make_ui_broll.py")], check=True)
    duration = load_duration()
    scenes = build_scenes(duration)
    print(f"ZH duration: {duration:.3f}s")

    frames = render(scenes, duration, vertical=False)
    encode(frames, OUT_DIR / "pzhisen-promo-zh.mp4", vertical=False)

    frames_v = render(scenes, duration, vertical=True)
    encode(frames_v, OUT_DIR / "pzhisen-promo-zh-vertical.mp4", vertical=True)


if __name__ == "__main__":
    main()
