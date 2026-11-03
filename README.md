# Framepatch

Free browser-based video container patcher for mobile and desktop.

Choose an MP4/MOV, patch it locally, and download the result. Video and audio are preserved without re-encoding. Files never upload to a processing server.

## Deploy on Render

Create a Static Site connected to this repository:

- Branch: `main`
- Build command: `echo "Static site ready"`
- Publish directory: `dist`

Alternatively, create a Blueprint using the included `render.yaml`.

No environment variables, databases, or backend services are required.

## Export settings

- Original quality: preserves encoded video/audio and optimizes the MP4 container.
- Custom FPS: any frame rate from 1 to 120, including fractional rates.
- Resolution: original, 720p, 1080p, 1440p, 4K UHD, or fit within 4096 pixels per side. Aspect ratio is preserved without cropping.
- Quality slider: constant quality encoding, from smaller files to maximum quality.
- Optional target bitrate: up to 100 Mbps; overrides the quality slider.
- TikTok HD preset: 1080p, 60 FPS. Max input preset: fit within 4096px, 60 FPS.

TikTok's Content Posting API documents 23–60 FPS and 360–4096 pixels per side. Those are upload limits, not a guarantee of playback resolution. Higher FPS exports are available for other workflows. Frames are duplicated or dropped; no optical-flow interpolation is performed. Scaling cannot reconstruct missing detail.

Custom exports use H.264/yuv420p video and AAC audio. They re-encode locally, require an initial ~31 MB engine download, and support inputs up to 500 MB. Available memory and device speed affect large exports. Original-quality patching remains available for larger files. Fragmented/compressed MP4 is rejected in original mode.

## Encoder

Unmodified @ffmpeg/ffmpeg 0.12.15 browser loader/worker are included in `dist/vendor`. @ffmpeg/core 0.12.10 is loaded from jsDelivr on demand. See [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) and [core source](https://github.com/ffmpegwasm/ffmpeg.wasm-core) for source and license information. No user video is sent to that CDN.

## Verification

The original patcher's byte-preservation checks pass. A real browser export was downloaded and independently verified as H.264, 120 FPS, 120 frames over one second, with AAC audio; it decodes without errors. Settings validation covers fractional FPS, bounds, and all resolution expressions. Mobile layout is responsive; large exports remain constrained by device memory.

## Local preview

Serve `dist` with any static HTTP server, for example:

```sh
python -m http.server 5174 --directory dist
```

Open http://localhost:5174. Google Fonts provides optional typography, with local fallbacks.
