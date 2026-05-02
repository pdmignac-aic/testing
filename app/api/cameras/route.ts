import { NextResponse } from "next/server";
import type { Camera } from "@/app/lib/types";

const UPSTREAM =
  process.env.CAUGHT_CAM_API || "https://webcams.nyctmc.org/api/cameras";

let cache: { at: number; data: Camera[] } | null = null;
const TTL_MS = 1000 * 60 * 60 * 6; // 6h

async function loadBaked(): Promise<Camera[] | null> {
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const file = path.resolve(process.cwd(), "app/data/cameras.json");
    const raw = await fs.readFile(file, "utf-8").catch(() => null);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length > 0) return arr as Camera[];
    return null;
  } catch {
    return null;
  }
}

function normalize(raw: any): Camera | null {
  if (!raw) return null;
  const id = String(raw.id ?? raw.cameraId ?? "");
  const name = String(raw.name ?? raw.location ?? raw.title ?? "");
  const lat = Number(raw.latitude ?? raw.lat);
  const lng = Number(raw.longitude ?? raw.lng ?? raw.lon);
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

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) {
    return NextResponse.json(cache.data, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  }

  // Prefer the baked file if someone ran `npm run scrape-cams`
  const baked = await loadBaked();
  if (baked) {
    cache = { at: now, data: baked };
    return NextResponse.json(baked, {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  }

  try {
    const res = await fetch(UPSTREAM, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (caught/0.1)",
        Referer: "https://webcams.nyctmc.org/",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `upstream ${res.status}` },
        { status: 502 }
      );
    }
    const raw = (await res.json()) as unknown;
    const list = Array.isArray(raw) ? raw : [];
    const cams = list
      .map(normalize)
      .filter((c): c is Camera => c !== null && c.isOnline !== false);
    cache = { at: now, data: cams };
    return NextResponse.json(cams, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch (e: any) {
    if (cache) {
      return NextResponse.json(cache.data, {
        headers: { "Cache-Control": "public, max-age=60" },
      });
    }
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 502 }
    );
  }
}
