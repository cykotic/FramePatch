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

## Patch behavior

Moves the movie index to the front, removes global export metadata, and optionally applies the unspecified movie-duration header observed in the reference sample. Track durations and encoded media stay intact. The sample mode is enabled by default; disable it in Patch settings for a standard movie duration.

Supports standard self-contained MP4/MOV containers. Fragmented/compressed movie headers and unsupported offsets are rejected. Only the movie index is read into memory, bounded to 64 MB; media is retained using Blob slices.

Platform compression results can vary. Improved TikTok upload quality has not been verified.

## Local preview

Serve `dist` with any static HTTP server, for example:

```sh
python -m http.server 5174 --directory dist
```

Open http://localhost:5174. Google Fonts provides optional typography, with local fallbacks.
