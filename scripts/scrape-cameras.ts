/**
 * Pulls the live NYC DOT camera list and writes it to app/data/cameras.json.
 * Optional: the /api/cameras route will prefer this baked file when present,
 * otherwise it fetches at runtime.
 *
 *   npm run scrape-cams
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const UPSTREAM =
  process.env.CAUGHT_CAM_API || "https://webcams.nyctmc.org/api/cameras";
const OUT = path.resolve(process.cwd(), "app/data/cameras.json");

type RawCam = {
  id?: string;
  cameraId?: string;
  name?: string;
  location?: string;
  title?: string;
  latitude?: number | string;
  longitude?: number | string;
  lat?: number | string;
  lng?: number | string;
  area?: string;
  isOnline?: boolean | string;
};

function normalize(raw: RawCam) {
  const id = String(raw.id ?? raw.cameraId ?? "");
  const name = String(raw.name ?? raw.location ?? raw.title ?? "");
  const lat = Number(raw.latitude ?? raw.lat);
  const lng = Number(raw.longitude ?? raw.lng);
  if (!id || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const isOnline =
    typeof raw.isOnline === "string"
      ? raw.isOnline.toLowerCase() === "true"
      : Boolean(raw.isOnline);
  return {
    id,
    name: name || `Camera ${id.slice(0, 6)}`,
    latitude: lat,
    longitude: lng,
    area: raw.area,
    isOnline,
  };
}

async function main() {
  console.log(`fetching ${UPSTREAM} …`);
  const res = await fetch(UPSTREAM, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (caught/0.1)",
      Referer: "https://webcams.nyctmc.org/",
    },
  });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  const raw = (await res.json()) as RawCam[];
  const cams = raw
    .map(normalize)
    .filter((c): c is NonNullable<ReturnType<typeof normalize>> => c !== null);
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(cams, null, 2));
  console.log(`wrote ${cams.length} cams to ${path.relative(process.cwd(), OUT)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
