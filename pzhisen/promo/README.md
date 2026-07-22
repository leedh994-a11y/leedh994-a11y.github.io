# Pzhisen Promo Videos

## Chinese (recommended for CN audience)

- **Video:** `pzhisen-promo-zh.mp4` (1920×1080, ~2:01, Chinese burned-in subtitles, Chinese male narration)
- **Player page:** `/promo-video-zh.html`
- **Presenter:** 陈总 (Chinese businessman visuals)
- **Voice:** `zh-CN-YunyangNeural` (professional male)
- **Rebuild:**
  1. `python3 make_narration_zh.py`  (edge-tts → `assets/narration-zh.mp3` + VTT/SRT)
  2. `python3 build_video_zh.py`     (Pillow frames + ffmpeg burn-in)

## English

- **Video:** `pzhisen-promo-en.mp4` (1920×1080, ~2:08, English burned-in subtitles, American male narration)
- **Player page:** `/promo-video.html`
- **Rebuild:** `python3 build_video.py` (requires `edge-tts`, Pillow, ffmpeg)

Narration voice (EN): `en-US-ChristopherNeural`

## Dependencies

```bash
pip3 install Pillow edge-tts
# ffmpeg required on PATH
```
