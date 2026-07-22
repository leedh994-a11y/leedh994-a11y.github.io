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

## English

| | |
|---|---|
| Landscape | `pzhisen-promo-en.mp4` |
| Vertical | `pzhisen-promo-en-vertical.mp4` |
| Player | `/promo-video.html` |
| Voice | `en-US-ChristopherNeural` |
| Rebuild | `python3 build_video_v2.py` |

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
