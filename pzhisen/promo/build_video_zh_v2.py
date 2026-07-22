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
    # Vertical: lighter bottom band so normal-size bottom subtitles stay readable
    # without covering the talking-head.
    if vertical:
        band = int(th * 0.14)
        for y in range(th - band, th):
            a = int(160 * ((y - (th - band)) / band))
            draw.rectangle([0, y, tw, y + 1], fill=(8, 12, 22, a))
        for y in range(0, int(th * 0.10)):
            a = int(100 * (1 - y / (th * 0.10)))
            draw.rectangle([0, y, tw, y + 1], fill=(8, 12, 22, a))
    else:
        gradient_overlay(draw, tw, th)

    fs_chip = 20 if vertical else 28
    fs_title = 30 if vertical else 50
    fs_url = 20 if vertical else 30
    font_sm = find_font(fs_chip, bold=True)
    font_lg = find_font(fs_title, bold=True)
    font_url = find_font(fs_url, bold=True)

    chip = "PZHISEN"
    pad_x, pad_y = 16, 8
    chip_w = int(draw.textlength(chip, font=font_sm))
    chip_box = (40, 40, 40 + chip_w + pad_x * 2, 40 + fs_chip + pad_y * 2)
    draw.rounded_rectangle(chip_box, radius=8, fill=(255, 255, 255, 36))
    draw.text((40 + pad_x, 40 + pad_y), chip, font=font_sm, fill=(245, 247, 250, 235))

    max_w = tw - 100
    display = "AI 智能体 · 替你昼夜工作" if kind == "title" else title
    lines = wrap_text(display, font_lg, max_w, draw)
    if kind == "title":
        y = th // 2 - 60
    elif vertical:
        # Keep titles in the upper band so bottom stays free for subtitles
        y = 96
    else:
        y = 110
    for line in lines[:2 if vertical else 3]:
        draw.text((42, y + 2), line, font=font_lg, fill=(0, 0, 0, 120))
        draw.text((40, y), line, font=font_lg, fill=(255, 255, 255, 245))
        y += fs_title + 10

    # Vertical: put URL at top-right so it never fights bottom captions
    if vertical:
        url = "pzhisen.online"
        uw = int(draw.textlength(url, font=font_url))
        draw.text((tw - uw - 42, 48), url, font=font_url, fill=(180, 210, 255, 230))
    else:
        url_y = th - 120
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


def wrap_zh_lines(text: str, width: int = 14) -> list[str]:
    """Wrap Chinese/Latin mix into short lines for vertical readability.

    Prefer breaks at punctuation; avoid splitting Latin tokens mid-word.
    """
    text = re.sub(r"\s+", " ", text.strip())
    if not text:
        return []

    # Split into clauses on common punctuation (keep delimiter on the left piece)
    parts = re.split(r"(?<=[，。；、：！？,.;:!?])", text)
    parts = [p for p in parts if p]

    lines: list[str] = []
    buf = ""

    def flush() -> None:
        nonlocal buf
        if buf.strip():
            lines.append(buf.strip())
        buf = ""

    def hard_wrap(chunk: str) -> None:
        """Hard wrap long chunk; keep ASCII runs together when possible."""
        nonlocal buf
        i = 0
        while i < len(chunk):
            space = width - len(buf)
            if space <= 0:
                flush()
                space = width
            # Take a Latin word as a unit
            if chunk[i].isalnum() and ord(chunk[i]) < 128:
                j = i
                while j < len(chunk) and (chunk[j].isalnum() or chunk[j] in ".-_/@"):
                    j += 1
                word = chunk[i:j]
                if len(word) > space and buf:
                    flush()
                if len(word) > width:
                    # extremely long token — hard cut
                    while word:
                        lines.append(word[:width])
                        word = word[width:]
                    buf = ""
                else:
                    buf += word
                i = j
            else:
                buf += chunk[i]
                i += 1
                if len(buf) >= width:
                    flush()

    for part in parts:
        if len(buf) + len(part) <= width:
            buf += part
            if part and part[-1] in "，。；、：！？,.;:!?":
                # soft preference: flush after clause if line is reasonably full
                if len(buf) >= max(8, width - 4):
                    flush()
        else:
            if buf:
                flush()
            if len(part) <= width:
                buf = part
                if part and part[-1] in "，。；、：！？,.;:!?":
                    if len(buf) >= max(8, width - 4):
                        flush()
            else:
                hard_wrap(part)
    flush()
    return lines


def srt_time_to_ass(t: str) -> str:
    """SRT 00:00:01,234 -> ASS 0:00:01.23"""
    t = t.strip().replace(",", ".")
    h, m, rest = t.split(":")
    sec, ms = rest.split(".")
    cs = int(round(int(ms[:3].ljust(3, "0")) / 10))
    return f"{int(h)}:{m}:{sec}.{cs:02d}"


def write_ass_from_srt(
    srt_path: Path,
    ass_path: Path,
    *,
    play_w: int,
    play_h: int,
    fontsize: int,
    margin_v: int,
    wrap_width: int,
) -> None:
    """Write ASS with explicit PlayRes so FontSize is not scaled from 288 defaults."""
    font_name = "WenQuanYi Micro Hei"
    font_path = "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc"
    if not Path(font_path).exists():
        font_name = "Droid Sans Fallback"

    text = srt_path.read_text(encoding="utf-8")
    blocks = re.split(r"\n\s*\n", text.strip())
    events: list[str] = []
    for block in blocks:
        lines = [ln for ln in block.splitlines() if ln.strip()]
        if not lines:
            continue
        if re.fullmatch(r"\d+", lines[0].strip()):
            lines = lines[1:]
        if not lines or "-->" not in lines[0]:
            continue
        start_s, end_s = [p.strip() for p in lines[0].split("-->")]
        body = " ".join(lines[1:]).strip()
        if not body:
            continue
        wrapped = wrap_zh_lines(body, wrap_width)
        if not wrapped:
            continue
        # Keep at most 2 lines on screen; split overflow into timed follow-up cues
        start = srt_time_to_ass(start_s)
        end = srt_time_to_ass(end_s)

        def to_seconds(ass_t: str) -> float:
            h, m, rest = ass_t.split(":")
            s, cs = rest.split(".")
            return int(h) * 3600 + int(m) * 60 + int(s) + int(cs) / 100.0

        def to_ass(sec: float) -> str:
            if sec < 0:
                sec = 0
            h = int(sec // 3600)
            m = int((sec % 3600) // 60)
            s = int(sec % 60)
            cs = int(round((sec - int(sec)) * 100))
            if cs >= 100:
                s += 1
                cs -= 100
            return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

        t0, t1 = to_seconds(start), to_seconds(end)
        chunks = [wrapped[i : i + 2] for i in range(0, len(wrapped), 2)]
        span = (t1 - t0) / max(1, len(chunks))
        for i, chunk in enumerate(chunks):
            a = t0 + i * span
            b = t1 if i == len(chunks) - 1 else t0 + (i + 1) * span
            dialogue = "\\N".join(chunk)
            events.append(
                f"Dialogue: 0,{to_ass(a)},{to_ass(b)},Default,,0,0,0,,{dialogue}"
            )

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {play_w}
PlayResY: {play_h}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_name},{fontsize},&H00FFFFFF,&H000000FF,&H64000000,&H64000000,0,0,0,0,100,100,0,0,1,2,0,2,40,40,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ass_path.write_text(header + "\n".join(events) + "\n", encoding="utf-8")


def encode(frames_dir: Path, outfile: Path, vertical: bool = False) -> None:
    srt = ASSETS / "narration-zh.srt"
    vtt_to_srt(ASSETS / "narration-zh.vtt", srt)

    if vertical:
        # Normal bottom captions for 9:16 talking-head: modest size, bottom-aligned
        ass = ASSETS / "narration-zh-vertical.ass"
        write_ass_from_srt(
            srt,
            ass,
            play_w=VW,
            play_h=VH,
            fontsize=34,   # ~normal phone subtitle size at 1080x1920
            margin_v=88,   # sit near bottom, clear of face
            wrap_width=14, # short lines, max 2 on screen
        )
        sub_path = ass
    else:
        ass = ASSETS / "narration-zh-landscape.ass"
        write_ass_from_srt(
            srt,
            ass,
            play_w=LW,
            play_h=LH,
            fontsize=40,
            margin_v=52,
            wrap_width=22,
        )
        sub_path = ass

    sub_esc = str(sub_path).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
    cmd = [
        "ffmpeg", "-y",
        "-framerate", str(FPS),
        "-i", str(frames_dir / "frame_%05d.jpg"),
        "-i", str(ASSETS / "narration-zh.mp3"),
        "-vf", f"ass={sub_esc}",
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
    import sys

    if not (SHOTS / "ui-dashboard.png").exists():
        subprocess.run(["python3", str(ROOT / "make_ui_broll.py")], check=True)
    duration = load_duration()
    scenes = build_scenes(duration)
    print(f"ZH duration: {duration:.3f}s")

    only = sys.argv[1] if len(sys.argv) > 1 else "all"
    if only in ("all", "landscape"):
        frames = render(scenes, duration, vertical=False)
        encode(frames, OUT_DIR / "pzhisen-promo-zh.mp4", vertical=False)
    if only in ("all", "vertical"):
        frames_v = render(scenes, duration, vertical=True)
        encode(frames_v, OUT_DIR / "pzhisen-promo-zh-vertical.mp4", vertical=True)


if __name__ == "__main__":
    main()
