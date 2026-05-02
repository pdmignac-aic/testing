let ctx: AudioContext | null = null;
let armed = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const C: typeof AudioContext | undefined =
    (window as any).AudioContext ?? (window as any).webkitAudioContext;
  if (!C) return null;
  ctx = new C();
  return ctx;
}

/** Call inside a user gesture (Start tap) to unlock audio on iOS Safari. */
export function armAudio(): void {
  if (armed) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  // Silent buffer to fully unlock
  const buffer = c.createBuffer(1, 1, 22050);
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.connect(c.destination);
  src.start(0);
  armed = true;
}

/** Camera shutter "click" — short attack, fast decay. */
export function playShutter(): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  const t = c.currentTime;

  // Click body: down-sweep
  const o = c.createOscillator();
  o.type = "square";
  o.frequency.setValueAtTime(2400, t);
  o.frequency.exponentialRampToValueAtTime(180, t + 0.08);

  const og = c.createGain();
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(0.32, t + 0.005);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

  // Tail noise: shutter mechanism feel
  const noiseLen = Math.floor(c.sampleRate * 0.06);
  const noiseBuf = c.createBuffer(1, noiseLen, c.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < noiseLen; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen);
  }
  const n = c.createBufferSource();
  n.buffer = noiseBuf;
  const ng = c.createGain();
  ng.gain.setValueAtTime(0.18, t + 0.04);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);

  o.connect(og).connect(c.destination);
  n.connect(ng).connect(c.destination);
  o.start(t);
  o.stop(t + 0.13);
  n.start(t + 0.04);
  n.stop(t + 0.15);
}
