#!/usr/bin/env python3
"""Generate ZH narration MP3 + VTT/SRT for five vertical Pzhisen promo versions."""
from __future__ import annotations

import asyncio
import subprocess
import tempfile
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets" / "versions-zh"
RATE = "-2%"

# Shared product story (same across versions; intros differ)
BODY: list[str] = [
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

VERSIONS: list[dict] = [
    {
        "id": "v1",
        "name": "陈总",
        "voice": "zh-CN-YunyangNeural",
        "intro": [
            "您好，我是陈总——一位在中国和全球市场创办并规模化多家企业的成功创业者。",
            "今天我想向大家详细讲解一个彻底改变我营销与运营方式的平台：Pzhisen，网址就是 pzhisen.online。",
        ],
    },
    {
        "id": "v2",
        "name": "李总",
        "voice": "zh-CN-YunjianNeural",
        "intro": [
            "大家好，我是李总——从零做到规模化、在多个赛道跑通增长的连续创业者。",
            "接下来我把最省事、最快的全自动推广方法讲清楚：打开 pzhisen.online，用 Pzhisen 的 AI 智能体。",
        ],
    },
    {
        "id": "v3",
        "name": "王总",
        "voice": "zh-CN-YunxiNeural",
        "intro": [
            "我是王总，深耕商业二十多年，带过团队、管过销售，也做过品牌。",
            "今天我一步一步讲透：任何人怎样用 Pzhisen——pzhisen.online——让 AI 智能体接管推广营销。",
        ],
    },
    {
        "id": "v4",
        "name": "张总",
        "voice": "zh-TW-YunJheNeural",
        "intro": [
            "你好，我是张总——专注科技与数字化增长的企业家。",
            "我要详细说明，为什么 pzhisen.online 上的 Pzhisen，能让推广营销变得极其便捷、迅速、而且全自动。",
        ],
    },
    {
        "id": "v5",
        "name": "刘总",
        # Yunxia is a child voice — use Yunyang with higher pitch for a distinct adult male.
        "voice": "zh-CN-YunyangNeural",
        "rate": "+4%",
        "pitch": "+6Hz",
        "intro": [
            "各位好，我是刘总。我把个人品牌和企业官网一起做成了可持续获客的系统。",
            "下面我认真讲清楚：全球任何人如何用 Pzhisen——也就是 pzhisen.online——实现全年每天二十四小时不间断的 AI 推广。",
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


async def synth_cue(
    text: str,
    voice: str,
    out_mp3: Path,
    *,
    rate: str = RATE,
    pitch: str = "+0Hz",
) -> None:
    communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    await communicate.save(str(out_mp3))


async def build_version(ver: dict) -> float:
    vid = ver["id"]
    voice = ver["voice"]
    rate = ver.get("rate", RATE)
    pitch = ver.get("pitch", "+0Hz")
    cues = list(ver["intro"]) + BODY
    out_dir = ASSETS / vid
    out_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix=f"pzhisen-zh-{vid}-tts-") as tmp:
        tmp_path = Path(tmp)
        parts: list[Path] = []
        durations: list[float] = []

        print(f"\n=== {vid} / {ver['name']} / {voice} rate={rate} pitch={pitch} — {len(cues)} cues ===")
        for i, text in enumerate(cues):
            part = tmp_path / f"cue_{i:02d}.mp3"
            await synth_cue(text, voice, part, rate=rate, pitch=pitch)
            dur = probe_duration(part)
            parts.append(part)
            durations.append(dur)
            print(f"  [{i+1:02d}/{len(cues)}] {dur:5.2f}s  {text[:28]}…")

        gap = 0.18
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
    print("\nAll Chinese narrations ready.")


if __name__ == "__main__":
    asyncio.run(main())
