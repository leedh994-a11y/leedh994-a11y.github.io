# Pzhisen Promo Videos

Polished talking-head + B-roll cuts with burned-in subtitles.
Landscape (1920×1080) and vertical (1080×1920) for each language.

## Chinese

| | |
|---|---|
| Landscape | `pzhisen-promo-zh.mp4` |
| Vertical | `pzhisen-promo-zh-vertical.mp4` |
| Player | `/promo-video-zh.html` |
| Presenter | 陈总 |
| Voice | `zh-CN-YunyangNeural` |
| Rebuild | `python3 make_narration_zh.py` then `python3 build_video_zh_v2.py` |

Vertical captions use a proper ASS file (`assets/narration-zh-vertical.ass`) with
`PlayRes 1080×1920`, modest font size (~34), bottom alignment (`MarginV≈88`),
and short 1–2 line wraps so talking-head remains easy to watch.

## English

| | |
|---|---|
| Landscape | `pzhisen-promo-en.mp4` |
| Vertical | `pzhisen-promo-en-vertical.mp4` |
| Player | `/promo-video.html` |
| Voice | `en-US-ChristopherNeural` |
| Rebuild | `python3 build_video_v2.py` |

## Five vertical variants (EN)

Five distinct American-presenter cuts for TikTok / Reels / Shorts / Douyin.

| Version | Presenter | Voice | Output |
|---|---|---|---|
| V1 | Michael | `en-US-ChristopherNeural` | `versions/pzhisen-promo-v1-vertical.mp4` |
| V2 | David | `en-US-GuyNeural` | `versions/pzhisen-promo-v2-vertical.mp4` |
| V3 | James | `en-US-EricNeural` | `versions/pzhisen-promo-v3-vertical.mp4` |
| V4 | Carlos | `en-US-RogerNeural` | `versions/pzhisen-promo-v4-vertical.mp4` |
| V5 | William | `en-US-BrianNeural` | `versions/pzhisen-promo-v5-vertical.mp4` |

| | |
|---|---|
| Format | Vertical 1080×1920 · English burned-in subtitles |
| Player | `/promo-versions.html` |
| Assets | `assets/versions/v{1-5}/` |
| Narration | `python3 make_narration_versions.py` |
| Rebuild | `python3 build_versions_vertical.py` (`v1`…`v5` or `all`) |
| Re-burn subs only | `python3 build_versions_vertical.py all --subs-only` (needs silent intermediates) |

## Pipeline

1. `python3 make_ui_broll.py` — dashboard / publish / analytics B-roll
2. Narration: edge-tts → `assets/narration*.mp3` + VTT
3. Frames: Pillow Ken Burns + title chrome
4. Encode: ffmpeg burn-in subtitles + AAC mux

```bash
pip3 install Pillow edge-tts
# ffmpeg on PATH
python3 make_ui_broll.py
python3 build_video_v2.py      # EN landscape + vertical
python3 build_video_zh_v2.py   # ZH landscape + vertical
```

Legacy single-cut builders: `build_video.py`, `build_video_zh.py`.
