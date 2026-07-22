#!/usr/bin/env python3
"""Generate Chinese narration MP3 + VTT/SRT for the Pzhisen promo video."""
from __future__ import annotations

import asyncio
import subprocess
import tempfile
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
VOICE = "zh-CN-YunyangNeural"
RATE = "-5%"  # slightly slower for clarity / subtitle readability

# Each cue becomes one subtitle block. Keep lines short for on-screen readability.
CUES: list[str] = [
    "您好，我是陈总——一位在中国和全球市场创办并规模化多家企业的成功创业者。",
    "今天我想向大家详细讲解一个彻底改变我营销与运营方式的平台：Pzhisen，网址就是 pzhisen.online。",
    "使用非常便捷、迅速、快捷。",
    "打开网站，告诉它你的商业想法，几分钟就能部署你的 AI 智能体团队——无需复杂配置，开始使用也无需绑定信用卡。",
    "智能体上线后，全年三百六十五天、每天二十四小时不间断为你工作。",
    "从不睡觉。",
    "从不休息。",
    "永不下班。",
    "有了 Pzhisen，专业 AI 智能体可以全自动制作推广营销推文文案。",
    "可以全自动制作推广营销视频。",
    "可以制作推广营销文案，并发送到全球主流邮箱——Gmail、Outlook、QQ 邮箱、163 等等。",
    "可以自动回复客服消息，让客户白天夜晚都能得到帮助。",
    "可以自动分析市场竞争力、销售数据，以及实时市场行情。",
    "可以自动调研市场，分析未来世界各行业走向。",
    "然后帮你发布到全球各大社交平台：YouTube、TikTok、X、Facebook、腾讯视频号、中国抖音、腾讯视频、快手、小红书，以及更多主流平台。",
    "无论你是个人网站还是企业网站，Pzhisen 都能帮助全球任何人，全自动推广营销你的线上业务。",
    "最重要的是：Pzhisen 已经帮助全球数千位个人和企业，通过 AI 智能体推广营销，在一个月内赚到了总计一百万美元的收益。",
    "如果你也准备好让 AI 团队替你昼夜不停地工作，现在就打开 pzhisen.online，今晚就开始。",
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


async def synth_cue(text: str, out_mp3: Path) -> None:
    communicate = edge_tts.Communicate(text, VOICE, rate=RATE)
    await communicate.save(str(out_mp3))


async def build() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="pzhisen-zh-tts-") as tmp:
        tmp_path = Path(tmp)
        parts: list[Path] = []
        durations: list[float] = []

        print(f"Synthesizing {len(CUES)} Chinese cues with {VOICE}…")
        for i, text in enumerate(CUES):
            part = tmp_path / f"cue_{i:02d}.mp3"
            await synth_cue(text, part)
            dur = probe_duration(part)
            parts.append(part)
            durations.append(dur)
            print(f"  [{i+1:02d}/{len(CUES)}] {dur:5.2f}s  {text[:28]}…")

        # Small pause between cues for readability (except after last)
        gap = 0.18
        list_file = tmp_path / "concat.txt"
        lines = []
        for i, p in enumerate(parts):
            lines.append(f"file '{p}'")
            if i < len(parts) - 1:
                # generate silent gap
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
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                lines.append(f"file '{silence}'")
        list_file.write_text("\n".join(lines) + "\n", encoding="utf-8")

        out_mp3 = ASSETS / "narration-zh.mp3"
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
                "-b:a",
                "192k",
                str(out_mp3),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        # Build VTT / SRT with measured cue timings (+ gaps)
        vtt_lines = ["WEBVTT", ""]
        srt_blocks: list[str] = []
        t = 0.05  # tiny lead-in
        for i, (text, dur) in enumerate(zip(CUES, durations)):
            start = t
            end = t + dur
            idx = i + 1
            vtt_lines.append(str(idx))
            vtt_lines.append(f"{fmt_ts(start)} --> {fmt_ts(end)}")
            vtt_lines.append(text)
            vtt_lines.append("")
            srt_blocks.append(
                f"{idx}\n{fmt_ts(start, srt=True)} --> {fmt_ts(end, srt=True)}\n{text}\n"
            )
            t = end + (gap if i < len(durations) - 1 else 0.0)

        (ASSETS / "narration-zh.vtt").write_text("\n".join(vtt_lines) + "\n", encoding="utf-8")
        (ASSETS / "narration-zh.srt").write_text("\n".join(srt_blocks) + "\n", encoding="utf-8")

        total = probe_duration(out_mp3)
        print(f"Wrote {out_mp3} ({total:.3f}s)")
        print(f"Wrote {ASSETS / 'narration-zh.vtt'}")
        print(f"Wrote {ASSETS / 'narration-zh.srt'}")
        # Persist scene timing hint for build_video_zh.py
        (ASSETS / "narration-zh.duration.txt").write_text(f"{total:.6f}\n", encoding="utf-8")


def main() -> None:
    asyncio.run(build())


if __name__ == "__main__":
    main()
