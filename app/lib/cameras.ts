import type { Camera } from "./types";

let cache: Camera[] | null = null;
let inflight: Promise<Camera[]> | null = null;

export async function loadCameras(): Promise<Camera[]> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch("/api/cameras")
    .then((r) => {
      if (!r.ok) throw new Error(`cameras fetch failed: ${r.status}`);
      return r.json();
    })
    .then((data: Camera[]) => {
      cache = data;
      inflight = null;
      return data;
    })
    .catch((err) => {
      inflight = null;
      throw err;
    });
  return inflight;
}

export function camImageUrl(camId: string): string {
  return `/api/cam-image?id=${encodeURIComponent(camId)}&t=${Date.now()}`;
}
