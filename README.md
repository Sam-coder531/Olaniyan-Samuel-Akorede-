# Olaniyan-Samuel-Akorede-

## Downloaded TikTok

Source: https://vm.tiktok.com/ZSpsPVxj9/ → [@samanastudio · 7688424231801064726](https://www.tiktok.com/@samanastudio/video/7688424231801064726)

| File | Description |
| --- | --- |
| `media/7688424231801064726.mp4` | 1080×1920, H.264/AAC, 11s (watermark-free) |
| `media/7688424231801064726-audio.mp3` | original sound track |
| `media/7688424231801064726-cover.jpg` | cover frame |
| `media/README.md` | full metadata (caption, stats, dates) |

### Re-download / fetch any other TikTok

The sandbox this repo is worked in cannot reach TikTok, so fetching runs on GitHub Actions:

```bash
gh workflow run tiktok-fetch.yml --ref main \
  -f url="https://vm.tiktok.com/ZSpsPVxj9/" \
  -f target_branch="main"
```

The workflow uses `yt-dlp`, picks the H.264 (browser-playable) stream, grabs the audio
track and cover, writes a metadata summary, and commits everything under `media/`.
