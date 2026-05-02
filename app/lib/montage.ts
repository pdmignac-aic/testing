import type { Capture } from "./types";
import { getBlob } from "./store";

const W = 720;
const H = 1280;
const TOTAL_MS = 15000;
const FPS = 30;

function pickMimeType(): string {
  const candidates = [
    "video/mp4;codecs=h264,aac",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const t of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) return t;
  }
  return "video/webm";
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function pickFrames(captures: Capture[], count: number): Capture[] {
  if (captures.length === 0) return [];
  if (captures.length <= count) return captures.slice();
  const out: Capture[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor((i / count) * captures.length);
    out.push(captures[idx]);
  }
  return out;
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cap: Capture,
  progress: number
) {
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, W, H);

  const targetW = W;
  const ratio = img.naturalHeight / img.naturalWidth;
  const drawW = targetW;
  const drawH = drawW * ratio;
  const drawY = (H - drawH) / 2 - 80;
  // @ts-ignore
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, drawY, drawW, drawH);

  // grain overlay
  ctx.globalAlpha = 0.08;
  for (let i = 0; i < 200; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "#ffffff" : "#000000";
    ctx.fillRect(Math.random() * W, drawY + Math.random() * drawH, 2, 2);
  }
  ctx.globalAlpha = 1;

  // Vignette
  const grad = ctx.createRadialGradient(W / 2, H / 2, W * 0.4, W / 2, H / 2, W * 0.9);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.7)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Bottom captions
  ctx.fillStyle = "#ededed";
  ctx.font = "700 36px 'JetBrains Mono', monospace";
  ctx.textBaseline = "top";
  ctx.fillText("CAUGHT", 36, H - 220);

  ctx.font = "500 28px 'JetBrains Mono', monospace";
  ctx.fillStyle = "#9a9a9a";
  ctx.fillText(fmtTime(cap.capturedAt), 36, H - 170);

  ctx.font = "500 26px 'JetBrains Mono', monospace";
  ctx.fillStyle = "#ededed";
  const name = cap.camName.length > 36 ? cap.camName.slice(0, 36) + "…" : cap.camName;
  ctx.fillText(name.toUpperCase(), 36, H - 130);

  // progress bar
  ctx.fillStyle = "#222";
  ctx.fillRect(36, H - 60, W - 72, 4);
  ctx.fillStyle = "#ff2e2e";
  ctx.fillRect(36, H - 60, (W - 72) * progress, 4);
}

export type MontageResult = { blob: Blob; mime: string; durationMs: number };

export async function generateMontage(
  captures: Capture[]
): Promise<MontageResult> {
  if (captures.length === 0) throw new Error("no captures");

  const sorted = captures.slice().sort((a, b) => a.capturedAt - b.capturedAt);
  const frames = pickFrames(sorted, Math.min(12, sorted.length));
  const blobs = await Promise.all(
    frames.map(async (c) => {
      const b = await getBlob(c.id);
      if (!b) throw new Error(`missing blob for ${c.id}`);
      return b;
    })
  );
  const urls = blobs.map((b) => URL.createObjectURL(b));
  try {
    const imgs = await Promise.all(urls.map((u) => loadImage(u)));

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    drawFrame(ctx, imgs[0], frames[0], 0);

    const stream = canvas.captureStream(FPS);
    const mime = pickMimeType();
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    const done = new Promise<MontageResult>((resolve) => {
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: mime });
        resolve({ blob, mime, durationMs: TOTAL_MS });
      };
    });

    rec.start();

    const start = performance.now();
    await new Promise<void>((resolve) => {
      const tick = () => {
        const elapsed = performance.now() - start;
        const progress = Math.min(1, elapsed / TOTAL_MS);
        const idx = Math.min(
          frames.length - 1,
          Math.floor(progress * frames.length)
        );
        drawFrame(ctx, imgs[idx], frames[idx], progress);
        if (elapsed >= TOTAL_MS) {
          resolve();
        } else {
          requestAnimationFrame(tick);
        }
      };
      tick();
    });

    rec.stop();
    return await done;
  } finally {
    urls.forEach((u) => URL.revokeObjectURL(u));
  }
}
