# Caught

A passive paparazzi reel of your day in NYC. The cams are watching, and now
you have the footage.

You walk around the city. In the background the app polls your location and,
when you pass within ~75 m of an [NYC DOT traffic camera][nyc-dot], grabs the
current frame from that cam. Tap **Make my montage** at the end and get a
15-second vertical mp4 — grainy, candid, low-res — ready to share.

Built for a 5-minute live demo. No accounts, no backend, all client-side.

[nyc-dot]: https://webcams.nyctmc.org/

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

That's it. There are no required env vars.

For a production build:

```bash
npm run build && npm start
```

## How it works

- **Cam list** — `/api/cameras` proxies the NYC DOT cam list from
  `https://webcams.nyctmc.org/api/cameras`, normalises it, and caches it for 6
  hours. If you want a fully baked static list, run `npm run scrape-cams`
  and the route will prefer that JSON file.
- **Cam image** — `/api/cam-image?id={uuid}` proxies the live still from
  `https://webcams.nyctmc.org/api/cameras/{uuid}/image`. Proxying sidesteps
  any CORS / Referer requirements.
- **Capture loop** — when you tap **Start catching**, the app uses
  `navigator.geolocation.watchPosition` plus a 30 s `setInterval`
  fallback. On every position update it finds cams within 75 m and fires a
  capture for any cam not captured in the last 90 s.
- **Storage** — capture metadata in `localStorage`, image blobs in
  `IndexedDB`. No server.
- **Montage** — render frames into a 720×1280 canvas, capture with
  `MediaStream` + `MediaRecorder`, total 15 s. Output is mp4 if the browser
  supports it, otherwise webm.
- **Map** — Leaflet + CartoDB Dark Matter tiles. ~900 cam dots rendered with
  `preferCanvas` for performance. Cams within 75 m turn red; user location is
  the pulsing red dot.

## Demo path

1. Hand the phone to a judge. Tap **Start catching**.
2. Walk for ~5 min. The status pill turns red and shows nearby cam count.
3. Open **Roll** — captures appear in chronological grid.
4. Open **Montage** → **Make my montage** → 15 s vertical video.
5. **Share** uses the Web Share API on iOS/Android, falls back to download.

### Fallbacks (because live demos die)

- **CATCH NOW** — visible at all times. Captures from your nearest cam (or a
  random midtown cam if no location yet). Bypasses the 75 m gate.
- **Demo roll** — long-press the **CAUGHT** logo for ~1.2 s. Seeds the roll
  with 12 live frames from random midtown cams. Use this if walking around
  isn't producing captures.

## Aesthetic rules (non-negotiable)

- Cam frames are displayed at native resolution. No upscaling, no AI
  enhancement, no filters that "fix" the grain (`image-rendering: pixelated`).
- Dark only. Black background, JetBrains Mono, lots of negative space.
- Captions are timestamps and street names only — nothing else.

## File map

```
app/
  layout.tsx                root layout (mono font, viewport)
  globals.css               dark theme, Leaflet overrides, pulse animation
  page.tsx                  main app — modes, capture loop, toasts, demo seed
  components/
    HeaderBar.tsx           CAUGHT logo + status pill + tab nav
    Controls.tsx            CATCH NOW + Start/Stop catching
    MapView.tsx             SSR-safe wrapper (dynamic import)
    MapInner.tsx            Leaflet map, cam dots, user pulse
    RollGrid.tsx            grid of captures + lightbox
    MontageView.tsx         render and share the 15 s mp4
  lib/
    types.ts                Camera, Capture
    geo.ts                  haversine, nearby/nearest cams
    cameras.ts              client cache + image URL helper
    capture.ts              fetch + persist a single capture
    store.ts                localStorage roll + IndexedDB blobs
    montage.ts              canvas slideshow + MediaRecorder
  api/
    cameras/route.ts        cam list proxy + cache
    cam-image/route.ts      single cam image proxy
scripts/
  scrape-cameras.ts         optional pre-bake of cam list
```

## Known limitations

- iOS Safari throttles geolocation and timers when the tab is backgrounded.
  The status pill nudges users to keep the tab visible; manual capture is the
  fallback.
- `MediaRecorder` mp4 support varies. We try mp4 first, then webm. iOS 17.4+
  supports mp4 directly; older browsers fall back to webm and
  Web Share Sheet still ingests both.
- localStorage caps at ~5 MB across browsers; only the metadata lives there.
  Image blobs are in IndexedDB which has much more headroom.
