import { NextRequest, NextResponse } from "next/server";

const UPSTREAM_BASE =
  process.env.CAUGHT_CAM_API || "https://webcams.nyctmc.org/api/cameras";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id || !/^[0-9a-fA-F-]{8,}$/.test(id)) {
    return new NextResponse("bad id", { status: 400 });
  }
  const url = `${UPSTREAM_BASE}/${encodeURIComponent(id)}/image?t=${Date.now()}`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "image/*",
        "User-Agent": "Mozilla/5.0 (caught/0.1)",
        Referer: "https://webcams.nyctmc.org/",
      },
      cache: "no-store",
    });
    if (!res.ok || !res.body) {
      return new NextResponse(`upstream ${res.status}`, { status: 502 });
    }
    const ct = res.headers.get("content-type") || "image/jpeg";
    return new NextResponse(res.body, {
      headers: {
        "Content-Type": ct,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return new NextResponse(String(e?.message || e), { status: 502 });
  }
}
