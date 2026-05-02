import type { Camera, Capture } from "./types";
import { addCapture } from "./store";

export async function captureFromCam(
  cam: Camera,
  source: Capture["source"]
): Promise<Capture> {
  const url = `/api/cam-image?id=${encodeURIComponent(cam.id)}&t=${Date.now()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`cam image fetch failed: ${res.status}`);
  const blob = await res.blob();
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const cap: Capture = {
    id,
    capturedAt: Date.now(),
    camId: cam.id,
    camName: cam.name,
    lat: cam.latitude,
    lng: cam.longitude,
    source,
  };
  await addCapture(cap, blob);
  return cap;
}
