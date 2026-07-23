#!/usr/bin/env python3
"""Build 5 vertical (1080x1920) Pzhisen promo MP4s with EN burned-in subtitles.

Uses ffmpeg zoompan (fast) instead of per-frame Pillow rendering.
"""
from __future__ import annotations

import math
import re
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets" / "versions"
OUT_DIR = ROOT / "versions"
SHARED = ASSETS
VW, VH = 1080, 1920
FPS = 24

VERSION_META = [
    {"id": "v1", "name": "Michael", "title": "Meet Michael"},
    {"id": "v2", "name": "David", "title": "Meet David"},
    {"id": "v3", "name": "James", "title": "Meet James"},
    {"id": "v4", "name": "Carlos", "title": "Meet Carlos"},
    {"id": "v5", "name": "William", "title": "Meet William"},
]


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


def scene_plan(duration: float, ver_dir: Path) -> list[tuple[float, float, Path, str]]:
    """Return (start, end, image, label) covering full duration — face-led cut."""
    front = ver_dir / "front.png"
    gesture = ver_dir / "gesture.png"
    desk = ver_dir / "desk.png"
    success = ver_dir / "success.png"
    title = SHARED / "title-bg.png"
    site = SHARED / "site-index.png"
    dash = SHARED / "ui-dashboard.png"
    publish = SHARED / "ui-publish.png"
    analytics = SHARED / "ui-analytics.png"
    platforms = SHARED / "platforms-bg.png"

    # More talking-head coverage; B-roll interleaved briefly
    beats = [
        (0.00, 0.03, title, "Pzhisen"),
        (0.03, 0.14, front, "Meet the founder"),
        (0.14, 0.20, site, "pzhisen.online"),
        (0.20, 0.32, gesture, "Deploy in minutes"),
        (0.32, 0.38, dash, "Your AI employee team"),
        (0.38, 0.50, desk, "Tweets · Videos · Copy"),
        (0.50, 0.56, publish, "Email the world"),
        (0.56, 0.66, gesture, "Auto customer support"),
        (0.66, 0.74, analytics, "Market · Sales · Trends"),
        (0.74, 0.84, platforms, "YouTube · TikTok · Douyin · more"),
        (0.84, 0.93, success, "$1,000,000 in one month"),
        (0.93, 1.00, front, "Start tonight · pzhisen.online"),
    ]
    scenes: list[tuple[float, float, Path, str]] = []
    for a, b, img, label in beats:
        scenes.append((a * duration, b * duration, img, label))
    last = scenes[-1]
    scenes[-1] = (last[0], duration, last[2], last[3])
    return scenes


def make_title_card(tmp: Path, label: str, subtitle: str) -> Path:
    """Simple dark title still via ffmpeg lavfi + drawtext."""
    out = tmp / "title_card.png"
    # Escape for drawtext
    def esc(s: str) -> str:
        return s.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")

    vf = (
        f"color=c=0x0b1220:s={VW}x{VH}:d=1,"
        f"drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:"
        f"text='{esc(label)}':fontsize=72:fontcolor=white:x=(w-text_w)/2:y=(h/2)-80,"
        f"drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:"
        f"text='{esc(subtitle)}':fontsize=36:fontcolor=0xb4d2ff:x=(w-text_w)/2:y=(h/2)+20"
    )
    subprocess.run(
        ["ffmpeg", "-y", "-f", "lavfi", "-i", vf, "-frames:v", "1", str(out)],
        check=True,
        capture_output=True,
    )
    return out


def render_scene_clip(
    img: Path,
    duration: float,
    out_clip: Path,
    *,
    zoom_in: bool,
    is_broll: bool,
) -> None:
    """Ken Burns style vertical clip from a still."""
    frames = max(1, int(math.ceil(duration * FPS)))
    # zoompan uses on/on expressions; d=frames
    if zoom_in:
        z_expr = f"min(zoom+0.0008,1.12)"
        x_expr = "iw/2-(iw/zoom/2)"
        y_expr = "ih/2-(ih/zoom/2)"
    else:
        z_expr = f"if(eq(on,1),1.12,max(zoom-0.0008,1.0))"
        x_expr = "iw/2-(iw/zoom/2)"
        y_expr = "ih/2-(ih/zoom/2)"

    # Scale to cover vertical, then zoompan
    # For landscape UI b-roll: pad with blurred bg via scale+pad
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


def wrap_caption(text: str, max_chars: int = 40) -> str:
    """Soft-wrap caption into readable lines for vertical video (no truncation)."""
    words = text.split()

    def pack(limit: int) -> list[str]:
        lines: list[str] = []
        cur = ""
        for w in words:
            test = (cur + " " + w).strip()
            if len(test) <= limit:
                cur = test
            else:
                if cur:
                    lines.append(cur)
                cur = w
        if cur:
            lines.append(cur)
        return lines

    lines = pack(max_chars)
    if len(lines) > 3:
        lines = pack(48)
    if len(lines) > 4:
        lines = pack(56)
    return "\\N".join(lines)


def srt_to_vertical_ass(srt: Path, ass: Path) -> None:
    """ASS tuned for 1080×1920: bottom captions, readable wrap, face mostly clear."""
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
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,DejaVu Sans,32,&H00FFFFFF,&H000000FF,&H78000000,&H64000000,0,0,0,0,100,100,0,0,3,2,0,2,52,52,110,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events: list[str] = []
    for start, end, body in cues:
        text = wrap_caption(body)
        text = text.replace("{", "\\{").replace("}", "\\}")
        events.append(
            f"Dialogue: 0,{ass_ts(start)},{ass_ts(end)},Default,,0,0,0,,{text}"
        )
    ass.write_text(header + "\n".join(events) + "\n", encoding="utf-8")


def burn_subtitles(video: Path, srt: Path, audio: Path, outfile: Path) -> None:
    ass = srt.with_suffix(".ass")
    srt_to_vertical_ass(srt, ass)
    ass_esc = str(ass.resolve()).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(video),
            "-i",
            str(audio),
            "-vf",
            f"ass={ass_esc}",
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
    outfile = OUT_DIR / f"pzhisen-promo-{vid}-vertical.mp4"
    silent_path = OUT_DIR / f"pzhisen-promo-{vid}-silent.mp4"

    if subs_only:
        if not silent_path.exists():
            raise FileNotFoundError(f"Missing silent video for {vid}: {silent_path}")
        print(f"\n=== Re-burning subs {vid} ({meta['name']}) ===")
        burn_subtitles(silent_path, srt, audio, outfile)
        size_mb = outfile.stat().st_size / (1024 * 1024)
        print(f"  Done: {outfile} ({size_mb:.1f} MB)")
        return outfile

    scenes = scene_plan(duration, ver_dir)
    print(f"\n=== Building {vid} ({meta['name']}) {duration:.1f}s vertical ===")

    with tempfile.TemporaryDirectory(prefix=f"pzhisen-{vid}-vid-") as tmp:
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
        # Keep silent for fast subtitle re-burns
        subprocess.run(["cp", str(silent), str(silent_path)], check=True)

        print(f"  Burning English subtitles → {outfile.name}")
        burn_subtitles(silent, srt, audio, outfile)

    size_mb = outfile.stat().st_size / (1024 * 1024)
    print(f"  Done: {outfile} ({size_mb:.1f} MB)")
    return outfile


def main() -> None:
    import sys

    args = sys.argv[1:]
    subs_only = "--subs-only" in args
    args = [a for a in args if a != "--subs-only"]
    only = args[0] if args else "all"
    for meta in VERSION_META:
        if only != "all" and only != meta["id"]:
            continue
        build_one(meta, subs_only=subs_only)
    print("\nAll requested vertical videos built.")


if __name__ == "__main__":
    main()
