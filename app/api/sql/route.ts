import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { query?: string; limit?: number } | null;
  if (!body?.query) return NextResponse.json({ error: "Missing query" }, { status: 400 });

  const { data, error } = await supabase.rpc("run_readonly_query", {
    query_text: body.query,
    row_limit: body.limit ?? 1000,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ rows: data ?? [] });
}
