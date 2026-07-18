# Hero background video — encoding

The homepage hero has an ambient background video (`public/assets/video/`).
It is **desktop-only** (≥64rem), plays at **12% opacity behind a vignette**, and
is never loaded on mobile or under `prefers-reduced-motion`.

That display context is the whole reason the settings below are so aggressive:
at 12% opacity the footage is crushed to a texture. Frames encoded at CRF 32 and
at CRF 18 are indistinguishable once composited over the page background — this
was checked by compositing real frames at the actual opacity, not by eye on the
raw file.

## Current encode

Source was 1280x720, 30fps, 2.1 Mbps, 6.09 MB. Now:

| | value |
|---|---|
| Resolution | 1280x720 (native — no upscale penalty on large displays) |
| Frame rate | 24 fps |
| Codec | H.264 (`libx264`), yuv420p |
| CRF | 32 |
| Audio | none (stripped; it was silent anyway) |
| Size | **1.80 MB** (was 6.09 MB — 70% smaller) |

H.264 only. A WebM was previously shipped alongside it, but it was listed after
the mp4 in the `<source>` order and was *larger*, so no browser ever selected
it — 7.18 MB of pure dead weight. Don't reintroduce one.

## Re-encoding

`ffmpeg` is not a project dependency. Install it, or pull a throwaway binary:

```bash
npm i -D ffmpeg-static           # temporary — remove it afterwards
FF=$(node -e "console.log(require('ffmpeg-static'))")

"$FF" -y -i SOURCE.mp4 \
  -an \
  -vf "fps=24" \
  -c:v libx264 -crf 32 -preset slower \
  -pix_fmt yuv420p -movflags +faststart \
  public/assets/video/Website-sizzle-reel_mp4.mp4

npm uninstall ffmpeg-static
```

`-movflags +faststart` matters: it moves the index to the front so playback can
begin before the file finishes downloading.

## If the footage is ever replaced

- Keep it short (~25s) and seamless — it loops.
- Re-cut the poster too (`Website-sizzle-reel_poster.*.jpg`); it's what shows
  before the video is fetched, and on any device that never fetches it.
- Going below 1280 wide is tempting (960 tested 0.42 MB smaller and looked
  identical) but compounds upscaling on 2560px displays for very little gain.
