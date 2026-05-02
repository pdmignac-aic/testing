import type { Capture } from "./types";
import { getBlob } from "./store";

const W = 720;
const H = 1280;
const TOTAL_MS = 15000;
const FPS = 30;

const COL_CREAM = "#f7f1e3";
const COL_PAPER = "#efe6d2";
const COL_INK = "#0a1746";
const COL_ASH = "#6b7790";
const COL_COBALT = "#1d3fb3";

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
  // Cream paper background
  ctx.fillStyle = COL_CREAM;
  ctx.fillRect(0, 0, W, H);

  // Image area: full width, centered, slight margin from top
  const targetW = W;
  const ratio = img.naturalHeight / img.naturalWidth;
  const drawW = targetW;
  const drawH = drawW * ratio;
  const drawX = 0;
  const drawY = 110;
  // @ts-ignore — pixelated look
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, drawX, drawY, drawW, drawH);

  // Subtle paper grain over the photo
  ctx.globalAlpha = 0.08;
  for (let i = 0; i < 240; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "#000000" : "#ffffff";
    ctx.fillRect(Math.random() * W, drawY + Math.random() * drawH, 2, 2);
  }
  ctx.globalAlpha = 1;

  // Top header strip
  ctx.fillStyle = COL_INK;
  ctx.font = "700 30px 'JetBrains Mono', monospace";
  ctx.textBaseline = "top";
  ctx.fillText("CAUGHT", 36, 40);

  ctx.font = "500 22px 'JetBrains Mono', monospace";
  ctx.fillStyle = COL_COBALT;
  ctx.textAlign = "right";
  ctx.fillText("FOUND FOOTAGE", W - 36, 44);
  ctx.textAlign = "left";

  // Bottom caption block
  ctx.fillStyle = COL_PAPER;
  ctx.fillRect(0, H - 220, W, 220);

  ctx.fillStyle = COL_INK;
  ctx.font = "700 30px 'JetBrains Mono', monospace";
  const name =
    cap.camName.length > 32 ? cap.camName.slice(0, 32) + "…" : cap.camName;
  ctx.fillText(name.toUpperCase(), 36, H - 190);

  ctx.font = "500 24px 'JetBrains Mono', monospace";
  ctx.fillStyle = COL_ASH;
  ctx.fillText(fmtTime(cap.capturedAt), 36, H - 150);

  ctx.font = "500 20px 'JetBrains Mono', monospace";
  ctx.fillStyle = COL_COBALT;
  ctx.fillText(`${cap.lat.toFixed(4)}, ${cap.lng.toFixed(4)}`, 36, H - 116);

  // Progress bar
  ctx.fillStyle = "rgba(10,23,70,0.12)";
  ctx.fillRect(36, H - 60, W - 72, 4);
  ctx.fillStyle = COL_COBALT;
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
    const rec = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: 4_000_000,
    });
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
