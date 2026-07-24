#!/usr/bin/env python3
"""Generate EN narration MP3 + VTT/SRT for five Pzhisen vertical promo versions."""
from __future__ import annotations

import asyncio
import subprocess
import tempfile
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets" / "versions"
RATE = "-3%"

# Shared body cues (identical product story across versions)
BODY: list[str] = [
    "Getting started is incredibly simple, fast, and convenient.",
    "You open the site, share your business idea, and deploy your AI employee team in minutes — no complicated setup, no credit card required to begin.",
    "Once your agents are live, they work for you twenty-four hours a day, seven days a week, three hundred sixty-five days a year.",
    "They never sleep.",
    "They never take a break.",
    "They never clock out.",
    "With Pzhisen, specialized AI agents automatically create promotional marketing tweets and social copy for your brand.",
    "They produce promotional marketing videos ready for distribution.",
    "They write promotional marketing emails and send them to mainstream inboxes worldwide — Gmail, Outlook, and more.",
    "They automatically reply to customer service messages, so your clients always get help — day or night.",
    "They automatically analyze your market competitiveness, your sales data, and real-time market conditions.",
    "They research industry trends and help you understand where the world's major sectors are heading next.",
    "Then they publish for you across the world's biggest platforms: YouTube, TikTok, X, Facebook, WeChat Channels, Douyin, Tencent Video, Kuaishou, Xiaohongshu — and more.",
    "Whether you have a personal website or a full enterprise site, Pzhisen helps anyone, anywhere, promote and grow online — fully automated.",
    "And here's the result that matters most: Pzhisen has already helped thousands of individuals and businesses worldwide generate one million dollars in revenue in a single month through AI-powered promotion and marketing.",
    "If you're ready to put an AI team to work while you sleep, go to pzhisen.online — and start tonight.",
]

VERSIONS: list[dict] = [
    {
        "id": "v1",
        "name": "Michael",
        "voice": "en-US-ChristopherNeural",
        "intro": [
            "Hi, I'm Michael — a founder who's built and scaled companies across the United States.",
            "Today I want to show you one platform that completely changed how I run marketing and operations: Pzhisen — that's pzhisen.online.",
        ],
    },
    {
        "id": "v2",
        "name": "David",
        "voice": "en-US-GuyNeural",
        "intro": [
            "Hey, I'm David — a U.S. entrepreneur who's grown multiple brands from zero to scale.",
            "I'm going to walk you through the fastest way I know to run marketing on autopilot: Pzhisen at pzhisen.online.",
        ],
    },
    {
        "id": "v3",
        "name": "James",
        "voice": "en-US-EricNeural",
        "intro": [
            "I'm James — a product founder based in the United States, building and shipping every day.",
            "Let me break down exactly how to use Pzhisen — pzhisen.online — so AI agents handle your entire marketing stack.",
        ],
    },
    {
        "id": "v4",
        "name": "Carlos",
        "voice": "en-US-RogerNeural",
        "intro": [
            "What's up — I'm Carlos. I've built and promoted businesses across the U.S. and globally.",
            "Today I'll show you, step by step, how Pzhisen — pzhisen.online — makes promotion ridiculously fast and fully automated.",
        ],
    },
    {
        "id": "v5",
        "name": "William",
        "voice": "en-US-BrianNeural",
        "intro": [
            "Good day. I'm William — an American executive who's led growth for companies nationwide.",
            "I want to carefully explain how anyone can use Pzhisen at pzhisen.online for twenty-four-seven AI-powered marketing.",
        ],
    },
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


def fmt_ts(seconds: float, *, srt: bool = False) -> str:
    if seconds < 0:
        seconds = 0.0
    ms = int(round(seconds * 1000))
    h, rem = divmod(ms, 3_600_000)
    m, rem = divmod(rem, 60_000)
    s, ms = divmod(rem, 1000)
    sep = "," if srt else "."
    return f"{h:02d}:{m:02d}:{s:02d}{sep}{ms:03d}"


async def synth_cue(text: str, voice: str, out_mp3: Path) -> None:
    communicate = edge_tts.Communicate(text, voice, rate=RATE)
    await communicate.save(str(out_mp3))


async def build_version(ver: dict) -> float:
    vid = ver["id"]
    voice = ver["voice"]
    cues = list(ver["intro"]) + BODY
    out_dir = ASSETS / vid
    out_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix=f"pzhisen-{vid}-tts-") as tmp:
        tmp_path = Path(tmp)
        parts: list[Path] = []
        durations: list[float] = []

        print(f"\n=== {vid} / {ver['name']} / {voice} — {len(cues)} cues ===")
        for i, text in enumerate(cues):
            part = tmp_path / f"cue_{i:02d}.mp3"
            await synth_cue(text, voice, part)
            dur = probe_duration(part)
            parts.append(part)
            durations.append(dur)
            print(f"  [{i+1:02d}/{len(cues)}] {dur:5.2f}s  {text[:40]}…")

        gap = 0.16
        list_file = tmp_path / "concat.txt"
        lines: list[str] = []
        for i, p in enumerate(parts):
            lines.append(f"file '{p}'")
            if i < len(parts) - 1:
                silence = tmp_path / f"gap_{i:02d}.mp3"
                subprocess.run(
                    [
                        "ffmpeg",
                        "-y",
                        "-f",
                        "lavfi",
                        "-i",
                        "anullsrc=r=24000:cl=mono",
                        "-t",
                        str(gap),
                        "-q:a",
                        "9",
                        "-acodec",
                        "libmp3lame",
                        str(silence),
                    ],
                    check=True,
                    capture_output=True,
                )
                lines.append(f"file '{silence}'")
        list_file.write_text("\n".join(lines) + "\n", encoding="utf-8")

        mp3 = out_dir / "narration.mp3"
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(list_file),
                "-c:a",
                "libmp3lame",
                "-q:a",
                "4",
                str(mp3),
            ],
            check=True,
            capture_output=True,
        )

        total = probe_duration(mp3)
        (out_dir / "duration.txt").write_text(f"{total:.3f}\n", encoding="utf-8")

        # Build VTT / SRT with cue timings including gaps
        vtt_lines = ["WEBVTT", ""]
        srt_blocks: list[str] = []
        t = 0.05
        for i, (text, dur) in enumerate(zip(cues, durations)):
            start = t
            end = t + dur
            vtt_lines.append(f"{fmt_ts(start)} --> {fmt_ts(end)}")
            vtt_lines.append(text)
            vtt_lines.append("")
            srt_blocks.append(
                f"{i+1}\n{fmt_ts(start, srt=True)} --> {fmt_ts(end, srt=True)}\n{text}\n"
            )
            t = end + gap

        (out_dir / "narration.vtt").write_text("\n".join(vtt_lines) + "\n", encoding="utf-8")
        (out_dir / "narration.srt").write_text("\n".join(srt_blocks) + "\n", encoding="utf-8")
        (out_dir / "script.txt").write_text("\n\n".join(cues) + "\n", encoding="utf-8")
        print(f"  Wrote {mp3.name} ({total:.2f}s) + VTT/SRT")
        return total


async def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    for ver in VERSIONS:
        await build_version(ver)
    print("\nAll narrations ready.")


if __name__ == "__main__":
    asyncio.run(main())
