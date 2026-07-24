#!/usr/bin/env python3
"""Build 5 vertical (1080x1920) Chinese Pzhisen promo MP4s with ZH burned-in subtitles.

Uses ffmpeg zoompan (fast) instead of per-frame Pillow rendering.
"""
from __future__ import annotations

import math
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets" / "versions-zh"
SHARED_EN = ROOT / "assets" / "versions"
SHARED_ZH = ROOT / "assets"
OUT_DIR = ROOT / "versions-zh"
VW, VH = 1080, 1920
FPS = 24

VERSION_META = [
    {"id": "v1", "name": "陈总", "title": "认识陈总"},
    {"id": "v2", "name": "李总", "title": "认识李总"},
    {"id": "v3", "name": "王总", "title": "认识王总"},
    {"id": "v4", "name": "张总", "title": "认识张总"},
    {"id": "v5", "name": "刘总", "title": "认识刘总"},
]

FONT = "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc"


def probe_duration(path: Path) -> float:
    out = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=nw=1:nk=1",
            str(path),
        ],
        text=True,
    ).strip()
    return float(out)


def parse_srt_cues(srt: Path) -> list[tuple[float, float, str]]:
    text = srt.read_text(encoding="utf-8")
    blocks = re.split(r"\n\s*\n", text.strip())
    cues: list[tuple[float, float, str]] = []

    def parse_ts(t: str) -> float:
        t = t.strip().replace(",", ".")
        h, m, rest = t.split(":")
        s = float(rest)
        return int(h) * 3600 + int(m) * 60 + s

    for block in blocks:
        lines = [ln for ln in block.splitlines() if ln.strip()]
        if not lines:
            continue
        if re.fullmatch(r"\d+", lines[0].strip()):
            lines = lines[1:]
        if not lines or "-->" not in lines[0]:
            continue
        a, b = [p.strip() for p in lines[0].split("-->")]
        body = " ".join(lines[1:]).strip()
        cues.append((parse_ts(a), parse_ts(b.split()[0]), body))
    return cues


def ensure_shared_assets() -> None:
    """Copy / link shared B-roll into versions-zh root if missing."""
    ASSETS.mkdir(parents=True, exist_ok=True)
    mapping = {
        "title-bg.png": SHARED_ZH / "title-bg.png",
        "platforms-bg.png": SHARED_ZH / "zh-platforms-bg.png",
        "site-index.png": SHARED_EN / "site-index.png",
        "ui-dashboard.png": SHARED_EN / "ui-dashboard.png",
        "ui-publish.png": SHARED_EN / "ui-publish.png",
        "ui-analytics.png": SHARED_EN / "ui-analytics.png",
    }
    for name, src in mapping.items():
        dst = ASSETS / name
        if not dst.exists():
            if not src.exists():
                raise FileNotFoundError(src)
            shutil.copy2(src, dst)


def scene_plan(duration: float, ver_dir: Path) -> list[tuple[float, float, Path, str]]:
    front = ver_dir / "front.png"
    gesture = ver_dir / "gesture.png"
    desk = ver_dir / "desk.png"
    success = ver_dir / "success.png"
    title = ASSETS / "title-bg.png"
    site = ASSETS / "site-index.png"
    dash = ASSETS / "ui-dashboard.png"
    publish = ASSETS / "ui-publish.png"
    analytics = ASSETS / "ui-analytics.png"
    platforms = ASSETS / "platforms-bg.png"

    beats = [
        (0.00, 0.03, title, "Pzhisen"),
        (0.03, 0.14, front, "认识讲者"),
        (0.14, 0.20, site, "pzhisen.online"),
        (0.20, 0.32, gesture, "几分钟即可部署"),
        (0.32, 0.38, dash, "你的 AI 智能体团队"),
        (0.38, 0.50, desk, "推文 · 视频 · 文案"),
        (0.50, 0.56, publish, "全球主流邮箱"),
        (0.56, 0.66, gesture, "自动客服回复"),
        (0.66, 0.74, analytics, "市场 · 销售 · 趋势"),
        (0.74, 0.84, platforms, "YouTube · 抖音 · 小红书"),
        (0.84, 0.93, success, "一个月 · 100万美元"),
        (0.93, 1.00, front, "今晚开始 · pzhisen.online"),
    ]
    scenes: list[tuple[float, float, Path, str]] = []
    for a, b, img, label in beats:
        scenes.append((a * duration, b * duration, img, label))
    last = scenes[-1]
    scenes[-1] = (last[0], duration, last[2], last[3])
    return scenes


def render_scene_clip(
    img: Path,
    duration: float,
    out_clip: Path,
    *,
    zoom_in: bool,
    is_broll: bool,
) -> None:
    frames = max(1, int(math.ceil(duration * FPS)))
    if zoom_in:
        z_expr = "min(zoom+0.0008,1.12)"
        x_expr = "iw/2-(iw/zoom/2)"
        y_expr = "ih/2-(ih/zoom/2)"
    else:
        z_expr = "if(eq(on,1),1.12,max(zoom-0.0008,1.0))"
        x_expr = "iw/2-(iw/zoom/2)"
        y_expr = "ih/2-(ih/zoom/2)"

    if is_broll:
        vf = (
            f"scale={VW}:{VH}:force_original_aspect_ratio=decrease,"
            f"pad={VW}:{VH}:(ow-iw)/2:(oh-ih)/2:color=0x0b1220,"
            f"zoompan=z='{z_expr}':x='{x_expr}':y='{y_expr}':d={frames}:s={VW}x{VH}:fps={FPS},"
            f"format=yuv420p"
        )
    else:
        vf = (
            f"scale={VW}:{VH}:force_original_aspect_ratio=increase,"
            f"crop={VW}:{VH},"
            f"zoompan=z='{z_expr}':x='{x_expr}':y='{y_expr}':d={frames}:s={VW}x{VH}:fps={FPS},"
            f"format=yuv420p"
        )

    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loop",
            "1",
            "-i",
            str(img),
            "-vf",
            vf,
            "-t",
            f"{duration:.3f}",
            "-r",
            str(FPS),
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "20",
            "-pix_fmt",
            "yuv420p",
            str(out_clip),
        ],
        check=True,
        capture_output=True,
    )


def wrap_zh_caption(text: str, max_chars: int = 16) -> str:
    """Character-based wrap for Chinese captions (1–2 short lines)."""
    text = re.sub(r"\s+", "", text.strip())
    if not text:
        return text
    # Prefer breaking near punctuation
    lines: list[str] = []
    i = 0
    while i < len(text):
        chunk = text[i : i + max_chars]
        if i + max_chars < len(text):
            # try soft break on punctuation within last 6 chars
            soft = None
            for j, ch in enumerate(chunk):
                if ch in "，。；：、！？,.!?;:——":
                    soft = j + 1
            if soft and soft >= max_chars - 6:
                chunk = chunk[:soft]
        lines.append(chunk)
        i += len(chunk)
        if len(lines) >= 3:
            # dump remainder on last line (slightly longer)
            rest = text[i:]
            if rest:
                lines[-1] = lines[-1] + rest
            break
    return "\\N".join(lines)


def srt_to_vertical_ass(srt: Path, ass: Path) -> None:
    cues = parse_srt_cues(srt)

    def ass_ts(seconds: float) -> str:
        if seconds < 0:
            seconds = 0.0
        cs = int(round(seconds * 100))
        h, cs = divmod(cs, 360000)
        m, cs = divmod(cs, 6000)
        s, cs = divmod(cs, 100)
        return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {VW}
PlayResY: {VH}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,WenQuanYi Micro Hei,34,&H00FFFFFF,&H000000FF,&H64000000,&H64000000,0,0,0,0,100,100,0,0,1,2,0,2,40,40,88,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events: list[str] = []
    for start, end, body in cues:
        text = wrap_zh_caption(body)
        text = text.replace("{", "\\{").replace("}", "\\}")
        events.append(
            f"Dialogue: 0,{ass_ts(start)},{ass_ts(end)},Default,,0,0,0,,{text}"
        )
    ass.write_text(header + "\n".join(events) + "\n", encoding="utf-8")


def burn_subtitles(video: Path, srt: Path, audio: Path, outfile: Path) -> None:
    ass = srt.with_suffix(".ass")
    srt_to_vertical_ass(srt, ass)
    # Prefer fontsdir so ASS finds WenQuanYi
    fontsdir = "/usr/share/fonts/truetype/wqy"
    ass_esc = str(ass.resolve()).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
    fonts_esc = fontsdir.replace("\\", "/").replace(":", "\\:")
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(video),
            "-i",
            str(audio),
            "-vf",
            f"ass={ass_esc}:fontsdir={fonts_esc}",
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
            "-shortest",
            "-movflags",
            "+faststart",
            str(outfile),
        ],
        check=True,
    )


def build_one(meta: dict, *, subs_only: bool = False) -> Path:
    vid = meta["id"]
    ver_dir = ASSETS / vid
    audio = ver_dir / "narration.mp3"
    srt = ver_dir / "narration.srt"
    if not audio.exists() or not srt.exists():
        raise FileNotFoundError(f"Missing narration for {vid}")

    duration = probe_duration(audio)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    outfile = OUT_DIR / f"pzhisen-promo-zh-{vid}-vertical.mp4"
    silent_path = OUT_DIR / f"pzhisen-promo-zh-{vid}-silent.mp4"

    if subs_only:
        if not silent_path.exists():
            raise FileNotFoundError(f"Missing silent video for {vid}: {silent_path}")
        print(f"\n=== Re-burning ZH subs {vid} ({meta['name']}) ===")
        burn_subtitles(silent_path, srt, audio, outfile)
        size_mb = outfile.stat().st_size / (1024 * 1024)
        print(f"  Done: {outfile} ({size_mb:.1f} MB)")
        return outfile

    scenes = scene_plan(duration, ver_dir)
    print(f"\n=== Building ZH {vid} ({meta['name']}) {duration:.1f}s vertical ===")

    with tempfile.TemporaryDirectory(prefix=f"pzhisen-zh-{vid}-vid-") as tmp:
        tmp_path = Path(tmp)
        clips: list[Path] = []
        for i, (a, b, img, label) in enumerate(scenes):
            dur = max(0.35, b - a)
            if not img.exists():
                raise FileNotFoundError(img)
            clip = tmp_path / f"clip_{i:02d}.mp4"
            is_broll = img.name.startswith("ui-") or img.name in {
                "site-index.png",
                "platforms-bg.png",
                "title-bg.png",
            }
            print(f"  scene {i+1:02d}/{len(scenes)} {dur:5.2f}s  {img.name}  ({label})")
            render_scene_clip(img, dur, clip, zoom_in=(i % 2 == 0), is_broll=is_broll)
            clips.append(clip)

        concat_list = tmp_path / "concat.txt"
        concat_list.write_text(
            "\n".join(f"file '{c}'" for c in clips) + "\n", encoding="utf-8"
        )
        silent = tmp_path / "silent.mp4"
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(concat_list),
                "-c",
                "copy",
                str(silent),
            ],
            check=True,
            capture_output=True,
        )
        subprocess.run(["cp", str(silent), str(silent_path)], check=True)

        print(f"  Burning Chinese subtitles → {outfile.name}")
        burn_subtitles(silent, srt, audio, outfile)

    size_mb = outfile.stat().st_size / (1024 * 1024)
    print(f"  Done: {outfile} ({size_mb:.1f} MB)")
    return outfile


def main() -> None:
    import sys

    ensure_shared_assets()
    args = sys.argv[1:]
    subs_only = "--subs-only" in args
    args = [a for a in args if a != "--subs-only"]
    only = args[0] if args else "all"
    for meta in VERSION_META:
        if only != "all" and only != meta["id"]:
            continue
        build_one(meta, subs_only=subs_only)
    print("\nAll requested Chinese vertical videos built.")


if __name__ == "__main__":
    main()
