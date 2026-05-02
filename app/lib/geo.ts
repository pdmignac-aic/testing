import type { Camera } from "./types";

const R = 6371000;

export function distanceMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function nearbyCameras(
  cams: Camera[],
  lat: number,
  lng: number,
  radiusMeters: number
): Array<{ cam: Camera; distance: number }> {
  const results: Array<{ cam: Camera; distance: number }> = [];
  for (const cam of cams) {
    const d = distanceMeters(lat, lng, cam.latitude, cam.longitude);
    if (d <= radiusMeters) results.push({ cam, distance: d });
  }
  results.sort((a, b) => a.distance - b.distance);
  return results;
}

export function nearestCamera(
  cams: Camera[],
  lat: number,
  lng: number
): { cam: Camera; distance: number } | null {
  let best: { cam: Camera; distance: number } | null = null;
  for (const cam of cams) {
    const d = distanceMeters(lat, lng, cam.latitude, cam.longitude);
    if (!best || d < best.distance) best = { cam, distance: d };
  }
  return best;
}
